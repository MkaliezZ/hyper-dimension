import test from 'node:test';
import assert from 'node:assert/strict';
import {firstCraftPreparation} from '../src/firstCraftGuide.js';
import {journeyView,trackJourney} from '../src/journey.js';
import {ALL_RECIPES,RAW_MATERIALS} from '../src/contentCatalog.js';
import {reserveResources} from '../src/resourceLedger.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
const world=()=>hydrateTown(createZeroState());

test('first milestone uses the current physical bill; obsolete ore alone cannot start the lantern',()=>{
 const s=world();s.inventory={wood:4,ore:2};const p=firstCraftPreparation(s);
 assert.deepEqual(Object.fromEntries(p.materials.map(m=>[m.id,m.required])),ALL_RECIPES.find(r=>r.item==='lantern').cost);
 assert.equal(p.ready,false);assert.deepEqual(p.missing.map(m=>m.id),['quartz','wax','fiber']);
 for(const m of p.materials)assert(RAW_MATERIALS.some(x=>x.id===m.id&&x.source===m.source));
});

test('current guide directs each missing material to its actual collection entry and reaches crafting only when ready',()=>{
 const s=world();trackJourney(s,'meet');trackJourney(s,'gather',{item:'wood',amount:4});trackJourney(s,'gather',{item:'quartz',amount:2});s.inventory.wood=4;
 assert.equal(journeyView(s).step.action,'material:quartz');s.inventory.quartz=1;assert.equal(journeyView(s).step.action,'material:wax');s.inventory.wax=1;assert.equal(journeyView(s).step.action,'material:fiber');s.inventory.fiber=1;
 assert.equal(journeyView(s).step.action,'lantern');assert(firstCraftPreparation(s).ready);
});

test('materials reserved by another live project are not advertised as ready',()=>{
 const s=world();s.inventory={wood:2,quartz:1,wax:1,fiber:1};assert(firstCraftPreparation(s).ready);
 assert(reserveResources(s,'fixture:other-project',{wax:1}).ok);const p=firstCraftPreparation(s);assert.equal(p.ready,false);assert.deepEqual(p.missing.map(m=>[m.id,m.available,m.missing]),[['wax',0,1]]);assert.equal(s.inventory.wax,1);
});

test('completed legacy mining and first-craft pages remain complete after their materials are consumed',()=>{
 const s=world();trackJourney(s,'meet');trackJourney(s,'gather',{item:'wood',amount:3});trackJourney(s,'gather',{item:'ore',amount:1});trackJourney(s,'craft',{item:'lantern',building:0});
 const v=journeyView(s);assert(v.j.completed.mine);assert(v.j.completed.craft);assert.equal(v.steps.find(x=>x.id==='craft').title,'做出第一盏星灯');assert.equal(v.step.id,'plant');
});
