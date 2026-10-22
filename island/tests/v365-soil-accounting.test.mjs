import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';
import {commitResources} from '../src/resourceLedger.js';import {RECIPE_BY_ID} from '../src/contentCatalog.js';
import {newActionBook} from '../server/playerActions.mjs';import {applyResidentCommand} from '../server/residentActions.mjs';
import {assertSoilInventory} from './soilInventoryAccounting.mjs';
const recipe=RECIPE_BY_ID.recipe_c14_8;
function fixture(npc=false){
 const state=hydrateTown(createZeroState());state.freshStartPending=false;state.buildings[14]=1;
 for(const [id,n]of Object.entries(recipe.cost))state.inventory[id]=n*2;
 const crafted={resourceReceiptId:'player:craft:1:result'},fertilized={ticket:{epoch:'owned-soil-control',sequence:2}};
 assert(commitResources(state,{id:crafted.resourceReceiptId,cost:recipe.cost,gain:{c14_8:1},category:'craft'}).ok);
 assert(commitResources(state,{id:'farm:owned-soil-control:2',cost:{c14_8:1},category:'player_farm'}).ok);
 if(npc){const book=newActionBook(),start=applyResidentCommand(state,book,{kind:'resident',operation:'begin',actorId:1,requestId:randomUUID(),expectedSequence:book.sequence,epoch:book.epoch,gameTime:100,intent:{goal:'greenhouse',buildingId:14,action:'work',recipeId:recipe.id}},1000000);
  const finished=applyResidentCommand(state,book,{kind:'resident',operation:'finish',requestId:start.ticket.requestId,epoch:start.ticket.epoch,sequence:start.ticket.sequence},1000000+start.ticket.duration*1000);
  assert.deepEqual(finished.receipt.cost,recipe.cost);assert.deepEqual(finished.receipt.gain,{c14_8:1});
 }
 return {document:{state},options:{crafted,fertilized,recipe}};
}
test('player compost remains exactly consumed with no autonomous output',()=>{const f=fixture();assert.equal(assertSoilInventory(f.document,f.options).remaining,0);});
test('actual authorized NPC production pays full inputs and explains the extra bag',()=>{const f=fixture(true),r=assertSoilInventory(f.document,f.options);assert.equal(r.npcProduced,1);assert.equal(r.remaining,1);for(const id of Object.keys(recipe.cost))assert.equal(f.document.state.inventory[id],0);});
test('an unexplained extra bag still fails inventory validation',()=>{const f=fixture();f.document.state.inventory.c14_8++;assert.throws(()=>assertSoilInventory(f.document,f.options));});
test('an additional fertilizer consumption still fails validation',()=>{const f=fixture(true);assert(commitResources(f.document.state,{id:'farm:unexpected:3',cost:{c14_8:1},category:'player_farm'}).ok);assert.throws(()=>assertSoilInventory(f.document,f.options));});
test('a free NPC bag cannot substitute for a paid recipe receipt',()=>{const f=fixture();assert(commitResources(f.document.state,{id:'npc-work:'+randomUUID()+':craft',gain:{c14_8:1},category:'craft'}).ok);assert.throws(()=>assertSoilInventory(f.document,f.options));});
test('a mismatched NPC recipe cost still fails validation',()=>{const f=fixture(true),row=Object.entries(f.document.state.resourceLedger.receipts).find(([id])=>id.startsWith('npc-work:'));row[1].delta.leaves=-1;assert.throws(()=>assertSoilInventory(f.document,f.options));});
test('a missing player production receipt cannot be hidden by a zero balance',()=>{const f=fixture();delete f.document.state.resourceLedger.receipts[f.options.crafted.resourceReceiptId];assert.throws(()=>assertSoilInventory(f.document,f.options));});
test('a duplicate player output under another operation cannot count as NPC output',()=>{const f=fixture(true),row=f.document.state.resourceLedger.receipts[f.options.crafted.resourceReceiptId];f.document.state.resourceLedger.receipts['player:craft:2:result']=structuredClone(row);f.document.state.inventory.c14_8++;assert.throws(()=>assertSoilInventory(f.document,f.options));});
