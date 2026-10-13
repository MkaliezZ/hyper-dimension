import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {SEASONAL_CROPS,SEASONAL_RECIPES,SEASONAL_ITEM_IDS} from '../src/seasonalRecipes.js';
import {ALL_RECIPES,RAW_MATERIALS,ITEM_BY_ID,RECIPE_BY_ID,hydrateContent,recipeGate,itemUse} from '../src/contentCatalog.js';
import {RAW_IDS_V1,RECIPE_IDS_V1} from '../src/achievementUniverse.js';
import {CROPS,harvestPlot} from '../src/farming.js';
import {canPlantCrop} from '../src/cropSeasons.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,commitWork,needs,mealOptions,settleVisit,visitQuote} from '../src/townSimulation.js';
import {shopCapacity,shopListing,shopItemOffer,configureShopfront,validShopfronts} from '../src/shopfronts.js';
import {operatingCost,ECONOMY_RULES} from '../src/economy.js';
import {createCraftGame,applyCraftEvent,craftResult} from '../src/craftGameReplay.js';
import {kitchenTarget,kitchenCutsRequired} from '../src/kitchenCutting.js';
import {validCooperationRows} from '../src/cooperationEvidence.js';
import {recipeContract,validRecipeContract,acceptedRecipe} from '../src/recipeContracts.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {personalSnapshot,syncPersonalState} from '../server/personalActions.mjs';
import {chooseAction} from './v19-play-helpers.mjs';
await mkdir('qa/v176',{recursive:true});
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;return s;};
const recipes=SEASONAL_RECIPES.map(r=>RECIPE_BY_ID[r.id]);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function fixture(theme='pixel',edit=()=>{}){
 let now=1000000;const directory=await mkdtemp(resolve('qa/v176/season-'));
 const store=createSaveStore({directory,now:()=>now}),s=fresh();edit(s);
 const {document}=await store.open(theme,{legacyState:s,protect:true});
 return {theme,directory,store,document,advance:ms=>now+=ms,reopen:()=>createSaveStore({directory,now:()=>now})};
}
const command=(r,operation,extra={})=>({kind:'craft',operation,requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version,...extra});
function solve(game){
 game=structuredClone(game);const trace=[];
 for(let frame=0;frame<18000&&!craftResult(game);frame++){
  const a=chooseAction(game.state);if(a){const e={action:a};trace.push(e);applyCraftEvent(game,e);}
  const e={dt:1/30};trace.push(e);applyCraftEvent(game,e);
 }
 assert(craftResult(game)?.passed,'legal play failed: '+game.state.level.production?.recipeId+' / '+game.state.level.d);
 return {game,trace};
}

test('catalog appends 8 crops and 8 foods while every original atlas index and V1 achievement ID stays fixed',()=>{
 assert.equal(RAW_MATERIALS.length,58);assert.equal(ALL_RECIPES.length,308);assert.equal(Object.keys(ITEM_BY_ID).length,366);
 assert.deepEqual(RAW_MATERIALS.slice(0,50).map(r=>r.id),RAW_IDS_V1);
 assert.deepEqual(ALL_RECIPES.slice(0,300).map(r=>r.item),RECIPE_IDS_V1);
 for(const [index,id] of RAW_IDS_V1.entries())assert.equal(ITEM_BY_ID[id].index,index);
 for(const [index,id] of RECIPE_IDS_V1.entries())assert.equal(ITEM_BY_ID[id].index,index);
 assert.equal(RAW_IDS_V1.length,50);assert.equal(RECIPE_IDS_V1.length,300);
 assert(SEASONAL_ITEM_IDS.every(id=>!RAW_IDS_V1.includes(id)&&!RECIPE_IDS_V1.includes(id)));
 assert.equal(ECONOMY_RULES.daySeconds,900);
});

test('all 19 crops have real harvest outputs; new crops use explicit seasons and slower finite growth',()=>{
 assert.equal(Object.keys(CROPS).length,19);
 for(const [id,c] of Object.entries(SEASONAL_CROPS)){
  assert.equal(CROPS[id].item,id);assert.equal(ITEM_BY_ID[id].source,'farm');assert(c.seconds>=420&&c.seconds<=900);
  for(const season of ['spring','summer','autumn','winter'])assert.equal(canPlantCrop(id,season),c.seasons.includes(season),id+'/'+season);
  const s=fresh();s.plots[0]={stage:4,crop:id,growth:c.seconds,fertility:3};
  assert.deepEqual(harvestPlot(s,0),{name:c.name,item:id,amount:c.yield+1});assert.equal(s.inventory[id],c.yield+1);
  assert.equal(s.inventory.seed,1);assert.equal(s.plots[0].fertility,2);assert.equal(s.plots[0].stage,0);assert.equal(harvestPlot(s,0),null);
 }
});

test('new inventory hydrates to zero and retains existing stock, discoveries, identity and original crop state',()=>{
 const s=fresh();for(const id of SEASONAL_ITEM_IDS){delete s.inventory[id];delete s.discovered[id];}
 s.inventory.wheat=7;s.discovered.wheat=true;s.playerProfile.name='测试岛主';s.plots[0]={stage:3,crop:'wheat',growth:80};
 const before=structuredClone(s);hydrateContent(s);hydrateContent(s);
 for(const id of SEASONAL_ITEM_IDS){assert.equal(s.inventory[id],0);assert.equal(s.discovered[id],undefined);}
 for(const [id,n] of Object.entries(before.inventory))assert.equal(s.inventory[id],n,id);
 assert.deepEqual(s.plots,before.plots);assert.equal(s.playerProfile.name,'测试岛主');
});

test('food definitions consume their own crop, gate advanced recipes, and keep stored crops usable in every season',()=>{
 for(const r of recipes){
  assert.equal(r.category,'food');assert([1,2,17].includes(r.building));assert(r.index>=12);
  assert(Object.keys(r.cost).some(id=>Object.hasOwn(SEASONAL_CROPS,id)));assert(Object.values(r.cost).every(n=>Number.isInteger(n)&&n>0));
  assert(validRecipeContract(recipeContract(r)));const s=fresh();assert.equal(recipeGate(r,s).ready,r.tier===0);
  s.research={[r.building]:2};s.facilities[r.building].quality=50;assert(recipeGate(r,s).ready);
  assert(r.price>=8&&r.price<=12);assert.equal(operatingCost(r.price),Math.ceil(r.price*.3));
 }
});

test('new recipe stages carry only accepted ingredients and all three difficulties can finish after JSON resume',()=>{
 for(const r of recipes)for(const difficulty of [1,2,3]){
  const game=createCraftGame(r.building,176+difficulty,difficulty,null,r),l=game.state.level;
  assert.deepEqual(l.production.ingredients,Object.entries(r.cost).map(([id,amount])=>({id,amount})));
  assert.equal(l.production.item,r.item);assert.equal(l.production.recipeId,r.id);
  if(l.kind==='kitchen')for(const order of l.orders)assert.deepEqual(order.ingredients.map(i=>l.ids[i]).sort(),Object.keys(r.cost).sort());
  if(l.kind==='tea')assert.deepEqual(l.ids,[...Object.keys(r.cost),r.item]);
  const played=solve(game);let resumed=JSON.parse(JSON.stringify(game));
  for(const [index,e] of played.trace.entries()){applyCraftEvent(resumed,e);if(index===Math.floor(played.trace.length/2))resumed=JSON.parse(JSON.stringify(resumed));}
  assert.deepEqual(craftResult(resumed),craftResult(played.game));
 }
});

test('rice and salt are prepared without slicing while vegetable cuts keep the actual sprite target',()=>{
 for(const item of ['season_cabbage_wrap','season_pea_soup','season_kale_salad']){
  const r=RECIPE_BY_ID['recipe_'+item],g=createCraftGame(r.building,731,1,null,r),s=g.state;
  applyCraftEvent(g,{action:{type:'start'}});applyCraftEvent(g,{dt:.05});
  const j=s.jobs[0];for(const v of s.level.orders[0].ingredients)applyCraftEvent(g,{action:{type:'ingredient',index:v}});
  const observed=[];for(let n=0;n<20&&kitchenTarget(s);n++){
   const target=kitchenTarget(s),id=s.level.ids[j.ingredients[target.index]];observed.push(id);assert(!['rice','seasalt'].includes(id));
   applyCraftEvent(g,{action:{type:'cut'}});for(let i=0;i<8;i++)applyCraftEvent(g,{dt:.05});
  }
  assert.equal(j.cuts,kitchenCutsRequired(s,j));assert(observed.length>0);applyCraftEvent(g,{action:{type:'cook'}});assert.equal(j.state,'cooking');
 }
});

test('all old recipe level shapes and replay semantics are unchanged when passing their accepted recipe',()=>{
 for(const r of ALL_RECIPES.slice(0,300)){
  const base=createCraftGame(r.building,731,2),withRecipe=createCraftGame(r.building,731,2,null,r);
  assert.deepEqual(withRecipe,base,r.item);assert.equal(withRecipe.state?.level.production,undefined);
 }
});

for(const [index,r] of recipes.entries())test(`${r.name}: real server craft, reload, receipt replay and ${index%2?'gift':'meal'} debit once`,async()=>{
 const f=await fixture(index%2?'origami':'pixel',s=>{Object.assign(s.inventory,r.cost);s.research={[r.building]:2};s.facilities[r.building].quality=60;s.playerVitals={hunger:10,energy:10};});
 let out=await f.store.action(f.theme,{kind:'craft',operation:'begin',recipeId:r.id,mode:'2',requestId:randomUUID(),expectedSequence:f.document.actions.sequence,epoch:f.document.actions.epoch,expectedVersion:f.document.version,recipe:{cost:{},item:'lantern'},production:{item:'lantern',ingredients:[]},gain:{coins:9999}});
 assert.equal(out.ticket.practice,false);assert.deepEqual(out.ticket.recipeContract.cost,r.cost);assert.equal(out.ticket.game.state.level.production.item,r.item);
 const {trace}=solve(out.ticket.game);
 for(let i=0;i<trace.length;i+=500){const events=trace.slice(i,i+500);f.advance(Math.ceil(events.reduce((n,e)=>n+(e.dt||0),0)*1000)+10);out=await f.reopen().action(f.theme,command(out,'checkpoint',{batch:out.ticket.nextBatch,events}));}
 f.advance(2500);const finish=command(out,'finish');out=await f.store.action(f.theme,finish);
 assert.equal(out.receipt.outcome,'finished');assert.deepEqual(out.receipt.cost,r.cost);assert.deepEqual(out.receipt.gain,{[r.item]:1});
 assert.equal(out.document.state.inventory[r.item],1);for(const id of Object.keys(r.cost))assert.equal(out.document.state.inventory[id],0);
 assert.deepEqual((await f.reopen().action(f.theme,finish)).document.state.inventory,out.document.state.inventory);
 const use={kind:'personal',operation:index%2?'gift':'use',itemId:r.item,npcId:6,day:out.document.state.day,requestId:randomUUID(),expectedVersion:out.document.version};
 const used=await f.reopen().action(f.theme,use);assert.equal(used.document.state.inventory[r.item],0);assert.deepEqual(used.receipt.stockDelta,{[r.item]:-1});
 if(index%2)assert(used.document.state.npcAffinity[6]>20);else assert(used.document.state.playerVitals.hunger>10);
 assert.equal((await f.reopen().action(f.theme,use)).document.state.inventory[r.item],0);
});

test('all new foods are actual player meals, resident meals and sale stock with bounded net income',()=>{
 for(const r of recipes){
  const s=fresh();s.inventory[r.item]=3;s.playerVitals={hunger:10,energy:10};assert(itemUse(r.item,s).ok);assert.equal(s.inventory[r.item],2);
  const n=needs(0,s);n.hunger=10;assert(mealOptions(0,s,null,0).some(o=>o.foodId===r.item));
  const action={goal:'building',action:'eat',foodId:r.item,buildingId:r.building,operationId:'v176-eat-'+r.item};
  commitWork(0,action,s,0);commitWork(0,action,s,0);assert.equal(s.inventory[r.item],1);assert(n.hunger>10);
  assert(configureShopfront(s,{buildingId:r.building,listing:[{item:r.item,keep:0}],expectedShopRevision:0}).ok);
  const guest={name:'试吃游客',budget:24},quote=visitQuote(s,guest,r.building);assert.equal(quote.item,r.item);
  const before=s.coins,receipt='v176-shop-'+r.item,paid=settleVisit(s,guest,r.building,receipt,0);assert.equal(paid.paid,r.price);
  assert.equal(s.inventory[r.item],0);assert.equal(s.coins-before,r.price-operatingCost(r.price));assert(s.coins-before<=8);
  assert.equal(settleVisit(s,guest,r.building,receipt,0).paid,0);assert.equal(s.coins-before,paid.net);
 }
});

test('expanded venue shelves accept every genuine recipe but still reject duplicates and foreign products',()=>{
 const s=fresh();for(const id of [1,2,17]){
  const rows=shopListing(s,id);assert.equal(rows.length,shopCapacity(id));assert(rows.length>12);
  assert(configureShopfront(s,{buildingId:id,listing:rows,expectedShopRevision:s.shopfronts?.revision||0}).ok);assert(validShopfronts(s));
  assert(!configureShopfront(s,{buildingId:id,listing:[...rows,rows[0]],expectedShopRevision:s.shopfronts.revision}).ok);
  assert(!configureShopfront(s,{buildingId:id,listing:[{item:'lantern',keep:0}],expectedShopRevision:s.shopfronts.revision}).ok);
 }
});

test('new crop and food IDs can carry authenticated cooperation evidence without extending V1 rewards',()=>{
 const base={stepId:'crop-step',operationId:'crop-operation',contractId:'contract-176',parentRunId:'hd-parent-'+'a'.repeat(32),childRunId:'hd-child-'+'b'.repeat(32),amount:1};
 for(const item of SEASONAL_ITEM_IDS)assert(validCooperationRows([{...base,item}]));
 assert(!validCooperationRows([{...base,item:'unknown-crop'}]));assert.equal(RAW_IDS_V1.length,50);assert.equal(RECIPE_IDS_V1.length,300);
});

for(const theme of ['pixel','origami'])test(`${theme}: old canonical save gets zero-only migration once without changing an accepted craft`,async()=>{
 const f=await fixture(theme,s=>{Object.assign(s.inventory,RECIPE_BY_ID.recipe_lantern.cost);s.inventory.wheat=7;});
 let r=await f.store.action(theme,{kind:'craft',operation:'begin',recipeId:'recipe_lantern',requestId:randomUUID(),mode:'1',expectedSequence:f.document.actions.sequence,epoch:f.document.actions.epoch,expectedVersion:f.document.version});
 const legacy=structuredClone(r.document);for(const id of SEASONAL_ITEM_IDS)delete legacy.state.inventory[id];legacy.state.productionVersion=123;legacy.actions.active.recipeContract.catalogVersion=123;
 syncPersonalState(legacy.state,legacy.actions);legacy.checksum=hash(legacy.state);legacy.actionsChecksum=hash(legacy.actions);
 await writeFile(join(f.directory,theme,'current.json'),JSON.stringify(legacy));
 const forged=structuredClone(legacy.state);forged.inventory.cabbage=999;forged.inventory.season_blueberry_tart=999;
 const migrated=(await f.reopen().openClient(theme,{legacyState:forged})).document;
 assert.equal(migrated.reason,'catalog-migration-v176');assert.equal(migrated.revision,legacy.revision+1);
 assert.deepEqual(migrated.actions.active,legacy.actions.active);assert(acceptedRecipe(migrated.actions.active));
 for(const [id,n] of Object.entries(legacy.state.inventory))assert.equal(migrated.state.inventory[id],n,id);
 for(const id of SEASONAL_ITEM_IDS){assert.equal(migrated.state.inventory[id],0);assert.equal(migrated.state.discovered[id],undefined);}
 assert.deepEqual(personalSnapshot(hydrateContent(structuredClone(migrated.state))),migrated.actions.personal.snapshot);
 const rows=await readdir(join(f.directory,theme,'history')),backups=await Promise.all(rows.map(p=>readFile(join(f.directory,theme,'history',p),'utf8').then(JSON.parse)));
 assert.equal(backups.filter(b=>b.reason==='before-catalog-v176').length,1);
 assert.equal((await f.reopen().openClient(theme)).document.version,migrated.version);
 const saved=await f.reopen().save(theme,{state:migrated.state,expectedVersion:migrated.version,saveId:randomUUID(),activeSeconds:0});
 const cancelled=await f.store.action(theme,command({ticket:migrated.actions.active,document:saved.document},'cancel'));assert.equal(cancelled.receipt.outcome,'cancelled');
 for(const [id,n] of Object.entries(legacy.state.inventory))assert.equal(cancelled.document.state.inventory[id],n,id);
});
