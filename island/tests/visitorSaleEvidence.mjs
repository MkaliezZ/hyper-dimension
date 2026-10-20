// Accept only authority evidence tied to an actual observed finish request.
// This observes sales; it never settles,credits or fabricates a transaction.
export function collectVisitorSale(data,{worldKey,item,finishes,sales,source}){
 const doc=data?.document;if(doc?.state?.saveSlot!==worldKey||!doc.actions||!Array.isArray(doc.actions.receipts))return;
 const candidates=source==='finish-response'?[data.receipt]:source==='canonical-read'?doc.actions.receipts:[];
 for(const receipt of candidates){
  const t=receipt?.ticket,input=finishes.get(t?.requestId);
  if(!input||input.kind!=='visitor'||input.operation!=='finish'||t.kind!=='visitor'||t.command!=='begin'||receipt.outcome!=='finished'||input.epoch!==t.epoch||input.sequence!==t.sequence||doc.actions.epoch!==t.epoch||t.quote?.item!==item||!Number.isSafeInteger(receipt.paid)||receipt.paid<=0||receipt.paid!==t.quote.paid||receipt.cost!==t.quote.cost||!Number.isSafeInteger(doc.state.inventory?.[item])||doc.state.inventory[item]<0||sales.some(s=>s.requestId===t.requestId))continue;
  if(!doc.actions.receipts.some(r=>r.ticket?.requestId===t.requestId&&r.ticket.epoch===t.epoch&&r.ticket.sequence===t.sequence&&r.outcome==='finished'))continue;
  sales.push({requestId:t.requestId,source,paid:receipt.paid,cost:receipt.cost,quote:structuredClone(t.quote),stock:doc.state.inventory[item]});
 }
}
