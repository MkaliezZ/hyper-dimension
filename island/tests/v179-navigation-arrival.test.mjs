import test from 'node:test';import assert from 'node:assert/strict';
import {followPath,followPendingPath,navigationArrival} from '../src/movement.js';
test('a view opens at the destination during a long background receipt, once and within the route speed budget',()=>{
 let views=0;const a={x:0,y:0,path:[{x:12,y:0},{x:24,y:0}],after:navigationArrival(()=>views++)};
 for(let i=0;i<80;i++){const before=a.x;followPendingPath(a,1/8,142);assert(a.x-before<=142/8+1e-8);}
 assert.equal(a.x,24);assert.equal(a.path.length,0);assert.equal(a.after,null);assert.equal(views,1);followPath(a,1,142);assert.equal(views,1);
});
test('an arrived view callback may reset the scene without a stale door waypoint being restored',()=>{
 const a={x:0,y:0,path:[{x:1,y:0}]};let count=0;a.after=navigationArrival(()=>{count++;a.x=500;a.y=545;a.path=[];a.after=null;});followPendingPath(a,.1,142);assert.deepEqual([a.x,a.y],[500,545]);assert.equal(a.path.length,0);assert.equal(a.after,null);followPendingPath(a,.1,142);assert.equal(count,1);
});
test('a view opening cannot cause a newly planned material-work callback to run before confirmation',()=>{
 let work=0;const a={x:0,y:0,path:[{x:1,y:0}]};a.after=navigationArrival(()=>{a.path=[{x:2,y:0}];a.after=()=>work++;});followPendingPath(a,.1,142);for(let i=0;i<100;i++)followPendingPath(a,.1,142);assert.equal(work,0);assert.equal(a.x,2);assert.equal(a.path.length,1);followPath(a,.1,142);assert.equal(work,1);
});
test('unmarked gathering, crafting and passenger transfers still wait at their endpoint until confirmation',()=>{
 for(const kind of ['gather','craft','transfer']){let delivered=0;const a={x:0,y:0,path:[{x:1,y:0}],after:()=>delivered++};for(let i=0;i<100;i++)followPendingPath(a,.1,142);assert.equal(delivered,0,kind);assert.equal(a.path.length,1);followPath(a,.1,142);assert.equal(delivered,1);}
});
test('no elapsed time cannot move a view route through a nonzero step',()=>{
 let views=0;const a={x:0,y:0,path:[{x:1,y:0}],after:navigationArrival(()=>views++)};followPendingPath(a,0,142);assert.equal(a.x,0);assert.equal(views,0);assert.equal(a.path.length,1);
});
test('a confirmed-distance wait eases into idle while the work receipt remains pending',()=>{
 let work=0;const a={x:24,y:0,path:[{x:24,y:0}],after:()=>work++,walking:true,walkMix:1,phase:2};for(let i=0;i<80;i++)followPendingPath(a,1/8,142);assert.equal(work,0);assert.equal(a.path.length,1);assert.equal(a.walking,false);assert(a.walkMix<.001);assert.equal(a.phase,2);followPath(a,1/8,142);assert.equal(work,1);
});
test('an empty route also eases its old walking pose during a background receipt',()=>{
 const a={x:500,y:545,path:[],walking:true,walkMix:1};for(let i=0;i<20;i++)followPendingPath(a,.05,130);assert.equal(a.walking,false);assert(a.walkMix<.001);assert.deepEqual([a.x,a.y],[500,545]);
});
