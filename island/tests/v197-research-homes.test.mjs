import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {archiveChallenge,archiveIssues,archiveSolved,placeArchive,strataChallenge,strataSolved,validStrata,swapStrata,turnStrata,strataConnections,strataSVG} from '../src/homeResearchActivities.js';
import {evaluateHomeActivity} from '../src/homeActivities.js';

test('daily archive briefs distinguish event time from document date and support unique timeline placement',()=>{
 const variants=new Set();for(let day=1;day<=365;day++){
  const c=archiveChallenge(day);assert(archiveSolved(c,c.solution));assert(!archiveSolved(c,c.board));assert.equal(new Set(c.events.map(e=>e.at)).size,6);assert(c.events.every(e=>e.options.filter(o=>o.verified).length===1));variants.add(JSON.stringify(c.solution));
  const badSource=[...c.solution];badSource[6]=(badSource[6]+1)%3;assert(!archiveSolved(c,badSource));assert.equal(archiveIssues(c,badSource).sources,5);
  const reversed=[...c.solution.slice(0,6).reverse(),...c.solution.slice(6)];assert(!archiveSolved(c,reversed));assert(!archiveIssues(c,reversed).ordered);
  for(const invalid of [null,[],Array(12).fill(null),[...c.solution,0],c.solution.map(()=>NaN)])assert(!archiveSolved(c,invalid));
  const duplicate=[...c.solution];duplicate[1]=duplicate[0];assert(!archiveSolved(c,duplicate));
  let board=[...c.board];board=placeArchive(board,0,0);board=placeArchive(board,1,1);board=placeArchive(board,0,1);assert.deepEqual(board.slice(0,2),[1,0]);assert.equal(placeArchive(board,6,2),null);assert.equal(placeArchive(board,0,-1),null);
  assert(evaluateHomeActivity({homeId:10,board:c.solution},day));
 }assert(variants.size>300);
});
test('daily mineral sections vary, can be reconstructed by swaps and turns, and reject malformed slices',()=>{
 const layouts=new Set(),art=new Set();for(let day=1;day<=365;day++){
  const c=strataChallenge(day);assert(validStrata(c.board));assert(!strataSolved(c,c.board));assert(strataSolved(c,c.solution));assert.equal(strataConnections(c.solution).length,12);layouts.add(JSON.stringify(c.board));
  let board=structuredClone(c.board);for(let target=0;target<9;target++){const index=board.findIndex(p=>p.tile===target);board=swapStrata(board,index,target);while(board[target].r)board=turnStrata(board,target);}
  assert.deepEqual(board,c.solution);assert.deepEqual(c.board,strataChallenge(day).board);
  for(const bad of [null,[],Array(9).fill({tile:0,r:0}),c.solution.map(p=>({...p,r:4})),c.solution.map(p=>({...p,hidden:true}))])assert(!strataSolved(c,bad));
  assert.equal(turnStrata(c.board,9),null);assert.equal(swapStrata(c.board,0,-1),null);assert(evaluateHomeActivity({homeId:11,board:c.solution},day));
  const svg=strataSVG(c);assert(svg.startsWith('<svg'));assert(!svg.includes('undefined'));assert.equal(svg,strataSVG(c));assert.notEqual(svg,strataSVG(c,'pixel'));art.add(createHash('sha256').update(svg).digest('hex'));
 }assert(layouts.size>300);assert.equal(art.size,365);
});
test('research journals persist once on server restart and cannot mint or forge personal progress',async()=>{
 await mkdir('qa/v197',{recursive:true});const directory=await mkdtemp(resolve('qa/v197/research-book-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());state.freshStartPending=false;
 let {document}=await store.open('origami',{legacyState:state,protect:true});document=(await store.action('origami',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
 const before={coins:document.state.coins,inventory:structuredClone(document.state.inventory)};
 for(const homeId of [10,11]){
  const day=document.state.day,board=homeId===10?archiveChallenge(day).solution:strataChallenge(day).solution;
  const input={kind:'personal',operation:'home_activity',homeId,day,board,requestId:randomUUID(),expectedVersion:document.version},r=await store.action('origami',input);document=r.document;
  assert.equal(r.receipt.cashDelta,0);assert.deepEqual(r.receipt.stockDelta,{});assert.deepEqual(document.state.homeActivities[homeId].last.board,board);
  assert((await createSaveStore({directory}).action('origami',input)).replayed);await assert.rejects(store.action('origami',{...input,board:[]}),e=>e.code==='action_id_conflict');
  document=(await store.action('origami',{...input,expectedVersion:document.version,requestId:randomUUID()})).document;assert.equal(document.state.homeActivities[homeId].completedDays,1);
 }
 const restored=await createSaveStore({directory}).current('origami');assert.equal(restored.state.coins,before.coins);assert.deepEqual(restored.state.inventory,before.inventory);
 const fake=structuredClone(restored.state);fake.homeActivities[10].completedDays=100;await assert.rejects(store.save('origami',{state:fake,expectedVersion:restored.version}),e=>e.code==='personal_state_conflict');
});
