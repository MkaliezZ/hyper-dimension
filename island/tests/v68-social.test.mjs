import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {createLanHttpServer} from '../server/lanServer.mjs';import {worldWalkableForTheme} from '../src/world.js';
async function fixture(theme='pixel',gate=async()=>{}){
 await mkdir('qa/v68',{recursive:true});const directory=await mkdtemp(resolve('qa/v68/social-'));let now=Date.now(),service;const calls=[];
 const factory=()=>({documents:'fixture',async call(method,payload){if(method==='status')return {hermes:{configured:true}};assert.equal(method,'conversations');calls.push(payload);await gate();return {source:'deepseek',model:'deepseek-flash',ledgerRunId:'run-'+randomUUID(),type:'dispute',summary:'对布置方式有不同看法，愿意继续了解',lines:[{speaker:0,text:'我更看重实用，摆放时还要留出通道。'},{speaker:1,text:'我喜欢漂亮的陈列，但可以试试你的间距。'},{speaker:0,text:'刚才有些着急，我想先把顾虑讲清。'},{speaker:1,text:'我们还没完全一致，下次一起看实际效果。'}],changes:[{from:0,to:1,affinity:-2,trust:1,tension:6},{from:1,to:0,affinity:3,trust:2,tension:1}]};},async close(){}});
 const open=()=>createLanHttpServer({directory,port:0,enrollmentKey:'SOCIAL-FIXTURE-KEY',now:()=>now,agentRuntimeFactory:factory});service=await open();const accounts=[];
 for(let n=0;n<2;n++){const a=await service.identities.register({login:'social_'+n,password:'fixture-password',name:'相遇岛主'+n,islandName:'相遇小岛'+n,avatar:'male_'+n,theme});await service.tenants.open(a.token,theme,{});accounts.push(a);}
 const action=(n,operation,args={})=>service.identities.action(accounts[n].token,{operation,requestId:randomUUID(),...args});
 await action(1,'travel_invite',{npcId:0});const room=await action(0,'room_create',{title:'居民相遇测试',maxPlayers:2});await action(1,'room_join',{code:room.view.room.code});
 return {get service(){return service},accounts,calls,directory,roomId:room.roomId,action,async restart(){await service.close();service=await open()},async step(ms=1000){now+=ms;await service.identities.view(accounts[0].token);await service.identities.view(accounts[1].token)},advance(ms){now+=ms}};
}
async function meet(f){for(let i=0;i<170;i++){await f.step();await f.service.social.tick(f.accounts[0].token);const v=await f.service.social.view(f.accounts[0].token);if(v.task?.status==='thinking'||v.events.length)return v;await new Promise(r=>setTimeout(r,1));}throw Error('meeting did not arrive: '+JSON.stringify(await f.service.social.view(f.accounts[0].token)));}
async function complete(f){await meet(f);for(let i=0;i<100;i++){const v=await f.service.social.view(f.accounts[0].token);if(v.events.length)return v.events[0];await new Promise(r=>setTimeout(r,10));}throw Error('dialogue not completed');}
for(const theme of ['pixel','origami'])test(theme+' residents walk to separate seats, create asymmetric shared memories, persist after return and restart',{timeout:90000},async()=>{
 const f=await fixture(theme);try{
 const before=await f.service.identities.view(f.accounts[0].token);assert.equal(before.room.residents.length,15);assert.equal(new Set(before.room.residents.map(c=>c.actorId)).size,15);
 await f.service.social.tick(f.accounts[0].token);assert.equal(f.calls.length,0,'no model conversation before arrival');
 const event=await complete(f);assert.equal(f.calls.length,1);assert.equal(event.people.length,2);assert.notEqual(event.people[0].ownerAccountId,event.people[1].ownerAccountId);assert.notEqual(event.changes[0].affinity,event.changes[1].affinity);
 const room=await f.service.identities.roomStateForServer(f.roomId),people=[...room.residents,...Object.values(room.members).flatMap(m=>m.companions)].filter(c=>event.people.some(p=>p.actorId===c.person.actorId));
 assert.equal(people.length,2);assert(Math.hypot(people[0].x-people[1].x,people[0].y-people[1].y)>=25);for(const c of people)assert(worldWalkableForTheme(theme,c.x,c.y));assert(people.every(c=>c.speech.lines.length===4));
 await Promise.all(Array.from({length:8},()=>f.service.social.tick(f.accounts[0].token)));assert.equal(f.calls.length,1);
 const guest=await f.service.identities.view(f.accounts[1].token);await f.action(1,'room_leave',{roomId:f.roomId,expectedRevision:guest.room.revision});
 for(let n=0;n<2;n++){const p=event.people.find(p=>p.ownerAccountId===f.accounts[n].view.me.id);const history=await f.service.social.history(f.accounts[n].token,p.npcId,theme);assert.equal(history.events.length,1);assert.equal(history.events[0].id,event.id);}
 await f.restart();const p=event.people.find(p=>p.ownerAccountId===f.accounts[1].view.me.id);assert.equal((await f.service.social.history(f.accounts[1].token,p.npcId,theme)).events[0].id,event.id);
 assert.deepEqual(f.calls[0].residents.map(r=>r.id),[0,1]);assert.equal(f.calls[0].history.length,0);
 await writeFile('qa/v68/'+theme+'-social-proof.json',JSON.stringify({directory:f.directory,event,modelCalls:f.calls.length,actualSeparateWalkableSeats:people.map(c=>({x:c.x,y:c.y})),scope:'Synthetic owners, real room movement and persistence, deterministic model'},null,2));
 }finally{await f.service.close()}
});
test('leaving while the model responds does not invent an encounter or apply relationship changes',{timeout:90000},async()=>{
 let release;const gate=new Promise(r=>release=r);const f=await fixture('pixel',()=>gate);
 try{await meet(f);for(let n=0;n<100&&!f.calls.length;n++)await new Promise(r=>setTimeout(r,10));assert.equal(f.calls.length,1);const v=await f.service.identities.view(f.accounts[1].token);await f.action(1,'room_leave',{roomId:f.roomId,expectedRevision:v.room.revision});release();await new Promise(r=>setTimeout(r,50));const view=await f.service.social.view(f.accounts[0].token);assert.equal(view.events.length,0);assert.equal(view.task.status,'cancelled');assert.equal((await f.service.social.history(f.accounts[1].token,0)).events.length,0);}
 finally{release();await f.service.close()}
});

test('a transient home read failure leaves an arrived meeting retryable without charging a model call',{timeout:90000},async()=>{
 const f=await fixture('pixel');const read=f.service.tenants.readIslandForServer;let injected=false;
 try{
  await f.service.social.tick(f.accounts[0].token);const t=(await f.service.social.view(f.accounts[0].token)).task;
  for(let n=0;n<170;n++){await f.step();if(await f.service.identities.socialMeetingReady(f.roomId,t.people.map(p=>p.actorId),t.id))break;}
  assert(await f.service.identities.socialMeetingReady(f.roomId,t.people.map(p=>p.actorId),t.id));
  let reads=0;f.service.tenants.readIslandForServer=async(...args)=>{if(++reads===2){injected=true;throw Object.assign(Error('isolated temporary home read'),{code:'fixture_read'});}return read(...args)};
  await assert.rejects(f.service.social.tick(f.accounts[0].token),e=>e.code==='fixture_read');
  assert(injected);assert.equal(f.calls.length,0);assert.equal((await f.service.social.view(f.accounts[0].token)).task.status,'approaching');
  f.service.tenants.readIslandForServer=read;
  const event=await complete(f);assert(event.ledgerRunId);assert.equal(f.calls.length,1);
 }finally{f.service.tenants.readIslandForServer=read;await f.service.close()}
});
