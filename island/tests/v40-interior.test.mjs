import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkshopLevel,createWorkshopState,workshopAction as act,stepWorkshop as step,interiorReview} from '../src/workshopRules.js';
import {interiorCells,interiorPath,interiorWalker,checkInteriorPlacement,makeInteriorWalkthrough} from '../src/interiorDesign.js';
const start=(seed=731,d=2)=>{const s=createWorkshopState(makeWorkshopLevel(19,seed,d));act(s,{type:'start'});return s;};
function furnish(s){s.level.solution.forEach((p,value)=>{act(s,{type:'select',value});while(s.rotation!==(p.rotation||0))act(s,{type:'rotate'});act(s,{type:'cell',index:p.y*s.level.w+p.x});});}
function advance(s,seconds){for(let i=0;i<Math.ceil(seconds/.05);i++)step(s,.05);}
test('random room requests are reproducible, fully feasible, and increasingly constrained',()=>{
 const signatures=new Set(),windows=new Set(),doors=new Set();
 for(let d=1;d<=3;d++)for(let seed=1;seed<=100;seed++){
  const s=start(seed*79,d),l=s.level;assert.deepEqual(l,makeWorkshopLevel(19,seed*79,d));assert.equal(l.items.length,3+d);assert.equal(l.walls.length,2*(d-1));
  furnish(s);const r=interiorReview(s);assert(r.valid&&r.complete&&r.accessible&&r.cozy);assert.equal(r.score,100);assert.equal(r.quality,100);assert(r.checks.every(c=>c.ok));
  signatures.add(JSON.stringify(l.solution));windows.add(l.window);doors.add(l.door);assert.deepEqual(JSON.parse(JSON.stringify(l)),l);
 }assert(signatures.size>200);assert(windows.size>4);assert(doors.size>8);
});
test('all acceptance steps are adjacent legal floor cells and reach every furniture edge',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=24;seed++){
  const s=start(seed*131,d);furnish(s);const r=interiorReview(s),v=makeInteriorWalkthrough(s),blocked=new Set(r.blocked);assert(v);
  assert.equal(v.route[0],s.level.door);assert.equal(v.route.at(-1),s.level.door);assert(v.route.includes(s.level.window));assert.equal(v.stops.length,s.furniture.filter(p=>!p.floor).length+2);
  for(let i=0;i<v.route.length;i++){assert(!blocked.has(v.route[i]));if(i)assert.equal(Math.abs(v.route[i]%s.level.w-v.route[i-1]%s.level.w)+Math.abs((v.route[i]/s.level.w|0)-(v.route[i-1]/s.level.w|0)),1);}
  assert.equal(interiorPath(s.level,s.level.door,s.level.window,r.blocked).length,r.route.length);
 }
});
test('rug can actually lie under the chair while solid furniture cannot overlap',()=>{
 const s=start(61,1);furnish(s);const chair=s.furniture.find(p=>p.role==='seat'),rug=s.furniture.find(p=>p.floor),light=s.level.items.find(p=>p.role==='light');assert(interiorCells(chair,s.level).some(i=>interiorCells(rug,s.level).includes(i)));
 assert(!checkInteriorPlacement(s,light,chair.x,chair.y,0).ok);assert(interiorReview(s).complete);
});
test('doors, windows, pillars, out of bounds and malformed coordinates reject without consuming the selection',()=>{
 const s=start(42,3),before=JSON.stringify(s.furniture),item=s.level.items[0];
 for(const index of [-1,NaN,Infinity,s.level.w*s.level.h,s.level.door,s.level.window,s.level.walls[0]]){act(s,{type:'cell',index});assert.equal(JSON.stringify(s.furniture),before);assert.equal(s.furnitureHistory.length,0);}
 assert(!checkInteriorPlacement(s,item,-1,0).ok);assert(!checkInteriorPlacement(s,item,0,-1).ok);assert(!checkInteriorPlacement(s,item,0,0,9).ok);
});
test('moving one chosen piece and undo restore the exact original footprint and conditions',()=>{
 const s=start(89,3);furnish(s);const before=JSON.stringify(s.furniture),review=interiorReview(s);
 act(s,{type:'submit'});assert(s.walkthrough);
 const frozen=JSON.stringify(s.furniture);act(s,{type:'pickup',value:0});assert.equal(JSON.stringify(s.furniture),frozen);
 const editable=start(89,3);furnish(editable);act(editable,{type:'pickup',value:1});assert.equal(editable.furniture.length,5);assert.equal(editable.selected,1);assert.equal(editable.walkthrough,null);
 act(editable,{type:'undo'});assert.equal(JSON.stringify(editable.furniture),before);assert.deepEqual(interiorReview(editable),review);
});
test('a blocked window or isolated furniture fails real review even if all pieces are present',()=>{
 const s=start(311,3);furnish(s);
 const windowBlock=JSON.parse(JSON.stringify(s));windowBlock.furniture[0].x=windowBlock.level.window%windowBlock.level.w;windowBlock.furniture[0].y=0;assert(!interiorReview(windowBlock).complete);assert(!interiorReview(windowBlock).valid);
 const w=s.level.w,h=s.level.h;assert.deepEqual(interiorPath({w,h},0,w*h-1,[1,w]),[]);
 const duplicate=JSON.parse(JSON.stringify(s));duplicate.furniture[1]={...duplicate.furniture[0]};assert(!interiorReview(duplicate).valid);
});
test('floor footprint distance drives window and light conditions instead of only the top left corner',()=>{
 let found=false;
 for(let seed=1;seed<100&&!found;seed++){const s=start(seed,3);furnish(s);const chair=s.furniture[0],win={x:s.level.window%s.level.w,y:0};if(Math.abs(chair.x-win.x)+chair.y>1){assert(interiorReview(s).window);found=true;}}
 assert(found);
});
test('review does not pay or finish until actual animated route and all stops are complete',()=>{
 const s=start(53,3);furnish(s);act(s,{type:'submit'});assert(s.walkthrough);assert.equal(s.result,null);const first=s.walkthrough.step;
 step(s,.05);const p=interiorWalker(s);assert(p);assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.equal(s.result,null);assert.equal(s.walkthrough.step,first);
 for(let i=0;i<30;i++)act(s,{type:'submit'});assert.equal(s.walkthrough.step,first);advance(s,90);
 assert(s.result.passed);assert(s.walkthrough.done);assert(s.walkthrough.elapsed>4);assert(s.score<=1000);
 const old=JSON.stringify(s.result);act(s,{type:'pickup',value:0});act(s,{type:'submit'});advance(s,3);assert.equal(JSON.stringify(s.result),old);
});
test('timeout during the physical tour cannot produce a passed result',()=>{
 const s=start(21,1);furnish(s);s.t=s.level.time-.01;act(s,{type:'submit'});step(s,.05);assert.equal(s.result.passed,false);assert.equal(s.walkthrough.done,false);advance(s,30);assert.equal(s.result.passed,false);
});
test('undo is bounded and neither preview nor failed placements change furniture history',()=>{
 const s=start(71,2);act(s,{type:'inspectRoute'});assert(s.routeVisible);assert.equal(s.furnitureHistory.length,0);
 for(let i=0;i<70;i++){const p=s.level.solution[0];act(s,{type:'select',value:0});while(s.rotation!==p.rotation)act(s,{type:'rotate'});act(s,{type:'cell',index:p.y*s.level.w+p.x});act(s,{type:'pickup',value:0});}
 assert.equal(s.furnitureHistory.length,60);assert.equal(s.furniture.length,0);act(s,{type:'undo'});assert.equal(s.furniture.length,1);
});
