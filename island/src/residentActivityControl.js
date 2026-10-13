// A sleeping resident can honour an already accepted activity invitation.
// An action being submitted or awaiting its authoritative receipt cannot be taken over.
export function residentHasPendingWork(n){
 const d=n?.intent;return !!(d?.starting||[['serverResidentTicket','serverResidentFinished'],['serverFieldTicket','serverFieldFinished'],['serverFarmTicket','serverFarmFinished']].some(([ticket,done])=>d?.[ticket]&&!d?.[done]));
}
export function residentActivityBlocked(n,occupied=()=>false,{allowRoomDeparture=false}={}){
 return !n||!!(n.action||n.meeting||n.partyControlled||n.recruitControlled||occupied(n.npcId)||residentHasPendingWork(n)||n.inside!=null&&!n.homeRest&&!allowRoomDeparture);
}
