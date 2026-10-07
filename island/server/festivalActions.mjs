import {randomInt,createHash} from 'node:crypto';
import {hydrateFestival,festivalSnapshot,festivalOwner,createFestivalEvent,updateFestivalEvent,inviteFestivalNpc,createFestivalPlan,cancelFestivalDraft,startFestivalParty,finishFestivalParty,abandonFestivalParty,archiveFestivalParty,validFestivalParty} from '../src/festivalParty.js';
import {partyDraftStamp} from '../src/partyPlanning.js';
import {applyMarketEvent,validMarketGame} from '../src/marketRules.js';
import {markFishingPartyDay} from './fishingActions.mjs';
import {applyStewardEvent} from '../src/stewardParties.js';
const fail=(message,code='festival_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),digest=e=>createHash('sha256').update(JSON.stringify(e)).digest('hex');
const payments=s=>Object.fromEntries(Object.entries(s.economy?.cashReceipts||{}).filter(([id])=>/^market-\d+:(entry|reward)$/.test(id)));
const wonderProjection=s=>({owned:s.eventWonders?.owned?.market_lantern||null,receipts:Object.fromEntries(Object.entries(s.eventWonders?.receipts||{}).filter(([id])=>/^market-\d+$/.test(id))),sources:Object.fromEntries(Object.entries(s.eventWonders?.sources||{}).filter(([id])=>/^market-\d+$/.test(id))),hosted:Object.fromEntries(Object.entries(s.achievementBook?.hosted||{}).filter(([id])=>/^market-\d+$/.test(id)))});
const mirror=b=>({version:1,lastPartyDay:b.festival.lastDay});
export const FESTIVAL_OPERATIONS=['festival_enable','festival_create','festival_update','festival_invite','festival_plan','festival_cancel','festival_archive','festival_steward'];
function sync(s,b){b.festival.snapshot=festivalSnapshot(s);b.festival.paid=payments(s);b.festival.wonders=wonderProjection(s);s.festivalControl=mirror(b);}
export function validFestivalBook(f){
 return f===undefined||!!(f&&f.version===1&&Number.isSafeInteger(f.lastDay)&&f.lastDay>=0&&validFestivalParty({festivalParty:f.snapshot})&&f.snapshot&&f.paid&&typeof f.paid==='object'&&!Array.isArray(f.paid)&&Object.entries(f.paid).every(([id,v])=>/^market-\d+:(entry|reward)$/.test(id)&&v===true)&&f.wonders&&typeof f.wonders==='object'&&(f.hold===null||f.hold&&typeof f.hold==='object'));
}
export function validFestivalTicket(t,receipt=false){
 return !!(t?.kind==='festival'&&t.item==='market'&&typeof t.eventId==='string'&&/^market-\d+$/.test(t.eventId)&&Number.isSafeInteger(t.eventVersion)&&t.eventVersion>0&&typeof t.eventStamp==='string'&&t.eventStamp.length<=1000&&Number.isSafeInteger(t.day)&&t.day>0&&Number.isFinite(t.startedAt)&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt)&&t.duration===2.4&&Number.isSafeInteger(t.nextBatch)&&t.nextBatch>0&&(receipt||validMarketGame(t.game)));
}
export function assertFestivalState(s,b){
 if(b?.festival&&(!same(s.festivalControl,mirror(b))||s.lastPartyDay!==b.festival.lastDay||!same(festivalSnapshot(s),b.festival.snapshot)||!same(payments(s),b.festival.paid)||!same(wonderProjection(s),b.festival.wonders)))throw fail('集市方案、赠物、商品与纪念品由服务端确认，请核对已保存进度','festival_state_conflict');
}
export function festivalHolds(b){const f=b?.festival,g=f?.snapshot.session;return f?.hold&&g?{[festivalOwner(g.id)]:structuredClone(f.hold)}:{};}
export function clearFestivalState(s,{returnStock=false}={}){
 if(s.festivalControl&&s.festivalParty?.session?.phase==='running'){
  abandonFestivalParty(s,{recover:true,refund:returnStock});s.events??=[];s.events.unshift(returnStock?'恢复备份已收起集市；未售商品退回，不发完成收益。':'导入时已收起原集市；不基于外来记录自动生成退货或完成收益。');s.events=s.events.slice(0,7);
 }
 delete s.festivalControl;delete s.festivalAttendance;
}
export function enableFestival(s,b){
 if(b.festival){assertFestivalState(s,b);return;}
 if(s.festivalParty?.session?.phase==='running')throw fail('旧版集市仍在进行，需要先明确结束','festival_legacy_active');
 hydrateFestival(s);const day=Math.max(s.lastPartyDay||0,b.fishing?.lastDay||0,b.party?.lastDay||0);
 b.festival={version:1,lastDay:day,snapshot:festivalSnapshot(s),paid:payments(s),wonders:wonderProjection(s),hold:null};markFishingPartyDay(s,b,day);sync(s,b);
}
function checkEvent(s,i){
 const d=hydrateFestival(s).draft;
 if((d?.id||null)!==(i.eventId??null)||(d?.version||null)!==(i.eventVersion??null)||partyDraftStamp(d)!==(i.eventStamp??null))throw fail('集市方案已变化，请重新打开筹备','festival_draft_changed');
 return d;
}
export function applyFestivalManagement(s,b,i){
 enableFestival(s,b);if(i.operation==='festival_enable')return{ok:true};let r;
 if(i.operation==='festival_steward'){if(!i.verifiedProposal)throw fail('没有当前岛屿的服务端管家活动回执','festival_proof');r=applyStewardEvent(s,i.verifiedProposal,i.runId,'market');}
 else if(i.operation==='festival_archive'){if(s.festivalParty.session?.id!==i.eventId)throw fail('集市结果已变化');r=archiveFestivalParty(s);delete s.festivalAttendance;}
 else{
  checkEvent(s,i);
  if(i.operation==='festival_create')r=createFestivalEvent(s,i.proposal);
  else if(i.operation==='festival_update')r=updateFestivalEvent(s,i.proposal);
  else if(i.operation==='festival_invite')r=inviteFestivalNpc(s,i.npcId);
  else if(i.operation==='festival_plan')r=createFestivalPlan(s);
  else if(i.operation==='festival_cancel')r=cancelFestivalDraft(s);
  else throw fail('集市管理操作无效');
 }
 if(!r?.ok)throw fail(r?.reason||'集市条件尚未满足','festival_not_ready');
 if(['festival_create','festival_update'].includes(i.operation))delete hydrateFestival(s).composer;
 if(!validFestivalParty(s))throw fail('集市记录未通过校验');
 sync(s,b);return{...r,text:({'festival_create':'集市方案已发布','festival_update':'集市方案已更新','festival_invite':'赠物已送达，居民同意参加当前版本','festival_plan':'集市物资筹备已登记','festival_cancel':'筹备已取消，未使用商品保留，已送赠物留给居民','festival_archive':'本场集市结果已归档','festival_steward':'管家集市方案和实际物资清单已登记'})[i.operation]};
}
function actualAt(s,g,npc,target,{orderId=null}={}){
 const pose=s.festivalAttendance?.id===g.id?s.festivalAttendance.people?.[npc]:null,live=npc===-1?s.player:s.npcPresence?.find(n=>n.id===npc);
 return !!(pose&&live&&pose.inside===null&&live.inside==null&&Math.hypot(pose.x-target.x,pose.y-target.y)<=8&&Math.hypot(live.x-target.x,live.y-target.y)<=8&&(orderId===null||pose.role==='buyer'&&pose.orderId===orderId));
}
function everyoneAt(s,g){return actualAt(s,g,-1,g.layout.player)&&g.participants.every((p,k)=>actualAt(s,g,p.id,g.layout.staff[k]));}
export function festivalReplay(doc,i){
 if(i.kind!=='festival'||!doc?.actions)return null;const b=doc.actions;
 if(i.operation==='begin'){
  const t=b.active?.requestId===i.requestId?b.active:b.receipts.find(r=>r.ticket.requestId===i.requestId)?.ticket;
  if(t){if(t.kind!=='festival'||t.eventId!==i.eventId||t.eventVersion!==i.eventVersion||t.eventStamp!==i.eventStamp)throw fail('同一开场编号不能更换活动方案','action_id_conflict');return{document:doc,ticket:t,receipt:b.receipts.find(r=>r.ticket.requestId===i.requestId)||null,replayed:true};}
 }else{
  const r=b.receipts.find(r=>r.ticket.kind==='festival'&&r.ticket.requestId===i.requestId&&r.ticket.epoch===i.epoch&&r.ticket.sequence===i.sequence);
  if(r)return{document:doc,ticket:r.ticket,receipt:r,replayed:true};
  const t=b.active;
  if(i.operation==='checkpoint'&&t?.kind==='festival'&&t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence&&i.batch===t.nextBatch-1){
   if(t.lastBatchHash!==digest(i.events))throw fail('同一批集市操作不能更改','festival_batch_conflict');
   return{document:doc,ticket:t,receipt:null,replayed:true};
  }
 }return null;
}
export function applyFestivalCommand(s,b,i,now){
 if(!b.festival)throw fail('集市账本尚未启用','festival_not_enabled');assertFestivalState(s,b);
 if(i.operation==='begin'){
  const d=checkEvent(s,i);if(!d)throw fail('先发布集市方案','festival_not_ready');
  if(b.active)throw fail('先完成或取消当前作业','action_active');
  if(i.expectedSequence!==b.sequence||(i.epoch??b.epoch)!==b.epoch&&i.epoch!==null)throw fail('当前作业版本已变化','action_sequence');
  if(s.day<=b.festival.lastDay)throw fail('今日已经承办派对','festival_not_ready');
  const r=startFestivalParty(s,{seed:randomInt(1,0x100000000),theme:i.theme});if(!r.ok)throw fail(r.reason,'festival_not_ready');
  markFishingPartyDay(s,b,s.day);
  const t={kind:'festival',item:'market',name:d.name,eventId:d.id,eventVersion:d.version,eventStamp:i.eventStamp,requestId:i.requestId,epoch:b.epoch,sequence:++b.sequence,duration:2.4,day:s.day,startedAt:now,readyAt:now+2400,expiresAt:now+24*3600000,nextBatch:1,game:structuredClone(r.session.game)};
  b.active=t;b.festival.hold=structuredClone(s.resourceLedger.reservations[festivalOwner(d.id)]);sync(s,b);return{ticket:t,receipt:null};
 }
 const t=b.active,g=hydrateFestival(s).session;
 if(t?.kind!=='festival'||!g||t.eventId!==g.id||t.requestId!==i.requestId||t.epoch!==i.epoch||t.sequence!==i.sequence)throw fail('集市已结束或来自另一份存档','action_stale');
 if(i.operation==='checkpoint'){
  if(now>t.expiresAt)throw fail('本场已过期，可以结束并退回未售商品','action_expired');
  if(i.batch!==t.nextBatch)throw fail('集市操作批次顺序不符','festival_batch_sequence');
  if(!Array.isArray(i.events)||i.events.length<1||i.events.length>2048)throw fail('集市操作批次无效','festival_input');
  const phase=t.game.phase;
  for(const e of i.events){
   if(e?.action?.type==='start'&&!everyoneAt(s,g))throw fail('摊主与岛主还在赴约，实际到齐后再营业','festival_arrival');
   if(e?.action?.type==='arrive'){
    const o=t.game.queue.find(o=>o.id===e.action.index);
    if(!o||!actualAt(s,g,o.npcId,g.layout.buyers[o.id%4],{orderId:o.id}))throw fail('顾客还在前往专属摊位，实际到达后再接单','festival_arrival');
   }
   try{applyMarketEvent(t.game,e);}catch{throw fail('集市操作未通过规则核对','festival_input');}
  }
  if(!validMarketGame(t.game))throw fail('集市规则状态无效','festival_input');
  if(t.game.elapsed*1000>now-t.startedAt+150)throw fail('集市有效时间超过实际经过时间','festival_clock');
  if(phase!=='results'&&t.game.phase==='results')t.readyAt=now+2400;
  g.game=structuredClone(t.game);t.nextBatch++;t.lastBatchHash=digest(i.events);sync(s,b);return{ticket:t,receipt:null};
 }
 if(!['finish','cancel'].includes(i.operation))throw fail('集市作业操作无效');
 let details,text,outcome;
 if(i.operation==='finish'){
  if(t.game.phase!=='results')throw fail('三波顾客还未结束','festival_unfinished');
  if(now<t.readyAt)throw fail('集市收摊庆祝动画尚未结束','action_early');
  if(now>t.expiresAt)throw fail('本场已过期，可以结束并退回未售商品','action_expired');
  details=finishFestivalParty(s);if(!details.ok||details.replayed)throw fail(details.reason||'收益记录冲突','action_ledger_conflict');
  outcome='finished';text='集市完成，服务'+details.result.served+'位顾客，品质'+details.result.quality+'分，获得'+details.reward+'岛币；未售商品已退回。';
 }else{details=abandonFestivalParty(s);if(!details.ok)throw fail(details.reason,'action_ledger_conflict');outcome='cancelled';text='集市已收摊，未售商品退回；已售商品和场地费不退，本场不发完成收益。';}
 const ticket={...t};delete ticket.game;delete ticket.lastBatchHash;
 const receipt={ticket,outcome,at:now,day:s.day,text,reward:outcome==='finished'?details.reward:0,details};
 b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);b.active=null;b.festival.hold=null;delete s.festivalAttendance;sync(s,b);return{ticket,receipt};
}
