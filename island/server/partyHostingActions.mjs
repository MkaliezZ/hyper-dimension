import {randomUUID} from 'node:crypto';
import {hostingDraft,hostingMatches,HOST_KINDS,validHostingBook} from '../src/partyHosting.js';
import {partyGuide} from '../src/partyGuide.js';
import {partyDraftStamp} from '../src/partyPlanning.js';
const fail=(message,code='hosting_invalid')=>Object.assign(Error(message),{status:409,code});
export const HOSTING_OPERATIONS=['host_arm','host_cancel'];
export const hostingSignature=i=>HOSTING_OPERATIONS.includes(i.operation)?[i.template??null,i.hostIntentId??null,i.eventId??null,i.eventVersion??null,i.eventStamp??null]:[];
export function assertPartyHostingState(s,b){if(b?.hosting&&JSON.stringify(s.partyHosting)!==JSON.stringify(b.hosting))throw fail('管家主持委托由本机服务保存，请读取已确认的手账','hosting_state_conflict');}
export function clearPartyHosting(s){delete s.partyHosting;}
function archive(s,b,h,phase,reason){b.hosting.active=b.hosting.active.filter(x=>x.id!==h.id);b.hosting.history=[{...h,phase,endedDay:s.day,reason},...b.hosting.history].slice(0,20);}
export function syncPartyHosting(s,b){
 if(!b?.hosting)return;
 for(const h of [...b.hosting.active])if(h.phase==='armed'&&!hostingMatches(s,h))archive(s,b,h,'stale','原方案已改版或收起；旧委托结束，需重新委托。');
 s.partyHosting=structuredClone(b.hosting);
}
export function applyHostingManagement(s,b,i,{source='player',runId=null,proposalId=null}={}){
 assertPartyHostingState(s,b);
 if(!Object.hasOwn(HOST_KINDS,i.template))throw fail('选择一场现有活动');
 if(!b.hosting)b.hosting={version:1,worldKey:s.saveSlot||'legacy-'+i.theme,active:[],history:[]};
 if(b.hosting.worldKey!==(s.saveSlot||'legacy-'+i.theme))throw fail('主持委托所属小岛已更换','hosting_world');
 let h=b.hosting.active.find(x=>x.template===i.template);
 if(i.operation==='host_cancel'){
  if(!h||h.id!==i.hostIntentId)throw fail('主持委托已变化，请打开当前手账','hosting_changed');
  if(h.phase==='started')throw fail('本场已经开场；请在活动现场结束，不重复退回费用','hosting_started');
  archive(s,b,h,'cancelled','岛主收回主持委托；已有筹备和邀请保留。');syncPartyHosting(s,b);return{ok:true,template:i.template,hostIntentId:h.id,text:'主持委托已收回，用品与邀请保留。'};
 }
 if(i.operation!=='host_arm')throw fail('主持操作无效');
 const d=hostingDraft(s,i.template);
 if(!d||d.id!==i.eventId||d.version!==i.eventVersion||partyDraftStamp(d)!==i.eventStamp)throw fail('请委托当前版本的活动方案','hosting_changed');
 const g=partyGuide(s,i.template);if(['active','results'].includes(g.phase))throw fail('本场已经开场，请回到现场','hosting_started');
 if(h?.phase==='started')throw fail('先结束已委托的这场活动','hosting_started');
 if(h&&hostingMatches(s,h)){syncPartyHosting(s,b);return{ok:true,template:i.template,hostIntentId:h.id,replayed:true,text:'这一版已交给管家，等待真实筹备与邀请。'};}
 if(h)archive(s,b,h,'stale','岛主委托新的活动版本。');
 h={id:'host-'+randomUUID(),template:i.template,eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d),name:d.name,phase:'armed',armedDay:s.day,source,runId,proposalId};
 b.hosting.active.push(h);syncPartyHosting(s,b);if(!validHostingBook(b.hosting))throw fail('主持记录未通过核对');
 return{ok:true,template:i.template,hostIntentId:h.id,text:'已交给管家：本版物资与亲自邀请齐备后，回到小岛召集开场。'};
}
export function checkHostedBegin(s,b,i){
 if(i.operation!=='begin'||!i.hostIntentId)return;
 assertPartyHostingState(s,b);const h=b.hosting?.active.find(x=>x.id===i.hostIntentId);
 if(!h||h.phase!=='armed'||HOST_KINDS[h.template]!==i.kind||!hostingMatches(s,h)||h.eventId!==i.eventId||h.eventVersion!==i.eventVersion||h.eventStamp!==i.eventStamp)throw fail('主持委托已结束或活动改版，请查看当前手账','hosting_changed');
 const g=partyGuide(s,h.template);if(!g.ready)throw fail(g.message,'hosting_not_ready');
}
export function recordHostingAction(s,b,i,result){
 if(!b.hosting)return;const t=result.ticket;
 if(i.operation==='begin'&&t&&Object.values(HOST_KINDS).includes(t.kind)){
  const template=t.kind==='party'?'night':t.kind==='festival'?'market':t.kind,h=b.hosting.active.find(h=>h.template===template&&h.phase==='armed'&&h.eventId===(t.design?.id||t.eventId));
  if(h&&h.eventVersion===(t.design?.version||t.eventVersion)&&(!i.hostIntentId||h.eventStamp===(t.design?.stamp||t.eventStamp||i.eventStamp))){h.phase='started';h.startRequestId=t.requestId;h.startedDay=s.day;h.sessionId=t.eventId;}
 }
 if(result.receipt&&['finished','cancelled'].includes(result.receipt.outcome)){
  const h=b.hosting.active.find(h=>h.phase==='started'&&h.startRequestId===t?.requestId);
  if(h)archive(s,b,h,result.receipt.outcome,result.receipt.outcome==='finished'?'本场实际演出与结算完成。':'本场提前结束，按实际已投入用品结算。');
 }
 syncPartyHosting(s,b);
}
