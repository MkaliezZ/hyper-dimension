import {MAX_NAVIGATION_FRAME_SECONDS} from './frameClock.js';

// An accepted service may complete its visible pose while unrelated saves wait.
// The original visitor lease still owns all stock, timing checks and payment.
export function advanceAcceptedVisitorService(guest,dt,at=performance.now()){
 const ticket=guest?.serverTicket,action=guest?.indoorActor?.action;
 if(guest?.stage!=='servicing'||guest.remotePending||ticket?.kind!=='visitor'||ticket.guestId!==guest.id||ticket.buildingId!==guest.targetBuilding||!action||!Number.isFinite(ticket.duration)||ticket.duration<=0||ticket.duration>60||action.duration!==ticket.duration||!Number.isFinite(guest.serviceAcknowledgedAt)||!Number.isFinite(at)||!Number.isFinite(dt)||dt<=0)return false;
 const elapsed=Math.min(MAX_NAVIGATION_FRAME_SECONDS,dt);
 guest.serviceTime=Math.min(ticket.duration,Math.max(0,guest.serviceTime||0)+elapsed);action.t=guest.serviceTime;
 return guest.serviceTime>=ticket.duration&&at-guest.serviceAcknowledgedAt>=ticket.duration*1000;
}
