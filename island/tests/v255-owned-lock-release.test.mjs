import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import * as atomic from '../server/atomicJson.mjs';
import {createLanIdentityStore} from '../server/lanIdentityStore.mjs';
import {createLanTenantServices} from '../server/lanTenantServices.mjs';
import {createLanActivityStore} from '../server/lanActivityStore.mjs';

async function hold(directory,file,ms){
 const script=join(directory,'hold-owned-lock.ps1');await fsp.writeFile(script,"param([string]$Target,[int]$Millis)\n$f=[System.IO.File]::Open($Target,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::ReadWrite)\ntry{[Console]::Out.WriteLine('ready');[Console]::Out.Flush();Start-Sleep -Milliseconds $Millis}finally{$f.Dispose()}\n");
 const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',script,'-Target',file,'-Millis',String(ms)],{windowsHide:true,stdio:['ignore','pipe','pipe']});let text='',error='';child.stdout.on('data',v=>text+=v);child.stderr.on('data',v=>error+=v);const exit=once(child,'exit'),until=Date.now()+10000;
 while(!text.includes('ready')){assert.equal(child.exitCode,null,error);assert(Date.now()<until);await new Promise(r=>setTimeout(r,10));}return async()=>{const[code]=await exit;assert.equal(code,0,error);};
}
async function scenario(kind){
 await fsp.mkdir('qa/v255',{recursive:true});const directory=await fsp.mkdtemp(resolve('qa/v255/release-')),identities=createLanIdentityStore({directory}),tenants=createLanTenantServices({directory,identities}),users=[];
 for(const theme of ['pixel','origami']){const u=await identities.register({login:'release_'+theme,password:'fictional-password',name:'Fictional '+theme,islandName:'Fictional release island',avatar:'male_0',theme});users.push(u);}
 if(kind==='identity'){const input={operation:'room_create',title:'Fictional lock release',maxPlayers:2,requestId:randomUUID()};return{directory,lock:join(directory,'_lan/identity.lock'),call:()=>identities.action(users[0].token,input)};}
 if(kind==='activity'){const store=createLanActivityStore({directory,identities,tenants});await store.view(users[1].token);const input={operation:'subscribe',hostId:users[0].view.me.id,subscribed:true,requestId:randomUUID()};return{directory,lock:join(directory,'_lan/activities.lock'),call:()=>store.action(users[1].token,input)};}
 await tenants.open(users[0].token,'pixel',{});const tenant=await tenants.get(users[0].token),doc=await tenant.saves.current('pixel'),input={kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood'},requestId:randomUUID(),expectedVersion:doc.version,epoch:doc.actions.epoch,expectedSequence:doc.actions.sequence};
 return{directory,lock:join(tenant.directory,'pixel/write.lock'),call:()=>tenant.saves.action('pixel',input)};
}

for(const kind of ['game','identity','activity'])for(const persistent of [false,true])test(kind+' own lock '+(persistent?'can be released on the next request after a bounded failed cleanup':'waits for actual Windows sharing to clear without orphaning ownership'),{skip:process.platform!=='win32'},async()=>{
 const f=await scenario(kind),original=fs.promises.unlink;let done,triggered=false;
 fs.promises.unlink=async path=>{if(resolve(String(path))===resolve(f.lock)&&!triggered){triggered=true;done=await hold(f.directory,f.lock,persistent?3500:1200);}return original(path);};syncBuiltinESMExports();
 try{
  await f.call();assert(triggered);await done();
  if(!persistent)assert(!await fsp.stat(f.lock).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}),'A successful command must not strand its completed lock');
  assert((await f.call()).replayed,'The next identical request must recover the original receipt, not remain busy');assert(!await fsp.stat(f.lock).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}));
 }finally{await done?.();fs.promises.unlink=original;syncBuiltinESMExports();}
});

test('cleanup rereads ownership on retry and a deferred cleanup never removes a replacement or foreign owner',async()=>{
 assert.equal(typeof atomic.releaseOwnedLock,'function');await fsp.mkdir('qa/v255',{recursive:true});const root=await fsp.mkdtemp(resolve('qa/v255/ownership-')),file=join(root,'owned.lock'),a={pid:process.pid,token:'original-owned-lock'},b={pid:process.pid,token:'new-active-owner'};
 await fsp.writeFile(file,JSON.stringify(a));let removes=0;
 const changed=await atomic.releaseOwnedLock(file,a.token,{platform:'win32',wait:async()=>{},remove:async()=>{removes++;await fsp.writeFile(file,JSON.stringify(b));throw Object.assign(Error('Original owner changed during sharing retry'),{code:'EBUSY'});}});assert.equal(changed,false);assert.equal(removes,1);assert.deepEqual(JSON.parse(await fsp.readFile(file,'utf8')),b);
 await fsp.writeFile(file,JSON.stringify(a));await assert.rejects(atomic.releaseOwnedLock(file,a.token,{platform:'win32',wait:async()=>{},remove:async()=>{throw Object.assign(Error('Persistent explicit cleanup fixture'),{code:'EPERM'});}}),e=>e.code==='EPERM');
 await fsp.writeFile(file,JSON.stringify(b));await assert.rejects(atomic.openExclusiveFile(file),e=>e.code==='EEXIST');assert.deepEqual(JSON.parse(await fsp.readFile(file,'utf8')),b);assert(await atomic.releaseOwnedLock(file,b.token));
 const foreign={pid:process.pid+1,token:a.token};await fsp.writeFile(file,JSON.stringify(foreign));assert.equal(await atomic.releaseOwnedLock(file,a.token),false);assert.deepEqual(JSON.parse(await fsp.readFile(file,'utf8')),foreign);
});
