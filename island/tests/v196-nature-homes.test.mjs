import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
import {PACK_ITEMS,packAnchor,voyageChallenge,voyageSolved,packingOccupancy,placePacking,suitableDeparture,leafChallenge,leafSolved,solveLeaf} from '../src/homeNatureActivities.js';
import {evaluateHomeActivity} from '../src/homeActivities.js';

test('365 travel case briefs have feasible packing and one suitable departure; collisions, bounds and forged cells fail',()=>{
 const variants=new Set();assert(PACK_ITEMS.every(p=>CATALOG_ITEMS.some(i=>i.id===p.id)));
 for(let day=1;day<=365;day++){
  const c=voyageChallenge(day);assert(voyageSolved(c,c.solution));assert(!voyageSolved(c,c.board));assert.equal(c.forecast.filter(suitableDeparture).length,1);variants.add(JSON.stringify([c.blocked,c.forecast]));
  let board=[...c.board];for(let i=0;i<6;i++){const p=c.solution[i+1],[ax,ay]=packAnchor(PACK_ITEMS[i],p.r);assert(!c.blocked.includes((p.y+ay)*6+p.x+ax),'Every solution has an enabled native click anchor, even concave pieces');board=placePacking(c,board,i,p.x,p.y,p.r);assert(board);}board[0]=c.solution[0];assert(voyageSolved(c,board));
  const full=packingOccupancy(c,board.slice(1));assert.equal(full.filter(v=>v===-1).length,3);assert.equal(full.filter(v=>v===null).length,0);
  const wrong=structuredClone(board);wrong[0]=(board[0]+1)%4;assert(!voyageSolved(c,wrong));
  for(const placement of [{x:-1,y:0,r:0},{x:5,y:3,r:0},{x:0,y:0,r:4},{...board[1],hidden:'forged'}]){const invalid=structuredClone(board);invalid[1]=placement;assert(!voyageSolved(c,invalid));}
  const overlap=structuredClone(board);overlap[2]={...overlap[1]};assert(!voyageSolved(c,overlap));
  const blocked=c.blocked[0];assert.equal(placePacking(c,board,0,blocked%6,Math.floor(blocked/6),0),null);
  assert(evaluateHomeActivity({homeId:8,board},day));
 }assert(variants.size>20);
});
test('daily leaf silhouettes have unique clue-only solutions and require explicit blank marks',()=>{
 const variants=new Set();for(let day=1;day<=365;day++){
  const c=leafChallenge(day),solutions=solveLeaf(c);assert.equal(solutions.length,1);assert.deepEqual(solutions[0],c.solution);assert(leafSolved(c,c.solution));assert(!leafSolved(c,c.board));variants.add(c.solution.join(''));
  const unknown=c.solution.map(v=>v===2?0:v);assert(!leafSolved(c,unknown));const bad=[...c.solution];bad[0]=bad[0]===1?2:1;assert(!leafSolved(c,bad));
  for(const invalid of [null,[],Array(36).fill(1),Array(36).fill(2),Array(36).fill(NaN),[...c.solution,2]])assert(!leafSolved(c,invalid));
  assert(evaluateHomeActivity({homeId:9,board:c.solution},day));
 }assert(variants.size>=12);
});
test('travel and specimen journals commit once, survive restart and reject forged autosave without minting goods',async()=>{
 await mkdir('qa/v196',{recursive:true});const directory=await mkdtemp(resolve('qa/v196/nature-book-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());state.freshStartPending=false;
 let {document}=await store.open('pixel',{legacyState:state,protect:true});document=(await store.action('pixel',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
 const before={coins:document.state.coins,inventory:structuredClone(document.state.inventory)};
 for(const homeId of [8,9]){
  const day=document.state.day,board=homeId===8?voyageChallenge(day).solution:leafChallenge(day).solution;
  const input={kind:'personal',operation:'home_activity',homeId,day,board,requestId:randomUUID(),expectedVersion:document.version},r=await store.action('pixel',input);document=r.document;
  assert.equal(r.receipt.cashDelta,0);assert.deepEqual(r.receipt.stockDelta,{});assert.deepEqual(document.state.homeActivities[homeId].last.board,board);
  assert((await createSaveStore({directory}).action('pixel',input)).replayed);await assert.rejects(store.action('pixel',{...input,board:[]}),e=>e.code==='action_id_conflict');
  document=(await store.action('pixel',{...input,expectedVersion:document.version,requestId:randomUUID()})).document;assert.equal(document.state.homeActivities[homeId].completedDays,1);
 }
 const restored=await createSaveStore({directory}).current('pixel');assert.equal(restored.state.coins,before.coins);assert.deepEqual(restored.state.inventory,before.inventory);
 const fake=structuredClone(restored.state);fake.homeActivities[9].completedDays=100;await assert.rejects(store.save('pixel',{state:fake,expectedVersion:restored.version}),e=>e.code==='personal_state_conflict');
});
