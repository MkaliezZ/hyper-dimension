import test from 'node:test';import assert from 'node:assert/strict';import {assertCraftResponse} from '../src/craftResponseIdentity.js';
for(const kind of ['craft','field','party','fishing','festival','couture','fireworks'])test(kind+' accepts only its own begun or settled request',()=>{
 const input={kind,requestId:'owned-request'},ticket={kind,requestId:input.requestId};assert.equal(assertCraftResponse(input,{ticket},kind).ticket,ticket);assert.equal(assertCraftResponse(input,{receipt:{ticket}},kind).receipt.ticket,ticket);
 for(const foreign of [{kind:'resident',requestId:input.requestId},{kind,requestId:'other-request'},null])assert.throws(()=>assertCraftResponse(input,{receipt:{ticket:foreign}},kind),e=>e.code==='action_receipt_mismatch');assert.throws(()=>assertCraftResponse({kind:'resident',requestId:input.requestId},{ticket},kind),e=>e.code==='action_receipt_mismatch');
});
