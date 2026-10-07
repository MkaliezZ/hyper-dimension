import test from 'node:test';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {cleanResidents,selectResidentDecision} from '../server/agentService.mjs';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {hydrateTown,relationship,purposeOptions,commitWork} from '../src/townSimulation.js';
import {nextOperationId,reserveResources,availableQuantity} from '../src/resourceLedger.js';
import {hydrateResidentStories,recordResidentConversation,residentStoryOptions,claimResidentStory,recordResidentStoryWork,restoreResidentStories,advanceResidentStories,mediateResidentStory,relationshipInvitation,validResidentStories,STORY_LIMITS} from '../src/residentStories.js';
import {createFishingEvent,inviteFishingNpc,startFishingParty,eventRequests} from '../src/fishingParty.js';
import {canHostParty,tickTownEconomy} from '../src/economy.js';
import {validateState} from '../server/saveStore.mjs';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
const fresh=()=>{const s=createZeroState();s.freshStartPending=false;hydrateTown(s);return s};
function conversation(s,{people=[0,2],type='dispute',changes=[],storyId=null,operationId=null}={}){
 const row={id:operationId||nextOperationId(s,'npc-talk'),storyId,day:s.day,time:0,participants:people,type,changes,summary:'实际见面后对分工有不同意见',source:'local',lines:people.map(speaker=>({speaker,text:'先核对真实结果。'}))};
 s.npcConversations.push(row);return row;
}
function episode(s,options={},plan=null){const row=conversation(s,options);return recordResidentConversation(s,row,plan).episode}
function work(s,e,id){
 const op=nextOperationId(s,'story-work');assert.equal(claimResidentStory(s,e.id,id,op,'work'),true);
 const d={...e.plan,action:'work',storyId:e.id,operationId:op};
 commitWork(id,d,s,0);return {op,result:recordResidentStoryWork(s,e.id,id,op)};
}
test('only completed recorded conversations create next-day episodes; replay is stable',()=>{
 const s=fresh(),row=conversation(s);s.npcConversations.pop();assert.equal(recordResidentConversation(s,row).ok,false);
 s.npcConversations.push(row);const e=recordResidentConversation(s,row).episode;
 assert.equal(e.dueDay,2);assert.equal(residentStoryOptions(s,0).length,0);
 const before=JSON.stringify(s);assert.equal(recordResidentConversation(s,row).replayed,true);assert.equal(JSON.stringify(s),before);
 assert.equal(validResidentStories(s),true);
});
test('future appointments wait for a real game-day boundary; needs and busy partners take priority',()=>{
 const s=fresh(),e=episode(s);relationship(s,0,2).tension=16;
 assert.ok(!purposeOptions(0,s,RESIDENTS[0],100).some(o=>o.partnerId===2));
 tickTownEconomy(s,900);assert.equal(s.day,2);assert.ok(purposeOptions(0,s,RESIDENTS[0],100).some(o=>o.storyId===e.id));
 s.npcNeeds[0].energy=10;assert.ok(purposeOptions(0,s,RESIDENTS[0],100).every(o=>o.action==='rest'));
 s.npcNeeds[0].energy=90;s.npcPresence=[{id:2,partyControlled:true}];assert.equal(residentStoryOptions(s,0).length,0);
});
test('two-sided mediation changes willingness once; stale choices do not alter state',()=>{
 const s=fresh(),e=episode(s);relationship(s,0,2).tension=16;relationship(s,2,0).tension=15;
 assert.equal(relationshipInvitation(s,0,[0,2]).ready,false);
 assert.equal(relationshipInvitation(s,0,[0,8]).ready,true);
 const first=mediateResidentStory(s,e.id,0,'listen',{version:e.version});assert.equal(first.ok,true);
 assert.equal(relationshipInvitation(s,0,[0,2]).ready,false);
 assert.equal(mediateResidentStory(s,e.id,2,'listen',{version:1}).ok,false);
 assert.equal(mediateResidentStory(s,e.id,2,'listen',{version:e.version}).ok,true);
 assert.equal(relationshipInvitation(s,0,[0,2]).ready,true);
 const snapshot=JSON.stringify(s);assert.equal(mediateResidentStory(s,e.id,0,'listen',{version:1}).replayed,true);assert.equal(JSON.stringify(s),snapshot);
 assert.equal(s.npcRelations[0][2].tension,14);assert.equal(s.npcRelations[2][0].tension,13);
 assert.equal(validResidentStories(s),true);
});
test('cooperation gives no output for a promise; only both actual deliveries settle relationship effects',()=>{
 const s=fresh(),e=episode(s,{type:'negotiate'});s.day=2;
 const before=s.inventory.wood;
 const a=work(s,e,0);assert.equal(a.result.ok,true);assert.equal(e.status,'scheduled');assert.equal(e.contributions[0].amount,2);
 assert.equal(s.inventory.wood,before+2);assert.equal(s.npcRelations[0]?.[2]?.trust||0,0);
 restoreResidentStories(s);const b=work(s,e,2);
 assert.equal(b.result.ok,true);assert.equal(e.status,'resolved');assert.equal(s.inventory.wood,before+4);assert.equal(s.npcRelations[0][2].trust,3);
 const after=JSON.stringify(s);assert.equal(recordResidentStoryWork(s,e.id,2,b.op).ok,false);assert.equal(JSON.stringify(s),after);
 assert.equal(validResidentStories(s),true);validateState(s);
});
test('partial preparation survives a cancelled action and file-shaped reload',()=>{
 const s=fresh(),e=episode(s,{type:'negotiate'});s.day=2;work(s,e,0);
 const op=nextOperationId(s,'story-work');claimResidentStory(s,e.id,2,op,'work');const clone=structuredClone(s);
 restoreResidentStories(clone);const restored=clone.residentStories.episodes[0];
 assert.deepEqual(restored.contributions,e.contributions);assert.equal(restored.status,'scheduled');assert.deepEqual(restored.inFlight,{});
 assert.equal(clone.inventory.wood,s.inventory.wood);assert.equal(recordResidentStoryWork(clone,e.id,2,op).ok,false);work(clone,restored,2);
 assert.equal(restored.status,'resolved');assert.equal(validResidentStories(clone),true);
});
test('missing or wrong-actor work receipts cannot complete a promised delivery',()=>{
 const s=fresh(),e=episode(s,{type:'negotiate'});s.day=2;
 const op=nextOperationId(s,'story-work');claimResidentStory(s,e.id,0,op,'work');
 s.taskActionReceipts??={};s.taskActionReceipts[op]={day:2,npcId:2,storyId:e.id,delta:{wood:99}};
 assert.equal(recordResidentStoryWork(s,e.id,0,op).ok,false);assert.deepEqual(e.contributions,{});assert.equal(s.inventory.wood,0);
});
test('cooperative production respects stock held by another project and adds actual stock only',()=>{
 const s=fresh();s.inventory.wood=3;reserveResources(s,'project:test',{wood:3});
 const e=episode(s,{type:'negotiate'});s.day=2;work(s,e,0);work(s,e,2);
 assert.equal(s.inventory.wood,7);assert.equal(availableQuantity(s,'wood'),4);
 assert.deepEqual(s.resourceLedger.reservations['project:test'].items,{wood:3});
});
test('successful conflict conversation schedules next-day actual repair work, not instant trust reward',()=>{
 const s=fresh(),e=episode(s);s.day=2;
 const op=nextOperationId(s,'npc-talk');claimResidentStory(s,e.id,0,op,'talk');
 const row=conversation(s,{storyId:e.id,operationId:op,type:'reconcile',changes:[{from:0,to:2,tension:-3,trust:1}]});
 recordResidentConversation(s,row);assert.equal(e.stage,'work');assert.equal(e.dueDay,3);assert.equal(e.status,'scheduled');
 assert.equal(s.inventory.wood,0);assert.equal(residentStoryOptions(s,0).length,0);
 s.day=3;work(s,e,0);work(s,e,2);assert.equal(e.status,'resolved');assert.equal(s.npcRelations[0][2].trust,3);
 assert.equal(validResidentStories(s),true);
});
test('unresolved boundaries have a bounded retry and expiration without phantom goods or punishment',()=>{
 const s=fresh(),e=episode(s);s.day=2;
 for(let attempt=0;attempt<2;attempt++){
  const op=nextOperationId(s,'npc-talk');claimResidentStory(s,e.id,0,op,'talk');
  recordResidentConversation(s,conversation(s,{storyId:e.id,operationId:op,type:'reconcile',changes:[{from:0,to:2,tension:1}]}));
  if(attempt===0){assert.equal(e.status,'scheduled');s.day++;}
 }
 assert.equal(e.status,'closed');assert.equal(s.inventory.wood,0);assert.equal(relationshipInvitation(s,0,[0,2]).ready,true);
 assert.equal(validResidentStories(s),true);
 const other=fresh(),pending=episode(other);other.day=pending.expiresDay+1;advanceResidentStories(other);
 assert.equal(pending.status,'closed');const snap=JSON.stringify(other);advanceResidentStories(other);assert.equal(JSON.stringify(other),snap);
});
test('confession with a boundary schedules friendship rather than imposing reciprocal romance',()=>{
 const s=fresh(),e=episode(s,{type:'confession',changes:[{from:0,to:2,affection:1},{from:2,to:0,trust:1}]});
 assert.equal(e.kind,'friendship');s.day=e.dueDay;const op=nextOperationId(s,'npc-talk');claimResidentStory(s,e.id,0,op,'talk');
 recordResidentConversation(s,conversation(s,{type:'friendship',storyId:e.id,operationId:op}));
 assert.equal(e.status,'resolved');assert.equal(s.npcRelations[2][0].affection,0);
});
test('a dispute blocks an invitation before consuming any gift; mediation restores the existing gift path',()=>{
 const s=fresh(),e=episode(s,{people:[2,8]});createFishingEvent(s);
 const r=eventRequests(s.fishingParty.draft).find(r=>r.id===2);s.inventory[r.item]=r.quantity;
 const before=JSON.stringify(s.inventory),version=s.fishingParty.draft.version;
 assert.equal(inviteFishingNpc(s,2,{version}).ok,false);assert.equal(JSON.stringify(s.inventory),before);
 mediateResidentStory(s,e.id,2,'listen',{version:e.version});mediateResidentStory(s,e.id,8,'listen',{version:e.version});
 assert.equal(inviteFishingNpc(s,2,{version}).ok,true);assert.equal(s.inventory[r.item],0);
});
test('new conflict after consent prevents both activity entry charges until willingness is resolved',()=>{
 const s=fresh();createFishingEvent(s);s.coins=100;s.inventory.bread=5;s.inventory.c16_4=5;s.inventory.rod=1;s.inventory.c8_2=3;
 for(const r of eventRequests(s.fishingParty.draft)){s.inventory[r.item]=(s.inventory[r.item]||0)+r.quantity;assert.equal(inviteFishingNpc(s,r.id,{version:1}).ok,true);}
 episode(s,{people:[2,8]});const before=JSON.stringify({coins:s.coins,inventory:s.inventory});
 assert.equal(startFishingParty(s).ok,false);assert.equal(JSON.stringify({coins:s.coins,inventory:s.inventory}),before);
 const night=fresh();night.coins=100;night.inventory.lantern=1;night.inventory.wheat=2;episode(night);
 assert.equal(canHostParty(night),false);
});
test('episode limits preserve independent ordinary life and actual source identity',()=>{
 const s=fresh();for(const people of [[0,1],[2,3],[4,5],[6,7],[8,9]])episode(s,{people});
 assert.equal(s.residentStories.episodes.length,STORY_LIMITS.active);assert.equal(validResidentStories(s),true);
 const forged=structuredClone(s);forged.residentStories.episodes[0].plan.resource='invented';assert.equal(validResidentStories(forged),false);
 const bad=structuredClone(s);bad.residentStories.episodes[0].status='meeting';assert.equal(validResidentStories(bad),false);
});
test('forged contribution and lease state are rejected before a save can replace progress',()=>{
 const s=fresh(),e=episode(s,{type:'negotiate'});s.day=2;work(s,e,0);const bad=structuredClone(s);
 bad.residentStories.episodes[0].contributions[0].amount++;assert.equal(validResidentStories(bad),false);assert.throws(()=>validateState(bad),/居民约定/);
 const lease=structuredClone(s);lease.residentStories.episodes[0].inFlight[2]={operationId:'story-work:99'};assert.equal(validResidentStories(lease),false);
});
for(const theme of ['pixel','origami'])test('runtime physically meets and delivers on '+theme+' island',async()=>{
 setWorldTheme(theme);const s=fresh(),e=episode(s);s.day=2;
 for(let i=0;i<16;i++)s.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};
 Object.assign(relationship(s,0,2),{affinity:0,tension:16});Object.assign(relationship(s,2,0),{affinity:0,tension:15});
 const npcs=Array.from({length:16},(_,npcId)=>({npcId,x:0,y:0,visible:true,path:[]}));
 const prior=globalThis.fetch,calls=[];globalThis.fetch=async url=>{calls.push(url);throw Error('isolated offline fixture')};
 const events=[];
 try{
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:message=>events.push(message)});
  for(let i=1;i<16;i++)if(i!==2)npcs[i].manualUntil=10000;
  for(let t=1;t<=240;t++){runtime.update(1,t);await Promise.resolve();if(e.stage==='work')break;}
  assert.equal(e.stage,'work','the NPCs must actually arrive and finish their conversation: '+JSON.stringify({episode:e,meetings:[...runtime.meetings.values()],npcs:npcs.filter(n=>[0,2].includes(n.npcId)),calls,events}));
  assert.ok(s.npcConversations.some(row=>row.storyId===e.id));assert.equal(s.inventory.wood,0);
  tickTownEconomy(s,900);assert.equal(s.day,3);
  for(let t=241;t<=600&&e.status!=='resolved';t++){runtime.update(1,t);await Promise.resolve();}
  assert.equal(e.status,'resolved');assert.equal(Object.keys(e.contributions).length,2);
  for(const c of Object.values(e.contributions))assert.equal(s.taskActionReceipts[c.operationId].delta.wood,c.amount);
  assert.ok(events.some(message=>message.includes('合作成果')));assert.equal(validResidentStories(s),true);
  assert.ok(calls.filter(u=>u==='/api/npc/tick').length<=3);assert.ok(calls.filter(u=>u==='/api/npc/interact').length<=1);
 }finally{globalThis.fetch=prior;setWorldTheme('pixel');}
});


test('interrupting an appointment preserves the other residents unfinished real work',async()=>{
 const s=fresh(),e=episode(s);s.day=2;
 for(let i=0;i<16;i++)s.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};
 const npcs=Array.from({length:16},(_,npcId)=>({npcId,x:0,y:0,visible:true,path:[]}));
 const prior=globalThis.fetch;globalThis.fetch=async()=>{throw Error('isolated offline fixture')};let done=0;
 try{
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  for(let i=1;i<16;i++)if(i!==2)npcs[i].manualUntil=10000;
  const workAction={type:'water',t:0,duration:20,onDone:()=>done++};npcs[2].action=workAction;
  runtime.update(1,1);await Promise.resolve();assert.equal(runtime.meetings.size,1);assert.equal(e.status,'meeting');
  runtime.releaseActor(npcs[0]);assert.equal(runtime.meetings.size,0);assert.equal(e.status,'scheduled');
  assert.equal(npcs[2].action,workAction);npcs[2].manualUntil=10000;
  for(let t=2;t<=22;t++){runtime.update(1,t);await Promise.resolve();}assert.equal(done,1);assert.equal(validResidentStories(s),true);
 }finally{globalThis.fetch=prior;}
});


test('real model cleaning preserves bounded commitments and can select canonical story goals',()=>{
 const s=fresh(),e=episode(s);s.day=2;
 const options=residentStoryOptions(s,0),payload={residents:[{...RESIDENTS[0],options,commitments:[{id:e.id,title:e.title,partnerId:2,dueDay:2,stage:'talk'},{id:'invalid',partnerId:2,dueDay:2,stage:'talk'}]}]};
 const clean=cleanResidents(payload);assert.equal(clean[0].commitments.length,1);assert.equal(clean[0].commitments[0].id,e.id);
 const selected=selectResidentDecision(clean,{id:0,purposeId:options[0].purposeId,goal:'forest',buildingId:0},[0]);
 assert.equal(selected.storyId,e.id);assert.equal(selected.buildingId,e.venue);assert.equal(selected.goal,options[0].goal);
 assert.equal(selectResidentDecision(clean,{id:0,purposeId:'invented'},[0]),null);
 const herbs=episode(s,{people:[1,3],type:'negotiate'},{goal:'workshop',buildingId:14,resource:'herb'});s.day++;
 const work=residentStoryOptions(s,1).find(o=>o.storyId===herbs.id);
 assert.equal(selectResidentDecision(cleanResidents({residents:[{...RESIDENTS[1],options:[work]}]}),{id:1,purposeId:work.purposeId},[1]).storyId,herbs.id);
});
