import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';
function storage(){const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}}
const prefix='hyper-dimension-pixel',key=s=>prefix+'-'+s;
function fixture(){
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();
 globalThis.document={addEventListener(){},hidden:false};globalThis.window={addEventListener(){}};
 let reloads=0;globalThis.location={reload(){reloads++}};
 const state={day:1,coins:432,inventory:{wood:2},saveSlot:'hyper-dimension-pixel-v3',workshopBests:{}};
 const doc={version:'v1',state,updatedAt:'2026-10-06'},calls=[];
 globalThis.fetch=async(url,init={})=>{calls.push({url,body:init.body&&JSON.parse(init.body)});return Response.json({document:doc})};
 const client=createSaveClient({loadLocal:()=>structuredClone(state),storeLocal:()=>{}});
 return {client,doc,calls,reloads:()=>reloads,cleanup(){clearTimeout(client.status('pixel').timer)}};
}
test('concurrent recovery waits for a submission, rejects new work, and reloads once',async()=>{
 const f=fixture();try{
 await f.client.load('pixel');let release,entered;const ready=new Promise(r=>entered=r),gate=new Promise(r=>release=r);let writes=0,reads=0;
 globalThis.fetch=async(url,init={})=>{
  if(url.endsWith('/action')){writes++;entered();await gate;return Response.json({document:{...f.doc,version:'v2'},ticket:{requestId:'job-1'},receipt:{outcome:'finished'}})}
  reads++;return Response.json({document:{...f.doc,version:'v2'}});
 };
 const job=f.client.action('pixel',{kind:'resident',operation:'finish',requestId:'job-1'});await ready;
 const a=f.client.acceptServer('pixel'),b=f.client.acceptServer('pixel');
 assert.equal(a,b);assert(f.client.blocked('pixel'));
 await assert.rejects(f.client.action('pixel',{kind:'facility',operation:'enable',requestId:'job-2'}),e=>e.code==='save_recovering');
 assert.equal(writes,1);release();await job;await a;
 assert.equal(writes,1);assert.equal(reads,1);assert.equal(f.reloads(),1);assert.equal(f.client.status('pixel').state.coins,432);
 }finally{f.cleanup()}
});
test('ambiguous LAN failure retains exact action and backup, then recovery can retry',async()=>{
 const f=fixture();try{
 await f.client.load('pixel');const envelope={body:{kind:'visitor',operation:'finish',requestId:'trip-1'},baseState:f.doc.state};
 localStorage.setItem(key('pending-action'),JSON.stringify(envelope));
 globalThis.fetch=async()=>Response.json({error:'服务暂不可用',code:'lan_unavailable'},{status:503});
 await assert.rejects(f.client.acceptServer('pixel'));
 assert.deepEqual(JSON.parse(localStorage.getItem(key('pending-action'))),envelope);assert(localStorage.getItem(key('pending-server-save-previous')));assert.equal(f.reloads(),0);
 const bodies=[];globalThis.fetch=async(url,init={})=>{if(init.body)bodies.push(JSON.parse(init.body));return Response.json({document:f.doc})};
 await f.client.acceptServer('pixel');assert.deepEqual(bodies,[envelope.body]);assert.equal(localStorage.getItem(key('pending-action')),null);assert.equal(f.reloads(),1);
 }finally{f.cleanup()}
});
test('recovery checks pending active-time save by original ID before choosing current document',async()=>{
 const f=fixture();try{
 await f.client.load('pixel');const body={saveId:'clock-1',expectedVersion:'v0',state:f.doc.state,activeSeconds:9};
 localStorage.setItem(key('pending-clock-save'),JSON.stringify({body}));const calls=[];
 globalThis.fetch=async(url,init={})=>{calls.push({url,body:init.body&&JSON.parse(init.body)});return url.endsWith('/save')?Response.json({error:'进度已有更新',code:'save_conflict'},{status:409}):Response.json({document:f.doc})};
 await f.client.acceptServer('pixel');assert.deepEqual(calls[0].body,body);assert.equal(calls.length,2);assert.equal(localStorage.getItem(key('pending-clock-save')),null);assert.equal(f.reloads(),1);
 }finally{f.cleanup()}
});
test('live action retains its request on a named 503 LAN failure',async()=>{
 const f=fixture();try{
 await f.client.load('pixel');globalThis.fetch=async()=>Response.json({error:'暂不可用',code:'lan_unavailable'},{status:503});
 await assert.rejects(f.client.action('pixel',{kind:'facility',operation:'enable',requestId:'facility-1'}));
 assert.equal(f.client.status('pixel').status,'action_pending');assert.equal(f.client.pendingAction('pixel').body.requestId,'facility-1');
 }finally{f.cleanup()}
});
