import {sameState} from './actionMerge.js';
const identity=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(value);
const npc=t=>t.actor==='npc'&&Number.isSafeInteger(t.actorId)&&t.actorId>=0&&t.actorId<=16;
const eligible=t=>t?.kind==='resident'?npc(t):t?.kind==='field'?npc(t)&&t.field==='mine':t?.kind==='visitor'&&t.command==='begin'&&t.item==='visitor'&&Number.isSafeInteger(t.guestId)&&t.guestId>0&&Number.isInteger(t.stop)&&t.stop>=0&&t.stop<3&&Number.isInteger(t.buildingId)&&t.buildingId>=0&&t.buildingId<25;
const sameIdentity=(a,b)=>a?.kind===b?.kind&&a?.requestId===b?.requestId&&a?.epoch===b?.epoch&&a?.sequence===b?.sequence;
function comparable(ticket){if(ticket.kind!=='field')return ticket;const copy={...ticket};delete copy.game;delete copy.lastBatchHash;return copy;}
// Capture only an already acknowledged authority lease before any network wait.
// No local ticket, model output, player work or real-file operation can authorize recovery.
export function completionRecoveryContext(input,actions,worldKey){
 if(input?.operation!=='finish'||!['resident','field','visitor'].includes(input.kind)||!identity(input.requestId)||!identity(input.epoch)||!Number.isSafeInteger(input.sequence)||input.sequence<=0||typeof worldKey!=='string'||!worldKey.length)return null;
 const ticket=actions?.[input.kind]?.leases?.[input.requestId];
 if(!eligible(ticket)||!sameIdentity(ticket,input)||actions.epoch!==input.epoch||!Number.isSafeInteger(actions.sequence)||actions.sequence<input.sequence||!Number.isFinite(ticket.readyAt))return null;
 return {worldKey,ticket:structuredClone(ticket)};
}
// Return the actual canonical receipt and document, never an inferred reward.
// A contradictory, rolled-out or cancelled record remains a manual recovery.
export function canonicalCompletionResult(context,document){
 if(!context||!document||typeof document.version!=='string'||!document.version||document.state?.saveSlot!==context.worldKey||document.actions?.epoch!==context.ticket.epoch||!Number.isSafeInteger(document.actions.sequence)||document.actions.sequence<context.ticket.sequence||!Array.isArray(document.actions.receipts))return null;
 const ticket=context.ticket,rows=document.actions.receipts.filter(r=>r?.ticket?.requestId===ticket.requestId);
 if(rows.length!==1||document.actions[ticket.kind]?.leases?.[ticket.requestId])return null;
 const receipt=rows[0];
 if(receipt.outcome!=='finished'||!Number.isFinite(receipt.at)||receipt.at<ticket.readyAt||!sameIdentity(receipt.ticket,ticket)||!sameState(comparable(receipt.ticket),comparable(ticket)))return null;
 return {document,ticket:receipt.ticket,receipt,replayed:true,recoveredReceipt:true};
}
