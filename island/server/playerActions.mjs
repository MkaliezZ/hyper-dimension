import {validResourceBook,clearResourceState} from './resourceAuthority.mjs';
import {recordCooperativeWonder,assertWonderState,enableWonderState,syncWonderState,clearWonderState,validWonderBook} from './wonderAuthority.mjs';
import {validHostingBook} from '../src/partyHosting.js';
import {assertPartyHostingState,clearPartyHosting,checkHostedBegin} from './partyHostingActions.mjs';
import {validFireworksBook,validFireworksTicket,clearFireworksState,fireworksReplay,applyFireworksCommand,fireworksHolds} from './fireworksActions.mjs';
import {validCoutureBook,validCoutureTicket,assertCoutureState,clearCoutureState,coutureReplay,applyCoutureCommand,coutureHolds} from './coutureActions.mjs';
import {validFestivalBook,validFestivalTicket,assertFestivalState,clearFestivalState,festivalReplay,applyFestivalCommand,festivalHolds} from './festivalActions.mjs';
import {validPlanningBook,assertPlanningState,clearPlanningState} from './planningAuthority.mjs';
import {validPersonalBook,validPersonalTicket,personalReplay,applyPersonalCommand,clearPersonalState} from './personalActions.mjs';
import {validFacilityBook,validFacilityTicket,assertFacilityState,clearFacilityState,facilityReplay,applyFacilityCommand} from './facilityActions.mjs';
import {validFishingBook,validFishingTicket,assertFishingState,clearFishingState,fishingReplay,applyFishingCommand,fishingHolds} from './fishingActions.mjs';
import {validPartyBook,validPartyTicket,assertPartyState,clearPartyState,partyReplay,applyPartyCommand} from './partyActions.mjs';
import {validHireBook,assertHireState,clearHireState} from './hireActions.mjs';
import {validCommerceBook,validCommerceTicket,assertCommerceState,clearCommerceState,commerceReplay,applyCommerceCommand} from './commerceActions.mjs';
import {VISITOR_LEASE_PREFIX,validVisitorBook,validVisitorTicket,visitorHolds,assertVisitorState,clearVisitorState,visitorReplay,applyVisitorCommand} from './visitorActions.mjs';
import {RESIDENT_LEASE_PREFIX,validResidentTicket,validResidentBook,residentHolds,assertResidentState,clearResidentState,residentReplay,applyResidentCommand,residentActorOccupied} from './residentActions.mjs';
import {FIELD_LEASE_PREFIX,validFieldTicket,validFieldBook,fieldHolds,assertFieldState,clearFieldState,fieldReplay,applyFieldCommand} from './fieldActions.mjs';
import {FARM_LEASE_PREFIX,validFarmBook,validFarmTicket,farmHolds,assertFarmState,clearFarmState,farmReplay,applyFarmCommand} from './farmActions.mjs';
import {CRAFT_LEASE_PREFIX,validCraftTicket,craftHold,craftReplay,applyCraftCommand} from './craftActions.mjs';
import {randomUUID} from 'node:crypto';
import {RAW_MATERIALS} from '../src/contentCatalog.js';
import {resolveTool} from '../src/equipmentRules.js';
import {reserveResources,releaseResources,commitResources} from '../src/resourceLedger.js';
import {recordPlayerGoods} from '../src/economy.js';
import {trackJourney} from '../src/journey.js';
const fail=(message,status=400,code='action_invalid')=>Object.assign(Error(message),{status,code});
const idOK=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(v);
const ordered=o=>Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b)));
const same=(a,b)=>JSON.stringify(ordered(a))===JSON.stringify(ordered(b));
export const ACTION_LEASE_PREFIX='server-gather:';
export function newActionBook(){return {version:1,epoch:randomUUID(),sequence:0,active:null,receipts:[]};}
export function gatherRule(itemId){
 const item=RAW_MATERIALS.find(x=>x.id===itemId);
 if(!item||(!['forest','shore','greenhouse'].includes(item.source)&&item.id!=='seed'))throw fail('此物品需通过对应的耕种、采矿、钓鱼或制作玩法获得');
 const action=item.source==='forest'&&['wood','bamboo','hardwood','twig','bark','driftwood'].includes(item.id)?'axe':'gather';
 return {item:item.id,name:item.name,source:item.source,action,amount:2,seconds:1.6};
}
export function validActionBook(book){
 if(book===undefined)return true;
 if(!book||book.version!==1||!idOK(book.epoch)||!Number.isSafeInteger(book.sequence)||book.sequence<0||!Array.isArray(book.receipts)||book.receipts.length>128||!validHostingBook(book.hosting)||!validPlanningBook(book.planning)||!validPersonalBook(book.personal)||!validResourceBook(book.resources)||!validFarmBook(book.farm,book)||!validFieldBook(book.field,book)||!validResidentBook(book.resident,book)||!validVisitorBook(book.visitor,book)||!validCommerceBook(book.commerce)||!validPartyBook(book.party)||!validHireBook(book.hire)||!validFireworksBook(book.fireworks)||!validCoutureBook(book.couture)||!validFestivalBook(book.festival)||!validFishingBook(book.fishing)||!validFacilityBook(book.facility)||!validWonderBook(book.wonders))return false;
 const validTicket=(t,receipt=false)=>t&&idOK(t.requestId)&&t.epoch===book.epoch&&Number.isSafeInteger(t.sequence)&&t.sequence>0&&t.sequence<=book.sequence&&typeof t.item==='string'&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt)&&Number.isFinite(t.duration)&&(t.kind==='personal'?validPersonalTicket(t):t.kind==='facility'?validFacilityTicket(t):t.kind==='fireworks'?validFireworksTicket(t,receipt):t.kind==='couture'?validCoutureTicket(t,receipt):t.kind==='festival'?validFestivalTicket(t,receipt):t.kind==='fishing'?validFishingTicket(t,receipt):t.kind==='party'?validPartyTicket(t,receipt):t.kind==='commerce'?validCommerceTicket(t):t.kind==='visitor'?validVisitorTicket(t):t.kind==='resident'?validResidentTicket(t):t.kind==='field'?validFieldTicket(t,receipt):t.kind==='farm'?validFarmTicket(t):t.kind==='craft'?validCraftTicket(t,receipt):t.duration>=.85&&t.duration<=1.6);
 if(book.active!==null&&!validTicket(book.active))return false;
 return book.receipts.every(r=>validTicket(r.ticket,true)&&['finished','cancelled','practiced'].includes(r.outcome)&&Number.isFinite(r.at));
}
export function assertActionHold(state,book){
 const t=book?.active;
 const expected={...(t?.kind==='craft'?craftHold(t):t?.kind!=='farm'&&t?.tool?.source==='owned'?{[t.owner]:{items:{[t.tool.id]:1},purpose:'服务端采集 '+t.name,day:t.day}}:{}),...farmHolds(book),...fieldHolds(book),...residentHolds(book),...visitorHolds(book),...fishingHolds(book),...festivalHolds(book),...coutureHolds(book),...fireworksHolds(book)};
 const actual=Object.fromEntries(Object.entries(state.resourceLedger?.reservations||{}).filter(([k])=>(k.startsWith(ACTION_LEASE_PREFIX)||k.startsWith(CRAFT_LEASE_PREFIX)||k.startsWith(FARM_LEASE_PREFIX)||k.startsWith(FIELD_LEASE_PREFIX)||k.startsWith(RESIDENT_LEASE_PREFIX)||k.startsWith(VISITOR_LEASE_PREFIX)||book?.fishing&&k.startsWith('event:')||book?.fireworks&&k.startsWith('fireworks:')||book?.couture&&k.startsWith('couture:')||book?.festival&&k.startsWith('festival:'))));
 if(!same(actual,expected))throw fail('正在采集的工具仍由作业占用，请先完成或取消作业',409,'action_hold_conflict');
}
export function clearActionHolds(state,{trustedRestore=false}={}){for(const key of Object.keys(state.resourceLedger?.reservations||{}))if((key.startsWith(ACTION_LEASE_PREFIX)||key.startsWith(CRAFT_LEASE_PREFIX)||key.startsWith(FARM_LEASE_PREFIX)||key.startsWith(FIELD_LEASE_PREFIX)||key.startsWith(RESIDENT_LEASE_PREFIX)||key.startsWith(VISITOR_LEASE_PREFIX)))releaseResources(state,key);clearWonderState(state);clearPartyHosting(state);clearPlanningState(state);clearPersonalState(state);clearResourceState(state);clearFarmState(state);clearFieldState(state);clearResidentState(state);clearVisitorState(state);clearCommerceState(state);clearPartyState(state);clearHireState(state);clearFishingState(state);clearFestivalState(state,{returnStock:trustedRestore});clearCoutureState(state);clearFireworksState(state,{consumeFired:trustedRestore});clearFacilityState(state);}
export function actionReplay(doc,input){
 const personal=personalReplay(doc,input);if(personal)return personal;
 const facility=facilityReplay(doc,input);if(facility)return facility;
 const fireworks=fireworksReplay(doc,input);if(fireworks)return fireworks;
 const couture=coutureReplay(doc,input);if(couture)return couture;
 const festival=festivalReplay(doc,input);if(festival)return festival;
 const fishing=fishingReplay(doc,input);if(fishing)return fishing;
 const party=partyReplay(doc,input);if(party)return party;
 const commerce=commerceReplay(doc,input);if(commerce)return commerce;
 const visitor=visitorReplay(doc,input);if(visitor)return visitor;
 const resident=residentReplay(doc,input);if(resident)return resident;
 const field=fieldReplay(doc,input);if(field)return field;
 const farm=farmReplay(doc,input);if(farm)return farm;
 const craft=craftReplay(doc,input);if(craft)return craft;
 if(input.kind==='personal'||input.kind==='facility'||input.kind==='farm'||input.kind==='field'||input.kind==='resident'||input.kind==='visitor'||input.kind==='commerce'||input.kind==='party'||input.kind==='fishing'||input.kind==='festival'||input.kind==='couture'||input.kind==='fireworks')return null;
 const b=doc?.actions;if(!b)return null;
 if(input.operation==='begin'){
  const t=b.active?.requestId===input.requestId?b.active:null;
  const done=b.receipts.find(r=>r.ticket.requestId===input.requestId);
  if(t||done){const ticket=t||done.ticket;if(ticket.item!==input.itemId)throw fail('同一作业编号不能更换采集物',409,'action_id_conflict');return {document:doc,ticket,receipt:done||null,replayed:true};}
 }else{
  const r=b.receipts.find(r=>r.ticket.epoch===input.epoch&&r.ticket.sequence===input.sequence&&r.ticket.requestId===input.requestId);
  if(r)return {document:doc,ticket:r.ticket,receipt:r,replayed:true};
 }
 return null;
}
export function applyGatherCommand(state,book,input,now){enableWonderState(state,book);assertWonderState(state,book);const result=applyGatherCommandInner(state,book,input,now);recordCooperativeWonder(state,book,input,result);syncWonderState(state,book);return result;}
function applyGatherCommandInner(state,book,input,now){
 assertPartyHostingState(state,book);checkHostedBegin(state,book,input);assertPlanningState(state,book);
 if(input.kind==='personal')return applyPersonalCommand(state,book,input,now);
 assertFarmState(state,book);assertFieldState(state,book);assertResidentState(state,book);assertVisitorState(state,book);assertCommerceState(state,book);assertPartyState(state,book);assertHireState(state,book);assertFishingState(state,book);assertFestivalState(state,book);assertFacilityState(state,book);
 if(input.operation==='begin'&&input.actor==='npc'&&residentActorOccupied(book,input.actorId))throw fail('居民仍在另一项作业',409,'npc_action_active');
 if(input.kind==='facility'){assertActionHold(state,book);return applyFacilityCommand(state,book,input,now);}
 if(input.kind==='fireworks'){if(!idOK(input.requestId))throw fail('烟花大会编号无效');assertActionHold(state,book);return applyFireworksCommand(state,book,input,now);}
 if(input.kind==='couture'){if(!idOK(input.requestId))throw fail('穿搭大会编号无效');assertActionHold(state,book);return applyCoutureCommand(state,book,input,now);}
 if(input.kind==='festival'){if(!idOK(input.requestId))throw fail('集市编号无效');assertActionHold(state,book);return applyFestivalCommand(state,book,input,now);}
 if(input.kind==='fishing'){if(!idOK(input.requestId))throw fail('比赛编号无效');assertActionHold(state,book);return applyFishingCommand(state,book,input,now);}
 if(input.kind==='party'){assertActionHold(state,book);return applyPartyCommand(state,book,input,now);}
 if(input.kind==='commerce'){assertActionHold(state,book);return applyCommerceCommand(state,book,input,now);}
 if(input.kind==='visitor'){assertActionHold(state,book);return applyVisitorCommand(state,book,input,now);}
 if(input.kind==='resident'){if(!idOK(input.requestId))throw fail('居民作业编号无效');assertActionHold(state,book);return applyResidentCommand(state,book,input,now);}
 if(input.kind==='field'){if(!idOK(input.requestId))throw fail('户外作业编号无效');assertActionHold(state,book);return applyFieldCommand(state,book,input,now);}
 if(input.kind==='farm'){if(!idOK(input.requestId))throw fail('农活编号无效');assertActionHold(state,book);return applyFarmCommand(state,book,input,now);}
 if(input.kind==='craft'){if(!idOK(input.requestId))throw fail('制作作业编号无效');assertActionHold(state,book);return applyCraftCommand(state,book,input,now);}
 if(!['begin','finish','cancel'].includes(input.operation)||!idOK(input.requestId))throw fail('采集作业请求无效');
 if(input.operation==='begin'){
  if(book.active)throw fail('上一次采集尚未完成，请继续或取消后再开始',409,'action_active');
  if((input.epoch??null)!==book.epoch&&input.epoch!==null)throw fail('作业所属存档已更换',409,'action_epoch');
  if(input.expectedSequence!==book.sequence)throw fail('另一窗口已更新采集作业',409,'action_sequence');
  const r=gatherRule(input.itemId),tool=resolveTool(state,r.action),duration=Math.round(Math.max(.85,r.seconds*(tool?.durationScale||1))*1000)/1000;
  const sequence=book.sequence+1,owner=ACTION_LEASE_PREFIX+book.epoch+':'+sequence;
  if(tool?.source==='owned'&&!reserveResources(state,owner,{[tool.id]:1},{purpose:'服务端采集 '+r.name}).ok)throw fail('工具正在被其他作业使用',409,'action_tool');
  const ticket={requestId:input.requestId,epoch:book.epoch,sequence,...r,tool,duration,owner,day:state.day,startedAt:now,readyAt:now+Math.ceil(duration*1000),expiresAt:now+30*60*1000};
  book.sequence=sequence;book.active=ticket;return {ticket,receipt:null};
 }
 const ticket=book.active;
 if(!ticket||ticket.epoch!==input.epoch||ticket.sequence!==input.sequence||ticket.requestId!==input.requestId)throw fail('采集作业已结束或来自另一次存档',409,'action_stale');
 assertActionHold(state,book);
 if(input.operation==='finish'){
  if(now<ticket.readyAt)throw fail('采集动作尚未完成，请稍后继续',409,'action_early');
  if(now>ticket.expiresAt)throw fail('这次采集已过期，请取消后重新采集',409,'action_expired');
  const rule=gatherRule(ticket.item);
  const paid=commitResources(state,{id:'server-gather:'+book.epoch+':'+ticket.sequence,gain:{[rule.item]:rule.amount},category:'player_gather',note:'亲手采集'+rule.name});
  if(!paid.ok||paid.replayed)throw fail('采集物资账本与作业不一致，请读取服务端进度',409,'action_ledger_conflict');
  state.gatherCounts??={};state.gatherCounts[rule.source]=(state.gatherCounts[rule.source]||0)+1;
  recordPlayerGoods(state,rule.item,rule.amount);trackJourney(state,'gather',{item:rule.item,amount:rule.amount});
 }
 releaseResources(state,ticket.owner);
 const receipt={ticket,outcome:input.operation==='finish'?'finished':'cancelled',at:now,gain:input.operation==='finish'?{[ticket.item]:ticket.amount}:{},day:state.day};
 book.receipts.push(receipt);book.receipts=book.receipts.slice(-128);book.active=null;
 return {ticket,receipt};
}
