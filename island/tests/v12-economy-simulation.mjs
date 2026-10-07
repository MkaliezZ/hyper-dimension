import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createState,RESIDENTS,SLOTS,setWorldTheme} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {tickCrops} from '../src/farming.js';
import {followPath} from '../src/movement.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {tickTownEconomy,recordPlayerGoods,townOrders,deliverTownOrder,ECONOMY_RULES} from '../src/economy.js';
import {ITEM_BY_ID,RECIPE_BY_ID,commitRecipe,resourceLoot} from '../src/contentCatalog.js';
globalThis.fetch=async()=>new Response('{"error":"isolated economy simulation"}',{status:503});
const reports=[],simulationDays=30,stepSeconds=.2,duration=simulationDays*ECONOMY_RULES.daySeconds;
for(const theme of ['pixel','origami'])for(const mode of ['passive','active','upgraded']){
 setWorldTheme(theme);const s=hydrateTown(createState()),npcs=RESIDENTS.map((r,npcId)=>({npcId,x:780,y:465,face:1,phase:0,path:[],walkMix:0}));
 if(mode==='upgraded'){s.coins=3000;for(const f of Object.values(s.facilities)){f.quality=95;f.upgrades=4;}}
 const initial=s.coins,runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
 const visitors=createVisitorRuntime({getState:()=>s,followPath,onChange:()=>{},onEvent:()=>{}});visitors.setEntries(id=>SLOTS[id].entry);
 let playerDay=0,orders=0,gatherActions=0;
 for(let step=1;step<=Math.round(duration/stepSeconds);step++){
  const t=step*.2;
  runtime.update(.2,t);visitors.update(.2,t);tickCrops(s,.2);
  if(mode==='active'&&s.economy.daySeconds>=30&&playerDay!==s.day){
   const order=townOrders(s)[1],recipe=RECIPE_BY_ID['recipe_'+order.item];
   // One daily manual commission: source real materials, craft and deliver one stock unit.
   for(const [item,count] of Object.entries(recipe.cost)){
    const info=ITEM_BY_ID[item];resourceLoot(info.source,s,count,item);recordPlayerGoods(s,item,count);gatherActions++;
   }
   assert.equal(commitRecipe(recipe,s),true);recordPlayerGoods(s,recipe.item,1);
   assert.ok(deliverTownOrder(s,order.slot));orders++;playerDay=s.day;
  }
  for(const node of s.oreNodes)if(node.hp===0&&(node.regen-=.2)<=0)node.hp=3;
  tickTownEconomy(s,.2);
  if(step%20===0)await new Promise(r=>setImmediate(r));
 }
 const days=s.economy.townDays,stable=days.slice(5),income=stable.reduce((v,d)=>v+d.income,0),cost=stable.reduce((v,d)=>v+d.cost,0);
 const minEndingHunger=Math.min(...Object.values(s.npcNeeds).map(n=>n.hunger)),minEndingEnergy=Math.min(...Object.values(s.npcNeeds).map(n=>n.energy));
 const r={minEndingHunger,minEndingEnergy,theme,mode,seconds:duration,daySeconds:ECONOMY_RULES.daySeconds,days:days.length,coins:s.coins,initial,stableDays:stable.length,dailyIncome:income/stable.length,dailyCost:cost/stable.length,dailyNet:(income-cost)/stable.length,incomeToCost:income/cost,orderCount:orders,manualGatherTransactions:gatherActions,townDailyBudget:days.at(-1).budget,source:'actual NPC/path/visitor simulation plus real gathering/crafting/order transactions; no external model calls',daily:days};
 assert.ok(Object.values(s.inventory).every(v=>v>=0));assert.ok(minEndingHunger>0&&minEndingEnergy>0,JSON.stringify(r));assert.ok(s.coins>=ECONOMY_RULES.cashReserve);
 assert.equal(days.length,simulationDays);assert.equal(s.coins,initial+days.reduce((v,d)=>v+d.net,0));
 if(mode==='active'){assert.ok(r.dailyNet>3,JSON.stringify(r));assert.equal(orders,simulationDays);}
 else {assert.ok(r.dailyIncome>0&&r.dailyCost>0,JSON.stringify(r));}
 reports.push(r);console.log(JSON.stringify({...r,daily:undefined}));runtime.reset();visitors.reset();
}
await writeFile('qa/v14-economy-after.json',JSON.stringify(reports,null,2));
