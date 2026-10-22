import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveJournal} from '../src/saveJournal.js';

// Lose the worker reply itself, rather than manufacturing a fetch error. The
// real RPC deadline callback runs; no production deadline is increased.
async function fixture(run){
 const keys=['localStorage','location','Worker','indexedDB','setTimeout'],old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const nativeTimer=globalThis.setTimeout,calls=[],deadlines=[];let journal,reply=false;
 globalThis.localStorage={getItem:()=>null};globalThis.location={href:'http://owned.invalid/'};globalThis.indexedDB={};
 globalThis.setTimeout=(fn,ms,...args)=>{if(ms===15000){deadlines.push(ms);return nativeTimer(fn,0,...args);}return nativeTimer(fn,ms,...args);};
 globalThis.Worker=class{
  postMessage({id,operation,value}){if(operation==='request'){calls.push(structuredClone(value));if(!reply||calls.length===1)return;}
   queueMicrotask(()=>this.onmessage({data:{id,result:operation==='entries'?[]:{ok:true,status:200,text:'{"replayed":true}'}}}));}
  terminate(){}
 };
 try{journal=createSaveJournal();await journal.prepare('pixel');await run({journal,calls,deadlines,replyOnRetry(){reply=true;}});}
 finally{journal?.dispose();for(const[k,d]of Object.entries(old))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
}
const resident={kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',operationId:'owned-worker-deadline'},requestId:'owned-same-request',expectedVersion:'owned-version',expectedSequence:2,epoch:'owned-epoch'};
test('lost worker acknowledgement retains the bounded identical NPC replay',()=>fixture(async f=>{
 f.replyOnRetry();const body=JSON.stringify(resident),result=await f.journal.request('/api/saves/pixel/action',{method:'POST',body});
 assert.equal(result.status,200);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);assert.deepEqual(f.deadlines,[15000,15000]);
}));
test('two lost worker acknowledgements remain an uncertain network result',()=>fixture(async f=>{
 await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:JSON.stringify(resident)}),e=>e.code==='save_request_timeout');
 assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);
}));
for(const [name,url,init]of [
 ['canonical read','/api/saves/pixel',{method:'GET'}],
 ['autosave','/api/saves/pixel/save',{method:'POST',body:'{"saveId":"owned-save"}'}],
 ['player action','/api/saves/pixel/action',{method:'POST',body:JSON.stringify({...resident,actor:'player'})}],
 ['cancellation','/api/saves/pixel/action',{method:'POST',body:JSON.stringify({...resident,operation:'cancel'})}],
])test(name+' worker deadline stays uncertain without an automatic submission',()=>fixture(async f=>{
 await assert.rejects(f.journal.request(url,init),e=>e.code==='save_request_timeout');assert.equal(f.calls.length,1);
}));
