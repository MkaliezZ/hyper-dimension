import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createSaveClient} from '../src/saveClient.js';
import {createSnapshotEncoder,encodedSnapshotChanges,applyImmutableSnapshotChanges} from '../src/saveDelta.js';
import {mergeActionState,sameState} from '../src/actionMerge.js';
import {createSaveResponseCache} from '../src/saveResponse.js';

test('the actual merge worker can return its exact encoded result beside deltas without changing its default protocol',async()=>{
 const source=(await readFile(new URL('../src/saveWorker.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,''),sent=[],self={postMessage:value=>sent.push(value)};
 vm.runInNewContext(source,{self,indexedDB:{open:()=>({})},createSaveResponseCache,createSnapshotEncoder,encodedSnapshotChanges,mergeActionState,sameState});
 const base={coins:0,inventory:{wood:0},stewardChat:{draft:'before'}},local={...base,stewardChat:{draft:'after'}},remote={...base,inventory:{wood:2}},expected={...remote,stewardChat:{draft:'after'}};
 for(const includeSerialized of [false,true]){
  await self.onmessage({data:{id:sent.length+1,operation:'merge',value:{base,local,remote,delta:true,includeSerialized}}});
  const reply=sent.at(-1);assert.equal(reply.error,undefined);assert.equal(reply.result.dirty,true);assert.deepEqual(applyImmutableSnapshotChanges(local,reply.result.changes,true),expected);
  assert.equal(Object.hasOwn(reply.result,'serialized'),includeSerialized);if(includeSerialized)assert.deepEqual(JSON.parse(reply.result.serialized),expected);
 }
});

async function fixture(theme,kind,mode,run){
 const names=['localStorage','sessionStorage','document','window','location','Worker','indexedDB','setTimeout'],original=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)])),values=new Map(),stored=new Map(),calls=[],timers=new Set(),hooks={};let client,local,remote,requestCount=0;
 const nativeTimer=original.setTimeout.value;globalThis.setTimeout=(...args)=>{const timer=nativeTimer(...args);timers.add(timer);return timer;};
 globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={href:'http://owned.invalid/',reload(){throw Error('No navigation permitted');}};globalThis.indexedDB={};
 const seed={saveSlot:'hyper-dimension-'+theme+'-v3',workshopBests:{},day:1,coins:0,inventory:{wood:0},player:{x:0,y:0},stewardChat:{draft:'before'},farmControl:{version:1}},encoder=createSnapshotEncoder();remote={version:'v1',state:structuredClone(seed)};
 globalThis.Worker=class{
  postMessage(message){const {id,operation,value}=structuredClone(message);calls.push({operation,value});setTimeout(()=>{
   try{let result;
    if(operation==='entries')result=[...stored].filter(([k])=>k.startsWith(value));
    else if(operation==='snapshot')result=encoder.encode(value);
    else if(operation==='encode')result=JSON.stringify(value);
    else if(operation==='commit'){
     const retirement=value.some(([key,text])=>text===null&&key.endsWith(kind==='action'?'-pending-action':'-pending-clock-save'));
     if(retirement)hooks.beforeRetirement?.(value);
     for(const [key,text] of value)if(text===null)stored.delete(key);else stored.set(key,text);
     if(retirement)hooks.afterRetirement?.(value);result=true;
    }else if(operation==='request'){
     if(value.url.endsWith('/'+kind)){
      requestCount++;const input=JSON.parse(value.init.body);assert.equal(input.includeSerialized,undefined,'Worker hints must never enter the authority request');
      remote={version:'v2',state:structuredClone(kind==='save'?input.state:seed)};remote.state.inventory.wood=2;
      hooks.afterServerAccept?.();
     }
     result={ok:true,status:200,text:JSON.stringify({document:remote})};
    }else if(operation==='merge'){
     let base=typeof value.base==='string'?JSON.parse(value.base):value.base;for(const key of value.path?.split('.')||[])base=base[key];
     const local=JSON.parse(value.local),next=JSON.parse(value.remote).document.state,state=mergeActionState(base,local,next);
     result={changes:encodedSnapshotChanges(local,state),dirty:!sameState(state,next),...(value.includeSerialized&&mode!=='older-worker'?{serialized:JSON.stringify(state)}:{})};
    }else throw Error(operation);
    this.onmessage({data:{id,result}});
   }catch(error){this.onmessage({data:{id,error:{message:error.message,code:error.code,path:error.path}}});}
  },0);}
  terminate(){}
 };
 try{
  client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){throw Error('Strict Worker journal required');},onRemoteState:(_,state)=>{local=state;hooks.onPublish?.(state);}});local=await client.load(theme);
  await run({client,state:()=>local,stored,calls,hooks,seed,requestCount:()=>requestCount,start:async()=>{
   if(kind==='action')return client.action(theme,{kind:'resident',operation:'finish',requestId:'original-publication-'+theme,epoch:'owned-epoch',sequence:1});
   local.player.y=1;client.enqueue(theme,local);return client.flush(theme);
  }});
 }finally{
  if(client){const record=client.status(theme);for(let n=0;n<4;n++){clearTimeout(record.timer);clearTimeout(record.cacheTimer);await Promise.allSettled([record.cacheTail,record.inflight,record.actionTail].filter(Boolean));await new Promise(r=>setImmediate(r));}clearTimeout(record.timer);clearTimeout(record.cacheTimer);}
  for(const timer of timers)clearTimeout(timer);for(const [name,descriptor] of Object.entries(original)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}
 }
}

for(const theme of ['pixel','origami'])for(const kind of ['action','save'])test(theme+' '+kind+' retires its exact outgoing request with a durable acknowledged snapshot and version stamp',()=>fixture(theme,kind,'modern',async f=>{
 let published=false;f.hooks.onPublish=state=>{
  published=true;assert.equal(state.inventory.wood,2);assert.deepEqual(JSON.parse(f.stored.get('hd-local:'+state.saveSlot)),state);
  assert.equal(JSON.parse(f.stored.get('hd-local:hyper-dimension-'+theme+'-journal-stamp')).version,'v2');assert.equal(f.stored.has('hd-local:hyper-dimension-'+theme+(kind==='action'?'-pending-action':'-pending-clock-save')),false);
 };
 await f.start();assert(published);assert.equal(f.requestCount(),1);assert.equal(f.client.pendingAction(theme),null);
 const merge=f.calls.findIndex(call=>call.operation==='merge'&&call.value.includeSerialized);assert(merge>=0);
 assert.equal(f.calls.slice(merge+1).filter(call=>['snapshot','encode','merge'].includes(call.operation)).length,0,'Confirmed state must not require another full-state capture or encode');
 assert.equal(f.client.status(theme).dirty,false);
}));

for(const theme of ['pixel','origami'])for(const kind of ['action','save'])test(theme+' '+kind+' preserves a new independent edit during strict retirement and keeps its new baseline',()=>fixture(theme,kind,'modern',async f=>{
 let changed=false;f.hooks.afterRetirement=()=>{if(changed)return;changed=true;f.state().player.x=37;f.client.enqueue(theme,f.state());};
 await f.start();assert(changed);assert.equal(f.state().inventory.wood,2);assert.equal(f.state().player.x,37);assert.equal(f.requestCount(),1);
 const pending=JSON.parse(f.stored.get('hd-local:hyper-dimension-'+theme+'-pending-server-save'));assert.equal(pending.baseVersion,'v2');assert.equal(pending.baseDocument.document.state.inventory.wood,2);assert.equal(pending.state.player.x,37);assert.equal(pending.state.inventory.wood,2);
}));

for(const theme of ['pixel','origami'])test(theme+' failed strict publication retains the exact replay and does not publish a new version',()=>fixture(theme,'action','modern',async f=>{
 let failed=false,original=null,published=false;f.hooks.beforeRetirement=()=>{if(failed)return;failed=true;original=f.stored.get('hd-local:hyper-dimension-'+theme+'-pending-action');throw Error('Owned strict transaction failure');};f.hooks.onPublish=()=>published=true;
 await assert.rejects(f.start(),/Owned strict transaction failure/);assert(failed);assert(original);assert.equal(published,false);assert.equal(f.client.status(theme).version,'v1');assert.equal(f.stored.get('hd-local:hyper-dimension-'+theme+'-pending-action'),original);assert.equal(f.client.blocked(theme),true);assert.equal(f.requestCount(),1);
}));

test('a previously cached Worker without the optional encoded result retains the compatible durable fallback',()=>fixture('pixel','action','older-worker',async f=>{
 await f.start();assert.equal(f.state().inventory.wood,2);assert.equal(f.client.pendingAction('pixel'),null);assert.equal(JSON.parse(f.stored.get('hd-local:'+f.state().saveSlot)).inventory.wood,2);
}));
