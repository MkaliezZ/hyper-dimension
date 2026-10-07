import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop} from '../src/workshopRules.js';
import {potteryShapeReview,potteryGlazeReview,potteryKilnTarget,POTTERY_COLORS} from '../src/potteryStudio.js';
import {chooseAction,simulateWorkshop} from './v19-play-helpers.mjs';
const start=(seed=17,d=3)=>{const s=createWorkshopState(makeWorkshopLevel(15,seed,d));workshopAction(s,{type:'start'});return s};
const kilnFixture=(seed=17,d=3)=>{
 const s=start(seed,d);s.radii=[...s.level.target];workshopAction(s,{type:'submit'});
 s.glaze.fill(1);s.pigments=s.level.ringColors.map(color=>[0,1,2].map(c=>c===color?1:0));workshopAction(s,{type:'submit'});
 assert.equal(s.mode,'firing');return s;
};
test('pottery commissions vary reproducibly across actual forms, glaze bands and kiln curves',()=>{
 const forms=new Set(),patterns=new Set();for(let d=1;d<=3;d++)for(let seed=1;seed<=60;seed++){
  const l=makeWorkshopLevel(15,seed,d);assert.deepEqual(l,makeWorkshopLevel(15,seed,d));assert.deepEqual(JSON.parse(JSON.stringify(l)),l);
  assert.equal(l.glazeBands,[2,3,4][d-1]);assert.equal(l.ringColors.length,12);assert(l.target.every(v=>v>=55&&v<=160));
  for(const color of l.ringColors)assert(POTTERY_COLORS[color]);forms.add(l.formName);patterns.add(l.glazeOrder.join());
  assert.equal(potteryKilnTarget(l,0).temperature,20);assert.equal(potteryKilnTarget(l,l.kiln.duration).temperature,28);
 }
 assert.equal(forms.size,5);assert(patterns.size>6);
});
test('high average shape accuracy cannot hide an invalid mouth or a single bad wall section',()=>{
 const s=start();s.radii=[...s.level.target];s.radii[0]+=s.level.tolerance*1.6;
 assert(potteryShapeReview(s).accuracy>.9);workshopAction(s,{type:'submit'});assert.equal(s.mode,'shape');assert.equal(s.result,null);
 s.radii=[...s.level.target];s.radii[5]+=s.level.tolerance*1.6;assert(potteryShapeReview(s).accuracy>.9);
 workshopAction(s,{type:'submit'});assert.equal(s.mode,'shape');assert.match(s.status,/局部/);
});
test('full single-color coverage fails the actual multi-band commission; correct repainting repairs it',()=>{
 const s=start(93);s.radii=[...s.level.target];workshopAction(s,{type:'submit'});s.glaze.fill(1);s.pigments=s.pigments.map(()=>[1,0,0]);
 assert(!potteryGlazeReview(s).complete);workshopAction(s,{type:'submit'});assert.equal(s.mode,'glaze');assert.match(s.status,/釉带/);
 for(let f=0;f<2400&&s.mode==='glaze';f++){const a=chooseAction(s);if(a)workshopAction(s,a);stepWorkshop(s,1/30);}
 assert.equal(s.mode,'firing');assert(potteryGlazeReview(s).complete);
});
test('brush contact is local, must be on the actual vessel, and cannot silently repaint another band',()=>{
 const s=start();s.radii=[...s.level.target];workshopAction(s,{type:'submit'});const ring=2,p={x:480,y:125+ring/11*270};
 workshopAction(s,{type:'down',...p});for(let i=0;i<20;i++)stepWorkshop(s,.05);workshopAction(s,{type:'up'});
 assert(s.glaze[ring]>.8);const band=Math.floor(ring/(12/s.level.glazeBands));for(let i=0;i<12;i++)if(Math.floor(i/(12/s.level.glazeBands))!==band)assert.equal(s.glaze[i],0);
 const before=structuredClone(s.glaze);workshopAction(s,{type:'down',x:900,y:125});for(let i=0;i<20;i++)stepWorkshop(s,.05);assert.deepEqual(s.glaze,before);
});
test('invalid pointer, palette and thermal commands cannot corrupt state or bypass stage boundaries',()=>{
 const s=start();const radii=[...s.radii];for(const a of [{type:'point',x:NaN,y:200},{type:'down',x:480,y:Infinity},{type:'glazeColor',index:99},{type:'kilnFire',delta:10}])workshopAction(s,a);
 stepWorkshop(s,.05);assert.deepEqual(s.radii,radii);assert.equal(s.mode,'shape');assert.equal(s.kiln,null);
 const k=kilnFixture();const before=structuredClone(k.kiln);
 for(const a of [{type:'kilnFire',delta:Infinity},{type:'kilnVent',delta:100},{type:'kilnFire',delta:0},{type:'submit'},{type:'water'},{type:'rework'}])workshopAction(k,a);
 assert.deepEqual(k.kiln,before);assert.equal(k.mode,'firing');workshopAction(k,{type:'kilnFire',delta:10});assert.equal(k.kiln.fire,.6);
 assert.equal(k.kiln.actualFire,.5);assert.equal(k.kiln.temperature,20);
});
test('returning from glaze preserves actual clay shape and clears the old glaze without creating a result',()=>{
 const s=start();s.radii=[...s.level.target];workshopAction(s,{type:'submit'});s.glaze[0]=1;s.pigments[0]=[0,1,0];
 const radii=[...s.radii];workshopAction(s,{type:'rework'});assert.equal(s.mode,'shape');assert.deepEqual(s.radii,radii);
 assert(s.glaze.every(v=>v===0));assert(s.pigments.flat().every(v=>v===0));assert.equal(s.result,null);
});
test('a three-second wait no longer completes a kiln and unattended extreme controls fail',()=>{
 const s=kilnFixture();for(let i=0;i<60;i++)stepWorkshop(s,.05);assert.equal(s.result,null);assert.equal(s.mode,'firing');assert(s.kiln.temperature>20);
 for(const extreme of [0,1]){const s=kilnFixture(38);s.kiln.fire=extreme;s.kiln.actualFire=extreme;s.kiln.vent=extreme?0:1;
  for(let f=0;f<1800&&!s.result;f++)stepWorkshop(s,.05);assert(s.result);assert.equal(s.result.passed,false);assert(s.kiln.damage>18);}
});
test('legal player controls complete every tested form and all three stages before reveal and one result',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=24;seed++){
  const {state:s}=simulateWorkshop(15,seed,d);assert(s.result?.passed,seed+'/'+d);assert.equal(s.mode,'reveal');
  assert(s.kiln.elapsed+1e-9>=s.level.kiln.duration);assert(s.kiln.reveal>=3.4);assert(s.kiln.report.passed);assert(s.kiln.report.inBand<=1&&s.kiln.report.fidelity<=1);assert(s.result.quality>=80);
  assert(s.kiln.trace.length<=300);const result=structuredClone(s.result);for(let i=0;i<5;i++){workshopAction(s,{type:'submit'});stepWorkshop(s,.05)}assert.deepEqual(s.result,result);
 }
});
test('frame cadence changes do not make successful heat control depend on a single frame rate',()=>{
 for(const dt of [1/20,1/30,1/60]){
  const s=kilnFixture(58);for(let f=0;f<6000&&!s.result;f++){const a=chooseAction(s);if(a)workshopAction(s,a);stepWorkshop(s,dt);}
  assert(s.result?.passed,dt);assert(s.kiln.report.fidelity>.9);assert(s.kiln.report.damage<1);
 }
});
test('game timeout cannot produce an unfinished kiln result later',()=>{
 const s=kilnFixture();s.t=s.level.time-.02;stepWorkshop(s,.05);assert.equal(s.result.passed,false);assert.equal(s.mode,'firing');
 const r=structuredClone(s.result);for(let i=0;i<100;i++)stepWorkshop(s,.05);assert.deepEqual(s.result,r);assert(s.kiln.elapsed<s.level.kiln.duration);
});

test('dedicated pottery backgrounds are complete theme-specific PNG assets rather than woodworking panels',()=>{
 const files=['pixel','origami'].map(theme=>readFileSync(new URL('../public/assets/pottery-stage-'+theme+'-v41.png',import.meta.url)));
 for(const file of files){assert.equal(file.subarray(1,4).toString(),'PNG');assert(file.readUInt32BE(16)>1000);assert(file.readUInt32BE(20)>600);assert(file.length>200000);}
 assert.notDeepEqual(files[0],files[1]);
});

test('a narrow-neck guide inside the initial clay can actually be reached by holding it',()=>{
 const s=start(1,2),ring=0,goal=s.level.target[ring],initial=s.radii[ring];
 assert(initial-goal>42);
 workshopAction(s,{type:'down',x:480+goal,y:125});
 for(let i=0;i<180;i++)stepWorkshop(s,1/60);
 workshopAction(s,{type:'up'});
 assert(s.radii[ring]<initial-40);
 assert(Math.abs(s.radii[ring]-goal)<1,'target outline remains unreachable');
 assert.equal(s.phase,'playing');assert.equal(s.mode,'shape');assert.equal(s.result,null);
});

test('holding an already correct contour cannot deform neighbouring rings or make it fail review',()=>{
 const s=start(1,2);s.radii=[...s.level.target];s.wet=1;
 const before=[...s.radii],ring=5;
 workshopAction(s,{type:'down',x:480+s.level.target[ring],y:125+ring/11*270});
 for(let i=0;i<240;i++)stepWorkshop(s,1/60);
 workshopAction(s,{type:'up'});
 assert.deepEqual(s.radii,before);
 assert.equal(potteryShapeReview(s).accuracy,1);
 workshopAction(s,{type:'submit'});assert.equal(s.mode,'glaze');
});

test('left and right pulls are symmetric while outside and dry contact do not reshape clay',()=>{
 const right=start(1,2),left=start(1,2),goal=right.level.target[0];
 for(const [s,x] of [[right,480+goal],[left,480-goal]]) {
  workshopAction(s,{type:'down',x,y:125});
  for(let i=0;i<120;i++)stepWorkshop(s,1/60);
 }
 assert.deepEqual(right.radii,left.radii);
 const out=start(1,2),before=[...out.radii];
 workshopAction(out,{type:'down',x:900,y:125});for(let i=0;i<60;i++)stepWorkshop(out,1/60);
 assert.deepEqual(out.radii,before);
 out.wet=0;workshopAction(out,{type:'down',x:480+goal,y:125});for(let i=0;i<60;i++)stepWorkshop(out,1/60);
 assert.deepEqual(out.radii,before);
 workshopAction(out,{type:'water'});for(let i=0;i<60;i++)stepWorkshop(out,1/60);
 assert(out.radii[0]<before[0]);assert.equal(out.result,null);
});
