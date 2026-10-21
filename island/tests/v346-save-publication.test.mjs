import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';
import {recoverPendingProgress} from '../src/pendingSaveRecovery.js';
import {mergeActionState} from '../src/actionMerge.js';

async function fixture(theme,kind,run){
 const names=['localStorage','sessionStorage','document','window','location','fetch','setTimeout'],original=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)])),data=new Map(),listeners=new Map(),timers=new Set(),hooks={};let client,captured,publications=0;
 const nativeTimer=original.setTimeout.value;globalThis.setTimeout=(...args)=>{const timer=nativeTimer(...args);timers.add(timer);return timer;};
 globalThis.localStorage={getItem:key=>data.get(key)||null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>{data.delete(key);hooks.onRemove?.(key);}};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(name,fn){const set=listeners.get(name)||new Set();set.add(fn);listeners.set(name,set);}};globalThis.location={reload(){throw Error('No navigation in the isolated fixture');}};
 const seed={saveSlot:'hyper-dimension-'+theme+'-v3',workshopBests:{},day:1,coins:0,inventory:{wood:0},player:{x:0,y:0},farmControl:{version:1}},next=structuredClone(seed);next.inventory.wood=2;
 let remoteVersion='v1';
 globalThis.fetch=async(url,init)=>{if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});if(url.endsWith(kind==='action'?'/action':'/save')){remoteVersion='v2';if(kind==='save')next.player=structuredClone(JSON.parse(init.body).state.player);return Response.json({document:{version:'v2',state:next}});}return Response.json({document:{version:remoteVersion,state:next}});};
 try{
  client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState(_theme,state){
   if(publications)return;publications++;const record=client.status(theme),durablePending=JSON.parse(data.get('hyper-dimension-'+theme+'-pending-server-save')||'null');state.player.x=14;client.enqueue(theme,state);
   const transport=JSON.parse(data.get('hyper-dimension-'+theme+(kind==='action'?'-pending-action':'-pending-clock-save'))||'null');
   for(const fn of listeners.get('pagehide')||[])fn();
   captured={durablePending,version:record.version,state:structuredClone(record.state),pending:JSON.parse(data.get('hyper-dimension-'+theme+'-pending-server-save')||'null'),transport};
  }});
  await client.load(theme);await run({client,seed,next,data,hooks,listeners,capture:()=>captured,publications:()=>publications});
 }finally{if(client){const record=client.status(theme);for(let i=0;i<4;i++){clearTimeout(record.timer);clearTimeout(record.cacheTimer);await Promise.all([record.cacheTail,record.inflight,record.actionTail].filter(Boolean).map(p=>p.catch(()=>{})));await new Promise(resolve=>setImmediate(resolve));}clearTimeout(record.timer);clearTimeout(record.cacheTimer);}for(const timer of timers)clearTimeout(timer);for(const[name,descriptor]of Object.entries(original)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}
for(const theme of ['pixel','origami'])for(const kind of ['action','save'])test(theme+' '+kind+' publishes one acknowledged version only after retiring its outgoing journal',()=>fixture(theme,kind,async f=>{
 if(kind==='action')await f.client.action(theme,{kind:'resident',operation:'finish',requestId:'already-granted-work',epoch:'original-epoch',sequence:1});
 else{const state=f.client.status(theme).state;state.player.y=1;f.client.enqueue(theme,state);await f.client.flush(theme);}
 const observation=f.capture();assert.equal(f.publications(),1);assert.equal(observation.state.inventory.wood,2);assert.equal(observation.version,'v2');assert.equal(observation.transport,null);
 assert.equal(observation.pending.baseVersion,'v2');assert.equal(observation.pending.baseDocument.document.version,'v2');assert.equal(observation.pending.baseDocument.document.state.inventory.wood,2);
 const later={version:'v3',state:structuredClone(f.next)};later.state.inventory.wood=4;const merged=recoverPendingProgress(observation.pending,later);assert.equal(merged.inventory.wood,4);assert.equal(merged.player.x,14);assert.equal(merged.coins,0);
}));

for(const theme of ['pixel','origami'])for(const kind of ['action','save'])test(theme+' '+kind+' preserves an independent edit made while its outgoing request is retired',()=>fixture(theme,kind,async f=>{
 let edited=false;f.hooks.onRemove=key=>{if(edited||!key.endsWith(kind==='action'?'-pending-action':'-pending-clock-save'))return;edited=true;const state=f.client.status(theme).state;state.player.y=37;f.client.enqueue(theme,state);};
 if(kind==='action')await f.client.action(theme,{kind:'resident',operation:'finish',requestId:'original-retirement-request',epoch:'original-epoch',sequence:1});
 else{const state=f.client.status(theme).state;state.player.y=1;f.client.enqueue(theme,state);await f.client.flush(theme);}
 assert.equal(edited,true);assert.equal(f.capture().state.player.y,37);assert.equal(f.capture().state.inventory.wood,2);assert.equal(f.capture().version,'v2');assert.equal(f.capture().transport,null);
 const durable=f.capture().durablePending;assert.equal(durable.baseVersion,'v2');assert.equal(durable.state.inventory.wood,2);assert.equal(durable.state.player.y,37);const later={version:'v3',state:structuredClone(f.next)};later.state.inventory.wood=4;const recovered=recoverPendingProgress(durable,later);assert.equal(recovered.inventory.wood,4);assert.equal(recovered.player.y,37);
}));
for(const theme of ['pixel','origami'])for(const failure of ['overlap','storage'])test(theme+' '+failure+' during retirement retains the exact request and requires explicit recovery',()=>fixture(theme,'action',async f=>{
 let originalRequest,attempted=false;f.hooks.onRemove=key=>{if(attempted||!key.endsWith('-pending-action'))return;attempted=true;if(failure==='storage')throw Error('Isolated storage failure');const state=f.client.status(theme).state;state.inventory.wood=99;f.client.enqueue(theme,state);};
 // Capture the original envelope before removeItem retires it.
 const set=localStorage.setItem;localStorage.setItem=(key,value)=>{if(key.endsWith('-pending-action')&&!originalRequest)originalRequest=value;set(key,value);};
 let exactRequest;const remove=f.hooks.onRemove;f.hooks.onRemove=key=>{if(key.endsWith('-pending-action')&&!attempted)exactRequest=originalRequest;remove(key);};
 await assert.rejects(f.client.action(theme,{kind:'resident',operation:'finish',requestId:'must-keep-original-request',epoch:'original-epoch',sequence:1}));
 assert.equal(attempted,true);assert.equal(f.publications(),0);assert.equal(f.data.get('hyper-dimension-'+theme+'-pending-action'),exactRequest);assert.equal(f.client.status(theme).version,'v1');assert.equal(f.client.blocked(theme),true);if(failure==='overlap')assert.equal(f.client.status(theme).state.inventory.wood,99);
}));

for(const theme of ['pixel','origami'])for(const kind of ['action','save'])test(theme+' '+kind+' unload during journal retirement retains its exact replay beside the outgoing local snapshot',()=>fixture(theme,kind,async f=>{
 let captured;f.hooks.onRemove=key=>{if(captured||!key.endsWith(kind==='action'?'-pending-action':'-pending-clock-save'))return;captured={};const state=f.client.status(theme).state;state.player.y=37;f.client.enqueue(theme,state);for(const fn of f.listeners.get('pagehide')||[])fn();captured.request=JSON.parse(f.data.get(key));captured.pending=JSON.parse(f.data.get('hyper-dimension-'+theme+'-pending-server-save'));};
 if(kind==='action')await f.client.action(theme,{kind:'resident',operation:'finish',requestId:'original-pagehide-request',epoch:'original-epoch',sequence:1});
 else{const state=f.client.status(theme).state;state.player.y=1;f.client.enqueue(theme,state);await f.client.flush(theme);}
 assert(captured.request);assert.equal(captured.pending.state.player.y,37);if(kind==='action')assert.equal(captured.request.body.requestId,'original-pagehide-request');else assert(captured.request.body.saveId);
 const base=kind==='action'?captured.request.baseDocument.document.state:captured.request.body.state;const recovered=mergeActionState(base,captured.pending.state,f.next);assert.equal(recovered.inventory.wood,2);assert.equal(recovered.player.y,37);assert.equal(recovered.coins,0);
}));
