import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {standardFixture,sendParams,successful} from './fixtures/a2a-standard.mjs';
import {A2A_EXTENSION} from '../server/a2aGateway.mjs';
const peer=(params,id)=>{params.message.metadata[A2A_EXTENSION].recipientId=id;return params;};
async function settled(f,id,count){
 for(let n=0;n<100;n++){const task=(await f.service.collaboration.view(f.users[0].token)).tasks.find(t=>t.id===id);if(task?.status==='retry')throw Error(task.error);if(task?.messages.length===count&&task.status!=='thinking')return task;await new Promise(r=>setTimeout(r,15));}
 throw Error('Original A2A turn did not settle');
}
test('Either owner can explicitly address the actual peer throughout a standard A2A conversation',async()=>{
 const f=await standardFixture();try{
  await f.enable();const first=(await successful(f,0,'SendMessage',sendParams(f))).task;
  const reply=peer(sendParams(f,{taskId:first.id,text:'请向主岛管家介绍来访岛设施。'}),f.users[0].id);
  const second=(await successful(f,1,'SendMessage',reply)).task;assert.equal(second.history.length,4);assert.equal(f.calls.length,2);assert.equal(f.calls[1].ownerId,f.users[1].id);
  const third=(await successful(f,0,'SendMessage',peer(sendParams(f,{taskId:first.id,text:'请确认我们已收到来访岛的信息。'}),f.users[1].id))).task;
  assert.equal(third.history.length,6);assert.deepEqual(f.calls.map(c=>c.ownerId),[f.users[0].id,f.users[1].id,f.users[0].id]);
  assert.deepEqual((await successful(f,1,'SendMessage',reply)).task.id,first.id);assert.equal(f.calls.length,3,'Replaying the original reply must not run another model');
  for(const id of [f.users[0].id,f.users[2].id]){const rejected=await f.rpc(0,'SendMessage',peer(sendParams(f,{taskId:first.id,text:'拒绝错误的目标身份。'}),id));assert.equal(rejected.data.error.code,-32602);}
  assert.equal((await f.rpc(2,'GetTask',{id:first.id})).data.error.code,-32001);assert.equal(f.calls.length,3);
 }finally{await f.close();}
});
test('Native and standard A2A turns share the actual owner inputs, reply lineage, replay and restart history',async()=>{
 const f=await standardFixture();try{
  await f.enable();const first=(await successful(f,0,'SendMessage',sendParams(f,{text:'标准客户端提出的真实问题。'}))).task;
  const native={operation:'respond',requestId:randomUUID(),taskId:first.id,message:'游戏界面实际输入的补充问题。'};
  await f.service.collaboration.action(f.users[1].token,native);const internal=await settled(f,first.id,2);
  const canonical=await successful(f,0,'GetTask',{id:first.id});
  assert.deepEqual(canonical.history.map(m=>m.role),['ROLE_USER','ROLE_AGENT','ROLE_USER','ROLE_AGENT']);assert.equal(canonical.history[2].parts[0].text,native.message);
  assert.equal(internal.messages[1].parentRunId,internal.messages[0].ledgerRunId);assert.equal(internal.messages[1].ownerAccountId,f.users[1].id);
  assert((await f.service.collaboration.action(f.users[1].token,native)).replayed);assert.equal(f.calls.length,2);
  await f.restart();assert.deepEqual(await successful(f,0,'GetTask',{id:first.id}),canonical);assert.equal(f.calls.length,2);
  const other=await successful(f,1,'GetTask',{id:first.id});assert.deepEqual(other.history,canonical.history);assert.equal(other.metadata[A2A_EXTENSION].nextAction,null);assert.equal(canonical.metadata[A2A_EXTENSION].nextAction,'respond');
  assert.equal((await successful(f,0,'GetTask',{id:first.id,historyLength:1})).history.length,1);
 }finally{await f.close();}
});
test('A native opening question is preserved without inventing input for a default reply',async()=>{
 const f=await standardFixture();try{
  await f.enable();const sent=await f.service.collaboration.action(f.users[1].token,{operation:'exchange',requestId:randomUUID(),recipientId:f.users[0].id,topic:'来访管家从游戏界面发起的真实主题。'});await settled(f,sent.taskId,1);
  const task=await successful(f,0,'GetTask',{id:sent.taskId});assert.equal(task.history.length,2);assert.equal(task.history[0].role,'ROLE_USER');assert.match(task.history[0].parts[0].text,/真实主题/);
  await f.service.collaboration.action(f.users[0].token,{operation:'respond',requestId:randomUUID(),taskId:sent.taskId});await settled(f,sent.taskId,2);
  const result=await successful(f,1,'GetTask',{id:sent.taskId});assert.equal(result.history.filter(m=>m.role==='ROLE_USER').length,1,'The server-generated default reply prompt is not a human input');assert.equal(result.history.filter(m=>m.role==='ROLE_AGENT').length,2);
 }finally{await f.close();}
});
test('Explicit peer addressing preserves guest-only execution and one canonical event preparation receipt',async()=>{
 const f=await standardFixture({event:true});try{
  await f.enable('preference');const offered=(await successful(f,0,'SendMessage',sendParams(f,{capability:'event.checkin',text:'请核对这次真实活动的入场准备。'}))).task;
  await successful(f,1,'SendMessage',peer(sendParams(f,{taskId:offered.id,action:'review',text:'来访管家核对本人入场材料。'}),f.users[0].id));
  const request=peer(sendParams(f,{taskId:offered.id,action:'execute',text:'本人明确确认这次入场预留。'}),f.users[0].id);
  const executed=(await successful(f,1,'SendMessage',request)).task;assert.deepEqual(executed.metadata[A2A_EXTENSION].receipt.reserved,{coins:12,wood:2});
  const final=(await successful(f,0,'SendMessage',peer(sendParams(f,{taskId:offered.id,action:'confirm',text:'主岛管家核对已确认的准备回执。'}),f.users[1].id))).task;assert.equal(final.status.state,'TASK_STATE_COMPLETED');
  await successful(f,1,'SendMessage',request);assert.equal(f.calls.length,3,'Receipt replay cannot invoke a fourth model turn');
  const guest=(await f.service.tenants.readIslandForServer(f.users[1].id,f.users[1].theme)).state;assert.equal(guest.coins,88);assert.equal(guest.inventory.wood,1);assert.equal((await f.service.tenants.readIslandForServer(f.users[0].id,f.users[0].theme)).state.inventory.wood,3,'Entry preparation does not credit final event delivery');
 }finally{await f.close();}
});
