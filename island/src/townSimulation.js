import {chooseResidentCooperation,activityCooperationNeeds} from './residentCooperation.js';
import {teaFacilityOptions,functionalCommand} from './functionalFacilities.js';
import {hydrateResidentStories,residentStoryOptions,pendingResidentStory,STORY_LIMITS} from './residentStories.js';
import {availableQuantity,commitResources} from './resourceLedger.js';
import {hydrateEconomy,effectiveQuality,improveQuality,visitorPrice,operatingCost,transact,venueService} from './economy.js';
import {hydrateContent,ALL_RECIPES,RECIPE_BY_ID,DEFAULT_RECIPES,ITEM_BY_ID,recipeGate,resourceLoot,commitRecipe,consumePlayerCredit} from './contentCatalog.js';
import {hydrateCrops,harvestPlot,cropInfo} from './farming.js';
import {BUILDINGS,SLOTS,ITEMS,HARBOR} from './world.js';
import {ROOMS} from './rooms.js';
export const CAREERS=[
 ['农田照料与种苗培育',['farm',14,9]],['原料采购与木作制作',['mine',0,1]],['活动筹备与招待',[21,12,9]],['星空记录与知识整理',[7,5,22]],['植物采集与花艺',[14,3,9]],['船体维护与航标巡查',['forest',23,8]],['食材采购与烘焙',['farm',17,2]],['拍摄与展陈',[13,'plaza',18]],['捕鱼、整备渔具与售卖',['dock',16,9]],['药草采集与居民照护',[14,10,19]],['整理书籍与通信',[7,11,19]],['开采与工具检修',['mine',0,2]],['创作、排练与演出',[12,21,1]],['设计、共创与服装陈列',[4,24,9]],['藏品研究与布展',[18,7,6]],['岛屿调度与港口巡视',[11,23,'dock']],['临时筹备与手作协助',['forest','mine',0,19]]
].map(([title,route])=>({title,route}));
export const RECIPES=DEFAULT_RECIPES;
const TITLES={farm:'照料作物',mine:'开采矿脉',forest:'采集木材',dock:'捕鱼与查看泊位',plaza:'观察广场与游客'};
export function hydrateTown(s){s.facilities??={};for(const b of BUILDINGS){s.facilities[b.id]={quality:45,revenue:0,visits:0,upgrades:0,lastWork:null,...s.facilities[b.id]};s.buildings[b.id]=b.id}for(const id of Object.keys(ITEMS))s.inventory[id]??=0;hydrateCrops(s);hydrateContent(s);s.npcCareers??={};s.npcNeeds??={};s.npcRelations??={};s.npcMemory??={};s.npcConversations??=[];hydrateResidentStories(s);s.agentExecutions??=[];s.economy={gross:0,guestSerial:0,tripCounter:0,arrivals:0,declined:0,departures:0,rating:3.4,reviews:0,ledger:[],receipts:{},visitorLog:[],...s.economy};hydrateEconomy(s);return s}
export function career(i,s){return s.npcCareers[i]??={phase:0,completed:0,history:[],lastResult:''}}
export function needs(i,s){const n=s.npcNeeds[i]??={energy:78,social:62};n.hunger??=76;n.rations??=2;n.mood??='平静';return n}
export function relationship(s,a,b){s.npcRelations[a]??={};return s.npcRelations[a][b]=Object.assign({affinity:0,trust:0,affection:0,tension:0,interactions:0,lastEvent:null,label:'初识'},s.npcRelations[a][b]||{})}
export function destination(d){if(d.buildingId!=null)return SLOTS[d.buildingId].entry;return d.goal==='farm'?{x:435,y:700}:d.goal==='mine'?{x:1140,y:310}:d.goal==='forest'?{x:435,y:354}:d.goal==='dock'?HARBOR.activities[0]:{x:780,y:465}}
function target(step){return typeof step==='number'?{goal:BUILDINGS[step].kind,buildingId:step}:{goal:step,buildingId:null}}
// Personal routines and shared projects choose concrete places; "tea" is not a universal destination.
export const LEISURE_VENUES=[14,19,21,5,3,23,17,13,6,22,7,22,12,4,18,11,19];
export function residentCrowd(s,bid,except=-1){return (s.npcPresence||[]).filter(n=>n.id!==except&&(n.inside===bid||n.buildingId===bid)).length}
function crowdPenalty(s,bid,i){return bid==null?0:residentCrowd(s,bid,i)*12}
function repeatPenalty(c,bid,time){const h=c.history.slice(-2);return bid!=null&&h.length&&h.every(x=>x.buildingId===bid)&&time-(h.at(-1).time||0)<90?20:0}
function nextCareerProduction(recipe,s,path=[]){
 if(path.includes(recipe.item)||path.length>8)return {blocked:'制作依赖需要检查，先处理其他工作'};
 const gate=recipeGate(recipe,s);if(!gate.ready)return {blocked:gate.text};
 for(const [id,quantity] of Object.entries(recipe.cost)){
  if(availableQuantity(s,id)>=quantity)continue;
  const item=ITEM_BY_ID[id],sub=RECIPE_BY_ID[item?.recipeId];
  if(sub){const before=nextCareerProduction(sub,s,[...path,recipe.item]);return before||{recipe:sub};}
  return item?.category==='material'?{resource:item}:{blocked:'等待可制作的材料信息'};
 }
 return null;
}
function stepOption(i,s,r){
 const c=career(i,s),route=CAREERS[i].route,step=route[c.phase%route.length],t=target(step);
 let title=typeof step==='number'?ROOMS[step].station:TITLES[step],activity=typeof step==='number'?'station':step,blocked='';
 if(step==='farm'&&s.inventory.seed<1&&!s.plots.some(p=>p.stage===4)){Object.assign(t,target(14));activity='herbs';title='先在温室补充种苗，再继续耕种';}
 const recipe=step===19?null:RECIPES[step];
 if(recipe){
  const preparation=nextCareerProduction(recipe,s);
  if(preparation?.blocked){blocked=preparation.blocked;title=blocked;}
  else if(preparation?.recipe){const part=preparation.recipe;Object.assign(t,target(part.building),{recipeId:part.id});activity='station';title='先在'+BUILDINGS[part.building].name+'制作'+part.name+'，再去'+BUILDINGS[step].name;}
  else if(preparation?.resource){const item=preparation.resource,kind=item.source,source=item.id==='seed'?14:kind==='forest'?'forest':kind==='mine'?'mine':['fishing','shore'].includes(kind)?'dock':kind==='greenhouse'?14:'farm';Object.assign(t,target(source),{resource:item.id});activity=source===14?'herbs':source;title='先取得'+item.name+'，再去'+BUILDINGS[step].name;}
 }
 const farmWaiting=t.goal==='farm'&&s.plots.every(p=>p.stage===3),waiting=farmWaiting||!!blocked,action=t.buildingId===19?'rest':'work';
 return {...t,action,activity,reason:CAREERS[i].title+'：'+(blocked||(farmWaiting?'作物还在生长，稍后再来照料':title)),purposeId:'career:'+c.phase,duration:10,item:recipe?.item||null,careerStep:step,waiting};
}
function mealOptions(i,s,r,time){const c=career(i,s),food=Object.values(ITEM_BY_ID).filter(x=>x.category==='food'&&[1,2,17].includes(x.building)&&availableQuantity(s,x.id)>0).map(x=>({...target(x.building),action:'eat',activity:'eat',duration:10,foodId:x.id,purposeId:'need:food:'+x.id,score:100+(x.building===1?-14:0)-crowdPenalty(s,x.building,i)-repeatPenalty(c,x.building,time),reason:'去'+BUILDINGS[x.building].name+'享用现有的'+x.name}));
 for(const [id,bid] of [['wheat',2],['mushroom',22],['strawberry',22]])if(availableQuantity(s,id)>0)food.push({...target(bid),action:'eat',activity:'eat',duration:10,foodId:id,purposeId:'need:food:'+id,score:94-crowdPenalty(s,bid,i),reason:bid===2?'用现有小麦煮粥，补充饱足':'去营地准备'+ITEMS[id][0]+'简餐'});
 if(needs(i,s).rations>0){const bid=[19,22,2].sort((a,b)=>crowdPenalty(s,a,i)-crowdPenalty(s,b,i)||Math.abs((LEISURE_VENUES[i]||0)-a)-Math.abs((LEISURE_VENUES[i]||0)-b))[0];food.push({...target(bid),action:'eat',activity:'eat',duration:9,foodId:'rations',purposeId:'need:rations',score:92-crowdPenalty(s,bid,i),reason:'找个空闲的休息位吃自备简餐'});}
 if(!food.length)food.push({goal:'forest',buildingId:null,resource:'mushroom',action:'work',activity:'gather',duration:8,purposeId:'need:food-supply',score:104,reason:'食物库存不足，先采集可做简餐的蘑菇'});
 return food.sort((a,b)=>b.score-a.score).slice(0,2);
}
export function socialVenue(i,partner,s,type,time=0){const a=CAREERS[i].route.filter(x=>typeof x==='number'),b=CAREERS[partner].route.filter(x=>typeof x==='number'),common=a.filter(x=>b.includes(x));const candidates=type==='dispute'?[11,9,22]:type==='negotiate'?[...common,11,9]:type==='reconcile'?[22,19,7,...common]:[...common,LEISURE_VENUES[i],LEISURE_VENUES[partner],21,22];const unique=[...new Set(candidates)].filter(x=>s.buildings[x]!==undefined);return unique.sort((x,y)=>crowdPenalty(s,x,i)+repeatPenalty(career(i,s),x,time)-crowdPenalty(s,y,i)-repeatPenalty(career(i,s),y,time)||candidates.indexOf(x)-candidates.indexOf(y))[0]??22;}
export function purposeOptions(i,s,r,time=0){const n=needs(i,s),c=career(i,s),main=stepOption(i,s,r),options=residentStoryOptions(s,i).filter(o=>o.action!=='social'||time>(c.socialAfter||0));
 if(n.energy<38)options.push({...target(19),action:'rest',activity:'rest',duration:14,purposeId:'need:energy',score:110-crowdPenalty(s,19,i)*.25,reason:'体力不足，回居民之家坐下休息'});
 if(n.hunger<42)options.push(...mealOptions(i,s,r,time),...teaFacilityOptions(s,i,time));
 main.score=(main.waiting?8:62)-crowdPenalty(s,main.buildingId,i)*.4;if(time<(c.retryAfter||0)&&main.buildingId===c.retryBuilding)main.score=5;options.push(main);
 const relations=Object.entries(s.npcRelations[i]||{}).filter(([,x])=>x.interactions>0).sort((a,b)=>(b[1].tension||0)-(a[1].tension||0)||(b[1].affinity||0)-(a[1].affinity||0));const known=relations.length?Number(relations[0][0]):r.relationships?.[0]?.target;
 const partner=(s.npcPresence||[]).find(x=>x.id===known),partnerNeeds=Number.isInteger(known)?needs(known,s):null,available=(!partner||!partner.meeting&&!partner.assignment&&!partner.partyControlled&&!partner.recruitControlled)&&partnerNeeds?.energy>30&&partnerNeeds?.hunger>30;
 if(Number.isInteger(known)&&known!==i&&available&&!pendingResidentStory(s,i,known)&&time>(c.socialAfter||0)&&(n.social<58||relations[0]?.[1]?.tension>12)){
  const rel=relationship(s,i,known),issue=rel.tension>12?'reconcile':rel.affection>12&&rel.trust>8?'confession':rel.affinity<-6?'dispute':main.reason.includes('先取得')&&rel.interactions>0&&(rel.affinity>5||rel.tension>5)?'negotiate':'friendship',bid=socialVenue(i,known,s,issue,time);
  options.push({...target(bid),action:'social',activity:'social',duration:12,partnerId:known,socialType:issue,purposeId:'relationship:'+known,score:(rel.tension>12?82:n.social<42?76:40)-crowdPenalty(s,bid,i),reason:'在'+BUILDINGS[bid].name+'与同伴'+(issue==='reconcile'?'谈清上次分歧，尝试修复关系':issue==='confession'?'表达更亲近的心意':issue==='negotiate'?'讨论物资分配与工作互助':'分享工作和生活，交换不同看法')});
 }
 // Activity work is offered at normal decision boundaries, without extra model calls.
 const stories=s.residentStories,open=stories.episodes.filter(e=>['scheduled','meeting','working'].includes(e.status));
 if(i<15&&n.energy>38&&n.hunger>42&&time>(c.socialAfter||0)&&open.length<STORY_LIMITS.active&&!open.some(e=>e.people.includes(i))){
  const groups=activityCooperationNeeds(s),partners=Array.from({length:15},(_,j)=>j).filter(j=>j!==i).sort((a,b)=>(relationship(s,i,b).trust||0)-(relationship(s,i,a).trust||0)||a-b);
  for(const j of partners){
   const p=s.npcPresence?.find(p=>p.id===j),nn=needs(j,s),rel=relationship(s,i,j),key=[i,j].sort((a,b)=>a-b).join('-');
   if(p&&(p.meeting||p.assignment||p.partyControlled||p.recruitControlled)||nn.energy<=38||nn.hunger<=42||time<=(career(j,s).socialAfter||0)||rel.tension>12||rel.affinity< -6||open.some(e=>e.people.includes(j))||stories.lastPairDay[key]!==undefined&&s.day-stories.lastPairDay[key]<STORY_LIMITS.pairDays)continue;
   const proposal=chooseResidentCooperation(s,[i,j],{careers:CAREERS,groups,activityOnly:true});if(!proposal)continue;
   const bid=socialVenue(i,j,s,'negotiate',time),a=proposal.plans[i],b=proposal.plans[j];
   options.push({...target(bid),action:'social',activity:'social',duration:12,partnerId:j,socialType:'negotiate',purposeId:'activity-cooperation:'+j,score:73-crowdPenalty(s,bid,i),reason:'为「'+proposal.demand.name+'」与'+(s.npcProfiles?.[j]?.name||'同伴')+'商量分工：我准备'+ITEM_BY_ID[a.resource].name+'，对方准备'+ITEM_BY_ID[b.resource].name});break;
  }
 }
 const bid=LEISURE_VENUES[i],breakDue=(c.workSinceBreak||0)>=3||main.waiting||main.score<10;
 if(time>(c.personalAfter||0))options.push({...target(bid),action:'visit',activity:'leisure',duration:12,purposeId:'life:'+bid,score:(breakDue?70:28)-crowdPenalty(s,bid,i)-repeatPenalty(c,bid,time),reason:'完成一段工作后，去'+BUILDINGS[bid].name+'做自己感兴趣的事'});
 options.sort((a,b)=>b.score-a.score);
 if(n.energy<20)return options.filter(o=>o.action==='rest');if(n.hunger<30)return options.filter(o=>o.action==='eat'||o.purposeId==='need:food-supply');return options;
}
export function choosePurpose(i,s,r,time=0){const options=purposeOptions(i,s,r,time);return {...options[0],source:'local',speech:''}}
export function commitWork(i,d,s,time){
 const receipts=s.taskActionReceipts??={};
 if(d.operationId&&receipts[d.operationId])return receipts[d.operationId].result;
 const before=d.operationId?{...s.inventory}:null,result=executeWork(i,d,s,time);
 if(d.operationId)receipts[d.operationId]={day:s.day,npcId:i,storyId:d.storyId||null,goal:d.goal,result,delta:Object.fromEntries(Object.entries(s.inventory).map(([id,n])=>[id,n-(before[id]||0)]).filter(([,n])=>n))};
 return result;
}
function executeWork(i,d,s,time){const n=needs(i,s),c=career(i,s);let result='',advance=true;
 function complete(result,advance=true){if(d.action==='work'&&advance)c.workSinceBreak=(c.workSinceBreak||0)+1;if(!advance&&d.buildingId!=null){c.retryAfter=time+30;c.retryBuilding=d.buildingId;}if(d.purposeId?.startsWith('career:')&&advance){const expected=target(CAREERS[i].route[c.phase%CAREERS[i].route.length]);if(d.goal===expected.goal&&d.buildingId===expected.buildingId)c.phase++;}c.completed++;c.lastResult=result;c.history.push({time,goal:d.goal,buildingId:d.buildingId,result,source:d.source});c.history=c.history.slice(-16);return result;}
 if(d.facilityId){const b=s.functionalFacilities,r=functionalCommand(s,{commandId:d.operationId||('npc-tea:'+i+':'+time),displayId:d.facilityId,action:'sip',expectedRevision:b?.revision});if(!r.ok)return complete(r.reason,false);if(!r.replayed){n.hunger=Math.min(100,n.hunger+22);n.energy=Math.min(100,n.energy+7);n.social=Math.min(100,n.social+2);n.mood='温暖';}return complete('在岛上的暖手茶炉享用花茶 · 余量实际减少一杯');}
 if(d.action==='rest'){n.energy=Math.min(100,n.energy+42);n.mood='放松';return complete('在居民之家休息，恢复体力')}
 if(d.action==='eat'){let item=d.foodId;if(!item)item=s.inventory.meal>0?'meal':s.inventory.bread>0?'bread':s.inventory.tea>0?'tea':s.inventory.wheat>0?'wheat':'rations';if(item==='rations'){if(n.rations<1)return complete('自备简餐已用完，需要准备食物',false);n.rations--;n.hunger=Math.min(100,n.hunger+40);result='吃一份自备简餐（剩余 '+n.rations+' 份）';}else{const info=ITEM_BY_ID[item],valid=info&&(info.category==='food'&&[1,2,17].includes(info.building)||['wheat','mushroom','strawberry'].includes(item));if(!valid||!commitResources(s,{owner:d.resourceOwner||null,cost:{[item]:1},category:'resident_meal',note:'居民 '+i}).ok)return complete('选定餐点已售罄或预留，重新选择食物',false);n.hunger=Math.min(100,n.hunger+(info.building===1?22:38));result='享用'+ITEMS[item][0];}n.energy=Math.min(100,n.energy+7);n.mood='满足';return complete(result)}
 if(d.action==='visit'){n.energy=Math.min(100,n.energy+12);n.social=Math.min(100,n.social+6);n.mood='放松';c.workSinceBreak=0;c.personalAfter=time+65;return complete('在'+(d.buildingId!=null?BUILDINGS[d.buildingId].name:TITLES[d.goal])+'体验个人兴趣与生活')}
 n.energy=Math.max(0,n.energy-5);n.hunger=Math.max(0,n.hunger-4);
 if(d.goal==='farm'){const p=d.noFarmTask?null:d.farmIndex!=null?s.plots[d.farmIndex]:s.plots.find(p=>p.stage===4)||s.plots.find(p=>p.stage===2)||s.plots.find(p=>p.stage===1&&s.inventory.seed>0)||s.plots.find(p=>p.stage===0);if(p){if(p.stage===0){p.stage=1;result='为田垄松土';advance=false}else if(p.stage===1){if(commitResources(s,{owner:d.resourceOwner||null,cost:{seed:1},category:'resident_sow'}).ok){p.stage=2;result='播种'+cropInfo(p).name}else result='种苗已经用完，先补充种苗';advance=false}else if(p.stage===2){p.stage=3;p.growth=0;result='给'+cropInfo(p).name+'浇水，等待成熟';advance=false}else if(p.stage===4){const index=s.plots.indexOf(p),crop=harvestPlot(s,index);result='收获'+crop.name+' ×'+crop.amount}}else{result='检查作物长势';advance=false}}
 else if(d.goal==='mine'){const node=d.mineIndex!=null?s.oreNodes[d.mineIndex]:s.oreNodes.find(p=>p.hp>0);if(node&&node.hp>0){node.hp--;s.inventory.stone++;if(d.resource&&d.resource!=='stone'&&d.resource!=='ore')resourceLoot('mine',s,1,d.resource);result='开采石材 ×1'+(d.resource&&d.resource!=='stone'&&d.resource!=='ore'?'、'+ITEMS[d.resource][0]+' ×1':'');if(!node.hp){node.regen=20;s.inventory.ore+=2;s.tasks.mine=true;result='开采石材 ×1、矿石 ×2'}}else{result='检修矿镐，等待矿脉恢复';advance=false}}
 else if(d.goal==='forest'){const item=d.resource||'wood';resourceLoot('forest',s,2,item);result='采集'+ITEMS[item][0]+' ×2'}
 else if(d.goal==='dock'){const item=d.resource||'fish';resourceLoot(ITEM_BY_ID[item]?.source||'fishing',s,1,item);result='在码头取得'+ITEMS[item][0]+' ×1'}
 else if(d.buildingId===14&&d.resource==='seed'&&!d.recipeId){commitResources(s,{gain:{seed:1},category:'nursery_collect'});result='从温室苗床收取种子 ×1'}
 else if(d.buildingId===14&&!d.recipeId&&(d.activity==='herbs'||d.resource)){const item=d.resource||'herb';resourceLoot('greenhouse',s,1,item);if(s.inventory.seed<4)s.inventory.seed++;result='从温室采收'+ITEMS[item][0]+' ×1'+(s.inventory.seed<5?'，补充种苗':'')}
 else if(d.buildingId!=null){const recipe=RECIPE_BY_ID[d.recipeId]||RECIPES[d.buildingId];if(d.productionMode!=='maintenance'&&recipe&&recipe.building===d.buildingId&&commitRecipe(recipe,s,{owner:d.resourceOwner||null,commandId:d.operationId?d.operationId+':craft':null})){if(recipe.item==='lantern')s.tasks.craft=true;improveQuality(s.facilities[d.buildingId],.1);result='在'+BUILDINGS[d.buildingId].name+'制作'+ITEMS[recipe.item][0]+' ×1'}else{result='完成'+ROOMS[d.buildingId].station+'的整理、维护与服务准备';if(recipe)advance=false;}const f=s.facilities[d.buildingId];f.condition=Math.min(100,f.condition+.5);f.lastWork=time;}
 else result='观察广场人流，整理活动信息';
 return complete(result,advance);
}
export function applyRelationshipEvent(s,change,summary){const rel=relationship(s,change.from,change.to);for(const [key,max] of [['affinity',6],['trust',4],['affection',3],['tension',6]]){const delta=Math.max(-max,Math.min(max,Number(change[key])||0));rel[key]=Math.max(key==='tension'?0:-100,Math.min(100,rel[key]+delta))}rel.lastEvent=summary;rel.label=rel.tension>18?'心有芥蒂':rel.affinity<-12?'关系紧张':rel.affection>18&&rel.trust>12?'心生好感':rel.affinity>18?'亲近':rel.trust>10?'信任':'相识';return rel}
export const TOURISTS=[
 {name:'乔安',taste:'花草与茶香',likes:[14,3,1,22],budget:24,minScore:40},
 {name:'森久',taste:'收藏与知识',likes:[18,7,5,6],budget:28,minScore:47},
 {name:'可可',taste:'海岛美食',likes:[17,2,1,9],budget:30,minScore:40},
 {name:'律介',taste:'音乐与舞台',likes:[12,21,1],budget:24,minScore:44},
 {name:'舟梨',taste:'海洋与航船',likes:[6,8,23,16],budget:26,minScore:44},
 {name:'弥生',taste:'工艺与服饰',likes:[4,15,24,3],budget:32,minScore:48},
 {name:'枫铃',taste:'自然与露营',likes:[22,14,5],budget:22,minScore:44},
 {name:'澈川',taste:'摄影与精品展览',likes:[13,18,5],budget:34,minScore:67}
];
export function assessIsland(s,tourist){const open=Object.values(s.buildings),quality=open.length?open.reduce((v,id)=>v+effectiveQuality(s.facilities[id]),0)/open.length:0;const candidates=tourist.likes.filter(id=>open.includes(id)).map(id=>({id,quality:effectiveQuality(s.facilities[id]),available:!!venueService(id,effectiveQuality(s.facilities[id]))||!RECIPES[id]||ALL_RECIPES.some(r=>r.building===id&&s.inventory[r.item]>0)}));const count=candidates.length;const crowd=s.economy.active||0;const score=Math.round(Math.min(100,open.length*.5+quality*.6+s.economy.rating*3+count*6-crowd*1.5));const itinerary=candidates.filter(c=>c.quality>=25&&c.available).sort((a,b)=>b.quality-a.quality).slice(0,3).map(c=>c.id);const accepted=score>=tourist.minScore&&itinerary.length>=2;return {score,accepted,itinerary,reason:accepted?'有 '+count+' 处符合'+tourist.taste+'的设施，愿意上岛':itinerary.length<2?'想体验的设施或商品不足，暂不上岛':'设施品质与口碑未达到这次出游的期待'};}
export function visitQuote(s,guest,buildingId){
 const f=s.facilities[buildingId];if(!f)return {paid:0,reason:'设施不存在'};
 const stocked=ALL_RECIPES.filter(r=>r.building===buildingId&&availableQuantity(s,r.item)>=1&&visitorPrice(r.item,r)<=guest.budget).sort((a,b)=>b.tier-a.tier||a.index-b.index);
 const recipe=stocked[0]||RECIPES[buildingId],service=venueService(buildingId,effectiveQuality(f)),selling=!!stocked[0];
 const price=selling?visitorPrice(recipe.item,recipe):service?service.price:recipe?visitorPrice(recipe.item,recipe):3+Math.floor(effectiveQuality(f)/25),cost=operatingCost(price);
 if(guest.budget<price)return {paid:0,reason:'预算不足'};
 if(recipe&&!selling&&!service)return {paid:0,reason:'商品售罄'};
 return {paid:price,cost,net:price-cost,item:selling?recipe.item:null,service:!selling?service?.name||null:null,
  reason:guest.name+'在'+BUILDINGS[buildingId].name+(selling?'购买'+ITEMS[recipe.item][0]:'体验'+(service?.name||'服务'))+'，营业 '+price+'、成本 '+cost+'、净入账 +'+(price-cost)+' 岛币'};
}
export function settleVisit(s,guest,buildingId,receiptId,time,options={}){
 if(s.economy.receipts[receiptId])return {paid:0,reason:'该消费已经结算'};
 const f=s.facilities[buildingId];if(!f)return {paid:0,reason:'设施不存在'};
 const quote=options.quote||visitQuote(s,guest,buildingId);if(!quote.paid)return {...quote};
 const price=quote.paid,cost=quote.cost;
 if(guest.budget<price)return {paid:0,reason:'预算不足'};
 if(!transact(s,{income:price,cost,category:'visitor',note:guest.name+' · '+BUILDINGS[buildingId].name,receipt:receiptId,materials:quote.item?{[quote.item]:1}:{},owner:options.owner||null}))return {paid:0,reason:'该消费已经结算'};
 guest.budget-=price;f.revenue+=price;f.operatingCosts+=cost;f.visits++;f.condition=Math.max(0,f.condition-1.5);
 s.economy.gross+=price;s.economy.receipts[receiptId]=true;
 const row={id:receiptId,day:s.day,time,guest:guest.name,buildingId,amount:price,cost,net:price-cost,item:quote.item||null,service:quote.service||null};
 s.economy.ledger.push(row);s.economy.ledger=s.economy.ledger.slice(-100);
 const keys=Object.keys(s.economy.receipts);for(const key of keys.slice(0,-200))delete s.economy.receipts[key];
 return {paid:price,cost,net:price-cost,reason:quote.reason};
}
export function reviewVisit(s,guest){const q=guest.ratings?.length?guest.ratings.reduce((a,b)=>a+b,0)/guest.ratings.length:20;const rating=Math.max(1,Math.min(5,Math.round((q/20)*10)/10));s.economy.rating=(s.economy.rating*s.economy.reviews+rating)/(s.economy.reviews+1);s.economy.reviews++;s.economy.departures++;return rating;}
