import assert from 'node:assert/strict';
export function assertHomeJournalReceipt(document,id){
 assert.equal(document.state.homeActivities[id].completedDays,1);
 const receipt=document.actions.receipts.findLast(r=>r.ticket?.kind==='personal'&&r.ticket.command==='home_activity'&&r.details?.entry?.homeId===id);
 assert(receipt,'The saved journal must have its own authoritative completion receipt');
 assert.equal(receipt.cashDelta,0);assert.deepEqual(receipt.stockDelta,{});
 return {cashDelta:receipt.cashDelta,stockDelta:structuredClone(receipt.stockDelta)};
}
