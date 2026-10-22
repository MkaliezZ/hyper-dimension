import test from 'node:test';
import assert from 'node:assert/strict';
import {assignedActionForeground} from '../src/assignedActionPriority.js';
import {createActionQueue} from '../src/actionQueue.js';
for(const kind of ['resident','field','farm']){
 test(kind+' explicit NPC assignment gets a queue turn while ordinary and player work retain FIFO',()=>{
  const input={kind,operation:'begin',actor:'npc',actorId:5,...(kind==='resident'?{intent:{assignmentId:'owner-task:1'}}:{assignmentId:'owner-task:1'})};
  assert.equal(assignedActionForeground(input,{}),true);
  for(const actor of ['player',null,'visitor'])assert.equal(assignedActionForeground({...input,actor},{}),false);
  for(const actorId of [-1,17,1.5,null])assert.equal(assignedActionForeground({...input,actorId},{}),false);
  for(const id of [undefined,null,'',false,'x'.repeat(241)])assert.equal(assignedActionForeground({...input,...(kind==='resident'?{intent:{assignmentId:id}}:{assignmentId:id})},{}),false);
 });
 test(kind+' completion priority is bound to the exact known NPC lease and assignment',()=>{
  const ticket={kind,actor:'npc',actorId:5,requestId:'accepted-lease',epoch:'accepted-epoch',sequence:7,assignmentId:'owner-task:1'},actions={[kind]:{leases:{[ticket.requestId]:ticket}}};
  for(const operation of ['finish','cancel']){
   const input={kind,operation,requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence};assert.equal(assignedActionForeground(input,actions),true);
   for(const edit of [{requestId:'unknown'},{requestId:'__proto__'},{epoch:'other'},{sequence:8},{sequence:0},{operation:'checkpoint'}])assert.equal(assignedActionForeground({...input,...edit},actions),false);
   for(const edit of [{actor:'player'},{actorId:17},{kind:'visitor'},{assignmentId:null},{epoch:'other'},{sequence:8}])assert.equal(assignedActionForeground(input,{[kind]:{leases:{[ticket.requestId]:{...ticket,...edit}}}}),false);
  }
 });
}
test('delegation passes queued automatic work, never the transaction already running, and automatic work still progresses',async()=>{
 const queue=createActionQueue(),order=[];let release;const gate=new Promise(r=>release=r);
 const running=queue.enqueue(async()=>{order.push('active');await gate;order.push('active-finished');});await Promise.resolve();
 const background1=queue.enqueue(()=>order.push('automatic-1')),background2=queue.enqueue(()=>order.push('automatic-2'));
 const input={kind:'resident',operation:'begin',actorId:5,intent:{assignmentId:'owner-task'}};
 const first=queue.enqueue(()=>order.push('delegated-1'),{foreground:assignedActionForeground(input,{})}),second=queue.enqueue(()=>order.push('delegated-2'),{foreground:assignedActionForeground(input,{})});
 assert.deepEqual(order,['active']);release();await Promise.all([running,background1,background2,first,second]);
 assert.deepEqual(order,['active','active-finished','delegated-1','automatic-1','delegated-2','automatic-2']);
});
test('delegated work cannot cross an earlier explicit checkpoint barrier',async()=>{
 const queue=createActionQueue(),order=[];let release;const gate=new Promise(r=>release=r);
 const active=queue.enqueue(async()=>{await gate;order.push('active');});await Promise.resolve();
 const background=queue.enqueue(()=>order.push('earlier-background')),checkpoint=queue.enqueue(()=>order.push('checkpoint'),{barrier:true}),delegated=queue.enqueue(()=>order.push('delegated'),{foreground:true});
 release();await Promise.all([active,background,checkpoint,delegated]);assert.deepEqual(order,['active','earlier-background','checkpoint','delegated']);
});
