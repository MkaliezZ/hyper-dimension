import {hydrateFunctionalFacilities,functionalCommand,validFunctionalFacilities} from '../src/functionalFacilities.js';
import {FUNCTIONAL_FACILITIES} from '../src/facilityCatalog.js';
import {hydratePlacements,decorate,validPlacements} from '../src/placements.js';
import {applyFarmCommand} from './farmActions.mjs';
const fail=(message,code='facility_invalid')=>Object.assign(Error(message),{status:409,code});
const clone=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const operations=['place','move','store','load','configure','pause','resume','harvest','clean','clear'];
const paid=s=>Object.fromEntries(Object.entries(s.resourceLedger?.receipts||{}).filter(([id])=>id.startsWith('facility:')||id.startsWith('display:')));
const snapshot=s=>({placedItems:clone(s.placedItems||[]),placementBook:clone(s.placementBook),decorBonuses:clone(s.decorBonuses||{}),decorQualityState:clone(s.decorQualityState||{}),functionalFacilities:clone(hydrateFunctionalFacilities(s))});
const signature=i=>JSON.stringify([i.operation,i.day??null,i.displayId??null,i.item??null,i.x??null,i.y??null,i.rotation??null,i.expectedRevision??null,i.targets??null,i.enabled??null]);
const control=b=>({version:1,activeSeconds:b.facility.activeSeconds});
export function validFacilityBook(f){return f===undefined||f&&f.version===1&&Number.isFinite(f.activeSeconds)&&f.activeSeconds>=0&&Number.isFinite(f.lastActiveAt)&&f.snapshot&&validPlacements(f.snapshot)&&validFunctionalFacilities(f.snapshot)&&(!f.productionAt||typeof f.productionAt==='object'&&!Array.isArray(f.productionAt)&&Object.keys(f.productionAt).length<=64&&Object.values(f.productionAt).every(n=>Number.isFinite(n)&&n>=0))&&f.paid&&typeof f.paid==='object'&&!Array.isArray(f.paid)&&(!f.autosaves||Array.isArray(f.autosaves)&&f.autosaves.length<=64&&f.autosaves.every(r=>typeof r.id==='string'&&typeof r.expectedVersion==='string'&&/^[a-f0-9]{64}$/.test(r.fingerprint)));}
export function validFacilityTicket(t){return t?.kind==='facility'&&operations.includes(t.command)&&t.item==='facility'&&typeof t.signature==='string'&&t.duration===0&&Number.isFinite(t.startedAt)&&t.readyAt===t.startedAt&&Number.isFinite(t.expiresAt)&&Number.isSafeInteger(t.day)&&t.day>0;}
export function syncFacilityState(s,b){if(!b?.facility)return;b.facility.snapshot=snapshot(s);b.facility.paid=paid(s);s.facilityControl=control(b);}
export function assertFacilityState(s,b){if(b?.facility&&(!same(s.facilityControl,control(b))||!same(snapshot(s),b.facility.snapshot)||!same(paid(s),b.facility.paid)))throw fail('布置、设施批次与余料由服务器确认，请读取已确认的设施进度','facility_state_conflict');}
export function clearFacilityState(s){delete s.facilityControl;}
export function enableFacility(s,b,theme,now){if(b.facility)return;hydratePlacements(s,theme);hydrateFunctionalFacilities(s);s.decorBonuses??={};s.decorQualityState??={};b.facility={version:1,activeSeconds:0,lastActiveAt:now,snapshot:snapshot(s),paid:paid(s),productionAt:Object.fromEntries(Object.entries(s.functionalFacilities.units).filter(([,u])=>['growing','brewing'].includes(u.phase)).map(([id])=>[id,now])),legacyBaseline:true};syncFacilityState(s,b);}
export function advanceFacilityClock(s,b,seconds,now){
 if(!b?.facility)return [];assertFacilityState(s,b);if(!Number.isFinite(seconds)||seconds<0||seconds>15)throw fail('设施有效游戏时间无效','facility_clock');
 const f=b.facility,clockAt=f.lastActiveAt,elapsed=Math.min(seconds,15,Math.max(0,(now-f.lastActiveAt)/1000));f.lastActiveAt=now;f.activeSeconds+=elapsed;const events=[];
 if(!s.freshStartPending)for(const [id,u] of Object.entries(s.functionalFacilities.units)){
  const d=FUNCTIONAL_FACILITIES[u.item];if(!d||d.kind==='irrigation'||!s.placedItems.some(p=>p.id===id)||!u.enabled||!['growing','brewing'].includes(u.phase))continue;
  const productionElapsed=Math.min(elapsed,Math.max(0,(now-(f.productionAt?.[id]??clockAt))/1000));f.productionAt??={};f.productionAt[id]=now;u.elapsed=Math.min(d.seconds,u.elapsed+productionElapsed);if(u.elapsed>=d.seconds){u.phase='ready';u.condition=Math.max(0,u.condition-(d.kind==='nursery'?8:3));if(d.kind==='tea')u.servings=d.capacity;u.lastText=d.kind==='nursery'?'海虾已经育成，请收取':'三杯暖茶已经温好，居民可在炉前饮用';s.functionalFacilities.revision++;events.push(u.lastText);}
 }
 syncFacilityState(s,b);return events;
}
export function facilityReplay(doc,i){
 if(i.kind!=='facility')return null;const b=doc?.actions;if(!b)return null;if(i.operation==='enable'&&b.facility)return {document:doc,ticket:null,receipt:null,replayed:true};
 const r=b.receipts.find(r=>r.ticket.requestId===i.requestId);if(!r)return null;if(r.ticket.kind!=='facility'||r.ticket.signature!==signature(i))throw fail('同一设施请求不能更换操作或位置','action_id_conflict');return {document:doc,ticket:r.ticket,receipt:r,replayed:true};
}
const watering=(b,id)=>Object.values(b.farm?.leases||{}).filter(t=>t.actor==='facility'&&t.actorId===id);
const teaBusy=(b,id)=>Object.values(b.resident?.leases||{}).some(t=>t.mode==='tea'&&t.intent.facilityId===id);
export function applyFacilityCommand(s,b,i,now){
 if(!/^[a-zA-Z0-9-]{8,80}$/.test(i.requestId||''))throw fail('设施请求编号无效');if(i.operation==='enable'){enableFacility(s,b,(i.appearance||i.theme),now);return {ticket:null,receipt:null};}
 if(!b.facility)throw fail('设施账本尚未启用','facility_not_enabled');assertFacilityState(s,b);if(!operations.includes(i.operation))throw fail('设施操作无效');if(i.day!==undefined&&i.day!==s.day)throw fail('游戏日已变化，请重新打开设施','facility_day');
 const placing=['place','move','store'].includes(i.operation),revision=placing?s.placementBook.revision:s.functionalFacilities.revision;if(i.expectedRevision!==revision)throw fail('布置或设施已变化，请重新打开当前状态','facility_revision');
 if(i.displayId&&teaBusy(b,i.displayId))throw fail('居民正在实际用茶，请等茶歇结束再操作','facility_occupied');
 const before={coins:s.coins,inventory:clone(s.inventory)},sequence=b.sequence+1;let details;
 if(placing){
  if(i.displayId&&watering(b,i.displayId).length)throw fail('正在灌溉，请先关闭滴灌再移动或收回','facility_occupied');
  const actors=[s.player,...(s.npcPresence||[]).filter(n=>n.inside==null),...(s.visitorPresence||[]).filter(n=>n.inside==null)];
  details=decorate(s,{commandId:i.requestId,action:i.operation,displayId:i.displayId,item:i.item,x:i.x,y:i.y,rotation:i.rotation??0,expectedRevision:i.expectedRevision},{theme:(i.appearance||i.theme),actors});hydrateFunctionalFacilities(s);
 }else{
  if(['configure','clear'].includes(i.operation))for(const t of watering(b,i.displayId))applyFarmCommand(s,b,{kind:'farm',operation:'cancel',requestId:t.requestId,epoch:t.epoch,sequence:t.sequence},now);
  details=functionalCommand(s,{commandId:i.requestId,displayId:i.displayId,action:i.operation,expectedRevision:s.functionalFacilities.revision,targets:i.targets,enabled:i.enabled});
 }
 if(!details?.ok)throw fail(details?.reason||'设施条件不满足','facility_not_ready');
 if(['load','resume'].includes(i.operation)&&['growing','brewing'].includes(s.functionalFacilities.units[i.displayId]?.phase)){b.facility.productionAt??={};b.facility.productionAt[i.displayId]=now;}for(const id of Object.keys(b.facility.productionAt||{}))if(!s.functionalFacilities.units[id]||s.functionalFacilities.units[id].phase==='idle')delete b.facility.productionAt[id];
 b.sequence=sequence;const ticket={kind:'facility',command:i.operation,item:'facility',requestId:i.requestId,epoch:b.epoch,sequence,signature:signature(i),day:s.day,duration:0,startedAt:now,readyAt:now,expiresAt:now+30*60000};
 const receipt={ticket,outcome:'finished',at:now,day:s.day,text:details.text,cashDelta:s.coins-before.coins,stockDelta:Object.fromEntries(Object.entries(s.inventory).map(([id,n])=>[id,n-(before.inventory[id]||0)]).filter(([,n])=>n!==0)),details};b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);syncFacilityState(s,b);return {ticket,receipt};
}
