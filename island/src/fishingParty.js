import {captureCooperation,validCooperationSnapshot} from './cooperationEvidence.js';
import {relationshipInvitation} from './residentStories.js';
import {availableQuantity,reserveResources,releaseResources,commitResources,nextOperationId} from './resourceLedger.js';
import {createProject,controlProject,syncProjects,projectSteps} from './projectPlans.js';
import {transact} from './economy.js';
import {awardEventWonders,requestWonderDisplay} from './eventWonders.js';
import {createFishingMatch,fishingScore,validFishingMatch} from './fishingRules.js';
export const FISHING_COST={coins:10,c16_4:1,bread:2};
export const FISHING_EQUIPMENT={rod:1,c8_2:1};
import {FISHING_INVITES,eventRequests,eventCost,partyInputSignature,partyDraftStamp,validatePartyProposal} from './partyPlanning.js';
export {FISHING_INVITES,eventRequests,eventCost} from './partyPlanning.js';
const copy=structuredClone;
export const fishingOwner=id=>'event:'+id;
export function hydrateFishing(s){s.fishingParty??={version:1,draft:null,session:null,history:[]};const f=s.fishingParty;for(const d of [f.draft,f.session].filter(Boolean)){d.inviteGifts??={};for(const [id,r] of Object.entries(d.invites||{}))if(r.delivered&&!d.inviteGifts[id])d.inviteGifts[id]={...copy(r),affinityGranted:true};}return f;}
export function createFishingEvent(s,{name='海风钓鱼大会',difficulty='normal',seed=1,description='',tags=[],guestId=null,guestReason='',source='player',runId=null,proposalId=null}={}){
 const f=hydrateFishing(s);if(f.draft||f.session)return {ok:false,reason:'先结束或取消当前钓鱼活动'};
 const checked=validatePartyProposal(s,{name,description,tags,difficulty,guestId,guestReason});if(!checked.ok)return checked;
 const id=nextOperationId(s,'fishing').replace(':','-');
 f.draft={id,...checked.proposal,version:1,seed:seed>>>0||1,createdDay:s.day,invites:{},inviteGifts:{},revisions:[],source:['player','deepseek','hermes','rules'].includes(source)?source:'player',runId:typeof runId==='string'?runId.slice(0,100):null,proposalId:typeof proposalId==='string'?proposalId.slice(0,80):null,projectId:null,projectIds:[]};
 return {ok:true,event:f.draft};
}
export function fishingNeeds(s){
 const d=hydrateFishing(s).draft;if(!d)return null;
 const cost={...eventCost(d),...FISHING_EQUIPMENT};
 for(const r of eventRequests(d))if(d.invites[r.id]?.version!==d.version&&!d.inviteGifts[r.id]?.delivered?.[r.item])cost[r.item]=(cost[r.item]||0)+r.quantity;
 return {cost,missing:Object.fromEntries(Object.entries(cost).map(([k,n])=>[k,Math.max(0,n-availableQuantity(s,k,fishingOwner(d.id)))]).filter(([,n])=>n))};
}
export function createFishingPlan(s){
 const d=hydrateFishing(s).draft;if(!d)return {ok:false,reason:'先发布钓鱼活动'};
 if(d.projectId&&s.workProjects?.some(p=>p.id===d.projectId&&['preparing','paused','ready'].includes(p.status)))return {ok:true,replayed:true,project:s.workProjects.find(p=>p.id===d.projectId)};
 const targets={...fishingNeeds(s).cost};delete targets.coins;
 const prior=d.projectId?s.workProjects?.find(p=>p.id===d.projectId):null;
 if(prior?.status==='completed'&&!Object.keys(fishingNeeds(s).missing).some(id=>id!=='coins'))return {ok:true,replayed:true,project:prior};
 const result=createProject(s,{id:nextOperationId(s,'fishing-supplies').replace(':','-'),title:d.name+' · 物资筹备',targets,source:d.source==='hermes'?'hermes':'player',runId:d.runId||null});
 if(result.ok){d.projectIds=[...new Set([...(d.projectIds||[]),d.projectId,result.project.id].filter(Boolean))];d.projectId=result.project.id;}return result;
}
function takeReadyPlan(s,d){
 if(!d.projectId)return;syncProjects(s);const p=s.workProjects.find(p=>p.id===d.projectId);
 if(p?.status==='ready')controlProject(s,p.id,'finish');
}
export function inviteFishingNpc(s,id,{version}={}){
 const d=hydrateFishing(s).draft,r=eventRequests(d).find(r=>r.id===id);
 if(!d||!r||version!==d.version)return {ok:false,reason:'邀请已过期，请打开当前活动重新邀请'};
 if(d.invites[id]?.version===version)return {ok:true,replayed:true};
 const willingness=relationshipInvitation(s,id,eventRequests(d).map(r=>r.id));if(!willingness.ready)return {ok:false,reason:willingness.reason,storyId:willingness.storyId};
 takeReadyPlan(s,d);
 const delivered=d.inviteGifts[id]?.delivered?.[r.item]>=r.quantity;
 const result=commitResources(s,{id:d.id+':invite:'+id+':'+version,cost:delivered?{}:{[r.item]:r.quantity},category:'party-invite',note:d.name+' · 给居民 '+id+' 的邀请'+(delivered?'重新确认':'物资')});
 if(!result.ok)return {ok:false,reason:'邀请物资不足，或已经预留给其他筹备清单'};
 d.invites[id]={version,day:s.day,receipt:d.id+':invite:'+id+':'+version,delivered:{[r.item]:r.quantity}};
 s.npcAffinity??={};if(!d.inviteGifts[id]?.affinityGranted)s.npcAffinity[id]=Math.min(100,(s.npcAffinity[id]??20)+1);
 d.inviteGifts[id]={...d.invites[id],affinityGranted:true};
 s.npcMemory??={};s.npcMemory[id]??=[];s.npcMemory[id].push({day:s.day,eventId:d.id,text:'岛主亲自邀请我参加'+d.name+(delivered?'，重新确认了活动约定；之前的赠物已经收到了。':'，带来了约好的物品；我答应到场。')});s.npcMemory[id]=s.npcMemory[id].slice(-16);
 return {ok:true,reconfirmed:delivered};
}
export function cancelFishingDraft(s){
 const f=hydrateFishing(s),d=f.draft;if(!d)return false;
 if(d.projectId&&s.workProjects?.some(p=>p.id===d.projectId&&['preparing','ready','paused'].includes(p.status)))controlProject(s,d.projectId,'cancel');
 releaseResources(s,fishingOwner(d.id));f.history.unshift({...d,status:'cancelled',endedDay:s.day});f.history=f.history.slice(0,30);f.draft=null;return true;
}
export function startFishingParty(s){
 const f=hydrateFishing(s),d=f.draft;if(!d||f.session||s.partySession)return {ok:false,reason:'请先完成正在举行的派对'};
 if(s.lastPartyDay===s.day)return {ok:false,reason:'今天已承办一场派对，明天再相聚'};
 if(eventRequests(d).some(r=>d.invites[r.id]?.version!==d.version))return {ok:false,reason:'请先亲自与关键居民对话，交付邀请物资'};
 for(const r of eventRequests(d)){const willingness=relationshipInvitation(s,r.id,eventRequests(d).map(r=>r.id));if(!willingness.ready)return {ok:false,reason:willingness.reason,storyId:willingness.storyId};}
 takeReadyPlan(s,d);const cost=eventCost(d),owner=fishingOwner(d.id),hold=reserveResources(s,owner,{...cost,...FISHING_EQUIPMENT},{purpose:d.name+' · 本场物资与钓具'});
 if(!hold.ok)return {ok:false,reason:'开场物资或可用钓具不足',missing:hold.missing};
 if(!transact(s,{cost:cost.coins,materials:{c16_4:cost.c16_4,bread:cost.bread},owner,category:'party',receipt:d.id+':entry',note:d.name+' · 场地、六竿鱼饵与点心'})){releaseResources(s,owner);return {ok:false,reason:'开场结算未完成'};}
 const cooperation=captureCooperation(s,d);
 f.session={...copy(d),phase:'checkin',playerArrived:false,participants:eventRequests(d).map(r=>({id:r.id,arrived:false,position:null})),match:createFishingMatch(d.seed,d.difficulty),startedDay:s.day,cooperation,paid:null};
 f.draft=null;s.lastPartyDay=s.day;return {ok:true,session:f.session};
}
export function fishingCheckin(s,id){
 const g=hydrateFishing(s).session;if(g?.phase!=='checkin')return false;
 if(id===-1)g.playerArrived=true;else{const n=g.participants.find(n=>n.id===id);if(!n)return false;n.arrived=true;}
 if(g.playerArrived&&g.participants.every(n=>n.arrived))g.phase='running';return true;
}
export function finishFishingParty(s){
 const f=hydrateFishing(s),g=f.session;if(!g)return {ok:false,reason:'没有待结算的比赛'};
 if(g.phase==='claimed'&&Number.isInteger(g.paid))return {ok:true,replayed:true,reward:g.paid,result:g.result};
 if(g.phase!=='running'||g.match.phase!=='results'||g.match.results.length!==6)return {ok:false,reason:'比赛尚未完成'};
 const result=fishingScore(g.match),reward=30+Math.floor(result.normalized*.12);
 if(!transact(s,{income:reward,category:'party',receipt:g.id+':reward',note:g.name+' · '+result.normalized+' 分'}))return {ok:false,reason:'奖励结算未成功'};
 g.paid=reward;g.result=result;g.phase='claimed';g.endedDay=s.day;
 releaseResources(s,fishingOwner(g.id));s.activities=(s.activities||0)+1;s.tasks.party=true;
 for(const p of g.participants)if(p.arrived){s.npcAffinity[p.id]=Math.min(100,(s.npcAffinity[p.id]??20)+3);s.npcMemory[p.id]??=[];s.npcMemory[p.id].push({day:s.day,text:'参加了'+g.name+'，岛主获得 '+result.raw+' 分。'});s.npcMemory[p.id]=s.npcMemory[p.id].slice(-16)}
 const awarded=awardEventWonders(s,g),w=s.eventWonders;
 f.history.unshift(copy(g));f.history=f.history.slice(0,30);return {ok:true,reward,result,firstWonder:w.owned.seashell_cup.eventId===g.id,newWonders:awarded.newIds};
}
export function abandonFishingParty(s){
 const f=hydrateFishing(s),g=f.session;if(!g||['claimed','abandoned'].includes(g.phase))return false;
 g.phase='abandoned';g.endedDay=s.day;releaseResources(s,fishingOwner(g.id));
 f.history.unshift(copy(g));f.history=f.history.slice(0,30);return true;
}
export function archiveFishingParty(s){
 const f=hydrateFishing(s);if(!['claimed','abandoned'].includes(f.session?.phase))return false;f.session=null;return true;
}
export function displayFishingWonder(s,display=true,options={}){
 return requestWonderDisplay(s,'seashell_cup',display,options).ok;
}

export function updateFishingEvent(s,input,{expectedId,expectedVersion,source='player',runId=null}={}){
 const d=hydrateFishing(s).draft;if(!d||d.id!==expectedId||d.version!==expectedVersion)return {ok:false,reason:'活动已经变化，请重新打开当前方案'};
 const checked=validatePartyProposal(s,input);if(!checked.ok)return checked;
 const critical=partyInputSignature(d)!==partyInputSignature(checked.proposal);
 if(critical){
  if(d.version>=100000)return {ok:false,reason:'请取消当前活动，另建新方案'};
  d.revisions??=[];d.revisions.push({version:d.version,name:d.name,description:d.description||'',tags:d.tags||[],difficulty:d.difficulty,guestId:d.guestId??null,day:s.day,invited:Object.keys(d.invites).map(Number)});d.revisions=d.revisions.slice(-12);
  if(d.projectId&&s.workProjects?.some(p=>p.id===d.projectId&&['preparing','paused','ready'].includes(p.status)))controlProject(s,d.projectId,'cancel');
  d.version++;d.invites={};d.projectId=null;
 }
 Object.assign(d,checked.proposal,{proposalId:typeof input.proposalId==='string'?input.proposalId.slice(0,80):null,source:['player','deepseek','hermes','rules'].includes(source)?source:'player',runId:typeof runId==='string'?runId.slice(0,100):null});
 return {ok:true,event:d,reinvite:critical};
}
export function applyStewardParty(s,p,runId){
 const f=hydrateFishing(s);
 if(!p||(p.template??'fishing')!=='fishing'||!/^[a-f0-9]{32}$/.test(p.id)||typeof runId!=='string'||!/^hd-island-[a-f0-9]{32}$/.test(runId))return {ok:false,reason:'缺少真实管家活动回执'};
 f.hermesReceipts??={};const key=runId+':'+p.id;if(f.hermesReceipts[key])return {...copy(f.hermesReceipts[key]),replayed:true};
 const d=f.draft;
 if(p.expectedId!==(d?.id||null)||p.expectedVersion!==(d?.version||null)||(p.expectedStamp??null)!==partyDraftStamp(d))return {ok:false,reason:'管家观察后活动已改变，本轮方案未登记，请重新观察'};
 if(f.session)return {ok:false,reason:'先完成当前比赛再准备新活动'};
 const checked=validatePartyProposal(s,p);if(!checked.ok)return checked;
 const r=d?updateFishingEvent(s,checked.proposal,{expectedId:d.id,expectedVersion:d.version,source:'hermes',runId}):createFishingEvent(s,{...checked.proposal,source:'hermes',runId,seed:parseInt(p.id.slice(0,8),16)});
 if(!r.ok)return r;
 const plan=createFishingPlan(s);
 const receipt={ok:true,template:'fishing',id:r.event.id,title:r.event.name,version:r.event.version,runId,reinvite:!!r.reinvite,projectId:plan.project?.id||null,preparation:plan.ok?'registered':plan.reason,waiting:'亲自邀请关键居民，备齐用品后开场'};
 f.hermesReceipts[key]=receipt;for(const old of Object.keys(f.hermesReceipts).slice(0,-30))delete f.hermesReceipts[old];
 return receipt;
}

export function validFishingParty(s){
 const f=s.fishingParty;if(f===undefined)return true;
 if(!f||f.version!==1||!Array.isArray(f.history)||f.history.length>30||f.draft&&f.session)return false;
 const event=g=>g&&validCooperationSnapshot(g.cooperation)&&/^[\w-]{1,100}$/.test(g.id)&&g.template==='fishing'&&Number.isSafeInteger(g.version)&&g.version>0&&g.version<=100000&&(!g.tags||Array.isArray(g.tags)&&g.tags.length<=2&&new Set(g.tags).size===g.tags.length)&&validatePartyProposal(s,{...g,description:g.description||'',tags:g.tags||[],guestId:g.guestId??null}).ok&&typeof g.name==='string'&&g.name.length<=24&&['normal','easy'].includes(g.difficulty)&&g.invites&&typeof g.invites==='object';
 if(f.draft&&!event(f.draft))return false;
 const g=f.session;if(!g)return true;
 return event(g)&&['checkin','running','claimed','abandoned'].includes(g.phase)&&validFishingMatch(g.match)&&Array.isArray(g.participants)&&g.participants.length===eventRequests(g).length&&new Set(g.participants.map(p=>p.id)).size===eventRequests(g).length&&g.participants.every(p=>eventRequests(g).some(r=>r.id===p.id)&&typeof p.arrived==='boolean'&&(!p.position||Number.isFinite(p.position.x)&&Number.isFinite(p.position.y)))&&typeof g.playerArrived==='boolean'&&(!['running','claimed'].includes(g.phase)||g.playerArrived&&g.participants.every(p=>p.arrived))&&(g.phase==='claimed'?g.match.phase==='results'&&g.paid===30+Math.floor(fishingScore(g.match).normalized*.12)&&JSON.stringify(g.result)===JSON.stringify(fishingScore(g.match)):g.paid===null);
}
