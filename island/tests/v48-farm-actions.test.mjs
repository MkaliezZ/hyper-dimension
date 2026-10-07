import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';
import {CROPS} from '../src/farming.js';import {availableQuantity,commitResources,reserveResources} from '../src/resourceLedger.js';
import {queueTask,beginTaskStep,controlTask} from '../src/taskBoard.js';
import {hydratePlacements,decorate,checkDecoration} from '../src/placements.js';
import {hydrateFunctionalFacilities,functionalCommand} from '../src/functionalFacilities.js';
await mkdir('qa/v48',{recursive:true});
async function fixture(edit=()=>{},theme='pixel'){
 const directory=await mkdtemp(resolve('qa/v48/farm-'));let clock=1000000;const store=createSaveStore({directory,now:()=>clock}),s=hydrateTown(createZeroState());s.freshStartPending=false;s.inventory.seed=3;s.inventory.hoe=1;s.inventory.watering_can=1;s.inventory.sickle=1;edit(s);
 const {document}=await store.open(theme,{legacyState:s});return {store,directory,document,theme,advance:n=>clock+=n,other:()=>createSaveStore({directory,now:()=>clock})};
}
const begin=(d,index=0,step='hoe',extra={})=>({kind:'farm',operation:'begin',requestId:randomUUID(),index,step,expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,...extra});
const finish=(r,operation='finish')=>({kind:'farm',operation,requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version});
async function work(f,d,index,step,extra={}){const r=await f.store.action(f.theme,begin(d,index,step,extra));f.advance(Math.ceil(r.ticket.duration*1000));return f.store.action(f.theme,finish(r));}
async function pulse(f,d,seconds,advance=seconds*1000){f.advance(advance);return (await f.store.save(f.theme,{state:d.state,expectedVersion:d.version,saveId:randomUUID(),activeSeconds:seconds})).document;}
test('server derives farm stages/cost/tool/time and one harvest, never client supplied growth or gains',async()=>{
 const f=await fixture();let r=await f.store.action('pixel',{...begin(f.document),duration:0,gain:{wheat:999},stage:4});assert.equal(r.ticket.duration,1.105);assert.equal(availableQuantity(r.document.state,'hoe'),0);
 await assert.rejects(f.store.action('pixel',finish(r)),e=>e.code==='action_early');f.advance(1105);r=await f.store.action('pixel',finish(r));assert.equal(r.document.state.plots[0].stage,1);
 r=await work(f,r.document,0,'sow',{crop:'tomato'});assert.equal(r.document.state.inventory.seed,2);assert.equal(r.document.state.plots[0].crop,'tomato');r=await work(f,r.document,0,'water');
 let d=r.document;await assert.rejects(f.store.action('pixel',begin(d,0,'harvest')),e=>e.code==='farm_stage');
 for(let i=0;i<20;i++)d=await pulse(f,d,15);assert.equal(d.state.plots[0].stage,4);
 const start=await f.store.action('pixel',begin(d,0,'harvest'));f.advance(1230);const done=await f.store.action('pixel',{...finish(start),gain:{tomato:999,coins:999}});assert.deepEqual(done.receipt.gain,{tomato:3,seed:1});assert.equal(done.document.state.inventory.tomato,3);assert.equal(done.document.state.inventory.seed,3);assert.equal(done.document.state.economy.playerGoods.tomato,3);assert.equal(done.document.state.plots[0].stage,0);
 const again=await f.other().action('pixel',finish(start));assert(again.replayed);assert.equal(again.document.state.inventory.tomato,3);
});
test('all 11 crops use their full mature times and catalog yield including seed recovery',async()=>{
 for(const [crop,c] of Object.entries(CROPS)){const f=await fixture(s=>{s.plots[0]={stage:1,growth:0,crop:'wheat'}});let d=(await work(f,f.document,0,'sow',{crop})).document;d=(await work(f,d,0,'water')).document;
 let left=c.seconds;while(left>1){const dt=Math.min(15,left-1);d=await pulse(f,d,dt);left-=dt;}assert.equal(d.state.plots[0].stage,3);d=await pulse(f,d,1);assert.equal(d.state.plots[0].stage,4);
 d=(await work(f,d,0,'harvest')).document;assert.equal(d.state.inventory[c.item],c.yield);assert.equal(d.state.inventory.seed,3);
 }
});
test('farm stage/crop/growth and held materials cannot be overwritten by autosave',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document));const changed=structuredClone(r.document.state);changed.plots[0].stage=4;changed.plots[0].growth=180;
 await assert.rejects(f.store.save('pixel',{state:changed,expectedVersion:r.document.version}),e=>e.code==='farm_state_conflict');
 changed.plots=r.document.state.plots;delete changed.resourceLedger.reservations[r.ticket.owner];await assert.rejects(f.store.save('pixel',{state:changed,expectedVersion:r.document.version}),e=>e.code==='action_hold_conflict');
 const bio=structuredClone(r.document.state);bio.playerProfile.name='守住进度';const saved=await f.store.save('pixel',{state:bio,expectedVersion:r.document.version});assert.equal(saved.document.state.playerProfile.name,'守住进度');
});
test('seed reservation defeats simultaneous consumers and cancelled sow spends nothing',async()=>{
 const f=await fixture(s=>{s.plots[0].stage=1;s.inventory.seed=1}),start=await f.store.action('pixel',begin(f.document,0,'sow',{crop:'wheat'}));assert.equal(availableQuantity(start.document.state,'seed'),0);assert.equal(commitResources(start.document.state,{cost:{seed:1}}).ok,false);
 const done=await f.store.action('pixel',finish(start,'cancel'));assert.equal(done.document.state.inventory.seed,1);assert.equal(done.document.state.plots[0].stage,1);assert.equal(availableQuantity(done.document.state,'seed'),1);
 const retry=await f.store.action('pixel',finish(start));assert.equal(retry.receipt.outcome,'cancelled');
});
test('active time is bounded by wall time, duplicate pulse is idempotent and offline time never grows',async()=>{
 const f=await fixture(s=>{s.plots[0]={stage:3,growth:0,crop:'wheat'}}),enabled=await f.store.action('pixel',{kind:'farm',operation:'enable',requestId:randomUUID(),expectedVersion:f.document.version});let d=enabled.document;
 f.advance(2000);const request={state:d.state,expectedVersion:d.version,saveId:randomUUID(),activeSeconds:15},first=await f.store.save('pixel',request);assert.equal(first.document.state.plots[0].growth,2);
 const retry=await f.other().save('pixel',request);assert(retry.replayed);assert.equal(retry.document.state.plots[0].growth,2);
 await assert.rejects(f.store.save('pixel',{...request,activeSeconds:14}),e=>e.code==='save_id_conflict');
 d=await pulse(f,first.document,0,600000);assert.equal(d.state.plots[0].growth,2);
 await assert.rejects(f.store.save('pixel',{state:d.state,expectedVersion:d.version,activeSeconds:1000,saveId:randomUUID()}),e=>e.code==='farm_clock');
 assert.equal((await f.store.current('pixel')).version,d.version);
});
test('independent NPC plots share one scarce seed and never collide with player or each other',async()=>{
 const f=await fixture(s=>{s.inventory.seed=1;s.plots[1].stage=1;s.plots[2].stage=1}),r=await f.store.action('pixel',begin(f.document,1,'sow',{actor:'npc',actorId:1,crop:'wheat'}));assert.equal(r.ticket.duration,20);assert.equal(r.document.actions.active,null);
 await assert.rejects(f.store.action('pixel',begin(r.document,2,'sow',{actor:'npc',actorId:2,crop:'wheat'})),e=>e.code==='farm_materials');
 await assert.rejects(f.store.action('pixel',begin(r.document,1,'sow',{crop:'wheat'})),e=>e.code==='farm_occupied');
 f.advance(20000);const done=await f.other().action('pixel',finish(r));assert.equal(done.document.state.inventory.seed,0);assert.equal(done.document.state.plots[1].stage,2);assert.equal(done.document.state.economy.playerGoods.wheat||0,0);
});
test('NPC farm and player gather can hold independent tools and settle in either order',async()=>{
 const f=await fixture(s=>{s.inventory.axe=1}),npc=await f.store.action('pixel',begin(f.document,1,'hoe',{actor:'npc',actorId:1})),gather=await f.store.action('pixel',{operation:'begin',requestId:randomUUID(),itemId:'wood',expectedVersion:npc.document.version,expectedSequence:npc.document.actions.sequence,epoch:npc.document.actions.epoch});
 f.advance(20000);const d=(await f.store.action('pixel',{...finish(npc),expectedVersion:gather.document.version})).document;assert.equal(d.state.plots[1].stage,1);assert.equal(d.actions.active.requestId,gather.ticket.requestId);
 const done=await f.store.action('pixel',{operation:'finish',requestId:gather.ticket.requestId,epoch:gather.ticket.epoch,sequence:gather.ticket.sequence,expectedVersion:d.version});assert.equal(done.document.state.inventory.wood,2);
});
test('parallel harvest finishes share a disk lock and leave exactly one product receipt',async()=>{
 const f=await fixture(s=>{s.plots[0]={stage:4,growth:180,crop:'wheat'}}),r=await f.store.action('pixel',begin(f.document,0,'harvest'));f.advance(2000);
 const results=await Promise.all([f.store.action('pixel',finish(r)),f.other().action('pixel',finish(r))]);assert.equal(results.filter(x=>!x.replayed).length,1);assert.equal((await f.store.current('pixel')).state.inventory.wheat,2);
});
test('npc assignment pause prevents late delivery and cancellation returns seed to the task',async()=>{
 const f=await fixture(s=>{s.plots[1].stage=1;queueTask(s,{id:'farm-assignment',npcId:1,goal:'farm',intent:'收集小麦',quantity:2},{targetItem:'wheat',resourceOwner:'task:farm-assignment'});beginTaskStep(s,'farm-assignment');reserveResources(s,'task:farm-assignment',{seed:1})});
 const task=f.document.state.agentTaskLedger[0],r=await f.store.action('pixel',begin(f.document,1,'sow',{actor:'npc',actorId:1,crop:'wheat',assignmentId:task.id,operationId:task.operationId}));f.advance(20000);
 const changed=structuredClone(r.document.state);controlTask(changed,task.id,'pause');const saved=await f.store.save('pixel',{state:changed,expectedVersion:r.document.version});
 await assert.rejects(f.store.action('pixel',{...finish(r),expectedVersion:saved.document.version}),e=>e.code==='farm_task_changed');
 const cancel=await f.store.action('pixel',{...finish(r,'cancel'),expectedVersion:saved.document.version});assert.equal(cancel.document.state.resourceLedger.reservations['task:farm-assignment'].items.seed,1);assert.equal(cancel.document.state.plots[1].stage,1);
});
test('npc actual harvest records real assignment delivery once without player credit',async()=>{
 const f=await fixture(s=>{s.plots[1]={stage:4,growth:180,crop:'wheat'};queueTask(s,{id:'farm-deliver',npcId:1,goal:'farm',intent:'收集小麦',quantity:2},{targetItem:'wheat'});beginTaskStep(s,'farm-deliver')});
 const task=f.document.state.agentTaskLedger[0],r=await f.store.action('pixel',begin(f.document,1,'harvest',{actor:'npc',actorId:1,assignmentId:task.id,operationId:task.operationId}));f.advance(20000);const done=await f.store.action('pixel',finish(r));assert.equal(done.document.state.agentTaskLedger[0].completed,2);assert.equal(done.document.state.agentTaskLedger[0].evidence.length,1);assert.equal(done.document.state.economy.playerGoods.wheat||0,0);assert.equal(done.document.state.inventory.wheat,2);
});
for(const theme of ['pixel','origami'])test(theme+' irrigation leases real plots and consumes one charge only on successful completion',async()=>{
 let displayId;const f=await fixture(s=>{s.journey={completed:{harvest:true}};hydratePlacements(s,theme);hydrateFunctionalFacilities(s);s.inventory.c14_6=1;s.inventory.c6_5=1;let pos;
 for(let y=624;y<790&&!pos;y+=16)for(let x=344;x<640;x+=16)if(checkDecoration(s,{item:'c14_6',x,y,rotation:0},{theme}).ok){pos={x,y};break}assert(pos);
 const r=decorate(s,{commandId:'farm-place',action:'place',item:'c14_6',...pos,rotation:0},{theme});assert(r.ok);displayId=r.id;hydrateFunctionalFacilities(s);
 assert(functionalCommand(s,{commandId:'farm-load',displayId,action:'load',expectedRevision:s.functionalFacilities.revision}).ok);
 assert(functionalCommand(s,{commandId:'farm-config',displayId,action:'configure',targets:[1],enabled:true,expectedRevision:s.functionalFacilities.revision}).ok);s.plots[1]={stage:2,growth:0,crop:'tomato'};
 },theme);
 const r=await f.store.action(theme,begin(f.document,1,'water',{actor:'facility',actorId:displayId}));await assert.rejects(f.store.action(theme,begin(r.document,1,'water')),e=>e.code==='farm_occupied');assert.equal(r.document.state.functionalFacilities.units[displayId].charges,8);f.advance(3000);
 const done=await f.store.action(theme,finish(r));assert.equal(done.document.state.plots[1].stage,3);assert.equal(done.document.state.plots[1].growth,0);assert.equal(done.document.state.functionalFacilities.units[displayId].charges,7);assert.equal(done.document.state.functionalFacilities.units[displayId].currentPlot,null);
 const again=await f.other().action(theme,finish(r));assert(again.replayed);assert.equal(again.document.state.functionalFacilities.units[displayId].charges,7);
});
test('restore/import/reset release all farm leases and reject earlier action epochs',async()=>{
 const f=await fixture(s=>{s.plots[0].stage=1}),r=await f.store.action('pixel',begin(f.document,0,'sow',{crop:'wheat'})),backup=await f.store.backup('pixel',{expectedVersion:r.document.version});
 const restored=await f.store.restore('pixel',{id:backup.id,expectedVersion:r.document.version});assert.equal(restored.document.state.farmControl,undefined);assert.equal(availableQuantity(restored.document.state,'seed'),3);assert.equal(restored.document.actions.active,null);
 await assert.rejects(f.store.action('pixel',{...finish(r),expectedVersion:restored.document.version}),e=>e.code==='action_stale');
 const s=await f.store.action('pixel',begin(restored.document,0,'sow',{crop:'wheat'}));const imported=await f.store.import('pixel',{data:s.document,expectedVersion:s.document.version});assert.equal(availableQuantity(imported.document.state,'seed'),3);
 const reset=await f.store.restart('pixel',{requestId:'farm-zero-restart',expectedVersion:imported.document.version});assert.equal(reset.document.state.inventory.seed,0);assert(reset.document.state.plots.every(p=>p.stage===0));
});
test('old request cannot change plot or crop on replay and expired actions allow cancellation',async()=>{
 const f=await fixture(s=>{s.plots[0].stage=1}),input=begin(f.document,0,'sow',{crop:'wheat'}),r=await f.store.action('pixel',input);
 await assert.rejects(f.store.action('pixel',{...input,crop:'tomato'}),e=>e.code==='action_id_conflict');await assert.rejects(f.store.action('pixel',{...input,index:1}),e=>e.code==='action_id_conflict');
 f.advance(1800001);await assert.rejects(f.store.action('pixel',finish(r)),e=>e.code==='action_expired');const cancelled=await f.store.action('pixel',finish(r,'cancel'));assert.equal(cancelled.document.state.inventory.seed,3);
});
