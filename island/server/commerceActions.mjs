import {configureShopfront,validShopfronts} from '../src/shopfronts.js';
import {HOSTING_OPERATIONS,hostingSignature,applyHostingManagement} from './partyHostingActions.mjs';
import {hostingDraft} from '../src/partyHosting.js';
import {partyDraftStamp} from '../src/partyPlanning.js';
import {FIREWORKS_OPERATIONS,enableFireworks,applyFireworksManagement} from './fireworksActions.mjs';
import {COUTURE_OPERATIONS,enableCouture,applyCoutureManagement} from './coutureActions.mjs';
import {FESTIVAL_OPERATIONS,enableFestival,applyFestivalManagement} from './festivalActions.mjs';
import{NIGHT_OPERATIONS,applyNightManagement}from'./nightPlanningActions.mjs';
import {PLANNING_OPERATIONS,planningSignature,applyPlanningManagement} from './planningCommands.mjs';
import {enableFishing,applyFishingManagement} from './fishingActions.mjs';
const fishOps=['fish_create','fish_update','fish_invite','fish_plan','fish_cancel','fish_archive','fish_steward','fish_checkin','fish_legacy_close'];
import {applyPartyCommand} from './partyActions.mjs';
import {HIRE_DRAFT_OPERATIONS,applyHireDraft,enableHire,settleHire,renewHire,bindHire} from './hireActions.mjs';
import {hydrateTown} from '../src/townSimulation.js';
import {buySupplies,maintainFacility,upgradeFacility,deliverTownOrder,deliverSpecializationOrder,tickTownEconomy,hydrateEconomy,ECONOMY_POLICY_VERSION,ECONOMY_RULES} from '../src/economy.js';
import {hydrateSpecialization,specializationDelivery} from '../src/specialization.js';
import {trackJourney} from '../src/journey.js';
const fail=(message,code='commerce_invalid')=>Object.assign(Error(message),{status:409,code});
const idOK=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const owned=id=>/^(town-day-|town-order-|career-order-)/.test(id);
const policyKeys=['budgetPolicyVersion','budgetPolicyStartsDay','budgetPreviousVersion','accountingStartedDay','townBudgetStartedDay'];
const snapshot=s=>({...(s.shopfronts===undefined?{}:{shopfronts:structuredClone(s.shopfronts)}),day:s.day,daySeconds:s.economy.daySeconds,townDays:structuredClone(s.economy.townDays),orderIncome:s.economy.orderIncome,paid:Object.fromEntries(Object.entries(s.economy.cashReceipts).filter(([id])=>owned(id))),policy:Object.fromEntries(policyKeys.map(k=>[k,s.economy[k]]))});
const signature=i=>JSON.stringify([i.operation,i.day??null,i.slot??null,i.supply??null,i.buildingId??null,i.commissionId??null,i.contractId??null,...(['hire_renew','hire_renew_prepare','hire_renew_release'].includes(i.operation)?[i.renewalId??null]:[]),...(HIRE_DRAFT_OPERATIONS.includes(i.operation)?[i.projectId??null,i.candidateId??null,i.mode??null,i.recallId??null,i.source??null]:[]),...((i.operation?.startsWith('fish_')||i.operation?.startsWith('night_')||i.operation?.startsWith('festival_')||i.operation?.startsWith('couture_')||i.operation?.startsWith('fireworks_'))?[i.eventId??null,i.eventVersion??null,i.eventStamp??null,i.npcId??null,i.proposal??null,i.runId??null,i.proposalId??null]:[]),...(i.operation==='shopfront'?[i.expectedShopRevision??null,i.listing??null]:[]),...planningSignature(i),...hostingSignature(i)]);
const mirror=b=>({version:1,activeSeconds:b.commerce.activeSeconds,day:b.commerce.snapshot.day,daySeconds:b.commerce.snapshot.daySeconds});
export function validCommerceTicket(t){return t?.kind==='commerce'&&['shopfront','order','career','supply','upgrade','maintain','hire_handover','hire_renew','hire_bind',...HIRE_DRAFT_OPERATIONS,'party_legacy_close',...fishOps,...NIGHT_OPERATIONS,...FESTIVAL_OPERATIONS,...COUTURE_OPERATIONS,...FIREWORKS_OPERATIONS,...PLANNING_OPERATIONS,...HOSTING_OPERATIONS].includes(t.command)&&t.item==='commerce'&&typeof t.signature==='string'&&t.duration===0&&Number.isFinite(t.startedAt)&&t.readyAt===t.startedAt&&Number.isFinite(t.expiresAt)&&Number.isSafeInteger(t.day)&&t.day>0;}
export function validCommerceBook(c){if(c===undefined)return true;return c&&c.version===1&&Number.isFinite(c.activeSeconds)&&c.activeSeconds>=0&&Number.isFinite(c.lastActiveAt)&&c.snapshot&&validShopfronts(c.snapshot)&&Number.isSafeInteger(c.snapshot.day)&&c.snapshot.day>0&&Number.isFinite(c.snapshot.daySeconds)&&c.snapshot.daySeconds>=0&&c.snapshot.daySeconds<ECONOMY_RULES.daySeconds&&Number.isSafeInteger(c.snapshot.orderIncome)&&c.snapshot.orderIncome>=0&&Array.isArray(c.snapshot.townDays)&&c.snapshot.townDays.length<=60&&c.snapshot.paid&&c.snapshot.policy&&(!c.autosaves||Array.isArray(c.autosaves)&&c.autosaves.length<=64&&c.autosaves.every(r=>idOK(r.id)&&typeof r.expectedVersion==='string'&&/^[a-f0-9]{64}$/.test(r.fingerprint)));}
export function assertCommerceState(s,b){if(b?.commerce&&(!same(s.commerceControl,mirror(b))||!same(snapshot(s),b.commerce.snapshot)))throw fail('游戏日与委托结算由服务端核对，请读取已确认进度','commerce_state_conflict');}
function sync(s,b){b.commerce.snapshot=snapshot(s);s.commerceControl=mirror(b);}
export function migrateEconomyPolicy(s,b){
 if(s.economy?.budgetPolicyVersion===ECONOMY_POLICY_VERSION)return false;
 if(b?.commerce)assertCommerceState(s,b);
 hydrateEconomy(s);if(b?.commerce)sync(s,b);return true;
}
export function clearCommerceState(s){delete s.commerceControl;}
export function advanceCommerceClock(s,b,seconds,now){if(!b?.commerce)return;assertCommerceState(s,b);if(!Number.isFinite(seconds)||seconds<0||seconds>15)throw fail('经营有效时间请求无效','commerce_clock');const c=b.commerce,elapsed=Math.min(seconds,15,Math.max(0,(now-c.lastActiveAt)/1000));c.lastActiveAt=now;c.activeSeconds+=elapsed;const days=tickTownEconomy(s,elapsed);if(days.length){hydrateSpecialization(s);s.events??=[];for(const day of days)s.events.unshift('第 '+day.day+' 天经营结算：收入 '+day.income+'、支出 '+day.cost+'、净入账 '+day.net+' 岛币。');s.events=s.events.slice(0,7);}sync(s,b);return days;}
export function commerceReplay(doc,i){if(i.kind!=='commerce')return null;const b=doc?.actions;if(!b)return null;if(i.operation==='fireworks_enable'&&b.fireworks)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='couture_enable'&&b.couture)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='festival_enable'&&b.festival)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='fish_enable'&&b.fishing)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='party_enable'&&b.party)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='hire_enable'&&b.hire)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='night_enable'&&b.party?.design)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='plan_enable'&&b.planning)return {document:doc,ticket:null,receipt:null,replayed:true};if(i.operation==='enable'&&b.commerce)return {document:doc,ticket:null,receipt:null,replayed:true};const r=b.receipts.find(r=>r.ticket.requestId===i.requestId);if(!r)return null;if(r.ticket.kind!=='commerce'||r.ticket.signature!==signature(i))throw fail('同一经营命令不能变更内容','action_id_conflict');return {document:doc,ticket:r.ticket,receipt:r,replayed:true};}
export function applyCommerceCommand(s,b,i,now){
 if(!idOK(i.requestId))throw fail('经营命令编号无效');
 if(i.operation==='fireworks_enable'){enableFireworks(s,b);return{ticket:null,receipt:null};}
 if(i.operation==='couture_enable'){enableCouture(s,b);return{ticket:null,receipt:null};}
 if(i.operation==='festival_enable'){enableFestival(s,b);return{ticket:null,receipt:null};}
 if(i.operation==='fish_enable'){enableFishing(s,b);return {ticket:null,receipt:null};}
 if(i.operation==='party_enable')return applyPartyCommand(s,b,{...i,operation:'enable'},now);
 if(i.operation==='hire_enable'){enableHire(s,b);return {ticket:null,receipt:null};}
 if(i.operation==='night_enable'){applyPartyCommand(s,b,{...i,operation:'enable'},now);applyNightManagement(s,b,i);return{ticket:null,receipt:null};}
 if(i.operation==='plan_enable'){if(!b.commerce)throw fail('经营账本尚未启用','commerce_not_enabled');return applyPlanningManagement(s,i,b);}
 if(i.operation==='enable'){if(!b.commerce){hydrateTown(s);hydrateSpecialization(s);const snap=snapshot(s),c={version:1,activeSeconds:0,lastActiveAt:now,snapshot:snap};if(!validCommerceBook(c))throw fail('旧存档经营日期或营业记录无效，请读取备份，已有收入不会自动清零','commerce_legacy_invalid');b.commerce=c;sync(s,b);}return {ticket:null,receipt:null};}
 if(!b.commerce)throw fail('经营账本尚未启用','commerce_not_enabled');assertCommerceState(s,b);if(i.day!==s.day)throw fail('游戏日已更新，请查看今日委托或设施费用','commerce_day');
 const before={coins:s.coins,inventory:structuredClone(s.inventory)},sequence=b.sequence+1;let text='',details;
 if(i.operation==='shopfront'){details=configureShopfront(s,i);if(!details.ok)throw fail(details.reason,'commerce_shopfront');text=details.text;}
 else if(HOSTING_OPERATIONS.includes(i.operation)){details=applyHostingManagement(s,b,i);text=details.text;}
 else if(PLANNING_OPERATIONS.includes(i.operation)){details=applyPlanningManagement(s,i,b);text=details.text;}
 else if(FIREWORKS_OPERATIONS.includes(i.operation)){details=applyFireworksManagement(s,b,i);text=details.text;}
 else if(COUTURE_OPERATIONS.includes(i.operation)){details=applyCoutureManagement(s,b,i);text=details.text;}
 else if(FESTIVAL_OPERATIONS.includes(i.operation)){details=applyFestivalManagement(s,b,i);text=details.text;}
 else if(NIGHT_OPERATIONS.includes(i.operation)){if(i.operation==='night_steward')applyPartyCommand(s,b,{...i,operation:'enable'},now);details=applyNightManagement(s,b,i);text=details.text;}
 else if(fishOps.includes(i.operation)){details=applyFishingManagement(s,b,i);text=details.text||({'fish_create':'活动方案已登记','fish_update':'活动方案已更新','fish_invite':'邀请物品已交付，居民同意参加','fish_plan':'协作筹备已登记','fish_cancel':'筹备已取消，已送赠物留给居民','fish_archive':'比赛结果已归档','fish_checkin':'大家已实际到齐，比赛开始','fish_steward':'管家活动方案和物资计划已登记'})[i.operation];}
 else if(i.operation==='party_legacy_close'){if(b.party||!s.partySession)throw fail('旧版夜集已结束','party_legacy_active');s.partySession=null;text='旧版夜集已结束，不追加奖励；已投入场地和布置保留使用记录。';}
 else if(HIRE_DRAFT_OPERATIONS.includes(i.operation)){details=applyHireDraft(s,b,i);text=details.text;}
 else if(i.operation==='hire_renew'){details=renewHire(s,b,i.renewalId,i.verifiedContract,i.verifiedRenewal,i.theme);text='旧聘约结算 '+details.oldSettlement.fee+' 岛币，伙伴原地续约至第 '+details.expiresDay+' 天。';}
 else if(i.operation==='hire_bind'){details=bindHire(s,b,i.contractId,i.verifiedContract,i.theme);text='聘约已核对，临时伙伴的分工已登记。';}
 else if(i.operation==='hire_handover'){details=settleHire(s,b,i.contractId,i.verifiedContract);text='已交回工作，实际交付 '+details.delivered+'/'+details.quantity+'，结算 '+details.fee+' 岛币。';}
 else if(i.operation==='order'){if(!Number.isInteger(i.slot)||i.slot<0||i.slot>2)throw fail('委托位置无效');const o=deliverTownOrder(s,i.slot);if(!o)throw fail('今日委托已交付，或亲手额度/可用库存不足','commerce_order');trackJourney(s,'order',{item:o.item,receipt:o.receipt});details=o;text='完成'+o.type+'，净收入 +'+o.net+' 岛币。';}
 else if(i.operation==='career'){const ready=specializationDelivery(s);if(!ready.ok||i.commissionId!==ready.commission.id)throw fail(ready.reason||'专精委托已变化','commerce_career');const r=deliverSpecializationOrder(s);if(!r.ok)throw fail(r.reason,'commerce_career');details=r.commission;text='专精作品已交付，净收入 +'+r.commission.net+' 岛币。';}
 else if(i.operation==='supply'){if(!buySupplies(s,i.supply))throw fail('补给无效，或可用岛币不足','commerce_funds');text='补给已购入，实际物资已进入背包。';}
 else if(i.operation==='upgrade'||i.operation==='maintain'){if(!Number.isInteger(i.buildingId)||i.buildingId<0||i.buildingId>24)throw fail('设施位置无效');const ok=i.operation==='upgrade'?upgradeFacility(s,i.buildingId):maintainFacility(s,i.buildingId);if(!ok)throw fail('设施已达到目标，或可用岛币/材料不足','commerce_facility');text=i.operation==='upgrade'?'设施已改善，品质上限已提升。':'设施已维护，状态恢复至100%。';}
 else throw fail('不支持的经营操作');
 if(i.verifiedProposal?.autoHost===true&&i.operation.endsWith('_steward')&&details?.ok&&!details.replayed){const template=i.verifiedProposal.template||'fishing',d=hostingDraft(s,template);const hosting=applyHostingManagement(s,b,{...i,operation:'host_arm',template,eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)},{source:'hermes',runId:i.runId,proposalId:i.proposalId});details={...details,hosting,waiting:'已委托管家等待这一版用品与亲自邀请齐备，回到小岛后召集开场；现场小游戏由你操作。'};}
 b.sequence=sequence;const ticket={kind:'commerce',command:i.operation,item:'commerce',requestId:i.requestId,epoch:b.epoch,sequence,signature:signature(i),day:s.day,startedAt:now,readyAt:now,expiresAt:now+30*60*1000,duration:0};
 const receipt={ticket,outcome:'finished',at:now,day:s.day,text,cashDelta:s.coins-before.coins,stockDelta:Object.fromEntries(Object.entries(s.inventory).map(([id,n])=>[id,n-(before.inventory[id]||0)]).filter(([,n])=>n!==0)),details:details||null};
 b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);sync(s,b);return {ticket,receipt};
}
