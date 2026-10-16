import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveClient} from '../src/saveClient.js';
import {createSaveJournal} from '../src/saveJournal.js';

async function fixture(t,{empty=false,offline=false}={}){
 const names=['localStorage','sessionStorage','document','window','location','fetch','Worker','indexedDB'];
 const prior=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),values=new Map(),listeners=new Map(),clients=[];
 const counters={open:0,save:0,action:0,restore:0,imports:0,reloads:0,replacements:[]},options={offline,loseRestore:false,rejectRestore:false,quota:false},releases=[];
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(options.quota&&k.endsWith('-previous'))throw new DOMException('Fictional journal quota','QuotaExceededError');values.set(k,String(v));},removeItem:k=>values.delete(k)};
 globalThis.sessionStorage=localStorage;globalThis.Worker=undefined;globalThis.indexedDB=undefined;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
 globalThis.location={href:'http://localhost:4175/play?qa=1',reload(){counters.reloads++;},replace:url=>counters.replacements.push(url)};
 await mkdir('qa/v226/rules',{recursive:true});const store=createSaveStore({directory:await mkdtemp(join(resolve('qa/v226/rules'),'replacement-'))}),seed=hydrateTown(createZeroState({playerProfile:{name:'历史记录'}}));
 if(!empty)await store.open('pixel',{legacyState:seed,protect:true});
 globalThis.fetch=async(url,init={})=>{
  const body=JSON.parse(init.body||'{}'),operation=url.split('/').pop();
  try{
   let result;
   if(operation==='open'){counters.open++;if(options.offline)throw Error('Fictional offline open');result=await store.openClient('pixel',body);}
   else if(operation==='restore'){counters.restore++;if(options.rejectRestore)throw Object.assign(Error('Fictional definite version rejection'),{code:'save_conflict',status:409});result=await store.restoreClient('pixel',body);if(options.loseRestore){options.loseRestore=false;throw Error('Fictional lost restore response');}}
   else if(operation==='save'){counters.save++;result=await store.save('pixel',body);}
   else if(operation==='action'){counters.action++;result=await store.action('pixel',body);await options.afterAction?.(result);}
   else if(operation==='import'){counters.imports++;result=await store.importClient('pixel',body);}
   else if(operation==='import-preview'){result=await store.previewImport('pixel',body);}
   else{await options.beforeRead?.();result={document:await store.current('pixel')};}
   return Response.json(result);
  }catch(error){if(!error.code)throw error;return Response.json({error:error.message,code:error.code},{status:error.status||500});}
 };
 const client=()=>{const c=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){}});clients.push(c);return c;};
 t.after(async()=>{
  if(clients.some(c=>c.status('pixel').navigationPending))listeners.get('pagehide')?.();
  for(const release of releases)release();
  for(const c of clients){const r=c.status('pixel');clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.actionTail;await r.inflight;await r.cacheTail;clearTimeout(r.timer);clearTimeout(r.cacheTimer);}
  for(const[k,d]of Object.entries(prior))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];
 });
 const c=client();await c.load('pixel');
 return{c,client,store,seed,options,counters,values,releases};
}

const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Fixture barrier not reached');}

test('a lost history-restore response is not replayed, even with stale action/clock journals after reload',async t=>{
 const f=await fixture(t),before=await f.store.current('pixel'),snapshot=await f.store.backup('pixel',{expectedVersion:before.version});
 const outgoing=f.c.status('pixel').state;outgoing.playerProfile.name='等待恢复';f.c.enqueue('pixel',outgoing);await f.c.flush('pixel');
 const old=await f.store.current('pixel'),{preview}=await f.store.previewImport('pixel',{data:await f.store.export('pixel'),expectedVersion:old.version,clientId:'older-import-window',requestId:crypto.randomUUID()});
 f.options.loseRestore=true;await assert.rejects(f.c.restore('pixel',snapshot.id),/lost restore response/);
 assert.equal(f.counters.restore,1);assert.equal(f.c.blocked('pixel'),true);assert.equal(f.c.status('pixel').status,'action_pending');
 assert.equal(JSON.parse(f.values.get('hyper-dimension-pixel-pending-replacement')).operation,'restore');
 const backup=f.values.get('hyper-dimension-pixel-pending-server-save-previous');assert.equal(JSON.parse(backup).state.playerProfile.name,'等待恢复');
 f.values.set('hyper-dimension-pixel-pending-clock-save',JSON.stringify({body:{state:outgoing,expectedVersion:'obsolete',saveId:crypto.randomUUID()}}));
 f.values.set('hyper-dimension-pixel-pending-action',JSON.stringify({body:{kind:'resident',operation:'finish',requestId:crypto.randomUUID()}}));
 const olderImport={body:{previewId:preview.id,expectedVersion:preview.expectedVersion,clientId:preview.clientId}};f.values.set('hyper-dimension-pixel-pending-import',JSON.stringify(olderImport));
 const saves=f.counters.save,actions=f.counters.action,again=f.client();await again.load('pixel');
 assert.equal(again.status('pixel').state.playerProfile.name,'历史记录');assert.equal(again.blocked('pixel'),true);
 again.enqueue('pixel',outgoing);assert.equal(again.status('pixel').state.playerProfile.name,'历史记录');
 await assert.rejects(again.flush('pixel'),e=>e.code==='action_pending');
 await assert.rejects(again.action('pixel',{}),e=>e.code==='save_recovering');
 await again.acceptServer('pixel',{reload:false});
 assert.equal(again.blocked('pixel'),false);assert.equal(f.counters.restore,1);assert.equal(f.counters.save,saves);assert.equal(f.counters.action,actions);
 for(const suffix of ['pending-replacement','pending-clock-save','pending-action','pending-import'])assert.equal(f.values.has('hyper-dimension-pixel-'+suffix),false);
 assert.equal(f.counters.imports,0);assert.deepEqual(JSON.parse(f.values.get('hyper-dimension-pixel-pending-import-previous')).pendingImport,olderImport);
 assert.equal(f.values.get('hyper-dimension-pixel-pending-server-save-previous'),backup);
 const after=await f.store.current('pixel');assert.equal(after.state.playerProfile.name,'历史记录');assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.inventory,before.state.inventory);
 assert.equal((await f.store.backups('pixel')).filter(b=>b.reason==='before-restore').length,1);
});

test('a definite restore rejection clears only its replacement marker and keeps a usable canonical read',async t=>{
 const f=await fixture(t),before=await f.store.current('pixel'),snapshot=await f.store.backup('pixel',{expectedVersion:before.version});
 f.options.rejectRestore=true;await assert.rejects(f.c.restore('pixel',snapshot.id),e=>e.status===409&&e.code==='save_conflict');
 assert.equal(f.values.has('hyper-dimension-pixel-pending-replacement'),false);assert.equal(f.c.status('pixel').recovering,false);assert.equal(f.c.blocked('pixel'),true);assert.equal(f.counters.reloads,0);
 await f.c.acceptServer('pixel',{reload:false});assert.equal(f.c.blocked('pixel'),false);assert.equal(f.counters.restore,1);assert.equal((await f.store.current('pixel')).version,before.version);
});

test('a confirmed server-world replacement seals the old document before returning',async t=>{
 const f=await fixture(t),outgoing=f.c.status('pixel').state,before=await f.store.current('pixel');
 const restarted=await f.store.restartClient('pixel',{requestId:crypto.randomUUID(),expectedVersion:before.version});assert.notEqual(restarted.document.state.saveSlot,outgoing.saveSlot);
 await f.c.refresh('pixel');const current=f.c.status('pixel').state;
 assert.equal(f.c.blocked('pixel'),true);assert.equal(f.c.status('pixel').navigationPending,true);assert.equal(f.counters.reloads,1);
 f.c.enqueue('pixel',outgoing);assert.equal(f.c.status('pixel').state,current);assert.equal(f.c.status('pixel').dirty,false);assert.equal(current.saveSlot,restarted.document.state.saveSlot);
 assert.equal(JSON.parse(f.values.get('hyper-dimension-pixel-pending-server-save-previous')).state.saveSlot,outgoing.saveSlot);
});

test('first successful server open after an offline boot seals the outgoing local state',async t=>{
 const f=await fixture(t,{empty:true,offline:true}),outgoing=f.c.status('pixel').state;assert.equal(f.c.status('pixel').version,null);
 f.options.offline=false;f.c.enqueue('pixel',outgoing);await f.c.flush('pixel');const current=f.c.status('pixel').state;
 assert.equal(f.c.blocked('pixel'),true);assert.equal(f.c.status('pixel').navigationPending,true);assert.equal(f.counters.reloads,1);assert.equal(f.counters.save,0);
 f.c.enqueue('pixel',outgoing);assert.equal(f.c.status('pixel').state,current);assert.equal(f.c.status('pixel').dirty,false);assert.equal(current.saveSlot,(await f.store.current('pixel')).state.saveSlot);
});

test('a failed outgoing backup leaves server-world adoption blocked without starting navigation or writes',async t=>{
 const f=await fixture(t),outgoing=f.c.status('pixel').state,before=await f.store.current('pixel');
 await f.store.restartClient('pixel',{requestId:crypto.randomUUID(),expectedVersion:before.version});f.options.quota=true;
 await assert.rejects(f.c.refresh('pixel'),e=>e.name==='QuotaExceededError');
 assert.equal(f.c.blocked('pixel'),true);assert.equal(f.c.status('pixel').recovering,false);assert.equal(f.c.status('pixel').state,outgoing);assert.equal(f.counters.reloads,0);
 await assert.rejects(f.c.flush('pixel'),e=>e.code==='action_pending');assert.equal(f.counters.save,0);
});

test('a server-world adoption drains an already accepted old-world action before caching its new identity',async t=>{
 const f=await fixture(t),readStarted=deferred(),readRelease=deferred(),accepted=deferred(),actionRelease=deferred();f.releases.push(readRelease.resolve,actionRelease.resolve);
 f.options.beforeRead=async()=>{readStarted.resolve();await readRelease.promise;};f.options.afterAction=async()=>{accepted.resolve();await actionRelease.promise;};
 const outgoing=f.c.status('pixel').state,refresh=f.c.refresh('pixel');await readStarted.promise;
 const action=f.c.action('pixel',{kind:'resident',operation:'begin',actorId:0,intent:{goal:'plaza',action:'rest'},requestId:crypto.randomUUID()});await accepted.promise;
 const old=await f.store.current('pixel'),restarted=await f.store.restartClient('pixel',{requestId:crypto.randomUUID(),expectedVersion:old.version});readRelease.resolve();
 await until(()=>f.c.status('pixel').recovering);assert.equal(f.counters.reloads,0);assert.equal(f.c.status('pixel').state.saveSlot,outgoing.saveSlot);
 actionRelease.resolve();await action;await refresh;
 assert.equal(f.c.status('pixel').state.saveSlot,restarted.document.state.saveSlot);assert.equal(f.c.status('pixel').navigationPending,true);assert.equal(f.c.status('pixel').dirty,false);assert.equal(f.counters.reloads,1);
});

test('a pending import drains an old accepted action before adopting the signed replacement',async t=>{
 const f=await fixture(t),exported=await f.store.export('pixel'),accepted=deferred(),actionRelease=deferred();f.releases.push(actionRelease.resolve);
 f.options.afterAction=async()=>{accepted.resolve();await actionRelease.promise;};
 const action=f.c.action('pixel',{kind:'resident',operation:'begin',actorId:0,intent:{goal:'plaza',action:'rest'},requestId:crypto.randomUUID()});await accepted.promise;
 const current=await f.store.current('pixel'),{preview}=await f.store.previewImport('pixel',{data:exported,expectedVersion:current.version,clientId:'pending-import-fixture',requestId:crypto.randomUUID()});
 f.values.set('hyper-dimension-pixel-pending-import',JSON.stringify({body:{previewId:preview.id,expectedVersion:preview.expectedVersion,clientId:preview.clientId}}));
 const imported=f.c.retryImport('pixel');await until(()=>f.c.status('pixel').recovering);assert.equal(f.counters.reloads,0);
 actionRelease.resolve();await action;await imported;
 const currentState=f.c.status('pixel').state;assert.equal(f.c.status('pixel').navigationPending,true);assert.equal(f.c.status('pixel').dirty,false);assert.equal(f.c.status('pixel').actions.active,null);
 assert.deepEqual(currentState.inventory,exported.state.inventory);assert.equal(f.counters.reloads,1);assert.equal(f.values.has('hyper-dimension-pixel-pending-import'),false);
});

test('the worker journal migrates legacy pending import and replacement identities before removing old keys',async t=>{
 const f=await fixture(t),imported={body:{previewId:crypto.randomUUID(),clientId:'legacy-window'}},replacement={operation:'restore',body:{id:'legacy.json'}};
 const keys=['hyper-dimension-pixel-pending-import','hyper-dimension-pixel-pending-replacement'];f.values.set(keys[0],JSON.stringify(imported));f.values.set(keys[1],JSON.stringify(replacement));const committed=[];
 globalThis.indexedDB={};globalThis.Worker=class{
  postMessage({id,operation,value}){queueMicrotask(()=>{if(operation==='commit')committed.push(...value);this.onmessage({data:{id,result:operation==='entries'?[]:true}});});}
  terminate(){}
 };
 const journal=createSaveJournal();t.after(()=>journal.dispose());await journal.prepare('pixel');
 assert.deepEqual(journal.get(keys[0]),imported);assert.deepEqual(journal.get(keys[1]),replacement);
 for(const key of keys){assert(committed.some(([k])=>k==='hd-local:'+key));assert.equal(f.values.has(key),false);}
});
