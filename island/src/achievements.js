import {validCooperationRows} from './cooperationEvidence.js';
import {RAW_IDS_V1,RECIPE_IDS_V1} from './achievementUniverse.js';
import {ALL_RECIPES,recipeGate} from './contentCatalog.js';
import {confirmedHostedEvents} from './hostedProgress.js';
const raw=new Set(RAW_IDS_V1),recipes=new Set(RECIPE_IDS_V1),integer=n=>Number.isSafeInteger(n)&&n>=0;
const rows=(family,values,names,rarities,icon)=>values.map((goal,i)=>({id:family+'_'+goal,version:1,family,goal,name:names[i],rarity:rarities[i],icon}));
export const ACHIEVEMENTS=[
 ...rows('collect',[10,25,50],['拾起海岛的颜色','沿着六条采集路线','海岛素材全图鉴'],['N','R','SR'],'wood'),
 ...rows('craft',[10,50,150,300],['十份亲手的手艺','五十种生活灵感','百馆手艺的旅程','全岛手艺大师'],['N','R','SSR','UR'],'c0_7'),
 ...rows('unlock',[200,300],['进阶图纸收藏家','全部图纸已点亮'],['SR','UR'],'c7_5'),
 ...rows('host',[1,5,10],['第一次让大家相聚','五次共同的记忆','海岛庆典主理人'],['N','R','SR'],'c8_2'),
 ...rows('template',[2,3,5],['两种不同的相聚','三种相聚的灵感','五场庆典的导演'],['R','SR','SSR'],'firework'),
 ...rows('cooperate',[1,5,10],['同心启航','协作成为习惯','十场真实的分工'],['R','SR','SSR'],'c23_0')
];
export function hydrateAchievements(s){
 if(!s.achievementBook){
  const t=s.journey?.stats||{},collected={},crafted={};
  for(const [id,n] of Object.entries(t.gathered||{}))if(raw.has(id)&&n>0)collected[id]=true;
  if(t.harvested>0)collected.wheat=true;
  for(const [id,n] of Object.entries(t.crafted||{}))if(recipes.has(id)&&n>0)crafted[id]=true;
  const hosted={};for(const [id,ok] of Object.entries(s.economy?.cashReceipts||{}))if(ok&&/^party-\d+-\d+$/.test(id))hosted[id]={template:'night',day:s.day,legacy:true};
  s.achievementBook={version:1,collected,crafted,hosted,cooperated:{},awards:{},unseen:[]};
 }
 return s.achievementBook;
}
export function achievementMetrics(s){
 const b=hydrateAchievements(s),hosted=confirmedHostedEvents(s),ids=new Set(hosted.map(([id])=>id));
 return {collect:RAW_IDS_V1.filter(id=>b.collected[id]).length,craft:RECIPE_IDS_V1.filter(id=>b.crafted[id]).length,unlock:ALL_RECIPES.filter(r=>recipes.has(r.item)&&recipeGate(r,s).ready).length,host:hosted.length,template:new Set(hosted.map(([,x])=>x.template)).size,cooperate:Object.entries(b.cooperated).filter(([id,row])=>ids.has(id)&&validCooperationRows(row.proof)).length};
}
export function refreshAchievements(s,definitions=ACHIEVEMENTS){
 const b=hydrateAchievements(s),metrics=achievementMetrics(s),added=[];
 for(const d of definitions){const key=d.id+'@'+d.version;if(metrics[d.family]>=d.goal&&!b.awards[key]){
  b.awards[key]={id:d.id,definitionVersion:d.version,name:d.name,rarity:d.rarity,day:s.day,goal:d.goal,achieved:metrics[d.family],universeVersion:1,source:d.family};
  if(!b.unseen.includes(key))b.unseen.push(key);added.push(key);
 }}
 return {book:b,metrics,added};
}
export function trackPlayerAchievement(s,event,data={}){
 const b=hydrateAchievements(s);
 if(['gather','harvest'].includes(event)&&raw.has(data.item)&&Number.isSafeInteger(data.amount)&&data.amount>0)b.collected[data.item]=true;
 if(event==='craft'&&recipes.has(data.item))b.crafted[data.item]=true;
 return refreshAchievements(s);
}
export function trackHostedAchievement(s,{id,template,day},cooperation=[]){
 const b=hydrateAchievements(s);if(!/^[-\w:]{1,100}$/.test(id)||!['fishing','night','market','couture','fireworks'].includes(template)||!integer(day)||day<1)return [];
 b.hosted[id]??={template,day};
 if(cooperation.length)b.cooperated[id]??={day,proof:structuredClone(cooperation)};
 return refreshAchievements(s).added;
}
export function acknowledgeAchievements(s){hydrateAchievements(s).unseen=[];}
export function validAchievements(s){
 const b=s.achievementBook;if(b===undefined)return true;
 const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(!b||b.version!==1||![b.collected,b.crafted,b.hosted,b.cooperated,b.awards].every(object)||!Array.isArray(b.unseen)||b.unseen.length>100||new Set(b.unseen).size!==b.unseen.length)return false;
 if(!Object.entries(b.collected).every(([id,v])=>raw.has(id)&&v===true)||!Object.entries(b.crafted).every(([id,v])=>recipes.has(id)&&v===true))return false;
 if(!Object.entries(b.hosted).every(([id,v])=>/^[-\w:]{1,100}$/.test(id)&&['fishing','night','market','couture','fireworks'].includes(v.template)&&integer(v.day)&&v.day>0))return false;
 if(!Object.entries(b.cooperated).every(([id,v])=>b.hosted[id]&&integer(v.day)&&v.day>0&&validCooperationRows(v.proof)))return false;
 return Object.entries(b.awards).every(([key,a])=>a&&key===a.id+'@'+a.definitionVersion&&/^[-\w]{1,80}$/.test(a.id)&&integer(a.definitionVersion)&&a.definitionVersion>0&&typeof a.name==='string'&&a.name.length<=80&&['N','R','SR','SSR','UR'].includes(a.rarity)&&integer(a.day)&&a.day>0&&integer(a.goal)&&integer(a.achieved)&&a.achieved>=a.goal)&&b.unseen.every(key=>!!b.awards[key]);
}
