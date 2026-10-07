import {captureCooperation,validCooperationSnapshot} from './cooperationEvidence.js';
import {eventRequests,eventCost,partyInputSignature,partyDraftStamp,validatePartyProposal,PARTY_TAGS,THEME_GUESTS,MARKET_INVITES} from './partyPlanning.js';
import {MARKET_STOCK,MARKET_EQUIPMENT,createMarketGame,marketSummary,validMarketGame} from './marketRules.js';
import {availableQuantity,reserveResources,releaseResources,commitResources,nextOperationId} from './resourceLedger.js';
import {createProject,syncProjects,controlProject} from './projectPlans.js';
import {relationshipInvitation} from './residentStories.js';
import {transact} from './economy.js';
import {trackJourney} from './journey.js';
import {awardMarketWonder} from './eventWonders.js';
import {createFestivalLayout,validFestivalLayout} from './festivalLayout.js';
import {validStewardPartyMetadata,validStewardPartyReceipts} from './partyReceipts.js';
const copy=structuredClone;
export const festivalOwner=id=>'festival:'+id;
export function hydrateFestival(s){return s.festivalParty??={version:1,draft:null,session:null,history:[]};}
export function festivalSnapshot(s){const f=copy(hydrateFestival(s));delete f.composer;return f;}
export function createFestivalEvent(s,input={}){
 const f=hydrateFestival(s);if(f.draft||f.session)return{ok:false,reason:'先完成或收起当前集市'};
 const checked=validatePartyProposal(s,{name:'海岛手作集市',...input,template:'market'});if(!checked.ok)return checked;
 f.draft={id:nextOperationId(s,'market').replace(':','-'),...checked.proposal,version:1,createdDay:s.day,invites:{},inviteGifts:{},revisions:[],projectId:null,projectIds:[],source:'player',runId:null,proposalId:null};
 return{ok:true,event:f.draft};
}
export function updateFestivalEvent(s,input){
 const d=hydrateFestival(s).draft;if(!d)return{ok:false,reason:'没有待修改的集市方案'};
 const c=validatePartyProposal(s,{...input,template:'market'});if(!c.ok)return c;
 const change=partyInputSignature(d)!==partyInputSignature(c.proposal),before=partyDraftStamp(d);
 if(change){
  if(d.version>=100000)return{ok:false,reason:'请取消当前方案后重新发布'};
  if(d.projectId&&s.workProjects?.some(p=>p.id===d.projectId&&['preparing','paused','ready'].includes(p.status)))controlProject(s,d.projectId,'cancel');
  d.version++;d.invites={};d.projectId=null;d.revisions.push({version:d.version,day:s.day,before});d.revisions=d.revisions.slice(-20);
 }
 Object.assign(d,c.proposal,{source:'player',runId:null,proposalId:null});return{ok:true,event:d,reinvite:change};
}
export function festivalNeeds(s){
 const d=hydrateFestival(s).draft;if(!d)return null;
 const cost={...eventCost(d),...MARKET_EQUIPMENT};
 for(const r of eventRequests(d))if((d.inviteGifts[r.id]?.delivered?.[r.item]||0)<r.quantity)cost[r.item]=(cost[r.item]||0)+r.quantity;
 const owner=d.projectId?'project:'+d.projectId:festivalOwner(d.id);
 return{cost,missing:Object.fromEntries(Object.entries(cost).map(([id,n])=>[id,Math.max(0,n-availableQuantity(s,id,owner))]).filter(([,n])=>n))};
}
export function releaseFestivalPlan(s,d){
 if(!d.projectId)return;syncProjects(s,{server:true});const p=s.workProjects?.find(p=>p.id===d.projectId);
 if(p?.status==='ready')controlProject(s,p.id,'finish');
}
export function createFestivalPlan(s){
 const d=hydrateFestival(s).draft;if(!d)return{ok:false,reason:'先发布集市方案'};
 const p=s.workProjects?.find(p=>p.id===d.projectId);if(p&&['preparing','paused','ready'].includes(p.status))return{ok:true,replayed:true,project:p};
 const targets={...festivalNeeds(s).cost};delete targets.coins;
 const r=createProject(s,{id:nextOperationId(s,'market-supplies').replace(':','-'),title:d.name+' · 物资筹备',targets,source:d.source==='hermes'?'hermes':'player',runId:d.runId||null});
 if(r.ok){d.projectId=r.project.id;d.projectIds=[...new Set([...d.projectIds,r.project.id])].slice(-40);}return r;
}
export function inviteFestivalNpc(s,id){
 const d=hydrateFestival(s).draft,r=d&&eventRequests(d).find(r=>r.id===id);
 if(!r)return{ok:false,reason:'这位居民不在当前集市岗位名单'};
 if(d.invites[id]?.version===d.version)return{ok:true,replayed:true};
 const willing=relationshipInvitation(s,id,eventRequests(d).map(r=>r.id));if(!willing.ready)return{ok:false,reason:willing.reason};
 releaseFestivalPlan(s,d);const prior=d.inviteGifts[id],delivered=(prior?.delivered?.[r.item]||0)>=r.quantity;
 if(!delivered){
  const paid=commitResources(s,{id:'market-gift:'+d.id+':'+id+':'+r.item,cost:{[r.item]:r.quantity},category:'party_invite',note:d.name+' · 岗位邀请'});
  if(!paid.ok)return{ok:false,reason:'约好的物资还未备齐，或已留给其他筹备'};
  d.inviteGifts[id]={delivered:{...(prior?.delivered||{}),[r.item]:r.quantity},day:s.day,affinityGranted:true};
  if(!prior?.affinityGranted){s.npcAffinity??={};s.npcAffinity[id]=Math.min(100,(s.npcAffinity[id]??20)+1);}
 }
 d.invites[id]={version:d.version,day:s.day};s.npcMemory??={};s.npcMemory[id]??=[];
 s.npcMemory[id].push({day:s.day,eventId:d.id,text:'岛主邀请我在'+d.name+'负责'+r.role+'，我同意当前活动约定。'});s.npcMemory[id]=s.npcMemory[id].slice(-16);
 trackJourney(s,'invite');return{ok:true,npcId:id,version:d.version,reconfirmed:delivered};
}
export function festivalReadiness(s){
 const d=hydrateFestival(s).draft;if(!d)return{ready:false,reason:'先发布集市方案'};
 if(s.fireworksParty?.session?.phase==='running'||s.coutureParty?.session?.phase==='running'||s.partySession||['checkin','running'].includes(s.fishingParty?.session?.phase)||hydrateFestival(s).session)return{ready:false,reason:'先完成正在进行的活动'};
 if(s.lastPartyDay===s.day)return{ready:false,reason:'今天的承办机会已使用'};
 const people=eventRequests(d);if(people.some(r=>d.invites[r.id]?.version!==d.version))return{ready:false,reason:'亲自对话、交付物品，邀请所有摊主与嘉宾'};
 const blocked=people.map(r=>relationshipInvitation(s,r.id,people.map(p=>p.id))).find(r=>!r.ready);if(blocked)return{ready:false,reason:blocked.reason};
 const owner=d.projectId?'project:'+d.projectId:null;
 if(Object.entries({...eventCost(d),...MARKET_EQUIPMENT}).some(([id,n])=>availableQuantity(s,id,owner)<n))return{ready:false,reason:'需备齐16件商品、摊架用品与12岛币'};
 return{ready:true,event:d};
}
export function startFestivalParty(s,{seed,theme}){
 const ready=festivalReadiness(s);if(!ready.ready)return{ok:false,reason:ready.reason};
 const f=hydrateFestival(s),d=ready.event,people=eventRequests(d),layout=createFestivalLayout(s,theme,people.length);
 if(!layout)return{ok:false,reason:'广场摊位与行路空间不足，先收起周围摆件'};
 // Validate before spending; no failed setup may leave consumed goods behind.
 const game=createMarketGame(seed,d.difficulty,people.map(r=>r.id));
 releaseFestivalPlan(s,d);const owner=festivalOwner(d.id),hold=reserveResources(s,owner,{...eventCost(d),...MARKET_EQUIPMENT},{purpose:d.name+' · 商品与摊位器具'});
 if(!hold.ok)return{ok:false,reason:'可用商品或器具不足',missing:hold.missing};
 const personalStock=Object.fromEntries(Object.entries(MARKET_STOCK).map(([id,n])=>[id,Math.min(n,s.economy?.playerGoods?.[id]||0)]));
 if(!transact(s,{cost:12,materials:{...MARKET_STOCK},owner,category:'party',receipt:d.id+':entry',note:d.name+' · 场地与16件寄售商品'})){releaseResources(s,owner);return{ok:false,reason:'开场结算未完成'};}
 f.session={...copy(d),cooperation:captureCooperation(s,d),phase:'running',layout,participants:people.map(r=>({id:r.id,role:r.role})),game,personalStock,startedDay:s.day,paid:null,returned:null};
 f.draft=null;s.lastPartyDay=s.day;return{ok:true,session:f.session};
}
function returnStock(s,g){
 const entry=s.resourceLedger?.receipts?.['cash:'+g.id+':entry'];
 if(s.economy?.cashReceipts?.[g.id+':entry']!==true||entry?.category!=='party'||entry.delta?.coins!==-12||!Object.entries(MARKET_STOCK).every(([id,n])=>entry.delta?.[id]===-n))return{ok:false,reason:'缺少本场实际寄售入账，不能生成退回商品'};
 const gain=Object.fromEntries(Object.entries(g.game.stock).filter(([,n])=>n));
 const r=commitResources(s,{id:g.id+':return',gain,category:'market_return',note:g.name+' · 未售商品退回'});
 if(!r.ok)return{ok:false,reason:'未售商品退回记录冲突'};g.returned={...g.game.stock};
 // Return attribution only to the original player-made portion, never create credit for NPC goods.
 s.economy??={};s.economy.playerGoods??={};
 if(!r.replayed)for(const [id,n] of Object.entries(gain))s.economy.playerGoods[id]=(s.economy.playerGoods[id]||0)+Math.min(n,Math.max(0,(g.personalStock?.[id]||0)-(MARKET_STOCK[id]-n)));
 return{ok:true};
}
export function finishFestivalParty(s){
 const f=hydrateFestival(s),g=f.session;if(!g)return{ok:false,reason:'没有待结算的集市'};
 if(g.phase==='claimed')return{ok:true,replayed:true,reward:g.paid,result:g.result};
 if(g.phase!=='running'||g.game.phase!=='results'||!validMarketGame(g.game))return{ok:false,reason:'三波顾客尚未结束'};
 const result=marketSummary(g.game),returned=returnStock(s,g);if(!returned.ok)return returned;
 if(!transact(s,{income:result.reward,category:'party',receipt:g.id+':reward',note:g.name+' · 经营品质'+result.quality}))return{ok:false,reason:'集市收益结算未成功'};
 g.phase='claimed';g.paid=result.reward;g.result=result;g.endedDay=s.day;releaseResources(s,festivalOwner(g.id));
 s.activities=(s.activities||0)+1;s.tasks??={};s.tasks.party=true;
 if(result.passed)for(const p of g.participants){s.npcAffinity??={};s.npcAffinity[p.id]=Math.min(100,(s.npcAffinity[p.id]??20)+3);s.npcMemory??={};s.npcMemory[p.id]??=[];s.npcMemory[p.id].push({day:s.day,eventId:g.id,text:'在'+g.name+'共同服务了'+result.served+'位顾客，品质'+result.quality+'分。'});s.npcMemory[p.id]=s.npcMemory[p.id].slice(-16);}
 const awarded=awardMarketWonder(s,g);trackJourney(s,'party',{kind:'market',eventId:g.id});
 f.history.unshift(copy(g));f.history=f.history.slice(0,20);return{ok:true,reward:g.paid,result,returned:g.returned,newWonders:awarded.newIds};
}
export function abandonFestivalParty(s,{recover=false,refund=true}={}){
 const f=hydrateFestival(s),g=f.session;if(!g||g.phase!=='running')return{ok:false,reason:'没有可结束的集市'};
 const returned=refund?returnStock(s,g):{ok:false};if(!returned.ok&&!recover)return returned;
 g.phase='abandoned';g.paid=0;g.endedDay=s.day;if(!returned.ok)g.returned={};releaseResources(s,festivalOwner(g.id));f.history.unshift(copy(g));f.history=f.history.slice(0,20);return{ok:true,returned:g.returned};
}
export function cancelFestivalDraft(s){
 const f=hydrateFestival(s),d=f.draft;if(!d)return{ok:false,reason:'没有可取消的筹备'};
 if(d.projectId&&s.workProjects?.some(p=>p.id===d.projectId&&['preparing','paused','ready'].includes(p.status)))controlProject(s,d.projectId,'cancel');
 f.history.unshift({...copy(d),phase:'cancelled',endedDay:s.day,paid:0});f.history=f.history.slice(0,20);f.draft=null;return{ok:true};
}
export function archiveFestivalParty(s){const f=hydrateFestival(s);if(!['claimed','abandoned'].includes(f.session?.phase))return{ok:false,reason:'先结束本场集市'};f.session=null;return{ok:true};}
const record=v=>v&&typeof v==='object'&&!Array.isArray(v),positive=v=>Number.isSafeInteger(v)&&v>0,id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
export function validFestivalDesign(d){
 if(!record(d)||!validCooperationSnapshot(d.cooperation)||!validStewardPartyMetadata(d)||!id(d.id)||d.template!=='market'||!positive(d.version)||d.version>100000||!positive(d.createdDay)||typeof d.name!=='string'||!d.name.trim()||d.name.length>24||typeof d.description!=='string'||d.description.length>200||!['normal','easy'].includes(d.difficulty)||!Array.isArray(d.tags)||d.tags.length>2||new Set(d.tags).size!==d.tags.length||d.tags.some(t=>!PARTY_TAGS.some(p=>p.id===t))||typeof d.guestReason!=='string'||d.guestReason.length>180||d.guestId!==null&&(!THEME_GUESTS.some(g=>g.id===d.guestId&&g.tags.some(t=>d.tags.includes(t)))||MARKET_INVITES.some(r=>r.id===d.guestId)))return false;
 const people=new Set(eventRequests(d).map(r=>String(r.id)));
 if(!record(d.invites)||Object.entries(d.invites).some(([n,v])=>!people.has(n)||!record(v)||!positive(v.version)||v.version>d.version||!positive(v.day)))return false;
 if(!record(d.inviteGifts)||Object.entries(d.inviteGifts).some(([n,v])=>!/^([0-9]|1[0-4])$/.test(n)||!record(v)||!positive(v.day)||v.affinityGranted!==true||!record(v.delivered)||!Object.keys(v.delivered).length||Object.entries(v.delivered).some(([k,c])=>!['bread','wood','tea',...THEME_GUESTS.map(r=>r.item)].includes(k)||!positive(c)||c>99)))return false;
 return(d.projectId===null||id(d.projectId))&&Array.isArray(d.projectIds)&&d.projectIds.length<=40&&new Set(d.projectIds).size===d.projectIds.length&&d.projectIds.every(id)&&(!d.projectId||d.projectIds.includes(d.projectId))&&Array.isArray(d.revisions)&&d.revisions.length<=20&&d.revisions.every(r=>record(r)&&positive(r.version)&&r.version<=d.version&&positive(r.day)&&typeof r.before==='string'&&r.before.length<=1000);
}
export function validFestivalParty(s){
 const f=s.festivalParty;if(f===undefined)return true;
 if(!record(f)||!validStewardPartyReceipts(f,'market')||f.version!==1||f.draft&&f.session||f.draft!==null&&!validFestivalDesign(f.draft)||!Array.isArray(f.history)||f.history.length>20)return false;
 const session=g=>{
  if(!validFestivalDesign(g)||!['running','claimed','abandoned'].includes(g.phase)||!positive(g.startedDay)||!validMarketGame(g.game)||!record(g.personalStock)||Object.keys(g.personalStock).length!==4||Object.entries(MARKET_STOCK).some(([id,n])=>!Number.isSafeInteger(g.personalStock[id])||g.personalStock[id]<0||g.personalStock[id]>n)||!validFestivalLayout(g.layout,eventRequests(g).length)||!Array.isArray(g.participants)||JSON.stringify(g.participants)!==JSON.stringify(eventRequests(g).map(r=>({id:r.id,role:r.role})))||JSON.stringify(g.game.excluded)!==JSON.stringify(eventRequests(g).map(r=>r.id)))return false;
  if(g.phase==='running')return g.paid===null&&g.returned===null;
  if(!positive(g.endedDay)||!record(g.returned))return false;
  if(g.phase==='abandoned')return g.paid===0&&(Object.keys(g.returned).length===0||JSON.stringify(g.returned)===JSON.stringify(g.game.stock));
  return g.game.phase==='results'&&g.paid===marketSummary(g.game).reward&&JSON.stringify(g.result)===JSON.stringify(marketSummary(g.game))&&JSON.stringify(g.returned)===JSON.stringify(g.game.stock);
 };
 return(f.session===null||session(f.session))&&f.history.every(g=>g.phase==='cancelled'?validFestivalDesign(g)&&positive(g.endedDay)&&g.paid===0:session(g)&&g.phase!=='running');
}
