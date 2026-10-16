import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {cleanWorld} from '../server/agentService.mjs';

test('model observation retains bounded dependency IDs without malformed values',()=>{
 const context=cleanWorld({taskBoard:[{id:'second',npcId:5,dependsOn:['first','first','../bad',9]}]});
 assert.deepEqual(context.taskBoard[0].dependsOn,['first']);
});

async function fixture(theme){
 await mkdir('qa/v213',{recursive:true});
 const directory=await mkdtemp(resolve('qa/v213/chain-'));let clock=1000000;
 const reopen=()=>createSaveStore({directory,now:()=>clock});let store=reopen();
 const state=hydrateTown(createZeroState());state.freshStartPending=false;
 await store.open(theme,{legacyState:state});
 const current=()=>store.current(theme);
 const call=async(kind,operation,args={})=>{const d=await current();return store.action(theme,{kind,operation,requestId:randomUUID(),day:d.state.day,expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,...args});};
 for(const operation of ['enable','plan_enable'])await call('commerce',operation);
 return {theme,current,call,restart(){store=reopen();},advance(){clock+=20000;}};
}
const job=(id,dependsOn=[])=>({id,npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'按顺序收集两份木材',...(dependsOn.length?{dependsOn}:{})});
const begin=(f,id)=>f.call('resident','begin',{actorId:5,intent:{action:'work',goal:'forest',buildingId:null,resource:'wood',recipeId:null,assignmentId:id}});
const finish=(f,ticket)=>{f.advance();return f.call('resident','finish',{requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});};

for(const theme of ['pixel','origami'])test(theme+' one resident executes an explicit three-task chain once across durable restart',async()=>{
 const f=await fixture(theme),commands=[job('first'),job('second',['first']),job('third',['second'])];
 const batch=await f.call('commerce','plan_batch',{commands,runId:'fictional-sequential-manual-run'});
 assert.deepEqual(batch.receipt.details.commands.map(r=>r.ok),[true,true,true]);
 assert.equal(batch.document.state.inventory.wood,0);
 for(let n=0;n<commands.length;n++){
  const id=commands[n].id,next=commands[n+1]?.id;
  if(next)await assert.rejects(begin(f,next),e=>e.code==='planning_assignment');
  const started=await begin(f,id);assert.equal(started.document.state.agentTaskLedger.find(t=>t.id===id).status,'running');
  f.restart();const done=await finish(f,started.ticket);
  assert.equal(done.document.state.inventory.wood,(n+1)*2);
  const task=done.document.state.agentTaskLedger.find(t=>t.id===id);assert.equal(task.completed,2);assert.equal(task.status,'done');assert.equal(task.evidence.length,1);
  const replay=await f.call('resident','finish',{requestId:started.ticket.requestId,epoch:started.ticket.epoch,sequence:started.ticket.sequence});assert(replay.replayed);
 }
 const saved=await f.current();f.restart();assert.equal((await f.current()).version,saved.version);
 const replay=await f.call('commerce','plan_batch',{commands,runId:'fictional-sequential-manual-run'});
 assert(replay.receipt.details.commands.every(r=>r.ok&&r.replayed));assert.equal(replay.document.state.agentTaskLedger.length,3);assert.equal(replay.document.state.inventory.wood,6);
});

test('same-resident queue requires an explicit chain and remains bounded',async()=>{
 const f=await fixture('pixel');await f.call('commerce','plan_batch',{commands:[job('first'),job('second',['first'])]});
 for(const command of [job('unordered'),job('skips-second',['first']),job('unknown',['missing']),job('self',['self'])]){
  const r=await f.call('commerce','plan_batch',{commands:[command]});assert.equal(r.receipt.details.commands[0].ok,false);assert.equal(r.document.state.agentTaskLedger.length,2);
 }
 const r=await f.call('commerce','plan_batch',{commands:[job('third',['second']),job('fourth',['third']),job('fifth',['fourth'])]});
 assert.deepEqual(r.receipt.details.commands.map(x=>x.ok),[true,true,false]);assert.equal(r.document.state.agentTaskLedger.length,4);
});

test('pausing or cancelling a predecessor cannot unblock a dependent or award a late action',async()=>{
 const f=await fixture('origami');await f.call('commerce','plan_batch',{commands:[job('first'),job('second',['first'])]});
 const started=await begin(f,'first');await f.call('commerce','task_control',{taskId:'first',control:'pause'});f.restart();f.advance();
 await assert.rejects(finish(f,started.ticket),e=>e.code==='resident_task_changed');
 await assert.rejects(begin(f,'second'),e=>e.code==='npc_action_active');
 await f.call('resident','cancel',{requestId:started.ticket.requestId,epoch:started.ticket.epoch,sequence:started.ticket.sequence});
 await f.call('commerce','task_control',{taskId:'first',control:'cancel'});f.restart();
 await assert.rejects(begin(f,'second'),e=>e.code==='planning_assignment');
 const state=(await f.current()).state;assert.equal(state.inventory.wood,0);assert.equal(state.agentTaskLedger.find(t=>t.id==='first').status,'cancelled');assert.equal(state.agentTaskLedger.find(t=>t.id==='second').completed,0);
 await f.call('commerce','task_control',{taskId:'second',control:'cancel'});
});
