import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,purposeOptions,commitWork,career,needs,relationship} from '../src/townSimulation.js';
import {RESIDENTS} from '../src/world.js';
import {recordSocialOutcome,socialBoundary,socialCandidates,residentLifeClock,validResidentLife,leisureOptions,routineFor,residentLifeSummary} from '../src/residentLife.js';
import {newActionBook} from '../server/playerActions.mjs';
import {applyResidentCommand} from '../server/residentActions.mjs';
import {cleanResidents} from '../server/agentService.mjs';
import {validateState} from '../server/saveStore.mjs';
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;return s;};
const row=(s,type,changes,people=[0,6])=>{const r={id:'talk-'+randomUUID(),day:s.day,time:20,type,changes,participants:people,summary:'本次谈话的实际结果',lines:[]};s.npcConversations.push(r);return r;};
const complete=(s,r)=>{assert.equal(recordSocialOutcome(s,r),true);return r;};
test('failed agreement creates a symmetric one-day boundary using effective time and survives reload',()=>{
 const s=fresh();s.economy.daySeconds=800;const r=complete(s,row(s,'dispute',[{from:0,to:6,tension:2}]));assert(socialBoundary(s,0,6));assert(socialBoundary(s,6,0));assert(!socialCandidates(s,0,RESIDENTS[0]).some(c=>c.id===6));
 const bytes=JSON.stringify(s);assert.equal(recordSocialOutcome(s,r),false);assert.equal(JSON.stringify(s),bytes);const restored=JSON.parse(bytes);validateState(restored);restored.day=2;restored.economy.daySeconds=799;assert(socialBoundary(restored,0,6));restored.economy.daySeconds=800;assert.equal(socialBoundary(restored,0,6),null);
});
test('only an actual completed recorded exchange can create a boundary',()=>{
 const s=fresh(),r=row(s,'dispute',[]);s.npcConversations=[];assert.equal(recordSocialOutcome(s,r),false);assert.equal(s.residentLife,undefined);
});
test('unreciprocated affection blocks repeated confession but allows friendship',()=>{
 const s=fresh();Object.assign(relationship(s,0,6),{affection:25,trust:20,affinity:30,interactions:4});needs(0,s).social=10;
 complete(s,row(s,'confession',[{from:0,to:6,affection:1},{from:6,to:0,affection:0}]));assert(!socialBoundary(s,0,6));assert(socialBoundary(s,0,6,'romance'));
 const options=purposeOptions(0,s,RESIDENTS[0],100);assert(!options.some(o=>o.partnerId===6&&o.socialType==='confession'));assert(socialCandidates(s,0,RESIDENTS[0]).some(c=>c.id===6));
 s.day=4;assert(!socialBoundary(s,0,6,'romance'));
});
test('genuine reconciliation clears space while unsuccessful talk preserves it',()=>{
 const s=fresh();complete(s,row(s,'dispute',[]));complete(s,row(s,'reconcile',[{from:0,to:6,tension:1}]));assert(socialBoundary(s,0,6));complete(s,row(s,'reconcile',[{from:0,to:6,tension:-3},{from:6,to:0,tension:-2}]));assert(!socialBoundary(s,0,6));
});
test('social choice rotates actual conversation partners without dropping familiar preferences',()=>{
 const s=fresh();assert.equal(socialCandidates(s,0,RESIDENTS[0])[0].id,4);for(let k=0;k<3;k++)row(s,'friendship',[],[0,4]);assert.equal(socialCandidates(s,0,RESIDENTS[0])[0].id,6);
 s.npcPresence=[{id:6,assignment:true}];assert(!socialCandidates(s,0,RESIDENTS[0]).some(c=>c.id===6));
});
test('editable quiet or outgoing personality changes the urgency of social life',()=>{
 const s=fresh();needs(0,s).social=45;
 const quiet=purposeOptions(0,s,{...RESIDENTS[0],personality:'安静、慢热'},100),active=purposeOptions(0,s,{...RESIDENTS[0],personality:'开朗、热情、爱分享'},100);
 assert(active.find(o=>o.action==='social').score>quiet.find(o=>o.action==='social').score);assert.equal(active[0].action,'social');assert.equal(quiet[0].action,'work');
});
test('leisure visits vary by career, actual prior visits, personality and nearby tension',()=>{
 const s=fresh();const list=leisureOptions(s,12,RESIDENTS[12],{breakDue:true});assert.equal(list[0].buildingId,12);assert.equal(routineFor(12,list[0]).animation,'perform');
 commitWork(12,{...list[0],operationId:'leisure:1'},s,40);const next=leisureOptions(s,12,RESIDENTS[12],{breakDue:true});assert.notEqual(next[0].purposeId,list[0].purposeId);assert.equal(career(12,s).history.at(-1).action,'visit');assert.equal(career(12,s).history.at(-1).day,1);
 const farmer=leisureOptions(s,0,RESIDENTS[0],{breakDue:true})[0];Object.assign(relationship(s,0,6),{tension:20});s.npcPresence=[{id:6,inside:farmer.buildingId}];assert.notEqual(leisureOptions(s,0,RESIDENTS[0],{breakDue:true})[0].buildingId,farmer.buildingId);
});
test('hunger, exhaustion and committed work still precede personal routines',()=>{
 const s=fresh();career(0,s).workSinceBreak=4;needs(0,s).energy=10;assert(purposeOptions(0,s,RESIDENTS[0],100).every(o=>o.action==='rest'));needs(0,s).energy=100;needs(0,s).hunger=10;assert(purposeOptions(0,s,RESIDENTS[0],100).every(o=>o.action==='eat'||o.purposeId==='need:food-supply'));
});
for(const id of [0,12,13])test('server completes the canonical leisure action once without inventing goods for resident '+id,()=>{
 const s=fresh(),b=newActionBook(),d=leisureOptions(s,id,RESIDENTS[id],{breakDue:true})[0],before={...s.inventory},coins=s.coins;
 const begin={kind:'resident',operation:'begin',requestId:randomUUID(),epoch:b.epoch,expectedSequence:b.sequence,actorId:id,intent:d,gameTime:10};const result=applyResidentCommand(s,b,begin,1000),t=result.ticket;assert.equal(t.action,routineFor(id,d).animation);assert.equal(t.mode,'life');
 const f={kind:'resident',operation:'finish',requestId:t.requestId,epoch:t.epoch,sequence:t.sequence};assert.throws(()=>applyResidentCommand(s,b,f,t.readyAt-1),/尚未完成/);applyResidentCommand(s,b,f,t.readyAt);assert.deepEqual(s.inventory,before);assert.equal(s.coins,coins);assert.deepEqual(s.taskActionReceipts[t.operationId].delta,{});assert(career(id,s).lastResult.includes(routineFor(id,d).title));const count=career(id,s).completed;commitWork(id,t.intent,s,60);assert.equal(career(id,s).completed,count);
});
test('old saves remain valid and corrupt social ledgers cannot replace the current save',()=>{
 const s=fresh();assert(validResidentLife(s));validateState(s);complete(s,row(s,'dispute',[]));validateState(s);const bad=structuredClone(s);bad.residentLife.boundaries[0].until=Infinity;assert(!validResidentLife(bad));assert.throws(()=>validateState(bad),/居民相处/);
});
test('model and resident card receive bounded actual life records',()=>{
 const s=fresh();complete(s,row(s,'dispute',[]));const life=residentLifeSummary(s,0,RESIDENTS[0]);const clean=cleanResidents({residents:[{...RESIDENTS[0],life}]});assert.equal(clean[0].life.boundaries[0].partnerId,6);assert.equal(clean[0].life.boundaries[0].remainingSeconds,900);assert(!clean[0].life.latest.includes('已完成'));
});

// Regression from the complete suite: the fixture must respect the game's repeat-outfit penalty.
import {trace} from './v92-cooperation-fixture.mjs';
import {createCoutureGame,coutureSummary,COUTURE_CLOTHES} from '../src/coutureRules.js';
test('exceptional couture replay varies outfits on the previously failing normal seed',()=>{
 const initial=createCoutureGame(4082964559,'normal',COUTURE_CLOTHES.map(x=>x.id),[13,7,2],['stars']),played=trace('couture',initial).game,result=coutureSummary(played);
 assert.equal(result.poseHits,12);assert(result.quality>=85);assert.equal(new Set(played.reports.map(r=>JSON.stringify(r.outfit))).size,3);
});
