const identity=value=>typeof value==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(value);
const operationId=value=>typeof value==='string'&&/^[-\w:.]{1,160}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);
const fields=['goal','buildingId','action','activity','resource','recipeId','foodId','facilityId','purposeId','source','assignmentId','operationId','storyId','preparing'];
// Capture the original command, never a later NPC decision or another world's
// pending journal. A unique operation ID is required even though legacy starts
// without one remain supported by their existing manual recovery path.
export function residentStartRecoveryContext(input,actions,worldKey){
 if(input?.kind!=='resident'||input.operation!=='begin'||input.actor!==undefined&&input.actor!=='npc'||!Number.isSafeInteger(input.actorId)||input.actorId<0||input.actorId>16||!identity(input.requestId)||!identity(input.epoch)||input.epoch!==actions?.epoch||!Number.isSafeInteger(input.expectedSequence)||input.expectedSequence<0||input.expectedSequence!==actions.sequence||typeof worldKey!=='string'||!worldKey.length)return null;
 const intent=input.intent;
 if(!intent||Array.isArray(intent)||!['work','eat','rest','visit'].includes(intent.action)||typeof intent.goal!=='string'||!intent.goal.length||intent.goal.length>40||!operationId(intent.operationId))return null;
 return {worldKey,input:structuredClone(input)};
}
// A lost acknowledgement permits one canonical read after the existing exact
// transport retries. Adopt only its actual, still active lease; no completion,
// reward, replacement command or additional action submission is synthesized.
export function canonicalResidentStartResult(context,document){
 if(!context||!document||typeof document.version!=='string'||!document.version||document.state?.saveSlot!==context.worldKey)return null;
 const i=context.input,b=document.actions,t=b?.resident?.leases?.[i.requestId];
 if(b?.epoch!==i.epoch||!Number.isSafeInteger(b.sequence)||b.sequence<i.expectedSequence+1||!Array.isArray(b.receipts)||b.receipts.some(r=>r?.ticket?.requestId===i.requestId)||!t||t.kind!=='resident'||t.actor!=='npc'||t.actorId!==i.actorId||t.requestId!==i.requestId||t.epoch!==i.epoch||t.sequence!==i.expectedSequence+1||t.operationId!==i.intent.operationId||t.intent?.operationId!==i.intent.operationId||(t.assignmentId??null)!==(i.intent.assignmentId??null))return null;
 if(!Number.isFinite(t.startedAt)||!Number.isFinite(t.duration)||t.duration<9||!Number.isFinite(t.readyAt)||t.readyAt<t.startedAt+t.duration*1000||!Number.isFinite(t.expiresAt)||t.expiresAt<=t.readyAt||!Number.isFinite(t.gameTime)||t.gameTime<0)return null;
 // The server binds the accepted input and substitutes its acknowledged game
 // clock. Compare that clock, not an unacknowledged browser time or wall clock.
 if(t.beginSignature!==JSON.stringify([i.actorId,t.gameTime,...fields.map(k=>i.intent[k]??null)]))return null;
 for(const key of fields){
  if(key==='assignmentId'||i.intent[key]===undefined)continue;
  const expected=key==='source'?(i.intent.assignmentId?'hermes':i.intent.source==='deepseek'?'deepseek':'local'):i.intent[key];
  if((t.intent[key]??null)!==(expected??null))return null;
 }
 return {document,ticket:t,receipt:null,replayed:true,recoveredStart:true};
}
