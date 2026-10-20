import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

async function fixture(theme,run){
 const names=['localStorage','sessionStorage','document','window','location','fetch'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();let client;
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('A rejected command must not navigate');}};
 const seed={saveSlot:'hyper-dimension-'+theme+'-v3',workshopBests:{},day:1,coins:0,inventory:{wood:0},player:{x:0,y:0},farmControl:{version:1}};
 try{await run({seed,data,make:()=>client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){}})});}
 finally{if(client){const r=client.status(theme);clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail?.catch(()=>{});clearTimeout(r.timer);clearTimeout(r.cacheTimer);}for(const[k,d]of Object.entries(old)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}

for(const theme of ['pixel','origami'])for(const kind of ['resident','field','farm'])test(theme+' '+kind+' a definite stale NPC start reads independent progress without executing or discarding the rejected intent',()=>fixture(theme,async({seed,data,make})=>{
 let client,canonical=structuredClone(seed),version='v1',actions=0,reads=0,saves=0;
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version,state:canonical}});
  if(url.endsWith('/action')){actions++;assert.equal(JSON.parse(init.body).expectedVersion,'v1');const local=client.status(theme).state;local.player.x=14;client.enqueue(theme,local);canonical=structuredClone(seed);canonical.inventory.wood=2;version='v2';return Response.json({error:'Another accepted NPC lease advanced the document',code:'save_conflict'},{status:409});}
  if(url.endsWith('/save')){saves++;const b=JSON.parse(init.body);assert.equal(b.expectedVersion,'v2');assert.equal(b.state.inventory.wood,2);canonical=structuredClone(b.state);version='v3';return Response.json({document:{version,state:canonical}});}
  reads++;return Response.json({document:{version,state:canonical}});
 };
 const intent=kind==='resident'?{intent:{goal:'forest',action:'work',resource:'wood'}}:kind==='field'?{actor:'npc',field:'mine',index:0,itemId:'ore'}:{actor:'npc',index:0,step:'hoe'};
 client=make();await client.load(theme);await assert.rejects(client.action(theme,{kind,operation:'begin',actorId:5,...intent,requestId:'rejected-only'}),e=>e.code==='save_conflict'&&e.status===409);
 assert.equal(actions,1,'The rejected intent is never automatically resubmitted');assert.equal(reads,1);assert.equal(client.blocked(theme),false);assert.equal(client.pendingAction(theme),null);assert.equal(client.status(theme).state.player.x,14);assert.equal(client.status(theme).state.inventory.wood,2);assert.equal(client.status(theme).state.coins,0);
 const previous=JSON.parse(data.get('hyper-dimension-'+theme+'-pending-action-previous'));assert.equal(previous.body.requestId,'rejected-only');assert.equal(previous.rejected,true);assert.equal(previous.body.expectedVersion,'v1');
 await client.checkpointAndRefresh(theme);assert.equal(actions,1);assert.equal(saves,1);assert.equal(canonical.player.x,14);assert.equal(canonical.inventory.wood,2);
}));

for(const boundary of ['overlap','different-island','read-failure','uncertain'])test('a rejected command still protects '+boundary,()=>fixture('pixel',async({seed,make})=>{
 let client,actions=0,reads=0;
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});
  if(url.endsWith('/action')){actions++;if(boundary==='overlap'){const s=client.status('pixel').state;s.inventory.wood=1;client.enqueue('pixel',s);}return Response.json({error:'Declared rejection',code:boundary==='uncertain'?'save_unavailable':'save_conflict'},{status:boundary==='uncertain'?500:409});}
  reads++;if(boundary==='read-failure')throw Error('Canonical read unavailable');const state=structuredClone(seed);state.inventory.wood=2;if(boundary==='different-island')state.saveSlot+='-replacement';return Response.json({document:{version:'v2',state}});
 };
 client=make();await client.load('pixel');await assert.rejects(client.action('pixel',{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood'},requestId:'protected-intent'}));
 assert.equal(actions,1);assert.equal(client.blocked('pixel'),true);assert.equal(client.status('pixel').state.saveSlot,seed.saveSlot);assert.equal(client.status('pixel').state.inventory.wood,boundary==='overlap'?1:0);assert.equal(client.status('pixel').state.coins,0);assert.equal(reads,boundary==='uncertain'?0:1);
 assert.equal(!!client.pendingAction('pixel'),boundary==='uncertain');
}));

test('a fully reconciled rejected command clears the outgoing local snapshot before reload',()=>fixture('pixel',async({seed,data,make})=>{
 let client,canonical=structuredClone(seed),calls=0;
 globalThis.fetch=async(url)=>{
  if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});
  if(url.endsWith('/action')){calls++;const s=client.status('pixel').state;s.player.x=14;client.enqueue('pixel',s);await new Promise(r=>setTimeout(r,300));assert(data.has('hyper-dimension-pixel-pending-server-save'));canonical=structuredClone(seed);canonical.player.x=14;canonical.inventory.wood=2;return Response.json({error:'Definite outdated version',code:'save_conflict'},{status:409});}
  return Response.json({document:{version:'v2',state:canonical}});
 };
 client=make();await client.load('pixel');await assert.rejects(client.action('pixel',{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood'},requestId:'no-local-difference'}));assert.equal(calls,1);assert.equal(client.status('pixel').dirty,false);assert.equal(client.status('pixel').status,'saved');assert.equal(data.has('hyper-dimension-pixel-pending-server-save'),false);assert.equal(client.pendingAction('pixel'),null);assert.deepEqual(client.status('pixel').state,canonical);
}));

test('manual actions, completions and unbound NPC inputs never trigger implicit canonical reads',()=>fixture('pixel',async({seed,make})=>{
 let reads=0;globalThis.fetch=async(url)=>{if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});if(!url.endsWith('/action'))reads++;return Response.json({error:'Explicit rejection',code:'save_conflict'},{status:409});};
 for(const input of [{kind:'personal',operation:'home_activity'},{kind:'resident',operation:'finish',actorId:5},{kind:'resident',operation:'begin'},{kind:'resident',operation:'begin',actorId:5},{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'invalid'}},{kind:'field',operation:'begin',actor:'player',actorId:5,field:'mine'}]){
  const client=make();await client.load('pixel');await assert.rejects(client.action('pixel',{...input,requestId:'explicit-'+JSON.stringify(input)}),e=>e.code==='save_conflict');assert.equal(reads,0);assert.equal(client.status('pixel').state.inventory.wood,0);
 }
}));

test('a failed refresh barrier remains a stop even for a fully bound queued NPC start',()=>fixture('pixel',async({seed,make})=>{
 let reads=0,actions=0;globalThis.fetch=async(url)=>{if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});if(url.endsWith('/action')){actions++;return Response.json({error:'Old version',code:'save_conflict'},{status:409});}reads++;return Response.json({error:'Unavailable canonical read',code:'save_busy'},{status:503});};
 const client=make();await client.load('pixel');await assert.rejects(client.checkpointAndRefresh('pixel'),e=>e.code==='save_busy');await assert.rejects(client.action('pixel',{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood'},requestId:'after-failed-read'}),e=>e.code==='save_conflict');assert.equal(reads,1);assert.equal(actions,1);assert.equal(client.blocked('pixel'),true);assert.equal(client.status('pixel').state.inventory.wood,0);
}));
