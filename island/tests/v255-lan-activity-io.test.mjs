import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createLanIdentityStore} from '../server/lanIdentityStore.mjs';
import {createLanTenantServices} from '../server/lanTenantServices.mjs';
import {createLanActivityStore} from '../server/lanActivityStore.mjs';
import {fixture as fundedFixture} from './v58-lan-fixtures.mjs';

async function holder(directory,file,ms){
 const script=join(directory,'hold-owned-activity.ps1');await fsp.writeFile(script,"param([string]$Target,[int]$Millis)\n$f=[System.IO.File]::Open($Target,[System.IO.FileMode]::Open,[System.IO.FileAccess]::Read,[System.IO.FileShare]::ReadWrite)\ntry{[Console]::Out.WriteLine('ready');[Console]::Out.Flush();Start-Sleep -Milliseconds $Millis}finally{$f.Dispose()}\n");
 const child=spawn('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',script,'-Target',file,'-Millis',String(ms)],{windowsHide:true,stdio:['ignore','pipe','pipe']});let text='',errors='';child.stdout.on('data',v=>text+=v);child.stderr.on('data',v=>errors+=v);const closed=once(child,'exit');const until=Date.now()+10000;
 while(!text.includes('ready')){assert.equal(child.exitCode,null,errors);assert(Date.now()<until,'Own file holder did not become ready');await new Promise(r=>setTimeout(r,10));}
 return async()=>{const[code]=await closed;assert.equal(code,0,errors);};
}
async function zeroFixture(){
 await fsp.mkdir('qa/v255',{recursive:true});const directory=await fsp.mkdtemp(resolve('qa/v255/activities-')),identities=createLanIdentityStore({directory}),tenants=createLanTenantServices({directory,identities}),users=[];
 for(const theme of ['pixel','origami']){const a=await identities.register({login:'activity_'+theme,password:'fictional-password',name:'Fictional '+theme,islandName:'Fictional activity island',avatar:'male_0',theme});users.push({...a,theme});await tenants.open(a.token,theme,{});}
 const store=createLanActivityStore({directory,identities,tenants}),input={operation:'subscribe',hostId:users[0].view.me.id,subscribed:true,requestId:randomUUID()};
 await store.action(users[1].token,{...input,subscribed:false,requestId:randomUUID()});return{directory,users,store,input,other:()=>createLanActivityStore({directory,identities,tenants})};
}

for(const destination of ['activities.json','activities.previous.json'])test('real Windows temporary sharing of '+destination+' preserves one subscription request',{skip:process.platform!=='win32'},async()=>{
 const f=await zeroFixture(),file=join(f.directory,'_lan',destination),done=await holder(f.directory,file,1200);
 try{
  await f.store.action(f.users[1].token,f.input);const replay=await f.other().action(f.users[1].token,f.input);assert(replay.replayed);const doc=JSON.parse(await fsp.readFile(join(f.directory,'_lan/activities.json'),'utf8'));assert.equal(doc.requests.filter(r=>r.id===f.input.requestId).length,1);assert(doc.follows[f.users[1].view.me.id][f.users[0].view.me.id]);
 }finally{await done();}
});
test('persistent Windows activity publication failure retains canonical bytes and later replays once',{skip:process.platform!=='win32'},async()=>{
 const f=await zeroFixture(),file=join(f.directory,'_lan/activities.json'),before=await fsp.readFile(file),done=await holder(f.directory,file,3500);
 try{await assert.rejects(f.store.action(f.users[1].token,f.input),e=>['EPERM','EACCES','EBUSY'].includes(e.code));assert.deepEqual(await fsp.readFile(file),before);}finally{await done();}
 await f.other().action(f.users[1].token,f.input);assert((await f.other().action(f.users[1].token,f.input)).replayed);assert.equal(JSON.parse(await fsp.readFile(file,'utf8')).requests.filter(r=>r.id===f.input.requestId).length,1);
});
for(const code of ['EPERM','EACCES','EBUSY'])test('activity lock acquisition survives bounded transient Windows '+code,{skip:process.platform!=='win32'},async()=>{
 const f=await zeroFixture(),lock=join(f.directory,'_lan/activities.lock'),original=fs.promises.open;let calls=0;
 fs.promises.open=async(path,flags,mode)=>{if(resolve(String(path))===lock&&flags==='wx'&&++calls<=3)throw Object.assign(Error('Explicit transient activity-lock fixture'),{code});return original(path,flags,mode);};syncBuiltinESMExports();
 try{await f.store.action(f.users[1].token,f.input);assert.equal(calls,4);assert((await f.other().action(f.users[1].token,f.input)).replayed);assert(!await fsp.stat(lock).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}));}finally{fs.promises.open=original;syncBuiltinESMExports();}
});

for(const persistent of [false,true])test('funded settlement journal '+(persistent?'retains a paid step under persistent sharing and resumes once':'survives actual temporary Windows sharing after the original debit'),{skip:process.platform!=='win32'},async()=>{
 // Prepared stock/cash and fixed time are declared v58 accounting fixtures. This
 // verifies actual Windows I/O and one escrow debit, not zero-start progression.
 const f=await fundedFixture('pixel'),file=join(f.directory,'_lan/settlement-pending.json');let done;
 f.setFault('settlement',async(stage,detail)=>{if(stage==='settlement-step'&&detail.index===1&&!done)done=await holder(f.directory,file,persistent?3500:1200);});
 const input={operation:'publish',requestId:randomUUID(),roomId:f.room.id,title:'Fictional funded workshop',kind:'tea',brief:'Fictional fixed accounting fixture',invitees:[f.users[1].id],requirements:{items:[{item:'wood',quantity:2}],garment:null},prepareSeconds:60,difficulty:1,minQuality:70,economyMode:'funded',deliveryMode:'transfer'};
 try{
  if(persistent){await assert.rejects(f.store.action(f.users[0].token,input),e=>e.code==='lan_event_settlement_pending');assert.equal((await f.read(0)).state.coins,89);assert(await fsp.stat(file));}
  else{await f.store.action(f.users[0].token,input);assert.equal((await f.read(0)).state.coins,89);}
 }finally{await done?.();}
 const result=await f.other().action(f.users[0].token,input);assert(result.replayed);assert.equal((await f.read(0)).state.coins,89);assert.equal((await f.read(1)).state.coins,100);assert.equal(result.view.events.length,1);assert.equal(result.view.events[0].economy.status,'held');assert(!await fsp.stat(file).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}));
});
