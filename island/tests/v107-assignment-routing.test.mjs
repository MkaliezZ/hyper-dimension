import test from 'node:test';import assert from 'node:assert/strict';
import {createState,RESIDENTS,setWorldTheme} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {queueTask} from '../src/taskBoard.js';
import {commitResources} from '../src/resourceLedger.js';
import {beginAssignedStep,syncPlanningState} from '../server/planningAuthority.mjs';

for(const theme of ['pixel','origami'])for(const scenario of [
 {id:'wood-delivered-enroute',initial:{},supply:{wood:2},from:'forest',to:'mine',kind:'field'},
 {id:'ore-delivered-enroute',initial:{wood:2},supply:{ore:1},from:'mine',to:'workshop',kind:'resident'}
])test(theme+' '+scenario.id+' physically reroutes before beginning obsolete work',async()=>{
 setWorldTheme(theme);const s=hydrateTown(createState());for(const k of Object.keys(s.inventory))s.inventory[k]=0;Object.assign(s.inventory,scenario.initial);
 s.planningControl={version:1,enabled:true};const id=scenario.id+'-'+theme;
 assert(queueTask(s,{id,npcId:0,goal:'workshop',buildingId:0,recipeId:'recipe_lantern',intent:'完成星灯制作',quantity:1},{targetItem:'lantern'}).ok);
 const b={planning:{version:1},farm:{leases:{}},field:{leases:{}},resident:{leases:{}},active:null};syncPlanningState(s,b);
 const npcs=[{npcId:0}],oldFetch=globalThis.fetch,starts=[],rejected=[],moves=[];let supplied=false,rerouted=false;
 globalThis.fetch=async()=>new Response('{"error":"isolated movement/authority regression; models blocked"}',{status:503});
 const start=async(kind,n,d,step)=>{
  try{beginAssignedStep(s,b,{assignmentId:d.assignmentId,actorId:n.npcId,kind,intent:d,field:d.goal,itemId:d.resource,crop:d.resource,step});starts.push({kind,goal:d.goal,buildingId:d.buildingId,recipeId:d.recipeId,x:n.x,y:n.y,inside:n.inside});return null;}
  catch(e){rejected.push(e.code);throw e;}
 };
 const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath:(a,dt,speed)=>{const before={x:a.x,y:a.y};followPath(a,dt,speed);moves.push({distance:Math.hypot(a.x-before.x,a.y-before.y),limit:speed*dt+.01});},onChange:()=>{},onEvent:()=>{},
  residentRemote:{begin:(n,d)=>start('resident',n,d),cancel:async()=>{}},
  fieldRemote:{occupied:()=>false,begin:(n,d)=>start('field',n,d),cancel:async()=>{}},
  farmRemote:{occupied:()=>false,begin:(n,d,type)=>start('farm',n,d,type),cancel:async()=>{}}});
 try{
  for(let i=1;i<=3000&&!starts.length;i++){
   runtime.update(.1,i*.1);
   if(!supplied&&npcs[0].intent?.goal===scenario.from&&npcs[0].path.length){const delivery=commitResources(s,{id:'fixture-other-resident-'+id,gain:scenario.supply,category:'test-fixture',note:'Other resident delivers during travel'});assert(delivery.ok);syncPlanningState(s,b);supplied=true;}
   if(supplied&&npcs[0].intent?.goal===scenario.to)rerouted=true;
   await new Promise(r=>setImmediate(r));
  }
  assert(supplied,'fixture must deliver after the original journey begins');
  assert.deepEqual(rejected,[],'obsolete route must not be sent to the authoritative action endpoint');
  assert.equal(starts.length,1);assert.equal(starts[0].kind,scenario.kind);assert.equal(starts[0].goal,scenario.to);
  assert(rerouted);assert(moves.length>10);assert(moves.every(m=>m.distance<=m.limit),'rerouting must keep normal physical walking speed');
  if(scenario.kind==='resident')assert.equal(starts[0].inside,0,'crafting begins inside its workshop');
  assert.equal(s.agentTaskLedger[0].completed,0);assert.equal(s.agentTaskLedger[0].evidence.length,0);
  assert.equal(s.inventory.lantern,0,'replanning is not a reward');
 }finally{runtime.reset();await new Promise(r=>setImmediate(r));globalThis.fetch=oldFetch;}
});
