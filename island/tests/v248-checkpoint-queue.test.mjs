import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveClient} from '../src/saveClient.js';
import {createSaveStore} from '../server/saveStore.mjs';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function fixture(t){
 const names=['localStorage','sessionStorage','document','window','location','fetch','Worker','indexedDB'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),values=new Map(),calls=[],releases=[],options={};
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.location={href:'http://127.0.0.1/isolated-checkpoint',reload(){throw Error('Unexpected navigation');}};globalThis.Worker=undefined;globalThis.indexedDB=undefined;
 await mkdir('qa/v248/checkpoint',{recursive:true});const directory=await mkdtemp(join(resolve('qa/v248/checkpoint'),'fictional-')),store=createSaveStore({directory}),{document:initial}=await store.openClient('pixel',{});let local=structuredClone(initial.state);
 globalThis.fetch=async(url,init={})=>{const operation=url.split('/').at(-1),body=init.body?JSON.parse(init.body):{};calls.push({operation,body});
  try{let r;if(operation==='open')r=await store.openClient('pixel',body);else if(operation==='save')r=await store.save('pixel',body);else if(operation==='backup')r=await store.backup('pixel',body);else if(operation==='action'){r=await store.action('pixel',body);await options.afterAction?.(r,body);if(options.lose===body.requestId)throw Error('Fictional committed response lost');}else r={document:await store.current('pixel')};return Response.json(r);}
  catch(e){if(!e.code)throw e;return Response.json({error:e.message,code:e.code},{status:e.status||500});}
 };
 const c=createSaveClient({loadLocal:()=>structuredClone(initial.state),storeLocal(){},onRemoteState:(_,s)=>local=s});await c.load('pixel');local=c.status('pixel').state;calls.length=0;
 t.after(async()=>{for(const r of releases)r();const s=c.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.actionTail?.catch(()=>{});await s.inflight?.catch(()=>{});await s.cacheTail;clearTimeout(s.timer);clearTimeout(s.cacheTimer);for(const[k,d]of Object.entries(old))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];});
 return {c,store,initial,calls,options,releases,get local(){return local;}};
}

test('a queued checkpoint waits for the accepted command and saves edits before the next action',{timeout:5000},async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();f.releases.push(release.resolve);const firstId=randomUUID(),secondId=randomUUID();
 f.options.afterAction=async(_,b)=>{if(b.requestId===firstId){entered.resolve();await release.promise;}};
 const first=f.c.action('pixel',{kind:'commerce',operation:'enable',requestId:firstId});first.catch(()=>{});await entered.promise;
 const moved=structuredClone(f.local);moved.player.x++;f.c.enqueue('pixel',moved);let saved=false;const checkpoint=f.c.checkpoint('pixel').then(()=>saved=true);checkpoint.catch(()=>{});
 const second=f.c.action('pixel',{kind:'commerce',operation:'hire_enable',requestId:secondId});second.catch(()=>{});await new Promise(r=>setTimeout(r,25));
 assert.equal(saved,false);assert.equal(f.calls.length,1);assert.equal(f.c.pendingAction('pixel').body.requestId,firstId);
 release.resolve();await first;await checkpoint;await second;
 assert.deepEqual(f.calls.map(c=>c.operation),['action','save','action']);assert.equal(f.calls[0].body.requestId,firstId);assert.equal(f.calls[2].body.requestId,secondId);
 const final=await f.store.current('pixel');assert.equal(final.state.player.x,f.initial.state.player.x+1);assert.equal(final.state.coins,0);assert.deepEqual(final.state.inventory,f.initial.state.inventory);assert.equal(f.c.pendingAction('pixel'),null);assert.equal(f.c.status('pixel').status,'saved');
});

test('an uncertain original command keeps its journal and blocks checkpoint until exact replay',{timeout:5000},async t=>{
 const f=await fixture(t),requestId=randomUUID();f.options.lose=requestId;
 await assert.rejects(f.c.action('pixel',{kind:'commerce',operation:'plan_create',requestId,day:f.initial.state.day,project:{id:'checkpoint-uncertain',title:'原编号筹备',targets:{wood:1}}}),/committed response lost/);const pending=structuredClone(f.c.pendingAction('pixel'));
 await assert.rejects(f.c.checkpoint('pixel'),e=>e.code==='action_pending');assert.equal(f.calls.length,1);assert.deepEqual(f.c.pendingAction('pixel'),pending);assert.equal(f.c.status('pixel').status,'action_pending');
 f.options.lose=null;const r=await f.c.action('pixel',pending.body);assert.equal(r.replayed,true);await f.c.checkpoint('pixel');assert.equal(f.c.pendingAction('pixel'),null);
 const final=await f.store.current('pixel');assert.equal(final.actions.receipts.filter(r=>r.ticket.requestId===requestId).length,1);assert.equal(final.state.workProjects.filter(p=>p.id==='checkpoint-uncertain').length,1);assert.equal(final.state.coins,0);assert.deepEqual(final.state.inventory,f.initial.state.inventory);assert.equal(f.calls.filter(r=>r.operation==='action').length,2);assert.deepEqual(f.calls[0].body,f.calls[1].body);
});

test('a requested backup includes earlier accepted edits and excludes a later queued project',{timeout:5000},async t=>{
 const f=await fixture(t),entered=deferred(),release=deferred();f.releases.push(release.resolve);const firstId=randomUUID(),secondId=randomUUID(),day=f.initial.state.day;
 f.options.afterAction=async(_,b)=>{if(b.requestId===firstId){entered.resolve();await release.promise;}};
 const first=f.c.action('pixel',{kind:'commerce',operation:'plan_create',requestId:firstId,day,project:{id:'before-backup',title:'备份前筹备',targets:{wood:1}}});first.catch(()=>{});await entered.promise;
 const moved=structuredClone(f.local);moved.player.x++;f.c.enqueue('pixel',moved);const backup=f.c.backup('pixel');backup.catch(()=>{});
 const second=f.c.action('pixel',{kind:'commerce',operation:'plan_create',requestId:secondId,day,project:{id:'after-backup',title:'备份后筹备',targets:{wood:1}}});second.catch(()=>{});
 await new Promise(r=>setTimeout(r,25));assert.equal(f.calls.length,1);release.resolve();await first;const snapshot=await backup;await second;
 assert.deepEqual(f.calls.map(c=>c.operation),['action','save','backup','action']);const latest=await f.store.current('pixel');assert(latest.state.workProjects.some(p=>p.id==='after-backup'));
 const restored=await f.store.restore('pixel',{id:snapshot.id,expectedVersion:latest.version});assert.equal(restored.document.state.player.x,f.initial.state.player.x+1);assert(restored.document.state.workProjects.some(p=>p.id==='before-backup'));assert(!restored.document.state.workProjects.some(p=>p.id==='after-backup'));assert.equal(restored.document.state.coins,0);assert.deepEqual(restored.document.state.inventory,f.initial.state.inventory);
});
