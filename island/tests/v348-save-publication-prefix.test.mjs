import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const turn=()=>new Promise(r=>setImmediate(r));
for(const theme of ['pixel','origami'])for(const kind of ['action','save'])test(theme+' '+kind+' publishes an accepted result before a later background capture completes',async()=>{
 const keys=['localStorage','sessionStorage','document','window','location','fetch','setTimeout','clearTimeout'],previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const nativeTimeout=previous.setTimeout.value,nativeClear=previous.clearTimeout.value,data=new Map(),virtual=new Set(),native=new Set(),entered=deferred(),reply=deferred();let controlled=false,client,local,published=false,operation,queueLaterOnCapture=false,laterQueued=false;
 const nextTimer=ms=>[...virtual].find(t=>t.active&&t.ms===ms);
 const release=timer=>{assert(timer?.active,'Expected a queued browser timer');timer.active=false;timer.fn();};
 globalThis.setTimeout=(fn,ms,...args)=>{if(controlled&&(ms===0||ms===250)){const t={active:true,ms,fn:()=>fn(...args)};virtual.add(t);return t;}const t=nativeTimeout(fn,ms,...args);native.add(t);return t;};
 globalThis.clearTimeout=t=>{if(virtual.has(t)){t.active=false;return;}nativeClear(t);};
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected navigation');}};
 const seed={saveSlot:'hyper-dimension-'+theme+'-v3',workshopBests:{},day:1,coins:0,inventory:{wood:0},player:{x:0,y:0},farmControl:{version:1}};let canonical=structuredClone(seed),version=1;
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:structuredClone(seed)}});
  assert(url.endsWith(kind==='action'?'/action':'/save'));const body=JSON.parse(init.body);entered.resolve(body);await reply.promise;
  canonical=structuredClone(kind==='save'?body.state:seed);canonical.inventory.wood=2;version=2;return Response.json({document:{version:'v2',state:structuredClone(canonical)}});
 };
 try{
  client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){if(queueLaterOnCapture){queueLaterOnCapture=false;local.player.x=17;client.enqueue(theme,local);release(nextTimer(250));laterQueued=true;}},onRemoteState(_theme,state){local=state;if(client?.status(theme).version==='v2')published=true;}});local=await client.load(theme);
  if(kind==='action')operation=client.action(theme,{kind:'resident',operation:'finish',requestId:'accepted-before-later-snapshot',epoch:'fictional-epoch',sequence:1});
  else{local.player.y=1;client.enqueue(theme,local);operation=client.flush(theme);}
  await entered.promise;controlled=true;
  // A real background capture is already queued while the HTTP result is in flight.
  local.player.y=7;client.enqueue(theme,local);release(nextTimer(250));await turn();assert(nextTimer(0));
  reply.resolve();await turn();
  // A later progress edit requests another cache capture after the response arrives.
  // Its browser paint opportunity is deliberately held; the earlier accepted result
  // must become visible without discarding this edit or waiting for the later paint.
  queueLaterOnCapture=true;
  release(nextTimer(0));await turn();await turn();
  assert(laterQueued,'The later progress edit was requested during the earlier capture commit');
  assert(nextTimer(0),'The later browser capture remains queued');
  assert.equal(published,true,'Later background captures must not hold an earlier accepted publication');
  assert.equal(client.status(theme).version,'v2');assert.equal(local.inventory.wood,2);assert.equal(local.player.x,17);assert.equal(local.player.y,7);
  assert.equal(client.pendingAction(theme),null,'The original outgoing request retires only with its published result');
  const pending=JSON.parse(data.get('hyper-dimension-'+theme+'-pending-server-save'));assert.equal(pending.baseVersion,'v2');assert.equal(pending.baseDocument.document.version,'v2');assert.equal(pending.state.player.x,17);assert.equal(pending.state.inventory.wood,2);
 }finally{
  reply.resolve();for(let n=0;n<30;n++){for(const t of [...virtual])if(t.active&&t.ms===0)release(t);await turn();}
  controlled=false;for(const t of virtual)t.active=false;
  if(operation)await operation.catch(()=>{});
  if(client){const r=client.status(theme);clearTimeout(r.timer);clearTimeout(r.cacheTimer);await Promise.allSettled([r.cacheTail,r.inflight,r.actionTail].filter(Boolean));}
  for(const timer of native)nativeClear(timer);
  for(const [key,d]of Object.entries(previous)){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}
 }
});
