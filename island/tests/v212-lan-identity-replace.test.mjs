import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {syncBuiltinESMExports} from 'node:module';
import {randomUUID,createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createLanIdentityStore} from '../server/lanIdentityStore.mjs';

async function fixture(){
 const directory=await fs.mkdtemp(join(tmpdir(),'hd-v212-identity-'));
 const store=createLanIdentityStore({directory});
 const account=await store.register({login:'identity_fixture',password:'fictional-password-only',name:'档案测试岛主',islandName:'独立测试岛',avatar:'male_0',theme:'origami'});
 const file=join(directory,'_lan','identity.json'),previous=join(directory,'_lan','identity.previous.json');
 const before=await fs.readFile(file,'utf8');
 const command={operation:'room_create',title:'独立会客测试',maxPlayers:2,requestId:randomUUID()};
 return {directory,store,account,file,previous,before,command};
}
async function withRenameFault(destination,count,code,work){
 const original=fs.rename,calls=[],failure=Object.assign(Error('controlled occupied identity file'),{code,syscall:'rename'});
 fs.rename=async(from,to)=>{
  if(resolve(to)===resolve(destination)){
   calls.push({from,to});
   if(calls.length<=count)throw failure;
  }
  return original(from,to);
 };
 syncBuiltinESMExports();
 try{return await work({calls,failure});}
 finally{fs.rename=original;syncBuiltinESMExports();}
}
async function noTemporaryFiles(f){assert(!(await fs.readdir(join(f.directory,'_lan'))).some(name=>name.endsWith('.tmp')));}

for(const target of ['file','previous'])test('Windows room creation survives one occupied '+target+' publication and replays one receipt',{skip:process.platform!=='win32'},async()=>{
 const f=await fixture();let created;
 await withRenameFault(f[target],1,'EPERM',async({calls})=>{
  created=await f.store.action(f.account.token,f.command);
  assert.equal(calls.length,2);
  assert(calls.every(c=>c.from===calls[0].from&&c.to===calls[0].to));
 });
 const committed=await fs.readFile(f.file,'utf8'),document=JSON.parse(committed);
 assert.equal(Object.keys(document.rooms).length,1);
 assert.equal(document.rooms[created.roomId].owner,created.view.me.id);
 assert.equal(document.requests.filter(r=>r.id===f.command.requestId).length,1);
 assert.equal(document.events.filter(e=>e.type==='room_create').length,1);
 assert.equal(document.checksum,createHash('sha256').update(JSON.stringify({...document,checksum:undefined})).digest('hex'));
 assert.deepEqual(JSON.parse(await fs.readFile(f.previous,'utf8')),JSON.parse(f.before));
 const replay=await createLanIdentityStore({directory:f.directory}).action(f.account.token,f.command);
 assert.equal(replay.replayed,true);assert.equal(replay.roomId,created.roomId);
 assert.equal(await fs.readFile(f.file,'utf8'),committed);
 await noTemporaryFiles(f);
});

for(const code of ['EPERM','ENOSPC'])test('failed '+code+' room publication retains the committed island identity and reports the error',async()=>{
 const f=await fixture();
 await withRenameFault(f.file,Infinity,code,async({calls,failure})=>{
  await assert.rejects(f.store.action(f.account.token,f.command),e=>e===failure);
  assert.equal(calls.length,code==='EPERM'&&process.platform==='win32'?11:1);
 });
 assert.equal(await fs.readFile(f.file,'utf8'),f.before);
 assert.deepEqual(JSON.parse(await fs.readFile(f.previous,'utf8')),JSON.parse(f.before));
 await noTemporaryFiles(f);
 const retry=await createLanIdentityStore({directory:f.directory}).action(f.account.token,f.command);
 assert.equal(retry.replayed,false);
 const document=JSON.parse(await fs.readFile(f.file,'utf8'));
 assert.equal(Object.keys(document.rooms).length,1);
 assert.equal(document.requests.filter(r=>r.id===f.command.requestId).length,1);
});
