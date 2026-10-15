import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {HOME_NOTES,MELODY_BEAT,beatsForHold,midiFrequency,melodyChallenge,melodySolved,swatchChallenge,swatchFeedback,swatchSolved,swatchAllowed} from '../src/homeCreativeActivities.js';
import {evaluateHomeActivity} from '../src/homeActivities.js';

test('daily eight-note exercises vary, require pitch and length, and use the actual seven white-key pitches',()=>{
 assert.deepEqual(HOME_NOTES.map(n=>n.midi),[60,62,64,65,67,69,71]);assert.equal(midiFrequency(69),440);assert(Math.abs(midiFrequency(60)-261.625565)<.001);
 assert.equal(beatsForHold(.05),1);assert.equal(beatsForHold(MELODY_BEAT*1.45-.001),1);assert.equal(beatsForHold(MELODY_BEAT*1.45+.001),2);assert.equal(beatsForHold(-1),null);assert.equal(beatsForHold(NaN),null);
 const variants=new Set();for(let day=1;day<=365;day++){
  const c=melodyChallenge(day);assert.equal(c.solution.filter(p=>p.beats===2).length,2);assert(melodySolved(c,c.solution));assert(!melodySolved(c,c.board));variants.add(JSON.stringify(c.solution));
  const bad=structuredClone(c.solution);bad[2].note=(bad[2].note+1)%7;assert(!melodySolved(c,bad));bad[2]={...c.solution[2],beats:3-c.solution[2].beats};assert(!melodySolved(c,bad));
  for(const board of [null,[],c.solution.slice(0,7),[...c.solution,c.solution[0]],c.solution.map(p=>({...p,hidden:true})),c.solution.map(p=>({...p,note:7}))])assert(!melodySolved(c,board));
  assert(evaluateHomeActivity({homeId:12,board:c.solution},day));
 }assert(variants.size>300);
});
test('swatch feedback counts repeated materials once, and bounded complete histories reject extra moves after success',()=>{
 assert.deepEqual(swatchFeedback([0,0,1,2],[0,1,0,0]),{exact:1,misplaced:2});assert.deepEqual(swatchFeedback([1,1,1,1],[1,2,2,2]),{exact:1,misplaced:0});
 for(let n=0;n<1296;n++){
  const secret=Array.from({length:4},(_,i)=>Math.floor(n/6**i)%6);
  for(let j=0;j<6;j++){const guess=[j,j,(j+1)%6,(j+2)%6],f=swatchFeedback(secret,guess),exact=guess.filter((v,i)=>v===secret[i]).length,total=[0,1,2,3,4,5].reduce((sum,v)=>sum+Math.min(secret.filter(n=>n===v).length,guess.filter(n=>n===v).length),0);assert.deepEqual(f,{exact,misplaced:total-exact});}
 }
 const variants=new Set();for(let day=1;day<=365;day++){
  const c=swatchChallenge(day),wrong=c.secret.map((n,i)=>i===1?(n+1)%6:n);variants.add(c.secret.join(''));assert(c.secret.every((n,i)=>swatchAllowed(c,i,n)));assert(!swatchSolved(c,[]));assert(swatchSolved(c,[wrong,c.secret]));assert(!swatchSolved(c,[c.secret,wrong,c.secret]));assert(!swatchSolved(c,Array(13).fill(c.secret)));assert(!swatchSolved(c,[[6,0,0,0],c.secret]));assert(!swatchSolved(c,[[null,0,0,0],c.secret]));assert(evaluateHomeActivity({homeId:13,board:[wrong,c.secret]},day));
  const forbidden=[...c.secret];forbidden[0]=[0,1,2,3,4,5].find(n=>!swatchAllowed(c,0,n));assert(!swatchSolved(c,[forbidden,c.secret]));
 }assert(variants.size>250);assert.equal(swatchFeedback([0,1,2,3],[0,1,2,NaN]),null);
});
test('melody and swatch journals persist once and reject forged saves without creating stock or currency',async()=>{
 await mkdir('qa/v198',{recursive:true});const directory=await mkdtemp(resolve('qa/v198/creative-book-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());state.freshStartPending=false;
 let {document}=await store.open('pixel',{legacyState:state,protect:true});document=(await store.action('pixel',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
 const before={coins:document.state.coins,inventory:structuredClone(document.state.inventory)};
 for(const homeId of [12,13]){
  const day=document.state.day,board=homeId===12?melodyChallenge(day).solution:[swatchChallenge(day).secret],input={kind:'personal',operation:'home_activity',homeId,day,board,requestId:randomUUID(),expectedVersion:document.version};
  const r=await store.action('pixel',input);document=r.document;assert.equal(r.receipt.cashDelta,0);assert.deepEqual(r.receipt.stockDelta,{});assert.deepEqual(document.state.homeActivities[homeId].last.board,board);
  assert((await createSaveStore({directory}).action('pixel',input)).replayed);await assert.rejects(store.action('pixel',{...input,board:[]}),e=>e.code==='action_id_conflict');document=(await store.action('pixel',{...input,expectedVersion:document.version,requestId:randomUUID()})).document;assert.equal(document.state.homeActivities[homeId].completedDays,1);
 }
 const restored=await createSaveStore({directory}).current('pixel');assert.equal(restored.state.coins,before.coins);assert.deepEqual(restored.state.inventory,before.inventory);
 const fake=structuredClone(restored.state);fake.homeActivities[13].completedDays=100;await assert.rejects(store.save('pixel',{state:fake,expectedVersion:restored.version}),e=>e.code==='personal_state_conflict');
});
