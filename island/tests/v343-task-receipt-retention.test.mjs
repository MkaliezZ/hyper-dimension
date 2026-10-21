import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {appendActionReceipt} from '../server/actionReceiptHistory.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {validActionBook} from '../server/playerActions.mjs';

const receipt=(id,assigned=false,outcome='finished')=>({ticket:{requestId:id,kind:'resident',...(assigned?{assignmentId:'task-'+id,operationId:'step-'+id}:{})},outcome,at:id});
test('ordinary receipts retain their original newest128 ordering',()=>{
 const book={receipts:[]};for(let i=0;i<1024;i++)appendActionReceipt(book,receipt(i));
 assert.deepEqual(book.receipts.map(r=>r.ticket.requestId),Array.from({length:128},(_,i)=>896+i));
});
test('island life cannot evict recent assigned completions during a long dependent wait',()=>{
 const book={receipts:[]},first=receipt('first',true),second=receipt('second',true);
 appendActionReceipt(book,first);for(let i=0;i<200;i++)appendActionReceipt(book,receipt(i));appendActionReceipt(book,second);
 for(let i=200;i<500;i++)appendActionReceipt(book,receipt(i));
 assert.equal(book.receipts.length,128);assert.equal(book.receipts[0],first);assert.equal(book.receipts[1],second);
 assert.deepEqual(book.receipts.slice(2).map(r=>r.ticket.requestId),Array.from({length:126},(_,i)=>374+i));
});
test('assigned history also stays bounded, and cancellations or malformed links do not consume its reserve',()=>{
 const book={receipts:[]};for(let i=0;i<100;i++)appendActionReceipt(book,receipt(i,true));
 const cancelled=receipt('cancelled',true,'cancelled'),missing=receipt('missing',true);delete missing.ticket.operationId;
 appendActionReceipt(book,cancelled);appendActionReceipt(book,missing);for(let i=0;i<300;i++)appendActionReceipt(book,receipt('life-'+i));
 assert.equal(book.receipts.length,128);assert.deepEqual(book.receipts.slice(0,64).map(r=>r.ticket.requestId),Array.from({length:64},(_,i)=>36+i));
 assert.deepEqual(book.receipts.slice(64).map(r=>r.ticket.requestId),Array.from({length:64},(_,i)=>'life-'+(236+i)));
});
test('all four canonical assigned work kinds retain their original receipt objects',()=>{
 const book={receipts:[]},rows=['resident','farm','field','craft'].map(kind=>({...receipt(kind,true),ticket:{...receipt(kind,true).ticket,kind}}));
 rows.forEach(r=>appendActionReceipt(book,r));for(let i=0;i<200;i++)appendActionReceipt(book,receipt(i));
 rows.forEach((r,i)=>assert.equal(book.receipts[i],r));assert.equal(book.receipts.length,128);
});
for(const theme of ['pixel','origami'])test(theme+' canonical queued work survives160intervening authoritative actions and replays once after restart',async()=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-assigned-receipts-'));let clock=1_000_000;
 const reopen=()=>createSaveStore({directory,now:()=>clock});let store=reopen();
 const seed=hydrateTown(createZeroState());seed.freshStartPending=false;
 await store.open(theme,{legacyState:seed});
 const call=async(kind,operation,args={})=>{const d=await store.current(theme);return store.action(theme,{kind,operation,requestId:randomUUID(),day:d.state.day,expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,...args});};
 for(const operation of ['enable','plan_enable'])await call('commerce',operation);
 const commands=['first','second','third'].map((id,i)=>({id,npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'Collect two wood after the previous delivery',...(i?{dependsOn:[['first','second'][i-1]]}:{})}));
 await call('commerce','plan_batch',{commands,runId:'fictional-long-task-chain'});
 const assigned=[];
 for(const command of commands){
  const start=await call('resident','begin',{actorId:5,intent:{action:'work',goal:'forest',buildingId:null,resource:'wood',recipeId:null,assignmentId:command.id}});
  clock=start.ticket.readyAt+1;const done=await call('resident','finish',{requestId:start.ticket.requestId,epoch:start.ticket.epoch,sequence:start.ticket.sequence});assigned.push(done.receipt);
  if(command.id==='third')break;
  for(let i=0;i<80;i++){
   const life=await call('resident','begin',{actorId:0,intent:{action:'work',goal:'forest',buildingId:null,resource:'wood'}});
   clock=life.ticket.readyAt+1;await call('resident','finish',{requestId:life.ticket.requestId,epoch:life.ticket.epoch,sequence:life.ticket.sequence});
  }
  store=reopen();
 }
 const final=await store.current(theme),actual=final.actions.receipts.filter(r=>r.outcome==='finished'&&commands.some(c=>c.id===r.ticket.assignmentId));
 assert.equal(final.actions.receipts.length,128);assert(validActionBook(final.actions));assert.deepEqual(actual,assigned);
 for(const command of commands){const task=final.state.agentTaskLedger.find(t=>t.id===command.id);assert.equal(task.status,'done');assert.equal(task.completed,2);assert.equal(task.evidence.length,1);}
 const before=final.state.inventory.wood;store=reopen();
 const first=assigned[0].ticket,replay=await call('resident','finish',{requestId:first.requestId,epoch:first.epoch,sequence:first.sequence});
 assert.equal(replay.replayed,true);assert.equal(replay.document.version,final.version);assert.equal(replay.document.state.inventory.wood,before);assert.deepEqual(replay.receipt,assigned[0]);
 await assert.rejects(call('resident','finish',{requestId:first.requestId,epoch:randomUUID(),sequence:first.sequence}),e=>e.code==='action_stale');
});
