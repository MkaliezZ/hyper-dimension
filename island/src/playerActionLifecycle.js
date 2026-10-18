import {MAX_NAVIGATION_FRAME_SECONDS} from './frameClock.js';

const playerKinds=new Set(['gather','craft','farm','field','party','fishing','festival','couture','fireworks']);
const kind=t=>t?.kind||'gather';
const identity=t=>!!t&&playerKinds.has(kind(t))&&t.actor!=='npc'&&typeof t.requestId==='string'&&t.requestId.length>0&&typeof t.epoch==='string'&&t.epoch.length>0&&Number.isSafeInteger(t.sequence)&&t.sequence>0&&Number.isFinite(t.duration)&&t.duration>0;

// Bind only a returned server lease. Local building and resource callbacks
// retain their existing wait until the outstanding receipt has been resolved.
export function bindAcceptedPlayerAction(actor,ticket,at=performance.now()){
 const action=actor?.action;
 if(!action||!identity(ticket)||!Number.isFinite(at)||Math.abs(action.duration-ticket.duration)>1e-8)return false;
 action.acceptedLease={kind:kind(ticket),requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence,duration:ticket.duration,acknowledgedAt:at};
 return true;
}

// An unrelated response must not starve an already granted animation. The
// original controller queues its finish; only the server receipt awards goods.
export function advanceAcceptedPlayerAction(actor,dt,active,{at=performance.now(),onContact=()=>{}}={}){
 const action=actor?.action,lease=action?.acceptedLease;
 if(!lease||!identity(active)||kind(active)!==lease.kind||['requestId','epoch','sequence','duration'].some(k=>active[k]!==lease[k])||!Number.isFinite(dt)||dt<=0)return false;
 const elapsed=Math.min(MAX_NAVIGATION_FRAME_SECONDS,dt);
 action.t=Math.min(action.duration,action.t+elapsed);actor.walkMix=(actor.walkMix||0)*Math.exp(-elapsed*10);
 if(!action.contact&&action.t>=action.duration*.52){action.contact=true;onContact(action);action.onContact?.();}
 if(action.t>=action.duration&&Number.isFinite(at)&&at-lease.acknowledgedAt>=action.duration*1000){
  actor.action=null;action.awaitingReceipt=true;action.onDone?.();
 }
 return true;
}
