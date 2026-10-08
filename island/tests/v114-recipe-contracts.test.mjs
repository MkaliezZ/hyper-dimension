import {LEGACY_RECIPE_DEFINITIONS} from '../src/legacyRecipeDefinitions-v32.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ALL_RECIPES,RECIPE_BY_ID,CATALOG_ITEMS} from '../src/contentCatalog.js';
import {createProject,projectSteps,assignProjectStep,syncProjects,controlProject} from '../src/projectPlans.js';
import {restoreTasks} from '../src/taskBoard.js';
import {availableQuantity,commitResources} from '../src/resourceLedger.js';
import {createCraftGame,applyCraftEvent,craftResult,restoreMatchState} from '../src/craftGameReplay.js';
import {WORKSHOP_GAMES} from '../src/workshopCatalog.js';
import {findLinkMove,suggestMatchMove} from '../src/classicRules.js';
import {chooseAction} from './v19-play-helpers.mjs';
await mkdir('qa/v114/contracts',{recursive:true});
async function fixture({stock=true}={}){
 const directory=await mkdtemp(resolve('qa/v114/contracts/craft-'));let clock=1000000;
 const store=createSaveStore({directory,now:()=>clock}),s=hydrateTown(createZeroState());s.freshStartPending=false;
 if(stock)for(const item of CATALOG_ITEMS)s.inventory[item.id]=999;
 for(const f of Object.values(s.facilities)){f.quality=90;f.condition=100;f.upgrades=4}
 s.research??={};for(let id=0;id<25;id++)s.research[id]=10;
 const {document}=await store.open('pixel',{legacyState:s});
 return {store,document,directory,advance:n=>clock+=n,other:()=>createSaveStore({directory,now:()=>clock})};
}
const begin=(d,recipeId='recipe_lantern',extra={})=>({kind:'craft',operation:'begin',requestId:randomUUID(),recipeId,mode:'2',epoch:d.actions?.epoch||null,expectedSequence:d.actions?.sequence||0,expectedVersion:d.version,...extra});
const command=(r,operation,extra={})=>({kind:'craft',operation,requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version,...extra});
function traceFor(game){
 game=structuredClone(game);const trace=[];const event=e=>{trace.push(e);applyCraftEvent(game,e)};
 if(game.engine==='workshop'){
  event({action:{type:'start'}});
  for(let i=0;i<18000&&game.state.phase!=='result';i++){const a=chooseAction(game.state);if(a)event({action:a});event({dt:1/30})}
 }else if(game.engine==='link'){
  event({action:{type:'start'}});
  for(let i=0;i<200&&!game.result;i++){const m=findLinkMove(game.values,game.level.link.columns,game.level.link.rows);assert(m);event({dt:.05});event({action:{type:'pair',a:m.a,b:m.b}})}
 }else{
  for(let i=0;i<100&&!game.result;i++){const m=suggestMatchMove(restoreMatchState(game.match));assert(m);event({dt:.05});event({action:{type:'swap',a:m[0],b:m[1]}})}
 }
 assert(craftResult(game)?.passed,'legal play failed '+(game.state?.id??game.level.id));
 return {trace,game};
}
async function play(f,start){
 const {trace,game}=traceFor(start.ticket.game);let r=start;
 for(let i=0;i<trace.length;i+=500){const events=trace.slice(i,i+500);f.advance(Math.ceil(events.reduce((n,e)=>n+(e.dt||0),0)*1000)+10);r=await f.store.action('pixel',command(r,'checkpoint',{batch:r.ticket.nextBatch,events}))}
 return {r,game};
}

import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {recipeContract,acceptedRecipe,validRecipeContract,validAcceptedRecipe} from '../src/recipeContracts.js';
import {validActionBook} from '../server/playerActions.mjs';
import {validCraftTicket} from '../server/craftActions.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function legacyDisk(f,r){
 const file=resolve(f.directory,'pixel/current.json'),d=JSON.parse(await readFile(file,'utf8'));
 if(d.actions.active)delete d.actions.active.recipeContract;
 for(const t of Object.values(d.actions.resident?.leases||{}))delete t.recipeContract;
 d.actionsChecksum=digest(d.actions);await writeFile(file,JSON.stringify(d));
 return {...r,document:await f.other().current('pixel')};
}
async function changedRecipe(id,run){const r=RECIPE_BY_ID[id],original=r.cost;r.cost={wood:83,clay:41};try{return await run(original)}finally{r.cost=original}}

test('all 300 definitions produce detached, valid contracts and recover legacy accepted material lists',()=>{
 for(const r of ALL_RECIPES){
  const c=recipeContract(r),t={kind:'craft',recipeId:r.id,item:r.item,building:r.building,reservedItems:{...r.cost},recipeContract:c};
  assert(validRecipeContract(c));assert(validAcceptedRecipe(t));assert.notEqual(c.cost,r.cost);assert.deepEqual(acceptedRecipe(t).cost,r.cost);
  const legacy=LEGACY_RECIPE_DEFINITIONS[r.id],old={...t,reservedItems:{...legacy.cost}};delete old.recipeContract;assert(validAcceptedRecipe(old));assert.deepEqual(acceptedRecipe(old).cost,legacy.cost);
  if(JSON.stringify(r.cost)!==JSON.stringify(legacy.cost)){assert.notDeepEqual(acceptedRecipe(old).cost,r.cost);assert.equal(acceptedRecipe(old).productionVersion,32);}
 }
});

test('contract validation rejects malformed costs, wrong outputs and tool-inclusive material substitution',()=>{
 const r=RECIPE_BY_ID.recipe_lantern,c=recipeContract(r),t={kind:'craft',recipeId:r.id,item:r.item,building:r.building,reservedItems:{...r.cost},recipeContract:c};
 for(const cost of [{},{wood:-1},{wood:0},{wood:1.5},{wood:10000},{no_such_material:1}])assert(!validRecipeContract({...c,cost}));
 assert(!validRecipeContract({...c,item:'pottery'}));assert(!validRecipeContract({...c,building:15}));
 assert(!validAcceptedRecipe({...t,reservedItems:{wood:3,ore:1}}));assert(!validAcceptedRecipe({...t,recipeContract:{...c,cost:{wood:3,ore:1}}}));
 const owned={...t,tool:{source:'owned',id:'axe'},reservedItems:{...r.cost,axe:1}};assert(validAcceptedRecipe(owned));assert(!Object.hasOwn(acceptedRecipe(owned).cost,'axe'));
});

for(const legacy of [false,true])test((legacy?'legacy':'new')+' player finishes a real replayed game after catalog change and store reopen at the accepted cost exactly once',async()=>{
 const recipe=RECIPE_BY_ID.recipe_lantern,latestCost=recipe.cost;
 // A genuine pre-contract ticket was created under the old frozen bill. Do not erase
 // a new ticket's contract and then mislabel its different reservation as V32.
 if(legacy)recipe.cost={...LEGACY_RECIPE_DEFINITIONS.recipe_lantern.cost};
 try{
 const f=await fixture(),start=await f.store.action('pixel',begin(f.document,'recipe_lantern',{recipeContract:{cost:{}}}));
 assert.deepEqual(start.ticket.recipeContract.cost,RECIPE_BY_ID.recipe_lantern.cost);const {r}=await play(f,start);f.advance(2200);
 const loaded=legacy?await legacyDisk(f,r):r;
 await changedRecipe('recipe_lantern',async cost=>{
  const restored=await f.other().current('pixel');assert(validActionBook(restored.actions));assert.deepEqual(acceptedRecipe(restored.actions.active).cost,cost);
  const done=await f.other().action('pixel',command({...loaded,document:restored},'finish'));
  assert.deepEqual(done.receipt.cost,cost);for(const [id,n] of Object.entries(cost))assert.equal(done.document.state.inventory[id],999-n,id+' accepted debit');assert.equal(done.document.state.inventory.ore,999-(cost.ore||0));assert.equal(done.document.state.inventory.clay,999);assert.equal(done.document.state.inventory.lantern,1000);
  const again=await f.other().action('pixel',command(r,'finish'));assert(again.replayed);assert.equal(again.document.version,done.document.version);
 });
 }finally{recipe.cost=latestCost}
});

test('project cancellation returns the original transferred ingredients after catalog change',async()=>{
 const f=await fixture(),s=structuredClone(f.document.state);s.inventory.lantern=0;
 const p=createProject(s,{id:'cost-change-project',targets:{lantern:1}});assert(p.ok);const task=projectSteps(s,p.project.id).find(t=>t.targetItem==='lantern');assert(assignProjectStep(s,task.id,-1).ok);
 const d=(await f.store.save('pixel',{state:s,expectedVersion:f.document.version})).document,start=await f.store.action('pixel',begin(d,'recipe_lantern',{taskId:task.id}));
 await changedRecipe('recipe_lantern',async cost=>{
  const done=await f.other().action('pixel',command(start,'cancel')),hold=done.document.state.resourceLedger.reservations[task.resourceOwner].items;
  assert.deepEqual(hold,cost);assert.equal(done.document.state.inventory.lantern,0);assert.equal(done.document.state.inventory.clay,999);assert.equal(done.receipt.outcome,'cancelled');
 });
});

for(const legacy of [false,true])test((legacy?'legacy':'new')+' resident resumes its accepted production after catalog change without consuming new ingredients or its tool',async()=>{
 const f=await fixture(),d=f.document,intent={goal:'workshop',buildingId:0,action:'work',recipeId:'recipe_lantern'};
 const start=await f.store.action('pixel',{kind:'resident',operation:'begin',actorId:1,intent,gameTime:0,requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null});
 f.advance(start.ticket.duration*1000+10);const loaded=legacy?await legacyDisk(f,start):start;
 await changedRecipe('recipe_lantern',async cost=>{
  const restored=await f.other().current('pixel'),ticket=restored.actions.resident.leases[start.ticket.requestId];assert(validActionBook(restored.actions));assert.deepEqual(acceptedRecipe(ticket).cost,cost);
  const input={kind:'resident',operation:'finish',requestId:ticket.requestId,sequence:ticket.sequence,epoch:ticket.epoch,expectedVersion:restored.version};
  const done=await f.other().action('pixel',input);assert.deepEqual(done.receipt.cost,cost);assert.equal(done.document.state.inventory.lantern,1000);assert.equal(done.document.state.inventory.wood,997);assert.equal(done.document.state.inventory.clay,999);
  if(ticket.tool?.source==='owned')assert.equal(done.document.state.inventory[ticket.tool.id],999);
  const again=await f.other().action('pixel',input);assert(again.replayed);assert.equal(again.document.version,done.document.version);
 });
});

test('caller supplied material contracts and autosave changes cannot rewrite accepted deductions',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document,'recipe_lantern',{recipeContract:{version:1,cost:{wood:1}}}));
 assert.deepEqual(r.ticket.recipeContract.cost,RECIPE_BY_ID.recipe_lantern.cost);
 const state=structuredClone(r.document.state);state.resourceLedger.reservations[r.ticket.owner].items={wood:1};
 await assert.rejects(f.store.save('pixel',{state,expectedVersion:r.document.version}),e=>e.code==='action_hold_conflict');
 const loaded=await f.other().current('pixel');assert.deepEqual(loaded.actions.active.recipeContract.cost,RECIPE_BY_ID.recipe_lantern.cost);
});
