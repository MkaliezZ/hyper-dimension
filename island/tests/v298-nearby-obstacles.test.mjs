import test from 'node:test';
import assert from 'node:assert/strict';
import {nearbyObstacleTest} from '../src/nearbyObstacles.js';
import {findPath,findWorldPathForTheme,worldWalkableForTheme,WORLD_CELL} from '../src/world.js';
import {terrainMovementCost} from '../src/terrainNavigation.js';

test('strict circular avoidance retains the exact15pixel boundary across bucket edges',()=>{
 const points=[{x:0,y:0},{x:30,y:30},{x:-30,y:-30},{x:60.125,y:89.875}],blocked=nearbyObstacleTest(points),linear=(x,y)=>points.some(p=>Math.hypot(p.x-x,p.y-y)<15);
 for(const p of points)for(const dx of [-30,-15,-15+1e-10,-.01,0,.01,15-1e-10,15,30])for(const dy of [-30,-15,-.01,0,.01,15,30])assert.equal(blocked(p.x+dx,p.y+dy),linear(p.x+dx,p.y+dy));
 assert.equal(nearbyObstacleTest([{x:0,y:0}])(15,0),false);assert.equal(nearbyObstacleTest([{x:0,y:0}])(9,12),false);
});

test('dense, duplicate and dispersed moving crowds match full linear scanning',()=>{
 let seed=298;const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/2**32);
 for(const radius of [3.25,15,32]){
  const points=Array.from({length:220},(_,n)=>({x:n<40?60:random()*2800-100,y:n<40?90:random()*1500-100}));const blocked=nearbyObstacleTest(points,radius);
  for(let n=0;n<12000;n++){const x=random()*3000-200,y=random()*1700-200;assert.equal(blocked(x,y),points.some(p=>Math.hypot(p.x-x,p.y-y)<radius));}
 }
});

test('empty and nonfinite positions cannot create obstacles or nonterminating grid walks',()=>{
 assert.equal(nearbyObstacleTest([])(0,0),false);const points=[{x:NaN,y:0},{x:Infinity,y:1},{x:1e308,y:1e308},{x:0,y:0}],blocked=nearbyObstacleTest(points);
 assert.equal(blocked(0,0),true);assert.equal(blocked(NaN,0),false);assert.equal(blocked(Infinity,0),false);assert.equal(blocked(1e308,1e308),true);
 assert.equal(nearbyObstacleTest([{x:1,y:1}],Number.MIN_VALUE)(1,1),true);
 for(const radius of [0,-1,NaN,Infinity])assert.throws(()=>nearbyObstacleTest([],radius),TypeError);
});

test('both island styles retain exact route nodes with the original crowd collision predicate',()=>{
 for(const theme of ['pixel','origami']){
  const crowd=[{x:900,y:700},{x:912,y:700},{x:940.25,y:712.5},{x:840,y:660},{x:1050,y:810}];
  for(const [start,end]of [[{x:924,y:804},{x:750,y:546}],[{x:1044,y:360},{x:1308,y:696}],[{x:1200,y:804},{x:1536,y:648}]]){
   const blocked=(x,y)=>crowd.some(p=>Math.hypot(p.x-x,p.y-y)<15),free=(x,y)=>worldWalkableForTheme(theme,x,y)&&!blocked(x,y);
   const baseline=findPath(start,end,free,WORLD_CELL,terrainMovementCost,{theme,blocked});
   assert(baseline.length>0,'The comparison must include an actual navigable route');
   assert.deepEqual(findWorldPathForTheme(theme,start,end,crowd),baseline);
  }
 }
});
