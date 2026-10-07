import {specializationDelivery,recordSpecializationDelivery} from './specialization.js';
import {relationshipInvitation} from './residentStories.js';
import {availableQuantity,canSpendResources,commitResources} from './resourceLedger.js';
import {ITEM_BY_ID} from './contentCatalog.js';
// Game currency policy shared by browser and deterministic simulations.
export const ECONOMY_POLICY_VERSION=105;
export const ECONOMY_RULES={ferryInterval:90,guestsPerBoat:2,maxGuests:6,serviceSeconds:12,partyFee:8,partyReward:20,partyPerfectBonus:2,daySeconds:900,cashReserve:20};
export const SUPPLY_PACKS=[
 {id:'seeds',name:'播种补给',coins:18,items:{seed:5}},
 {id:'timber',name:'木石补给',coins:42,items:{wood:8,stone:4}},
 {id:'metal',name:'工具矿材',coins:56,items:{ore:4,iron:2,copper:2}},
 {id:'fabric',name:'纺织补给',coins:38,items:{cotton:4,flax:3,fiber:4}}
];
export function hydrateEconomy(s){
 s.economy??={};const e=s.economy;e.costs??=0;e.cashLedger??=[];e.cashReceipts??={};
 if(e.budgetPolicyVersion!==ECONOMY_POLICY_VERSION){const current=s.day<(e.budgetPolicyStartsDay||0)?e.budgetPreviousVersion:e.budgetPolicyVersion,previous=[12,26,32].includes(current)?current:12;e.budgetPreviousVersion=previous;e.budgetPolicyStartsDay=(Number.isFinite(e.daySeconds)&&e.daySeconds>0?(s.day||1)+1:s.day||1);e.budgetPolicyVersion=ECONOMY_POLICY_VERSION;}
 e.accountingStartedDay??=s.day||1;e.townBudgetStartedDay??=s.day||1;e.daySeconds??=0;e.townDays??=[];e.playerGoods??={};e.orderIncome??=0;
 for(const f of Object.values(s.facilities||{})){f.condition??=100;f.operatingCosts??=0;f.upgrades=Math.max(0,Math.min(4,Math.floor(f.upgrades||0)));}
 return e;
}
export function qualityCap(f){return 55+Math.min(4,Math.max(0,f?.upgrades||0))*10}
export function effectiveQuality(f){return Math.min(f?.quality||0,qualityCap(f))*(.7+.3*Math.max(0,Math.min(100,f?.condition??100))/100)}
export function improveQuality(f,amount){if(f.quality<qualityCap(f))f.quality=Math.min(qualityCap(f),Math.max(0,f.quality)+amount)}
export function upgradeCost(f){const u=f.upgrades||0;return {coins:80+60*u+25*u*u,wood:3+u,stone:2+u}}
export function maintenanceCost(f){return {coins:12+Math.ceil(Math.max(0,100-(f.condition??100))*.3),wood:1,stone:1}}
export function canPay(s,cost,owner=null){return canSpendResources(s,cost,owner)}
export function transact(s,{income=0,cost=0,category,note='',receipt,materials={},owner=null}){
 const e=hydrateEconomy(s);if(!Number.isInteger(income)||!Number.isInteger(cost)||income<0||cost<0||s.coins+income<cost||receipt&&e.cashReceipts[receipt])return false;
 const exchange=commitResources(s,{id:receipt?'cash:'+receipt:null,owner,cost:{...materials,coins:cost},gain:{coins:income},category,note});if(!exchange.ok||exchange.replayed)return false;
 e.costs+=cost;if(receipt)e.cashReceipts[receipt]=true;
 e.cashLedger.push({day:s.day,category,note,income,cost,net:income-cost});e.cashLedger=e.cashLedger.slice(-300);
 return true;
}
export function payMaterials(s,cost,category,note){
 if(!canPay(s,cost))return false;
 return transact(s,{cost:cost.coins||0,materials:Object.fromEntries(Object.entries(cost).filter(([id])=>id!=='coins')),category,note});
}
export function upgradeFacility(s,id){
 const f=s.facilities[id];if(!f||f.upgrades>=4)return false;const cost=upgradeCost(f);
 if(!payMaterials(s,cost,'upgrade','设施 '+id+' 改善'))return false;
 f.upgrades++;f.quality=Math.max(f.quality,Math.min(qualityCap(f),f.quality+10));f.condition=Math.min(100,f.condition+20);return true;
}
export function maintainFacility(s,id){
 const f=s.facilities[id];if(!f||f.condition>=100||!payMaterials(s,maintenanceCost(f),'maintenance','设施 '+id+' 维护'))return false;
 f.condition=100;return true;
}
export function buySupplies(s,id){
 const pack=SUPPLY_PACKS.find(p=>p.id===id);if(!pack||!payMaterials(s,{coins:pack.coins},'supplies',pack.name))return false;
 for(const [key,n] of Object.entries(pack.items)){s.inventory[key]=(s.inventory[key]||0)+n;s.discovered[key]=true;}return true;
}
export function visitorPrice(item,recipe=null){return recipe?.index>0?recipe.price:({outfit:9,painting:8,meal:6,bouquet:5,rod:6}[item]||4)}
export function operatingCost(price){return Math.max(1,Math.ceil(price*.3))}
export function dayAccounts(s){const rows=(s.economy?.cashLedger||[]).filter(r=>r.day===s.day);return rows.reduce((a,r)=>({income:a.income+r.income,cost:a.cost+r.cost,net:a.net+r.net}),{income:0,cost:0,net:0})}
export function partyCost({fireworks=false}={}){return {coins:ECONOMY_RULES.partyFee,lantern:1,wheat:2,...(fireworks?{firework:1}:{})}}
export function canHostParty(s,extras={}){return [0,2].every(id=>relationshipInvitation(s,id,[0,2]).ready)&&!s.partySession&&!['checkin','running'].includes(s.fishingParty?.session?.phase)&&s.lastPartyDay!==s.day&&canPay(s,partyCost(extras))}
export function reserveParty(s,extras={}){
 const eventId='party-'+s.day+'-'+(s.activities||0),cost=partyCost(extras);
 if(!canHostParty(s,extras))return false;
 const paid=extras.authoritativeEntry?transact(s,{cost:cost.coins,materials:Object.fromEntries(Object.entries(cost).filter(([id])=>id!=='coins')),category:'party',receipt:eventId+':entry',note:'星灯夜集场地与布置'}):payMaterials(s,cost,'party','星灯夜集场地与布置');if(!paid)return false;
 s.partySession={id:'party-'+s.day+'-'+(s.activities||0),round:0,score:0,phase:0,day:s.day,fireworks:!!extras.fireworks,outfit:ITEM_BY_ID[s.playerProfile?.outfit]?.category==='wear'?s.playerProfile.outfit:null};s.lastPartyDay=s.day;return s.partySession;
}
export function completeParty(s,score){
 const p=s.partySession;if(!p)return 0;const reward=ECONOMY_RULES.partyReward+Math.min(4,Math.max(0,Math.floor(score)))*ECONOMY_RULES.partyPerfectBonus+(p.outfit?2:0)+(p.fireworks?3:0);
 if(!transact(s,{income:reward,category:'party',note:'星灯夜集结算',receipt:p.id}))return 0;
 s.partySession=null;return reward;
}


// Visitor experiences remain playable even when the gift-shop product is sold out.
export const VENUE_SERVICES={
 5:'观星体验',6:'水族馆参观',7:'图书阅读',8:'航标导览',11:'海岛通信展',
 12:'音乐欣赏',13:'摄影展览',14:'植物参观',18:'藏品参观',21:'舞台观演',22:'营地游憩'
};
export function venueService(id,quality){
 return VENUE_SERVICES[id]&&quality>=25?{name:VENUE_SERVICES[id],price:4+Math.floor(Math.max(0,quality-45)/25)}:null;
}


export function townDailyBudget(s){
 const ids=Object.values(s.buildings||{}).filter(id=>s.facilities[id]),upscale=ids.reduce((v,id)=>v+Math.max(0,(venueService(id,effectiveQuality(s.facilities[id]))?.price||4)-4),0);
 const policyVersion=s.day<(s.economy?.budgetPolicyStartsDay||0)?(s.economy?.budgetPreviousVersion||12):(s.economy?.budgetPolicyVersion||105),legacy=policyVersion===12;
 // Fixed 15-minute operating costs. Player orders and party income never increase this bill.
 const rows=[{name:'公共水电',coins:legacy?3:14},{name:'居民公共补给',coins:legacy?3:14},{name:'码头清洁与航务',coins:legacy?3:14},{name:'开放设施管理',coins:Math.ceil(ids.length*(legacy?.36:policyVersion===105?1.68:1.52))},{name:'优质体验设施养护',coins:Math.ceil(upscale*(legacy?.6:policyVersion===26?3:3.12))}];
 return {rows,total:rows.reduce((v,r)=>v+r.coins,0),policyVersion,startsDay:s.economy?.budgetPolicyStartsDay||s.day};
}
export function projectedDayAccounts(s){
 const actual=dayAccounts(s),due=s.economy?.cashReceipts?.['town-day-'+s.day]?0:townDailyBudget(s).total;
 return {...actual,due,projectedNet:actual.net-due};
}
export function settleTownDay(s){
 const e=hydrateEconomy(s),receipt='town-day-'+s.day;if(e.cashReceipts[receipt])return false;
 const budget=townDailyBudget(s),visitorRows=e.cashLedger.filter(r=>r.day===s.day&&r.category==='visitor');
 const cost=Math.min(budget.total,Math.max(0,availableQuantity(s,'coins')-ECONOMY_RULES.cashReserve));
 if(!transact(s,{cost,category:'town',note:'每日岛务：水电、公共补给、航务与设施管理'+(cost<budget.total?'（精简运营）':''),receipt}))return false;
 const accounts=dayAccounts(s),row={day:s.day,budget:budget.total,paid:cost,deferred:budget.total-cost,visitorIncome:visitorRows.reduce((v,r)=>v+r.income,0),visitorCost:visitorRows.reduce((v,r)=>v+r.cost,0),income:accounts.income,cost:accounts.cost,net:accounts.net,operatingNet:accounts.net-(budget.total-cost),policyVersion:budget.policyVersion};
 e.townDays.push(row);e.townDays=e.townDays.slice(-60);return row;
}
export function tickTownEconomy(s,dt){
 const e=hydrateEconomy(s),closed=[];if(!Number.isFinite(dt)||dt<=0)return closed;
 e.daySeconds+=dt;
 while(e.daySeconds+1e-7>=ECONOMY_RULES.daySeconds){e.daySeconds=Math.max(0,e.daySeconds-ECONOMY_RULES.daySeconds);const row=settleTownDay(s);if(row)closed.push(row);s.day++;}
 return closed;
}
const ORDER_MATERIALS=['wood','stone','ore','herb','fish','wheat','bamboo'];
const ORDER_CRAFTS=['lantern','pottery','painting','outfit','firework','c5_0','c18_0','c8_0','c21_0'];
const ORDER_PRODUCE=['bouquet','bread','meal','tea','remedy'];
export function recordPlayerGoods(s,item,quantity=1){
 if(!Number.isInteger(quantity)||quantity<1||!Object.hasOwn(s.inventory,item))return false;
 const e=hydrateEconomy(s);e.playerGoods[item]=(e.playerGoods[item]||0)+quantity;return true;
}
export function townOrders(s){
 const e=hydrateEconomy(s),index=Math.max(0,(s.day||1)-1);
 return [{item:ORDER_MATERIALS[index%ORDER_MATERIALS.length],quantity:3,reward:9,type:'采集委托'},
 {item:ORDER_CRAFTS[index%ORDER_CRAFTS.length],quantity:1,reward:15,type:'手作委托'},
 {item:ORDER_PRODUCE[index%ORDER_PRODUCE.length],quantity:1,reward:12,type:'生活委托'}].map((o,slot)=>{
  const cost=operatingCost(o.reward),receipt='town-order-'+s.day+'-'+slot;
  return {...o,slot,cost,net:o.reward-cost,receipt,done:!!e.cashReceipts[receipt],personal:Math.min(availableQuantity(s,o.item),e.playerGoods[o.item]||0)};
 });
}
export function deliverSpecializationOrder(s){
 const ready=specializationDelivery(s);if(!ready.ok)return ready;
 const c=ready.commission;
 if(!transact(s,{income:c.reward,cost:c.cost,materials:{[c.item]:1},category:'career_order',receipt:c.id,note:'专精委托 · '+c.item+' ×1'}))return {ok:false,reason:'交付条件已有变化，请查看最新库存。'};
 const result=recordSpecializationDelivery(s);if(!result)throw Error('专精交付回执未匹配');
 s.economy.orderIncome+=c.reward;return {ok:true,commission:c};
}
export function deliverTownOrder(s,slot){
 const o=townOrders(s).find(o=>o.slot===slot);
 if(!o||o.done||o.personal<o.quantity||!transact(s,{income:o.reward,cost:o.cost,category:'order',note:o.type+' · '+o.item+' ×'+o.quantity,receipt:o.receipt,materials:{[o.item]:o.quantity}}))return false;
 s.economy.orderIncome+=o.reward;return o;
}
