import test from 'node:test';
import assert from 'node:assert/strict';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {ALL_RECIPES,itemUse} from '../src/contentCatalog.js';
import {GARMENTS,WEAR_SLOTS,TOOLS,BASE_TOOLS,wornItems,isWorn,hydrateWardrobe,equipOutfit,unequipOutfit,resolveTool,beginToolUse,endToolUse,clearToolLeases,minePrecision,validToolbelt,toolPurpose} from '../src/equipmentRules.js';
import {reserveResources,availableQuantity} from '../src/resourceLedger.js';
import {recordPlayerGoods} from '../src/economy.js';
import {validateState} from '../server/saveStore.mjs';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop,anglingEquipment} from '../src/workshopRules.js';
const fresh=()=>hydrateTown(createZeroState());
function give(s,ids){for(const id of ids){s.inventory[id]=(s.inventory[id]||0)+1;recordPlayerGoods(s,id)}}
test('all catalog garments and tools have an actual declared slot, two-theme atlas row or work action',()=>{
 assert.deepEqual(Object.keys(GARMENTS).sort(),ALL_RECIPES.filter(r=>r.category==='wear').map(r=>r.item).sort());
 assert.deepEqual(Object.keys(TOOLS).sort(),ALL_RECIPES.filter(r=>r.category==='tool').map(r=>r.item).sort());
 for(const [id,g] of Object.entries(GARMENTS)){assert.equal(ALL_RECIPES.find(r=>r.item===id).name,g.name);assert(g.slot in WEAR_SLOTS);assert(g.pack>=0&&g.pack<4);assert(g.row>=0&&g.row<3)}
});
test('six slots conserve every copy and personal credit through replacement, reload and selective reclaim',()=>{
 let s=fresh();const ids=['c4_1','c4_7','c4_2','c4_6','c4_3','c4_4'];give(s,ids);
 for(const id of ids)assert(equipOutfit(id,s).ok);
 assert.equal(wornItems(s).length,6);for(const id of ids){assert.equal(s.inventory[id],0);assert.equal(s.economy.playerGoods[id],0)}
 validateState(s);s=hydrateTown(JSON.parse(JSON.stringify(s)));validateState(s);
 for(const id of ids)assert.equal(equipOutfit(id,s).unchanged,true);
 assert(unequipOutfit(s,'c4_3').ok);assert.equal(wornItems(s).length,5);assert.equal(s.inventory.c4_3,1);assert.equal(s.economy.playerGoods.c4_3,1);
 assert(unequipOutfit(s).ok);for(const id of ids){assert.equal(s.inventory[id],1);assert.equal(s.economy.playerGoods[id],1)}
 assert.equal(unequipOutfit(s).unchanged,true);validateState(s);
});
test('one-piece and skirt replacement returns all displaced garments atomically without extra credits',()=>{
 const s=fresh();give(s,['c4_1','c4_7','c4_8','c4_2']);equipOutfit('c4_1',s);equipOutfit('c4_7',s);equipOutfit('c4_2',s);
 assert(equipOutfit('c4_8',s).ok);assert.deepEqual(new Set(wornItems(s)),new Set(['c4_8','c4_2']));assert.equal(s.inventory.c4_1,1);assert.equal(s.inventory.c4_7,1);
 assert(equipOutfit('c4_7',s).ok);assert.deepEqual(new Set(wornItems(s)),new Set(['c4_7','c4_2']));assert.equal(s.inventory.c4_8,1);
 for(const id of ['c4_1','c4_7','c4_8','c4_2'])assert.equal(s.inventory[id]+(isWorn(s,id)?1:0),1);validateState(s);
});
test('version-one equipped provenance migrates once and a foreign reservation blocks replacement',()=>{
 const s=fresh();s.wardrobe={version:1,equipped:{item:'c4_3',personalCredit:true},history:[]};s.playerProfile.outfit='c4_3';hydrateWardrobe(s);hydrateWardrobe(s);assert.equal(s.wardrobe.slots.head.item,'c4_3');assert.equal(s.inventory.c4_3,0);
 give(s,['c4_10']);reserveResources(s,'project:gift',{c4_10:1});assert.equal(equipOutfit('c4_10',s).ok,false);assert(isWorn(s,'c4_3'));
 unequipOutfit(s,'c4_3');assert.equal(s.inventory.c4_3,1);assert.equal(s.economy.playerGoods.c4_3,1);validateState(s);
});
test('zero start borrows without inventing tool stock; residents do not inherit the player equipment',()=>{
 const s=fresh();const inventory={...s.inventory};
 for(const action of Object.keys(BASE_TOOLS)){const use=beginToolUse(s,action,1.6);assert.equal(use.tool.source,'borrowed');assert.equal(use.duration,1.6);assert.equal(use.owner,null);endToolUse(s,use)}
 assert.deepEqual(s.inventory,inventory);give(s,['c16_9']);itemUse('c16_9',s);
 const npc=resolveTool(s,'fish',{npc:true});assert.equal(npc.id,'rod');assert.equal(npc.durationScale,1);assert.equal(npc.trackingBonus,0);assert.equal(resolveTool(s,'fish').id,'c16_9');
});
test('owned tools change actual duration and precision, hold stock during work and release on cancellation/reload',()=>{
 const s=fresh();give(s,['pickaxe','axe','c16_9','c4_4']);itemUse('c16_9',s);equipOutfit('c4_4',s);
 assert(Math.abs(minePrecision(s)-.165)<1e-8);const use=beginToolUse(s,'pickaxe',1.25);assert.equal(use.duration,1.125);assert.equal(availableQuantity(s,'pickaxe'),0);
 assert.equal(itemUse('pickaxe',s,{action:'gift',npcId:0}).ok,false);assert.equal(s.inventory.pickaxe,1);validateState(s);endToolUse(s,use);assert.equal(availableQuantity(s,'pickaxe'),1);
 reserveResources(s,'project:wood',{axe:1});const unavailable=beginToolUse(s,'axe',1.6);assert.equal(unavailable.tool.source,'borrowed');assert.equal(unavailable.duration,1.6);
 const fishing=beginToolUse(s,'fish',2.2);assert.equal(fishing.tool.id,'c16_9');assert.equal(fishing.tool.trackingBonus,14);assert(Math.abs(fishing.duration-1.87)<1e-8);
 clearToolLeases(s);assert.equal(availableQuantity(s,'c16_9'),1);assert.equal(availableQuantity(s,'axe'),0);assert(s.resourceLedger.reservations['project:wood']);assert(validToolbelt(s));assert(toolPurpose('pickaxe',s).text.includes('精准区'));validateState(s);
});
test('malformed slot, conflicting one-piece, wrong-action tool and mirror record cannot overwrite progress',()=>{
 for(const corrupt of [
 s=>s.wardrobe.slots.head={item:'wood',personalCredit:false},
 s=>{give(s,['outfit','c4_7']);equipOutfit('outfit',s);s.wardrobe.slots.bottom={item:'c4_7',personalCredit:true}},
 s=>s.toolbelt.fish='pickaxe',
 s=>s.wardrobe.equipped={item:'c4_3',personalCredit:false}
 ]){const s=fresh();corrupt(s);assert.throws(()=>validateState(s),/服装|工具/)}
});

test('ordinary angling applies owned-rod cast and tracking tolerance in real gameplay; borrowed gear has no bonus',()=>{
 const level=makeWorkshopLevel(16,731,1),states={};
 for(const [key,equipment] of Object.entries({borrowed:{id:'rod',source:'borrowed'},basic:{id:'rod',source:'owned'},advanced:{id:'c16_9',source:'owned'},invalid:{id:'pickaxe',source:'owned',trackingBonus:999}})){
  const s=createWorkshopState(level,equipment);states[key]=s;workshopAction(s,{type:'start'});
  const spot=level.spots[0];workshopAction(s,{type:'down',x:spot.x-level.wind+105,y:spot.y});workshopAction(s,{type:'up'});
  assert.equal(s.castGood,key==='advanced',key+' cast threshold');
  s.mode='fight';s.fightStart=0;s.t=0;s.progress=0;s.holding=true;
  const dt=.05;s.pointer.x=spot.x+Math.sin(dt*1.1+spot.phase)*100+140;stepWorkshop(s,dt);
 }
 assert(states.advanced.progress>states.basic.progress*2);
 assert.equal(states.basic.progress,states.borrowed.progress);assert.equal(states.invalid.progress,states.borrowed.progress);
 assert.equal(anglingEquipment(states.advanced).trackingRadius,144);assert.equal(anglingEquipment(states.basic).trackingRadius,136);
 assert.equal(anglingEquipment(states.invalid).castRadius,95);
});
