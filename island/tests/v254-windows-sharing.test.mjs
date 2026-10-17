import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';

async function holdFile(root,file,ms){
 const script=join(root,'hold-owned-file.ps1');await writeFile(script,"param([string]$Target,[int]$Millis)\n$stream=[System.IO.File]::Open($Target,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::ReadWrite)\ntry { [Console]::Out.WriteLine('ready'); [Console]::Out.Flush(); Start-Sleep -Milliseconds $Millis } finally { $stream.Dispose() }\n");
 const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',script,'-Target',file,'-Millis',String(ms)],{windowsHide:true,stdio:['ignore','pipe','pipe']});let text='',error='';child.stdout.on('data',d=>text+=d);child.stderr.on('data',d=>error+=d);const exit=once(child,'exit');
 await Promise.race([new Promise((accept,reject)=>{const timer=setTimeout(()=>reject(Error('Owned file-holder did not become ready')),10000);const poll=()=>{if(text.includes('ready')){clearTimeout(timer);accept();}else if(child.exitCode!==null){clearTimeout(timer);reject(Error('Owned holder exited before readiness'));}else setTimeout(poll,10);};poll();}),exit.then(()=>{if(!text.includes('ready'))throw Error('Owned holder exited before readiness');})]);return{child,exit,errors:()=>error};
}

for(const persistent of [false,true])test('real Windows no-delete sharing '+(persistent?'remains bounded without replacing canonical data':'outlives the old680ms retry window and preserves one field lease'),{skip:process.platform!=='win32'},async()=>{
 await mkdir('qa/v254',{recursive:true});const root=await mkdtemp(resolve('qa/v254/sharing-')),store=createSaveStore({directory:root}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.inventory.pickaxe=1;const doc=(await store.open('pixel',{legacyState:seed,protect:true})).document,current=join(root,'pixel/current.json'),before=await readFile(current),holder=await holdFile(root,current,persistent?3500:1200);
 const input={kind:'field',operation:'begin',field:'mine',itemId:'ore',actor:'npc',actorId:11,index:0,requestId:randomUUID(),expectedVersion:doc.version,expectedSequence:doc.actions.sequence,epoch:doc.actions.epoch};
 try{
  if(persistent){await assert.rejects(store.action('pixel',input),e=>['EPERM','EACCES','EBUSY'].includes(e.code));assert.deepEqual(await readFile(current),before);}
  else{const r=await store.action('pixel',input);assert.equal(r.ticket.actorId,11);assert.equal(r.ticket.sequence,doc.actions.sequence+1);const same=await store.action('pixel',input);assert(same.replayed);assert.equal(same.ticket.requestId,r.ticket.requestId);assert.equal((await store.current('pixel')).state.inventory.ore,0);const cancelled=await store.action('pixel',{kind:'field',operation:'cancel',requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version});assert.equal(cancelled.receipt.outcome,'cancelled');assert.deepEqual(cancelled.receipt.gain,{});}
 }finally{const[code]=await holder.exit;assert.equal(code,0,holder.errors());}
});
