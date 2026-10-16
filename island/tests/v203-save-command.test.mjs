import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

for(const failPreparation of [false,true])test(failPreparation?'a failed durable preparation releases the command reservation and keeps the local edits':'a queued autosave cannot overtake the command while its durable journal is being prepared',async()=>{
 const names=['localStorage','sessionStorage','document','window','location','fetch','requestAnimationFrame','cancelAnimationFrame'];
 const previous=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected reload');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{},player:{x:0,y:0},farmControl:{version:1}};
 let revision=1,canonical=structuredClone(seed),client,local,armed=false,monitor=false,failNextCache=false,auto=null;const sent=[];
 globalThis.requestAnimationFrame=fn=>setImmediate(()=>{
  if(armed){armed=false;local.player.x=1;client.enqueue('pixel',local);auto=client.flush('pixel').then(()=>({saved:true}),e=>({code:e.code}));}
  fn();
 });globalThis.cancelAnimationFrame=id=>clearImmediate(id);
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);sent.push({operation:url.split('/').at(-1),version:body.expectedVersion});
  if(url.endsWith('/open'))return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)}});
  if(url.endsWith('/action')&&auto)await auto;
  if(body.expectedVersion!=='v'+revision)return Response.json({error:'A different save won the version race',code:'save_conflict'},{status:409});
  revision++;if(body.state)canonical=structuredClone(body.state);
  return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)},receipt:{outcome:'finished'}});
 };
 client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){if(failNextCache){failNextCache=false;throw Error('Fictional journal preparation failure');}},onRemoteState:(theme,next)=>{local=next;},onStatus:()=>{if(monitor&&client.status('pixel').status==='saved'){monitor=false;local.player.y=2;client.enqueue('pixel',local);armed=true;failNextCache=failPreparation;}}});
 try{
  local=await client.load('pixel');sent.length=0;local.player.y=1;client.enqueue('pixel',local);monitor=true;
  const action=client.action('pixel',{kind:'personal',operation:'home_activity',requestId:'fictional-command-race'});
  if(failPreparation){
   await assert.rejects(action,/Fictional journal preparation failure/);assert.equal(client.status('pixel').commandSending,false);assert.equal(client.pendingAction('pixel'),null);await client.flush('pixel');
  }else await action;
  assert.deepEqual(await auto,{code:'action_pending'});
  assert.deepEqual(sent.map(r=>r.operation),['save',failPreparation?'save':'action']);assert.equal(revision,3);
  assert.equal(client.pendingAction('pixel'),null);assert.notEqual(client.status('pixel').status,'conflict');
  assert.equal(client.status('pixel').state.player.x,1,'local navigation during the journal wait must survive the action receipt');
 }finally{
  const s=client.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.cacheTail;
  for(const [k,d]of Object.entries(previous)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
 }
});
