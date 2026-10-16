import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

test('a command drains the autosave that an earlier flush waiter starts before the command resumes',async()=>{
 const names=['localStorage','sessionStorage','document','window','location','fetch'];
 const previous=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected reload');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{},player:{x:0,y:0},farmControl:{version:1}};
 let revision=1,canonical=structuredClone(seed),client,local,monitor=false,auto=null;const sent=[];
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);sent.push({operation:url.split('/').at(-1),version:body.expectedVersion});
  if(url.endsWith('/open'))return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)}});
  if(url.endsWith('/action')&&auto)await auto;
  if(body.expectedVersion!=='v'+revision)return Response.json({error:'The queued autosave overtook this command',code:'save_conflict'},{status:409});
  revision++;if(body.state)canonical=structuredClone(body.state);
  return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)},receipt:{outcome:'finished'}});
 };
 client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(theme,next)=>{local=next;},onStatus:()=>{
  if(monitor&&client.status('pixel').status==='saved'){
   monitor=false;local.player.x=1;client.enqueue('pixel',local);
   // The timer entered flush before the first save completed. Its continuation
   // awaits the inner save promise, while the command awaits the outer flush.
   auto=client.flush('pixel').then(()=>({saved:true}),e=>({code:e.code}));
  }
 }});
 try{
  local=await client.load('pixel');sent.length=0;local.player.y=1;client.enqueue('pixel',local);monitor=true;
  await client.action('pixel',{kind:'craft',operation:'begin',requestId:'fictional-flush-waiter'});
  assert.deepEqual(await auto,{saved:true});assert.deepEqual(sent.map(r=>r.operation),['save','save','action']);
  assert.equal(sent.at(-1).version,'v3');assert.equal(revision,4);assert.equal(client.pendingAction('pixel'),null);
  assert.notEqual(client.status('pixel').status,'conflict');assert.equal(client.status('pixel').state.player.x,1);
 }finally{
  const s=client.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.cacheTail;await auto;
  for(const [k,d]of Object.entries(previous)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
 }
});
