import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {BOTANICALS,botanicalChallenge,botanicalSolved,solveBotanical,placeBotanical,riggingChallenge,traceRope} from '../src/homeCraftActivities.js';
import {evaluateHomeActivity} from '../src/homeActivities.js';

test('pressed specimen layouts alternate distinct real materials, support swaps and reject forged boards',()=>{
 const variants=new Set();for(let day=1;day<=240;day++){
  const c=botanicalChallenge(day),answer=solveBotanical(c);assert(c.palette.every(id=>BOTANICALS[id].name));assert(botanicalSolved(c,answer));assert(!botanicalSolved(c,c.board));variants.add(answer.join(','));
  let board=c.board;answer.forEach((id,i)=>{board=placeBotanical(c,board,id,i);});assert.deepEqual(board,answer);
  const wrong=placeBotanical(c,board,board[0],1);assert(!botanicalSolved(c,wrong));assert.equal(new Set(wrong).size,7);
  for(const forged of [null,[],Array(7).fill(answer[0]),[...answer,'rose'],['forged',...answer.slice(1)]])assert(!botanicalSolved(c,forged));
  assert(evaluateHomeActivity({homeId:4,board},day));assert.equal(evaluateHomeActivity({homeId:4,board:wrong},day),null);
 }
 assert(variants.size>70);assert.equal(placeBotanical(botanicalChallenge(1),[], 'rose',0),null);
});
test('rotating rope boards have continuous daily solutions, fixed terminals, and no already solved starts',()=>{
 const routes=new Set(),starts=new Set();for(let day=1;day<=365;day++){
  const c=riggingChallenge(day),result=traceRope(c,c.solution);assert(result.solved);assert.deepEqual(result.path,c.route);assert(c.route.length>=7);assert(!traceRope(c,c.board).solved);routes.add(c.route.join(','));starts.add(c.board.join(','));
  const forged=[...c.solution];forged[c.start]=(forged[c.start]+1)%4;assert(!traceRope(c,forged).solved);
  for(const wrong of [null,[],Array(16).fill(NaN),Array(16).fill(4),[...c.solution,0]])assert(!traceRope(c,wrong).solved);
  assert(evaluateHomeActivity({homeId:5,board:c.solution},day));assert.equal(evaluateHomeActivity({homeId:5,board:c.board},day),null);
 }
 assert(routes.size>=10);assert(starts.size>350);
});
test('both craft journals persist, cannot replay changed boards, and do not manufacture economic rewards',async()=>{
 await mkdir('qa/v193',{recursive:true});const directory=await mkdtemp(resolve('qa/v193/craft-book-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());state.freshStartPending=false;
 let {document}=await store.open('pixel',{legacyState:state,protect:true});document=(await store.action('pixel',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
 const before={coins:document.state.coins,inventory:structuredClone(document.state.inventory)};
 for(const homeId of [4,5]){
  const day=document.state.day,board=homeId===4?solveBotanical(botanicalChallenge(day)):riggingChallenge(day).solution;
  const input={kind:'personal',operation:'home_activity',homeId,day,board,requestId:randomUUID(),expectedVersion:document.version},result=await store.action('pixel',input);document=result.document;
  assert.equal(result.receipt.cashDelta,0);assert.deepEqual(result.receipt.stockDelta,{});
  assert((await createSaveStore({directory}).action('pixel',input)).replayed);
  await assert.rejects(store.action('pixel',{...input,board:[]}),e=>e.code==='action_id_conflict');
  document=(await store.action('pixel',{...input,expectedVersion:document.version,requestId:randomUUID()})).document;assert.equal(document.state.homeActivities[homeId].completedDays,1);
 }
 const restored=await createSaveStore({directory}).current('pixel');assert.equal(restored.state.coins,before.coins);assert.deepEqual(restored.state.inventory,before.inventory);
 const fake=structuredClone(restored.state);fake.homeActivities[4].completedDays=100;await assert.rejects(store.save('pixel',{state:fake,expectedVersion:restored.version}),e=>e.code==='personal_state_conflict');
});
