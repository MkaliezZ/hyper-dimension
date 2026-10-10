import {functionalDefinition} from './facilityCatalog.js';
import {availableQuantity,canSpendResources,commitResources,nextOperationId} from './resourceLedger.js';
import {RAW_ROWS,PRODUCT_ROWS} from './catalog-data.js';
import {hydrateWardrobe,equipOutfit,equipTool} from './equipmentRules.js';
export {validWardrobe,hydrateWardrobe,equipOutfit,unequipOutfit} from './equipmentRules.js';
import {connectWorkshops,checkWorkshopGraph,PRODUCTION_VERSION} from './productionNetwork.js';
export const RAW_MATERIALS=RAW_ROWS.map(([id,name,art,source],index)=>({id,name,art,source,index,category:'material'}));
const categories=['decor','food','food','decor','wear','study','decor','study','decor','gift','food','gift','decor','study','seedling','decor','tool','food','collection','decor','decor','decor','decor','decor','study'];
const legacy={0:'lantern',1:'tea',2:'meal',3:'bouquet',4:'outfit',10:'remedy',15:'pottery',16:'rod',17:'bread',20:'firework',24:'painting'};
const tools={1:'hoe',2:'pickaxe',3:'watering_can',4:'axe',5:'sickle'};
export const ALL_RECIPES=connectWorkshops(PRODUCT_ROWS.flatMap((rows,building)=>rows.map((row,index)=>{
 const tier=Math.floor(index/4),[name,art]=row.split('|'),id=building===0&&tools[index]?tools[index]:index===0&&legacy[building]?legacy[building]:`c${building}_${index}`;
 let category=building===0&&tools[index]?'tool':categories[building];
 if(building===16&&index>0)category=index===4?'component':index===9?'tool':'decor';
 if(building===0&&index===7)category='component';
 if(building===1&&index>=9)category=index===10?'gift':'decor';
 if(building===10&&index>0)category=index===11?'study':index===10||index===9?'gift':'decor';
 if(building===11&&[5,6].includes(index))category=index===5?'study':'decor';
 return {id:'recipe_'+id,item:id,name,art,building,index,tier,category,price:6+tier*7+index%4};
})));
export const PRODUCTION_GRAPH=checkWorkshopGraph(ALL_RECIPES,RAW_MATERIALS);
export const RECIPE_BY_ID=Object.fromEntries(ALL_RECIPES.map(r=>[r.id,r]));
export const ITEM_BY_ID=Object.fromEntries([...RAW_MATERIALS,...ALL_RECIPES.map((r,index)=>({...r,id:r.item,index,recipeId:r.id,source:'recipe'}))].map(i=>[i.id,i]));
export const CATALOG_ITEMS=Object.values(ITEM_BY_ID);
export const DEFAULT_RECIPES=Object.fromEntries(ALL_RECIPES.filter(r=>r.index===0).map(r=>[r.building,r]));
export const STARTER_TOOLS=['hoe','pickaxe','watering_can','axe','sickle','rod'];
export function hydrateContent(s){s.contentVersion=9;s.productionVersion=PRODUCTION_VERSION;s.craftHistory??={};s.roomGames??={};s.discovered??={};s.placedItems??=[];s.craftSelection??={};s.toolbelt??={hoe:'hoe',pickaxe:'pickaxe',water:'watering_can',axe:'axe',harvest:'sickle',fish:'rod'};s.playerProfile={name:'岛主',islandName:'晨光岛',bio:'在晨光岛收集故事，与居民一起经营生活。',birthday:'',pronouns:'',avatar:'male_0',research:0,...s.playerProfile};s.butlerAvatar??='default';hydrateWardrobe(s);if(!s.starterToolsGranted){for(const id of STARTER_TOOLS)s.inventory[id]=(s.inventory[id]||0)+1;s.starterToolsGranted=true}for(const i of CATALOG_ITEMS){s.inventory[i.id]??=0;if(s.inventory[i.id]>0)s.discovered[i.id]=true}return s}
export function recipeGate(r,s){if(s.buildings[r.building]===undefined)return {ready:false,text:'先开放对应建筑'};const plays=s.roomGames?.[r.building]?.plays||0,count=ALL_RECIPES.filter(x=>x.building===r.building).reduce((sum,x)=>sum+(s.craftHistory?.[x.id]||0),0),level=Math.max(plays,count)+(s.research?.[r.building]||0),quality=s.facilities?.[r.building]?.quality||45;const need=r.tier===2?5:r.tier===1?2:0,q=r.tier===2?60:r.tier===1?50:0;return {ready:level>=need&&quality>=q,text:r.tier===0?'基础图纸已开放':`本馆熟练度 ${level}/${need} · 设施品质 ${Math.floor(quality)}/${q}`}}
export function canCraft(r,s,{owner=null}={}){return recipeGate(r,s).ready&&canSpendResources(s,r.cost,owner)}
export function commitRecipe(r,s,{owner=null,commandId=null}={}){if(!canCraft(r,s,{owner}))return false;const result=commitResources(s,{id:commandId,owner,cost:r.cost,gain:{[r.item]:1},category:'craft',note:r.name});if(!result.ok||result.replayed)return false;s.craftHistory[r.id]=(s.craftHistory[r.id]||0)+1;return true}
export function resourceLoot(source,s,amount=1,primary=null){const pool=RAW_MATERIALS.filter(i=>i.source===source);s.gatherCounts??={};const serial=s.gatherCounts[source]||0;const chosen=primary?ITEM_BY_ID[primary]:pool[serial%pool.length];if(!chosen||chosen.source!==source||chosen.category!=='material')return [];s.gatherCounts[source]=serial+1;s.inventory[chosen.id]=(s.inventory[chosen.id]||0)+amount;s.discovered[chosen.id]=true;return [{id:chosen.id,amount}]}
export function consumePlayerCredit(s,id,amount=1){const credits=s.economy?.playerGoods;if(!credits)return false;const used=Math.min(credits[id]||0,amount);credits[id]=Math.max(0,(credits[id]||0)-amount);return used>0}

const GIFT_PREFERENCES=['seedling','tool','decor','study','decor','tool','food','decor','tool','food','study','tool','decor','wear','collection','study'];
export function giftPreview(id,s,npcId=0){
 const item=ITEM_BY_ID[id];if(!item)return {gain:0,text:'未知礼物'};
 const today=(s.giftLog||[]).filter(g=>g.npcId===npcId&&g.day===s.day),repeat=today.filter(g=>g.item===id).length;
 const used=today.reduce((n,g)=>n+(g.affinity??2+(ITEM_BY_ID[g.item]?.tier||0)),0),liked=item.category===GIFT_PREFERENCES[npcId];
 const base=2+(item.tier||0)+(liked?1:0),gain=Math.max(0,Math.min(100-(s.npcAffinity?.[npcId]??20),8-used,repeat===0?base:repeat===1?Math.max(1,Math.floor(base/2)):0));
 return {gain,liked,repeat,text:gain>0?(liked?'符合对方喜好 · ':'')+'本次好感 +'+gain+(repeat?' · 同礼物收益递减':''):repeat>=2?'今天已经送过两次同款礼物，明天再送吧。':'今天的赠礼好感已足够，礼物会留在背包。'};
}
export function giftItem(id,s,npcId=0){
 const item=ITEM_BY_ID[id];if(!item||availableQuantity(s,id)<1||!Number.isInteger(npcId)||npcId<0||npcId>15)return {ok:false,text:'物品或收礼居民无效'};
 const current=s.npcAffinity?.[npcId]??20;if(current>=100)return {ok:false,text:'好感已满，礼物仍留在背包'};
 const preview=giftPreview(id,s,npcId);if(!preview.gain)return {ok:false,text:preview.text};
 if(!commitResources(s,{cost:{[id]:1},category:'gift',note:'居民 '+npcId}).ok)return {ok:false,text:'物品已预留给其他任务'};
 s.npcAffinity??={};s.npcAffinity[npcId]=Math.min(100,current+preview.gain);
 s.giftLog??=[];s.giftLog.push({item:id,npcId,day:s.day,affinity:preview.gain});s.giftLog=s.giftLog.filter(g=>g.day>=s.day-2);
 s.npcMemory??={};s.npcMemory[npcId]??=[];s.npcMemory[npcId].push({day:s.day,text:'岛主送给我'+item.name+'，我记下了这次心意。'});s.npcMemory[npcId]=s.npcMemory[npcId].slice(-16);
 if(item.category==='food'&&s.npcNeeds?.[npcId]){s.npcNeeds[npcId].hunger=Math.min(100,s.npcNeeds[npcId].hunger+20+(item.tier||0)*7);s.npcNeeds[npcId].energy=Math.min(100,s.npcNeeds[npcId].energy+10);}
 return {ok:true,text:'已赠送'+item.name+'，好感 +'+preview.gain+(preview.liked?'，正合对方喜好':'')};
}
export function takeCraftNutrition(s){
 const v=s.playerVitals;if(!(v?.craftMeals>0))return 0;v.craftMeals--;return v.craftMealBonus||.1;
}
export function itemUse(id,s,{npcId=0,action='use'}={}){
 const item=ITEM_BY_ID[id];if(item?.category==='wear'&&action!=='gift')return equipOutfit(id,s);if(!item||availableQuantity(s,id)<1)return {ok:false,text:'可用物品不足，部分库存可能已预留'};
 if(action==='gift'||item.category==='gift')return giftItem(id,s,npcId);
 if(id==='c14_8')return {ok:true,route:'farmCare',text:'肥料保留在背包，请选择已播种的田垄施肥'};
 if(id==='c16_4')return {ok:true,route:'fishing',text:'海虾鱼饵留在背包，开场时使用；已打开钓鱼派对手账'};
 if(item.category==='material')return {ok:false,text:'基础素材用于制作，选择配方查看需求'};
 if(item.category==='tool')return equipTool(id,s);
 if(functionalDefinition(id)||['decor','collection','component'].includes(item.category))return {ok:true,route:'placement',text:'选择位置并确认后再从背包取用'+item.name};
 const personalCredit=(s.economy?.playerGoods?.[id]||0)>0;if(!commitResources(s,{cost:{[id]:1},category:'item_use',note:item.name}).ok)return {ok:false,text:'可用物品不足'};
 if(item.category==='food'){s.playerVitals??={energy:70,hunger:70};const v=s.playerVitals;v.energy=Math.min(100,v.energy+10+item.tier*5);v.hunger=Math.min(100,v.hunger+20+item.tier*7);v.craftMeals=3;v.craftMealBonus=.1+item.tier*.1;return {ok:true,text:'享用'+item.name+'，补充体力与饱足，接下来三次手作品质额外提升'}}
 if(item.category==='study'||item.category==='seedling'){s.research??={};s.research[item.building]=(s.research[item.building]||0)+1;if(item.category==='seedling')s.inventory.seed+=2;return {ok:true,text:'研究完成，'+(item.category==='seedling'?'获得种子 ×2，':'')+'本馆熟练度 +1'}}
 return {ok:false,text:'暂未配置该物品的直接使用方式'};
}
