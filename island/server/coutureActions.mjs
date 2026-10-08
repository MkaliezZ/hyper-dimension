import {coutureTarget} from '../src/coutureLayout.js';
import {randomInt,createHash} from 'node:crypto';
import {hydrateCouture,coutureSnapshot,coutureOwner,createCoutureEvent,updateCoutureEvent,inviteCoutureNpc,createCouturePlan,cancelCoutureDraft,startCoutureParty,finishCoutureParty,abandonCoutureParty,archiveCoutureParty,validCoutureParty} from '../src/coutureParty.js';
import {partyDraftStamp} from '../src/partyPlanning.js';
import {applyCoutureEvent,validCoutureGame} from '../src/coutureRules.js';
import {markFishingPartyDay} from './fishingActions.mjs';
import {applyStewardEvent} from '../src/stewardParties.js';
const fail=(message,code='couture_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),digest=e=>createHash('sha256').update(JSON.stringify(e)).digest('hex');
const payments=s=>Object.fromEntries(Object.entries(s.economy?.cashReceipts||{}).filter(([id])=>/^couture-\d+:(entry|reward)$/.test(id)));
const wonderProjection=s=>({owned:s.eventWonders?.owned?.couture_ribbon||null,receipts:Object.fromEntries(Object.entries(s.eventWonders?.receipts||{}).filter(([id])=>/^couture-\d+$/.test(id))),sources:Object.fromEntries(Object.entries(s.eventWonders?.sources||{}).filter(([id])=>/^couture-\d+$/.test(id))),hosted:Object.fromEntries(Object.entries(s.achievementBook?.hosted||{}).filter(([id])=>/^couture-\d+$/.test(id)))});
const mirror=b=>({version:1,lastPartyDay:b.couture.lastDay});
export const COUTURE_OPERATIONS=['couture_enable','couture_create','couture_update','couture_invite','couture_plan','couture_cancel','couture_archive','couture_steward'];
function sync(s,b){b.couture.snapshot=coutureSnapshot(s);b.couture.paid=payments(s);b.couture.wonders=wonderProjection(s);s.coutureControl=mirror(b);}
export function validCoutureBook(f){
 return f===undefined||!!(f&&f.version===1&&Number.isSafeInteger(f.lastDay)&&f.lastDay>=0&&validCoutureParty({coutureParty:f.snapshot})&&f.snapshot&&f.paid&&typeof f.paid==='object'&&!Array.isArray(f.paid)&&Object.entries(f.paid).every(([id,v])=>/^couture-\d+:(entry|reward)$/.test(id)&&v===true)&&f.wonders&&typeof f.wonders==='object'&&(f.hold===null||f.hold&&typeof f.hold==='object'));
}
export function validCoutureTicket(t,receipt=false){
 return !!(t?.kind==='couture'&&t.item==='couture'&&typeof t.eventId==='string'&&/^couture-\d+$/.test(t.eventId)&&Number.isSafeInteger(t.eventVersion)&&t.eventVersion>0&&typeof t.eventStamp==='string'&&t.eventStamp.length<=1000&&Number.isSafeInteger(t.day)&&t.day>0&&Number.isFinite(t.startedAt)&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt)&&t.duration===2.4&&Number.isSafeInteger(t.nextBatch)&&t.nextBatch>0&&(receipt||validCoutureGame(t.game)));
}
export function assertCoutureState(s,b){
 if(b?.couture&&(!same(s.coutureControl,mirror(b))||s.lastPartyDay!==b.couture.lastDay||!same(coutureSnapshot(s),b.couture.snapshot)||!same(payments(s),b.couture.paid)||!same(wonderProjection(s),b.couture.wonders)))throw fail('穿搭大会方案、赠物、服装与纪念品由服务端确认，请核对已保存进度','couture_state_conflict');
}
export function coutureHolds(b){const f=b?.couture,g=f?.snapshot.session;return f?.hold&&g?{[coutureOwner(g.id)]:structuredClone(f.hold)}:{};}
export function clearCoutureState(s){
 if(s.coutureControl&&s.coutureParty?.session?.phase==='running'){
  abandonCoutureParty(s);s.events??=[];s.events.unshift('恢复或导入已收起穿搭大会；服装解除留用，实际场地与后台消耗不退，不追加完成奖励。');s.events=s.events.slice(0,7);
 }
 delete s.coutureControl;delete s.coutureAttendance;
}
export function enableCouture(s,b){
 if(b.couture){assertCoutureState(s,b);return;}
 if(s.coutureParty?.session?.phase==='running')throw fail('旧版穿搭大会仍在进行，需要先明确结束','couture_legacy_active');
 hydrateCouture(s);const day=Math.max(s.lastPartyDay||0,b.fishing?.lastDay||0,b.party?.lastDay||0);
 b.couture={version:1,lastDay:day,snapshot:coutureSnapshot(s),paid:payments(s),wonders:wonderProjection(s),hold:null};markFishingPartyDay(s,b,day);sync(s,b);
}
function checkEvent(s,i){
 const d=hydrateCouture(s).draft;
 if((d?.id||null)!==(i.eventId??null)||(d?.version||null)!==(i.eventVersion??null)||partyDraftStamp(d)!==(i.eventStamp??null))throw fail('穿搭大会方案已变化，请重新打开筹备','couture_draft_changed');
 return d;
}
export function applyCoutureManagement(s,b,i){
 enableCouture(s,b);if(i.operation==='couture_enable')return{ok:true};let r;
 if(i.operation==='couture_steward'){if(!i.verifiedProposal)throw fail('没有当前岛屿的服务端管家活动回执','couture_proof');r=applyStewardEvent(s,i.verifiedProposal,i.runId,'couture');}
 else if(i.operation==='couture_archive'){if(s.coutureParty.session?.id!==i.eventId)throw fail('穿搭大会结果已变化');r=archiveCoutureParty(s);delete s.coutureAttendance;}
 else{
  checkEvent(s,i);
  if(i.operation==='couture_create')r=createCoutureEvent(s,i.proposal);
  else if(i.operation==='couture_update')r=updateCoutureEvent(s,i.proposal);
  else if(i.operation==='couture_invite')r=inviteCoutureNpc(s,i.npcId);
  else if(i.operation==='couture_plan')r=createCouturePlan(s);
  else if(i.operation==='couture_cancel')r=cancelCoutureDraft(s);
  else throw fail('穿搭大会管理操作无效');
 }
 if(!r?.ok)throw fail(r?.reason||'穿搭大会条件尚未满足','couture_not_ready');
 if(['couture_create','couture_update'].includes(i.operation))delete hydrateCouture(s).composer;
 if(!validCoutureParty(s))throw fail('穿搭大会记录未通过校验');
 sync(s,b);return{...r,text:({'couture_create':'穿搭大会方案已发布','couture_update':'穿搭大会方案已更新','couture_invite':'赠物已送达，居民同意参加当前版本','couture_plan':'穿搭大会物资筹备已登记','couture_cancel':'筹备已取消，未使用服装保留，已送赠物留给居民','couture_archive':'本场穿搭大会结果已归档','couture_steward':'管家穿搭大会方案和实际物资清单已登记'})[i.operation]};
}
function actualAt(s,g,npc,target,{orderId=null}={}){
 const pose=s.coutureAttendance?.id===g.id?s.coutureAttendance.people?.[npc]:null,live=npc===-1?s.player:s.npcPresence?.find(n=>n.id===npc);
 return !!(pose&&live&&pose.inside===null&&live.inside==null&&Math.hypot(pose.x-target.x,pose.y-target.y)<=8&&Math.hypot(live.x-target.x,live.y-target.y)<=8&&(orderId===null||pose.role==='buyer'&&pose.orderId===orderId));
}
function everyoneAt(s,g,game){return [-1,...g.participants.map(p=>p.id)].every(id=>actualAt(s,g,id,coutureTarget(g,id,game)));}
export function coutureReplay(doc,i){
 if(i.kind!=='couture'||!doc?.actions)return null;const b=doc.actions;
 if(i.operation==='begin'){
  const t=b.active?.requestId===i.requestId?b.active:b.receipts.find(r=>r.ticket.requestId===i.requestId)?.ticket;
  if(t){if(t.kind!=='couture'||t.eventId!==i.eventId||t.eventVersion!==i.eventVersion||t.eventStamp!==i.eventStamp)throw fail('同一开场编号不能更换活动方案','action_id_conflict');return{document:doc,ticket:t,receipt:b.receipts.find(r=>r.ticket.requestId===i.requestId)||null,replayed:true};}
 }else{
  const r=b.receipts.find(r=>r.ticket.kind==='couture'&&r.ticket.requestId===i.requestId&&r.ticket.epoch===i.epoch&&r.ticket.sequence===i.sequence);
  if(r)return{document:doc,ticket:r.ticket,receipt:r,replayed:true};
  const t=b.active;
  if(i.operation==='checkpoint'&&t?.kind==='couture'&&t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence&&i.batch===t.nextBatch-1){
   if(t.lastBatchHash!==digest(i.events))throw fail('同一批穿搭大会操作不能更改','couture_batch_conflict');
   return{document:doc,ticket:t,receipt:null,replayed:true};
  }
 }return null;
}
export function applyCoutureCommand(s,b,i,now){
 if(!b.couture)throw fail('穿搭大会账本尚未启用','couture_not_enabled');assertCoutureState(s,b);
 if(i.operation==='begin'){
  const d=checkEvent(s,i);if(!d)throw fail('先发布穿搭大会方案','couture_not_ready');
  if(b.active)throw fail('先完成或取消当前作业','action_active');
  if(i.expectedSequence!==b.sequence||(i.epoch??b.epoch)!==b.epoch&&i.epoch!==null)throw fail('当前作业版本已变化','action_sequence');
  if(s.day<=b.couture.lastDay)throw fail('今日已经承办派对','couture_not_ready');
  const r=startCoutureParty(s,{seed:randomInt(1,0x100000000),theme:(i.appearance||i.theme)});if(!r.ok)throw fail(r.reason,'couture_not_ready');
  markFishingPartyDay(s,b,s.day);
  const t={kind:'couture',item:'couture',name:d.name,eventId:d.id,eventVersion:d.version,eventStamp:i.eventStamp,requestId:i.requestId,epoch:b.epoch,sequence:++b.sequence,duration:2.4,day:s.day,startedAt:now,readyAt:now+2400,expiresAt:now+24*3600000,nextBatch:1,game:structuredClone(r.session.game)};
  b.active=t;b.couture.hold=structuredClone(s.resourceLedger.reservations[coutureOwner(d.id)]);sync(s,b);return{ticket:t,receipt:null};
 }
 const t=b.active,g=hydrateCouture(s).session;
 if(t?.kind!=='couture'||!g||t.eventId!==g.id||t.requestId!==i.requestId||t.epoch!==i.epoch||t.sequence!==i.sequence)throw fail('穿搭大会已结束或来自另一份存档','action_stale');
 if(i.operation==='checkpoint'){
  if(now>t.expiresAt)throw fail('本场已过期，可以结束并退回服装','action_expired');
  if(i.batch!==t.nextBatch)throw fail('穿搭大会操作批次顺序不符','couture_batch_sequence');
  if(!Array.isArray(i.events)||i.events.length<1||i.events.length>2048)throw fail('穿搭大会操作批次无效','couture_input');
  const phase=t.game.phase;
  for(const e of i.events){
   if(e?.action?.type==='start'&&!everyoneAt(s,g,t.game))throw fail('摊主与岛主还在赴约，实际到齐后再展示','couture_arrival');
   if(e?.action?.type==='arrive'){
    const id=t.game.level.models[t.game.round];if(t.game.phase!=='walking'||e.action.index!==id||!actualAt(s,g,id,g.layout.buyers[3]))throw fail('模特还在沿实际秀道登台，抵达展示位后才开始姿态演出','couture_arrival');
   }
   if(e?.action?.type==='pose'&&!actualAt(s,g,t.game.level.models[t.game.round],g.layout.buyers[3]))throw fail('模特尚未在展示位，不能记录走秀姿态','couture_arrival');
   try{applyCoutureEvent(t.game,e);}catch{throw fail('穿搭大会操作未通过规则核对','couture_input');}
  }
  if(!validCoutureGame(t.game))throw fail('穿搭大会规则状态无效','couture_input');
  if(t.game.elapsed*1000>now-t.startedAt+150)throw fail('穿搭大会有效时间超过实际经过时间','couture_clock');
  if(phase!=='results'&&t.game.phase==='results')t.readyAt=now+2400;
  g.game=structuredClone(t.game);t.nextBatch++;t.lastBatchHash=digest(i.events);sync(s,b);return{ticket:t,receipt:null};
 }
 if(!['finish','cancel'].includes(i.operation))throw fail('穿搭大会作业操作无效');
 let details,text,outcome;
 if(i.operation==='finish'){
  if(t.game.phase!=='results')throw fail('三位模特还未完成展示','couture_unfinished');
  if(now<t.readyAt)throw fail('穿搭大会收摊庆祝动画尚未结束','action_early');
  if(now>t.expiresAt)throw fail('本场已过期，可以结束并退回未售商品','action_expired');
  details=finishCoutureParty(s);if(!details.ok||details.replayed)throw fail(details.reason||'收益记录冲突','action_ledger_conflict');
  outcome='finished';text='穿搭大会完成，三轮品质'+details.result.quality+'分、合拍'+details.result.poseHits+'/12，获得'+details.reward+'岛币；实际服装和主题旗已解除留用。';
 }else{details=abandonCoutureParty(s);if(!details.ok)throw fail(details.reason,'action_ledger_conflict');outcome='cancelled';text='穿搭大会提前结束，实际服装和主题旗已解除留用；场地费、修整纤维、后台茶与已交赠物不退，不发完成收益。';}
 const ticket={...t};delete ticket.game;delete ticket.lastBatchHash;
 const receipt={ticket,outcome,at:now,day:s.day,text,reward:outcome==='finished'?details.reward:0,details};
 b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);b.active=null;b.couture.hold=null;delete s.coutureAttendance;sync(s,b);return{ticket,receipt};
}
