import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';import {worldWalkableForTheme,HARBOR_LAYOUTS} from '../src/world.js';
async function fixture(theme){let now=1800000000000;const directory=await mkdtemp(resolve('qa/v60/travel-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'TRAVEL-FIXTURE',now:()=>now}),accounts=[];
for(let i=0;i<4;i++){const a=await service.identities.register({login:'travel_'+i,password:'fixture-password',name:'同行岛主'+i,islandName:'同行小岛'+i,theme,avatar:'male_'+i});accounts.push(a);await service.tenants.open(a.token,theme,{});}
const call=(i,operation,args={})=>service.identities.action(accounts[i].token,{operation,requestId:randomUUID(),...args});
const update=async(i,fn)=>{const c=await service.tenants.get(accounts[i].token),d=await c.saves.current(theme),s=structuredClone(d.state);fn(s);await c.saves.save(theme,{state:s,expectedVersion:d.version});};
return{service,accounts,call,update,step:ms=>now+=ms,directory};}
for(const theme of ['pixel','origami']){
test(theme+' invitations use owner save, unmet needs and obligations; retries, two-resident cap and frozen parties survive reconnect',async()=>{const f=await fixture(theme);try{
await f.update(1,s=>{s.npcNeeds[0]={energy:20,hunger:76};s.npcProfiles[15]={name:'私人的管家'};s.butlerAvatar='female_3';s.npcMemory[0]=[{text:'PRIVATE MEMORY MUST NOT BE BROADCAST'}];});
await assert.rejects(f.call(1,'travel_invite',{npcId:0}),e=>e.code==='lan_travel_consent');
await f.update(1,s=>s.npcNeeds[0].energy=70);
const request={operation:'travel_invite',npcId:0,requestId:randomUUID()};
await f.service.identities.action(f.accounts[1].token,request);assert((await f.service.identities.action(f.accounts[1].token,request)).replayed);
await assert.rejects(f.service.identities.action(f.accounts[1].token,{...request,npcId:1}),e=>e.code==='lan_id_conflict');
await f.call(1,'travel_invite',{npcId:1});await assert.rejects(f.call(1,'travel_invite',{npcId:2}),e=>e.code==='lan_travel_limit');
await assert.rejects(f.call(1,'travel_remove',{npcId:15}),e=>e.code==='lan_travel_invalid');
const r=await f.call(0,'room_create',{title:'同行会客房',maxPlayers:4});
await f.update(1,s=>s.npcNeeds[0].energy=20);
await assert.rejects(f.call(1,'room_join',{code:r.view.room.code}),e=>e.code==='lan_travel_consent');
assert.equal((await f.service.identities.view(f.accounts[0].token)).room.members.length,1);
await f.update(1,s=>s.npcNeeds[0].energy=70);
const join={operation:'room_join',code:r.view.room.code,requestId:randomUUID()},joined=await f.service.identities.action(f.accounts[1].token,join);
const guest=joined.view.room.members.find(m=>m.id===f.accounts[1].view.me.id);
assert.equal(guest.travel.members.length,3);assert.equal(guest.travel.members[0].name,'私人的管家');assert.equal(guest.travel.members[0].appearance,'female_3');
assert.equal(guest.position.x,HARBOR_LAYOUTS[theme].boarding.x);
assert((await f.service.identities.action(f.accounts[1].token,join)).replayed);
await assert.rejects(f.call(1,'travel_remove',{npcId:0}),e=>e.code==='lan_travel_frozen');
assert(!JSON.stringify((await f.service.identities.view(f.accounts[0].token)).room).includes('PRIVATE MEMORY'));
const oldIds=guest.travel.members.map(x=>x.actorId);await f.service.identities.logout(f.accounts[1].token);const session=await f.service.identities.login({login:'travel_1',password:'fixture-password'});f.accounts[1].token=session.token;assert.deepEqual(session.view.room.members.find(m=>m.id===guest.id).travel.members.map(x=>x.actorId),oldIds);
const v=await f.service.identities.view(session.token);await f.call(1,'room_leave',{roomId:v.room.id,expectedRevision:v.room.revision});await f.call(1,'travel_remove',{npcId:0});
assert.equal((await f.service.identities.view(f.accounts[0].token)).room.members.length,1);
}finally{await f.service.close();}});
test(theme+' four teams have unique source identities, separate walkable positions, bounded movement and companion progress',async()=>{const f=await fixture(theme);try{
for(let i=0;i<4;i++){await f.call(i,'travel_invite',{npcId:0});await f.call(i,'travel_invite',{npcId:1});}
const room=await f.call(0,'room_create',{title:'四支队伍同游',maxPlayers:4});for(let i=1;i<4;i++)await f.call(i,'room_join',{code:room.view.room.code});
let view=await f.service.identities.view(f.accounts[0].token);const people=()=>view.room.members.flatMap(m=>m.companions),initial=new Map(people().map(c=>[c.actorId,{...c.position}]));assert.equal(initial.size,12);assert.equal(new Set(view.room.members.flatMap(m=>m.travel.members.map(c=>c.actorId))).size,12);
let previous=new Map(initial);
for(let t=0;t<90;t++){f.step(1000);for(let i=0;i<4;i++)view=await f.service.identities.view(f.accounts[i].token);for(const c of people()){assert(worldWalkableForTheme(theme,c.position.x,c.position.y));const p=previous.get(c.actorId);assert(Math.hypot(c.position.x-p.x,c.position.y-p.y)<=72.1);previous.set(c.actorId,{...c.position});}}
const guests=people().filter(c=>c.ownerAccountId!==f.accounts[0].view.me.id);for(const c of guests){const p=initial.get(c.actorId);assert(Math.hypot(c.position.x-p.x,c.position.y-p.y)>20,c.name+' did not progress');}
const snapshot=people().map(c=>[c.actorId,c.position.x,c.position.y]);f.step(90000);view=await f.service.identities.view(f.accounts[0].token);assert.deepEqual(people().map(c=>[c.actorId,c.position.x,c.position.y]),snapshot);
}finally{await f.service.close();}});
}
