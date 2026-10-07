import assert from 'node:assert/strict';
import {availableQuantity} from '../src/resourceLedger.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {createState,RESIDENTS,SLOTS,setWorldTheme} from '../src/world.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {tickCrops} from '../src/farming.js';
import {followPath} from '../src/movement.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {tickTownEconomy,recordPlayerGoods,townOrders,deliverTownOrder,ECONOMY_RULES} from '../src/economy.js';
import {ITEM_BY_ID,RECIPE_BY_ID,commitRecipe,resourceLoot} from '../src/contentCatalog.js';

globalThis.fetch=async()=>new Response('{"error":"isolated economy simulation"}',{status:503});
const reportDirectory=process.env.HD_ECON_QA_DIR||'qa/economy-current';await mkdir(reportDirectory,{recursive:true});
const reports=[],simulationDays=30,stepSeconds=.2,failures=[];
for(const theme of ['pixel','origami'])for(const mode of ['passive','active','upgraded-passive','upgraded-active','zero-passive','zero-active']){
 setWorldTheme(theme);const s=hydrateTown(mode.startsWith('zero')?createZeroState():createState());
 if(mode.startsWith('zero'))s.freshStartPending=false;
 const npcs=RESIDENTS.map((r,npcId)=>({npcId,x:780,y:465,face:1,phase:0,path:[],walkMix:0}));
 if(mode.startsWith('upgraded')){s.coins=3000;for(const f of Object.values(s.facilities)){f.quality=95;f.upgrades=4;}}
 const initial=s.coins,runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
 const visitors=createVisitorRuntime({getState:()=>s,followPath,onChange:()=>{},onEvent:()=>{}});visitors.setEntries(id=>SLOTS[id].entry);
 let playerDay=0,orders=0,gatherActions=0,craftActions=0;
 for(let step=1;step<=simulationDays*ECONOMY_RULES.daySeconds/stepSeconds;step++){
  const t=step*stepSeconds;
  runtime.update(stepSeconds,t);visitors.update(stepSeconds,t);tickCrops(s,stepSeconds);
  if(mode.endsWith('active')&&!mode.endsWith('passive')&&s.economy.daySeconds>=30&&playerDay!==s.day){
   const order=townOrders(s)[1],recipe=RECIPE_BY_ID['recipe_'+order.item];
   function prepare(item,count,path=[]){
    assert(!path.includes(item)&&path.length<=8,'synthetic player chain must be acyclic');
    const missing=Math.max(0,count-availableQuantity(s,item));if(!missing)return;
    const info=ITEM_BY_ID[item],component=RECIPE_BY_ID[info.recipeId];
    if(component){
     for(let q=0;q<missing;q++){for(const [input,n] of Object.entries(component.cost))prepare(input,n,[...path,item]);assert.equal(commitRecipe(component,s),true,component.name);recordPlayerGoods(s,item,1);craftActions++;}
    }else{const got=resourceLoot(info.source,s,missing,item);assert.equal(got[0]?.amount,missing);recordPlayerGoods(s,item,missing);gatherActions++;}
   }
   for(const [item,count] of Object.entries(recipe.cost))prepare(item,count);
   assert.equal(commitRecipe(recipe,s),true);recordPlayerGoods(s,recipe.item,1);craftActions++;
   assert.ok(deliverTownOrder(s,order.slot));orders++;playerDay=s.day;
  }
  for(const node of s.oreNodes)if(node.hp===0&&(node.regen-=stepSeconds)<=0)node.hp=3;
  tickTownEconomy(s,stepSeconds);
  if(step%20===0)await new Promise(r=>setImmediate(r));
 }
 const daily=s.economy.townDays,stable=daily.slice(5),mean=key=>stable.reduce((n,d)=>n+d[key],0)/stable.length;
 const active=mode.endsWith('active')&&!mode.endsWith('passive');
 const report={theme,mode,days:daily.length,daySeconds:ECONOMY_RULES.daySeconds,initial,coins:s.coins,
  dailyIncome:mean('income'),dailyPaidCost:mean('cost'),dailyCashNet:mean('net'),dailyOperatingNet:mean('operatingNet'),
  dailyRelief:mean('deferred'),orders,gatherActions,craftActions,contentVersion:s.contentVersion,daily,
  source:'Real NPC movement, farming, visitor transactions and time progression; synthetic player gathering/crafting/order inputs; model calls blocked. This is not human or live AI acceptance.'};
 const nominalCost=mean('cost')+mean('deferred');report.incomeToFullCost=report.dailyIncome/nominalCost;
 try{
  assert.equal(daily.length,30);assert.equal(s.coins,initial+daily.reduce((n,d)=>n+d.net,0));
  assert.ok(Object.values(s.inventory).every(n=>n>=0));assert.ok(s.coins>=0);
  assert.ok(daily.every(d=>d.paid<=d.budget&&d.deferred>=0));
  if(active){assert.equal(orders,30);assert.ok(report.dailyOperatingNet>2&&report.dailyOperatingNet<15,'one real daily commission must produce a modest surplus');}
  else {assert.equal(orders,0);assert.ok(report.dailyOperatingNet<0&&report.dailyOperatingNet>=-10,'passive operating deficit must remain small');assert.ok(report.incomeToFullCost>=.9&&report.incomeToFullCost<1,'passive income must cover 90–100% of full operating costs');}
 }catch(e){failures.push({theme,mode,message:e.message});}
 reports.push(report);console.log(JSON.stringify({...report,daily:undefined}));
 runtime.reset();visitors.reset();
}
await writeFile(reportDirectory+'/economy-900s.json',JSON.stringify({reports,failures,passed:!failures.length},null,2));
assert.deepEqual(failures,[]);
