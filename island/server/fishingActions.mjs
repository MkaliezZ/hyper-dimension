
import {randomInt,createHash} from 'node:crypto';
import {hydrateFishing,createFishingEvent,updateFishingEvent,inviteFishingNpc,createFishingPlan,cancelFishingDraft,startFishingParty,fishingCheckin,finishFishingParty,abandonFishingParty,archiveFishingParty,applyStewardParty,fishingOwner,validFishingParty,FISHING_EQUIPMENT} from '../src/fishingParty.js';
import {partyDraftStamp,eventRequests} from '../src/partyPlanning.js';
import {fishingSpots} from '../src/fishingPartyRuntime.js';
import {createFishingReplay,applyFishingEvent,validFishingReplay} from '../src/fishingReplay.js';
import {trackJourney} from '../src/journey.js';
const fail=(message,code='fishing_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=e=>createHash('sha256').update(JSON.stringify(e)).digest('hex');
const snapshot=s=>{const f=structuredClone(hydrateFishing(s));delete f.composer;return f;};
const payments=s=>Object.fromEntries(Object.entries(s.economy?.cashReceipts||{}).filter(([id])=>/^fishing-\d+:(entry|reward)$/.test(id)));
const mirror=b=>({version:1,lastPartyDay:b.fishing.lastDay});
function sync(s,b){b.fishing.snapshot=snapshot(s);b.fishing.paid=payments(s);s.fishingControl=mirror(b);}
export function markFishingPartyDay(s,b,day){if(b.fireworks){b.fireworks.lastDay=day;s.fireworksControl={version:1,lastPartyDay:day};}if(b.couture){b.couture.lastDay=day;s.coutureControl={version:1,lastPartyDay:day};}if(b.festival){b.festival.lastDay=day;s.festivalControl={version:1,lastPartyDay:day};}if(b.fishing){b.fishing.lastDay=day;s.fishingControl=mirror(b);}if(b.party){b.party.lastDay=day;s.partyControl={version:1,nightLastDay:day,completions:b.party.completions};}s.lastPartyDay=day;}
export function validFishingBook(f){return f===undefined||f&&f.version===1&&Number.isSafeInteger(f.lastDay)&&f.lastDay>=0&&f.snapshot&&f.snapshot.version===1&&f.paid&&typeof f.paid==='object'&&(f.hold===null||f.hold&&typeof f.hold==='object');}
export function validFishingTicket(t,receipt=false){return t?.kind==='fishing'&&t.item==='competition'&&typeof t.eventId==='string'&&Number.isInteger(t.eventVersion)&&t.eventVersion>0&&Number.isFinite(t.startedAt)&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt)&&t.duration===2.2&&Number.isSafeInteger(t.nextBatch)&&t.nextBatch>0&&(receipt||validFishingReplay(t.game));}
export function assertFishingState(s,b){if(b?.fishing&&(!same(s.fishingControl,mirror(b))||s.lastPartyDay!==b.fishing.lastDay||!same(snapshot(s),b.fishing.snapshot)||!same(payments(s),b.fishing.paid)))throw fail('钓鱼活动、赠物与比赛由服务端确认，请核对已确认进度','fishing_state_conflict');}
export function fishingHolds(b){const f=b?.fishing,g=f?.snapshot.session;return f?.hold&&g?{[fishingOwner(g.id)]:structuredClone(f.hold)}:{};}
export function clearFishingState(s){if(s.fishingControl&&['checkin','running'].includes(s.fishingParty?.session?.phase)){abandonFishingParty(s);s.events??=[];s.events.unshift('恢复存档时已收起原钓鱼作业；开场用品已投入，未发完成奖。');s.events=s.events.slice(0,7);}delete s.fishingControl;delete s.fishingAttendance;}
export function fishingReplay(doc,i){if(i.kind!=='fishing'||!doc?.actions)return null;const b=doc.actions;
 if(i.operation==='begin'){const t=b.active?.requestId===i.requestId?b.active:b.receipts.find(r=>r.ticket.requestId===i.requestId)?.ticket;if(t){if(t.kind!=='fishing'||t.eventId!==i.eventId||t.eventVersion!==i.eventVersion)throw fail('同一开场编号不能更换活动方案','action_id_conflict');return{document:doc,ticket:t,receipt:b.receipts.find(r=>r.ticket.requestId===t.requestId)||null,replayed:true};}}
 else{const r=b.receipts.find(r=>r.ticket.kind==='fishing'&&r.ticket.requestId===i.requestId&&r.ticket.epoch===i.epoch&&r.ticket.sequence===i.sequence);if(r)return{document:doc,ticket:r.ticket,receipt:r,replayed:true};const t=b.active;if(i.operation==='checkpoint'&&t?.kind==='fishing'&&t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence&&i.batch===t.nextBatch-1){if(t.lastBatchHash!==digest(i.events))throw fail('同一批垂钓操作不能更换','fishing_batch_conflict');return{document:doc,ticket:t,receipt:null,replayed:true};}}
 return null;
}
export function enableFishing(s,b){if(b.fishing)return;if(['checkin','running'].includes(s.fishingParty?.session?.phase))throw fail('旧版比赛仍在进行，需要先明确结束，不追加奖励或重复收费','fishing_legacy_active');hydrateFishing(s);const day=Math.max(s.lastPartyDay||0,b.party?.lastDay||0,b.festival?.lastDay||0);b.fishing={version:1,lastDay:day,snapshot:snapshot(s),paid:payments(s),hold:null};markFishingPartyDay(s,b,day);sync(s,b);}
function checkEvent(s,i){const d=hydrateFishing(s).draft;if((d?.id||null)!==(i.eventId||null)||(d?.version||null)!==(i.eventVersion||null)||partyDraftStamp(d)!==(i.eventStamp??null))throw fail('活动方案已经变化，请重新打开本次筹备','fishing_draft_changed');return d;}
export function applyFishingManagement(s,b,i){
 if(i.operation==='fish_legacy_close'){if(b.fishing||!['checkin','running'].includes(s.fishingParty?.session?.phase))throw fail('旧版比赛已结束','fishing_legacy_active');abandonFishingParty(s);archiveFishingParty(s);return{ok:true,text:'旧版比赛已结束，用品保持已使用，钓具已归还，不追加完成奖。'};}
 enableFishing(s,b);assertFishingState(s,b);let r;
 if(i.operation==='fish_create'){checkEvent(s,i);r=createFishingEvent(s,{...i.proposal,seed:randomInt(1,0x100000000)});}
 else if(i.operation==='fish_update'){const d=checkEvent(s,i);if(!d)throw fail('没有待修改活动');r=updateFishingEvent(s,i.proposal,{expectedId:d.id,expectedVersion:d.version,source:i.proposal?.source});}
 else if(i.operation==='fish_invite'){const d=checkEvent(s,i);if(!d)throw fail('没有待邀请活动');r=inviteFishingNpc(s,i.npcId,{version:d.version});}
 else if(i.operation==='fish_plan'){checkEvent(s,i);r=createFishingPlan(s);}
 else if(i.operation==='fish_cancel'){checkEvent(s,i);r={ok:cancelFishingDraft(s)};}
 else if(i.operation==='fish_archive'){if(s.fishingParty.session?.id!==i.eventId)throw fail('活动结果已变化');r={ok:archiveFishingParty(s)};}
 else if(i.operation==='fish_steward'){if(!i.verifiedProposal)throw fail('没有当前岛屿的服务端管家活动回执','fishing_proof');r=applyStewardParty(s,i.verifiedProposal,i.runId);if(r.ok&&hydrateFishing(s).draft?.id===r.id)hydrateFishing(s).draft.proposalId=i.verifiedProposal.id;}
 else if(i.operation==='fish_checkin'){
  const g=s.fishingParty.session,t=b.active;if(!g||g.id!==i.eventId||t?.kind!=='fishing'||t.eventId!==g.id||g.phase!=='checkin')throw fail('签到活动已改变','fishing_checkin');
  const attendance=s.fishingAttendance;if(attendance?.id!==g.id)throw fail('请沿栈桥走到本场钓位','fishing_arrival');
  const spots=fishingSpots(i.theme),checks=[{id:-1,target:spots[2]},...g.participants.map((p,k)=>({id:p.id,target:spots[k<2?k:3]}))];
  for(const c of checks){const p=attendance.people?.[c.id],live=c.id===-1?s.player:s.npcPresence?.find(n=>n.id===c.id);if(!p||p.inside!==null||live?.inside!=null||!live||Math.hypot(p.x-c.target.x,p.y-c.target.y)>8||Math.hypot(live.x-c.target.x,live.y-c.target.y)>8)throw fail('仍有人在收尾或沿栈桥赴约，等大家实际到齐再签到','fishing_arrival');}
  for(const c of checks)fishingCheckin(s,c.id);for(const p of g.participants)p.position={...attendance.people[p.id]};r={ok:true};
 }else throw fail('不支持的钓鱼活动管理');
 if(['fish_create','fish_update'].includes(i.operation)&&r?.ok)delete hydrateFishing(s).composer;
 if(!r?.ok)throw fail(r?.reason||'当前活动条件尚未满足','fishing_not_ready');if(i.operation==='fish_archive')delete s.fishingAttendance;sync(s,b);return r;
}
export function applyFishingCommand(s,b,i,now){
 if(!b.fishing)throw fail('钓鱼活动账本尚未启用','fishing_not_enabled');assertFishingState(s,b);
 if(i.operation==='begin'){
  const d=hydrateFishing(s).draft;if(!d||d.id!==i.eventId||d.version!==i.eventVersion)throw fail('开场方案已改变','fishing_draft_changed');if(b.active)throw fail('请先完成或取消当前岛主作业','action_active');if(i.expectedSequence!==b.sequence||(i.epoch??b.epoch)!==b.epoch&&i.epoch!==null)throw fail('当前作业版本已变化','action_sequence');if(s.day<=b.fishing.lastDay)throw fail('今天已经承办派对，明天再相聚','fishing_not_ready');
  d.seed=randomInt(1,0x100000000);const r=startFishingParty(s);if(!r.ok)throw fail(r.reason,'fishing_not_ready');markFishingPartyDay(s,b,s.day);
  const t={kind:'fishing',item:'competition',name:r.session.name,eventId:d.id,eventVersion:d.version,requestId:i.requestId,epoch:b.epoch,sequence:++b.sequence,duration:2.2,day:s.day,startedAt:now,readyAt:now+2200,expiresAt:now+24*3600000,nextBatch:1,game:createFishingReplay(r.session.match)};
  b.active=t;b.fishing.hold=structuredClone(s.resourceLedger.reservations[fishingOwner(d.id)]);sync(s,b);return{ticket:t,receipt:null};
 }
 const t=b.active,g=s.fishingParty.session;if(t?.kind!=='fishing'||!g||t.eventId!==g.id||t.requestId!==i.requestId||t.epoch!==i.epoch||t.sequence!==i.sequence)throw fail('比赛已结束或属于另一份存档','action_stale');
 if(i.operation==='checkpoint'){
  if(now>t.expiresAt)throw fail('比赛已过期，可以结束本场','action_expired');if(i.batch!==t.nextBatch)throw fail('垂钓操作批次顺序不符','fishing_batch_sequence');if(!Array.isArray(i.events)||i.events.length<1||i.events.length>2048)throw fail('垂钓操作批次无效','fishing_input');if(g.phase!=='running'&&i.events.some(e=>!e?.neutral))throw fail('参加者尚未到齐签到','fishing_arrival');
  const phase=t.game.match.phase;try{for(const e of i.events)applyFishingEvent(t.game,e);}catch{throw fail('垂钓操作未通过规则核对','fishing_input');}
  if(t.game.elapsed*1000>now-t.startedAt+150)throw fail('比赛有效时间超过实际经过时间','fishing_clock');if(phase!=='results'&&t.game.match.phase==='results')t.readyAt=now+2200;
  g.match=structuredClone(t.game.match);t.nextBatch++;t.lastBatchHash=digest(i.events);sync(s,b);return{ticket:t,receipt:null};
 }
 if(!['finish','cancel'].includes(i.operation))throw fail('不支持的比赛操作');let details=null,text='比赛中止，开场用品已投入，钓具和海风旗已解除预留。',outcome='cancelled';
 if(i.operation==='finish'){if(g.phase!=='running'||t.game.match.phase!=='results')throw fail('六竿比赛尚未完成','fishing_unfinished');if(now<t.readyAt)throw fail('颁奖动作尚未完成','action_early');if(now>t.expiresAt)throw fail('比赛已过期，可以结束本场','action_expired');details=finishFishingParty(s);if(!details.ok||details.replayed)throw fail(details.reason||'奖励账本不一致','action_ledger_conflict');trackJourney(s,'party',{kind:'fishing',eventId:g.id});text='钓鱼大会完成，'+details.result.raw+'分，获得 '+details.reward+' 岛币。';outcome='finished';}
 else abandonFishingParty(s);
 const ticket={...t};delete ticket.game;delete ticket.lastBatchHash;const receipt={ticket,outcome,at:now,day:s.day,text,reward:details?.reward||0,details};b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);b.active=null;b.fishing.hold=null;delete s.fishingAttendance;sync(s,b);return{ticket,receipt};
}
