import {validLanVisit} from '../src/lanWonderEvidence.js';
export function lanWonderStep(e){
 if(e.phase!=='completed'||typeof e.hostWorldKey!=='string')return null;
 const visits=Object.values(e.results).filter(r=>r.accountId!==e.owner&&r.outcome==='completed').map(r=>({eventId:e.id,roomId:e.roomId,guestAccountId:r.accountId,hostAccountId:e.owner,hostWorldKey:e.hostWorldKey,guestWorldKey:r.worldKey,runId:r.runId,quality:r.result.quality,minQuality:e.minQuality,completedAt:e.completedAt,arrival:e.invitations[r.accountId]?.admission?.arrivalProof})).filter(validLanVisit);
 if(!visits.length)return null;
 return {accountId:e.owner,theme:e.theme,input:{id:'lan-wonder:'+e.id,operation:'lan_wonder',worldKey:e.hostWorldKey,eventId:e.id,visits}};
}
