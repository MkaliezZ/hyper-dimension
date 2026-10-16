import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {resolve,join} from 'node:path';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';

for(const code of ['EPERM','EACCES','EBUSY'])test('actual save action survives transient Windows '+code+' acquisition without duplicating its lease or result',{skip:process.platform!=='win32'},async()=>{
 await fsp.mkdir('qa/v218',{recursive:true});const directory=await fsp.mkdtemp(resolve('qa/v218/lock-')),lock=join(directory,'pixel/write.lock');let now=Date.now();const store=createSaveStore({directory,now:()=>now}),doc=(await store.open('pixel',{legacyState:hydrateTown(createZeroState()),protect:true})).document,original=fs.promises.open;let calls=0;
 fs.promises.open=async(path,flags,mode)=>{if(resolve(String(path))===lock&&flags==='wx'&&++calls<=3)throw Object.assign(Error('Fictional Windows delete-pending lock'),{code});return original(path,flags,mode);};syncBuiltinESMExports();
 try{
  const input={kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood'},requestId:crypto.randomUUID(),expectedVersion:doc.version,epoch:doc.actions.epoch,expectedSequence:doc.actions.sequence};
  const begun=await store.action('pixel',input);assert.equal(calls,4);assert.equal(begun.ticket.sequence,doc.actions.sequence+1);
  const same=await store.action('pixel',input);assert.equal(same.ticket.requestId,begun.ticket.requestId);assert.equal(same.replayed,true);
  now=begun.ticket.readyAt;const finish={kind:'resident',operation:'finish',requestId:begun.ticket.requestId,epoch:begun.ticket.epoch,sequence:begun.ticket.sequence,expectedVersion:begun.document.version};
  const completed=await store.action('pixel',finish),replayed=await store.action('pixel',finish);assert.equal(replayed.replayed,true);assert.equal(completed.document.state.inventory.wood,2);assert.equal(replayed.document.state.inventory.wood,2);assert.equal(replayed.document.actions.receipts.filter(r=>r.ticket.requestId===begun.ticket.requestId).length,1);
 }finally{fs.promises.open=original;syncBuiltinESMExports();}
});
test('persistent save lock denial is bounded and leaves the canonical bytes and resources intact',async()=>{
 await fsp.mkdir('qa/v218',{recursive:true});const directory=await fsp.mkdtemp(resolve('qa/v218/permanent-lock-')),lock=join(directory,'pixel/write.lock'),current=join(directory,'pixel/current.json'),store=createSaveStore({directory}),doc=(await store.open('pixel',{legacyState:hydrateTown(createZeroState()),protect:true})).document,before=await fsp.readFile(current),original=fs.promises.open;let calls=0;
 fs.promises.open=async(path,flags,mode)=>{if(resolve(String(path))===lock&&flags==='wx'){calls++;throw Object.assign(Error('Fictional permanent denial'),{code:'EPERM'});}return original(path,flags,mode);};syncBuiltinESMExports();
 try{await assert.rejects(store.action('pixel',{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood'},requestId:crypto.randomUUID(),expectedVersion:doc.version,epoch:doc.actions.epoch,expectedSequence:doc.actions.sequence}),e=>e.code==='EPERM');assert.equal(calls,process.platform==='win32'?7:1);assert.deepEqual(await fsp.readFile(current),before);assert.equal(JSON.parse(before).state.inventory.wood,0);}
 finally{fs.promises.open=original;syncBuiltinESMExports();}
});
