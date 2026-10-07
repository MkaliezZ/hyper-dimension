const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v),world=v=>typeof v==='string'&&/^[-\w:]{1,160}$/.test(v),int=n=>Number.isSafeInteger(n)&&n>=0;
export function validLanVisit(v){
 const a=v?.arrival;
 return !!(v&&uuid(v.eventId)&&uuid(v.roomId)&&uuid(v.guestAccountId)&&uuid(v.hostAccountId)&&v.guestAccountId!==v.hostAccountId&&uuid(v.runId)&&world(v.hostWorldKey)&&world(v.guestWorldKey)&&int(v.quality)&&v.quality>=v.minQuality&&v.quality<=100&&int(v.minQuality)&&v.minQuality>=55&&v.minQuality<=95&&int(v.completedAt)&&a?.source==='server-harbor-route'&&a.accountId===v.guestAccountId&&a.hostAccountId===v.hostAccountId&&a.hostWorldKey===v.hostWorldKey&&a.guestWorldKey===v.guestWorldKey&&a.roomId===v.roomId&&int(a.enteredAt)&&int(a.arrivedAt)&&a.arrivedAt>=a.enteredAt&&a.arrivedAt<=v.completedAt&&a.butlerActorId===v.guestAccountId+':'+v.guestWorldKey+':npc:15'&&Number.isFinite(a.position?.x)&&Number.isFinite(a.position?.y));
}
export function validLanVisits(rows){return Array.isArray(rows)&&rows.every(validLanVisit)&&new Set(rows.map(r=>r.eventId)).size===rows.length&&new Set(rows.map(r=>r.guestAccountId)).size===rows.length;}
