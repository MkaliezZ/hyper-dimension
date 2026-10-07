import test from 'node:test';
import assert from 'node:assert/strict';
import {WORKSHOP_GAMES} from '../src/workshopCatalog.js';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop,finishWorkshop} from '../src/workshopRules.js';
import {simulateWorkshop} from './v19-play-helpers.mjs';
for(const [id,g] of Object.entries(WORKSHOP_GAMES)){
 test(g.kind+' #'+id+' is completable through legal actions at all difficulties',()=>{
  for(let d=1;d<=3;d++)for(const seed of [731,891]){
   const {state:s,actions}=simulateWorkshop(+id,seed,d);
   assert.ok(s.result?.passed,JSON.stringify({id,d,seed,t:s.t,status:s.status,phase:s.phase,mode:s.mode,actions,progress:s.progress,gate:s.gate,boat:s.boat,hull:s.hull,lit:s.lit,shots:s.shots,accuracy:s.accuracy,glaze:s.glaze,shot:s.shot,photos:s.photos}));
   assert.ok(s.result.quality>=55&&s.result.quality<=100);assert.ok(s.t>0);
  }
 });
}
test('timed failures and completed games freeze input and outcomes',()=>{
 for(const id of [1,2,8,12,13,16,20,22,23]){
  const s=createWorkshopState(makeWorkshopLevel(id,41,2));workshopAction(s,{type:'start'});
  for(let t=0;t<12000&&!s.result;t++)stepWorkshop(s,.05);
  assert.equal(s.result?.passed,false,'idle timeout '+id);const r=JSON.stringify(s.result);finishWorkshop(s,true,100);workshopAction(s,{type:'start'});assert.equal(JSON.stringify(s.result),r);
 }
});
test('constant rhythm spam cannot pass and early long-note release is penalized',()=>{
 const s=createWorkshopState(makeWorkshopLevel(12,71,3));workshopAction(s,{type:'start'});
 for(let i=0;i<3000&&!s.result;i++){for(let lane=0;lane<4;lane++){workshopAction(s,{type:'lane',lane});workshopAction(s,{type:'releaseLane',lane})}stepWorkshop(s,.05)}
 assert.equal(s.result?.passed,false);assert.ok(s.strays>10);
});
test('wrong ingredients, overcooking, and tight lines have actual consequences',()=>{
 const s=createWorkshopState(makeWorkshopLevel(2,731,2));workshopAction(s,{type:'start'});stepWorkshop(s,.05);
 for(let i=0;i<2;i++)workshopAction(s,{type:'ingredient',index:(s.level.orders[0].ingredients[0]+1)%5});
 for(let i=0;i<4;i++)workshopAction(s,{type:'cut'});workshopAction(s,{type:'cook'});assert.equal(s.jobs[0].state,'prep');assert.equal(s.strikes,1);
 const a=createWorkshopState(makeWorkshopLevel(16,731,2));workshopAction(a,{type:'start'});
 const spot=a.level.spots[0];workshopAction(a,{type:'down',x:spot.x-a.level.wind,y:spot.y});workshopAction(a,{type:'up'});
 while(a.mode!=='bite')stepWorkshop(a,.05);workshopAction(a,{type:'down',x:spot.x,y:spot.y});
 for(let n=0;n<500&&a.mode==='fight';n++)stepWorkshop(a,.05);assert.equal(a.escape,1);
});
