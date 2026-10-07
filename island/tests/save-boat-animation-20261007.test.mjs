import test from 'node:test';import assert from 'node:assert/strict';
import {createBoatVisualMotion} from '../src/boatVisualMotion.js';
const sea={x:1800,y:1100},berth={x:1500,y:950};
test('a saved sailing boat moves continuously without advancing logical time or producing arrivals',()=>{
 const view=createBoatVisualMotion({sea,berth}),b={id:1,phase:'approaching',t:3,x:1753.125,y:1076.5625};
 const before=structuredClone(b),a=view.sample(b,10),c=view.sample(b,11);
 assert(c.x<a.x&&c.y<a.y);assert.deepEqual(b,before);
 const resumed=view.sample({...b,t:3.05},11.05);assert(resumed.x<c.x);assert(Math.hypot(resumed.x-c.x,resumed.y-c.y)<5);
});
test('the visible arc holds at the endpoint until the authoritative phase changes',()=>{
 const view=createBoatVisualMotion({sea,berth}),b={id:2,phase:'approaching',t:11,x:1505,y:955};
 view.sample(b,1);assert.deepEqual(view.sample(b,9),berth);
 assert.equal(b.phase,'approaching');assert.equal(b.t,11);
 const moored={...b,phase:'moored',t:0,...berth};assert.deepEqual(view.sample(moored,10),berth);
 const leaving={...moored,phase:'leaving'};assert.deepEqual(view.sample(leaving,11),berth);
 assert.deepEqual(view.sample(leaving,30),sea);assert.equal(leaving.phase,'leaving');
});
test('restore, removal and a reused identity cannot inherit an old boat timeline',()=>{
 const view=createBoatVisualMotion({sea,berth}),b={id:3,phase:'leaving',t:5,...berth};
 view.sample(b,20);const far=view.sample(b,25);view.retain([]);
 const fresh=view.sample({...b,t:0},26);assert.deepEqual(fresh,berth);assert(far.x>fresh.x);
 view.sample({...b,t:5},27);const restored=view.sample({...b,t:1},28);
 const control=createBoatVisualMotion({sea,berth}).sample({...b,t:1},28);assert.deepEqual(restored,control);
});

test('theme changes use the current harbor coordinates instead of captured old anchors',()=>{
 const route={sea:{...sea},berth:{...berth}},view=createBoatVisualMotion(route),b={id:4,phase:'approaching',t:3,...sea};view.sample(b,1);view.sample(b,2);
 route.sea={x:2100,y:1300};route.berth={x:1400,y:800};
 const moved=view.sample(b,3),expected=createBoatVisualMotion(route).sample(b,3);assert.deepEqual(moved,expected);
});
