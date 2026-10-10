import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ALL_RECIPES,RAW_MATERIALS,ITEM_BY_ID,RECIPE_BY_ID,recipeGate,commitRecipe,itemUse} from '../src/contentCatalog.js';
import {CRAFT_SPECIFICATIONS} from '../src/craftSpecifications.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {validResourceLedger,availableQuantity} from '../src/resourceLedger.js';
import {itemPurpose} from '../src/itemPurpose.js';
import {createProject,projectSteps,syncProjects} from '../src/projectPlans.js';
const fresh=()=>hydrateTown(createZeroState());
function rawBill(id,multiplier=1,result={}){
 if(ITEM_BY_ID[id].category==='material'){result[id]=(result[id]||0)+multiplier;return result;}
 for(const [part,n]of Object.entries(RECIPE_BY_ID['recipe_'+id].cost))rawBill(part,n*multiplier,result);
 return result;
}

test('all 300 outputs have explicit bills, construction and supported categories; every raw material has a real consumer',()=>{
 assert.equal(ALL_RECIPES.length,300);assert.equal(RAW_MATERIALS.length,50);assert.equal(Object.keys(CRAFT_SPECIFICATIONS).length,300);
 for(const r of ALL_RECIPES){assert(r.construction.length>=12,r.item);assert.equal(r.definitionVersion,4);assert(Object.keys(r.cost).length>0);for(const [id,n]of Object.entries(r.cost)){assert(ITEM_BY_ID[id]);assert(Number.isInteger(n)&&n>0);}}
 for(const raw of RAW_MATERIALS)assert(ALL_RECIPES.some(r=>r.cost[raw.id]),raw.id+' unused');
});

test('recursive manufacture of each of the 300 products consumes exactly its raw bill without extra output or ledger leakage',()=>{
 for(const r of ALL_RECIPES){
  const s=fresh();for(const id of Object.keys(s.inventory))s.inventory[id]=0;
  s.freshStartPending=false;s.research={};for(let id=0;id<25;id++){s.research[id]=10;s.facilities[id].quality=90;}
  const initial=rawBill(r.item);Object.assign(s.inventory,initial);let serial=0;
  const quantities={},depths={};
  function expand(id,n){if(ITEM_BY_ID[id].category==='material')return;quantities[id]=(quantities[id]||0)+n;for(const [part,q]of Object.entries(RECIPE_BY_ID['recipe_'+id].cost))expand(part,q*n);}
  function depth(id){if(ITEM_BY_ID[id].category==='material')return 0;return depths[id]??=1+Math.max(...Object.keys(RECIPE_BY_ID['recipe_'+id].cost).map(depth));}
  expand(r.item,1);
  for(const id of Object.keys(quantities).sort((a,b)=>depth(a)-depth(b)))for(let i=0;i<quantities[id];i++)assert(commitRecipe(RECIPE_BY_ID['recipe_'+id],s,{commandId:'manufacture-'+r.item+'-'+(++serial)}),r.item+' -> '+id);
  for(const raw of RAW_MATERIALS)assert.equal(s.inventory[raw.id],0,r.item+' unconsumed '+raw.id);
  for(const output of ALL_RECIPES)assert.equal(s.inventory[output.item],output.item===r.item?1:0,r.item+' extra '+output.item);
  assert(validResourceLedger(s));assert.equal(s.coins,0,'fixture manufacture must not invent coins');
 }
});

test('starter tiers have no locked intermediate; higher-tier recipes require their real proficiency and quality thresholds',()=>{
 const s=fresh(),checked=new Set();s.research={};
 function check(r){if(checked.has(r.item))return;checked.add(r.item);assert(recipeGate(r,s).ready,r.item+' starter dependency locked');for(const id of Object.keys(r.cost))if(ITEM_BY_ID[id].category!=='material')check(RECIPE_BY_ID['recipe_'+id]);}
 for(const r of ALL_RECIPES.filter(r=>r.tier===0))check(r);
 for(const r of ALL_RECIPES.filter(r=>r.tier>0)){
  assert(!recipeGate(r,s).ready);s.research[r.building]=r.tier===1?2:5;s.facilities[r.building].quality=r.tier===1?49:59;assert(!recipeGate(r,s).ready);
  s.facilities[r.building].quality++;assert(recipeGate(r,s).ready);s.research[r.building]=0;s.facilities[r.building].quality=45;
 }
});

test('tea and bakery names, six-serving gift count, grain and structural materials match the known asset findings',()=>{
 const by=id=>RECIPE_BY_ID['recipe_'+id];
 assert.equal(by('c1_2').name,'蜂蜜薄荷饮');assert(by('c1_2').cost.honey&&by('c1_2').cost.mint);
 assert.equal(by('c1_4').name,'薰衣草花茶');assert(by('c1_4').cost.lavender);assert(!/奶|柠/.test(by('c1_4').name));
 assert.equal(by('c17_6').name,'香脆米饼');assert.equal(by('c17_6').cost.rice,2);
 assert(by('c2_1').cost.rice&&by('c2_1').cost.tomato);assert(by('c17_1').cost.wheat&&by('c17_1').cost.honey);
 const teas=['tea','c1_1','c1_2','c1_3','c1_4','c1_5'];assert.equal(teas.reduce((n,id)=>n+(by('c1_10').cost[id]||0),0),6);assert(teas.every(id=>by('c1_10').cost[id]===1));
 assert(by('c1_10').cost.copper&&by('c1_10').cost.c0_7&&by('c1_10').cost.c7_5,'six tins and box');
 assert(by('c3_9').cost.stone,'stone flower arch');assert.equal(by('c3_11').cost.quartz,3,'three glass flower lights');
 for(const r of ALL_RECIPES.filter(r=>r.building===17&&r.category==='food'))assert(r.cost.wheat||r.cost.rice||r.cost.corn,r.name+' grain');
 for(const r of ALL_RECIPES.filter(r=>r.category==='food'))for(const id of ['ore','copper','iron','crystal','bluegrass','resin','coal'])assert(!r.cost[id],r.name+' industrial input '+id);
});

test('durable observatory/photo/greenhouse objects route to placement or further manufacture without becoming research meals or seeds',()=>{
 const s=fresh();for(const id of ['c5_2','c5_6','c13_1','c13_5','c13_10','c14_6','c14_7','c14_8','c14_9','painting']){
  s.inventory[id]=1;const seed=s.inventory.seed,result=itemUse(id,s);assert(result.ok);assert.equal(result.route,id==='c14_8'?'farmCare':'placement',id);assert.equal(s.inventory[id],1);assert.equal(s.inventory.seed,seed);assert.equal(s.research?.[ITEM_BY_ID[id].building]||0,0);
  const purpose=itemPurpose(id,s);assert(!/阅读研究|研究种苗/.test(purpose.primary.action));
 }
 const p=itemPurpose('c14_8',s);assert(p.next.some(r=>r.id==='c14_0'));assert(p.next.some(r=>r.id==='c14_1'),'fertilizer has actual nursery consumers');
});

test('new projects expand the actual six tea servings and all wrappers; frozen V32 definitions remain unchanged',()=>{
 const s=fresh();s.research={};for(let id=0;id<25;id++){s.research[id]=10;s.facilities[id].quality=90;}
 const created=createProject(s,{id:'six-tea-box',targets:{c1_10:1}});assert(created.ok);syncProjects(s);const steps=projectSteps(s,created.project.id);
 for(const id of ['tea','c1_1','c1_2','c1_3','c1_4','c1_5','copper','c0_7','c7_5','c11_4'])assert(steps.some(t=>t.targetItem===id),id+' actual preparation step');
 const bytes=readFileSync(new URL('../src/legacyRecipeDefinitions-v32.js',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'a0765723920d2526491711140c8b55fb8969a43099ac14120c24c4a4b8d30b20');
});
