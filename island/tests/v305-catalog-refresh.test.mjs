import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import {createSaveClient} from '../src/saveClient.js';

async function fixture(run){
 const names=['localStorage','sessionStorage','document','window','location','fetch'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected navigation');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{wood:2},player:{x:0,y:0},catalogMarker:'before'},q={version:1,canonical:structuredClone(seed),requests:[],failRead:false,failAction:false};let local,client,release,entered;
 q.gate=new Promise(r=>release=r);q.entered=new Promise(r=>entered=r);q.release=release;
 const documentOf=()=>({version:'v'+q.version,state:structuredClone(q.canonical)});
 globalThis.fetch=async(url,init={})=>{
  const body=init.body?JSON.parse(init.body):null;q.requests.push({operation:init.method==='GET'?'read':url.split('/').at(-1),expectedVersion:body?.expectedVersion,requestId:body?.requestId});
  if(url.endsWith('/open'))return Response.json({document:documentOf()});
  if(init.method==='GET'){entered();await q.gate;if(q.failRead)return Response.json({code:'save_busy',error:'Declared unavailable catalog read'},{status:503});return Response.json({document:documentOf()});}
  if(url.endsWith('/action')&&q.failAction)throw Error('Declared connection loss');
  if(body.expectedVersion!=='v'+q.version)return Response.json({code:'save_conflict',error:'The command used an obsolete version'},{status:409});
  if(url.endsWith('/save'))q.canonical=structuredClone(body.state);
  q.version++;return Response.json({document:documentOf(),receipt:{outcome:'finished'}});
 };
 client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(theme,next)=>local=next});
 try{local=await client.load('pixel');q.requests.length=0;await run({q,client,local:()=>local});}
 finally{release();const s=client.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.cacheTail;for(const[k,d]of Object.entries(old)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}
for(const edit of [false,true])test('catalog refresh retains its queue barrier before a resident command'+(edit?' and preserves independent local edits':''),()=>fixture(async({q,client,local})=>{
 q.canonical.catalogMarker='published';q.version=2;
 const read=client.checkpointAndRefresh('pixel'),action=client.action('pixel',{kind:'resident',operation:'begin',requestId:'catalog-next-resident'}),done=Promise.all([read,action]);
 await q.entered;if(edit){local().player.x=12;client.enqueue('pixel',local());}await wait(20);
 assert.equal(q.requests.some(r=>r.operation==='action'),false,'The acknowledged read must finish before a queued command reserves its version');
 q.release();await done;assert.equal(q.requests.filter(r=>r.operation==='read').length,1);const sent=q.requests.find(r=>r.operation==='action');assert.equal(sent.expectedVersion,edit?'v3':'v2');assert.equal(client.status('pixel').state.catalogMarker,'published');assert.equal(client.status('pixel').state.player.x,edit?12:0);assert.deepEqual(client.status('pixel').state.inventory,{wood:2});assert.equal(client.pendingAction('pixel'),null);assert.equal(client.status('pixel').inflight,null);
}));
test('a failed catalog read propagates without replaying the publication or accepting a stale resident write',()=>fixture(async({q,client})=>{
 q.canonical.catalogMarker='published';q.version=2;q.failRead=true;
 const read=client.checkpointAndRefresh('pixel'),action=client.action('pixel',{kind:'resident',operation:'begin',requestId:'catalog-read-failed'}),done=Promise.allSettled([read,action]);await q.entered;q.release();const results=await done;
 assert.equal(results[0].reason.code,'save_busy');assert.equal(results[1].reason.code,'save_conflict');assert.equal(q.requests.filter(r=>r.operation==='read').length,1);assert.equal(q.requests.filter(r=>r.operation==='action').length,1);assert.equal(client.status('pixel').inflight,null);assert.equal(q.canonical.catalogMarker,'published');assert.deepEqual(q.canonical.inventory,{wood:2});
}));
test('an uncertain resident receipt still blocks catalog refresh and keeps its durable identity',()=>fixture(async({q,client})=>{
 q.failAction=true;await assert.rejects(client.action('pixel',{kind:'resident',operation:'finish',requestId:'catalog-uncertain-resident'}),/Declared connection loss/);const pending=structuredClone(client.pendingAction('pixel'));
 await assert.rejects(client.checkpointAndRefresh('pixel'),e=>e.code==='action_pending');assert.deepEqual(client.pendingAction('pixel'),pending);assert.equal(q.requests.filter(r=>r.operation==='read').length,0);assert.equal(q.requests.filter(r=>r.operation==='action').length,1);assert.equal(client.status('pixel').status,'action_pending');
}));

test('a new server world is adopted inside the refresh barrier without awaiting its own queue',()=>fixture(async({q,client})=>{
 let reloads=0;globalThis.location.reload=()=>reloads++;q.canonical.saveSlot='hyper-dimension-pixel-v3-restart-serverworld';q.version=2;
 const pending=client.checkpointAndRefresh('pixel');await q.entered;q.release();let timer;try{await Promise.race([pending,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('The refresh barrier waited on itself')),1000))]);}finally{clearTimeout(timer);}
 assert.equal(reloads,1);assert.equal(client.status('pixel').state.saveSlot,q.canonical.saveSlot);assert.equal(client.status('pixel').navigationPending,true);assert.equal(client.status('pixel').inflight,null);assert.equal(client.status('pixel').status,'recovering');
}));
