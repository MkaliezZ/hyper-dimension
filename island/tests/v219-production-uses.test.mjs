import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ALL_RECIPES,RAW_MATERIALS,RECIPE_BY_ID,ITEM_BY_ID,recipeGate} from '../src/contentCatalog.js';
import {itemPurpose} from '../src/itemPurpose.js';
import {availableQuantity,commitResources} from '../src/resourceLedger.js';
import {resolveTool,equipTool,validToolbelt} from '../src/equipmentRules.js';
import {createProject,projectSteps} from '../src/projectPlans.js';
import {applyCraftEvent,craftResult} from '../src/craftGameReplay.js';
import {chooseAction} from './v19-play-helpers.mjs';

const command=(r,operation,extra={})=>({kind:'craft',operation,requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version,...extra});
async function fixture(theme='pixel',owned=true){
 await mkdir('qa/v219',{recursive:true});const directory=await mkdtemp(resolve('qa/v219/uses-'));let now=1000000;
 const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.inventory.c24_2=owned?1:0;
 for(const[id,n]of Object.entries(RECIPE_BY_ID.recipe_painting.cost))seed.inventory[id]=n;
 const store=createSaveStore({directory,now:()=>now}),document=(await store.open(theme,{legacyState:seed,protect:true})).document;
 return{store,document,directory,advance:n=>now+=n,reopen:()=>createSaveStore({directory,now:()=>now})};
}
function legalPaintingTrace(game){
 const g=structuredClone(game),trace=[];const emit=e=>{trace.push(e);applyCraftEvent(g,e);};emit({action:{type:'start'}});
 for(let i=0;i<18000&&!craftResult(g);i++){const action=chooseAction(g.state);if(action)emit({action});emit({dt:1/30});}
 assert(craftResult(g)?.passed,'Painting must pass by legal complete game inputs');return trace;
}

test('studio components have specific downstream uses, same catalog identities and an accessible raw-only painting plan',()=>{
 const s=hydrateTown(createZeroState());assert.equal(ALL_RECIPES.length,308);assert.equal(RAW_MATERIALS.length,58);
 for(const[input,output]of [['c24_3','painting'],['c7_9','c7_11'],['c13_7','c13_9']]){
  assert.equal(RECIPE_BY_ID['recipe_'+output].cost[input],1);assert(itemPurpose(input,s).next.some(n=>n.id===output&&n.quantity===1));assert(recipeGate(RECIPE_BY_ID['recipe_'+input],s).ready);
 }
 assert.equal(ITEM_BY_ID.c24_2.category,'tool');assert.equal(resolveTool(s,'paint').source,'borrowed');assert.equal(s.inventory.c24_2,0);
 assert.equal(equipTool('c24_2',s).ok,false);s.inventory.c24_2=1;assert(equipTool('c24_2',s).ok);assert(validToolbelt(s));assert.equal(s.toolbelt.paint,'c24_2');
 assert.match(itemPurpose('c24_2',s).primary.text,/收尾/);assert.match(itemPurpose('c24_2',s).primary.text,/不缩短关卡/);
 s.inventory.c24_2=0;for(const raw of RAW_MATERIALS)s.inventory[raw.id]=50;
 const made=createProject(s,{id:'painting-from-raw',targets:{painting:1}});assert(made.ok);
 const steps=projectSteps(s,made.project.id);assert(steps.some(t=>t.targetItem==='c24_3'));assert(steps.some(t=>t.targetItem==='painting'));assert(!steps.some(t=>t.targetItem==='c24_2'),'A personal brush is optional; the public studio remains usable from zero');
});

for(const theme of ['pixel','origami'])for(const owned of [false,true])test(theme+' full legal painting '+(owned?'holds and returns a personal brush':'uses a public brush without minting one')+' through durable finish and replay',async()=>{
 const f=await fixture(theme,owned),d=f.document,input={kind:'craft',operation:'begin',recipeId:'recipe_painting',mode:'1',requestId:crypto.randomUUID(),expectedVersion:d.version,epoch:d.actions.epoch,expectedSequence:d.actions.sequence};
 let r=await f.store.action(theme,input);assert.equal(r.ticket.practice,false);assert.equal(r.ticket.tool.id,'c24_2');assert.equal(r.ticket.tool.source,owned?'owned':'borrowed');assert.equal(r.ticket.duration,owned?1.68:2.1);assert.equal(r.ticket.reservedItems.c24_2,owned?1:undefined);assert.equal(availableQuantity(r.document.state,'c24_2'),0);
 assert.equal(commitResources(structuredClone(r.document.state),{cost:{c24_2:1}}).ok,false);
 const trace=legalPaintingTrace(r.ticket.game);
 for(let i=0;i<trace.length;i+=500){const events=trace.slice(i,i+500);f.advance(Math.ceil(events.reduce((n,e)=>n+(e.dt||0),0)*1000)+10);r=await f.store.action(theme,command(r,'checkpoint',{batch:r.ticket.nextBatch,events}));}
 f.advance(2200);const finish=command(r,'finish'),done=await f.reopen().action(theme,finish),again=await f.reopen().action(theme,finish);
 assert.equal(done.receipt.outcome,'finished');assert.deepEqual(done.receipt.cost,RECIPE_BY_ID.recipe_painting.cost);assert.equal(done.document.state.inventory.painting,1);assert.equal(done.document.state.inventory.c24_2,owned?1:0);assert.equal(availableQuantity(done.document.state,'c24_2'),owned?1:0);assert.equal(done.document.state.inventory.c24_3,0);assert.equal(done.document.state.economy.playerGoods.painting,1);
 assert.equal(again.replayed,true);assert.equal(again.document.actions.receipts.filter(t=>t.ticket.requestId===input.requestId).length,1);assert.equal(again.document.state.inventory.painting,1);
});

test('reopening and cancelling a painting returns all materials and the same held brush without an output',async()=>{
 const f=await fixture(),d=f.document,start=await f.store.action('pixel',{kind:'craft',operation:'begin',recipeId:'recipe_painting',mode:'1',requestId:crypto.randomUUID(),expectedVersion:d.version,epoch:d.actions.epoch,expectedSequence:d.actions.sequence});
 const restored=await f.reopen().current('pixel');assert.equal(restored.actions.active.tool.id,'c24_2');assert.equal(availableQuantity(restored.state,'c24_2'),0);
 const cancel=command({...start,document:restored},'cancel'),done=await f.reopen().action('pixel',cancel),again=await f.reopen().action('pixel',cancel);
 assert.equal(done.receipt.outcome,'cancelled');assert.equal(done.document.state.inventory.painting,0);assert.equal(done.document.state.inventory.c24_2,1);for(const[id,n]of Object.entries(RECIPE_BY_ID.recipe_painting.cost))assert.equal(done.document.state.inventory[id],n);assert.equal(again.replayed,true);
});
