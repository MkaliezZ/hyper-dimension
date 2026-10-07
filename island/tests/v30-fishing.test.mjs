import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,setWorldTheme,RESIDENTS,worldWalkable} from '../src/world.js';
import {hydrateTown,purposeOptions} from '../src/townSimulation.js';
import {availableQuantity,validResourceLedger,reserveResources,commitResources} from '../src/resourceLedger.js';
import {createFishingMatch,startFishingRound,fishingAction,tickFishing,fishingScore} from '../src/fishingRules.js';
import {createFishingEvent,inviteFishingNpc,startFishingParty,fishingCheckin,finishFishingParty,abandonFishingParty,archiveFishingParty,displayFishingWonder,validFishingParty,FISHING_INVITES,createFishingPlan,cancelFishingDraft} from '../src/fishingParty.js';
import {createFishingPartyRuntime,fishingSpots} from '../src/fishingPartyRuntime.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {validateState} from '../server/saveStore.mjs';
import {canHostParty} from '../src/economy.js';
import {hydrateJourney,trackJourney} from '../src/journey.js';
function setup(seed=14){
 const s=hydrateTown(createState());for(const id of Object.keys(s.inventory))s.inventory[id]=0;s.coins=100;
 Object.assign(s.inventory,{rod:1,c8_2:1,c16_4:1,c16_2:1,bread:3});
 assert(createFishingEvent(s,{seed}).ok);
 return s;
}
function launch(s){
 for(const n of FISHING_INVITES)assert(inviteFishingNpc(s,n.id,{version:1}).ok);
 const r=startFishingParty(s);assert(r.ok,r.reason);
 for(const id of [8,2,-1])fishingCheckin(s,id);
 return s.fishingParty.session;
}
function play(m,{reel=true,reload=false}={}){
 let clone=m,snapshot=false;
 for(let i=0;i<30000&&clone.phase!=='results';i++){
  if(['ready','round_result'].includes(clone.phase))startFishingRound(clone);
  const c=clone.current,l=clone.rounds[clone.index];
  if(c.mode==='aim')fishingAction(clone,{type:'down',x:l.spot.x-l.wind,y:l.spot.y});
  else if(c.mode==='bite'&&c.modeT>=(clone.difficulty==='easy'?1:.6))fishingAction(clone,{type:'down'});
  else if(c.mode==='fight'){
   fishingAction(clone,{type:'point',...c.fish});
   fishingAction(clone,{type:reel&&!c.surge&&c.tension<.73?'down':'up'});
   if(reload&&!snapshot&&c.progress>.25){clone=JSON.parse(JSON.stringify(clone));snapshot=true;}
  }
  tickFishing(clone,1/60);
 }
 assert.equal(clone.phase,'results');return clone;
}
test('six actual cast/hook/tension rounds are beatable, seeded and reloadable',()=>{
 for(const difficulty of ['normal','easy'])for(let seed=1;seed<=20;seed++){
  const baseline=play(createFishingMatch(seed,difficulty)),restored=play(createFishingMatch(seed,difficulty),{reload:true});
  assert.deepEqual(baseline.results,restored.results);
  assert.equal(baseline.results.length,6);assert.equal(baseline.results.filter(r=>r.caught).length,6,'seed '+seed+' '+difficulty);
  assert(baseline.elapsed<165);assert(fishingScore(baseline).raw<=26);assert(baseline.results.some(r=>r.combo));
 }
});
test('mistakes matter and rivals never adjust scores to the player',()=>{
 const win=play(createFishingMatch(62)),lose=play(createFishingMatch(62),{reel:false});
 assert.equal(lose.results.filter(r=>r.caught).length,0);assert.equal(fishingScore(lose).raw,0);
 assert.deepEqual(win.standing.slice(1),lose.standing.slice(1));
 const m=createFishingMatch(5);startFishingRound(m);const p=m.rounds[0].spot;
 fishingAction(m,{type:'down',x:p.x-m.rounds[0].wind,y:p.y});for(let i=0;i<50;i++)tickFishing(m,1/60);
 assert.equal(m.current.mode,'waiting');fishingAction(m,{type:'down'});assert.equal(m.current.mode,'lost');assert.match(m.results[0].reason,/太早/);
});
test('actual invitations, reserved equipment, one entry and one reward survive saves',()=>{
 const s=setup(),d=s.fishingParty.draft;
 assert.equal(startFishingParty(s).ok,false);
 assert.equal(inviteFishingNpc(s,8,{version:2}).ok,false);
 assert(inviteFishingNpc(s,8,{version:1}).ok);assert(inviteFishingNpc(s,8,{version:1}).replayed);assert.equal(s.inventory.c16_2,0);
 assert(inviteFishingNpc(s,2,{version:1}).ok);assert.equal(s.inventory.bread,2);
 assert(startFishingParty(s).ok);assert.equal(s.coins,90);assert.equal(s.inventory.bread,0);assert.equal(s.inventory.c16_4,0);
 assert.equal(availableQuantity(s,'rod'),0);assert.equal(s.inventory.rod,1);assert.equal(canHostParty(s),false);
 assert.equal(finishFishingParty(s).ok,false);fishingCheckin(s,8);fishingCheckin(s,2);assert.equal(s.fishingParty.session.phase,'checkin');fishingCheckin(s,-1);
 s.fishingParty.session.match=play(s.fishingParty.session.match,{reload:true});validateState(s);
 const result=finishFishingParty(s);assert(result.ok);const after=s.coins;
 assert(finishFishingParty(s).replayed);assert.equal(s.coins,after);assert.equal(availableQuantity(s,'rod'),1);assert.equal(s.activities,1);
 assert.equal(s.inventory.fish,0,'competition fish must not enter inventory');assert.equal(s.npcAffinity[8],24);assert.equal(s.eventWonders.owned.seashell_cup.eventId,d.id);
 assert(displayFishingWonder(s));assert.equal(s.eventWonders.displayed,'seashell_cup');assert(validResourceLedger(s));assert(validFishingParty(s));
 assert(archiveFishingParty(s));assert(createFishingEvent(s,{seed:15}).ok);assert.equal(startFishingParty(s).ok,false,'one shared party per day');
});
test('abandonment releases equipment without refunding consumed supplies or awarding coins',()=>{
 const s=setup();const g=launch(s);startFishingRound(g.match);tickFishing(g.match,.2);
 assert(abandonFishingParty(s));assert.equal(s.coins,90);assert.equal(s.inventory.c16_4,0);assert.equal(availableQuantity(s,'rod'),1);
 assert.equal(finishFishingParty(s).ok,false);assert.equal(s.activities,0);assert(!s.eventWonders);assert(archiveFishingParty(s));assert(validFishingParty(s));
});
test('readiness respects other reservations, project release feeds invitations and event booking',()=>{
 const s=setup();assert(reserveResources(s,'other-plan',{c16_2:1}).ok);
 assert.equal(inviteFishingNpc(s,8,{version:1}).ok,false);
 const t=setup();assert(createFishingPlan(t).ok);assert(inviteFishingNpc(t,8,{version:1}).ok);assert.equal(t.workProjects[0].status,'completed');
 assert(inviteFishingNpc(t,2,{version:1}).ok);assert(startFishingParty(t).ok);
});
test('tampered route and match records are rejected before restoring',()=>{
 const s=setup();launch(s);
 for(const edit of [g=>g.match.index=7,g=>g.match.rounds=[],g=>g.match.standing[0].score=999,g=>g.participants[0].position={x:NaN,y:0},g=>g.paid=999,g=>g.participants[1].id=8,g=>g.playerArrived=false]){
  const bad=structuredClone(s);edit(bad.fishingParty.session);assert(!validFishingParty(bad));assert.throws(()=>validateState(bad));
 }
});
for(const theme of ['pixel','origami'])test(theme+': participants actually walk to separate coastal stations and resume after reload',async()=>{
 setWorldTheme(theme);const s=setup();for(const n of FISHING_INVITES)inviteFishingNpc(s,n.id,{version:1});assert(startFishingParty(s).ok);
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated mechanics"}',{status:503});
 try{
  const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0})),resident=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  for(const n of npcs)n.manualUntil=1e6;
  const runtime=createFishingPartyRuntime({state:()=>s,npcs,followPath,resident:()=>resident,onChange:()=>{}});let time=0;
  for(let i=0;i<1800&&!s.fishingParty.session.participants.every(p=>p.arrived);i++){time+=.1;runtime.update(.1);resident.update(.1,time);if(i===400){resident.reset();runtime.reset();for(const n of npcs)n.manualUntil=1e6}}
  assert(s.fishingParty.session.participants.every(p=>p.arrived),JSON.stringify(s.fishingParty.session.participants));
  assert(Math.hypot(npcs[8].x-npcs[2].x,npcs[8].y-npcs[2].y)>30);
  for(const p of fishingSpots())assert(worldWalkable(p.x,p.y),JSON.stringify(p));
  fishingCheckin(s,-1);assert.equal(s.fishingParty.session.phase,'running');abandonFishingParty(s);runtime.update(.1);assert(!npcs[8].partyControlled);assert(!npcs[2].partyControlled);
 }finally{globalThis.fetch=oldFetch}
});

test('completed preparation can replenish consumed supplies without losing previous project history',()=>{
 const s=setup();const first=createFishingPlan(s);assert(first.ok);assert(inviteFishingNpc(s,8,{version:1}).ok);
 assert.equal(first.project.status,'completed');
 assert(commitResources(s,{cost:{c16_4:1},category:'test',note:'supplies used elsewhere'}).ok);
 const again=createFishingPlan(s);assert(again.ok,again.reason);assert.notEqual(again.project.id,first.project.id);
 assert.deepEqual(s.fishingParty.draft.projectIds,[first.project.id,again.project.id]);
 assert.equal(again.project.targets.c16_2,undefined,'already-delivered invitation must not be prepared twice');
 assert.equal(createFishingPlan(s).project.id,again.project.id);
 assert.equal(s.npcMemory[8].filter(m=>m.eventId===s.fishingParty.draft.id).length,1);
 assert(inviteFishingNpc(s,8,{version:1}).replayed);assert.equal(s.npcMemory[8].length,1);
 assert(cancelFishingDraft(s));assert.equal(again.project.status,'cancelled');assert.equal(first.project.status,'completed');assert(validResourceLedger(s));
});
test('new-day parties use new tides, preserve display, and add one non-cash memento',()=>{
 const s=setup();let g=launch(s);g.match=play(g.match);assert(finishFishingParty(s).ok);displayFishingWonder(s);const first=s.eventWonders.owned.seashell_cup.eventId,coins=s.coins;archiveFishingParty(s);
 s.day++;Object.assign(s.inventory,{c16_4:1,c16_2:1,bread:3});
 assert(createFishingEvent(s,{seed:987}).ok);g=launch(s);g.match=play(g.match,{reel:false});const r=finishFishingParty(s);assert(r.ok);assert.equal(r.reward,30);
 assert.equal(s.eventWonders.owned.seashell_cup.eventId,first);assert.equal(s.eventWonders.owned.seashell_cup.marks,1);assert.equal(s.eventWonders.displayed,'seashell_cup');
 assert.equal(s.coins,coins-10+30);finishFishingParty(s);assert.equal(s.eventWonders.owned.seashell_cup.marks,1);validateState(s);
});
test('fishing does not falsely complete the lantern tutorial or award its monument',()=>{
 const s=setup();hydrateJourney(s);const g=launch(s);g.match=play(g.match);finishFishingParty(s);trackJourney(s,'party',{kind:'fishing'});
 assert.equal(s.journey.stats.parties,1);assert.equal(s.journey.stats.nightParties,0);assert(!s.journey.ready.festival);assert(!s.journey.completed.party);assert(!s.journey.stats.invited);
 trackJourney(s,'party');assert.equal(s.journey.stats.nightParties,1);assert(s.journey.ready.festival);assert(s.journey.completed.party);
});
test('stored match rejects inconsistent seeds, scores, phases and participants',()=>{
 const s=setup();const g=launch(s);g.match=play(g.match);
 for(const edit of [m=>m.seed++,m=>m.rounds[0].rivals[0].caught=!m.rounds[0].rivals[0].caught,m=>m.standing[0].score++,m=>m.phase='ready',m=>m.results[0].points++,m=>m.current.fish.x=Infinity]){
  const bad=structuredClone(s);edit(bad.fishingParty.session.match);assert.throws(()=>validateState(bad));
 }
});
test('party guests cannot be diverted by local social plans, late model responses or queued orders',async()=>{
 const s=setup(),old=globalThis.fetch;
 globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('/tick')?{decisions:[{id:8,goal:'forest',purposeId:'career:0'}]}:{source:'hermes',commands:[{id:'after-party-order',npcId:8,goal:'forest',resource:'wood',quantity:2,intent:'派对结束后备木材'}]}),{status:200});
 try{
  const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  for(const n of npcs)n.manualUntil=1e6;
  npcs[5].manualUntil=0;npcs[5].think=0;s.npcRelations[5]={8:{interactions:3,tension:40,affinity:-10,trust:0,affection:0}};
  const n=npcs[8];n.partyControlled=true;n.path=[{x:1320,y:971}];const path=structuredClone(n.path);
  runtime.update(.1,2);await new Promise(r=>setImmediate(r));
  assert.equal(runtime.person(8).availableForConversation,false);assert(!purposeOptions(5,s,RESIDENTS[5],2).some(o=>o.partnerId===8));
  assert.equal(runtime.meetings.size,0);assert(!n.queuedDecision);assert.deepEqual(n.path,path);
  await runtime.steward('派对结束后再做');assert.deepEqual(n.path,path);assert(!n.assignment);assert(s.agentTaskLedger.some(t=>t.id==='after-party-order'&&t.status==='queued'));
 }finally{globalThis.fetch=old}
});
