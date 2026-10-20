import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {standardFixture,sendParams,successful} from './fixtures/a2a-standard.mjs';
import {A2A_EXTENSION} from '../server/a2aGateway.mjs';

async function fixture({alwaysClarify=false,itemQuantity=2}={}){
 const f=await standardFixture({event:true,itemQuantity});let reviews=0;
 const install=()=>{const original=f.service.agents.collaborate.bind(f.service.agents);f.service.agents.collaborate=async(token,payload)=>{
  const result=await original(token,payload);
  if(payload.stage==='review'&&(alwaysClarify||reviews++===0))return {...result,reply:{decision:'clarify',message:'请主办岛主说明约定物资的用途，入场条件保持原约定。'}};
  return result;
 };};install();const restart=f.restart;f.restart=async()=>{await restart();install();};
 f.call=(n,operation,data={})=>f.service.collaboration.action(f.users[n].token,{operation,requestId:randomUUID(),...data});
 f.task=async(id,status)=>{for(let n=0;n<150;n++){const t=(await f.service.collaboration.view(f.users[0].token)).tasks.find(t=>t.id===id);if(t?.status===status)return t;if(t?.status==='retry')throw Error(t.error);await new Promise(r=>setTimeout(r,20));}throw Error('Expected task '+status);};
 f.asked=async()=>{await f.enable('preference');const {taskId}=await f.call(0,'offer',{eventId:f.eventId,recipientId:f.users[1].id});await f.task(taskId,'offered');await f.call(1,'review',{taskId});return f.task(taskId,'needs_information');};
 f.wallet=async n=>(await f.service.tenants.readIslandForServer(f.users[n].id,f.users[n].theme)).state;
 return f;
}
test('host clarification reaches the visiting steward once, survives restart and retains explicit protected execution',async()=>{
 const f=await fixture();try{
  const question=await f.asked(),id=question.id,host=await f.wallet(0),guest=await f.wallet(1);
  const request={operation:'clarify',taskId:id,requestId:randomUUID(),message:'两份木头用于原约定茶会的手作桌，费用仍是十二岛币；请按本人已核对的准备复核。'};
  await f.service.collaboration.action(f.users[0].token,request);await f.task(id,'offered');assert((await f.service.collaboration.action(f.users[0].token,request)).replayed);
  assert.equal(f.calls.length,3);await f.restart();assert((await f.service.collaboration.action(f.users[0].token,request)).replayed);assert.equal(f.calls.length,3);
  let task=await f.task(id,'offered');assert.equal(task.clarifications.length,1);assert.equal(task.clarifications[0].answer,request.message);assert.equal(task.clarifications[0].ownerAccountId,f.users[0].id);assert.equal(task.clarificationRemaining,2);
  assert.deepEqual((await f.wallet(0)).inventory,host.inventory);assert.deepEqual((await f.wallet(1)).inventory,guest.inventory);assert.equal((await f.wallet(1)).coins,guest.coins);
  await assert.rejects(f.call(1,'execute',{taskId:id}),e=>e.code==='a2a_stage');await f.call(1,'review',{taskId:id});await f.task(id,'accepted');await assert.rejects(f.call(0,'execute',{taskId:id}),e=>e.code==='a2a_stage');
  const execute={operation:'execute',taskId:id,requestId:randomUUID()};await f.service.collaboration.action(f.users[1].token,execute);assert((await f.service.collaboration.action(f.users[1].token,execute)).replayed);task=await f.task(id,'executed');assert.deepEqual(task.receipt.reserved,{coins:12,wood:2});
  assert.equal((await f.wallet(1)).coins,guest.coins-12);assert.equal((await f.wallet(1)).inventory.wood,guest.inventory.wood-2);assert.equal((await f.wallet(0)).inventory.wood,host.inventory.wood);
  await f.call(0,'confirm',{taskId:id});task=await f.task(id,'completed');assert.deepEqual(task.messages.map(m=>m.stage),['offer','review','offer','review','confirm']);
  assert.deepEqual(f.calls.map(c=>c.p.assignment.actorRole),['host','guest','host','guest','host']);
  for(const {p} of f.calls){assert.equal(p.assignment.entryItemsOwnerAccountId,f.users[1].id);assert.equal(p.assignment.entryFeeOwnerAccountId,f.users[1].id);assert.equal(p.assignment.preparationOwnerAccountId,f.users[1].id);assert.equal(p.assignment.executionRequiresGuestOwnerConfirmation,true);}
  assert.equal(f.calls[2].p.clarification.answer,request.message);assert.equal(f.calls[2].p.clarification.parentRunId,task.messages[1].ledgerRunId);
  for(let n=1;n<task.messages.length;n++)assert.equal(task.messages[n].parentRunId,task.messages[n-1].ledgerRunId);
 }finally{await f.close();}
});
test('clarification rounds are bounded and do not allow a visitor, outsider or changed message to alter the agreement',async()=>{
 const f=await fixture({alwaysClarify:true});try{
  const question=await f.asked(),id=question.id,before=await f.wallet(1);
  for(const owner of [1,2])await assert.rejects(f.call(owner,'clarify',{taskId:id,message:'修改条件'}),e=>['a2a_stage','a2a_forbidden'].includes(e.code));
  await assert.rejects(f.call(0,'clarify',{taskId:id,message:'  '}),e=>e.code==='a2a_invalid');await assert.rejects(f.call(0,'clarify',{taskId:id,message:'字'.repeat(501)}),e=>e.code==='a2a_invalid');
  for(let n=0;n<3;n++){
   const request={operation:'clarify',taskId:id,requestId:randomUUID(),message:'补充说明第'+n+'轮；原活动入场条件保持不变。'};await f.service.collaboration.action(f.users[0].token,request);await f.task(id,'offered');
   await assert.rejects(f.service.collaboration.action(f.users[0].token,{...request,message:'更换已登记的补充说明'}),e=>e.code==='a2a_replay');await f.call(1,'review',{taskId:id});
   const task=await f.task(id,'needs_information');assert.equal(task.clarificationRemaining,2-n);assert.deepEqual(task.contract,question.contract);
  }
  const count=f.calls.length;await assert.rejects(f.call(0,'clarify',{taskId:id,message:'第四轮'}),e=>e.code==='a2a_capacity');assert.equal(f.calls.length,count);assert.equal((await f.wallet(1)).coins,before.coins);assert.deepEqual((await f.wallet(1)).inventory,before.inventory);
 }finally{await f.close();}
});
test('standard A2A messages expose the host answer turn and replay its actual user message without granting execution',async()=>{
 const f=await fixture();try{
  const question=await f.asked(),id=question.id;
  const before=await successful(f,0,'GetTask',{id});assert.equal(before.metadata[A2A_EXTENSION].nextAction,'clarify');
  const request=sendParams(f,{taskId:id,action:'clarify',text:'原约定的木头用于茶会手作桌，请按来访岛主本人的准备核对。'});
  const answer=(await successful(f,0,'SendMessage',request)).task;assert.equal(answer.metadata[A2A_EXTENSION].status,'offered');assert.equal(answer.history.filter(m=>m.role==='ROLE_USER'&&m.messageId===request.message.messageId).length,1);assert(answer.history.some(m=>m.parts.some(p=>p.text===request.message.parts[0].text)));
  const calls=f.calls.length;await successful(f,0,'SendMessage',request);assert.equal(f.calls.length,calls);assert.equal((await f.rpc(2,'GetTask',{id})).data.error.code,-32001);
  const reviewed=(await successful(f,1,'SendMessage',sendParams(f,{taskId:id}))).task;assert.equal(reviewed.metadata[A2A_EXTENSION].nextAction,'execute');
  assert.equal((await f.rpc(1,'SendMessage',sendParams(f,{taskId:id,text:'同意，但未明确执行'}))).data.error.code,-32602);assert.equal((await f.wallet(1)).coins,100);
 }finally{await f.close();}
});
test('revocation or departure cancels unanswered clarification without launching another model or reserving goods',async()=>{
 const f=await fixture();try{
  const question=await f.asked(),count=f.calls.length,before=await f.wallet(1);
  await f.call(1,'preference',{receive:false});await assert.rejects(f.call(0,'clarify',{taskId:question.id,message:'已补充物资用途'}),e=>e.code==='a2a_ended');
  assert.equal(f.calls.length,count);assert.equal((await f.wallet(1)).coins,before.coins);assert.deepEqual((await f.wallet(1)).inventory,before.inventory);
 }finally{await f.close();}
});
test('the steward receives net shortages, available stock and held amounts rather than the total requirement as a deficit',async()=>{
 const f=await fixture({itemQuantity:4});try{
  await f.asked();const review=f.calls.find(c=>c.p.stage==='review').p.preparation;
  assert.equal(review.ready,false);assert.deepEqual(review.items,[{item:'wood',name:'木材',required:4,available:3,reserved:0,shortfall:1}]);assert.match(review.missing[0],/还差 1（共需 4，可用 3，已预留 0）/);
  assert.deepEqual(review.entryFee,{required:12,available:100,reserved:0,shortfall:0});assert.equal(review.garment,null);assert.equal(review.invitationAccepted,true);
  assert.equal((await f.wallet(1)).inventory.wood,3);assert.equal((await f.wallet(1)).coins,100);
 }finally{await f.close();}
});
