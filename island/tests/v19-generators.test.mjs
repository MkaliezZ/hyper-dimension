import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSHOP_GAMES} from '../src/workshopCatalog.js';
import {ITEM_BY_ID} from '../src/contentCatalog.js';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop,flowPipes,solveNonogram,outfitScore} from '../src/workshopRules.js';
const start=l=>{const s=createWorkshopState(l);workshopAction(s,{type:'start'});return s};
test('all workshop generators are deterministic and have valid art references',()=>{
 for(const id of Object.keys(WORKSHOP_GAMES).map(Number))for(let d=1;d<=3;d++)for(let seed=1;seed<=12;seed++){
  const l=makeWorkshopLevel(id,seed,d);assert.deepEqual(l,makeWorkshopLevel(id,seed,d));
  for(const v of [...(l.ids||[]),...(l.items||[]).map(v=>v.id)])assert.ok(ITEM_BY_ID[v],id+': missing art '+v);
 }
});
test('joinery shapes can actually be placed using their generated solution',()=>{
 for(const id of [0,17])for(let d=1;d<=3;d++)for(let seed=1;seed<=40;seed++){
  const l=makeWorkshopLevel(id,seed,d),s=start(l);
  for(const a of l.solution){workshopAction(s,{type:'select',value:a.piece});for(let i=0;i<a.rotation;i++)workshopAction(s,{type:'rotate'});workshopAction(s,{type:'cell',index:a.anchor});}
  assert.ok(s.result?.passed,'joinery '+seed+'/'+d);
 }
});
test('every nonogram has exactly one solution and supports full legal play',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=25;seed++){
  const l=makeWorkshopLevel(5,seed,d);assert.equal(solveNonogram(l.rows,l.cols).length,1);
  const s=start(l);l.values.forEach((v,index)=>{if(v)workshopAction(s,{type:'cell',index})});assert.ok(s.result?.passed);
 }
});
test('all pipe layouts contain a leak-free network reaching every tank',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=40;seed++){const l=makeWorkshopLevel(6,seed,d);assert.ok(l.tanks.length);assert.ok(flowPipes(l.solved,l).complete);}
});
test('reverse-generated greenhouse puzzles have a legal forward solution',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=60;seed++){
  const l=makeWorkshopLevel(14,seed,d),s=start(l);for(const dir of l.solution)workshopAction(s,{type:'move',dir});
  assert.ok(s.result?.passed,'sokoban '+seed+'/'+d);
 }
});
test('couture goals can always be satisfied inside the budget',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=30;seed++){
  const l=makeWorkshopLevel(4,seed,d);assert.ok(l.solutions.length);for(const ids of l.solutions)assert.ok(outfitScore(ids.map(id=>l.items.find(i=>i.id===id)),l).complete);
 }
});
test('expedition has a connected complete route inside the stamina budget',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=30;seed++){
  const l=makeWorkshopLevel(22,seed,d),s=start(l);
  for(const to of l.solution){const dx=to%l.w-s.player%l.w,dy=(to/l.w|0)-(s.player/l.w|0);const dir=dy<0?0:dx>0?1:dy>0?2:3;workshopAction(s,{type:'move',dir});}
  assert.ok(s.result?.passed);assert.ok(s.stamina>=0);
 }
});
test('random room layouts can be furnished and accepted through a legal route',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=30;seed++){
  const l=makeWorkshopLevel(19,seed,d),s=start(l);
  l.solution.forEach((p,value)=>{workshopAction(s,{type:'select',value});while(s.rotation!==(p.rotation||0))workshopAction(s,{type:'rotate'});workshopAction(s,{type:'cell',index:p.y*l.w+p.x})});
  workshopAction(s,{type:'submit'});assert.ok(s.walkthrough);for(let frame=0;frame<3000&&!s.result;frame++)stepWorkshop(s,.05);assert.ok(s.result?.passed,seed+'/'+d);
 }
});
