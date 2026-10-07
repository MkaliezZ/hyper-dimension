import {PARTY_GUIDES,partyGuide} from './partyGuide.js';
import {partyDraftStamp} from './partyPlanning.js';
export const HOST_KINDS=Object.freeze({night:'party',fishing:'fishing',market:'festival',couture:'couture',fireworks:'fireworks'});
export function hostingDraft(s,template){const c=PARTY_GUIDES.find(c=>c.template===template);return c?s[c.field]?.draft||null:null;}
export function hostingMatches(s,h){const d=hostingDraft(s,h.template);return !!(d&&d.id===h.eventId&&d.version===h.eventVersion&&partyDraftStamp(d)===h.eventStamp);}
const id=v=>typeof v==='string'&&/^host-[a-f0-9-]{36}$/.test(v);
function validIntent(h,history=false){
 return !!(h&&id(h.id)&&Object.hasOwn(HOST_KINDS,h.template)&&typeof h.eventId==='string'&&h.eventId.length<=80&&Number.isSafeInteger(h.eventVersion)&&h.eventVersion>0&&typeof h.eventStamp==='string'&&h.eventStamp.length<=1000&&typeof h.name==='string'&&h.name.length>0&&h.name.length<=24&&Number.isSafeInteger(h.armedDay)&&h.armedDay>0&&['player','hermes'].includes(h.source)&&(h.runId===null||typeof h.runId==='string'&&/^hd-island-[a-f0-9]{32}$/.test(h.runId))&&(h.proposalId===null||typeof h.proposalId==='string'&&/^[a-f0-9]{32}$/.test(h.proposalId))&&(history?['finished','cancelled','stale'].includes(h.phase)&&Number.isSafeInteger(h.endedDay)&&h.endedDay>=h.armedDay&&typeof h.reason==='string'&&h.reason.length<=200:['armed','started'].includes(h.phase))&&(!h.startRequestId||typeof h.startRequestId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(h.startRequestId))&&(h.phase!=='started'||h.startRequestId&&Number.isSafeInteger(h.startedDay)&&h.startedDay>=h.armedDay&&typeof h.sessionId==='string'));
}
export function validHostingBook(b){return b===undefined||!!(b&&b.version===1&&typeof b.worldKey==='string'&&b.worldKey.length>0&&b.worldKey.length<=200&&Array.isArray(b.active)&&b.active.length<=5&&Array.isArray(b.history)&&b.history.length<=20&&b.active.every(h=>validIntent(h))&&b.history.every(h=>validIntent(h,true))&&new Set([...b.active,...b.history].map(h=>h.id)).size===b.active.length+b.history.length&&new Set(b.active.map(h=>h.template)).size===b.active.length);}
export function validPartyHosting(s){return validHostingBook(s.partyHosting);}
export function hostingView(s,template){
 const h=s.partyHosting?.active?.find(h=>h.template===template);if(!h)return null;
 const guide=partyGuide(s,template);
 if(h.phase==='started')return {...h,label:'已召集开场',message:'伙伴正在赴约或已入场；打开现场继续小游戏。'};
 if(!hostingMatches(s,h))return {...h,label:'方案已改变',message:'旧委托已失效，请重新委托这一版。',ready:false};
 return {...h,label:guide.ready?'就绪待开场':'管家等待中',message:guide.ready?'回到小岛后，管家会召集并带你到场。':guide.message,ready:guide.ready};
}
export function nextHostedParty(s,{actionActive=false}={}){
 if(actionActive)return null;
 return (s.partyHosting?.active||[]).filter(h=>h.phase==='armed'&&hostingMatches(s,h)).find(h=>partyGuide(s,h.template)?.ready)||null;
}
