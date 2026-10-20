import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {mkdtemp,readFile,writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLanActivityStore} from '../server/lanActivityStore.mjs';
import {fixture,ready,play} from './v58-lan-fixtures.mjs';

async function emptyStore(){
 const directory=await mkdtemp(join(tmpdir(),'hd-v334-barrier-'));
 const options={directory,identities:{},tenants:{}};
 return {store:createLanActivityStore(options),other:()=>createLanActivityStore(options)};
}
async function countLockOpens(store,run){
 const native=fs.promises.open,lock=resolve(store.directory,'activities.lock');let acquisitions=0;
 // Observe real filesystem opens without changing their result, timing or lock.
 fs.promises.open=function(...args){return native.apply(this,args).then(handle=>{if(resolve(String(args[0]))===lock)acquisitions++;return handle;});};syncBuiltinESMExports();
 try{await run();return acquisitions;}finally{fs.promises.open=native;syncBuiltinESMExports();}
}

test('simultaneous save barriers share one physical check; separate stores still acquire their own lock',async()=>{
 const f=await emptyStore(),other=f.other();await f.store.reconcile();
 assert.equal(await countLockOpens(f.store,()=>Promise.all(Array.from({length:32},()=>f.store.reconcile()))),1);
 assert.equal(await countLockOpens(f.store,()=>Promise.all(Array.from({length:16},()=>[f.store.reconcile(),other.reconcile()]).flat())),2);
 assert.equal(await countLockOpens(f.store,async()=>{await f.store.reconcile();await f.store.reconcile();}),2,'A completed check is never cached');
});

test('a shared corrupt-file rejection preserves the evidence and clears before the next real check',async()=>{
 const {store}=await emptyStore();await store.reconcile();const file=join(store.directory,'activities.json'),before=await readFile(file),changed=JSON.parse(before);changed.revision++;
 const corrupt=Buffer.from(JSON.stringify(changed));await writeFile(file,corrupt);
 const rejected=await Promise.allSettled(Array.from({length:32},()=>store.reconcile()));
 assert(rejected.every(r=>r.status==='rejected'&&r.reason.code==='lan_event_corrupt'));assert.deepEqual(await readFile(file),corrupt);
 await writeFile(file,before);await store.reconcile();assert.deepEqual(await readFile(file),before);
});

test('an active foreign lock still rejects after the original wait and is never removed by joined callers',{timeout:15000},async()=>{
 const {store}=await emptyStore();await store.reconcile();const lock=join(store.directory,'activities.lock'),owner=JSON.stringify({pid:process.pid,token:randomUUID()});await writeFile(lock,owner,{flag:'wx'});
 try{
  const started=Date.now(),rejected=await Promise.allSettled(Array.from({length:32},()=>store.reconcile()));
  assert(rejected.every(r=>r.status==='rejected'&&r.reason.code==='lan_event_busy'));assert(Date.now()-started>=4900);assert.equal(await readFile(lock,'utf8'),owner);
 }finally{assert.equal(await readFile(lock,'utf8'),owner);await unlink(lock);}
 await store.reconcile();
});

for(const theme of ['pixel','origami'])test(theme+' joined save callers cannot pass an unfinished persisted funded settlement',{timeout:60000},async()=>{
 // The original accounting fixture declares stock, 100 coins and controlled
 // game time. Actual wallet steps, journal recovery and replay remain real.
 const f=await fixture(theme),id=await ready(f);await play(f,id);let faulted=false;
 f.setFault('settlement',at=>{if(!faulted&&at==='settlement-prepared'){faulted=true;throw Error('Declared persisted settlement interruption');}});
 const input={operation:'finish',eventId:id,expectedRevision:(await f.view(0)).events[0].revision,requestId:randomUUID()};await assert.rejects(f.store.action(f.users[0].token,input));
 let entered,release;const enteredPromise=new Promise(r=>entered=r),held=new Promise(r=>release=r);let holding=false;
 f.setFault('settlement',async at=>{if(!holding&&at==='settlement-step'){holding=true;entered();await held;}});
 let resolved=0;const callers=Array.from({length:32},()=>f.store.reconcile().then(()=>{resolved++;}));
 try{await enteredPromise;assert.equal(resolved,0,'No save caller may bypass an incomplete settlement');}finally{release();}
 await Promise.all(callers);assert.equal(resolved,32);assert.equal((await f.read(0)).state.coins,101);assert.equal((await f.read(1)).state.coins,91);
 assert.equal((await f.view(0)).events[0].phase,'completed');assert((await f.other().action(f.users[0].token,input)).replayed);
 assert.equal((await f.read(0)).state.coins+(await f.read(1)).state.coins,192);
});
