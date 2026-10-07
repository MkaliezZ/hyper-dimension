import {createHash} from 'node:crypto';
import {validLanVisit,validLanVisits} from '../src/lanWonderEvidence.js';
import {hydrateWonders,syncWonders,validEventWonders,NATIVE_WONDER_IDS_V98,awardCooperationTree,awardArchipelagoLighthouse,completedNightProof,completedFishingProof,completedMarketProof,completedCoutureProof,completedFireworksProof} from '../src/eventWonders.js';
import {verifiedCooperation,validCooperationRows} from '../src/cooperationEvidence.js';
export const PROTECTED_WONDER_IDS=[...NATIVE_WONDER_IDS_V98,'cooperation_tree','archipelago_lighthouse'];
const ids=new Set(PROTECTED_WONDER_IDS),copy=x=>structuredClone(x),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),object=x=>x&&typeof x==='object'&&!Array.isArray(x),int=n=>Number.isSafeInteger(n)&&n>=0;
const rewardKey=k=>PROTECTED_WONDER_IDS.some(id=>k.startsWith('wonder:'+id+':'));
function projection(s){const w=hydrateWonders(s);return {owned:Object.fromEntries(Object.entries(w.owned).filter(([id])=>ids.has(id)).map(([id,a])=>[id,copy(a)])),receipts:Object.fromEntries(Object.entries(w.receipts).filter(([k])=>rewardKey(k)))};}
const mirror=b=>b.wonders.version===1?{version:1}:b.wonders.version===2?{version:2,cooperations:copy(b.wonders.cooperations)}:{version:3,cooperations:copy(b.wonders.cooperations),visits:copy(b.wonders.visits)};
const validRows=rows=>object(rows)&&Object.keys(rows).length<=4096&&Object.entries(rows).every(([id,r])=>/^[-\w:]{1,100}$/.test(id)&&r.id===id&&['night','fishing','market','couture','fireworks'].includes(r.template)&&int(r.day)&&r.day>0&&Array.isArray(r.proof)&&r.proof.length===1&&validCooperationRows(r.proof))&&new Set(Object.values(rows).map(r=>r.proof[0].operationId)).size===Object.keys(rows).length;
export function validWonderBook(w){
 if(w===undefined)return true;
 if(!w||![1,2,3].includes(w.version)||!validEventWonders({eventWonders:{version:2,owned:w.snapshot?.owned,receipts:w.snapshot?.receipts,displayed:null,displays:{},pendingDisplays:{},exchanges:{},sources:{}}}))return false;
 if(Object.keys(w.snapshot.owned).some(id=>!ids.has(id))||Object.keys(w.snapshot.receipts).some(k=>!rewardKey(k)))return false;
 if(w.version!==1&&!validRows(w.cooperations))return false;
 if(w.version!==3)return true;
 if(!object(w.visits)||Object.keys(w.visits).length>31||Object.entries(w.visits).some(([id,r])=>id!==r.guestAccountId)||!validLanVisits(Object.values(w.visits)))return false;
 if(!object(w.lanEvents)||Object.keys(w.lanEvents).length>4096||Object.entries(w.lanEvents).some(([id,v])=>!/^[-\w:]{1,100}$/.test(id)||v!==true))return false;
 return object(w.externalRequests)&&Object.keys(w.externalRequests).length<=4096&&Object.entries(w.externalRequests).every(([id,r])=>/^[-\w:]{1,100}$/.test(id)&&/^[a-f0-9]{64}$/.test(r.fingerprint)&&object(r.result));
}
export function assertWonderState(s,b){if(b?.wonders&&(!same(s.wonderControl,mirror(b))||!same(projection(s),b.wonders.snapshot)))throw Object.assign(Error('活动纪念品、协作进度与印记由服务端确认，请读取已保存进度'),{status:409,code:'wonder_state_conflict'});}
export function syncWonderState(s,b){if(!b?.wonders)return;b.wonders.snapshot=projection(s);s.wonderControl=mirror(b);}
function eligible(s,g){return ({night:completedNightProof,fishing:completedFishingProof,market:(s,g)=>completedMarketProof(s,g,{requireQuality:false}),couture:(s,g)=>completedCoutureProof(s,g,{requireQuality:false}),fireworks:(s,g)=>completedFireworksProof(s,g,{requireQuality:false})})[g?.template]?.(s,g);}
function append(s,b,g){if(!g||b.wonders.cooperations[g.id]||!eligible(s,g))return false;const used=new Set(Object.values(b.wonders.cooperations).map(r=>r.proof[0].operationId)),proof=verifiedCooperation(s,g).filter(r=>!used.has(r.operationId));if(!proof.length)return false;if(Object.keys(b.wonders.cooperations).length>=4096)return false;b.wonders.cooperations[g.id]={id:g.id,template:g.template,day:g.endedDay||s.day,proof:[proof[0]]};const rows=Object.values(b.wonders.cooperations);if(rows.length%10===0)awardCooperationTree(s,rows.slice(-10));return true;}
function historical(s,b){const events=[...(s.nightParty?.history||[]).map(g=>({...g,id:g.eventId,template:'night'})),...[s.fishingParty?.session,...(s.fishingParty?.history||[])].filter(Boolean).map(g=>({...g,template:'fishing'})),...[s.festivalParty?.session,...(s.festivalParty?.history||[])].filter(Boolean).map(g=>({...g,template:'market'})),...[s.coutureParty?.session,...(s.coutureParty?.history||[])].filter(Boolean).map(g=>({...g,template:'couture'})),...[s.fireworksParty?.session,...(s.fireworksParty?.history||[])].filter(Boolean).map(g=>({...g,template:'fireworks'}))].sort((a,b)=>(a.endedDay||0)-(b.endedDay||0));for(const g of events)append(s,b,g);}
export function enableWonderState(s,b,{source=s}={}){
 if(!b||b.wonders?.version===3)return;if(b.wonders)assertWonderState(s,b);
 const prior=b.wonders,trusted=copy(source);syncWonders(trusted);const tw=hydrateWonders(trusted);
 delete tw.owned.archipelago_lighthouse;for(const k of Object.keys(tw.receipts))if(k.startsWith('wonder:archipelago_lighthouse:'))delete tw.receipts[k];
 if(prior?.version!==2){delete tw.owned.cooperation_tree;for(const k of Object.keys(tw.receipts))if(k.startsWith('wonder:cooperation_tree:'))delete tw.receipts[k];}
 b.wonders={version:3,snapshot:projection(trusted),cooperations:prior?.version===2?copy(prior.cooperations):{},visits:{},lanEvents:{},externalRequests:{}};
 if(prior?.version!==2)historical(trusted,b);
 const w=hydrateWonders(s),p=projection(trusted);for(const id of PROTECTED_WONDER_IDS){if(p.owned[id])w.owned[id]=p.owned[id];else{delete w.owned[id];delete w.displays[id];delete w.pendingDisplays[id];}}
 for(const k of Object.keys(w.receipts))if(rewardKey(k))delete w.receipts[k];Object.assign(w.receipts,p.receipts);syncWonderState(s,b);
}
export function recordLanWonder(s,b,input){
 enableWonderState(s,b);const w=b.wonders;
 if(input.operation!=='lan_wonder'||!/^[-\w:]{1,100}$/.test(input.id||'')||!Array.isArray(input.visits)||input.visits.length>3||!input.visits.length||input.visits.some(v=>!validLanVisit(v)||v.eventId!==input.eventId||v.hostWorldKey!==input.worldKey)||new Set(input.visits.map(v=>v.guestAccountId)).size!==input.visits.length)throw Object.assign(Error('来访奇观凭据未通过核对'),{status:409,code:'lan_wonder_invalid'});
 const fingerprint=createHash('sha256').update(JSON.stringify(input)).digest('hex'),prior=w.externalRequests[input.id];if(prior){if(prior.fingerprint!==fingerprint)throw Object.assign(Error('同一来访结算不能更换凭据'),{status:409,code:'lan_wonder_id_conflict'});return {replayed:true,result:copy(prior.result)};}
 if(Object.keys(w.externalRequests).length>=4096)throw Object.assign(Error('来访纪念回执已达到上限，现有记录已保留'),{status:409,code:'lan_wonder_limit'});
 const row=!w.lanEvents[input.eventId]&&input.visits.find(v=>!w.visits[v.guestAccountId]);w.lanEvents[input.eventId]=true;let newIds=[];
 if(row){w.visits[row.guestAccountId]=copy(row);const visits=Object.values(w.visits);if(visits.length%5===0)newIds=awardArchipelagoLighthouse(s,visits.slice(-5)).newIds;}
 const result={eventId:input.eventId,counted:!!row,total:Object.keys(w.visits).length,milestone:!!row&&Object.keys(w.visits).length%5===0,newIds};w.externalRequests[input.id]={fingerprint,result:copy(result)};syncWonderState(s,b);return {replayed:false,result};
}
export function recordCooperativeWonder(s,b,input,result){if(!b?.wonders||b.wonders.version!==3||input.operation!=='finish'||result.receipt?.outcome!=='finished')return;const template={party:'night',fishing:'fishing',festival:'market',couture:'couture',fireworks:'fireworks'}[input.kind],eventId=result.ticket?.eventId;if(!template||!eventId)return;const field={fishing:'fishingParty',market:'festivalParty',couture:'coutureParty',fireworks:'fireworksParty'}[template],g=template==='night'?(s.nightParty?.history||[]).find(g=>g.eventId===eventId):s[field]?.session||s[field]?.history?.find(g=>g.id===eventId);if(g)append(s,b,{...g,id:eventId,template});}
export function clearWonderState(s){delete s.wonderControl;}

export function lanWonderProgress(w){
 if(!w||w.version!==3)return null;
 return {snapshot:{owned:w.snapshot.owned.archipelago_lighthouse?{archipelago_lighthouse:copy(w.snapshot.owned.archipelago_lighthouse)}:{},receipts:Object.fromEntries(Object.entries(w.snapshot.receipts).filter(([k])=>k.startsWith('wonder:archipelago_lighthouse:')))},visits:copy(w.visits),lanEvents:copy(w.lanEvents),externalRequests:copy(w.externalRequests)};
}
export function restoreLanWonderProgress(s,b,p){
 enableWonderState(s,b);const w=hydrateWonders(s);if(p.snapshot.owned.archipelago_lighthouse)w.owned.archipelago_lighthouse=copy(p.snapshot.owned.archipelago_lighthouse);else{delete w.owned.archipelago_lighthouse;delete w.displays.archipelago_lighthouse;delete w.pendingDisplays.archipelago_lighthouse;}
 for(const k of Object.keys(w.receipts))if(k.startsWith('wonder:archipelago_lighthouse:'))delete w.receipts[k];Object.assign(w.receipts,p.snapshot.receipts);for(const key of ['visits','lanEvents','externalRequests'])b.wonders[key]=copy(p[key]);syncWonderState(s,b);
}
