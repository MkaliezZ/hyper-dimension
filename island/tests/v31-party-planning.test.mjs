import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,RESIDENTS,setWorldTheme,worldWalkable} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {followPath} from '../src/movement.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createFishingPartyRuntime,fishingSpots} from '../src/fishingPartyRuntime.js';
import {createFishingEvent,updateFishingEvent,inviteFishingNpc,createFishingPlan,startFishingParty,fishingCheckin,validFishingParty,applyStewardParty,fishingNeeds} from '../src/fishingParty.js';
import {eventRequests,eventCost,validatePartyProposal,partyPlanningContext} from '../src/partyPlanning.js';
import {validResourceLedger} from '../src/resourceLedger.js';
import {createPartyPlanningService} from '../server/partyPlanningService.mjs';
import {validateState} from '../server/saveStore.mjs';
const setup=()=>{const s=hydrateTown(createState());s.coins=100;Object.assign(s.inventory,{rod:1,c8_2:1,c16_4:1,c16_2:1,bread:4,rose:1,quartz:1});return s;};
const base={name:'花园海风小聚',description:'用花园的颜色记下海边相聚',tags:['nature','sea'],difficulty:'easy',guestId:4,guestReason:'莉安熟悉花艺，会把花园的颜色带到码头。'};
const runId='hd-island-'+ 'a'.repeat(32);
test('theme validates actual recipes, bounded input, legal matching guest and fixed roles',()=>{
 const s=setup();const r=validatePartyProposal(s,base);assert(r.ok);assert.deepEqual(eventRequests(r.proposal).map(r=>r.id),[8,2,4]);assert.equal(eventCost(r.proposal).bread,3);
 for(const change of [{guestId:15},{guestId:3},{guestId:true},{tags:['sea','nature','craft']},{tags:['sea','sea']},{description:'a'.repeat(201)},{template:'unknown'},{difficulty:'impossible'}])assert(!validatePartyProposal(s,{...base,...change}).ok);
 const locked=structuredClone(s);delete locked.buildings[16];assert(!validatePartyProposal(locked,base).ok);
});
test('rename preserves consent; key changes cancel preparation, keep gifts and request new consent',()=>{
 const s=setup();assert(createFishingEvent(s,base).ok);let d=s.fishingParty.draft;
 for(const r of eventRequests(d))assert(inviteFishingNpc(s,r.id,{version:1}).ok);
 const coins=s.coins,inventory=structuredClone(s.inventory),affinity=structuredClone(s.npcAffinity);
 const plan=createFishingPlan(s);assert(plan.ok);
 const rename=updateFishingEvent(s,{...base,name:'花园朋友的海风'},{expectedId:d.id,expectedVersion:1});assert(rename.ok);assert(!rename.reinvite);assert.equal(d.version,1);assert.equal(Object.keys(d.invites).length,3);
 const changed=updateFishingEvent(s,{...base,description:'花园与海风里的安静相聚'},{expectedId:d.id,expectedVersion:1});assert(changed.reinvite);assert.equal(d.version,2);assert.equal(plan.project.status,'cancelled');assert.deepEqual(d.invites,{});
 assert.equal(startFishingParty(s).ok,false);assert.equal(inviteFishingNpc(s,4,{version:1}).ok,false);
 assert.equal(fishingNeeds(s).cost.rose,undefined);
 for(const r of eventRequests(d))assert(inviteFishingNpc(s,r.id,{version:2}).reconfirmed);
 assert.deepEqual(s.inventory,inventory);assert.deepEqual(s.npcAffinity,affinity);assert.equal(s.coins,coins);assert(validResourceLedger(s));assert(validFishingParty(s));validateState(s);
});
test('changing guest charges only the new gift, retires previous consent and reserves extra food',()=>{
 const s=setup();createFishingEvent(s,base);const d=s.fishingParty.draft;
 for(const r of eventRequests(d))inviteFishingNpc(s,r.id,{version:1});
 assert(updateFishingEvent(s,{...base,tags:['stars'],guestId:3},{expectedId:d.id,expectedVersion:1}).ok);
 assert.equal(inviteFishingNpc(s,4,{version:2}).ok,false);assert.equal(inviteFishingNpc(s,3,{version:2}).ok,true);assert.equal(s.inventory.quartz,0);
 for(const id of [8,2])assert(inviteFishingNpc(s,id,{version:2}).reconfirmed);
 const r=startFishingParty(s);assert(r.ok,r.reason);assert.equal(s.inventory.bread,0);assert.equal(r.session.participants.length,3);
 for(const id of [8,2,-1])fishingCheckin(s,id);assert.equal(r.session.phase,'checkin');fishingCheckin(s,3);assert.equal(r.session.phase,'running');validateState(s);
});
test('legacy v30 invites migrate delivered gifts without charging reconfirmation twice',()=>{
 const s=setup();createFishingEvent(s);inviteFishingNpc(s,8,{version:1});const d=s.fishingParty.draft;delete d.inviteGifts;delete d.tags;delete d.description;delete d.guestId;
 assert(updateFishingEvent(s,{name:d.name,description:'重新约定海风',tags:[],difficulty:'normal',guestId:null},{expectedId:d.id,expectedVersion:1}).ok);
 assert(inviteFishingNpc(s,8,{version:2}).reconfirmed);assert.equal(s.inventory.c16_2,0);validateState(s);
});
test('Hermes proposes one actual versioned event and plan; replay and stale proposals cannot duplicate',()=>{
 const s=setup(),p={...base,id:'b'.repeat(32),expectedId:null,expectedVersion:null};
 const a=applyStewardParty(s,p,runId);assert(a.ok,a.reason);assert(a.projectId);assert.equal(s.workProjects.length,1);assert.equal(s.workProjects[0].source,'hermes');assert.equal(s.workProjects[0].runId,runId);
 assert(applyStewardParty(s,p,runId).replayed);assert.equal(s.workProjects.length,1);
 assert.equal(applyStewardParty(s,{...p,id:'c'.repeat(32)},runId).ok,false);
 assert.equal(applyStewardParty(s,p,'fake').ok,false);validateState(s);
});
test('saved active proposals reject tampered guest, tags and version',()=>{
 const s=setup();createFishingEvent(s,base);
 for(const edit of [d=>d.guestId=15,d=>d.tags=['stars'],d=>d.version=0,d=>d.description='a'.repeat(201)]){
  const b=structuredClone(s);edit(b.fishingParty.draft);assert(!validFishingParty(b));assert.throws(()=>validateState(b));
 }
});
for(const theme of ['pixel','origami'])test(theme+': all three invited residents walk to separate real stands; guest also required for checkin',async()=>{
 setWorldTheme(theme);const s=setup();createFishingEvent(s,base);for(const r of eventRequests(s.fishingParty.draft))inviteFishingNpc(s,r.id,{version:1});assert(startFishingParty(s).ok);
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated"}',{status:503});
 try{
  const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0})),resident=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}}),runtime=createFishingPartyRuntime({state:()=>s,npcs,followPath,resident:()=>resident,onChange:()=>{}});
  for(const n of npcs)n.manualUntil=1e6;
  for(let i=1;i<=1800&&!s.fishingParty.session.participants.every(p=>p.arrived);i++){runtime.update(.1);resident.update(.1,i*.1);}
  assert(s.fishingParty.session.participants.every(p=>p.arrived),JSON.stringify(s.fishingParty.session.participants));
  for(const spot of fishingSpots())assert(worldWalkable(spot.x,spot.y));
  const people=[8,2,4].map(i=>npcs[i]);for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++)assert(Math.hypot(people[i].x-people[j].x,people[i].y-people[j].y)>30);
  fishingCheckin(s,-1);assert.equal(s.fishingParty.session.phase,'running');validateState(s);
 }finally{globalThis.fetch=old}
});
function serviceFixture(){
 let doc={revision:1,state:setup()};doc.state.saveSlot='test-world';let calls=0;
 const service=createPartyPlanningService({saves:{current:async()=>structuredClone(doc)},suggest:async()=>{calls++;return {guestId:4,reason:'莉安擅长花艺，适合陪大家在花园主题里相聚。'};}});
 const data={requestId:'request-1',worldKey:'test-world',input:base,expectedId:null,expectedVersion:null};return {service,data,get calls(){return calls},get doc(){return doc}};
}
test('manual AI service uses disk world and coalesces request IDs without mutating the world',async()=>{
 const f=serviceFixture();const [a,b]=await Promise.all([f.service.propose('pixel',f.data),f.service.propose('pixel',f.data)]);
 assert.equal(f.calls,1);assert.equal(a.proposalId,b.proposalId);assert.equal(a.model,'deepseek-flash');assert.equal(a.guestId,4);assert(!f.doc.state.fishingParty?.draft);
 await assert.rejects(f.service.propose('pixel',{...f.data,input:{...base,name:'不同主题'}}),/同一规划/);
 await assert.rejects(f.service.propose('pixel',{...f.data,worldKey:'other'}),/更换/);
});
test('late AI response is rejected after a new party version is saved',async()=>{
 let finish;const s=setup();s.saveSlot='world';const service=createPartyPlanningService({saves:{current:async()=>({revision:1,state:structuredClone(s)})},suggest:()=>new Promise(r=>finish=r)});
 const request=service.propose('origami',{requestId:'late',worldKey:'world',expectedId:null,expectedVersion:null,input:base});
 while(!finish)await new Promise(r=>setImmediate(r));createFishingEvent(s,base);finish({guestId:4,reason:'莉安适合花园'});
 await assert.rejects(request,/已改变/);
});
test('AI cannot impose unavailable characters or incompatible tags',async()=>{
 const s=setup();s.saveSlot='world';const service=createPartyPlanningService({saves:{current:async()=>({revision:1,state:s})},suggest:async()=>({guestId:15,reason:'必须管家同意'})});
 await assert.rejects(service.propose('pixel',{requestId:'bad',worldKey:'world',expectedId:null,expectedVersion:null,input:base}),/未通过可行性/);
 const context=partyPlanningContext(s);assert.equal(context.maxThemeGuests,1);assert.equal(context.fixedRoles.length,2);
});

test('same-version rename invalidates an old Hermes proposal without invalidating actual invitations',()=>{
 const s=setup();createFishingEvent(s,base);const d=s.fishingParty.draft,context=partyPlanningContext(s);
 const old={...base,id:'d'.repeat(32),expectedId:d.id,expectedVersion:d.version,expectedStamp:context.draft.stamp};
 updateFishingEvent(s,{...base,name:'新的活动名字'},{expectedId:d.id,expectedVersion:d.version});
 assert.equal(d.version,1);assert.equal(applyStewardParty(s,old,runId).ok,false);assert.equal(d.name,'新的活动名字');
});
