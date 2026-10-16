import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateTown,purposeOptions,career,needs} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {RESIDENTS} from '../src/world.js';
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;s.day=5;s.economy.daySeconds=40;for(let i=0;i<16;i++)Object.assign(needs(i,s),{energy:90,hunger:90,social:20});return s;};
const visits=s=>purposeOptions(0,s,RESIDENTS[0],3).filter(o=>o.action==='visit');
const socials=s=>purposeOptions(0,s,RESIDENTS[0],3).filter(o=>o.action==='social');
test('reopening after a completed legacy personal pause does not suppress all leisure for the old page age',()=>{
 const s=fresh(),c=career(0,s);c.personalAfter=3565;c.history.push({day:4,daySeconds:800,time:3500,action:'visit',buildingId:7,purposeId:'life:seed-notes',result:'整理笔记'});assert(visits(s).length>0,'An elapsed65second personal pause must not become an hour after page time resets');
});
test('a still-active legacy personal pause survives reentry and expires on effective time, not a new page age',()=>{
 const s=fresh(),c=career(0,s);c.personalAfter=5065;c.history.push({day:5,daySeconds:20,time:5000,action:'visit',buildingId:7,purposeId:'life:seed-notes',result:'整理笔记'});assert.equal(visits(s).length,0);s.economy.daySeconds=85.01;assert(visits(s).length>0,'45remaining effective seconds release the original pause even on the new page');
});
test('legacy social cooldown is preserved for the remaining period and then releases after reload',()=>{
 const s=fresh(),c=career(0,s);c.socialAfter=5300;c.history.push({day:5,daySeconds:20,time:5000,action:'social',buildingId:7,result:'交流完毕'});assert.equal(socials(s).length,0);s.economy.daySeconds=320.01;assert(socials(s).length>0,'Social eligibility must resume after the original300effective seconds');
});

import {residentCooldownRemaining,setResidentCooldown,residentHistoryAge,RESIDENT_COOLDOWN_SECONDS} from '../src/residentCooldowns.js';
import {residentLifeClock} from '../src/residentLife.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';

test('new durable pauses ignore page-clock restart, preserve paused world time and cross a game day exactly',()=>{
 const s=fresh(),c=career(0,s);s.economy.daySeconds=890;setResidentCooldown(s,c,'personal',65,5000);
 const restored=JSON.parse(JSON.stringify(s)),saved=career(0,restored);assert.equal(residentCooldownRemaining(restored,saved,'personal',0),65);assert.equal(residentCooldownRemaining(restored,saved,'personal',9000),65,'Page time is not the durable clock');
 restored.day=6;restored.economy.daySeconds=20;assert.equal(residentCooldownRemaining(restored,saved,'personal',2),35);restored.economy.daySeconds=55;assert.equal(residentCooldownRemaining(restored,saved,'personal',3),0);
});
test('a legacy client changing its mirror cannot leave a stale new stamp in charge',()=>{
 const s=fresh(),c=career(0,s);setResidentCooldown(s,c,'social',300,1);c.socialAfter=9300;c.history.push({day:5,daySeconds:10,time:9000,action:'social',result:'交流'});
 assert.equal(residentCooldownRemaining(s,c,'social',2),270);s.economy.daySeconds=310;assert.equal(residentCooldownRemaining(s,c,'social',2),0);
});
test('unanchored old deadlines are bounded and malformed history does not create a new long wait',()=>{
 const s=fresh(),c=career(0,s);c.personalAfter=10000;c.history=[null,'legacy'];assert.equal(residentCooldownRemaining(s,c,'personal',3),0);c.personalAfter=30;assert.equal(residentCooldownRemaining(s,c,'personal',3),27);assert.equal(residentCooldownRemaining(s,c,'__proto__',3),0);
 assert.throws(()=>setResidentCooldown(s,c,'personal',Infinity,0));assert.throws(()=>setResidentCooldown(s,c,'__proto__',10,0));assert.deepEqual(RESIDENT_COOLDOWN_SECONDS,{social:300,personal:65,retry:30});
  c.personalAfter=10000;c.cooldowns={personal:{version:1,after:10000,until:residentLifeClock(s)+10000}};assert.equal(residentCooldownRemaining(s,c,'personal',3),0,'An invalid far-future stamp must not restore the old long wait');
});
test('recent-place penalties age by saved day coordinates instead of a previous page timestamp',()=>{
 const s=fresh();assert.equal(residentHistoryAge(s,{day:4,daySeconds:800,time:5000},3),140);assert.equal(residentHistoryAge(s,{day:5,daySeconds:20,time:5000},3),20);assert.equal(residentHistoryAge(s,{time:5000},3),Infinity);
});
for(const theme of ['pixel','origami'])test(theme+' an actual completed resident visit seals its active-time pause once and preserves it on store reopen',async()=>{
 await mkdir('qa/v221',{recursive:true});const directory=await mkdtemp(resolve('qa/v221/visit-pause-'));let now=1000000;const store=createSaveStore({directory,now:()=>now}),seed=fresh(),d=(await store.open(theme,{legacyState:seed,protect:true})).document;
 const start=await store.action(theme,{kind:'resident',operation:'begin',actorId:0,intent:{goal:'gallery',buildingId:7,action:'visit',purposeId:'life:seed-notes'},gameTime:5000,requestId:crypto.randomUUID(),expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch});now=start.ticket.readyAt;
 const input={kind:'resident',operation:'finish',requestId:start.ticket.requestId,epoch:start.ticket.epoch,sequence:start.ticket.sequence,expectedVersion:start.document.version},done=await store.action(theme,input),saved=career(0,done.document.state),stamp=structuredClone(saved.cooldowns.personal);
 assert.equal(stamp.until,residentLifeClock(done.document.state)+65);assert.equal(residentCooldownRemaining(done.document.state,saved,'personal',0),65);const other=createSaveStore({directory,now:()=>now});now+=80000;const replay=await other.action(theme,input),reopened=await other.current(theme);assert.equal(replay.replayed,true);assert.deepEqual(career(0,reopened.state).cooldowns.personal,stamp);assert.equal(reopened.actions.receipts.filter(r=>r.ticket.requestId===start.ticket.requestId).length,1);
});
