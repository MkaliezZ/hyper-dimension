import {test} from 'node:test';
import assert from 'node:assert/strict';
import {advanceResultPresentation,RESULT_REVEAL_SECONDS} from '../src/workshopPresentation.js';
import {createCraftGame,applyCraftTrace,craftResult} from '../src/craftGameReplay.js';
const completed=()=>({phase:'celebrating',celebration:0,t:42,remaining:100,score:950,result:{passed:true,quality:95,score:950,seconds:42},inventory:{}});
test('result reveal completes in visible seconds at high and low FPS without advancing gameplay or earnings',()=>{
 for(const interval of [1/144,1/60,.12,.75,1.1,4]){
  const state=completed(),before=structuredClone(state);let elapsed=0;
  while(state.phase!=='result'){elapsed+=interval;advanceResultPresentation(state,interval);assert(elapsed<5);}
  assert(elapsed<RESULT_REVEAL_SECONDS+interval+.001);assert.equal(state.celebration,RESULT_REVEAL_SECONDS);
  const expected={...before,phase:'result',celebration:RESULT_REVEAL_SECONDS};assert.deepEqual(state,expected);
 }
});
test('hidden, paused, transport-paused and incomplete games cannot advance presentation or create a result',()=>{
 for(const flags of [{hidden:true},{paused:true},{transportPaused:true}]){const s=completed();assert(!advanceResultPresentation(s,60,flags));assert.equal(s.celebration,0);}
 for(const elapsed of [NaN,Infinity,-10,0]){const s=completed();assert(!advanceResultPresentation(s,elapsed));assert.equal(s.celebration,0);}
 const s={phase:'playing',t:9,result:null};assert(!advanceResultPresentation(s,60));assert.deepEqual(s,{phase:'playing',t:9,result:null});
});
test('server replay recognizes the actual winning inputs before any visual celebration ticks',()=>{
 const game=createCraftGame(14,194,1),events=[{action:{type:'start'}},...game.state.level.solution.map(dir=>({action:{type:'move',dir}}))];
 applyCraftTrace(game,events);assert(craftResult(game)?.passed);assert.equal(game.state.phase,'celebrating');
 const result=structuredClone(craftResult(game)),elapsed=game.elapsed;advanceResultPresentation(game.state,3);
 assert.deepEqual(craftResult(game),result);assert.equal(game.elapsed,elapsed);
});
