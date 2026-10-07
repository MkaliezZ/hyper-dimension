import {releaseResources} from '../src/resourceLedger.js';
import {fireworksTarget} from '../src/fireworksLayout.js';
import {randomInt,createHash} from 'node:crypto';
import {hydrateFireworks,fireworksSnapshot,fireworksOwner,createFireworksEvent,updateFireworksEvent,inviteFireworksNpc,createFireworksPlan,cancelFireworksDraft,startFireworksParty,finishFireworksParty,abandonFireworksParty,archiveFireworksParty,validFireworksParty} from '../src/fireworksParty.js';
import {partyDraftStamp} from '../src/partyPlanning.js';
import {applyFireworksEvent,validFireworksGame} from '../src/fireworksRules.js';
import {markFishingPartyDay} from './fishingActions.mjs';
import {applyStewardEvent} from '../src/stewardParties.js';
const fail=(message,code='fireworks_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),digest=e=>createHash('sha256').update(JSON.stringify(e)).digest('hex');
const payments=s=>Object.fromEntries(Object.entries(s.economy?.cashReceipts||{}).filter(([id])=>/^fireworks-\d+:(entry|reward)$/.test(id)));
const consumption=s=>Object.fromEntries(Object.entries(s.resourceLedger?.receipts||{}).filter(([id])=>/^fireworks-fired:fireworks-\d+$/.test(id)));
const wonderProjection=s=>({owned:s.eventWonders?.owned?.fireworks_orbit||null,receipts:Object.fromEntries(Object.entries(s.eventWonders?.receipts||{}).filter(([id])=>/^fireworks-\d+$/.test(id))),sources:Object.fromEntries(Object.entries(s.eventWonders?.sources||{}).filter(([id])=>/^fireworks-\d+$/.test(id))),hosted:Object.fromEntries(Object.entries(s.achievementBook?.hosted||{}).filter(([id])=>/^fireworks-\d+$/.test(id)))});
const mirror=b=>({version:1,lastPartyDay:b.fireworks.lastDay});
export const FIREWORKS_OPERATIONS=['fireworks_enable','fireworks_create','fireworks_update','fireworks_invite','fireworks_plan','fireworks_cancel','fireworks_archive','fireworks_steward'];
function sync(s,b){b.fireworks.snapshot=fireworksSnapshot(s);b.fireworks.paid=payments(s);b.fireworks.wonders=wonderProjection(s);b.fireworks.fired=consumption(s);s.fireworksControl=mirror(b);}
export function validFireworksBook(f){
 return f===undefined||!!(f&&f.version===1&&Number.isSafeInteger(f.lastDay)&&f.lastDay>=0&&validFireworksParty({fireworksParty:f.snapshot})&&f.snapshot&&f.paid&&typeof f.paid==='object'&&!Array.isArray(f.paid)&&Object.entries(f.paid).every(([id,v])=>/^fireworks-\d+:(entry|reward)$/.test(id)&&v===true)&&f.fired&&typeof f.fired==='object'&&!Array.isArray(f.fired)&&Object.entries(f.fired).every(([id,r])=>/^fireworks-fired:fireworks-\d+$/.test(id)&&r?.category==='party_fireworks'&&Number.isSafeInteger(r.delta?.firework)&&r.delta.firework<=-1&&r.delta.firework>=-6&&Object.keys(r.delta).length===1)&&f.wonders&&typeof f.wonders==='object'&&(f.hold===null||f.hold&&typeof f.hold==='object'));
}
export function validFireworksTicket(t,receipt=false){
 return !!(t?.kind==='fireworks'&&t.item==='fireworks'&&typeof t.eventId==='string'&&/^fireworks-\d+$/.test(t.eventId)&&Number.isSafeInteger(t.eventVersion)&&t.eventVersion>0&&typeof t.eventStamp==='string'&&t.eventStamp.length<=1000&&Number.isSafeInteger(t.day)&&t.day>0&&Number.isFinite(t.startedAt)&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt)&&t.duration===2.4&&Number.isSafeInteger(t.nextBatch)&&t.nextBatch>0&&(receipt||validFireworksGame(t.game)));
}
export function assertFireworksState(s,b){
 if(b?.fireworks&&(!same(s.fireworksControl,mirror(b))||s.lastPartyDay!==b.fireworks.lastDay||!same(fireworksSnapshot(s),b.fireworks.snapshot)||!same(payments(s),b.fireworks.paid)||!same(wonderProjection(s),b.fireworks.wonders)||!same(consumption(s),b.fireworks.fired)))throw fail('烟花大会方案、赠物、烟花与纪念品由服务端确认，请核对已保存进度','fireworks_state_conflict');
}
export function fireworksHolds(b){const f=b?.fireworks,g=f?.snapshot.session;return f?.hold&&g?{[fireworksOwner(g.id)]:structuredClone(f.hold)}:{};}
export function clearFireworksState(s,{consumeFired=false}={}){
 if(s.fireworksControl&&s.fireworksParty?.session?.phase==='running'){
  const g=s.fireworksParty.session;if(consumeFired){const r=abandonFireworksParty(s);if(!r.ok)throw fail('可信恢复的烟花使用数量未通过核对，请保留现有进度','fireworks_restore');}
  else{releaseResources(s,fireworksOwner(g.id));g.phase='abandoned';g.paid=0;g.result=null;g.endedDay=s.day;s.fireworksParty.history.unshift(structuredClone(g));s.fireworksParty.history=s.fireworksParty.history.slice(0,20);}
  s.events??=[];s.events.unshift('恢复或导入已收起烟花大会，未使用烟花与旗帜解除留用，不追加完成奖励。');s.events=s.events.slice(0,7);
 }delete s.fireworksControl;delete s.fireworksAttendance;
}
export function enableFireworks(s,b){
 if(b.fireworks){assertFireworksState(s,b);return;}
 if(s.fireworksParty?.session?.phase==='running')throw fail('旧版烟花大会仍在进行，需要先明确结束','fireworks_legacy_active');
 hydrateFireworks(s);const day=Math.max(s.lastPartyDay||0,b.fishing?.lastDay||0,b.party?.lastDay||0);
 b.fireworks={version:1,lastDay:day,snapshot:fireworksSnapshot(s),paid:payments(s),wonders:wonderProjection(s),fired:consumption(s),hold:null};markFishingPartyDay(s,b,day);sync(s,b);
}
function checkEvent(s,i){
 const d=hydrateFireworks(s).draft;
 if((d?.id||null)!==(i.eventId??null)||(d?.version||null)!==(i.eventVersion??null)||partyDraftStamp(d)!==(i.eventStamp??null))throw fail('烟花大会方案已变化，请重新打开筹备','fireworks_draft_changed');
 return d;
}
export function applyFireworksManagement(s,b,i){
 enableFireworks(s,b);if(i.operation==='fireworks_enable')return{ok:true};let r;
 if(i.operation==='fireworks_steward'){if(!i.verifiedProposal)throw fail('没有当前岛屿的服务端管家活动回执','fireworks_proof');r=applyStewardEvent(s,i.verifiedProposal,i.runId,'fireworks');}
 else if(i.operation==='fireworks_archive'){if(s.fireworksParty.session?.id!==i.eventId)throw fail('烟花大会结果已变化');r=archiveFireworksParty(s);delete s.fireworksAttendance;}
 else{
  checkEvent(s,i);
  if(i.operation==='fireworks_create')r=createFireworksEvent(s,i.proposal);
  else if(i.operation==='fireworks_update')r=updateFireworksEvent(s,i.proposal);
  else if(i.operation==='fireworks_invite')r=inviteFireworksNpc(s,i.npcId);
  else if(i.operation==='fireworks_plan')r=createFireworksPlan(s);
  else if(i.operation==='fireworks_cancel')r=cancelFireworksDraft(s);
  else throw fail('烟花大会管理操作无效');
 }
 if(!r?.ok)throw fail(r?.reason||'烟花大会条件尚未满足','fireworks_not_ready');
 if(['fireworks_create','fireworks_update'].includes(i.operation))delete hydrateFireworks(s).composer;
 if(!validFireworksParty(s))throw fail('烟花大会记录未通过校验');
 sync(s,b);return{...r,text:({'fireworks_create':'烟花大会方案已发布','fireworks_update':'烟花大会方案已更新','fireworks_invite':'赠物已送达，居民同意参加当前版本','fireworks_plan':'烟花大会物资筹备已登记','fireworks_cancel':'筹备已取消，未使用烟花保留，已送赠物留给居民','fireworks_archive':'本场烟花大会结果已归档','fireworks_steward':'管家烟花大会方案和实际物资清单已登记'})[i.operation]};
}
function actualAt(s,g,npc,target,{orderId=null}={}){
 const pose=s.fireworksAttendance?.id===g.id?s.fireworksAttendance.people?.[npc]:null,live=npc===-1?s.player:s.npcPresence?.find(n=>n.id===npc);
 return !!(pose&&live&&pose.inside===null&&live.inside==null&&Math.hypot(pose.x-target.x,pose.y-target.y)<=8&&Math.hypot(live.x-target.x,live.y-target.y)<=8&&(orderId===null||pose.role==='buyer'&&pose.orderId===orderId));
}
function everyoneAt(s,g,game){return [-1,...g.participants.map(p=>p.id)].every(id=>actualAt(s,g,id,fireworksTarget(g,id,game)));}
export function fireworksReplay(doc,i){
 if(i.kind!=='fireworks'||!doc?.actions)return null;const b=doc.actions;
 if(i.operation==='begin'){
  const t=b.active?.requestId===i.requestId?b.active:b.receipts.find(r=>r.ticket.requestId===i.requestId)?.ticket;
  if(t){if(t.kind!=='fireworks'||t.eventId!==i.eventId||t.eventVersion!==i.eventVersion||t.eventStamp!==i.eventStamp)throw fail('同一开场编号不能更换活动方案','action_id_conflict');return{document:doc,ticket:t,receipt:b.receipts.find(r=>r.ticket.requestId===i.requestId)||null,replayed:true};}
 }else{
  const r=b.receipts.find(r=>r.ticket.kind==='fireworks'&&r.ticket.requestId===i.requestId&&r.ticket.epoch===i.epoch&&r.ticket.sequence===i.sequence);
  if(r)return{document:doc,ticket:r.ticket,receipt:r,replayed:true};
  const t=b.active;
  if(i.operation==='checkpoint'&&t?.kind==='fireworks'&&t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence&&i.batch===t.nextBatch-1){
   if(t.lastBatchHash!==digest(i.events))throw fail('同一批烟花大会操作不能更改','fireworks_batch_conflict');
   return{document:doc,ticket:t,receipt:null,replayed:true};
  }
 }return null;
}
export function applyFireworksCommand(s,b,i,now){
 if(!b.fireworks)throw fail('烟花大会账本尚未启用','fireworks_not_enabled');assertFireworksState(s,b);
 if(i.operation==='begin'){
  const d=checkEvent(s,i);if(!d)throw fail('先发布烟花大会方案','fireworks_not_ready');
  if(b.active)throw fail('先完成或取消当前作业','action_active');
  if(i.expectedSequence!==b.sequence||(i.epoch??b.epoch)!==b.epoch&&i.epoch!==null)throw fail('当前作业版本已变化','action_sequence');
  if(s.day<=b.fireworks.lastDay)throw fail('今日已经承办派对','fireworks_not_ready');
  const r=startFireworksParty(s,{seed:randomInt(1,0x100000000),theme:i.theme});if(!r.ok)throw fail(r.reason,'fireworks_not_ready');
  markFishingPartyDay(s,b,s.day);
  const t={kind:'fireworks',item:'fireworks',name:d.name,eventId:d.id,eventVersion:d.version,eventStamp:i.eventStamp,requestId:i.requestId,epoch:b.epoch,sequence:++b.sequence,duration:2.4,day:s.day,startedAt:now,readyAt:now+2400,expiresAt:now+24*3600000,nextBatch:1,game:structuredClone(r.session.game)};
  b.active=t;b.fireworks.hold=structuredClone(s.resourceLedger.reservations[fireworksOwner(d.id)]);sync(s,b);return{ticket:t,receipt:null};
 }
 const t=b.active,g=hydrateFireworks(s).session;
 if(t?.kind!=='fireworks'||!g||t.eventId!==g.id||t.requestId!==i.requestId||t.epoch!==i.epoch||t.sequence!==i.sequence)throw fail('烟花大会已结束或来自另一份存档','action_stale');
 if(i.operation==='checkpoint'){
  if(now>t.expiresAt)throw fail('本场已过期，可以结束并归还未发射烟花','action_expired');
  if(i.batch!==t.nextBatch)throw fail('烟花大会操作批次顺序不符','fireworks_batch_sequence');
  if(!Array.isArray(i.events)||i.events.length<1||i.events.length>2048)throw fail('烟花大会操作批次无效','fireworks_input');
  const phase=t.game.phase;
  for(const e of i.events){
   if(e?.action?.type==='start'&&!everyoneAt(s,g,t.game))throw fail('协作居民和岛主还在赴约，实际到齐后再开场','fireworks_arrival');
   if(['submit','launch'].includes(e?.action?.type)&&!everyoneAt(s,g,t.game))throw fail('协作居民与岛主尚未在各自岗位，实际到齐后才能编排和发射','fireworks_arrival');
   try{applyFireworksEvent(t.game,e);}catch{throw fail('烟花大会操作未通过规则核对','fireworks_input');}
  }
  if(!validFireworksGame(t.game))throw fail('烟花大会规则状态无效','fireworks_input');
  if(t.game.elapsed*1000>now-t.startedAt+150)throw fail('烟花大会有效时间超过实际经过时间','fireworks_clock');
  if(phase!=='results'&&t.game.phase==='results')t.readyAt=now+2400;
  g.game=structuredClone(t.game);t.nextBatch++;t.lastBatchHash=digest(i.events);sync(s,b);return{ticket:t,receipt:null};
 }
 if(!['finish','cancel'].includes(i.operation))throw fail('烟花大会作业操作无效');
 let details,text,outcome;
 if(i.operation==='finish'){
  if(t.game.phase!=='results')throw fail('三幕烟花还未演出完毕','fireworks_unfinished');
  if(now<t.readyAt)throw fail('烟花大会收摊庆祝动画尚未结束','action_early');
  if(now>t.expiresAt)throw fail('本场已过期，可以结束并归还未发射烟花','action_expired');
  details=finishFireworksParty(s);if(!details.ok||details.replayed)throw fail(details.reason||'收益记录冲突','action_ledger_conflict');
  outcome='finished';text='烟花大会完成，三幕品质'+details.result.quality+'分、合拍命中'+details.result.hits+'/6，实际发射'+details.result.fired+'枚，获得'+details.reward+'岛币；未发射烟花和主题旗已解除留用。';
 }else{details=abandonFireworksParty(s);if(!details.ok)throw fail(details.reason,'action_ledger_conflict');outcome='cancelled';text='烟花大会提前结束，实际烟花和主题旗已解除留用；场地费、实际发射烟花、后台茶与已交赠物不退，不发完成收益。';}
 const ticket={...t};delete ticket.game;delete ticket.lastBatchHash;
 const receipt={ticket,outcome,at:now,day:s.day,text,reward:outcome==='finished'?details.reward:0,details};
 b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);b.active=null;b.fireworks.hold=null;delete s.fireworksAttendance;sync(s,b);return{ticket,receipt};
}
