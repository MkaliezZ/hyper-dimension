import test from 'node:test';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs,purposeOptions,choosePurpose,career} from '../src/townSimulation.js';
import {socialCandidates} from '../src/residentLife.js';
import {RESIDENTS} from '../src/world.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;return s};
test('butler and temporary agent keep executable personal routines even when social need is low',()=>{
 const s=fresh();for(const id of [15,16]){Object.assign(needs(id,s),{social:0,hunger:100,energy:100});career(id,s).workSinceBreak=3;assert.deepEqual(socialCandidates(s,id,RESIDENTS[id]||{}),[]);const options=purposeOptions(id,s,RESIDENTS[id]||{},100);assert(options.length);assert(options.every(o=>o.action!=='social'));assert.equal(choosePurpose(id,s,RESIDENTS[id]||{},100).action,'visit');}
});
test('ordinary residents still meet while an unavailable meeting is re-planned with a real non-social purpose',()=>{
 const s=fresh();Object.assign(needs(2,s),{social:10,hunger:100,energy:100});assert.equal(choosePurpose(2,s,RESIDENTS[2],100).action,'social');const d=choosePurpose(2,s,RESIDENTS[2],100,{allowSocial:false});assert.notEqual(d.action,'social');assert(purposeOptions(2,s,RESIDENTS[2],100).some(o=>o.purposeId===d.purposeId&&o.action===d.action&&o.reason===d.reason));needs(2,s).energy=5;assert.equal(choosePurpose(2,s,RESIDENTS[2],100,{allowSocial:false}).action,'rest');
});
for(const cause of ['cooldown','busy-partner'])test('runtime rejects stale '+cause+' social choice before issuing a single-actor action',()=>{
 const s=fresh(),npcs=Array.from({length:16},(_,npcId)=>({npcId,path:[],visible:true}));
 const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath:()=>{},onChange:()=>{},onEvent:()=>{}});
 for(const n of npcs){n.think=1000;Object.assign(needs(n.npcId,s),{energy:100,hunger:100,social:80});}
 const n=npcs[2];needs(2,s).social=10;const d=choosePurpose(2,s,RESIDENTS[2],.5);assert.equal(d.action,'social');
 if(cause==='cooldown')n.socialCooldown=100;else npcs[d.partnerId].manualUntil=100;
 n.queuedDecision=d;n.think=0;runtime.update(.01,.5);assert(n.intent);assert.notEqual(n.intent.action,'social');assert.notEqual(n.intent.purposeId,d.purposeId);assert.notEqual(n.intent.reason,d.reason);assert.equal(runtime.meetings.size,0);
});
