import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,RESIDENTS,setWorldTheme} from '../src/world.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,purposeOptions,commitWork} from '../src/townSimulation.js';
import {ALL_RECIPES,RAW_MATERIALS,RECIPE_BY_ID,PRODUCTION_GRAPH} from '../src/contentCatalog.js';
import {checkWorkshopGraph,PRODUCTION_VERSION} from '../src/productionNetwork.js';
import {itemPurpose} from '../src/itemPurpose.js';
import {createProject,syncProjects,projectSteps,projectOwner} from '../src/projectPlans.js';
import {availableQuantity,reserveResources,commitResources,validResourceLedger} from '../src/resourceLedger.js';
import {restoreTasks} from '../src/taskBoard.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {townDailyBudget,tickTownEconomy} from '../src/economy.js';
import {validateState} from '../server/saveStore.mjs';
const fresh=()=>hydrateTown(createZeroState());
const work=(s,i)=>purposeOptions(i,s,RESIDENTS[i]).find(x=>x.purposeId.startsWith('career:'));
test('premium upkeep migrates only after the current day and retains the accepted old budget',()=>{
 const s=fresh();s.day=7;s.coins=3000;s.economy.daySeconds=899;s.economy.budgetPolicyVersion=26;s.economy.budgetPolicyStartsDay=1;
 for(const f of Object.values(s.facilities)){f.quality=95;f.upgrades=4;f.condition=100;}
 const before=townDailyBudget(s);assert.equal(before.policyVersion,26);assert.equal(before.total,146);
 const migrated=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(townDailyBudget(migrated).total,146);tickTownEconomy(migrated,1);
 assert.equal(migrated.economy.townDays.at(-1).budget,146);assert.equal(townDailyBudget(migrated).policyVersion,105);assert.equal(townDailyBudget(migrated).total,153);
});
test('all 25 workshops supply and consume real products; full graph is bounded and acyclic',()=>{
 const cross=PRODUCTION_GRAPH.edges.filter(e=>e.from!==e.to);
 assert(cross.length>=100);assert.equal(new Set(cross.map(e=>e.from)).size,25);assert.equal(new Set(cross.map(e=>e.to)).size,25);assert(PRODUCTION_GRAPH.maxDepth<=8);
 const bad=ALL_RECIPES.map(r=>({...r,cost:{...r.cost}}));bad[0].cost[bad[0].item]=1;assert.throws(()=>checkWorkshopGraph(bad,RAW_MATERIALS),/cycle/);
});
test('zero-start party recipes retain accessible tiers after explicit bill revisions',()=>{
 const protectedItems=['lantern','rod','c16_2','c16_4','c8_2','bread','firework','outfit','pottery','painting'];
 for(const id of protectedItems){const r=RECIPE_BY_ID['recipe_'+id];assert.equal(r.definitionVersion,4,id);assert.equal(r.tier,0,id);}
 const s=fresh();assert.equal(s.coins,0);assert(Object.values(s.inventory).every(n=>n===0));assert.equal(s.contentVersion,9);assert.equal(s.productionVersion,PRODUCTION_VERSION);
});
test('ordinary resident sources paper in the library then actually consumes it at the stage',()=>{
 const s=fresh();for(const m of RAW_MATERIALS)s.inventory[m.id]=20;
 s.npcCareers[2]={phase:0,completed:0,history:[]};const initial=work(s,2);assert.equal(initial.buildingId,7);assert.equal(initial.recipeId,'recipe_c7_5');
 commitWork(2,initial,s,1);assert.equal(s.inventory.c7_5,1);assert.equal(s.npcCareers[2].phase,0);
 commitWork(2,work(s,2),s,2);assert.equal(s.inventory.c7_5,2);
 const pigment=work(s,2);assert.equal(pigment.buildingId,24);assert.equal(pigment.recipeId,'recipe_c24_1');commitWork(2,pigment,s,3);assert.equal(s.inventory.c24_1,1);
 const final=work(s,2);assert.equal(final.buildingId,21);commitWork(2,final,s,3);assert.equal(s.inventory.c21_0,1);assert.equal(s.inventory.c7_5,0);assert.equal(s.npcCareers[2].phase,1);
});
test('ordinary missing intermediate resolves a native raw source instead of illegal farm product',()=>{
 const s=fresh();s.npcCareers[5]={phase:1,completed:0,history:[]};
 const first=work(s,5);assert.equal(first.goal,'forest');assert.equal(first.resource,'wood');
 s.inventory.wood=6;s.inventory.resin=1;
 const next=work(s,5);assert.equal(next.buildingId,0);assert.equal(next.recipeId,'recipe_c0_7');
});
test('details expose actual upstream workshops and downstream consumers',()=>{
 const s=fresh(),paper=itemPurpose('c7_5',s),poster=itemPurpose('c21_0',s);
 assert(paper.next.some(r=>r.id==='c21_0'&&r.crossWorkshop));
 assert(poster.inputs.some(r=>r.id==='c7_5'&&r.quantity===2&&r.building===7&&r.crossWorkshop));
});
test('legacy live plan expands new work, releases obsolete reservations and keeps completed receipts',()=>{
 const s=fresh();s.contentVersion=8;const {project:p}=createProject(s,{id:'legacy',targets:{c23_0:1}});
 s.inventory.fiber=1;reserveResources(s,projectOwner(p.id),{fiber:1},{purpose:'legacy old cost'});
 const history=commitResources(s,{id:'old-craft-proof',gain:{c13_0:1},category:'craft',note:'previous catalog action'}).receipt;
 s.agentTaskLedger.push({id:p.id+':fiber',npcId:5,projectId:p.id,resourceOwner:projectOwner(p.id),targetItem:'fiber',quantity:1,completed:0,status:'running',operationId:'obsolete',dependsOn:[],history:[],evidence:[],command:{id:p.id+':fiber',npcId:5,goal:'forest',resource:'fiber',quantity:1}});
 const restored=hydrateTown(JSON.parse(JSON.stringify(s)));restoreTasks(restored);syncProjects(restored);
 assert.equal(restored.contentVersion,9);assert.equal(availableQuantity(restored,'fiber'),1);
 assert.equal(projectSteps(restored,p.id).find(t=>t.targetItem==='fiber').status,'done');
 assert(projectSteps(restored,p.id).find(t=>t.targetItem==='c0_7'));assert.equal(restored.inventory.c13_0,1);
 assert.deepEqual(restored.resourceLedger.receipts['old-craft-proof'],history);assert(validResourceLedger(restored));validateState(restored);
});
test('both theme runtimes actually walk between woodshop and boatyard and produce shared components',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated production QA"}',{status:503});
 try{
  for(const theme of ['pixel','origami']){
   setWorldTheme(theme);const s=fresh();s.inventory.wood=6;s.inventory.resin=1;s.npcCareers[5]={phase:1,completed:0,history:[]};
   const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
   const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
   for(const n of npcs)if(n.npcId!==5)n.manualUntil=1e6;
   const visited=new Set();let sawMoving=false;
   for(let i=1;i<=6000&&!s.inventory.c23_0;i++){runtime.update(.2,i*.2);if(npcs[5].inside!=null)visited.add(npcs[5].inside);if(npcs[5].path?.length)sawMoving=true;}
   assert(sawMoving);assert(visited.has(0)&&visited.has(23),theme+' actual rooms '+[...visited]);
   assert.equal(s.inventory.c23_0,1);assert.equal(s.inventory.c0_7,0);assert.equal(s.inventory.wood,0);assert.equal(s.inventory.resin,0);assert(validResourceLedger(s));validateState(s);
  }
 }finally{globalThis.fetch=original;}
});
