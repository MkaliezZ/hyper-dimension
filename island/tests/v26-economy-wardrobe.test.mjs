import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown,settleVisit} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {ALL_RECIPES,itemUse,unequipOutfit,hydrateWardrobe} from '../src/contentCatalog.js';
import {reserveResources} from '../src/resourceLedger.js';
import {townDailyBudget,tickTownEconomy,settleTownDay,recordPlayerGoods,transact} from '../src/economy.js';
import {validateState} from '../server/saveStore.mjs';
const fresh=()=>hydrateTown(createState());

test('15-minute budget protects working capital, has no debt, and active earnings do not inflate the bill',()=>{
 const s=fresh();assert.equal(townDailyBudget(s).total,84);const before=townDailyBudget(s);
 transact(s,{income:100,category:'order',note:'manual work'});
 assert.deepEqual(townDailyBudget(s),before);
 const row=settleTownDay(s);assert.equal(row.paid,84);assert.equal(row.operatingNet,16);assert.equal(settleTownDay(s),false);
 s.day++;s.coins=23;assert.equal(settleTownDay(s).paid,3);assert.equal(s.coins,20);
 s.day++;const reduced=settleTownDay(s);assert.equal(reduced.paid,0);assert.equal(reduced.deferred,84);
 assert.equal(s.coins,20);
});

test('existing in-progress day keeps old bill; next day adopts new policy once across reload',()=>{
 let s=fresh();delete s.economy.budgetPolicyVersion;delete s.economy.budgetPolicyStartsDay;s.economy.daySeconds=899;s.coins=300;
 s=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(townDailyBudget(s).total,18);
 tickTownEconomy(s,1);assert.equal(s.coins,282);assert.equal(s.day,2);assert.equal(townDailyBudget(s).total,84);
 s=hydrateTown(JSON.parse(JSON.stringify(s)));tickTownEconomy(s,900);assert.equal(s.coins,198);assert.equal(s.day,3);
});

test('zero start earns admission without a cash prerequisite and never accrues debt',()=>{
 const s=hydrateTown(createZeroState());assert.equal(s.coins,0);
 const sale=settleVisit(s,{name:'旅人',budget:24},6,'zero-visitor',10);assert.equal(sale.net,2);
 const day=settleTownDay(s);assert.equal(day.paid,0);assert.equal(s.coins,2);assert.equal(day.deferred,84);
 s.day++;assert.equal(settleTownDay(s).paid,0);assert.equal(s.coins,2);
});

test('each of the 12 garments occupies its durable clothing slot; repeated equip and reload cannot consume a second copy',()=>{
 const clothes=ALL_RECIPES.filter(r=>r.category==='wear');assert.equal(clothes.length,12);
 for(const r of clothes){
  let s=fresh();s.inventory[r.item]=2;recordPlayerGoods(s,r.item,2);
  assert(itemUse(r.item,s).ok);assert.equal(s.inventory[r.item],1);
  for(let n=0;n<10;n++)assert.equal(itemUse(r.item,s).unchanged,true);
  s=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(s.playerProfile.outfit,r.item);assert.equal(s.inventory[r.item],1);
  assert.equal(s.economy.playerGoods[r.item],1);assert(unequipOutfit(s).ok);
  assert.equal(s.inventory[r.item],2);assert.equal(s.economy.playerGoods[r.item],2);
  assert.equal(unequipOutfit(s).unchanged,true);assert.equal(s.inventory[r.item],2);validateState(s);
 }
});

test('switch is atomic, returns the former garment and its real production credit, and respects reservations',()=>{
 const s=fresh();s.inventory.outfit=1;s.inventory.c4_1=1;recordPlayerGoods(s,'outfit');
 assert(itemUse('outfit',s).ok);reserveResources(s,'task:fabric',{c4_1:1});
 assert.equal(itemUse('c4_1',s).ok,false);assert.equal(s.playerProfile.outfit,'outfit');assert.equal(s.inventory.outfit,0);
 assert.equal(itemUse('outfit',s,{action:'gift',npcId:0}).ok,false);
 delete s.resourceLedger.reservations['task:fabric'];
 assert(itemUse('c4_1',s).ok);assert.equal(s.inventory.outfit,1);assert.equal(s.economy.playerGoods.outfit,1);
 assert.equal(s.inventory.c4_1,0);assert.equal(s.playerProfile.outfit,'c4_1');
 assert(unequipOutfit(s).ok);assert.equal(s.inventory.c4_1,1);assert.equal(s.economy.playerGoods.c4_1||0,0);
});

test('legacy worn copy migrates exactly once and can be taken off, without inventing manual-production credit',()=>{
 let s=fresh();delete s.wardrobe;s.playerProfile.outfit='outfit';s.inventory.outfit=0;
 hydrateWardrobe(s);for(let i=0;i<3;i++)s=hydrateTown(JSON.parse(JSON.stringify(s)));
 assert.equal(s.inventory.outfit,0);assert(s.wardrobe.equipped.legacy);
 assert(unequipOutfit(s).ok);assert.equal(s.inventory.outfit,1);assert.equal(s.economy.playerGoods.outfit||0,0);
 s=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(unequipOutfit(s).unchanged,true);assert.equal(s.inventory.outfit,1);
});

test('malformed wardrobe cannot overwrite the server save',()=>{
 const s=fresh();s.wardrobe.equipped={item:'wood',personalCredit:true};
 assert.throws(()=>validateState(s),/服装/);
});
