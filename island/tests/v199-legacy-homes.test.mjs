import {fixtureWonders as addFixtureWonders} from './v199-legacy-input.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {hydrateWonders} from '../src/eventWonders.js';
import {originChallenge,originsSolved,placeOrigin,ownedOriginFacts,postChallenge,postStep,postWalk,replayPost,postSolved} from '../src/homeLegacyActivities.js';
import {evaluateHomeActivity} from '../src/homeActivities.js';
import {homeFrameTime} from '../src/homeTiming.js';
import {followPath} from '../src/movement.js';
import {RESIDENCE_LAYOUTS} from '../src/residenceLayouts.js';
test('all 16 home layouts have distinct plans, per-owner activities and two corresponding style images',()=>{assert.equal(Object.keys(RESIDENCE_LAYOUTS).length,16);assert.equal(new Set(Object.values(RESIDENCE_LAYOUTS).map(l=>JSON.stringify(l.floor))).size,16);for(const l of Object.values(RESIDENCE_LAYOUTS)){assert(l.zones.some(z=>z.kind==='activity'));assert(l.zones.some(z=>z.kind==='bed'));assert.notEqual(l.image('pixel'),l.image('origami'));}});
test('curator practice is explicitly fictional, daily ordering and provenance matches are both required',()=>{
 const variants=new Set();for(let day=1;day<=365;day++){const c=originChallenge(day);assert.equal(c.mode,'practice');assert.equal(c.items.length,4);assert.equal(c.cards.length,6);assert(originsSolved(c,c.solution));assert(!originsSolved(c,c.board));variants.add(c.solution.map(p=>p.itemId).join());assert(evaluateHomeActivity({homeId:14,board:c.solution},day));const wrong=structuredClone(c.solution);wrong[0].sourceId=wrong[1].sourceId;assert(!originsSolved(c,wrong));assert.equal(evaluateHomeActivity({homeId:14,board:wrong},day),null);assert(!originsSolved(c,[...c.solution].reverse()));}
 assert(variants.size>100);const c=originChallenge(4),placed=placeOrigin(c.board,c.items[0].key,0);assert.equal(placed[0].itemId,c.items[0].key);const swapped=placeOrigin(placed,c.items[0].key,1);assert.equal(swapped[0],null);assert.equal(swapped[1].itemId,c.items[0].key);assert.equal(originChallenge(4,{},'owned').mode,'practice');
});
test('real collection facts come from the saved awards, reject unowned/subset/mixed records and survive new acquisitions',()=>{
 const state=addFixtureWonders({}),before=structuredClone(state),c=originChallenge(9,state);assert.equal(c.mode,'owned');assert.equal(ownedOriginFacts(state).length,4);const r=evaluateHomeActivity({homeId:14,board:c.solution},9,state);assert(r);assert.equal(r.mode,'owned');assert(r.sources.every(p=>p.eventId.startsWith('fictional-home-event-')));assert.deepEqual(state,before);
 for(const board of [c.solution.slice(0,1),c.solution.map(p=>({...p,sourceId:'invented'})),c.solution.map(p=>({...p,itemId:'owned:cooperation_tree'})),c.solution.map(p=>({...p,extra:true})),[...c.solution.slice(0,3),{itemId:'practice:map',sourceId:'practice:map:source'}]])assert.equal(evaluateHomeActivity({homeId:14,board},9,state),null);
 state.eventWonders.owned.island_pinwheel={id:'island_pinwheel',day:8,eventId:'fictional-new-award',eventName:'新相聚',color:0};assert(evaluateHomeActivity({homeId:14,board:c.solution},9,state));
});
test('daily postal puzzles are reachable by legal pushes; blocked walks, malformed histories and incomplete layouts fail',()=>{
 const variants=new Set();for(let day=1;day<=365;day++){const c=postChallenge(day);assert(!postSolved(c,c.board));assert(postSolved(c,[c.solution]));assert(evaluateHomeActivity({homeId:15,board:[c.solution]},day));variants.add(JSON.stringify(c.initial));const state=structuredClone(c.initial);assert.equal(postStep(c,state,'X'),null);assert.deepEqual(c.initial,state);assert.equal(postWalk(c,state,c.walls[0]),null);assert.equal(postWalk(c,state,state.boxes[0]),null);assert.equal(postWalk(c,state,state.player),'');for(const moves of ['X','U'.repeat(2001),'L'.repeat(99)])assert.equal(replayPost(c,moves),null);assert(!postSolved(c,[c.solution,'extra']));}assert(variants.size>30);
});
test('foreground 5fps and 60fps walks consume equal route distance, hidden time is discarded',()=>{
 const walk=fps=>{const a={x:0,y:0,path:[{x:500,y:0},{x:500,y:300}]};let last=1;for(let i=1;i<=fps*3;i++){const t=1+i/fps*1000;followPath(a,homeFrameTime(last,t,false).motion,165);last=t;}return a;};assert(Math.abs(walk(5).x-walk(60).x)<.001);assert.equal(homeFrameTime(1000,6000,true).motion,0);assert.equal(homeFrameTime(0,6000,false).motion,0);assert.equal(homeFrameTime(1000,1100,false).animation,.05);assert.equal(homeFrameTime(1000,999,false).motion,0);
});
test('both new journals commit once, persist real provenance and preserve currency, inventory and real task state',async()=>{
 await mkdir('qa/v199',{recursive:true});const directory=await mkdtemp(resolve('qa/v199/legacy-book-')),store=createSaveStore({directory}),state=addFixtureWonders(hydrateTown(createZeroState()));state.freshStartPending=false;state.day=9;
 let {document}=await store.open('pixel',{legacyState:state,protect:true});document=(await store.action('pixel',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;const before={coins:document.state.coins,inventory:structuredClone(document.state.inventory),wonders:structuredClone(document.state.eventWonders),projects:structuredClone(document.state.projects??null)};
 for(const homeId of [14,15]){const day=document.state.day,c=homeId===14?originChallenge(day,document.state):postChallenge(day),board=homeId===14?c.solution:[c.solution],input={kind:'personal',operation:'home_activity',homeId,day,board,requestId:randomUUID(),expectedVersion:document.version},result=await store.action('pixel',input);document=result.document;assert.equal(result.receipt.cashDelta,0);assert.deepEqual(result.receipt.stockDelta,{});assert((await createSaveStore({directory}).action('pixel',input)).replayed);await assert.rejects(store.action('pixel',{...input,board:[]}),e=>e.code==='action_id_conflict');document=(await store.action('pixel',{...input,requestId:randomUUID(),expectedVersion:document.version})).document;assert.equal(document.state.homeActivities[homeId].completedDays,1);}
 const restored=await createSaveStore({directory}).current('pixel');assert.equal(restored.state.coins,before.coins);assert.deepEqual(restored.state.inventory,before.inventory);assert.deepEqual(restored.state.eventWonders,before.wonders);assert.deepEqual(restored.state.projects??null,before.projects);const fake=structuredClone(restored.state);fake.homeActivities[15].completedDays=999;await assert.rejects(store.save('pixel',{state:fake,expectedVersion:restored.version}),e=>e.code==='personal_state_conflict');
});
