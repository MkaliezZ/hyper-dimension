import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CRAFT_SPECIFICATIONS} from '../src/craftSpecifications.js';
import {ALL_RECIPES,RECIPE_BY_ID,ITEM_BY_ID,RAW_MATERIALS,STARTER_TOOLS,recipeGate} from '../src/contentCatalog.js';
import {FUNCTIONAL_FACILITIES} from '../src/facilityCatalog.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject,projectSteps,syncProjects} from '../src/projectPlans.js';
function rawCost(id,seen=new Set()){
 if(ITEM_BY_ID[id].category==='material')return {[id]:1};
 assert(!seen.has(id),'material cycle '+id);const next=new Set([...seen,id]),r=RECIPE_BY_ID['recipe_'+id],sum={};
 for(const [part,n]of Object.entries(r.cost))for(const [raw,q]of Object.entries(rawCost(part,next)))sum[raw]=(sum[raw]||0)+n*q;
 return sum;
}
test('tools have load-bearing material and handles; every ceramic vessel still requires clay through its recipe chain',()=>{
 for(const id of STARTER_TOOLS){const c=rawCost(id);assert(c.wood||c.bamboo||c.hardwood,id+' handle or rod');assert(c.iron||c.copper||c.ore,id+' metal working part');}
 for(const r of ALL_RECIPES.filter(r=>r.building===15))assert(rawCost(r.item).clay>0,r.name+' clay body');
 const water=RECIPE_BY_ID.recipe_watering_can;assert(water.cost.copper&&water.cost.iron,'container and handle cannot be made of wood and resin alone');
 assert(RECIPE_BY_ID.recipe_c16_9.cost.rod,'long-cast rod upgrades an actual rod');
 assert(!RECIPE_BY_ID.recipe_c16_9.cost.c16_4,'bait is replenished during fishing, not built into the rod');
});
test('revised durable objects do not consume manufactured meals; their construction notes and stable artwork IDs remain available',()=>{
 for(const id of Object.keys(CRAFT_SPECIFICATIONS)){
  const r=RECIPE_BY_ID['recipe_'+id];assert(r&&r.art&&r.construction.length>=12,id);
  if(['gift','food'].includes(r.category))continue;
  assert(!Object.keys(r.cost).some(part=>ITEM_BY_ID[part].category==='food'),r.name+' includes a prepared meal');
 }
 assert.equal(ALL_RECIPES.length,300);assert.equal(RAW_MATERIALS.length,50);
});
test('a tea station is built with its three cups and replans separate consumable tea service',()=>{
 const r=RECIPE_BY_ID.recipe_c1_9,facility=FUNCTIONAL_FACILITIES.c1_9;
 assert.equal(r.cost.c15_1,facility.capacity);assert(r.cost.c15_6&&r.cost.c15_4);
 assert(!r.cost.tea);assert.equal(facility.cost.tea,3);assert.equal(facility.cost.wood,1);
 const s=hydrateTown(createZeroState());s.freshStartPending=false;s.research={1:10,15:10};s.facilities[1].quality=70;s.facilities[15].quality=70;
 const result=createProject(s,{id:'new-tea-station',targets:{c1_9:1}});assert(result.ok);syncProjects(s);
 const steps=projectSteps(s,result.project.id);assert(steps.some(t=>t.targetItem==='c15_1'&&t.quantity===3));assert(steps.some(t=>t.targetItem==='clay'));assert(!steps.some(t=>t.targetItem==='tea'),'manufacturing does not schedule a tea refill');
});
test('first party recipes retain their initial costs and unlock gates; historical material definitions stay byte-frozen',()=>{
 const s=hydrateTown(createZeroState());
 for(const id of ['lantern','rod','c16_2','c16_4','c8_2','bread','firework','outfit','pottery','painting'])assert(recipeGate(RECIPE_BY_ID['recipe_'+id],s).ready,id);
 const bytes=readFileSync(new URL('../src/legacyRecipeDefinitions-v32.js',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'a0765723920d2526491711140c8b55fb8969a43099ac14120c24c4a4b8d30b20');
});
