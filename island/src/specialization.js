import {ALL_RECIPES,RAW_MATERIALS,recipeGate} from './contentCatalog.js';
import {CROPS} from './farming.js';
import {availableQuantity} from './resourceLedger.js';
import {confirmedHostedEvents} from './hostedProgress.js';
// Personal progression uses player provenance. NPC output and current stock are not progress.
export const SPECIALIZATIONS=[
 {id:'garden',name:'田园主理',tagline:'让每一季都有新的颜色',building:14,buildings:[3,10,14],color:'#7eaa83',titles:['田园新芽','四季园丁','花园营造师','丰收主理人','四季花园大师']},
 {id:'artisan',name:'匠心工坊',tagline:'把手艺做成小岛的招牌',building:0,buildings:[0,4,7,13,15,18,23,24],color:'#c99766',titles:['手作学徒','海岛匠人','匠心设计师','百工主理人','晨光工艺大师']},
 {id:'host',name:'海岛庆典',tagline:'让一次相聚成为共同的记忆',building:21,buildings:[1,2,5,6,8,9,11,12,16,17,19,20,21,22],color:'#bb91ab',titles:['相聚发起人','海风东道主','庆典策划师','群星主理人','海岛庆典大师']}
];
const paths=Object.assign(Object.create(null),Object.fromEntries(SPECIALIZATIONS.map(p=>[p.id,p]))),recipes=Object.assign(Object.create(null),Object.fromEntries(ALL_RECIPES.map(r=>[r.item,r]))),raw=Object.assign(Object.create(null),Object.fromEntries(RAW_MATERIALS.map(r=>[r.id,r])));
const integer=n=>Number.isSafeInteger(n)&&n>=0,object=x=>x&&typeof x==='object'&&!Array.isArray(x),positive=n=>integer(n)&&n>0;
const amount=n=>integer(n)?n:0,belongs=(id,path)=>paths[path].buildings.includes(recipes[id]?.building);
const keys=x=>Object.keys(x||{}),validDay=(n,s)=>positive(n)&&n<=s.day;
export function specializationUnlocked(s){
 return confirmedHostedEvents(s).length>0;
}
export function hydrateSpecialization(s){
 if(!s.specialization){
  const wheat=amount(s.journey?.stats?.harvested);
  s.specialization={version:1,selected:null,selectedDay:0,selectionHistory:[],harvested:wheat?{wheat}: {},quality:{},days:Object.fromEntries(SPECIALIZATIONS.map(p=>[p.id,[]])),awards:{},commission:null,history:[],deliveries:{garden:0,artisan:0,host:0}};
 }
 const b=s.specialization,c=b.commission;
 if(c&&c.day<s.day){b.history.push({...c,status:c.status==='delivered'?'delivered':'expired'});b.history=b.history.slice(-60);b.commission=null;}
 return b;
}
export function specializationMetrics(s,path){
 const b=s.specialization||hydrateSpecialization(s),personal=s.achievementBook?.crafted||{},designs=keys(personal).filter(id=>personal[id]&&belongs(id,path));
 const hosts=confirmedHostedEvents(s);
 return {designs:designs.length,workshops:new Set(designs.map(id=>recipes[id].building)).size,quality:Math.max(0,...keys(b.quality).filter(id=>belongs(id,path)).map(id=>b.quality[id].value)),
  harvest:Object.values(b.harvested).reduce((n,v)=>n+v,0),species:keys(b.harvested).filter(id=>b.harvested[id]>0).length,
  hosts:hosts.length,templates:new Set(hosts.map(([,r])=>r.template)).size,days:b.days[path].length,commissions:b.deliveries[path]};
}
export function specializationGoals(path,rank,definitionVersion=2){
 const i=rank-1;if(!paths[path]||!Number.isInteger(rank)||rank<1||rank>5)return [];
 const shared=[{key:'days',name:'亲手经营的游戏日',target:[2,3,5,8,12][i]}];
 if(path==='garden')return [{key:'harvest',name:'亲手采收份数',target:[6,18,40,80,160][i]},{key:'species',name:'亲手种收的作物种类',target:[2,3,4,5,7][i]},{key:'designs',name:'花艺 / 温室 / 诊所手作种类',target:[1,3,6,12,24][i]},...shared];
 if(path==='artisan')return [{key:'designs',name:'工艺手作种类',target:[4,10,20,40,64][i]},{key:'workshops',name:'留下亲手作品的工坊',target:[2,3,5,7,8][i]},{key:'quality',name:'亲手作品最高品质',target:[50,60,70,80,90][i]},...shared];
 return [{key:'hosts',name:'实际完成的派对',target:[1,2,4,7,12][i]},{key:'templates',name:'承办派对种类',target:(definitionVersion===1?[1,2,2,2,2]:[1,2,3,4,5])[i]},{key:'designs',name:'庆典相关手作种类',target:[3,6,12,24,40][i]},{key:'commissions',name:'亲手交付庆典委托',target:[0,1,2,4,6][i]},...shared];
}
export function specializationRank(s,path){return [1,2,3,4,5].filter(rank=>[1,2].some(version=>s.specialization?.awards[path+'_'+rank+'@'+version])).length;}
export function specializationView(s){
 const b=hydrateSpecialization(s),unlocked=specializationUnlocked(s);
 return {unlocked,selected:b.selected,paths:SPECIALIZATIONS.map(p=>{
  const rank=specializationRank(s,p.id),metrics=specializationMetrics(s,p.id),goals=specializationGoals(p.id,rank+1).map(g=>({...g,value:metrics[g.key]}));
  return {...p,rank,title:rank?p.titles[rank-1]:'选择你的经营方向',metrics,goals,ready:unlocked&&rank<5&&goals.every(g=>g.value>=g.target)};
 }),commission:b.commission};
}
export function chooseSpecialization(s,path){
 const b=hydrateSpecialization(s);if(!paths[path]||!specializationUnlocked(s))return {ok:false,reason:'完成并结算第一场派对后，开启经营专精。'};
 if(b.selected===path)return {ok:true,replayed:true};
 if(b.selected&&b.selectedDay===s.day)return {ok:false,reason:'今天已经选定方向，下一游戏日可以调整；已有成果都会保留。'};
 b.selected=path;b.selectedDay=s.day;b.selectionHistory.push({day:s.day,path});b.selectionHistory=b.selectionHistory.slice(-20);
 return {ok:true};
}
export function trackSpecialization(s,event,data={}){
 const b=hydrateSpecialization(s),touched=new Set();
 if(event==='harvest'&&Object.hasOwn(CROPS,data.item)&&positive(data.amount)){b.harvested[data.item]=(b.harvested[data.item]||0)+data.amount;touched.add('garden');}
 if(event==='gather'&&raw[data.item]?.source==='greenhouse'&&positive(data.amount))touched.add('garden');
 if(event==='craft'&&recipes[data.item]){
  const p=SPECIALIZATIONS.find(p=>belongs(data.item,p.id));
  const r=s.resourceLedger?.receipts?.[data.commandId];
  if(/^player:craft:[1-9]\d*:result$/.test(data.commandId||'')&&r?.category==='craft'&&r.delta[data.item]===1&&Number.isFinite(data.quality)&&data.quality>=0&&data.quality<=100){
   if(r.actor===-1&&Number.isFinite(r.playerQuality)&&r.playerQuality!==data.quality)return specializationView(s);
   if(p)touched.add(p.id);r.playerQuality=data.quality;r.actor=-1;
   if(!b.quality[data.item]||b.quality[data.item].value<data.quality)b.quality[data.item]={value:data.quality,command:data.commandId};
   const c=b.commission;if(c?.status==='accepted'&&c.day===s.day&&c.item===data.item&&data.quality>=c.quality&&r.day===c.day&&Number(data.commandId.split(':')[2])>c.acceptedSequence)c.production??={command:data.commandId,day:s.day,quality:data.quality};
  }
 }
 if(event==='order'&&recipes[data.item]&&s.economy?.cashReceipts?.[data.receipt]&&s.resourceLedger?.receipts?.['cash:'+data.receipt]?.category==='order'){const p=SPECIALIZATIONS.find(p=>belongs(data.item,p.id));if(p)touched.add(p.id);}
 if(event==='party'&&specializationUnlocked(s))touched.add('host');
 for(const p of touched)if(!b.days[p].includes(s.day)&&b.days[p].length<128)b.days[p].push(s.day);
 return specializationView(s);
}
export function specializationMoment(s,path){
 const p=specializationView(s).paths.find(p=>p.id===path);if(!p?.ready)return null;
 return {id:'career:'+path+':'+(p.rank+1),path,rank:p.rank+1,title:p.titles[p.rank],eyebrow:'第二章 / '+p.name,description:p.tagline,reward:'永久称号 · '+p.titles[p.rank]+' / 经营徽记 '+(p.rank+1)+' 阶',
  chapters:['亲手完成的小事，在这里连成了路。','一座岛，开始有了你的经营风格。','新的称号，与下一段旅程一起留下。'],
  quote:'赫尔墨斯：这些成果都有你的手艺。明天继续，把这个方向做成海岛的招牌。'};
}
export function claimSpecialization(s,path,rank){
 const m=specializationMoment(s,path),b=hydrateSpecialization(s);if(!m||m.rank!==rank)return {ok:false,reason:'条件还未达成，或这枚徽记已经收下。'};
 const metrics=specializationMetrics(s,path);
 b.awards[path+'_'+rank+'@2']={path,rank,definitionVersion:2,title:m.title,day:s.day,metrics,goals:structuredClone(specializationGoals(path,rank))};
 s.events??=[];s.events.unshift('经营专精 · '+m.title+'：永久称号与地图徽记已经留下。');s.events=s.events.slice(0,7);
 return {ok:true,...m};
}
const hash=text=>{let value=2166136261;for(const ch of text)value=Math.imul(value^ch.charCodeAt(0),16777619)>>>0;return value;};
export function specializationOffer(s,path=s.specialization?.selected){
 const b=hydrateSpecialization(s);if(!paths[path]||!specializationUnlocked(s)||b.commission)return null;
 const rank=specializationRank(s,path),pool=ALL_RECIPES.filter(r=>belongs(r.item,path)&&r.tier<=Math.min(2,Math.floor(rank/2))&&recipeGate(r,s).ready);
 if(!pool.length)return null;
 const r=pool[hash((s.saveSlot||'晨光')+':'+s.day+':'+path+':'+rank)%pool.length],reward=r.price,cost=Math.ceil(reward*.3);
 return {id:'career-order-'+s.day,path,day:s.day,rank,recipe:r.id,item:r.item,quantity:1,quality:40+rank*8,reward,cost,net:reward-cost,status:'accepted',production:null};
}
export function acceptSpecializationCommission(s,offerId,item){
 const b=hydrateSpecialization(s);if(b.commission)return {ok:false,reason:'今天的专精委托已经确定，下一游戏日会有新的委托。'};
 const offer=specializationOffer(s);if(!offer||offer.id!==offerId||offer.item!==item)return {ok:false,reason:'委托内容已有变化，请查看当前方向。'};
 offer.acceptedSequence=s.resourceLedger?.sequence||0;b.commission=offer;return {ok:true,commission:offer};
}
export function specializationDelivery(s){
 const b=hydrateSpecialization(s),c=b.commission;if(!c||c.status!=='accepted'||c.day!==s.day)return {ok:false,reason:'今天没有待交付的专精委托。'};
 if(!c.production)return {ok:false,reason:'接单后亲手制作对应作品，达到品质 '+c.quality+'，再带来交付。'};
 if(availableQuantity(s,c.item)<1||(s.economy?.playerGoods?.[c.item]||0)<1)return {ok:false,reason:'作品已使用、交付或留给其他计划，请再准备一件。'};
 return {ok:true,commission:c};
}
export function recordSpecializationDelivery(s){
 const b=hydrateSpecialization(s),c=b.commission,r=s.resourceLedger?.receipts?.['cash:'+c?.id];
 if(!c||c.status!=='accepted'||c.day!==s.day||!s.economy?.cashReceipts?.[c.id]||r?.category!=='career_order'||r.delta[c.item]!==-1||r.delta.coins!==c.net)return false;
 r.specializationPath=c.path;r.rank=c.rank;r.acceptedSequence=c.acceptedSequence;r.production=structuredClone(c.production);c.status='delivered';b.deliveries[c.path]++;if(!b.days[c.path].includes(s.day)&&b.days[c.path].length<128)b.days[c.path].push(s.day);return c;
}
export function specializationBrief(s){
 const v=specializationView(s),p=v.paths.find(p=>p.id===v.selected),c=v.commission;
 return {unlocked:v.unlocked,path:p?.id||null,name:p?.name||null,rank:p?.rank||0,next:p?.goals.filter(g=>g.value<g.target).slice(0,2).map(g=>g.name+' '+g.value+'/'+g.target)||[],commission:c?{item:c.item,quality:c.quality,status:c.status,day:c.day}:null};
}
export function validSpecialization(s){
 const b=s.specialization;if(b===undefined)return true;
 if(!object(b)||b.version!==1||!(b.selected===null||paths[b.selected])||!integer(b.selectedDay)||b.selectedDay>s.day||!Array.isArray(b.selectionHistory)||b.selectionHistory.length>20||!b.selectionHistory.every(r=>validDay(r.day,s)&&paths[r.path])||![b.harvested,b.quality,b.days,b.awards,b.deliveries].every(object)||!Array.isArray(b.history)||b.history.length>60)return false;
 if(!Object.entries(b.harvested).every(([id,n])=>Object.hasOwn(CROPS,id)&&integer(n)))return false;
 if(!Object.entries(b.quality).every(([id,q])=>recipes[id]&&Number.isFinite(q.value)&&q.value>=0&&q.value<=100&&/^player:craft:[1-9]\d*:result$/.test(q.command)&&s.resourceLedger?.receipts?.[q.command]?.delta[id]===1&&s.resourceLedger.receipts[q.command].actor===-1&&s.resourceLedger.receipts[q.command].playerQuality===q.value))return false;
 if(!SPECIALIZATIONS.every(p=>Array.isArray(b.days[p.id])&&b.days[p.id].length<=128&&new Set(b.days[p.id]).size===b.days[p.id].length&&b.days[p.id].every(d=>validDay(d,s))&&integer(b.deliveries[p.id])))return false;
 const ranks=new Set();
 for(const [key,a] of Object.entries(b.awards)){
  if(!paths[a?.path]||!Number.isInteger(a.rank)||a.rank<1||a.rank>5||![1,2].includes(a.definitionVersion)||key!==a.path+'_'+a.rank+'@'+a.definitionVersion||a.title!==paths[a.path].titles[a.rank-1]||!validDay(a.day,s)||!object(a.metrics)||JSON.stringify(a.goals)!==JSON.stringify(specializationGoals(a.path,a.rank,a.definitionVersion))||!a.goals.every(g=>Number.isFinite(a.metrics[g.key])&&a.metrics[g.key]>=g.target&&a.metrics[g.key]<=specializationMetrics(s,a.path)[g.key])||a.rank>1&&![1,2].some(v=>b.awards[a.path+'_'+(a.rank-1)+'@'+v])||ranks.has(a.path+'_'+a.rank))return false;
  ranks.add(a.path+'_'+a.rank);
 }
 const commission=(c,current)=>{
  const r=recipes[c?.item];
  if(!c||!r||!paths[c.path]||!belongs(c.item,c.path)||c.recipe!==r.id||!validDay(c.day,s)||!integer(c.acceptedSequence)||c.acceptedSequence>(s.resourceLedger?.sequence||0)||c.id!=='career-order-'+c.day||!integer(c.rank)||c.rank>5||c.quantity!==1||c.quality!==40+c.rank*8||c.reward!==r.price||c.cost!==Math.ceil(c.reward*.3)||c.net!==c.reward-c.cost||!['accepted','delivered','expired'].includes(c.status)||current&&c.status==='expired')return false;
  if(c.production){const p=c.production,a=s.resourceLedger?.receipts?.[p.command];if(!validDay(p.day,s)||p.day!==c.day||!Number.isFinite(p.quality)||p.quality<c.quality||p.quality>100||!/^player:craft:[1-9]\d*:result$/.test(p.command)||Number(p.command.split(':')[2])<=c.acceptedSequence||a?.day!==c.day||a?.actor!==-1||a.playerQuality!==p.quality||a.delta[c.item]!==1)return false;}
  if(c.status==='delivered'){const a=s.resourceLedger?.receipts?.['cash:'+c.id];if(!c.production||!s.economy?.cashReceipts?.[c.id]||a?.category!=='career_order'||a.delta[c.item]!==-1||a.delta.coins!==c.net)return false;}
  return true;
 };
 const all=[...b.history,...(b.commission?[b.commission]:[])];
 const paid=Object.entries(s.resourceLedger?.receipts||{}).filter(([,r])=>r.category==='career_order');
 for(const [id,r] of paid){const item=keys(r.delta).find(k=>k!=='coins'),p=r.specializationPath;const proof=s.resourceLedger?.receipts?.[r.production?.command];if(!paths[p]||!integer(r.rank)||r.rank>5||!integer(r.acceptedSequence)||Number(r.production?.command?.split(':')[2])<=r.acceptedSequence||proof?.category!=='craft'||proof.day!==r.day||proof.actor!==-1||proof.playerQuality!==r.production.quality||proof.playerQuality<40+r.rank*8||proof.delta[item]!==1||!belongs(item,p)||r.delta[item]!==-1||r.delta.coins!==recipes[item].price-Math.ceil(recipes[item].price*.3)||!s.economy?.cashReceipts?.[id.slice(5)]||!/^cash:career-order-[1-9]\d*$/.test(id))return false;}
 if(!SPECIALIZATIONS.every(p=>b.deliveries[p.id]===paid.filter(([,r])=>r.specializationPath===p.id).length))return false;
 if(b.selected?(b.selectedDay<1||b.selectionHistory.at(-1)?.path!==b.selected||b.selectionHistory.at(-1)?.day!==b.selectedDay):(b.selectedDay!==0||b.selectionHistory.length))return false;
 return (!b.commission||commission(b.commission,true))&&b.history.every(c=>commission(c,false)&&c.status!=='accepted')&&new Set(all.map(c=>c.id)).size===all.length;
}
