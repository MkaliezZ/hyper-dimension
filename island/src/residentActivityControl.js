// A sleeping resident can honour an already accepted activity invitation.
// An action being submitted or awaiting its authoritative receipt cannot be taken over.
export function residentHasPendingWork(n){
 const d=n?.intent;return !!(d?.starting||[['serverResidentTicket','serverResidentFinished'],['serverFieldTicket','serverFieldFinished'],['serverFarmTicket','serverFarmFinished']].some(([ticket,done])=>d?.[ticket]&&!d?.[done]));
}

// Granted work can finish its animation while unrelated receipts wait.
// onDone submits the original lease; only its authoritative receipt delivers work.
export function advanceAcceptedWorkAction(n,dt){
 const d=n?.intent,a=n?.action,key=[['serverFarmTicket','serverFarmFinished','farm'],['serverFieldTicket','serverFieldFinished','field'],['serverResidentTicket','serverResidentFinished','resident']].find(([key,done])=>d?.[key]&&!d?.[done]),t=key&&d[key[0]];
 if(!t||t.kind!==key[2]||t.actor!=='npc'||t.actorId!==n.npcId||d.starting||!a||a.type!==t.action||!Number.isFinite(dt)||dt<=0)return false;
 a.t=Math.min(a.duration,a.t+dt);n.walkMix=(n.walkMix||0)*Math.exp(-dt*10);
 if(a.t>=a.duration){n.action=null;if(n.indoorActor?.action===a)n.indoorActor.action=null;a.onDone?.();}
 return true;
}

// Ungranted/local callbacks stay deferred, but the actor settles into an idle
// wait after a finite pose instead of endlessly swinging the same tool.
export function advancePendingActionPose(actor,dt){
 const a=actor?.action;if(!a||!Number.isFinite(dt)||dt<=0)return;
 a.t=Math.min(a.duration,a.t+dt);if(a.t>=a.duration)a.awaitingReceipt=true;
}
export function residentActivityBlocked(n,occupied=()=>false,{allowRoomDeparture=false}={}){
 return !n||!!(n.action||n.meeting||n.partyControlled||n.recruitControlled||occupied(n.npcId)||residentHasPendingWork(n)||n.inside!=null&&!n.homeRest&&!allowRoomDeparture);
}
