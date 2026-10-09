import test from 'node:test';
import assert from 'node:assert/strict';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop} from '../src/workshopRules.js';
import {BRUSH_SCHEMA,brushGuide,brushReview} from '../src/brushStudio.js';
import {createCraftGame,applyCraftEvent,applyCraftTrace,craftResult,neutralCraftGame} from '../src/craftGameReplay.js';
import {chooseAction,simulateWorkshop} from './v19-play-helpers.mjs';
const start=(seed=731,d=2)=>{const s=createWorkshopState(makeWorkshopLevel(24,seed,d));workshopAction(s,{type:'start'});workshopAction(s,{type:'color',index:s.level.strokes[0].color});return s;};
const tick=(s,n=30)=>{for(let i=0;i<n;i++)stepWorkshop(s,1/30);};
const down=s=>workshopAction(s,{type:'down',...brushGuide(s)});
const next=s=>{const p=s.level.strokes[s.stroke].points.find(p=>p.arc>s.arc+.15);if(p)workshopAction(s,{type:'point',x:p.x,y:p.y});};
test('drawing commissions reproduce four distinct motifs, with additional detail and tighter constraints by difficulty',()=>{
 const names=new Set();for(let seed=1;seed<=70;seed++)for(let d=1;d<=3;d++){
  const l=makeWorkshopLevel(24,seed,d);assert.deepEqual(l,makeWorkshopLevel(24,seed,d));assert.equal(l.schemaVersion,BRUSH_SCHEMA);assert.equal(l.strokes.length,[5,7,9][d-1]);names.add(l.commission);
  assert(l.strokes.every(v=>v.length>60&&v.points.every(p=>Number.isFinite(p.arc)&&p.x>210&&p.x<752&&p.y>112&&p.y<440)));assert.equal(l.minQuality,[65,73,80][d-1]);
 }assert.equal(names.size,4);
});
test('stationary holds, skipped paths and zero-time cursor spam cannot complete a stroke',()=>{
 const s=start();down(s);tick(s,120);assert.equal(s.arc,0);assert.equal(s.painted.length,0);
 const last=s.level.strokes[0].points.at(-1);workshopAction(s,{type:'point',x:last.x,y:last.y});tick(s);assert.equal(s.arc,0);assert(!s.brushAnchored);
 down(s);for(let i=0;i<300;i++){next(s);stepWorkshop(s,0);}assert.equal(s.arc,0);assert.equal(s.result,null);
});
test('wrong-color ink marks have a visible consequence and current-stroke rework actually clears them',()=>{
 const s=start();workshopAction(s,{type:'color',index:(s.level.strokes[0].color+1)%3});down(s);tick(s,1);next(s);tick(s,1);assert.equal(s.arc,0);assert(s.paperMarks.length);assert(s.strokeError>0);
 workshopAction(s,{type:'reworkStroke'});assert.equal(s.paperMarks.length,0);assert.equal(s.strokeError,0);assert.equal(s.strokeReports.length,0);
});
test('ink depletion, timed dipping and layer drying stop drawing without skipping its continuity requirements',()=>{
 const s=start();s.ink=.0001;down(s);tick(s,1);next(s);tick(s,1);assert.equal(s.arc,0);assert(!s.holding);workshopAction(s,{type:'dip'});assert.equal(s.mode,'dipping');assert(s.ink<1);tick(s,24);assert.equal(s.mode,'dipping');tick(s,2);assert.equal(s.mode,'drawing');assert.equal(s.ink,1);
 for(let f=0;f<2000&&!s.stroke;f++){const a=chooseAction(s);if(a)workshopAction(s,a);stepWorkshop(s,1/30);}assert.equal(s.stroke,1);assert(s.dryRemaining>0);const before=s.arc;down(s);tick(s,2);assert.equal(s.arc,before);
});
test('every drawing motif completes through real legal actions at every difficulty with a final reveal and nontrivial duration',()=>{
 for(let d=1;d<=3;d++)for(const seed of [1,5,17,731,891]){const {state:s}=simulateWorkshop(24,seed,d);assert(s.result?.passed,JSON.stringify({seed,d,status:s.status,arc:s.arc,stroke:s.stroke,mode:s.mode}));assert(s.t>25);assert(s.reveal>=3.2);assert.equal(s.strokeReports.length,s.level.strokes.length);assert(s.result.quality>=s.level.minQuality);}
});
test('authority replay and mid-stroke JSON restore produce the identical completion, without client quality input',()=>{
 const g=createCraftGame(24,891,3),events=[];let restored;
 for(let f=0;f<15000&&!craftResult(g);f++){
  const a=chooseAction(g.state);if(a)events.push({action:a});events.push({dt:1/30});applyCraftTrace(g,events.splice(0));
  if(!restored&&g.state.arc>60){restored=JSON.parse(JSON.stringify(g));neutralCraftGame(g);neutralCraftGame(restored);assert(!g.state.brushAnchored);}
  else if(restored){const a2=chooseAction(restored.state);if(a2)applyCraftEvent(restored,{action:a2});applyCraftEvent(restored,{dt:1/30});}
 }
 assert(craftResult(g)?.passed);assert.deepEqual(craftResult(g),craftResult(restored));assert.deepEqual(g.state.strokeReports,restored.state.strokeReports);
});
test('incorrect low-quality work cannot pass the final commission even if all strokes were recorded',()=>{
 const s=start(5,3);s.strokeReports=s.level.strokes.map(v=>({name:v.name,quality:50}));const r=brushReview(s);assert.equal(r.passed,false);assert.equal(r.required,80);
});
test('already persisted legacy three-stroke tickets retain their old rules and can finish',()=>{
 const l=makeWorkshopLevel(24,17,2);delete l.schemaVersion;delete l.commission;l.strokes=[0,1,2].map(color=>({color,points:Array.from({length:36},(_,i)=>({x:245+i*10,y:210+color*60}))}));l.radius=19;
 const s=createWorkshopState(l);workshopAction(s,{type:'start'});for(let f=0;f<1000&&!s.result;f++){const a=chooseAction(s);if(a)workshopAction(s,a);stepWorkshop(s,1/30);}assert(s.result?.passed);assert.equal(s.stroke,3);
});
