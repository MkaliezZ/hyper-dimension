import {captureCooperation,validCooperationSnapshot} from './cooperationEvidence.js';
import {awardFireworksWonder} from './eventWonders.js';
import {eventRequests,eventCost,partyInputSignature,partyDraftStamp,validatePartyProposal,PARTY_TAGS,THEME_GUESTS,FIREWORKS_INVITES} from './partyPlanning.js';
import {FIREWORKS_EQUIPMENT,createFireworksGame,fireworksSummary,validFireworksGame} from './fireworksRules.js';
import {availableQuantity,reserveResources,releaseResources,commitResources,nextOperationId} from './resourceLedger.js';
import {createProject,syncProjects,controlProject} from './projectPlans.js';
import {relationshipInvitation} from './residentStories.js';
import {transact} from './economy.js';
import {trackJourney} from './journey.js';
import {createFestivalLayout,validFestivalLayout} from './festivalLayout.js';
import {validStewardPartyMetadata,validStewardPartyReceipts} from './partyReceipts.js';
const copy=structuredClone;
export const fireworksOwner=id=>'fireworks:'+id;
export function hydrateFireworks(s){return s.fireworksParty??={version:1,draft:null,session:null,history:[]};}
export function fireworksSnapshot(s){const f=copy(hydrateFireworks(s));delete f.composer;return f;}
export function createFireworksEvent(s,input={}){
 const f=hydrateFireworks(s);if(f.draft||f.session)return{ok:false,reason:'先完成或收起当前烟花大会'};
 const r=validatePartyProposal(s,{name:'海岛烟花大会',...input,template:'fireworks'});if(!r.ok)return r;
 f.draft={id:nextOperationId(s,'fireworks').replace(':','-'),...r.proposal,version:1,createdDay:s.day,invites:{},inviteGifts:{},revisions:[],projectId:null,projectIds:[],source:'player',runId:null,proposalId:null};return{ok:true,event:f.draft};
}
export function updateFireworksEvent(s,input){
 const d=hydrateFireworks(s).draft;if(!d)return{ok:false,reason:'没有待修改的烟花大会'};const r=validatePartyProposal(s,{...input,template:'fireworks'});if(!r.ok)return r;
 const change=partyInputSignature(d)!==partyInputSignature(r.proposal),before=partyDraftStamp(d);
 if(change){if(d.version>=100000)return{ok:false,reason:'请取消当前方案后重新发布'};if(d.projectId&&s.workProjects?.some(p=>p.id===d.projectId&&['preparing','paused','ready'].includes(p.status)))controlProject(s,d.projectId,'cancel');d.version++;d.invites={};d.projectId=null;d.revisions.push({version:d.version,day:s.day,before});d.revisions=d.revisions.slice(-20);}
 Object.assign(d,r.proposal,{source:'player',runId:null,proposalId:null});return{ok:true,event:d,reinvite:change};
}
export function fireworksNeeds(s){
 const d=hydrateFireworks(s).draft;if(!d)return null;const cost={...eventCost(d),...FIREWORKS_EQUIPMENT};
 for(const r of eventRequests(d))if((d.inviteGifts[r.id]?.delivered?.[r.item]||0)<r.quantity)cost[r.item]=(cost[r.item]||0)+r.quantity;
 const owner=d.projectId?'project:'+d.projectId:fireworksOwner(d.id);return{cost,missing:Object.fromEntries(Object.entries(cost).map(([id,n])=>[id,Math.max(0,n-availableQuantity(s,id,owner))]).filter(([,n])=>n))};
}
function releasePlan(s,d){if(!d.projectId)return;syncProjects(s,{server:true});const p=s.workProjects?.find(p=>p.id===d.projectId);if(p?.status==='ready')controlProject(s,p.id,'finish');}
export function createFireworksPlan(s){
 const d=hydrateFireworks(s).draft;if(!d)return{ok:false,reason:'先发布烟花大会'};const p=s.workProjects?.find(p=>p.id===d.projectId);if(p&&['preparing','paused','ready'].includes(p.status))return{ok:true,replayed:true,project:p};
 const targets={...fireworksNeeds(s).cost};delete targets.coins;const r=createProject(s,{id:nextOperationId(s,'fireworks-supplies').replace(':','-'),title:d.name+' · 烟花与风位筹备',targets,source:d.source==='hermes'?'hermes':'player',runId:d.runId||null});if(r.ok){d.projectId=r.project.id;d.projectIds=[...new Set([...d.projectIds,r.project.id])].slice(-40);}return r;
}
export function inviteFireworksNpc(s,id){
 const d=hydrateFireworks(s).draft,r=d&&eventRequests(d).find(r=>r.id===id);if(!r)return{ok:false,reason:'这位居民不在本场名单'};if(d.invites[id]?.version===d.version)return{ok:true,replayed:true};
 const willing=relationshipInvitation(s,id,eventRequests(d).map(r=>r.id));if(!willing.ready)return{ok:false,reason:willing.reason};releasePlan(s,d);const prior=d.inviteGifts[id],delivered=(prior?.delivered?.[r.item]||0)>=r.quantity;
 if(!delivered){const paid=commitResources(s,{id:'fireworks-gift:'+d.id+':'+id+':'+r.item,cost:{[r.item]:r.quantity},category:'party_invite',note:d.name+' · 协作与演出邀请'});if(!paid.ok)return{ok:false,reason:'约好的赠物未备齐或已预留'};d.inviteGifts[id]={delivered:{...(prior?.delivered||{}),[r.item]:r.quantity},day:s.day,affinityGranted:true};if(!prior?.affinityGranted){s.npcAffinity??={};s.npcAffinity[id]=Math.min(100,(s.npcAffinity[id]??20)+1);}}
 d.invites[id]={version:d.version,day:s.day};s.npcMemory??={};s.npcMemory[id]??=[];s.npcMemory[id].push({day:s.day,eventId:d.id,text:'我同意在'+d.name+'担任'+r.role+'，烟花演出和赴约按本版约定。'});s.npcMemory[id]=s.npcMemory[id].slice(-16);trackJourney(s,'invite');return{ok:true,npcId:id,version:d.version,reconfirmed:delivered};
}
export function fireworksReadiness(s){
 const d=hydrateFireworks(s).draft;if(!d)return{ready:false,reason:'先发布星海烟花大会'};
 if(s.partySession||['checkin','running'].includes(s.fishingParty?.session?.phase)||s.festivalParty?.session?.phase==='running'||s.coutureParty?.session?.phase==='running'||hydrateFireworks(s).session)return{ready:false,reason:'先结束正在进行的活动'};if(s.lastPartyDay===s.day)return{ready:false,reason:'今天的承办机会已使用'};
 const people=eventRequests(d);if(people.some(r=>d.invites[r.id]?.version!==d.version))return{ready:false,reason:'亲自赠物，取得三位协作居民及嘉宾的本版同意'};
 const blocked=people.map(r=>relationshipInvitation(s,r.id,people.map(p=>p.id))).find(r=>!r.ready);if(blocked)return{ready:false,reason:blocked.reason};
 const owner=d.projectId?'project:'+d.projectId:null;if(Object.entries({...eventCost(d),...FIREWORKS_EQUIPMENT}).some(([id,n])=>availableQuantity(s,id,owner)<n))return{ready:false,reason:'备齐六枚烟花、海风旗、后台茶与14岛币'};
 return{ready:true,event:d};
}
export function startFireworksParty(s,{seed,theme}){
 const ready=fireworksReadiness(s);if(!ready.ready)return{ok:false,reason:ready.reason};const f=hydrateFireworks(s),d=ready.event,people=eventRequests(d),layout=createFestivalLayout(s,theme,people.length);if(!layout)return{ok:false,reason:'展台与协作席位空间不足，请先收起广场摆件'};
 releasePlan(s,d);const owner=fireworksOwner(d.id),game=createFireworksGame(seed,d.difficulty,d.tags),hold=reserveResources(s,owner,{...eventCost(d),...FIREWORKS_EQUIPMENT},{purpose:d.name+' · 六枚烟花与海风旗'});
 if(!hold.ok)return{ok:false,reason:'可用烟花与展台用品不足'};
 if(!transact(s,{cost:14,materials:{tea:1},owner,category:'party',receipt:d.id+':entry',note:d.name+' · 场地与后台茶'})){releaseResources(s,owner);return{ok:false,reason:'开场结算未完成'};}
 f.session={...copy(d),cooperation:captureCooperation(s,d),phase:'running',layout,participants:people.map(p=>({id:p.id,role:p.role})),game,startedDay:s.day,paid:null,result:null};f.draft=null;s.lastPartyDay=s.day;return{ok:true,session:f.session};
}
function settleShells(s,g){
 const n=g.game.shots.length;if(!n)return{ok:true};
 return commitResources(s,{id:'fireworks-fired:'+g.id,cost:{firework:n},owner:fireworksOwner(g.id),category:'party_fireworks',note:g.name+' · 实际发射'+n+'枚烟花'});
}
export function finishFireworksParty(s){
 const f=hydrateFireworks(s),g=f.session;if(!g)return{ok:false,reason:'没有待结算的烟花大会'};if(g.phase==='claimed')return{ok:true,replayed:true,reward:g.paid,result:g.result};if(g.phase!=='running'||g.game.phase!=='results'||!validFireworksGame(g.game))return{ok:false,reason:'三幕烟花尚未结束'};
 const entry=s.resourceLedger?.receipts?.['cash:'+g.id+':entry'];if(s.economy?.cashReceipts?.[g.id+':entry']!==true||entry?.category!=='party'||entry.delta?.coins!==-14||entry.delta?.tea!==-1)return{ok:false,reason:'缺少本场实际投入记录'};
 const spent=settleShells(s,g);if(!spent.ok)return{ok:false,reason:'实际发射烟花尚未核对'};const result=fireworksSummary(g.game);
 if(!transact(s,{income:result.reward,category:'party',receipt:g.id+':reward',note:g.name+' · 三幕演出品质'+result.quality}))return{ok:false,reason:'大会收益结算未完成'};
 g.phase='claimed';g.paid=result.reward;g.result=result;g.endedDay=s.day;releaseResources(s,fireworksOwner(g.id));s.activities=(s.activities||0)+1;s.tasks??={};s.tasks.party=true;
 if(result.passed)for(const p of g.participants){s.npcAffinity??={};s.npcAffinity[p.id]=Math.min(100,(s.npcAffinity[p.id]??20)+3);s.npcMemory??={};s.npcMemory[p.id]??=[];s.npcMemory[p.id].push({day:s.day,eventId:g.id,text:'一起完成'+g.name+'，三幕品质'+result.quality+'分，把星光与风向的配合留在记忆里。'});s.npcMemory[p.id]=s.npcMemory[p.id].slice(-16);}
 trackJourney(s,'party',{kind:'fireworks',eventId:g.id});f.history.unshift(copy(g));f.history=f.history.slice(0,20);return{ok:true,reward:g.paid,result,newWonders:awardFireworksWonder(s,g).newIds};
}
export function abandonFireworksParty(s){const f=hydrateFireworks(s),g=f.session;if(!g||g.phase!=='running')return{ok:false,reason:'没有进行中的烟花大会'};const r=settleShells(s,g);if(!r.ok)return{ok:false,reason:'实际发射数量未通过核对'};g.phase='abandoned';g.paid=0;g.result=null;g.endedDay=s.day;releaseResources(s,fireworksOwner(g.id));f.history.unshift(copy(g));f.history=f.history.slice(0,20);return{ok:true,fired:g.game.shots.length};}
export function cancelFireworksDraft(s){const f=hydrateFireworks(s),d=f.draft;if(!d)return{ok:false,reason:'没有待取消的筹备'};if(d.projectId&&s.workProjects?.some(p=>p.id===d.projectId&&['preparing','paused','ready'].includes(p.status)))controlProject(s,d.projectId,'cancel');f.history.unshift({...copy(d),phase:'cancelled',endedDay:s.day,paid:0});f.history=f.history.slice(0,20);f.draft=null;return{ok:true};}
export function archiveFireworksParty(s){const f=hydrateFireworks(s);if(!['claimed','abandoned'].includes(f.session?.phase))return{ok:false,reason:'先结束本场大会'};f.session=null;return{ok:true};}
const record=v=>v&&typeof v==='object'&&!Array.isArray(v),positive=v=>Number.isSafeInteger(v)&&v>0,id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
export function validFireworksDesign(d){
 if(!record(d)||!validCooperationSnapshot(d.cooperation)||!validStewardPartyMetadata(d)||!id(d.id)||d.template!=='fireworks'||!positive(d.version)||d.version>100000||!positive(d.createdDay)||typeof d.name!=='string'||!d.name.trim()||d.name.length>24||typeof d.description!=='string'||d.description.length>200||!['easy','normal'].includes(d.difficulty)||!Array.isArray(d.tags)||d.tags.length>2||new Set(d.tags).size!==d.tags.length||d.tags.some(t=>!PARTY_TAGS.some(p=>p.id===t))||typeof d.guestReason!=='string'||d.guestReason.length>180||d.guestId!==null&&(!THEME_GUESTS.some(g=>g.id===d.guestId&&g.tags.some(t=>d.tags.includes(t)))||FIREWORKS_INVITES.some(r=>r.id===d.guestId)))return false;
 const people=new Set(eventRequests(d).map(r=>String(r.id)));
 if(!record(d.invites)||Object.entries(d.invites).some(([n,v])=>!people.has(n)||!record(v)||!positive(v.version)||v.version>d.version||!positive(v.day)))return false;
 if(!record(d.inviteGifts)||Object.entries(d.inviteGifts).some(([n,v])=>!/^([0-9]|1[0-4])$/.test(n)||!record(v)||!positive(v.day)||v.affinityGranted!==true||!record(v.delivered)||!Object.keys(v.delivered).length||Object.entries(v.delivered).some(([k,c])=>!['fiber','shell','bread','wheat','rose','bamboo',...THEME_GUESTS.map(r=>r.item)].includes(k)||!positive(c)||c>99)))return false;
 return(d.projectId===null||id(d.projectId))&&Array.isArray(d.projectIds)&&d.projectIds.length<=40&&new Set(d.projectIds).size===d.projectIds.length&&d.projectIds.every(id)&&(!d.projectId||d.projectIds.includes(d.projectId))&&Array.isArray(d.revisions)&&d.revisions.length<=20&&d.revisions.every(r=>record(r)&&positive(r.version)&&r.version<=d.version&&positive(r.day)&&typeof r.before==='string'&&r.before.length<=1000);
}
export function validFireworksParty(s){
 const f=s.fireworksParty;if(f===undefined)return true;if(!record(f)||!validStewardPartyReceipts(f,'fireworks')||f.version!==1||f.draft&&f.session||f.draft!==null&&!validFireworksDesign(f.draft)||!Array.isArray(f.history)||f.history.length>20)return false;
 const session=g=>{
  if(!validFireworksDesign(g)||!['running','claimed','abandoned'].includes(g.phase)||!positive(g.startedDay)||!validFireworksGame(g.game)||!validFestivalLayout(g.layout,g.guestId===null?3:4)||!Array.isArray(g.participants)||!same(g.participants,eventRequests(g).map(p=>({id:p.id,role:p.role})))||!same(g.game.tags,g.tags))return false;
  if(g.phase==='running')return g.paid===null&&g.result===null;if(!positive(g.endedDay))return false;if(g.phase==='abandoned')return g.paid===0&&g.result===null;return g.game.phase==='results'&&g.paid===fireworksSummary(g.game).reward&&same(g.result,fireworksSummary(g.game));
 };
 return(f.session===null||session(f.session))&&f.history.every(g=>g.phase==='cancelled'?validFireworksDesign(g)&&positive(g.endedDay)&&g.paid===0:session(g)&&g.phase!=='running');
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
