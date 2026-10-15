import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestLanCommand} from '../src/lanCommandRetry.js';
const body=()=>({operation:'room_move',roomId:'test-room',requestId:'original-id',x:100,y:200});
test('transient movement failures retry the original durable request, then return its receipt',async()=>{
 for(const error of [new TypeError('fetch'),Object.assign(Error('deadline'),{name:'TimeoutError'}),Object.assign(Error('busy'),{status:503,code:'lan_busy'}),Object.assign(Error('rate'),{status:429,code:'lan_move_rate'})]){
  const input=body(),calls=[],waits=[],receipt={replayed:true,view:{room:{id:'test-room'}}};
  const result=await requestLanCommand(async(path,b)=>{calls.push({path,body:b});if(calls.length<3)throw error;return receipt;},input,{sleep:async ms=>waits.push(ms)});
  assert.equal(result,receipt);assert.deepEqual(waits,[300,800]);assert.equal(calls.length,3);
  for(const call of calls){assert.equal(call.path,'action');assert.equal(call.body,input);assert.deepEqual(call.body,body());}
 }
});
test('final failures remain recoverable by the caller; invalid commands and other actions are not automatically retried',async()=>{
 for(const [input,error,expected] of [
  [body(),new TypeError('offline'),3],
  [body(),Object.assign(Error('blocked destination'),{status:400,code:'lan_destination'}),1],
  [body(),Object.assign(Error('logged out'),{status:401,code:'lan_unauthorized'}),1],
  [{...body(),operation:'room_chat'},new TypeError('offline'),1],
  [{...body(),operation:'room_create'},Object.assign(Error('busy'),{status:503}),1]
 ]){let calls=0;await assert.rejects(requestLanCommand(async()=>{calls++;throw error;},input,{sleep:async()=>{}}),e=>e===error);assert.equal(calls,expected);}
});
