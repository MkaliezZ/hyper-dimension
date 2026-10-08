import test from 'node:test';import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown,settleVisit,needs} from '../src/townSimulation.js';
import {ECONOMY_RULES,townDailyBudget,settleTownDay,tickTownEconomy,townOrders,recordPlayerGoods,deliverTownOrder,projectedDayAccounts,buySupplies,reserveParty,completeParty} from '../src/economy.js';
import {ALL_RECIPES,RECIPE_BY_ID,itemUse,commitRecipe,takeCraftNutrition} from '../src/contentCatalog.js';
import {itemPurpose} from '../src/itemPurpose.js';
const fresh=()=>hydrateTown(createState());
test('daily operating budget charges once, keeps working capital and never builds debt',()=>{
 const s=fresh();assert.equal(townDailyBudget(s).total,84);assert.equal(projectedDayAccounts(s).projectedNet,-84);
 assert.equal(settleTownDay(s).paid,84);assert.equal(s.coins,36);assert.equal(settleTownDay(s),false);
 s.day++;s.coins=24;const row=settleTownDay(s);assert.equal(row.paid,4);assert.equal(row.deferred,80);assert.equal(s.coins,20);
 s.day++;assert.equal(settleTownDay(s).paid,0);assert.equal(s.coins,20);assert.equal(s.economy.costs,88);
});
test('active day progress survives reload with no offline or duplicate charge',()=>{
 assert.equal(ECONOMY_RULES.daySeconds,900);let s=fresh();tickTownEconomy(s,100);s=hydrateTown(JSON.parse(JSON.stringify(s)));
 assert.equal(s.day,1);assert.equal(s.coins,120);assert.equal(s.economy.daySeconds,100);
 tickTownEconomy(s,799);assert.equal(s.day,1);assert.equal(s.coins,120);assert.equal(s.economy.townDays.length,0);
 s=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(s.economy.daySeconds,899);
 tickTownEconomy(s,1);assert.equal(s.day,2);assert.equal(s.coins,36);assert.equal(s.economy.townDays.length,1);
 s=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(s.day,2);assert.equal(s.coins,36);
});
test('automatic and purchased goods cannot fill personal orders; a real manual delivery pays once',()=>{
 let s=fresh();s.inventory.lantern=3;assert.equal(deliverTownOrder(s,1),false);
 recordPlayerGoods(s,'lantern');const before=s.coins,o=deliverTownOrder(s,1);assert.equal(o.net,10);assert.equal(s.coins,before+10);assert.equal(s.inventory.lantern,2);
 assert.equal(deliverTownOrder(s,1),false);s=hydrateTown(JSON.parse(JSON.stringify(s)));assert.equal(deliverTownOrder(s,1),false);
 assert.ok(buySupplies(s,'timber'));assert.equal(townOrders(s)[0].personal,0);assert.equal(deliverTownOrder(s,0),false);
});
test('real crafting consumes ingredient credits and cannot reuse the same output in gift and order',()=>{
 const s=fresh();Object.assign(s.inventory,RECIPE_BY_ID.recipe_lantern.cost);for(const [id,n]of Object.entries(RECIPE_BY_ID.recipe_lantern.cost))recordPlayerGoods(s,id,n);
 assert.ok(commitRecipe(RECIPE_BY_ID.recipe_lantern,s));recordPlayerGoods(s,'lantern');
 assert.equal(s.economy.playerGoods.wood,0);assert.ok(itemUse('lantern',s,{action:'gift',npcId:1}).ok);
 s.inventory.lantern++;assert.equal(deliverTownOrder(s,1),false);
 assert.ok(s.npcMemory[1].at(-1).text.includes('岛主'));assert.equal(s.npcAffinity[1],22);
});
test('sold-out experience venues collect genuine admission; shops cannot sell missing goods',()=>{
 const s=fresh(),g={name:'旅人',budget:24};const r=settleVisit(s,g,6,'admission',10);
 assert.equal(r.paid,4);assert.equal(r.net,2);assert.equal(s.economy.ledger.at(-1).item,null);assert.equal(s.economy.ledger.at(-1).service,'水族馆参观');
 assert.equal(settleVisit(s,g,3,'empty-shop',11).paid,0);assert.equal(s.inventory.bouquet,0);
});
test('tourists buy advanced building products at their real tier price and debit exactly one',()=>{
 const s=fresh(),g={name:'收藏旅人',budget:24};s.inventory.c6_8=1;recordPlayerGoods(s,'c6_8');
 const r=settleVisit(s,g,6,'advanced-sale',10);assert.equal(r.paid,20);assert.equal(r.cost,6);assert.equal(s.inventory.c6_8,0);assert.equal(s.economy.playerGoods.c6_8,0);assert.equal(s.economy.ledger.at(-1).item,'c6_8');
 assert.equal(settleVisit(s,g,6,'advanced-sale',11).paid,0);assert.equal(g.budget,4);
});
test('all 300 products expose actual purposes and can perform their primary use',()=>{
 for(const r of ALL_RECIPES){const s=fresh(),p=itemPurpose(r.item,s);assert.ok(p.primary.text.length>10,r.name);assert.ok(p.primary.action,r.name);
  for(const n of p.next)assert.ok(RECIPE_BY_ID['recipe_'+n.id].cost[r.item]);
  s.inventory[r.item]=1;assert.ok(itemUse(r.item,s).ok,r.name);
 }
});
test('meal use improves the next three crafts; food gifts feed a named resident',()=>{
 const s=fresh();s.inventory.tea=2;assert.ok(itemUse('tea',s).ok);assert.equal(s.playerVitals.craftMeals,3);
 for(let i=0;i<3;i++)assert.equal(takeCraftNutrition(s),.1);assert.equal(takeCraftNutrition(s),0);
 needs(0,s).hunger=10;assert.ok(itemUse('tea',s,{action:'gift',npcId:0}).ok);assert.equal(s.npcNeeds[0].hunger,30);
});
test('optional party goods are consumed, persisted and rewarded once with worn outfit',()=>{
 let s=fresh();Object.assign(s.inventory,{lantern:1,wheat:2,firework:1,outfit:1});assert.ok(itemUse('outfit',s).ok);
 const party=reserveParty(s,{fireworks:true});assert.ok(party);assert.equal(s.inventory.firework,0);assert.equal(party.outfit,'outfit');
 s=hydrateTown(JSON.parse(JSON.stringify(s)));s.playerProfile.outfit=null;
 assert.equal(completeParty(s,4),33);assert.equal(completeParty(s,4),0);assert.equal(s.coins,145);
});
test('component use exposes concrete next recipes; wardrobe and seeds retain different mechanics',()=>{
 const s=fresh(),p=itemPurpose('c0_7',s);assert.ok(p.next.some(n=>n.id==='c0_8'));
 s.inventory.c14_0=1;const seeds=s.inventory.seed;assert.ok(itemUse('c14_0',s).ok);assert.equal(s.inventory.seed,seeds+2);assert.equal(s.research[14],1);
});
