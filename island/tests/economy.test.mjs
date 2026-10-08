import test from 'node:test';import assert from 'node:assert/strict';
import {createState} from '../src/world.js';import {hydrateTown,settleVisit,commitWork} from '../src/townSimulation.js';
import {qualityCap,effectiveQuality,upgradeCost,upgradeFacility,maintainFacility,buySupplies,canHostParty,reserveParty,completeParty,dayAccounts,SUPPLY_PACKS} from '../src/economy.js';
import {DEFAULT_RECIPES,commitRecipe} from '../src/contentCatalog.js';
const fresh=()=>hydrateTown(createState());
test('visitor sale books gross, variable cost and net exactly once',()=>{
 const s=fresh(),g={name:'客人',budget:24};s.inventory.bouquet=1;const before=s.coins;
 const a=settleVisit(s,g,3,'receipt-1',10);assert.deepEqual([a.paid,a.cost,a.net],[5,2,3]);assert.equal(s.coins,before+3);
 assert.equal(s.economy.gross,5);assert.equal(s.economy.costs,2);assert.equal(s.inventory.bouquet,0);
 assert.equal(settleVisit(s,g,3,'receipt-1',20).paid,0);assert.equal(s.coins,before+3);
 assert.deepEqual(dayAccounts(s),{income:5,cost:2,net:3});
});
test('unaffordable expenses and missing supplies never partially debit',()=>{
 const s=fresh();s.inventory.wood=0;const before=structuredClone(s);
 assert.equal(upgradeFacility(s,0),false);assert.equal(s.coins,before.coins);assert.equal(s.inventory.stone,before.inventory.stone);
 s.coins=0;assert.equal(buySupplies(s,'seeds'),false);assert.equal(s.inventory.seed,before.inventory.seed);
});
test('four facility upgrades raise caps and grow investment costs',()=>{
 const s=fresh();s.coins=2000;s.inventory.wood=s.inventory.stone=40;const prices=[];
 for(let i=0;i<4;i++){prices.push(upgradeCost(s.facilities[0]).coins);assert.equal(upgradeFacility(s,0),true);assert.equal(qualityCap(s.facilities[0]),65+i*10);}
 assert.deepEqual(prices,[80,165,300,485]);assert.equal(upgradeFacility(s,0),false);assert.equal(s.economy.costs,1030);
 s.facilities[0].condition=50;const before=s.coins;assert.equal(maintainFacility(s,0),true);assert.equal(s.facilities[0].condition,100);assert.ok(s.coins<before);
});
test('local work cannot bypass quality cap or mint quality on missing inputs',()=>{
 const s=fresh(),f=s.facilities[0];f.quality=55;s.inventory.wood=s.inventory.ore=0;
 commitWork(1,{goal:'workshop',buildingId:0,action:'work'},s,1);assert.equal(f.quality,55);
 f.quality=45;Object.assign(s.inventory,DEFAULT_RECIPES[0].cost);commitWork(1,{goal:'workshop',buildingId:0,action:'work'},s,2);
 assert.equal(f.quality,45.1);assert.equal(s.inventory.lantern,1);
});
test('save migration preserves earned money, stored quality, inventory and party escrow',()=>{
 const s=fresh();s.coins=9876;s.facilities[0].quality=91;s.inventory.lantern=3;
 hydrateTown(s);assert.equal(s.coins,9876);assert.equal(s.facilities[0].quality,91);assert.equal(effectiveQuality(s.facilities[0]),55);
 assert.equal(s.inventory.lantern,3);assert.equal(upgradeFacility(s,0),true);assert.equal(s.facilities[0].quality,91);
});
test('party reserves materials once, survives reload, grants one daily reward',()=>{
 let s=fresh();s.inventory.lantern=1;s.inventory.wheat=2;const before=s.coins;
 assert.ok(reserveParty(s));assert.equal(s.coins,before-8);assert.equal(s.inventory.lantern,0);assert.equal(s.inventory.wheat,0);
 assert.equal(reserveParty(s),false);s=hydrateTown(JSON.parse(JSON.stringify(s)));
 assert.equal(completeParty(s,4),28);assert.equal(completeParty(s,4),0);assert.equal(s.coins,before+20);assert.equal(canHostParty(s),false);
 s.day++;s.inventory.lantern=1;s.inventory.wheat=2;assert.equal(canHostParty(s),true);
});
test('party insufficiency cannot create negative inventory or cash',()=>{
 const s=fresh();s.inventory.lantern=1;s.inventory.wheat=1;const before=s.coins;
 assert.equal(reserveParty(s),false);assert.equal(s.inventory.lantern,1);assert.equal(s.coins,before);assert.equal(completeParty(s,4),0);
});
test('purchased seeds and timber cannot generate instant cash resale arbitrage',()=>{
 const s=fresh();s.inventory.wood=s.inventory.ore=0;const before=s.coins;assert.equal(buySupplies(s,'timber'),true);
 // Three lanterns consume all six purchased timber; glass, candles and wicks must also be gathered.
 for(const [id,n]of Object.entries(DEFAULT_RECIPES[0].cost))if(id!=='wood')s.inventory[id]=n*3;for(let i=0;i<3;i++){assert.equal(commitRecipe(DEFAULT_RECIPES[0],s),true);settleVisit(s,{name:'测试',budget:24},0,'lantern-'+i,i);}
 assert.ok(s.coins<before);assert.equal(SUPPLY_PACKS[0].coins,18);
});
