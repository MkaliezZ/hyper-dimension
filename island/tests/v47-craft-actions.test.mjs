import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ALL_RECIPES,RECIPE_BY_ID,CATALOG_ITEMS} from '../src/contentCatalog.js';
import {createProject,projectSteps,assignProjectStep,syncProjects,controlProject} from '../src/projectPlans.js';
import {restoreTasks} from '../src/taskBoard.js';
import {availableQuantity,commitResources} from '../src/resourceLedger.js';
import {createCraftGame,applyCraftEvent,craftResult,restoreMatchState} from '../src/craftGameReplay.js';
import {WORKSHOP_GAMES} from '../src/workshopCatalog.js';
import {findLinkMove,suggestMatchMove} from '../src/classicRules.js';
import {chooseAction} from './v19-play-helpers.mjs';
await mkdir('qa/v47',{recursive:true});
async function fixture({stock=true}={}){
 const directory=await mkdtemp(resolve('qa/v47/craft-'));let clock=1000000;
 const store=createSaveStore({directory,now:()=>clock}),s=hydrateTown(createZeroState());s.freshStartPending=false;
 if(stock)for(const item of CATALOG_ITEMS)s.inventory[item.id]=999;
 for(const f of Object.values(s.facilities)){f.quality=90;f.condition=100;f.upgrades=4}
 s.research??={};for(let id=0;id<25;id++)s.research[id]=10;
 const {document}=await store.open('pixel',{legacyState:s});
 return {store,document,directory,advance:n=>clock+=n,other:()=>createSaveStore({directory,now:()=>clock})};
}
const begin=(d,recipeId='recipe_lantern',extra={})=>({kind:'craft',operation:'begin',requestId:randomUUID(),recipeId,mode:'2',epoch:d.actions?.epoch||null,expectedSequence:d.actions?.sequence||0,expectedVersion:d.version,...extra});
const command=(r,operation,extra={})=>({kind:'craft',operation,requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version,...extra});
function traceFor(game){
 game=structuredClone(game);const trace=[];const event=e=>{trace.push(e);applyCraftEvent(game,e)};
 if(game.engine==='workshop'){
  event({action:{type:'start'}});
  for(let i=0;i<18000&&game.state.phase!=='result';i++){const a=chooseAction(game.state);if(a)event({action:a});event({dt:1/30})}
 }else if(game.engine==='link'){
  event({action:{type:'start'}});
  for(let i=0;i<200&&!game.result;i++){const m=findLinkMove(game.values,game.level.link.columns,game.level.link.rows);assert(m);event({dt:.05});event({action:{type:'pair',a:m.a,b:m.b}})}
 }else{
  for(let i=0;i<100&&!game.result;i++){const m=suggestMatchMove(restoreMatchState(game.match));assert(m);event({dt:.05});event({action:{type:'swap',a:m[0],b:m[1]}})}
 }
 assert(craftResult(game)?.passed,'legal play failed '+(game.state?.id??game.level.id));
 return {trace,game};
}
async function play(f,start){
 const {trace,game}=traceFor(start.ticket.game);let r=start;
 for(let i=0;i<trace.length;i+=500){const events=trace.slice(i,i+500);f.advance(Math.ceil(events.reduce((n,e)=>n+(e.dt||0),0)*1000)+10);r=await f.store.action('pixel',command(r,'checkpoint',{batch:r.ticket.nextBatch,events}))}
 return {r,game};
}
test('server chooses the seeded game, reserves exact recipe and never accepts a claimed result',async()=>{
 const f=await fixture(),before=structuredClone(f.document.state.inventory),req=begin(f.document,undefined,{seed:1,difficulty:1,quality:100,gain:{coins:99999},cost:{}});
 const start=await f.store.action('pixel',req);
 assert(start.ticket.game);assert.equal(start.ticket.amount,1);assert.equal(start.ticket.difficulty,2);
 assert.deepEqual(start.document.state.resourceLedger.reservations[start.ticket.owner].items,RECIPE_BY_ID.recipe_lantern.cost);
 assert.equal(availableQuantity(start.document.state,'wood'),before.wood-2);
 f.advance(10000);await assert.rejects(f.store.action('pixel',command(start,'finish',{result:{passed:true,quality:100}})),e=>e.code==='craft_unfinished');
 assert.deepEqual((await f.store.current('pixel')).state.inventory,before);
 const {r,game}=await play(f,start);f.advance(2100);const finish=await f.store.action('pixel',command(r,'finish',{quality:999,amount:100,gain:{coins:99999}}));
 assert.equal(finish.receipt.quality,craftResult(game).quality);assert.equal(finish.document.state.inventory.lantern,before.lantern+1);assert.equal(finish.document.state.inventory.wood,before.wood-2);assert.equal(finish.document.state.inventory.ore,before.ore-1);
 assert.equal(finish.document.state.craftHistory.recipe_lantern,1);assert.equal(finish.document.state.roomGames[0].plays,1);assert.equal(finish.document.state.economy.playerGoods.lantern,1);assert(!finish.ticket.game);
 const again=await f.other().action('pixel',command(r,'finish'));assert(again.replayed);assert.equal(again.document.version,finish.document.version);
});
test('duplicate batches replay with a stale version; changed or out-of-order input cannot rewrite saved game',async()=>{
 const f=await fixture(),start=await f.store.action('pixel',begin(f.document,'recipe_pottery')),events=[{action:{type:'start'}},{action:{type:'down',x:550,y:125}},{dt:.05}];f.advance(60);
 const input=command(start,'checkpoint',{batch:1,events}),r=await f.store.action('pixel',input);
 const replay=await f.other().action('pixel',input);assert(replay.replayed);assert.deepEqual(replay.ticket.game,r.ticket.game);
 await assert.rejects(f.store.action('pixel',{...input,events:[{action:{type:'start'}}]}),e=>e.code==='craft_batch_conflict');
 await assert.rejects(f.store.action('pixel',command(r,'checkpoint',{batch:3,events:[]})),e=>e.code==='craft_batch_sequence');
 const restored=await f.other().current('pixel');assert.deepEqual(restored.actions.active.game,r.ticket.game);assert.equal(restored.actions.active.seed,start.ticket.seed);
});
test('time acceleration, nonfinite coordinates and direct state mutations are rejected atomically',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document,'recipe_pottery'));
 for(const events of [[{dt:1}],[{dt:NaN}],[{action:{type:'down',x:Infinity,y:1}}],[{action:{type:'submit',result:{passed:true}}}],[{dt:.05},{dt:.05},{dt:.05},{dt:.05}]]){
  await assert.rejects(f.store.action('pixel',command(r,'checkpoint',{batch:1,events})),e=>['craft_input','craft_clock'].includes(e.code));
  assert.equal((await f.store.current('pixel')).version,r.document.version);
 }
});
test('cancel after partial game releases stock and cannot award by replaying finish',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document,'recipe_pottery'));const before=r.document.state.inventory.pottery;
 const saved=await f.store.action('pixel',command(r,'checkpoint',{batch:1,events:[{action:{type:'start'}},{action:{type:'water'}}]}));
 const cancelled=await f.other().action('pixel',command(saved,'cancel'));assert.equal(cancelled.receipt.outcome,'cancelled');assert.equal(cancelled.document.state.inventory.pottery,before);assert.equal(availableQuantity(cancelled.document.state,'clay'),999);
 const repeat=await f.store.action('pixel',command(saved,'finish'));assert.equal(repeat.receipt.outcome,'cancelled');assert.equal(repeat.document.state.inventory.pottery,before);
});
test('two processes finishing the same legal game award one result with one consumption',async()=>{
 const f=await fixture(),start=await f.store.action('pixel',begin(f.document)),{r}=await play(f,start);f.advance(2100);
 const results=await Promise.all([f.store.action('pixel',command(r,'finish')),f.other().action('pixel',command(r,'finish'))]);assert.equal(results.filter(r=>!r.replayed).length,1);
 const s=(await f.store.current('pixel')).state;assert.equal(s.craftHistory.recipe_lantern,1);assert.equal(s.inventory.lantern,1000);assert.equal(s.inventory.wood,997);
});
test('materials missing at entry stay practice even if stock later appears',async()=>{
 const f=await fixture({stock:false}),start=await f.store.action('pixel',begin(f.document));assert(start.ticket.practice);
 assert(!start.document.state.resourceLedger?.reservations?.[start.ticket.owner]);
 const stocked=structuredClone(start.document.state);stocked.inventory.wood=10;stocked.inventory.ore=10;start.document=(await f.store.save('pixel',{state:stocked,expectedVersion:start.document.version})).document;
 const {r}=await play(f,start);f.advance(2100);const done=await f.store.action('pixel',command(r,'finish'));
 assert.equal(done.receipt.outcome,'practiced');assert.deepEqual(done.receipt.gain,{});assert.equal(done.document.state.inventory.lantern,0);assert.equal(done.document.state.craftHistory.recipe_lantern,undefined);
});
test('all 300 recipes use their actual catalog and return all ingredients on cancel',async()=>{
 const f=await fixture();let d=f.document;
 assert.equal(ALL_RECIPES.length,300);
 for(const recipe of ALL_RECIPES){
  const r=await f.store.action('pixel',begin(d,recipe.id));assert.equal(r.ticket.building,recipe.building);assert.equal(r.ticket.item,recipe.item);assert.equal(r.ticket.practice,false);
  assert.deepEqual(r.document.state.resourceLedger.reservations[r.ticket.owner].items,Object.fromEntries(Object.entries(r.ticket.reservedItems).sort(([a],[b])=>a.localeCompare(b))));
  d=(await f.store.action('pixel',command(r,'cancel'))).document;
 }
 assert.deepEqual(d.state.inventory,f.document.state.inventory);assert.equal(d.actions.active,null);
});
test('native and classic durable rule engines survive JSON midgame across all 25 buildings',()=>{
 for(let id=0;id<25;id++)for(let d=1;d<=3;d++){
  const game=createCraftGame(id,100+id,d),played=traceFor(game);let replay=structuredClone(game);
  for(let i=0;i<played.trace.length;i++){applyCraftEvent(replay,played.trace[i]);if(i%100===0)replay=JSON.parse(JSON.stringify(replay))}
  assert.deepEqual(craftResult(replay),craftResult(played.game),id+'/'+d);
  if(!WORKSHOP_GAMES[id])assert(['link','match'].includes(replay.engine));
 }
});
test('autosave cannot remove or alter craft holds and competing consumers cannot use them',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document));
 const changed=structuredClone(r.document.state);delete changed.resourceLedger.reservations[r.ticket.owner];
 await assert.rejects(f.store.save('pixel',{state:changed,expectedVersion:r.document.version}),e=>e.code==='action_hold_conflict');
 const state=structuredClone(r.document.state);assert.equal(commitResources(state,{cost:{wood:999}}).ok,false);
 state.playerProfile.bio='保留其他信息';const saved=await f.store.save('pixel',{state,expectedVersion:r.document.version});assert.deepEqual(saved.document.actions.active,r.ticket);
 const cancel=await f.other().action('pixel',command({...r,document:saved.document},'cancel'));assert.equal(cancel.document.state.playerProfile.bio,'保留其他信息');
});
test('import, restore and zero restart invalidate old craft epochs and release ingredients',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document)),backup=await f.store.backup('pixel',{expectedVersion:r.document.version});
 let d=(await f.store.restore('pixel',{id:backup.id,expectedVersion:r.document.version})).document;assert.equal(d.actions.active,null);assert.equal(availableQuantity(d.state,'wood'),999);
 await assert.rejects(f.store.action('pixel',command({...r,document:d},'finish')),e=>e.code==='action_stale');
 const next=await f.store.action('pixel',begin(d));d=(await f.store.import('pixel',{data:next.document,expectedVersion:next.document.version})).document;assert.equal(d.actions.active,null);assert.equal(availableQuantity(d.state,'wood'),999);
 const reset=await f.store.restart('pixel',{requestId:'v47-zero-restart',expectedVersion:d.version});assert.equal(reset.document.actions.active,null);assert.equal(reset.document.state.inventory.lantern,0);
});

test('a player project craft survives task restore/sync and deposits one actual delivery',async()=>{
 const f=await fixture(),state=structuredClone(f.document.state);state.inventory.lantern=0;
 const p=createProject(state,{id:'craft-project',title:'第一盏灯',targets:{lantern:1}});assert(p.ok);
 const task=projectSteps(state,p.project.id).find(t=>t.targetItem==='lantern');assert(assignProjectStep(state,task.id,-1).ok);
 const d=(await f.store.save('pixel',{state,expectedVersion:f.document.version})).document;
 let start=await f.store.action('pixel',begin(d,'recipe_lantern',{taskId:task.id}));
 const loaded=structuredClone(start.document.state);restoreTasks(loaded);syncProjects(loaded);assert.equal(loaded.agentTaskLedger.find(t=>t.id===task.id).status,'running');
 start.document=(await f.store.save('pixel',{state:loaded,expectedVersion:start.document.version})).document;
 const {r}=await play(f,start);f.advance(2100);const done=await f.store.action('pixel',command(r,'finish'));
 const t=done.document.state.agentTaskLedger.find(t=>t.id===task.id);assert.equal(t.completed,1);assert.equal(t.evidence.length,1);assert.equal(done.document.state.inventory.lantern,1);
});
test('pausing or reassigning a project blocks in-flight production; cancel returns held inputs',async()=>{
 const f=await fixture(),state=structuredClone(f.document.state);state.inventory.lantern=0;createProject(state,{id:'changed-project',title:'改派灯',targets:{lantern:1}});
 const task=projectSteps(state,'changed-project').find(t=>t.targetItem==='lantern');assignProjectStep(state,task.id,-1);
 const d=(await f.store.save('pixel',{state,expectedVersion:f.document.version})).document,start=await f.store.action('pixel',begin(d,'recipe_lantern',{taskId:task.id})),played=await play(f,start);
 const changed=structuredClone(played.r.document.state);controlProject(changed,'changed-project','pause');
 const saved=(await f.store.save('pixel',{state:changed,expectedVersion:played.r.document.version})).document;
 f.advance(2100);await assert.rejects(f.store.action('pixel',command({...played.r,document:saved},'finish')),e=>e.code==='craft_task_changed');
 const done=await f.store.action('pixel',command({...played.r,document:saved},'cancel'));assert.equal(done.document.state.inventory.lantern,0);assert.equal(done.document.state.inventory.wood,999);assert.equal(done.document.actions.active,null);
});
