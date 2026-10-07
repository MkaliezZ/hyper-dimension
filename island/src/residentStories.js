// Persistent resident episodes advance through completed conversations and real work receipts.
import {RAW_ROWS} from './catalog-data.js';
import {nextPresentationOperationId,validPresentationOperationId} from './resourceLedger.js';
import {RESIDENTS,BUILDINGS} from './world.js';
const OPEN=new Set(['scheduled','meeting','working']);
const KINDS=new Set(['conflict','cooperation','outing','friendship']);
const STATUS=new Set([...OPEN,'resolved','closed']);
const npc=id=>Number.isInteger(id)&&id>=0&&id<15;
const integer=x=>Number.isSafeInteger(x)&&x>=0;
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const pair=ids=>[...ids].sort((a,b)=>a-b).join('-');
const name=id=>RESIDENTS[id]?.name||'居民';
const clock=s=>(s.day-1)*900+(s.daySeconds||0);
const active=e=>OPEN.has(e.status);
export const STORY_LIMITS=Object.freeze({active:4,history:60,receipts:320,pairDays:3,graceDays:3});
export function hydrateResidentStories(s){
 s.residentStories??={version:1,episodes:[],receipts:{},lastPairDay:{}};
 return s.residentStories;
}
function memory(s,id,text,storyId){
 s.npcMemory??={};s.npcMemory[id]??=[];
 s.npcMemory[id].push({day:s.day,storyId,text});s.npcMemory[id]=s.npcMemory[id].slice(-16);
}
function entry(s,e,text,kind='event'){
 e.timeline.push({day:s.day,kind,text});e.timeline=e.timeline.slice(-20);e.version++;
}
function effect(s,e,delta,text){
 s.npcRelations??={};
 for(const [from,to] of [e.people,[...e.people].reverse()]){
  s.npcRelations[from]??={};
  const r=s.npcRelations[from][to]??={affinity:0,trust:0,affection:0,tension:0,interactions:0};
  for(const [key,value] of Object.entries(delta))r[key]=Math.max(key==='tension'?0:-100,Math.min(100,(r[key]||0)+value));
  r.lastEvent=text;r.label=r.tension>18?'心有芥蒂':r.affinity<-12?'关系紧张':r.affection>18&&r.trust>12?'心生好感':r.affinity>18?'亲近':r.trust>10?'信任':'相识';
  memory(s,from,text,e.id);
 }
}
function finish(s,e,status,text,delta={}){
 e.status=status;e.endedDay=s.day;e.inFlight={};entry(s,e,text,status);
 if(Object.keys(delta).length)effect(s,e,delta,text);else for(const id of e.people)memory(s,id,text,e.id);
}
export function advanceResidentStories(s){
 const book=hydrateResidentStories(s);let changed=false;
 for(const e of book.episodes)if(active(e)&&s.day>e.expiresDay&&!Object.keys(e.inFlight).length){
  finish(s,e,'closed','约定暂时搁置，保留已经完成的准备，双方先照顾自己的生活。');changed=true;
 }
 const closed=book.episodes.filter(e=>!active(e));
 if(closed.length>STORY_LIMITS.history){const keep=new Set(closed.slice(-STORY_LIMITS.history).map(e=>e.id));book.episodes=book.episodes.filter(e=>active(e)||keep.has(e.id));changed=true;}
 return changed;
}
export function restoreResidentStories(s){
 const book=hydrateResidentStories(s);
 for(const e of book.episodes)if(active(e)&&Object.keys(e.inFlight).length){
  e.inFlight={};e.status='scheduled';entry(s,e,'回到岛上后继续约定；已经入库的贡献保留，未完成动作重新安排。','resume');
 }
 advanceResidentStories(s);return book;
}
export function pendingResidentStory(s,a,b){
 return s.residentStories?.episodes.find(e=>active(e)&&e.people.includes(a)&&e.people.includes(b))||null;
}
const defaultPlan={goal:'forest',buildingId:null,resource:'wood'},sources=new Map(RAW_ROWS.map(r=>[r[0],r[3]]));
function legalPlan(plan){
 if(!plan)return false;const source=sources.get(plan.resource);
 return plan.goal==='forest'&&plan.buildingId===null&&source==='forest'||plan.goal==='mine'&&plan.buildingId===null&&source==='mine'||plan.goal==='dock'&&plan.buildingId===null&&['shore','fishing'].includes(source)||['building','workshop'].includes(plan.goal)&&plan.buildingId===14&&source==='greenhouse';
}
function add(s,row,plan){
 const b=hydrateResidentStories(s),people=[...row.participants],key=pair(people);
 if(b.episodes.filter(active).length>=STORY_LIMITS.active||pendingResidentStory(s,...people)||
  b.lastPairDay[key]!==undefined&&s.day-b.lastPairDay[key]<STORY_LIMITS.pairDays)return null;
 const rel=s.npcRelations?.[people[0]]?.[people[1]]||{},back=s.npcRelations?.[people[1]]?.[people[0]]||{};
 let kind;
 if(row.type==='dispute'||row.type==='reconcile'&&row.changes.some(c=>(c.tension||0)>0))kind='conflict';
 else if(row.type==='negotiate')kind='cooperation';
 else if(row.type==='confession')kind=row.changes.some(c=>c.from===people[1]&&(c.affection||0)>0)?'outing':'friendship';
 else if(row.type==='friendship'&&(rel.interactions||0)>=2&&(rel.trust||0)>=2&&(back.trust||0)>=2)kind='friendship';
 else return null;
 const titles={conflict:'把上次的分歧说清',cooperation:'拿着真实成果，再来谈合作',outing:'工作之外，也想了解你',friendship:'按彼此舒服的节奏相处'};
 const dueDay=s.day+(kind==='friendship'?2:1);
 const e={id:nextPresentationOperationId(s,'resident-story').replace(':','-'),version:1,kind,title:titles[kind],people,
  source:{id:row.id,day:s.day,type:row.type,summary:String(row.summary).slice(0,300),provider:row.source==='deepseek'?'deepseek':'local'},
  createdDay:s.day,dueDay,expiresDay:dueDay+STORY_LIMITS.graceDays,status:'scheduled',
  stage:kind==='cooperation'?'work':'talk',plan:{...(legalPlan(plan)?plan:defaultPlan)},venue:kind==='conflict'?22:kind==='outing'?5:7,
  contributions:{},inFlight:{},mediation:{},mediated:false,retryAt:0,attempts:0,timeline:[]};
 b.episodes.push(e);b.lastPairDay[key]=s.day;
 entry(s,e,kind==='cooperation'?'约定明天各完成一次实际备料，入库后核对成果。':'约定第 '+dueDay+' 天在'+BUILDINGS[e.venue].name+'继续聊；今天先完成自己的工作。','appointment');
 for(const id of people)memory(s,id,e.title+'：'+e.timeline.at(-1).text,e.id);
 return e;
}
export function recordResidentConversation(s,row,plan=null){
 const b=hydrateResidentStories(s);
 if(!row||typeof row.id!=='string'||!Array.isArray(row.participants)||row.participants.length!==2||!row.participants.every(npc)||row.participants[0]===row.participants[1]||
  !Array.isArray(row.changes)||!s.npcConversations?.some(c=>c.id===row.id&&c.day===row.day))return {ok:false};
 if(b.receipts[row.id])return {ok:true,replayed:true};
 b.receipts[row.id]=true;
 const keys=Object.keys(b.receipts);for(const key of keys.slice(0,Math.max(0,keys.length-STORY_LIMITS.receipts)))delete b.receipts[key];
 if(row.storyId){
  const e=b.episodes.find(e=>e.id===row.storyId),flight=e?.inFlight.meeting;
  if(!e||!active(e)||e.stage!=='talk'||flight?.operationId!==row.id||pair(e.people)!==pair(row.participants))return {ok:false};
  e.inFlight={};
  if(e.kind==='conflict'){
   const tension=row.changes.reduce((n,c)=>n+(c.tension||0),0),eased=row.changes.some(c=>(c.tension||0)<0)||e.mediated;
   e.attempts++;
   if(eased&&tension<=0){
    e.stage='work';e.status='scheduled';e.dueDay=s.day+1;e.expiresDay=e.dueDay+STORY_LIMITS.graceDays;
    entry(s,e,'当面谈清了分歧，约定明天分别完成备料，用行动重新建立信任。','agreement');
   }else if(e.attempts>=2)finish(s,e,'closed','两次谈话后仍未取得一致；尊重彼此界限，暂时各自工作。');
   else{e.status='scheduled';e.dueDay=s.day+1;e.expiresDay=e.dueDay+STORY_LIMITS.graceDays;entry(s,e,'这次仍有不同意见，留出一天空间后再谈。','boundary');}
  }else finish(s,e,'resolved',e.kind==='outing'?'两人如约见面，彼此的亲近有了新的共同经历。':'两人如约分享了近况，尊重彼此的节奏。',e.kind==='outing'?{trust:1,affection:1}:{affinity:1,trust:1});
  return {ok:true,episode:e};
 }
 const e=add(s,row,plan);return {ok:true,episode:e};
}
export function residentStoryOptions(s,id){
 const b=hydrateResidentStories(s),options=[];
 for(const e of b.episodes){
  if(!active(e)||!e.people.includes(id)||s.day<e.dueDay||s.day>e.expiresDay||clock(s)<e.retryAt)continue;
  const partnerId=e.people.find(x=>x!==id);
  if(e.stage==='talk'){
   if(Object.keys(e.inFlight).length)continue;
   const p=s.npcPresence?.find(p=>p.id===partnerId),need=s.npcNeeds?.[partnerId];
   if(p&&(p.meeting||p.assignment||p.partyControlled||p.recruitControlled)||need&&(need.energy<=30||need.hunger<=30))continue;
   options.push({goal:BUILDINGS[e.venue].kind,buildingId:e.venue,action:'social',activity:'social',duration:12,partnerId,
    socialType:e.kind==='conflict'?'reconcile':'friendship',storyId:e.id,purposeId:'story:'+e.id+':talk',score:84,
    reason:e.title+' · 履行第 '+e.dueDay+' 天的约定'});
  }else if(!e.contributions[id]&&!e.inFlight[id]){
   options.push({...e.plan,goal:e.plan.buildingId===14?BUILDINGS[14].kind:e.plan.goal,action:'work',activity:'station',duration:20,storyId:e.id,purposeId:'story:'+e.id+':work',
    score:78,reason:'与'+name(partnerId)+'约定互助：实际取得备料，入库后核对'});
  }
 }
 return options;
}
export function claimResidentStory(s,id,npcId,operationId,stage){
 const e=hydrateResidentStories(s).episodes.find(e=>e.id===id);
 if(!e||!active(e)||!e.people.includes(npcId)||e.stage!==stage||s.day<e.dueDay||s.day>e.expiresDay||clock(s)<e.retryAt)return false;
 if(stage==='talk'){if(Object.keys(e.inFlight).length)return false;e.inFlight.meeting={operationId};e.status='meeting';}
 else{if(e.contributions[npcId]||e.inFlight[npcId])return false;e.inFlight[npcId]={operationId};e.status='working';}
 e.version++;return true;
}
export function recordResidentStoryWork(s,id,npcId,operationId){
 const e=hydrateResidentStories(s).episodes.find(e=>e.id===id);
 if(!e||!active(e)||e.stage!=='work'||e.inFlight[npcId]?.operationId!==operationId)return {ok:false};
 delete e.inFlight[npcId];
 const r=s.taskActionReceipts?.[operationId],amount=r?.delta?.[e.plan.resource]||0;
 if(r?.npcId!==npcId||r.storyId!==id||r.day!==s.day||!Number.isSafeInteger(amount)||amount<1){
  e.status=Object.keys(e.inFlight).length?'working':'scheduled';e.retryAt=clock(s)+30;
  entry(s,e,name(npcId)+'尚未实际取得约定物资，保留准备并重新安排。','waiting');return {ok:false};
 }
 e.contributions[npcId]={operationId,day:s.day,amount};entry(s,e,name(npcId)+'实际入库 '+amount+' 份备料，等待同伴完成。','delivery');
 if(e.people.every(id=>e.contributions[id])){
  finish(s,e,'resolved',e.kind==='conflict'?'双方完成了约定的备料，合作成果缓和了分歧。':'两人都交出了真实备料，这次合作有了可信的结果。',
   e.kind==='conflict'?{affinity:2,trust:3,tension:-4}:{affinity:2,trust:3});
 }else e.status=Object.keys(e.inFlight).length?'working':'scheduled';
 return {ok:true,episode:e};
}
export function interruptResidentStory(s,id,operationId){
 const e=s.residentStories?.episodes.find(e=>e.id===id);if(!e||!active(e))return false;
 const keys=Object.keys(e.inFlight).filter(k=>e.inFlight[k].operationId===operationId);
 if(!keys.length)return false;for(const k of keys)delete e.inFlight[k];
 e.status=Object.keys(e.inFlight).length?(e.stage==='talk'?'meeting':'working'):'scheduled';e.retryAt=clock(s)+45;e.version++;return true;
}
export function mediateResidentStory(s,id,npcId,choice,{version}={}){
 const e=hydrateResidentStories(s).episodes.find(e=>e.id===id);
 if(!e||!active(e)||e.kind!=='conflict'||e.stage!=='talk'||!e.people.includes(npcId)||!['listen','space'].includes(choice))return {ok:false,reason:'这段分歧当前无需调解'};
 if(e.mediation[npcId])return {ok:true,replayed:true,text:e.mediation[npcId].text};
 if(e.version!==version||Object.keys(e.inFlight).length)return {ok:false,reason:'约定已经变化，请重新打开居民手账'};
 const text=choice==='listen'?'我希望先把各自的顾虑和备料分工说清；谢谢你愿意听完。':'谢谢你给我一点空间，我会先完成自己的工作，之后再谈。';
 e.mediation[npcId]={choice,day:s.day,text};entry(s,e,'岛主与'+name(npcId)+'谈了顾虑：'+(choice==='listen'?'愿意听完，再说清分工。':'尊重界限，给彼此一天空间。'),'player');
 memory(s,npcId,'岛主听取了我的顾虑：'+text,e.id);
 if(choice==='space'){e.dueDay=Math.max(e.dueDay,s.day+1);e.expiresDay=Math.max(e.expiresDay,e.dueDay+STORY_LIMITS.graceDays);}
 if(!e.mediated&&e.people.every(i=>e.mediation[i]?.choice==='listen')){
  e.mediated=true;effect(s,e,{trust:1,tension:-2},'岛主分别听取了双方顾虑，大家愿意带着明确分工再谈。');
 }
 return {ok:true,text,episode:e};
}
export function relationshipInvitation(s,id,participants){
 const e=s.residentStories?.episodes.find(e=>active(e)&&e.kind==='conflict'&&!e.mediated&&e.people.includes(id)&&e.people.every(i=>participants.includes(i))&&s.day<=e.expiresDay);
 return e?{ready:false,storyId:e.id,reason:name(id)+'想先与'+name(e.people.find(i=>i!==id))+'把分歧说清。可在两人的「邻里手账」分别听取顾虑，或等他们完成约定。'}:{ready:true};
}
export function residentStoryView(s,id){
 advanceResidentStories(s);
 return hydrateResidentStories(s).episodes.filter(e=>e.people.includes(id)).map(e=>({...structuredClone(e),partnerId:e.people.find(i=>i!==id),
  active:active(e),canMediate:active(e)&&e.kind==='conflict'&&e.stage==='talk'&&!e.mediation[id]&&!Object.keys(e.inFlight).length,
  progress:e.stage==='work'?e.people.filter(i=>e.contributions[i]).length:0})).reverse();
}
export function validResidentStories(s){
 const b=s.residentStories;if(b===undefined)return true;
 if(!object(b)||b.version!==1||!Array.isArray(b.episodes)||b.episodes.length>STORY_LIMITS.history+STORY_LIMITS.active||
  !object(b.receipts)||Object.keys(b.receipts).length>STORY_LIMITS.receipts||!object(b.lastPairDay)||
  b.episodes.filter(active).length>STORY_LIMITS.active||new Set(b.episodes.map(e=>e.id)).size!==b.episodes.length)return false;
 if(Object.entries(b.receipts).some(([id,v])=>!validPresentationOperationId(id,'npc-talk')||v!==true)||
  Object.entries(b.lastPairDay).some(([key,day])=>!/^\d{1,2}-\d{1,2}$/.test(key)||!integer(day)||day<1||day>s.day))return false;
 const openPairs=new Set();
 for(const e of b.episodes){
  if(!object(e)||!validPresentationOperationId(e.id?.replace(/^resident-story-/,'resident-story:'),'resident-story')||!integer(e.version)||e.version<1||!KINDS.has(e.kind)||!STATUS.has(e.status)||
   !['talk','work'].includes(e.stage)||!Array.isArray(e.people)||e.people.length!==2||!e.people.every(npc)||e.people[0]===e.people[1]||
   ![e.createdDay,e.dueDay,e.expiresDay].every(integer)||e.createdDay<1||e.createdDay>s.day||e.dueDay<e.createdDay||e.expiresDay<e.dueDay||
   !legalPlan(e.plan)||!Number.isInteger(e.venue)||e.venue<0||e.venue>24||typeof e.title!=='string'||e.title.length>100||
   !object(e.source)||!validPresentationOperationId(e.source.id,'npc-talk')||e.source.day!==e.createdDay||typeof e.source.summary!=='string'||e.source.summary.length>300||
   !object(e.contributions)||!object(e.inFlight)||!object(e.mediation)||typeof e.mediated!=='boolean'||!Number.isFinite(e.retryAt)||e.retryAt<0||
   !integer(e.attempts)||e.attempts>2||!Array.isArray(e.timeline)||e.timeline.length>20)return false;
  if(active(e)){const key=pair(e.people);if(openPairs.has(key))return false;openPairs.add(key);}
  if(e.timeline.some(t=>!integer(t.day)||t.day<e.createdDay||t.day>s.day||typeof t.text!=='string'||t.text.length>500))return false;
  for(const [id,c] of Object.entries(e.contributions)){
   const r=s.taskActionReceipts?.[c?.operationId];if(!e.people.includes(Number(id))||!integer(c?.amount)||!c.amount||!integer(c.day)||c.day<e.dueDay||c.day>s.day||
    r?.npcId!==Number(id)||r.storyId!==e.id||r.day!==c.day||r.delta?.[e.plan.resource]!==c.amount)return false;
  }
  for(const [id,f] of Object.entries(e.inFlight))if(id!=='meeting'&&!e.people.includes(Number(id))||typeof f?.operationId!=='string'||
   !validPresentationOperationId(f.operationId,id==='meeting'?'npc-talk':'story-work'))return false;
  if(e.stage==='talk'&&Object.keys(e.contributions).length||e.stage==='work'&&e.inFlight.meeting||
   e.status==='meeting'&&(!e.inFlight.meeting||e.stage!=='talk')||e.status==='working'&&(!Object.keys(e.inFlight).length||e.stage!=='work')||
   e.status==='scheduled'&&Object.keys(e.inFlight).length||!active(e)&&Object.keys(e.inFlight).length)return false;
  if(!active(e)&&(!integer(e.endedDay)||e.endedDay<e.createdDay||e.endedDay>s.day))return false;
  if(e.status==='resolved'&&e.stage==='work'&&!e.people.every(i=>e.contributions[i]))return false;
  for(const [id,m] of Object.entries(e.mediation))if(!e.people.includes(Number(id))||!['listen','space'].includes(m?.choice)||!integer(m.day)||m.day<e.createdDay||m.day>s.day||typeof m.text!=='string'||m.text.length>300)return false;
  if(e.mediated&&!e.people.every(i=>e.mediation[i]?.choice==='listen'))return false;
 }
 return true;
}
