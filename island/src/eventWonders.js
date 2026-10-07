import {validLanVisits} from './lanWonderEvidence.js';
import {ECONOMY_RULES} from './economy.js';
import {fireworksSummary,validFireworksGame} from './fireworksRules.js';
import {coutureSummary,validCoutureGame} from './coutureRules.js';
import {validCooperationRows,verifiedCooperation} from './cooperationEvidence.js';
import {fishingScore,validFishingMatch} from './fishingRules.js';
import {trackHostedAchievement} from './achievements.js';
import {eventCost} from './partyPlanning.js';
import {MARKET_STOCK,marketSummary,validMarketGame} from './marketRules.js';
export const RARITIES={N:{name:'日常',color:'#77866b'},R:{name:'珍藏',color:'#538b83'},SR:{name:'稀有',color:'#9b78af'},SSR:{name:'传世',color:'#bb9444'},UR:{name:'传奇',color:'#bb725f'}};
export const NATIVE_WONDER_IDS_V98=['island_pinwheel','starlit_diorama','muse_wardrobe'];
export const WONDER_DEFINITIONS={
 archipelago_lighthouse:{id:'archipelago_lighthouse',name:'群岛灯塔',rarity:'UR',description:'为五场远道而来的相聚亮灯，记下每位朋友与自己的管家走过的码头。',condition:'五场不同联机活动，由五位不同来访岛主携自己的管家实际登岛，完成合格挑战并结算',location:'灯塔西侧庭院',colors:[{id:'sea',name:'群岛暖光',index:0}]},
 cooperation_tree:{id:'cooperation_tree',name:'海岛协作树',rarity:'SSR',description:'交织的金根与三片树冠，把十场共同准备的相聚留在同一座岛上。',condition:'十场不同活动均有新的主／子Agent实际物资交付，并完整领取结果',location:'博物馆西侧庭院',colors:[{id:'sea',name:'同心金叶',index:0}]},
 island_pinwheel:{id:'island_pinwheel',name:'初聚海风车',rarity:'N',description:'四片纸翼，记下你第一次认真筹备并完成的夜集。',condition:'完整放飞四盏星灯，并领取夜集奖励',location:'音乐馆庭院',colors:[{id:'sea',name:'海风原色',index:0}]},
 starlit_diorama:{id:'starlit_diorama',name:'星河微缩景',rarity:'SR',description:'一轮月亮和三颗星，把完美放飞与海岛烟花收进小小的星河。',condition:'带上约定烟花完成星灯夜集，四盏全部精准放飞',location:'观星台庭院',colors:[{id:'sea',name:'星河原色',index:0}]},
 muse_wardrobe:{id:'muse_wardrobe',name:'缪斯衣架',rarity:'SR',description:'海风礼裙与贝壳胸针，收藏三位居民最自信的一次登台。',condition:'三位模特完成展示，平均品质85分且12个姿态至少命中10次',location:'服装店西侧庭院',colors:[{id:'sea',name:'海风礼裙',index:0}]},

 fireworks_orbit:{id:"fireworks_orbit",name:"星潮留影灯",rarity:"SR",description:"海风与节拍留下的一盏星光，收藏伙伴共同完成的三幕烟花。",condition:"六枚全部发射，至少五枚合拍命中且品质75分",location:"烟花工坊庭院",colors:[{id:"sea",name:"星潮原色",index:0}]},
 couture_ribbon:{id:'couture_ribbon',name:'星织展示台',rarity:'R',description:'一件海风披肩，收藏三位居民自信登台的时刻。',condition:'三位模特完成展示，平均品质65分且12个姿态至少命中6次',location:'服装店庭院',colors:[{id:'sea',name:'珊瑚海风',index:0}]},
 market_lantern:{id:'market_lantern',name:'集市灯牌',rarity:'R',description:'一盏暖灯，记下摊主分工与顾客带走的海岛手艺。',condition:'完成集市三波经营，服务至少6位顾客且品质达到45分',location:'集市庭院',colors:[{id:'sea',name:'海风暖灯',index:0}]},
 seashell_cup:{id:'seashell_cup',name:'海风贝壳奖杯',rarity:'R',description:'六竿海风，记录第一次让朋友相聚的潮汐。',condition:'完成一场海风钓鱼大会',location:'博物馆庭院',colors:[{id:'sea',name:'海风青',index:0},{id:'violet',name:'暮色紫',index:1},{id:'coral',name:'夕照珊瑚',index:2}]},
 cooperation_monument:{id:'cooperation_monument',name:'同心启航纪念碑',rarity:'R',description:'金帆与银帆托起同一颗星，把真实分工留在岛上。',condition:'真实主／子Agent交付本场筹备物资，并完整举办任一种海岛活动',location:'派对广场',colors:[{id:'sea',name:'同心原色',index:0}]}
};
const int=n=>Number.isSafeInteger(n)&&n>=0;
export function wonderAsset(id,theme,color='sea'){
 if(!['pixel','origami'].includes(theme)||!WONDER_DEFINITIONS[id])return '';
 if(id==='archipelago_lighthouse')return '/assets/archipelago-lighthouse-'+theme+'-v99.png';
 if(id==='cooperation_tree')return '/assets/cooperation-tree-'+theme+'-v99.png';
 if(NATIVE_WONDER_IDS_V98.includes(id))return '/assets/'+id.replaceAll('_','-')+'-'+theme+'-v98.png';
 return id==='fireworks_orbit'?'/assets/fireworks-orbit-'+theme+'-v90.png':id==='couture_ribbon'?'/assets/couture-ribbon-'+theme+'-v89.png':id==='market_lantern'?'/assets/market-lantern-'+theme+'-v87.png':id==='cooperation_monument'?'/assets/cooperation-monument-'+theme+'-v33.png':color==='sea'?'/assets/seashell-cup-'+theme+'-v30.png':'/assets/seashell-cup-'+theme+'-'+color+'-v33.png';
}
export function hydrateWonders(s){
 if(!s.eventWonders)s.eventWonders={version:2,owned:{},displayed:null,displays:{},receipts:{},exchanges:{},sources:{}};
 const legacy=s.eventWonders.version===1,w=s.eventWonders;w.displays??={};w.pendingDisplays??={};w.exchanges??={};w.sources??={};w.receipts??={};
 if(w.version===1){if(w.displayed==='seashell_cup')w.displays.seashell_cup=true;w.version=2;}
 for(const [id,a] of Object.entries(w.owned)){
  if(!WONDER_DEFINITIONS[id])continue;a.color??=0;a.colors??=['sea'];a.marks??=0;a.wins??=0;
  a.sourceVersion??=1;
  if(legacy&&a.color>0){const color=WONDER_DEFINITIONS[id].colors[a.color]?.id;if(color&&!a.colors.includes(color)){a.colors.push(color);w.exchanges[id+':'+color]={wonderId:id,color,marks:0,day:a.day,source:'legacy'};}}
 }
 return w;
}
export function completedFishingProof(s,g){
 if(!g||g.phase!=='claimed'||!validFishingMatch(g.match)||g.match.phase!=='results'||g.match.results.length!==6)return false;
 const score=fishingScore(g.match),paid=30+Math.floor(score.normalized*.12),r=s.resourceLedger?.receipts?.['cash:'+g.id+':reward'],entry=s.resourceLedger?.receipts?.['cash:'+g.id+':entry'],cost=eventCost(g);
 return s.economy?.cashReceipts?.[g.id+':entry']===true&&entry?.category==='party'&&Object.entries(cost).every(([id,n])=>entry.delta?.[id]===-n)&&g.paid===paid&&JSON.stringify(g.result)===JSON.stringify(score)&&s.economy?.cashReceipts?.[g.id+':reward']===true&&r?.category==='party'&&r.delta?.coins===paid;
}
export function cooperationProof(s,g){return verifiedCooperation(s,g);}
function recordCompletedCooperation(s,g,template,metrics={}){
 const w=hydrateWonders(s),proof=cooperationProof(s,g),newIds=[];
 if(proof.length&&!w.owned.cooperation_monument){
  w.owned.cooperation_monument={id:'cooperation_monument',name:WONDER_DEFINITIONS.cooperation_monument.name,rarity:'R',eventId:g.id,eventName:g.name||'星灯夜集',day:g.endedDay||s.day,marks:0,wins:0,color:0,colors:['sea'],sourceVersion:2,proof};newIds.push('cooperation_monument');
 }
 w.sources[g.id]??={eventId:g.id,eventName:g.name||'星灯夜集',day:g.endedDay||s.day,template,...metrics,proof};
 trackHostedAchievement(s,{id:g.id,template,day:g.endedDay||s.day},proof);
 return{ok:true,newIds,cooperation:proof};
}
export function completedNightProof(s,g){
 if(g?.template!=='night'||g.phase!=='finished'||!Number.isInteger(g.score)||g.score<0||g.score>4||g.entryReceiptId!==g.id+':entry')return false;
 const reward=ECONOMY_RULES.partyReward+g.score*ECONOMY_RULES.partyPerfectBonus+(g.outfit?2:0)+(g.fireworks?3:0),cost=eventCost(g),entry=s.resourceLedger?.receipts?.['cash:'+g.entryReceiptId],paid=s.resourceLedger?.receipts?.['cash:'+g.id];
 return g.paid===reward&&s.economy?.cashReceipts?.[g.entryReceiptId]===true&&s.economy?.cashReceipts?.[g.id]===true&&entry?.category==='party'&&Object.entries(cost).every(([id,n])=>entry.delta?.[id]===-n)&&paid?.category==='party'&&paid.delta?.coins===reward;
}
function awardNativeWonder(s,id,g){const w=hydrateWonders(s),key='wonder:'+id+':'+g.id;if(w.receipts[key])return [];w.receipts[key]=true;const a=w.owned[id],d=WONDER_DEFINITIONS[id];if(a){a.marks++;a.wins++;return [];}w.owned[id]={id,name:d.name,rarity:d.rarity,eventId:g.id,eventName:g.name||'星灯夜集',day:g.endedDay||s.day,marks:0,wins:1,color:0,colors:['sea'],sourceVersion:6};return [id];}
export function awardArchipelagoLighthouse(s,rows){if(rows?.length!==5||!validLanVisits(rows))return {ok:false,newIds:[]};const last=rows.at(-1),newIds=awardNativeWonder(s,'archipelago_lighthouse',{id:last.eventId,name:'五岛海风相聚',endedDay:s.day});if(newIds.length){const a=s.eventWonders.owned.archipelago_lighthouse;a.sourceVersion=8;a.visits=structuredClone(rows);}return {ok:true,newIds};}
export function awardCooperationTree(s,rows){if(!Array.isArray(rows)||rows.length!==10||new Set(rows.map(r=>r.id)).size!==10||rows.some(r=>!validCooperationRows(r.proof)))return {ok:false,newIds:[]};const proof=rows.flatMap(r=>r.proof);if(!validCooperationRows(proof))return {ok:false,newIds:[]};const last=rows.at(-1),newIds=awardNativeWonder(s,'cooperation_tree',{id:last.id,name:'十场同心相聚',endedDay:last.day});const a=s.eventWonders.owned.cooperation_tree;if(newIds.length){a.sourceVersion=7;a.proof=structuredClone(proof);a.cooperationEvents=rows.map(r=>({id:r.id,template:r.template,day:r.day}));}return {ok:true,newIds};}
export function awardNightCooperation(s,g){if(!completedNightProof(s,g))return {ok:false,newIds:[]};const r=recordCompletedCooperation(s,g,'night',{score:g.score});r.newIds.push(...awardNativeWonder(s,'island_pinwheel',g));if(g.score===4&&g.fireworks===true)r.newIds.push(...awardNativeWonder(s,'starlit_diorama',g));return r;}
export function awardEventWonders(s,g){
 if(!completedFishingProof(s,g))return {ok:false,newIds:[]};
 const w=hydrateWonders(s),score=fishingScore(g.match),proof=cooperationProof(s,g),newIds=[];
 if(!w.receipts[g.id]){
  w.receipts[g.id]=true;
  if(!w.owned.seashell_cup){w.owned.seashell_cup={id:'seashell_cup',name:WONDER_DEFINITIONS.seashell_cup.name,rarity:'R',eventId:g.id,eventName:g.name,day:g.endedDay||s.day,marks:0,wins:score.won?1:0,color:0,colors:['sea'],sourceVersion:2};newIds.push('seashell_cup');}
  else{w.owned.seashell_cup.marks++;if(score.won)w.owned.seashell_cup.wins++;}
 }
 const collaboration=recordCompletedCooperation(s,g,'fishing',{score:score.raw});newIds.push(...collaboration.newIds);
 return {ok:true,newIds,cooperation:proof};
}
export function completedMarketProof(s,g,{requireQuality=true}={}){
 if(g?.template!=='market'||g.phase!=='claimed'||!validMarketGame(g.game)||g.game.phase!=='results')return false;
 const score=marketSummary(g.game),entry=s.resourceLedger?.receipts?.['cash:'+g.id+':entry'],reward=s.resourceLedger?.receipts?.['cash:'+g.id+':reward'],returned=s.resourceLedger?.receipts?.[g.id+':return'];
 return (!requireQuality||score.passed)&&g.paid===score.reward&&JSON.stringify(g.result)===JSON.stringify(score)&&JSON.stringify(g.returned)===JSON.stringify(g.game.stock)&&s.economy?.cashReceipts?.[g.id+':entry']===true&&s.economy?.cashReceipts?.[g.id+':reward']===true&&entry?.category==='party'&&entry.delta?.coins===-12&&Object.entries(MARKET_STOCK).every(([id,n])=>entry.delta?.[id]===-n)&&reward?.category==='party'&&(reward.delta?.coins||0)===g.paid&&returned?.category==='market_return'&&Object.entries(MARKET_STOCK).every(([id])=>(returned.delta?.[id]||0)===g.returned[id]);
}
export function awardMarketWonder(s,g){
 if(!completedMarketProof(s,g,{requireQuality:false}))return{ok:false,newIds:[]};
 const score=marketSummary(g.game);
 if(!score.passed&&!cooperationProof(s,g).length){trackHostedAchievement(s,{id:g.id,template:'market',day:g.endedDay||s.day});return{ok:true,newIds:[]};}
 const w=hydrateWonders(s),newIds=[];
 if(score.passed&&!w.receipts[g.id]){
  w.receipts[g.id]=true;
  if(!w.owned.market_lantern){w.owned.market_lantern={id:'market_lantern',name:WONDER_DEFINITIONS.market_lantern.name,rarity:'R',eventId:g.id,eventName:g.name,day:g.endedDay||s.day,marks:0,wins:1,color:0,colors:['sea'],sourceVersion:3};newIds.push('market_lantern');}
  else{w.owned.market_lantern.marks++;w.owned.market_lantern.wins++;}
 }
 const collaboration=recordCompletedCooperation(s,g,'market',{score:score.quality,served:score.served});newIds.push(...collaboration.newIds);
 return{ok:true,newIds,cooperation:collaboration.cooperation};
}
export function completedCoutureProof(s,g,{requireQuality=true}={}){
 if(g?.template!=='couture'||g.phase!=='claimed'||!validCoutureGame(g.game)||g.game.phase!=='results')return false;
 const score=coutureSummary(g.game),entry=s.resourceLedger?.receipts?.['cash:'+g.id+':entry'],reward=s.resourceLedger?.receipts?.['cash:'+g.id+':reward'],cost=eventCost(g);
 return (!requireQuality||score.passed)&&g.paid===score.reward&&JSON.stringify(g.result)===JSON.stringify(score)&&s.economy?.cashReceipts?.[g.id+':entry']===true&&s.economy?.cashReceipts?.[g.id+':reward']===true&&entry?.category==='party'&&Object.entries(cost).every(([id,n])=>entry.delta?.[id]===-n)&&reward?.category==='party'&&(reward.delta?.coins||0)===score.reward;
}
export function awardCoutureWonder(s,g){
 if(!completedCoutureProof(s,g,{requireQuality:false}))return{ok:false,newIds:[]};
 const score=coutureSummary(g.game);
 if(!score.passed&&!cooperationProof(s,g).length){trackHostedAchievement(s,{id:g.id,template:'couture',day:g.endedDay||s.day});return{ok:true,newIds:[]};}
 const w=hydrateWonders(s),newIds=[];
 if(score.passed&&!w.receipts[g.id]){
  w.receipts[g.id]=true;
  if(!w.owned.couture_ribbon){w.owned.couture_ribbon={id:'couture_ribbon',name:WONDER_DEFINITIONS.couture_ribbon.name,rarity:'R',eventId:g.id,eventName:g.name,day:g.endedDay||s.day,marks:0,wins:1,color:0,colors:['sea'],sourceVersion:4};newIds.push('couture_ribbon');}
  else{w.owned.couture_ribbon.marks++;w.owned.couture_ribbon.wins++;}
 }
 const collaboration=recordCompletedCooperation(s,g,'couture',{score:score.quality,poseHits:score.poseHits,models:[...g.game.level.models]});newIds.push(...collaboration.newIds);
 if(score.completed===3&&score.quality>=85&&score.poseHits>=10)newIds.push(...awardNativeWonder(s,'muse_wardrobe',g));
 return{ok:true,newIds,cooperation:collaboration.cooperation};
}
export function completedFireworksProof(s,g,{requireQuality=true}={}){
 if(g?.template!=='fireworks'||g.phase!=='claimed'||!validFireworksGame(g.game)||g.game.phase!=='results')return false;
 const score=fireworksSummary(g.game),entry=s.resourceLedger?.receipts?.['cash:'+g.id+':entry'],reward=s.resourceLedger?.receipts?.['cash:'+g.id+':reward'],shells=s.resourceLedger?.receipts?.['fireworks-fired:'+g.id],cost=eventCost(g);
 return (!requireQuality||score.passed)&&g.paid===score.reward&&JSON.stringify(g.result)===JSON.stringify(score)&&s.economy?.cashReceipts?.[g.id+':entry']===true&&s.economy?.cashReceipts?.[g.id+':reward']===true&&entry?.category==='party'&&Object.entries(cost).every(([id,n])=>entry.delta?.[id]===-n)&&shells?.category==='party_fireworks'&&shells.delta?.firework===-score.fired&&reward?.category==='party'&&(reward.delta?.coins||0)===score.reward;
}
export function awardFireworksWonder(s,g){
 if(!completedFireworksProof(s,g,{requireQuality:false}))return{ok:false,newIds:[]};
 const score=fireworksSummary(g.game);
 if(!score.passed&&!cooperationProof(s,g).length){trackHostedAchievement(s,{id:g.id,template:'fireworks',day:g.endedDay||s.day});return{ok:true,newIds:[]};}
 const w=hydrateWonders(s),newIds=[];
 if(score.passed&&!w.receipts[g.id]){
  w.receipts[g.id]=true;
  if(!w.owned.fireworks_orbit){w.owned.fireworks_orbit={id:'fireworks_orbit',name:WONDER_DEFINITIONS.fireworks_orbit.name,rarity:'SR',eventId:g.id,eventName:g.name,day:g.endedDay||s.day,marks:0,wins:1,color:0,colors:['sea'],sourceVersion:5};newIds.push('fireworks_orbit');}
  else{w.owned.fireworks_orbit.marks++;w.owned.fireworks_orbit.wins++;}
 }
 const collaboration=recordCompletedCooperation(s,g,'fireworks',{score:score.quality,hits:score.hits,fired:score.fired,shots:g.game.shots.map(s=>({round:s.round,color:s.config.color,shape:s.config.shape,quality:s.quality}))});newIds.push(...collaboration.newIds);
 return{ok:true,newIds,cooperation:collaboration.cooperation};
}

export function syncWonders(s){
 const w=hydrateWonders(s),events=[s.fishingParty?.session,...(s.fishingParty?.history||[])].filter(Boolean);
 for(const g of [...new Map(events.map(g=>[g.id,g])).values()].sort((a,b)=>(a.endedDay||0)-(b.endedDay||0)))awardEventWonders(s,g);
 const markets=[s.festivalParty?.session,...(s.festivalParty?.history||[])].filter(Boolean);for(const g of [...new Map(markets.map(g=>[g.id,g])).values()].sort((a,b)=>(a.endedDay||0)-(b.endedDay||0)))awardMarketWonder(s,g);
 const fireworks=[s.fireworksParty?.session,...(s.fireworksParty?.history||[])].filter(Boolean);for(const g of [...new Map(fireworks.map(g=>[g.id,g])).values()])awardFireworksWonder(s,g);
 const couture=[s.coutureParty?.session,...(s.coutureParty?.history||[])].filter(Boolean);for(const g of [...new Map(couture.map(g=>[g.id,g])).values()])awardCoutureWonder(s,g);
 for(const g of s.nightParty?.history||[])if(g.eventId)awardNightCooperation(s,{...g,id:g.eventId});
 return w;
}
export function setWonderDisplay(s,id,display=true){
 const w=hydrateWonders(s);if(!WONDER_DEFINITIONS[id]||!w.owned[id])return false;
 delete w.pendingDisplays[id];if(display)w.displays[id]=true;else delete w.displays[id];
 w.displayed=w.displays.seashell_cup?'seashell_cup':null;return true;
}
export function requestWonderDisplay(s,id,display=true,{canPlace=true}={}){
 const w=hydrateWonders(s);if(!WONDER_DEFINITIONS[id]||!w.owned[id])return {ok:false};
 if(display&&!canPlace&&!w.displays[id]){w.pendingDisplays[id]??={day:s.day};return {ok:true,pending:true};}
 return {ok:setWonderDisplay(s,id,display),pending:false};
}
export function redeemWonderColor(s,id,color){
 const w=hydrateWonders(s),a=w.owned[id],d=WONDER_DEFINITIONS[id],option=d?.colors.find(c=>c.id===color);
 if(!a||!option||color==='sea')return {ok:false,reason:'没有可兑换的配色'};
 if(a.colors.includes(color))return {ok:true,replayed:true};
 if(a.marks<5)return {ok:false,reason:'还需要 '+(5-a.marks)+' 枚纪念印记'};
 a.marks-=5;a.colors.push(color);a.color=option.index;w.exchanges[id+':'+color]={wonderId:id,color,marks:5,day:s.day};return {ok:true};
}
export function chooseWonderColor(s,id,color){
 const w=hydrateWonders(s),a=w.owned[id],o=WONDER_DEFINITIONS[id]?.colors.find(c=>c.id===color);
 if(!a||!o||!a.colors.includes(color))return false;a.color=o.index;return true;
}
export function validEventWonders(s){
 const w=s.eventWonders;if(w===undefined)return true;
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(!w||![1,2].includes(w.version)||!object(w.owned)||!object(w.receipts)||w.displayed!==null&&w.displayed!=='seashell_cup')return false;
 for(const [id,a] of Object.entries(w.owned)){
  const d=WONDER_DEFINITIONS[id];if(!d||a.id!==id||a.rarity!==d.rarity||typeof a.eventId!=='string'||a.eventId.length>100||!int(a.day)||a.day<1||!int(a.marks)||!int(a.wins)||!int(a.color)||a.color>=d.colors.length)return false;
  if(w.version===2&&(!Array.isArray(a.colors)||new Set(a.colors).size!==a.colors.length||!a.colors.includes(d.colors[a.color].id)||a.colors.some(c=>!d.colors.some(x=>x.id===c))))return false;
  if(id==='archipelago_lighthouse'&&(a.visits?.length!==5||!validLanVisits(a.visits)))return false;
  if(['cooperation_monument','cooperation_tree'].includes(id)&&(!Array.isArray(a.proof)||!validCooperationRows(a.proof)))return false;
 }
 if(w.displayed&&!w.owned[w.displayed])return false;
 if(Object.entries(w.receipts).some(([id,v])=>!/^[-\w:]{1,100}$/.test(id)||v!==true))return false;
 if(w.version===1)return true;
 if(w.pendingDisplays!==undefined&&(!object(w.pendingDisplays)||Object.entries(w.pendingDisplays).some(([id,p])=>!w.owned[id]||w.displays?.[id]||!int(p?.day)||p.day<1)))return false;
 if(![w.displays,w.exchanges,w.sources].every(object)||Object.entries(w.displays).some(([id,v])=>!w.owned[id]||v!==true)||!!w.displays.seashell_cup!==(w.displayed==='seashell_cup'))return false;
 for(const [id,a] of Object.entries(w.owned))if(a.colors?.some(c=>c!=='sea'&&!w.exchanges[id+':'+c]))return false;
 return Object.entries(w.exchanges).every(([key,e])=>key===e.wonderId+':'+e.color&&w.owned[e.wonderId]?.colors.includes(e.color)&&(e.marks===5||e.marks===0&&e.source==='legacy')&&int(e.day)&&e.day>0);
}
