import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {bakingChallenge,bakingIssues,bakingSolved,photographyChallenge,solvePhotoFrame,photoFrameValid,photographySolved,clampPhotoFrame} from '../src/homeEverydayActivities.js';
import {evaluateHomeActivity} from '../src/homeActivities.js';
test('daily baking schedules are solvable and reject overlapping stations, missing predecessors and late finishes',()=>{
 const variants=new Set();for(let day=1;day<=365;day++){
  const c=bakingChallenge(day);assert(bakingSolved(c,c.solution));assert(!bakingSolved(c,c.board));variants.add(JSON.stringify(c.tasks.map(t=>t.duration)));
  assert(c.solution.some((start,i)=>i>3&&start<c.solution[3]+c.tasks[3].duration),'Two orders actually interleave');
  const overlap=[...c.solution];overlap[4]=overlap[0];assert(bakingIssues(c,overlap).some(x=>x.startsWith('overlap:')));assert(!bakingSolved(c,overlap));
  const before=[...c.solution];before[2]=0;assert(bakingIssues(c,before).includes('order:2'));
  const late=[...c.solution];late[7]=c.deadline;assert(!bakingSolved(c,late));
  for(const board of [null,[],Array(8).fill(NaN),Array(8).fill(0),[...c.solution,0]])assert(!bakingSolved(c,board));
  assert(evaluateHomeActivity({homeId:6,board:c.solution},day));
 }assert(variants.size>100);
});
test('photo framing requires complete real subject bounds, correct magnification and composition in every daily brief',()=>{
 const variants=new Set();for(let day=1;day<=365;day++){
  const c=photographyChallenge(day),frames=c.shots.map(solvePhotoFrame);assert(photographySolved(c,frames));variants.add(JSON.stringify(frames));
  assert(!photographySolved(c,c.board));for(const [i,shot]of c.shots.entries()){
   const f=frames[i];assert(!photoFrameValid(shot,{...f,w:700}));assert(!photoFrameValid(shot,{...f,x:f.x+200}));assert(!photoFrameValid(shot,{...f,y:NaN}));assert(!photoFrameValid(shot,{...f,extra:'untrusted'}));
  }
  assert(!photographySolved(c,[...frames,frames[0]]));assert(evaluateHomeActivity({homeId:7,board:frames},day));
 }assert(variants.size>=6);const max=clampPhotoFrame({x:9000,y:9000,w:9000});assert(max.x+max.w<=1000);assert(max.y+max.w*.75<=660);
});
test('baker plans and photo albums persist exactly once without minting supplies or permitting forged autosaves',async()=>{
 await mkdir('qa/v195',{recursive:true});const directory=await mkdtemp(resolve('qa/v195/everyday-book-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());state.freshStartPending=false;
 let {document}=await store.open('pixel',{legacyState:state,protect:true});document=(await store.action('pixel',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
 const before={coins:document.state.coins,inventory:structuredClone(document.state.inventory)};
 for(const homeId of [6,7]){
  const day=document.state.day,board=homeId===6?bakingChallenge(day).solution:photographyChallenge(day).shots.map(solvePhotoFrame);
  const input={kind:'personal',operation:'home_activity',homeId,day,board,requestId:randomUUID(),expectedVersion:document.version},r=await store.action('pixel',input);document=r.document;
  assert.equal(r.receipt.cashDelta,0);assert.deepEqual(r.receipt.stockDelta,{});assert.deepEqual(document.state.homeActivities[homeId].last.board,board);
  assert((await createSaveStore({directory}).action('pixel',input)).replayed);await assert.rejects(store.action('pixel',{...input,board:[]}),e=>e.code==='action_id_conflict');
  document=(await store.action('pixel',{...input,expectedVersion:document.version,requestId:randomUUID()})).document;assert.equal(document.state.homeActivities[homeId].completedDays,1);
 }
 const restored=await createSaveStore({directory}).current('pixel');assert.equal(restored.state.coins,before.coins);assert.deepEqual(restored.state.inventory,before.inventory);
 const fake=structuredClone(restored.state);fake.homeActivities[7].completedDays=100;await assert.rejects(store.save('pixel',{state:fake,expectedVersion:restored.version}),e=>e.code==='personal_state_conflict');
});
