import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID,createHash} from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const {createLanIdentityStore}=await import(pathToFileURL(join(root,'server/lanIdentityStore.mjs')));
const {ISLAND_GEOGRAPHY}=await import(pathToFileURL(join(root,'src/islandGeography.js')));
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function fixture(theme='pixel'){
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-room-snapshot-')),store=createLanIdentityStore({directory});
 const owner=await store.register({login:'snapshot_owner',password:'fictional-password',name:'测试岛主',islandName:'快照测试岛',avatar:'female_1',theme});
 const writer=await store.register({login:'snapshot_writer',password:'fictional-password',name:'测试存档',islandName:'另一测试岛',avatar:'male_1',theme});
 const created=await store.action(owner.token,{operation:'room_create',requestId:randomUUID(),title:'只读快照会客',maxPlayers:4});
 return {directory,store,owner,writer,id:created.roomId,file:join(directory,'_lan/identity.json'),lock:join(directory,'_lan/identity.lock')};
}
for(const theme of ['origami','pixel']){
 test(theme+' committed room reads remain responsive during another home transaction and never release its lock',async()=>{
  const f=await fixture(theme);let release,held;
  try{
   let entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
   held=f.store.withHomeIsland(f.writer.view.me.id,theme,async()=>{entered();await gate;});await started;
   const before=await readFile(f.file),lock=await readFile(f.lock),at=performance.now();
   const reads=Promise.all(Array.from({length:8},()=>f.store.roomStateForServer(f.id)));
   // A blocked baseline is released by the assertion's finally; no abandoned mutation is queued.
   let timer;const rooms=await Promise.race([reads,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('committed read exceeded 1000ms')),1000))]).finally(()=>clearTimeout(timer));
   assert(performance.now()-at<1000);
   assert(rooms.every(r=>r.id===f.id&&r.owner===f.owner.view.me.id&&r.theme===theme));
   assert.deepEqual(await readFile(f.file),before);assert.deepEqual(await readFile(f.lock),lock);
   rooms[0].title='not a committed change';rooms[0].members[f.owner.view.me.id].x=-999;
   const again=await f.store.roomStateForServer(f.id);assert.equal(again.title,'只读快照会客');assert.notEqual(again.members[f.owner.view.me.id].x,-999);
  }finally{release?.();await held;}
  await f.store.action(f.owner.token,{operation:'room_close',roomId:f.id,expectedRevision:1,requestId:randomUUID()});
  await assert.rejects(f.store.roomStateForServer(f.id),e=>e.code==='lan_room_missing');
 });
 test(theme+' outdated geography is backed up and migrated through the original writer',async()=>{
  const f=await fixture(theme),d=JSON.parse(await readFile(f.file));d.rooms[f.id].geographyVersion='fictional-old-map';delete d.checksum;d.checksum=hash(d);
  const original=JSON.stringify(d,null,2)+'\n';await writeFile(f.file,original);
  const migrated=await f.store.roomStateForServer(f.id);assert.equal(migrated.geographyVersion,ISLAND_GEOGRAPHY.version);
  const after=JSON.parse(await readFile(f.file));assert.equal(after.revision,d.revision+1);assert.equal(after.checksum,hash({...after,checksum:undefined}));
  const folder=join(f.directory,'_lan/geography-backups'),files=await readdir(folder);assert.equal(files.length,1);assert.equal(await readFile(join(folder,files[0]),'utf8'),original);
 });
}
test('corrupt committed room bytes fail closed without changing the record or an existing lock',async()=>{
 const f=await fixture();await writeFile(f.file,'{corrupt');const owner=JSON.stringify({pid:process.pid,token:randomUUID()});await writeFile(f.lock,owner,{flag:'wx'});
 await assert.rejects(f.store.roomStateForServer(f.id),e=>e.code==='lan_corrupt');assert.equal(await readFile(f.file,'utf8'),'{corrupt');assert.equal(await readFile(f.lock,'utf8'),owner);
});
test('legacy migration still respects the original live writer timeout and does not return unmigrated coordinates',async()=>{
 const f=await fixture(),d=JSON.parse(await readFile(f.file));d.rooms[f.id].geographyVersion='fictional-old-map';delete d.checksum;d.checksum=hash(d);const original=JSON.stringify(d);await writeFile(f.file,original);
 const owner=JSON.stringify({pid:process.pid,token:randomUUID()});await writeFile(f.lock,owner,{flag:'wx'});const at=performance.now();
 await assert.rejects(f.store.roomStateForServer(f.id),e=>e.code==='lan_busy'&&e.status===503&&e.retryAfter===1);assert(performance.now()-at>=5000);
 assert.equal(await readFile(f.file,'utf8'),original);assert.equal(await readFile(f.lock,'utf8'),owner);
});
for(const theme of ['origami','pixel'])test(theme+' HTTP collaboration polls read a committed room while another island holds the identity writer',async()=>{
 const {createLanHttpServer}=await import(pathToFileURL(join(root,'server/lanServer.mjs')));
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-http-room-snapshot-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'FICTIONAL-ROOM-SNAPSHOT'});let release,held;
 try{
  const users=[];for(let n=0;n<2;n++){
   const user=await service.identities.register({login:'snapshot_http_'+n,password:'fictional-password',name:'测试岛主'+n,islandName:'HTTP测试岛'+n,avatar:n?'male_1':'female_1',theme});users.push(user);await service.tenants.open(user.token,theme);
  }
  const created=await service.identities.action(users[0].token,{operation:'room_create',requestId:randomUUID(),title:'HTTP快照会客',maxPlayers:4});
  let entered;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
  held=service.identities.withHomeIsland(users[1].view.me.id,theme,async()=>{entered();await gate;});await started;
  const file=join(directory,'_lan/identity.json'),lock=join(directory,'_lan/identity.lock'),before=await readFile(file),owner=await readFile(lock),base='http://127.0.0.1:'+service.port,at=performance.now();
  const responses=await Promise.all(Array.from({length:4},()=>fetch(base+'/api/lan/collaboration',{headers:{Cookie:'hd_lan_session='+users[0].token},signal:AbortSignal.timeout(2000)})));
  assert(responses.every(r=>r.status===200));const views=await Promise.all(responses.map(r=>r.json()));assert(views.every(v=>v.capabilities.includes('island.information')&&v.capabilities.includes('event.checkin')));assert(performance.now()-at<2000);
  assert.equal((await service.identities.roomStateForServer(created.roomId)).members[users[0].view.me.id].travel.members.find(v=>v.kind==='hermes').ownerAccountId,users[0].view.me.id);
  assert.deepEqual(await readFile(file),before);assert.deepEqual(await readFile(lock),owner);
  const unauthorized=await fetch(base+'/api/lan/collaboration',{signal:AbortSignal.timeout(2000)});assert.equal(unauthorized.status,401);
 }finally{release?.();await held;await service.close();}
});
