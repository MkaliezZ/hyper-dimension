import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createLanIdentityStore} from '../server/lanIdentityStore.mjs';

for(const offset of [60000,-60000])test('a '+(offset>0?'forward':'backward')+' wall-clock correction keeps the real five-second writer wait and another writer intact',async t=>{
 const directory=await mkdtemp(join(await realpath(tmpdir()),'hd-monotonic-writer-')),store=createLanIdentityStore({directory});
 const owner=await store.register({login:'monotonic_owner',password:'fictional-password',name:'测试岛主',islandName:'单调时钟测试岛',avatar:'female_1',theme:'pixel'});
 const created=await store.action(owner.token,{operation:'room_create',requestId:randomUUID(),title:'时钟校准测试',maxPlayers:4});
 const file=join(directory,'_lan/identity.json'),lock=join(directory,'_lan/identity.lock'),document=JSON.parse(await readFile(file));
 document.rooms[created.roomId].geographyVersion='fictional-old-map';delete document.checksum;document.checksum=createHash('sha256').update(JSON.stringify(document)).digest('hex');
 const original=JSON.stringify(document);await writeFile(file,original);const lockedBy=JSON.stringify({pid:process.pid,token:randomUUID()});await writeFile(lock,lockedBy,{flag:'wx'});
 const realNow=Date.now,realKill=process.kill;let correction=0,observedWriter=false;t.mock.method(Date,'now',()=>realNow()+correction);
 t.mock.method(process,'kill',(pid,signal)=>{const result=realKill(pid,signal);if(pid===process.pid&&signal===0&&!observedWriter){observedWriter=true;correction=offset;}return result;});
 const at=performance.now(),operation=store.roomStateForServer(created.roomId);operation.catch(()=>{});
 let deadline;
 try{
  await Promise.race([assert.rejects(operation,error=>error.code==='lan_busy'&&error.status===503&&error.retryAfter===1),new Promise((_,reject)=>deadline=setTimeout(()=>reject(Error('The original five-second writer did not time out within its unchanged bounded observation')),6500))]);
  assert(performance.now()-at>=5000,'A wall-clock correction must not shorten the original wait');
  assert(observedWriter,'Correction must occur after the real live-writer probe');
  assert.equal(await readFile(file,'utf8'),original);assert.equal(await readFile(lock,'utf8'),lockedBy);
 }finally{clearTimeout(deadline);correction=0;t.mock.restoreAll();await operation.catch(()=>{});}
});
