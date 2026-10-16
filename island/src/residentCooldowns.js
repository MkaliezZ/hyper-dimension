import {residentLifeClock} from './residentLife.js';
import {NPC_CADENCE} from './npcCadence.js';
// Durable pauses follow effective island time; page RAF time starts again on reload.
export const RESIDENT_COOLDOWN_SECONDS=Object.freeze({social:NPC_CADENCE.socialCooldownSeconds,personal:65,retry:30});
const fields={social:'socialAfter',personal:'personalAfter',retry:'retryAfter'};
const valid=n=>Number.isFinite(n)&&n>=0;
function historyClock(row){return Number.isSafeInteger(row?.day)&&row.day>0&&valid(row.daySeconds)&&row.daySeconds<=900?(row.day-1)*900+row.daySeconds:null;}
export function residentHistoryAge(s,row,pageTime=0){
 const at=historyClock(row),now=residentLifeClock(s);
 if(at!==null)return at<=now?now-at:Infinity;
 return valid(pageTime)&&valid(row?.time)&&pageTime>=row.time?pageTime-row.time:Infinity;
}
export function residentCooldownRemaining(s,c,kind,pageTime=0){
 if(!Object.hasOwn(fields,kind))return 0;const field=fields[kind],limit=RESIDENT_COOLDOWN_SECONDS[kind];
 const after=c?.[field];if(!valid(after))return 0;const now=residentLifeClock(s),stored=c?.cooldowns?.[kind];
 // A legacy client can update the mirror without the new stamp. Only use a stamp
 // that still belongs to this exact event; otherwise reconstruct from its history.
  if(stored?.version===1&&stored.after===after&&valid(stored.until)&&stored.until<=now+limit+.000001)return Math.max(0,stored.until-now);
 const event=[...(Array.isArray(c?.history)?c.history:[])].reverse().find(row=>{
  if(!row||typeof row!=='object')return false;
  const delta=after-row.time,at=historyClock(row),matches=kind==='personal'?row.action==='visit':kind==='social'?row.action==='social':row.buildingId===c.retryBuilding;
  return matches&&valid(row.time)&&at!==null&&at<=now&&delta>=0&&delta<=limit+.000001;
 });
 if(event)return Math.max(0,historyClock(event)+Math.min(limit,after-event.time)-now);
 // Very old documents have no active-time anchor. Keep only a plausible current
 // page pause, never reinterpret an earlier page's hours as a new long cooldown.
 const remaining=after-pageTime;return valid(pageTime)&&remaining>0&&remaining<=limit?remaining:0;
}
export function setResidentCooldown(s,c,kind,seconds,pageTime=0){
 if(!Object.hasOwn(fields,kind)||!valid(seconds)||!valid(pageTime))throw TypeError('Invalid resident cooldown');
 const duration=Math.min(seconds,RESIDENT_COOLDOWN_SECONDS[kind]),now=residentLifeClock(s);if(!valid(now))throw TypeError('Invalid island clock');
 const after=pageTime+duration;c[fields[kind]]=after;
 if(!c.cooldowns||typeof c.cooldowns!=='object'||Array.isArray(c.cooldowns))c.cooldowns={};
 c.cooldowns[kind]={version:1,until:now+duration,after};return c.cooldowns[kind];
}
