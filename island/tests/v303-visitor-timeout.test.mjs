import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveJournal} from '../src/saveJournal.js';

async function fixture(workerMode,fn){
 const names=['localStorage','location','Worker','indexedDB','fetch'],previous=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 let journal,handler;const calls=[];
 globalThis.localStorage={getItem:()=>null};globalThis.location={href:'http://isolated.test/'};
 const call=async(url,init)=>{calls.push({url,init:structuredClone(init)});return handler(url,init);};
 if(workerMode){
  globalThis.indexedDB={};globalThis.Worker=class{
   postMessage({id,operation,value}){queueMicrotask(async()=>{try{const result=operation==='entries'?[]:await call(value.url,value.init);this.onmessage({data:{id,result}});}catch(error){this.onmessage({data:{id,error:{message:error.message,code:error.code}}});}});}
   terminate(){}
  };
 }else{delete globalThis.Worker;delete globalThis.indexedDB;globalThis.fetch=async(url,init)=>{const result=await call(url,init);return new Response(result.text,{status:result.status});};}
 try{
  journal=createSaveJournal();await journal.prepare('pixel');
  const timeout=()=>workerMode?Object.assign(Error('Original fetch expired'),{code:'save_request_timeout'}):new DOMException('Original fetch expired','AbortError');
  const lost=()=>workerMode?Object.assign(Error('Failed to fetch'),{code:'save_unavailable'}):new TypeError('Failed to fetch');
  return await fn({journal,calls,timeout,lost,setHandler:f=>handler=f,body:JSON.stringify({kind:'visitor',operation:'finish',requestId:'original-visitor-receipt',epoch:'original-epoch',sequence:17,expectedVersion:'original-version',clientId:'original-client'}),ok:{ok:true,status:200,text:'{"replayed":true}'}});
 }finally{journal?.dispose();for(const[name,value]of Object.entries(previous)){if(value)Object.defineProperty(globalThis,name,value);else delete globalThis[name];}}
}
for(const mode of [false,true]){
 const name=mode?'worker':'fallback';
 test(name+' timed-out visitor request replays once with exactly the same durable bytes',()=>fixture(mode,async f=>{
  f.setHandler(()=>{if(f.calls.length===1)throw f.timeout();return f.ok;});
  const result=await f.journal.request('/api/saves/pixel/action',{method:'POST',headers:{'Content-Type':'application/json'},body:f.body},true,'original-version');
  assert.equal(result.status,200);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);assert.equal(JSON.parse(f.calls[1].init.body).requestId,'original-visitor-receipt');
 }));
 test(name+' persistent timeout stops after two attempts and propagates the original failure',()=>fixture(mode,async f=>{
  f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body}),/Original fetch expired/);assert.equal(f.calls.length,2);assert.deepEqual(f.calls[0],f.calls[1]);
 }));
 test(name+' ordinary lost connections retain the existing manual recovery path',()=>fixture(mode,async f=>{
  f.setHandler(()=>{throw f.lost();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body}),/Failed to fetch/);assert.equal(f.calls.length,1);
 }));
 for(const kind of ['resident','craft','personal'])test(name+' never automatically replays '+kind+' on timeout',()=>fixture(mode,async f=>{
  f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:JSON.stringify({...JSON.parse(f.body),kind})}),/Original fetch expired/);assert.equal(f.calls.length,1);
 }));
 for(const path of ['/api/saves/pixel/save','/api/saves/pixel/import','/api/saves/pixel/restore','/api/hermes/command'])test(name+' never replays non-action route '+path,()=>fixture(mode,async f=>{
  f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request(path,{method:'POST',body:f.body}),/Original fetch expired/);assert.equal(f.calls.length,1);
 }));
 for(const status of [401,409,500,503])test(name+' leaves explicit HTTP '+status+' policy to the existing client',()=>fixture(mode,async f=>{
  f.setHandler(()=>({ok:false,status,text:'{"error":"Explicit rejection"}'}));const result=await f.journal.request('/api/saves/pixel/action',{method:'POST',body:f.body});assert.equal(result.status,status);assert.equal(f.calls.length,1);
 }));
 for(const requestId of ['',null])test(name+' requires a durable visitor identity '+JSON.stringify(requestId),()=>fixture(mode,async f=>{
  f.setHandler(()=>{throw f.timeout();});await assert.rejects(f.journal.request('/api/saves/pixel/action',{method:'POST',body:JSON.stringify({...JSON.parse(f.body),requestId})}),/Original fetch expired/);assert.equal(f.calls.length,1);
 }));
}
