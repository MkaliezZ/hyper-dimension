import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveJournal} from '../src/saveJournal.js';
async function fixture(mode,run){
 const names=['localStorage','location','Worker','indexedDB','fetch'],saved=names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]),calls=[];let journal,handler;
 globalThis.localStorage={getItem:()=>null};globalThis.location={href:'http://isolated.test/'};
 const invoke=async(url,init)=>{calls.push({url,init:structuredClone(init)});return handler();};
 if(mode){globalThis.indexedDB={};globalThis.Worker=class{postMessage({id,operation,value}){queueMicrotask(async()=>{try{this.onmessage({data:{id,result:operation==='entries'?[]:await invoke(value.url,value.init)}})}catch(error){this.onmessage({data:{id,error:{message:error.message,code:error.code}}})}})}terminate(){}};}
 else{delete globalThis.Worker;delete globalThis.indexedDB;globalThis.fetch=async(url,init)=>{const r=await invoke(url,init);return new Response(r.text,{status:r.status});};}
 const lease={kind:'resident',actor:'npc',actorId:3,requestId:'confirmed-npc-work',epoch:'confirmed-island',sequence:17};
 const input={kind:'resident',operation:'finish',requestId:lease.requestId,epoch:lease.epoch,sequence:lease.sequence,expectedVersion:'original-version',clientId:'original-client'};
 try{journal=createSaveJournal();await journal.prepare('pixel');await run({journal,calls,lease,input,body:JSON.stringify(input),setHandler:f=>handler=f,timeout:()=>mode?Object.assign(Error('Declared expired finish'),{code:'save_request_timeout'}):new DOMException('Declared expired finish','AbortError'),lost:()=>mode?Object.assign(Error('Failed to fetch'),{code:'save_unavailable'}):new TypeError('Failed to fetch'),ok:{ok:true,status:200,text:'{"replayed":true}'}});}
 finally{journal?.dispose();for(const[k,d]of saved)if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
}
for(const mode of [false,true]){const name=mode?'worker':'fallback';
 test(name+' known NPC completion reads its identical receipt once after the original fetch expires',()=>fixture(mode,async f=>{
  f.setHandler(()=>{if(f.calls.length===1)throw f.timeout();return f.ok;});
  const r=await f.journal.request('/api/saves/pixel/action',{method:'POST',headers:{'Content-Type':'application/json'},body:f.body},true,'original-version',f.lease);
  assert.equal(r.status,200);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);assert.deepEqual(JSON.parse(f.calls[1].init.body),f.input);
 }));
 test(name+' repeated completion timeout stops after one identical retry',()=>fixture(mode,async f=>{
  f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body},false,null,f.lease),/Declared expired finish/);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);
 }));
 test(name+' ordinary completion connection loss remains a manual recovery',()=>fixture(mode,async f=>{
  f.setHandler(()=>{throw f.lost();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body},false,null,f.lease),/Failed to fetch/);assert.equal(f.calls.length,1);
 }));
 test(name+' shaped inputs without a confirmed matching NPC lease cannot retry',()=>fixture(mode,async f=>{
  for(const lease of [null,{},...Object.entries({kind:'craft',actor:'player',actorId:17,requestId:'other',epoch:'other',sequence:18}).map(([k,v])=>({...f.lease,[k]:v})),{...f.lease,actorId:-1},{...f.lease,actorId:1.5}]){
   f.calls.length=0;f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body},false,null,lease),/Declared expired finish/);assert.equal(f.calls.length,1);
  }
  f.calls.length=0;const lateLease={...f.lease,sequence:0};f.setHandler(()=>{Object.assign(lateLease,f.lease);throw f.timeout();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body},false,null,lateLease),/Declared expired finish/);assert.equal(f.calls.length,1);
 }));
 test(name+' confirmed lease cannot authorize malformed or mismatched completion identities',()=>fixture(mode,async f=>{
  for(const edit of [{sequence:0},{sequence:-1},{sequence:1.5},{sequence:'17'},{epoch:''},{requestId:''},{operation:'cancel'},{operation:'begin'},{kind:'craft'}]){
   f.calls.length=0;f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:JSON.stringify({...f.input,...edit})},false,null,f.lease),/Declared expired finish/);assert.equal(f.calls.length,1);
  }
 }));
 test(name+' known completion cannot retry another route or a malformed body',()=>fixture(mode,async f=>{
  for(const[path,body]of [['/api/saves/pixel/save',f.body],['/api/saves/pixel/import',f.body],['/api/hermes/command',f.body],['/api/saves/pixel/action','{']]){
   f.calls.length=0;f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request(path,{method:'POST',body},false,null,f.lease),/Declared expired finish/);assert.equal(f.calls.length,1);
  }
 }));
 test(name+' explicit completion HTTP responses are returned without a transport retry',()=>fixture(mode,async f=>{
  for(const status of [400,401,409,500,503]){f.calls.length=0;f.setHandler(()=>({ok:false,status,text:'{"code":"explicit-rejection"}'}));assert.equal((await f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body},false,null,f.lease)).status,status);assert.equal(f.calls.length,1);}
 }));
}
