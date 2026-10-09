import {captureCooperation} from '../src/cooperationEvidence.js';
import {awardNightCooperation} from '../src/eventWonders.js';
import{assertNightPlanning,syncNightPlanning,checkNightEvent}from'./nightPlanningActions.mjs';
import{nightReadiness,releaseNightPlan,completeNightDraft,validNightParty}from'../src/nightPartyPlanning.js';
import{eventRequests}from'../src/partyPlanning.js';
import {markFishingPartyDay} from './fishingActions.mjs';
import {nightPartyArrived} from '../src/nightPartyRuntime.js';

import {randomInt,createHash} from 'node:crypto';
import {reserveParty,completeParty} from '../src/economy.js';
import {trackJourney} from '../src/journey.js';
import {createNightPartyGame,applyNightPartyEvent,validNightPartyGame} from '../src/nightPartyReplay.js';
import {createNightSkyGame} from '../src/nightSkyGame.js';
const fail=(message,code='party_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const gameVersion=t=>t?.gameVersion===undefined?(t?.game?.engine==='night-sky'?2:1):t.gameVersion;
function requestedGameVersion(i){const version=i.gameVersion===undefined?1:i.gameVersion;if(version!==1&&version!==2)throw fail('夜集玩法版本不受支持，请刷新页面后再试','party_game_version');return version;}
const digest=e=>createHash('sha256').update(JSON.stringify(e)).digest('hex');
const paid=s=>Object.fromEntries(Object.entries(s.economy?.cashReceipts||{}).filter(([id])=>/^party-/.test(id)));
const session=t=>t?.kind==='party'?{id:t.eventId,day:t.day,fireworks:t.fireworks,outfit:t.outfit,round:t.game.round,score:t.game.score,phase:t.game.phase,...(t.design?{designId:t.design.id,name:t.design.name,participants:t.design.participants}:{} )}:null;
const mirror=b=>({version:1,nightLastDay:b.party.lastDay,completions:b.party.completions});
export function validPartyBook(p){return p===undefined||p&&p.version===1&&Number.isSafeInteger(p.lastDay)&&p.lastDay>=0&&Number.isSafeInteger(p.completions)&&p.completions>=0&&p.paid&&typeof p.paid==='object'&&(!p.design||validNightParty({nightParty:p.design})&&p.invites&&typeof p.invites==='object');}
export function validPartyTicket(t,receipt=false){return t?.kind==='party'&&t.item==='night'&&typeof t.eventId==='string'&&typeof t.fireworks==='boolean'&&(t.outfit===null||typeof t.outfit==='string')&&t.duration===2.3&&Number.isSafeInteger(t.day)&&t.day>0&&Number.isFinite(t.startedAt)&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt)&&Number.isSafeInteger(t.nextBatch)&&t.nextBatch>=1&&[1,2].includes(gameVersion(t))&&(receipt||t.game?.engine===(gameVersion(t)===2?'night-sky':'night')&&validNightPartyGame(t.game));}
export function assertPartyState(s,b){assertNightPlanning(s,b);if(b?.party&&(!same(s.partyControl,mirror(b))||!same(s.partySession??null,session(b.active))||!same(paid(s),b.party.paid)))throw fail('星灯夜集进度与奖励由服务端确认，请读取已确认进度','party_state_conflict');}
function sync(s,b){s.partyControl=mirror(b);s.partySession=session(b.active);b.party.paid=paid(s);syncNightPlanning(s,b);}
export function clearPartyState(s){delete s.nightAttendance;if(s.partyControl)s.partySession=null;delete s.partyControl;}
export function partyReplay(doc,i){if(i.kind!=='party'||!doc?.actions)return null;const b=doc.actions;
 if(i.operation==='enable'&&b.party)return {document:doc,ticket:null,receipt:null,replayed:true};
 if(i.operation==='begin'){const version=requestedGameVersion(i),t=b.active?.requestId===i.requestId?b.active:null,r=b.receipts.find(r=>r.ticket.requestId===i.requestId);if(t||r){const ticket=t||r.ticket;if(ticket.kind!=='party'||gameVersion(ticket)!==version||ticket.fireworks!==!!i.fireworks||(ticket.design?.id??null)!==(i.eventId??null)||(ticket.design?.version??null)!==(i.eventVersion??null)||(ticket.design?.stamp??null)!==(i.eventStamp??null))throw fail('同一开场编号不能更换派对用品','action_id_conflict');return {document:doc,ticket,receipt:r||null,replayed:true};}}
 else{
  const r=b.receipts.find(r=>r.ticket.kind==='party'&&r.ticket.requestId===i.requestId&&r.ticket.epoch===i.epoch&&r.ticket.sequence===i.sequence);if(r)return {document:doc,ticket:r.ticket,receipt:r,replayed:true};
  const t=b.active;if(i.operation==='checkpoint'&&t?.kind==='party'&&t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence&&i.batch===t.nextBatch-1){if(t.lastBatchHash!==digest(i.events))throw fail('同一批放飞操作不能更改','party_batch_conflict');return {document:doc,ticket:t,receipt:null,replayed:true};}
 }return null;
}
export function applyPartyCommand(s,b,i,now){
 if(i.operation==='enable'){if(!b.party){if(s.partySession)throw fail('旧版未结束夜集需要先结束；保留已有费用和存档','party_legacy_active');b.party={version:1,lastDay:s.lastPartyDay||0,completions:0,paid:paid(s)};sync(s,b);}return {ticket:null,receipt:null};}
 if(!b.party)throw fail('派对记录尚未启用','party_not_enabled');assertPartyState(s,b);
 if(i.operation==='begin'){
  const version=requestedGameVersion(i);
  if(b.active)throw fail('请先结束当前工作台或派对','action_active');if(i.expectedSequence!==b.sequence||(i.epoch??b.epoch)!==b.epoch&&i.epoch!==null)throw fail('当前作业版本已变化','action_sequence');
  if(s.day<=b.party.lastDay||!s.partyInvites?.[0]||!s.partyInvites?.[2])throw fail('今日已承办，或关键居民尚未同意参加','party_not_ready');
  let design=null;if(b.party.design?.draft){const d=checkNightEvent(s,i),r=nightReadiness(s);if(!r.ready||d.fireworks!==!!i.fireworks)throw fail(r.reason||'烟花约定已改变，请在手账重新确认','night_not_ready');releaseNightPlan(s,d);design={...structuredClone(d),cooperation:captureCooperation(s,d),stamp:i.eventStamp,participants:eventRequests(d).map(r=>r.id)};}else if(i.eventId)throw fail('夜集方案已经结束','night_draft_changed');
  const before=s.coins,p=reserveParty(s,{fireworks:!!i.fireworks,authoritativeEntry:true});if(!p)throw fail('派对条件、预算或可用用品不足','party_not_ready');
  const game=(version===2?createNightSkyGame:createNightPartyGame)(randomInt(1,0x100000000),design?.difficulty||'normal'),sequence=++b.sequence;
  const ticket={kind:'party',item:'night',name:'星灯夜集',eventId:p.id,requestId:i.requestId,epoch:b.epoch,sequence,day:s.day,fireworks:p.fireworks,outfit:p.outfit,startedAt:now,readyAt:now+2300,expiresAt:now+24*60*60*1000,duration:2.3,nextBatch:1,gameVersion:version,game,entryReceiptId:p.id+':entry',entryCost:before-s.coins,...(design?{design,name:design.name}:{})};
  b.active=ticket;b.party.lastDay=s.day;markFishingPartyDay(s,b,s.day);sync(s,b);return {ticket,receipt:null};
 }
 const t=b.active;if(!t||t.kind!=='party'||t.requestId!==i.requestId||t.epoch!==i.epoch||t.sequence!==i.sequence)throw fail('派对已结束或属于另一份存档','action_stale');
 if(i.operation==='checkpoint'){
  if(now>t.expiresAt)throw fail('派对已过期，可以结束本场','action_expired');if(i.batch!==t.nextBatch)throw fail('操作批次顺序不符','party_batch_sequence');
  if(!Array.isArray(i.events)||i.events.length<1||i.events.length>2048)throw fail('放飞操作批次无效','party_input');
  if(i.events.some(e=>['tap','launch','adjust'].includes(e?.action?.type))&&!nightPartyArrived(s))throw fail('两位居民还在收尾或前往广场，等大家实际到齐再放飞','party_arrival');
  const previous=t.game.round;
  try{for(const e of i.events)applyNightPartyEvent(t.game,e);}catch{throw fail('放飞操作未通过规则核对','party_input');}
  if(t.game.elapsed*1000>now-t.startedAt+150)throw fail('派对操作时间超过实际经过时间','party_clock');
  if(previous<4&&t.game.round===4)t.readyAt=now+2300;t.nextBatch++;t.lastBatchHash=digest(i.events);sync(s,b);return {ticket:t,receipt:null};
 }
 if(!['finish','cancel'].includes(i.operation))throw fail('不支持的派对操作');
 let reward=0,outcome='cancelled',text='星灯夜集中止；已投入场地和布置不退回，本场不发完成奖励。';
 if(i.operation==='finish'){
  if(t.game.round!==4)throw fail('四盏星灯尚未放飞','party_unfinished');if(now<t.readyAt)throw fail('放飞庆祝动画尚未完成','action_early');if(now>t.expiresAt)throw fail('派对已过期，可以结束本场','action_expired');
  reward=completeParty(s,t.game.score);if(!reward)throw fail('夜集奖励与账本不一致','action_ledger_conflict');outcome='finished';s.activities++;s.tasks.party=true;trackJourney(s,'party',{kind:'night',eventId:t.eventId});s.partyInvites={};s.npcAffinity??={};for(const id of(t.design?.participants||[0,2]))s.npcAffinity[id]=Math.min(100,(s.npcAffinity[id]??20)+3);b.party.completions++;text='星灯夜集完成，精准放飞 '+t.game.score+'/4，获得 '+reward+' 岛币。';
 }
 completeNightDraft(s,t,outcome,reward,t.game.score);
 if(outcome==='finished')awardNightCooperation(s,{...(t.design||{}),id:t.eventId,eventId:t.eventId,template:'night',entryReceiptId:t.entryReceiptId,outfit:t.outfit,fireworks:t.fireworks,phase:'finished',endedDay:s.day,paid:reward,score:t.game.score});
 const ticket={...t};delete ticket.game;delete ticket.lastBatchHash;const receipt={ticket,outcome,at:now,day:s.day,reward,score:t.game.score,text};b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);b.active=null;delete s.nightAttendance;sync(s,b);return {ticket,receipt};
}
