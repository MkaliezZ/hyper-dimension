import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {gatheringChallenge,gatheringSolved,solveGathering,seatGuest,starChartChallenge,starChartSolved} from '../src/homeSocialActivities.js';
import {evaluateHomeActivity} from '../src/homeActivities.js';

const permutations=list=>list.length?list.flatMap((x,i)=>permutations(list.filter((_,j)=>j!==i)).map(rest=>[x,...rest])):[[]];
test('four actual guest cards have a unique daily arrangement, swap safely, and never duplicate a guest',()=>{
  const seen=new Set();
  for(let day=1;day<=180;day++){
    const c=gatheringChallenge(day),solution=solveGathering(c);assert(solution);assert.equal(permutations(c.guests).filter(p=>gatheringSolved(c,p)).length,1);
    let board=[...c.board];for(let seat=0;seat<4;seat++)board=seatGuest(c,board,solution[seat],seat);assert(gatheringSolved(c,board));seen.add(board.join(','));
    const swapped=seatGuest(c,board,board[0],1);assert.equal(swapped[0],board[1]);assert.equal(new Set(swapped).size,4);assert(!gatheringSolved(c,swapped));
    assert(!gatheringSolved(c,[...solution,99]));assert(!gatheringSolved(c,Array(4).fill(solution[0])));assert.equal(seatGuest(c,board,99,0),null);
  }
  assert(seen.size>100);
});
test('sky observations uniquely identify stars and reject wrong order, incomplete traces and forged indices',()=>{
  const seen=new Set();for(let day=1;day<=180;day++){
    const c=starChartChallenge(day),answer=c.targets.map(t=>t.starId);seen.add(answer.join(','));assert.equal(new Set(answer).size,6);assert(starChartSolved(c,answer));
    for(const target of c.targets)assert.equal(c.stars.filter(s=>s.sector===target.sector&&s.color===target.color&&s.bright===target.bright).length,1);
    assert(!starChartSolved(c,[...answer].reverse()));assert(!starChartSolved(c,answer.slice(0,5)));assert(!starChartSolved(c,[...answer,99]));
    assert(evaluateHomeActivity({homeId:3,board:answer},day));assert.equal(evaluateHomeActivity({homeId:3,board:[]},day),null);
  }
  assert(seen.size>170);
});
test('both new journals survive restart and retries, reject tampered saves and mint no economy rewards',async()=>{
  await mkdir('qa/v192',{recursive:true});const directory=await mkdtemp(resolve('qa/v192/social-book-')),store=createSaveStore({directory});
  const state=hydrateTown(createZeroState());state.freshStartPending=false;let {document}=await store.open('origami',{legacyState:state,protect:true});
  document=(await store.action('origami',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
  const initial={coins:document.state.coins,inventory:structuredClone(document.state.inventory)};
  for(const homeId of [2,3]){
    const day=document.state.day,board=homeId===2?solveGathering(gatheringChallenge(day)):starChartChallenge(day).targets.map(t=>t.starId);
    const input={kind:'personal',operation:'home_activity',homeId,day,board,requestId:randomUUID(),expectedVersion:document.version};
    const result=await store.action('origami',input);document=result.document;assert.equal(result.receipt.cashDelta,0);assert.deepEqual(result.receipt.stockDelta,{});
    const replay=await createSaveStore({directory}).action('origami',input);assert(replay.replayed);assert.equal(replay.document.state.homeActivities[homeId].completedDays,1);
    await assert.rejects(store.action('origami',{...input,board:[...board].reverse()}),e=>e.code==='action_id_conflict');
    document=(await store.action('origami',{...input,expectedVersion:document.version,requestId:randomUUID()})).document;assert.equal(document.state.homeActivities[homeId].completedDays,1);
  }
  const restored=await createSaveStore({directory}).current('origami');assert.equal(restored.state.coins,initial.coins);assert.deepEqual(restored.state.inventory,initial.inventory);
  const fake=structuredClone(restored.state);fake.homeActivities[3].last.board=[];await assert.rejects(store.save('origami',{state:fake,expectedVersion:restored.version}),e=>e.code==='personal_state_conflict');
});
