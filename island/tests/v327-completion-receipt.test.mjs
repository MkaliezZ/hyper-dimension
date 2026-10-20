import test from 'node:test';
import assert from 'node:assert/strict';
import {completionRecoveryContext,canonicalCompletionResult} from '../src/completionReceiptRecovery.js';
const worldKey='hyper-dimension-pixel-v3';
function fixture(kind){
 const ticket={kind,requestId:'known-request-id',epoch:'known-world-epoch',sequence:17,owner:'server-'+kind+':known-owner',item:kind==='visitor'?'visitor':kind==='resident'?'wood':'ore',readyAt:1000,expiresAt:100000,...(kind==='visitor'?{command:'begin',guestId:6,stop:0,buildingId:11,quote:{item:'gift',paid:7,cost:3,net:4}}:{actor:'npc',actorId:5}),...(kind==='field'?{field:'mine',game:null,lastBatchHash:null}:{})};
 const input={kind,operation:'finish',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence},actions={epoch:ticket.epoch,sequence:18,[kind]:{leases:{[ticket.requestId]:ticket}}};
 const canonicalTicket=structuredClone(ticket);if(kind==='field'){delete canonicalTicket.game;delete canonicalTicket.lastBatchHash;}
 const document={version:'actual-canonical-version',state:{saveSlot:worldKey,coins:4,inventory:{gift:0}},actions:{epoch:ticket.epoch,sequence:19,[kind]:{leases:{}},receipts:[{ticket:canonicalTicket,outcome:'finished',at:2000,paid:7,cost:3}]}};
 return{ticket,input,actions,document,context:completionRecoveryContext(input,actions,worldKey)};
}
for(const kind of ['resident','field','visitor']){
 test(kind+' adopts the actual unique canonical completion without creating a reward or mutation',()=>{
  const f=fixture(kind),before=structuredClone(f),result=canonicalCompletionResult(f.context,f.document);
  assert(result);assert.equal(result.document,f.document);assert.equal(result.ticket,f.document.actions.receipts[0].ticket);assert.equal(result.receipt,f.document.actions.receipts[0]);assert.equal(result.replayed,true);assert.equal(result.recoveredReceipt,true);assert.deepEqual(f,before);
 });
 test(kind+' captures the acknowledged ticket before waits and rejects local or changed identities',()=>{
  const f=fixture(kind);f.ticket.owner='changed-after-wait';assert.equal(f.context.ticket.owner,'server-'+kind+':known-owner');
  for(const change of [{operation:'begin'},{operation:'cancel'},{requestId:'other-request'},{epoch:'other-world-epoch'},{sequence:18},{sequence:0},{sequence:1.5},{sequence:'17'}]){
   const g=fixture(kind);assert.equal(completionRecoveryContext({...g.input,...change},g.actions,worldKey),null);
  }
  for(const change of [{epoch:'other-world-epoch'},{sequence:16},{sequence:undefined},{[kind]:{leases:{}}}]){
   const g=fixture(kind);assert.equal(completionRecoveryContext(g.input,{...g.actions,...change},worldKey),null);
  }
  assert.equal(completionRecoveryContext(f.input,f.actions,''),null);
 });
 test(kind+' leaves missing,cancelled,ambiguous,foreign or contradictory authority results unconfirmed',()=>{
  const changes=[
   d=>delete d.version,d=>d.state.saveSlot='other-world',d=>d.actions.epoch='other-world-epoch',d=>d.actions.sequence=16,d=>d.actions.receipts=[],
   d=>d.actions.receipts[0].outcome='cancelled',d=>d.actions.receipts[0].at=900,d=>d.actions.receipts[0].ticket.requestId='other-request',
   d=>d.actions.receipts[0].ticket.epoch='other-world-epoch',d=>d.actions.receipts[0].ticket.sequence=18,d=>d.actions.receipts[0].ticket.kind='craft',
   d=>d.actions.receipts[0].ticket.owner='other-owner',d=>d.actions.receipts.push(structuredClone(d.actions.receipts[0])),
   d=>d.actions[kind].leases['known-request-id']=structuredClone(d.actions.receipts[0].ticket),
   d=>{if(kind==='visitor')d.actions.receipts[0].ticket.quote.paid=999;else d.actions.receipts[0].ticket.actorId=6;}
  ];
  for(const change of changes){const f=fixture(kind);change(f.document);assert.equal(canonicalCompletionResult(f.context,f.document),null);}
  assert.equal(canonicalCompletionResult(null,fixture(kind).document),null);
 });
}
test('player,facility,non-mining field,unknown visitors and non-game operations cannot authorize a lookup',()=>{
 for(const kind of ['resident','field','visitor']){
  for(const mutate of [t=>t.kind='craft',t=>t.requestId='other-request',t=>t.epoch='other-world-epoch',t=>t.sequence=18,...(kind==='visitor'?[t=>t.command='arrive',t=>t.guestId=0,t=>t.stop=3,t=>t.buildingId=25]:[t=>t.actor='player',t=>t.actor='facility',t=>t.actorId=-1,t=>t.actorId=17,t=>t.actorId=1.5]),...(kind==='field'?[t=>t.field='fishing']:[])]){
   const f=fixture(kind);mutate(f.ticket);assert.equal(completionRecoveryContext(f.input,f.actions,worldKey),null);
  }
 }
});
