import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {HARBOR,SLOTS,createState,setWorldTheme,findPath,worldWalkable} from '../src/world.js';
import {arrivalRoute,returnRoute,boardingRoute,harborSurfaceWalkable} from '../src/harborNavigation.js';
import {hydrateTown,TOURISTS} from '../src/townSimulation.js';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {followPath} from '../src/movement.js';
const report=[];
function surface(x,y){return worldWalkable(x,y)||harborSurfaceWalkable(x,y,true)}
function continuousRoute(start,points,valid){let a=start;for(const b of points){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2));for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;assert.ok(valid(x,y),'route leaves decking at '+x+','+y)}a=b}}
for(const theme of ['pixel','origami']){
 test(theme+': continuous bridge routes and spaced queue seats',()=>{
  setWorldTheme(theme);
  continuousRoute(HARBOR.cabin,arrivalRoute(),surface);
  for(let i=0;i<HARBOR.waiting.length;i++){
   continuousRoute(HARBOR.entrance,returnRoute(i),worldWalkable);
   continuousRoute(HARBOR.waiting[i],boardingRoute(i),surface);
   for(let j=0;j<i;j++)assert.ok(Math.hypot(HARBOR.waiting[i].x-HARBOR.waiting[j].x,HARBOR.waiting[i].y-HARBOR.waiting[j].y)>=32);
  }
  assert.equal(worldWalkable(1230,820),false,'sea-side sand cannot bypass the bridge');
  for(const p of [...HARBOR.activities,SLOTS[8].entry,SLOTS[22].entry]){
   const route=findPath(p,HARBOR.entrance);
   assert.ok(route.length, 'port route must exist');
   continuousRoute(p,route,worldWalkable);
  }
 });
 test(theme+': ferry transfers, island visits, return queues and boarding stay continuous',()=>{
  setWorldTheme(theme);const s=hydrateTown(createState()),log=[],last=new Map(),seen=new Set();
  const r=createVisitorRuntime({getState:()=>s,followPath,onEvent:t=>log.push(t),onChange:()=>{}});r.setEntries(id=>SLOTS[id].entry);
  let maxStep=0,minQueueGap=Infinity;
  try{
   for(let step=1;step<=12000;step++){
    r.update(.1,step*.1);
    for(const g of r.guests){
     seen.add(g.stage);const p=last.get(g.id);
     if(p?.visible&&g.visible&&g.inside==null&&p.inside==null){const d=Math.hypot(g.x-p.x,g.y-p.y);maxStep=Math.max(maxStep,d);assert.ok(d<=8.61,'passenger teleported');}
     if(g.harborLeg)assert.ok(surface(g.x,g.y),'passenger walks outside bridge/gangway');
     if(p?.stage==='landing'&&g.stage==='walking')assert.ok(Math.hypot(g.x-HARBOR.entrance.x,g.y-HARBOR.entrance.y)<1,'tour route begins before reaching island-side bridge entrance');
     last.set(g.id,{x:g.x,y:g.y,visible:g.visible,inside:g.inside,stage:g.stage});
    }
    assert.ok(r.guests.length<=6,'visitor capacity exceeded');
    const waiting=r.guests.filter(g=>g.stage==='waitingBoat');
    assert.equal(new Set(waiting.map(g=>g.harborQueue)).size,waiting.length);
    for(let i=0;i<waiting.length;i++)for(let j=0;j<i;j++)minQueueGap=Math.min(minQueueGap,Math.hypot(waiting[i].x-waiting[j].x,waiting[i].y-waiting[j].y));
    for(const boat of r.boats)if(boat.phase==='leaving')assert.equal(boat.activePassenger,null);
   }
   const boarded=log.filter(t=>t.includes('已登船')).length;
   assert.ok(s.economy.arrivals>=12&&s.economy.gross>0&&boarded>=10,'complete tourism cycle must progress');
   for(const stage of ['onboard','landing','walking','servicing','returning','waitingBoat','boarding'])assert.ok(seen.has(stage),stage);
   assert.ok(minQueueGap>=32);
   report.push({theme,seconds:1200,arrivals:s.economy.arrivals,gross:s.economy.gross,boarded,maxStep,minQueueGap,stages:[...seen],externalCalls:0});
  }finally{r.reset()}
 });
 test(theme+': slower boarding in a full six-person queue delays departure until everyone boards',()=>{
  setWorldTheme(theme);const s=hydrateTown(createState()),log=[],r=createVisitorRuntime({getState:()=>s,followPath:(a,dt,speed)=>followPath(a,dt,speed*.3),onEvent:t=>log.push(t),onChange:()=>{}});
  r.setEntries(id=>SLOTS[id].entry);
  for(let i=0;i<6;i++)r.guests.push({...TOURISTS[i],id:100+i,skin:i,npcId:i,isVisitor:true,...HARBOR.waiting[i],harborQueue:i,path:[],inside:null,visible:true,stage:'waitingBoat',waitAt:i,budget:0,spent:0,ratings:[],arrivedAt:0});
  let held=false,departure=null;
  try{
   for(let step=1;step<=800;step++){
    r.update(.1,step*.1);const b=r.boats.find(b=>b.id===1);
    if(b?.phase==='moored'&&b.t>24&&b.activePassenger!=null)held=true;
    if(b?.phase==='leaving'&&!departure){departure=step*.1;assert.ok(!r.guests.some(g=>g.id>=100&&g.id<=105),'boat left before assigned queue passengers boarded');assert.equal(b.activePassenger,null);}
   }
   assert.ok(held,'busy boat must extend the fixed docking window');
   assert.ok(departure>44&&departure<78,'busy ferry should finish rather than wait forever');
   assert.equal(log.filter(t=>t.includes('已登船')).length,6);
   report.push({theme,fullQueue:6,heldForPassengers:held,boardingSpeedFactor:.3,firstDeparture:departure,boarded:6});
  }finally{r.reset()}
 });
}
test('save harbor regression evidence',()=>writeFileSync('qa/v17-harbor-regression.json',JSON.stringify(report,null,2)));
