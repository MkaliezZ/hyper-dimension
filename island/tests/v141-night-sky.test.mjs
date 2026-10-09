import test from 'node:test';import assert from 'node:assert/strict';
import {createNightSkyGame,applyNightSkyEvent,validNightSkyGame,nightSkyWind,previewNightTrajectory} from '../src/nightSkyGame.js';
import {createNightPartyGame,applyNightPartyEvent,validNightPartyGame} from '../src/nightPartyReplay.js';
import {findNightAim,traceNightGame} from './night-trace-fixture.mjs';
test('same server seed produces the same four targets, winds and clouds; new seeds change routes',()=>{
 const a=createNightSkyGame(421),b=createNightSkyGame(421),c=createNightSkyGame(422);assert.deepEqual(a,b);assert.notDeepEqual(a.levels,c.levels);assert.equal(new Set(a.levels.map(l=>JSON.stringify(l))).size,4);assert(validNightSkyGame(a));
});
test('every tested seeded normal and easy constellation has a playable route',()=>{
 for(const difficulty of ['normal','easy'])for(let seed=1;seed<=48;seed++){
  const g=createNightSkyGame(seed*7919,difficulty),played=traceNightGame(g);assert.equal(played.game.score,4,'seed '+seed+' '+difficulty);assert.equal(played.game.round,4);assert.equal(played.game.phase,'complete');assert(played.game.elapsed>12);assert(validNightSkyGame(played.game));assert(played.events.length<2048);
 }
});
test('easy keeps the same star layout but wider targets and gentler crosswind',()=>{
 const normal=createNightSkyGame(73),easy=createNightSkyGame(73,'easy');normal.levels.forEach((l,i)=>{assert.equal(l.target.x,easy.levels[i].target.x);assert.equal(l.target.y,easy.levels[i].target.y);assert(easy.levels[i].target.radius>l.target.radius);assert(Math.abs(easy.levels[i].wind)<Math.abs(l.wind));});
});
test('only one real air correction is accepted; holding keys cannot add unlimited thrust',()=>{
 const g=createNightSkyGame(31);applyNightSkyEvent(g,{action:{type:'launch'}});const before=g.flight.vx;applyNightSkyEvent(g,{action:{type:'adjust',dir:-1}});assert.equal(g.flight.vx,before-2.8);assert(g.flight.adjusted);const frozen=structuredClone(g);assert.throws(()=>applyNightSkyEvent(g,{action:{type:'adjust',dir:1}}));assert.deepEqual(g,frozen);
});
test('invalid phases, fabricated results, extra fields and legacy taps cannot control a new flight',()=>{
 const g=createNightSkyGame(50);for(const action of [{type:'tap'},{type:'aim',x:39,value:1},{type:'aim',x:0,value:0},{type:'launch',score:4},{type:'next'},{type:'adjust',dir:1}])assert.throws(()=>applyNightPartyEvent(g,{action}));
 assert.throws(()=>applyNightPartyEvent(g,{dt:.2}));assert.throws(()=>applyNightPartyEvent(g,{action:{type:'aim',x:NaN,value:1}}));applyNightPartyEvent(g,{action:{type:'launch'}});assert.throws(()=>applyNightPartyEvent(g,{action:{type:'aim',x:0,value:1}}));
});
test('serialized in-flight state and later inputs replay the exact same outcome',()=>{
 const g=createNightSkyGame(999);const aim=findNightAim(g);applyNightPartyEvent(g,{action:{type:'aim',x:aim.angle,value:1}});applyNightPartyEvent(g,{action:{type:'launch'}});for(let i=0;i<29;i++)applyNightPartyEvent(g,{dt:.05});
 const restored=JSON.parse(JSON.stringify(g));assert(validNightPartyGame(restored));for(let i=0;i<140;i++){applyNightPartyEvent(g,{dt:.05});applyNightPartyEvent(restored,{dt:.05});}assert.deepEqual(restored,g);assert(validNightSkyGame(g));
});
test('missing stars still allow four flights and a completed gathering',()=>{
 const g=createNightSkyGame(9);for(let i=0;i<4;i++){if(i){while(g.phaseTime<1.5)applyNightPartyEvent(g,{dt:.05});applyNightPartyEvent(g,{action:{type:'next'}});}applyNightPartyEvent(g,{action:{type:'aim',x:-38,value:1.3}});applyNightPartyEvent(g,{action:{type:'launch'}});while(g.phase==='flight')applyNightPartyEvent(g,{dt:.05});}
 assert.equal(g.phase,'complete');assert(g.score<4);assert.equal(g.reports.length,4);assert(validNightSkyGame(g));
});
test('no next act is accepted before the outcome animation; finished game ignores later clocks',()=>{
 const g=createNightSkyGame(80);applyNightPartyEvent(g,{action:{type:'launch'}});while(g.phase==='flight')applyNightPartyEvent(g,{dt:.05});assert.throws(()=>applyNightPartyEvent(g,{action:{type:'next'}}));const completed=traceNightGame(g).game,before=structuredClone(completed);applyNightPartyEvent(completed,{dt:.05});assert.deepEqual(completed,before);
});
test('guide is short, responds to input and wind, and does not mutate saved flight state',()=>{
 const g=createNightSkyGame(8),before=structuredClone(g),a=previewNightTrajectory(g);assert.deepEqual(g,before);assert(a.length<20);assert(a.at(-1).y>g.levels[0].target.y);applyNightPartyEvent(g,{action:{type:'aim',x:24,value:1.2}});assert.notDeepEqual(a,previewNightTrajectory(g));assert(Number.isFinite(nightSkyWind(g)));
});
test('malformed saved sky rules and forged reports are rejected',()=>{
 const played=traceNightGame(createNightSkyGame(7)).game;for(const change of [g=>g.levels[0].target.x++,g=>g.score--,g=>g.reports[0].precise=false,g=>g.flight.age=Infinity,g=>g.round=3,g=>g.rulesVersion=1]){const g=structuredClone(played);change(g);assert(!validNightSkyGame(g));}
});
test('existing four-tap tickets keep their original replay, score and serialized shape',()=>{
 const g=createNightPartyGame(7),played=traceNightGame(g);assert.equal(played.game.engine,'night');assert.equal(played.game.score,4);assert(validNightPartyGame(played.game));assert(!Object.hasOwn(played.game,'rulesVersion'));assert(!Object.hasOwn(played.game,'levels'));
});
