import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,RESIDENTS} from '../src/world.js';
import {hydrateTown,commitWork} from '../src/townSimulation.js';
import {ALL_RECIPES,ITEM_BY_ID,RECIPE_BY_ID,commitRecipe} from '../src/contentCatalog.js';
import {createProject,syncProjects,projectSteps,projectOwner,controlProject,assignProjectStep,playerProjectTask,preparationNeeds} from '../src/projectPlans.js';
import {availableQuantity,commitResources,validResourceLedger} from '../src/resourceLedger.js';
import {beginTaskStep,recordTaskStep,restoreTasks,nextTask} from '../src/taskBoard.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {validateState} from '../server/saveStore.mjs';
const fresh=()=>{const s=hydrateTown(createState());for(const id of Object.keys(s.inventory))s.inventory[id]=0;return s};
test('explicit targets and intermediate ingredients never count the same stock twice',()=>{
 const s=fresh();Object.assign(s.inventory,RECIPE_BY_ID.recipe_lantern.cost);
 const {project:p}=createProject(s,{id:'nested',title:'桌边灯',targets:{wood:2,lantern:1}});
 assert.equal(p.status,'preparing');assert.equal(availableQuantity(s,'wood'),0);
 const craft=projectSteps(s,p.id).find(t=>t.targetItem==='lantern');
 assert.equal(craft.status,'waiting');assert.deepEqual(craft.dependsOn,['nested:wood']);
 commitResources(s,{gain:{wood:2}});syncProjects(s);
 assert.equal(craft.status,'queued');assert.equal(commitRecipe(RECIPE_BY_ID.recipe_lantern,s,{owner:projectOwner(p.id),commandId:'actual-lamp'}),true);
 syncProjects(s);assert.equal(p.status,'ready');assert.deepEqual(p.held,{lantern:1,wood:2});
 assert.equal(s.inventory.wood,2);assert.equal(availableQuantity(s,'lantern'),0);
 assert(controlProject(s,p.id,'finish').ok);assert.equal(availableQuantity(s,'lantern'),1);
 assert.equal(controlProject(s,p.id,'finish').ok,false);assert.equal(s.inventory.lantern,1);
});
test('player-provided final item cancels obsolete ingredient work and releases unused inputs',()=>{
 const s=fresh();s.inventory.wood=1;const {project:p}=createProject(s,{title:'一盏灯',targets:{lantern:1}});
 const t=projectSteps(s,p.id).find(t=>t.targetItem==='wood'),op=beginTaskStep(s,t.id);
 commitResources(s,{gain:{lantern:1}});syncProjects(s);
 assert.equal(p.status,'ready');assert.equal(t.status,'done');assert.equal(t.completed,0);
 assert.equal(recordTaskStep(s,t.id,{operationId:op,delta:{wood:2}}).ok,false);
 assert.equal(availableQuantity(s,'wood'),1);assert.deepEqual(p.held,{lantern:1});
});
test('plans reserve against each other, replay safely, pause, cancel and keep actual outputs',()=>{
 const s=fresh();s.inventory.wood=2;
 const a=createProject(s,{id:'one',title:'木料',targets:{wood:2}});
 const b=createProject(s,{id:'two',title:'另一份',targets:{wood:3}});
 assert.equal(a.project.status,'ready');assert.equal(b.project.held.wood,undefined);
 assert(createProject(s,{id:'one',title:'木料',targets:{wood:2}}).replayed);
 assert(createProject(s,{id:'repeat-new-id',title:'木料',targets:{wood:2}}).replayed);assert.equal(s.workProjects.length,2);
 assert.equal(createProject(s,{id:'one',title:'木料',targets:{wood:20}}).ok,false);
 assert(controlProject(s,'two','pause').ok);assert.equal(projectSteps(s,'two')[0].status,'paused');
 assert(controlProject(s,'one','cancel').ok);assert.equal(s.inventory.wood,2);assert.equal(b.project.held.wood,2);
 assert.equal(b.project.status,'paused');assert(controlProject(s,'two','resume').ok);
 assert.equal(projectSteps(s,'two')[0].remaining,1);assert(validResourceLedger(s));
});
test('reassign and player takeover revoke in-flight operation without inventing completion',()=>{
 let s=fresh();const {project:p}=createProject(s,{targets:{wood:4}});
 let t=projectSteps(s,p.id)[0],op=beginTaskStep(s,t.id);
 assert(assignProjectStep(s,t.id,-1).ok);assert.equal(recordTaskStep(s,t.id,{operationId:op,delta:{wood:2}}).ok,false);
 assert.equal(playerProjectTask(s,'wood').id,t.id);assert.equal(nextTask(s,5),null);
 s=JSON.parse(JSON.stringify(s));restoreTasks(s);syncProjects(s);t=projectSteps(s,p.id)[0];assert.equal(t.npcId,-1);
 assert(assignProjectStep(s,t.id,11).ok);assert.equal(nextTask(s,11).id,t.id);assert.equal(t.completed,0);
 assert.equal(validateState(s),s);s.agentTaskLedger[0].resourceOwner='other';assert.throws(()=>validateState(s),/筹备/);
});
test('all 300 recipes resolve through real stock, with shared inputs and no recipe deadlock',()=>{
 for(const recipe of ALL_RECIPES){
  const s=fresh();for(const f of Object.values(s.facilities))f.quality=80;for(let i=0;i<25;i++)s.roomGames[i]={plays:8};
  const created=createProject(s,{targets:{[recipe.item]:2}});assert(created.ok,recipe.id+': '+created.reason);const p=created.project;
  for(let i=0;i<15&&p.status!=='ready';i++){
   for(const n of preparationNeeds(s,p).nodes){
    const r=RECIPE_BY_ID[ITEM_BY_ID[n.item].recipeId];
    if(!r)commitResources(s,{gain:{[n.item]:n.remaining}});
    else if(!n.depends.length)for(let q=0;q<n.remaining;q++)assert(commitRecipe(r,s,{owner:projectOwner(p.id)}),recipe.id);
   }
   syncProjects(s);assert(validResourceLedger(s));
  }
  assert.equal(p.status,'ready',recipe.id);assert.equal(p.held[recipe.item],2,recipe.id);
 }
});
test('seed preparation can exceed ambient nursery buffer and remains actual nursery work',()=>{
 const s=fresh(),{project:p}=createProject(s,{targets:{seed:7}}),t=projectSteps(s,p.id)[0];
 for(let i=0;i<7;i++){const d={...t.command,action:'work',resourceOwner:t.resourceOwner,operationId:beginTaskStep(s,t.id)};
  const result=commitWork(t.npcId,d,s,i);recordTaskStep(s,t.id,{operationId:d.operationId,result,delta:s.taskActionReceipts[d.operationId].delta});syncProjects(s)}
 assert.equal(p.status,'ready');assert.equal(s.inventory.seed,7);assert.equal(t.completed,7);
});
test('real path/action runtime fulfills a multi-role plan; reset keeps remaining work; stale completion cannot add output',async()=>{
 let s=fresh();const npcs=RESIDENTS.map((r,npcId)=>({npcId,x:780,y:465,path:[],phase:0,walkMix:0}));
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated"}',{status:503});
 try{
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  const {project:p}=createProject(s,{id:'physical',targets:{lantern:1,wood:4}});
  for(const n of npcs)if(![1,5,11].includes(n.npcId))n.manualUntil=1e6;
  let clock=0,restored=false;
  for(let i=0;i<4500&&s.workProjects[0].status!=='ready';i++){
   clock+=.2;runtime.update(.2,clock);
   if(!restored&&s.inventory.wood>=2){s=JSON.parse(JSON.stringify(s));runtime.reset();for(const n of npcs)if(![1,5,11].includes(n.npcId))n.manualUntil=1e6;restored=true;}
  }
  assert(restored);assert.equal(s.workProjects[0].status,'ready',JSON.stringify(projectSteps(s,'physical').map(t=>[t.targetItem,t.status,t.result,t.completed,t.remaining])));
  assert.equal(s.inventory.lantern,1);assert(s.inventory.wood>=4);assert(projectSteps(s,p.id).some(t=>t.evidence.length));
  assert((await runtime.manageProject(p.id,'finish')).ok);for(const id of [1,5,11]){runtime.releaseActor(npcs[id]);if(id!==5)npcs[id].manualUntil=1e6;}const made=await runtime.createPreparation({id:'stop',targets:{wood:s.inventory.wood+2}});
  for(let i=0;i<1200&&!(npcs[5].intent?.projectId===made.project.id&&npcs[5].action?.onDone);i++){clock+=.2;runtime.update(.2,clock)}
  assert.equal(npcs[5].intent?.projectId,made.project.id,JSON.stringify({clock,npc:npcs[5],needs:s.npcNeeds[5],project:made.project,tasks:projectSteps(s,'stop')}));
  const stale=npcs[5].action.onDone,t=projectSteps(s,'stop')[0];
  assert((await runtime.manageProject(t.id,'assign',-1)).ok);const stock=s.inventory.wood;stale();assert.equal(s.inventory.wood,stock);assert.equal(t.npcId,-1);
 }finally{globalThis.fetch=original}
});

test('farm preparation waits for actual growth and harvests the requested crop',async()=>{
 const s=fresh();const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated"}',{status:503});
 try{
  const {tickCrops}=await import('../src/farming.js'),npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  const {project:p}=createProject(s,{id:'farm-plan',targets:{wheat:2}});
  for(const n of npcs)if(![0,4].includes(n.npcId))n.manualUntil=1e6;
  let sawGrowing=false;
  for(let i=1;i<=7000&&p.status!=='ready';i++){runtime.update(.2,i*.2);tickCrops(s,.2);if(s.plots.some(x=>x.stage===3)){sawGrowing=true;if(s.inventory.wheat<2)assert.equal(p.status,'preparing')}}
  assert(sawGrowing);assert.equal(p.status,'ready',JSON.stringify(projectSteps(s,p.id)));assert(s.inventory.wheat>=2);
  assert(projectSteps(s,p.id).find(t=>t.targetItem==='wheat').evidence.some(e=>e.delta.wheat>0));
 }finally{globalThis.fetch=original}
});
