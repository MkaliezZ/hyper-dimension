import {finishVisit} from './v72-recruitment-fixture.mjs';import {controlProject} from '../src/projectPlans.js';

import test from 'node:test';import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {fixture,meet} from './v74-travel-fixture.mjs';import {resolveTravelRecruitment,invitation,freezeTravelParty} from '../server/lanTravelParty.mjs';import {worldWalkableForTheme} from '../src/world.js';
for(const theme of ['pixel','origami'])test(theme+' recruited companion: trusted identity, obligations, capacity, real landing and social history, unchanged return contract',{timeout:90000},async()=>{
 const f=await fixture(theme);try{
 const {service,accounts,contract}=f,account=await service.identities.authorize(accounts[1].token),doc=await f.read(),trusted=await resolveTravelRecruitment(f.directory,account,doc);
 assert.equal(trusted.travelRecruit.id,contract.id);assert(invitation(account,trusted,16).accepted);
 for(const mutate of [s=>s.npcNeeds[16]={energy:20,hunger:76},s=>s.recruitment.active.phase='landing',s=>s.recruitment.active.leaveRequested='交接',s=>s.day=contract.expiresDay,s=>s.agentTaskLedger.find(t=>t.npcId===16).status='queued']){
 const d=structuredClone(trusted);mutate(d.state);assert(!invitation(account,d,16).accepted);}
 const forged=structuredClone(doc);forged.state.recruitment.active.profile.name='伪造名字';assert.equal((await resolveTravelRecruitment(f.directory,account,forged)).travelRecruit.profile.name,contract.profile.name);
 forged.state.recruitment.active.id='missing-contract';assert.equal((await resolveTravelRecruitment(f.directory,account,forged)).travelRecruit,null);
 const other=await service.identities.authorize(accounts[0].token);assert.equal((await resolveTravelRecruitment(f.directory,other,doc)).travelRecruit,null);
 await f.action(1,'travel_invite',{npcId:16});await f.action(1,'travel_invite',{npcId:0});await assert.rejects(f.action(1,'travel_invite',{npcId:1}),e=>e.code==='lan_travel_limit');await f.action(1,'travel_remove',{npcId:0});
 assert.throws(()=>freezeTravelParty(account,trusted,{homeWorldKey:doc.state.saveSlot,selected:[16],recruitedContractId:'previous-contract'},1),e=>e.code==='lan_travel_contract');
 const before=await f.read(),room=await f.action(0,'room_create',{title:'伙伴同行测试',maxPlayers:2}),join=await f.action(1,'room_join',{code:room.view.room.code});
 const guest=join.view.room.members.find(m=>m.id===account.id),person=guest.travel.members.find(p=>p.npcId===16);assert.equal(guest.travel.members.length,2);assert.equal(person.appearance,contract.profile.appearance);assert.equal(person.contractId,contract.id);
 assert.equal(guest.travel.members[0].kind,'hermes');await assert.rejects(f.action(1,'travel_remove',{npcId:16}),e=>e.code==='lan_travel_frozen');
 const event=await meet(f);assert(event.people.some(p=>p.actorId===person.actorId));assert.equal(f.calls.length,1);assert(f.calls[0].residents.some(p=>p.contractId===contract.id));
 const current=await service.identities.roomStateForServer(room.roomId),actor=current.members[account.id].companions.find(c=>c.person.npcId===16);assert(worldWalkableForTheme(theme,actor.x,actor.y));assert(actor.speech);
 const offer=await service.social.cooperate(accounts[1].token,{eventId:event.id,operation:'propose'});assert.equal(offer.event.cooperation.mode,'host_workshop');assert.equal(offer.event.cooperation.parts.find(p=>p.contract)?.contract.id,contract.id);await service.social.cooperate(accounts[1].token,{eventId:event.id,operation:'withdraw'});
 const history=await service.social.history(accounts[1].token,16,theme,contract.id);assert.equal(history.events[0].id,event.id);
 assert.equal((await service.social.history(accounts[0].token,16,theme,contract.id)).events.length,0);
 assert.equal((await service.social.history(accounts[1].token,16,theme,'different-contract')).events.length,0);
 assert((await service.social.contextForOwner(account.id,theme,doc.state.saveSlot))[16].length);
 const v=await service.identities.view(accounts[1].token);await f.action(1,'room_leave',{roomId:room.roomId,expectedRevision:v.room.revision});
 const after=await f.read();assert.deepEqual(after.state.recruitment,before.state.recruitment);assert.deepEqual(after.state.agentTaskLedger,before.state.agentTaskLedger);assert.equal(after.state.coins,before.state.coins);assert.equal(after.state.day,before.state.day);
 await f.update(s=>{assert(controlProject(s,'travel-plan','resume').ok);});
 const finish=await f.read(),ended=await finishVisit(f.store,finish,contract);assert.equal(ended.delivery.fee,8);assert.equal(finish.state.inventory.wood,6);assert.equal(finish.state.coins,before.state.coins-8);await f.update(s=>Object.assign(s,finish.state));
 assert.equal((await service.social.contextForOwner(account.id,theme,doc.state.saveSlot))[16],undefined);
 const p=(await service.identities.view(accounts[1].token)).travel;assert(p.staleRecruitSelection);
 await assert.rejects(f.action(1,'room_join',{code:room.view.room.code}),e=>e.code==='lan_travel_contract');await f.action(1,'travel_remove',{npcId:16});
 assert.equal((await service.social.history(accounts[1].token,16,theme,contract.id)).events.length,1);
 await writeFile('qa/v74/'+theme+'-travel-proof.json',JSON.stringify({passed:true,event,contract:contract.id,actualArrival:true,actualGuestWalk:true,unchangedWageAndTasks:true,resumedOriginalWork:true,deliveredWood:6,wagePaidOnce:8,modelCalls:f.calls.length,scope:'Isolated accounts; real registry, inbound runtime, travel paths and persistence; deterministic model output.'},null,2));
 }finally{await f.service.close();}
});

import {stepPerson} from '../server/lanRoomResidents.mjs';
for(const theme of ['pixel','origami'])test(theme+' meeting reroutes around a standing resident without overlap or teleport',()=>{
 let start;for(let y=240;y<750&&!start;y+=24)for(let x=400;x<1100&&!start;x+=24){let clear=true;for(let dy=0;dy<=48;dy+=4)for(let dx=0;dx<=80;dx+=4)if(!worldWalkableForTheme(theme,x+dx,y+dy))clear=false;if(clear)start={x,y};}
 assert(start);const target={x:start.x+64,y:start.y},c={...start,path:[target],meeting:{target}},blocker={x:start.x+32,y:start.y},room={theme};let reroutes=0;
 const route=(t,from,to,avoid)=>{reroutes++;assert(avoid.includes(blocker));return[{x:from.x,y:start.y+32},{x:target.x,y:start.y+32},target];};
 for(let i=0;i<200&&c.path.length;i++){const old={x:c.x,y:c.y};stepPerson(room,c,.05,route,[c,blocker]);assert(Math.hypot(c.x-old.x,c.y-old.y)<=3.101);assert(Math.hypot(c.x-blocker.x,c.y-blocker.y)>=15);}
 assert(reroutes>0);assert.equal(c.path.length,0);assert(Math.hypot(c.x-target.x,c.y-target.y)<.01);
});
