import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {CROPS} from '../src/farming.js';
import {applyCraftEvent} from '../src/craftGameReplay.js';
import {chooseAction} from './v19-play-helpers.mjs';
import {assertResourceState} from '../server/resourceAuthority.mjs';

async function fixture(theme,{mature=false}={}){
 await mkdir('qa/v359',{recursive:true});const directory=await mkdtemp(resolve('qa/v359/player-delivery-'));let now=1000000;
 const state=hydrateTown(createZeroState());state.saveSlot='hyper-dimension-'+theme+'-v3';state.freshStartPending=false;state.inventory.pickaxe=1;state.inventory.rod=1;
 if(mature){state.inventory.seed=1;Object.assign(state.plots[0],{stage:4,crop:'wheat',growth:CROPS.wheat.seconds});}
 let store=createSaveStore({directory,now:()=>now});await store.open(theme,{legacyState:state,protect:true});
 const current=()=>store.current(theme),call=async(kind,operation,args={})=>{const d=await current();return store.action(theme,{kind,operation,requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch,day:d.state.day,...args});};
 const project=async(item,id='owned-project')=>{await call('commerce','plan_create',{project:{id,title:'岛主实际交付 '+id,targets:{[item]:6}}});const d=await current(),task=d.state.agentTaskLedger.find(t=>t.projectId===id&&t.targetItem===item);assert(task);await call('commerce','plan_assign',{taskId:task.id,assignee:-1});return task.id;};
 return{theme,directory,current,call,project,advance:ms=>now+=ms,restart(){store=createSaveStore({directory,now:()=>now});}};
}
const identity=r=>({requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence});
async function collect(f,kind,item,taskId){
 if(kind==='gather')return f.call('gather','begin',{itemId:item,...(taskId?{taskId}:{})});
 if(kind==='farm')return f.call('farm','begin',{actor:'player',index:0,step:'harvest',crop:'wheat',...(taskId?{taskId}:{})});
 return f.call('field','begin',{actor:'player',field:kind,itemId:item,index:0,...(taskId?{taskId}:{})});
}
async function complete(f,kind,r){
 const channel=['mine','fishing'].includes(kind)?'field':kind;
 if(kind==='mine')r=await f.call(channel,'checkpoint',{...identity(r),batch:r.ticket.nextBatch,events:[{action:{type:'strike'}}]});
 if(kind==='fishing'){
  const game=structuredClone(r.ticket.game);let events=[];
  for(let n=0;n<7000&&!game.state.result;n++){
   const action=chooseAction(game.state);if(action){const e={action};applyCraftEvent(game,e);events.push(e);}const e={dt:.05};applyCraftEvent(game,e);events.push(e);f.advance(50);
   if(events.length>900||game.state.result){r=await f.call(channel,'checkpoint',{...identity(r),batch:r.ticket.nextBatch,events});events=[];}
  }
  assert(game.state.result?.passed,'Use actual accepted fishing input replay');
 }
 f.advance(Math.ceil(r.ticket.duration*1000)+50);return f.call(channel,'finish',identity(r));
}
for(const theme of ['pixel','origami'])for(const [kind,item]of [['gather','wood'],['mine','stone'],['fishing','fish'],['farm','wheat']])test(theme+' actual player '+kind+' delivery advances its taken-over step once across restart',async()=>{
 const f=await fixture(theme,{mature:kind==='farm'}),id=await f.project(item),r=await collect(f,kind,item,id);f.restart();const done=await complete(f,kind,r),task=done.document.state.agentTaskLedger.find(t=>t.id===id),amount=done.receipt.gain[item];assert(amount>0);
 assert.equal(task.completed,amount);assert.equal(task.evidence.length,1);assert.equal(task.evidence[0].amount,amount);assert.equal(task.evidence[0].npcId,-1);assert.equal(done.document.state.inventory[item],amount);assertResourceState(done.document.state,done.document.actions);
 f.restart();const replay=await f.call(['mine','fishing'].includes(kind)?'field':kind,'finish',identity(done));assert(replay.replayed);assert.equal(replay.document.state.agentTaskLedger.find(t=>t.id===id).completed,amount);assert.equal(replay.document.state.agentTaskLedger.find(t=>t.id===id).evidence.length,1);
});
for(const control of ['cancel','pause-and-resume','reassign'])test('accepted player gathering retains real goods but cannot late-credit '+control+' project',async()=>{
 const f=await fixture('pixel'),id=await f.project('wood'),r=await collect(f,'gather','wood',id);
 if(control==='reassign')await f.call('commerce','plan_assign',{taskId:id,assignee:5});
 else{await f.call('commerce','plan_control',{projectId:'owned-project',control:control==='cancel'?'cancel':'pause'});if(control==='pause-and-resume')await f.call('commerce','plan_control',{projectId:'owned-project',control:'resume'});}
 f.restart();const done=await complete(f,'gather',r),t=done.document.state.agentTaskLedger.find(t=>t.id===id);assert.equal(done.document.state.inventory.wood,2);assert.equal(t.completed,0);assert.equal(t.evidence.length,0);assertResourceState(done.document.state,done.document.actions);
});
test('explicit player project selection cannot credit the other same-item task or reserve the same goods twice',async()=>{
 const f=await fixture('origami'),first=await f.project('wood','first-project'),second=await f.project('wood','second-project'),r=await collect(f,'gather','wood',second),done=await complete(f,'gather',r);assert.equal(done.document.state.agentTaskLedger.find(t=>t.id===first).completed,0);assert.equal(done.document.state.agentTaskLedger.find(t=>t.id===second).completed,2);assertResourceState(done.document.state,done.document.actions);
});
test('player begin rejects a foreign target and changed replay identity while preserving old receipts',async()=>{
 const f=await fixture('pixel'),id=await f.project('wood'),before=await f.current();await assert.rejects(collect(f,'gather','resin',id),e=>e.code==='planning_player_task');assert.equal((await f.current()).version,before.version);
 const r=await collect(f,'gather','wood',id);await assert.rejects(f.call('gather','begin',{requestId:r.ticket.requestId,itemId:'wood',taskId:'different-project:wood'}),e=>e.code==='action_id_conflict');const done=await complete(f,'gather',r);assert.equal(done.document.state.agentTaskLedger.find(t=>t.id===id).completed,2);
});
test('cancelling player work never records delivery, and a fresh retry can finish the same remaining step',async()=>{
 const f=await fixture('pixel'),id=await f.project('wood'),r=await collect(f,'gather','wood',id),cancelled=await f.call('gather','cancel',identity(r));assert.equal(cancelled.document.state.agentTaskLedger.find(t=>t.id===id).completed,0);const next=await collect(f,'gather','wood',id),done=await complete(f,'gather',next);assert.equal(done.document.state.agentTaskLedger.find(t=>t.id===id).completed,2);assert.equal(done.document.state.agentTaskLedger.find(t=>t.id===id).evidence.length,1);
});
