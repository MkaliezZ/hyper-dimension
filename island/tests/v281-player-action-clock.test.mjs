import test from 'node:test';
import assert from 'node:assert/strict';
import {bindAcceptedPlayerAction,advanceAcceptedPlayerAction} from '../src/playerActionLifecycle.js';
import {advancePendingActionPose} from '../src/residentActivityControl.js';

for(const kind of ['gather','craft','farm','field','party','fishing','festival','couture','fireworks']){
 test(kind+' granted player animation queues exactly one finish during unrelated pending receipts',()=>{
  let contact=0,finish=0;
  const ticket={...(kind==='gather'?{}:{kind}),actor:'player',requestId:'work-1',epoch:'island-1',sequence:7,duration:2};
  const actor={action:{type:kind,t:0,duration:2,onContact:()=>contact++,onDone:()=>finish++}};
  assert(bindAcceptedPlayerAction(actor,ticket,1000));
  for(let i=1;i<=30;i++)advanceAcceptedPlayerAction(actor,.1,ticket,{at:1000+i*100});
  assert.equal(contact,1);assert.equal(finish,1);assert.equal(actor.action,null);
 });
}
test('a lease from another island, request, sequence or kind cannot run a completion',()=>{
 const original={kind:'farm',actor:'player',requestId:'work-1',epoch:'island-1',sequence:7,duration:2};
 for(const change of [{requestId:'other'},{epoch:'other'},{sequence:8},{kind:'craft'},{duration:3},{actor:'npc'}]){
  const actor={action:{t:0,duration:2,onDone:()=>assert.fail('foreign lease completed')}};
  assert(bindAcceptedPlayerAction(actor,original,0));
  assert.equal(advanceAcceptedPlayerAction(actor,.75,{...original,...change},{at:9000}),false);
  assert.equal(actor.action.t,0);
 }
});
test('invalid or ungranted actions stay finite without running contact or resource callbacks',()=>{
 for(const ticket of [null,{kind:'resident'}, {kind:'farm',actor:'npc',requestId:'x',epoch:'x',sequence:1,duration:2}]){
  const actor={action:{t:0,duration:2,onDone:()=>assert.fail(),onContact:()=>assert.fail()}};
  assert.equal(bindAcceptedPlayerAction(actor,ticket),false);
  for(let i=0;i<40;i++){assert.equal(advanceAcceptedPlayerAction(actor,.1,ticket),false);advancePendingActionPose(actor,.1);}
  assert.equal(actor.action.t,2);assert.equal(actor.action.awaitingReceipt,true);
 }
});
test('visible time is bounded and a queued pose cannot finish before its acknowledged duration',()=>{
 let count=0;const ticket={requestId:'x',epoch:'x',sequence:1,duration:2};
 const actor={action:{t:0,duration:2,onDone:()=>count++}};bindAcceptedPlayerAction(actor,ticket,1000);
 for(const dt of [0,-1,NaN,Infinity])assert.equal(advanceAcceptedPlayerAction(actor,dt,ticket,{at:9000}),false);
 for(let i=0;i<3;i++)advanceAcceptedPlayerAction(actor,100,ticket,{at:1000});
 assert.equal(actor.action.t,2);assert.equal(count,0);
 advanceAcceptedPlayerAction(actor,.1,ticket,{at:3000});assert.equal(count,1);assert.equal(actor.action,null);
});
