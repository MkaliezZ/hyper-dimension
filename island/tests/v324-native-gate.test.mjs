import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeGate} from './nativeGate.mjs';
function timers(){let expire,cancelled=0;return{options:{schedule(fn,ms){assert.equal(ms,30000);expire=fn;return 7;},cancel(id){assert.equal(id,7);cancelled++;}},expire:()=>expire(),cancelled:()=>cancelled};}
test('a native held gate returns the original result and clears its deadline',async()=>{const t=timers(),value={receipt:1};assert.equal(await nativeGate(Promise.resolve(value),'move',t.options),value);assert.equal(t.cancelled(),1);});
test('a native held gate preserves the original failure and clears its deadline',async()=>{const t=timers(),error=Error('actual response failed');await assert.rejects(nativeGate(Promise.reject(error),'poll',t.options),e=>e===error);assert.equal(t.cancelled(),1);});
test('an unobserved native request fails with its exact stage, without declaring success',async()=>{const t=timers(),pending=nativeGate(new Promise(()=>{}),'held room movement',t.options);t.expire();await assert.rejects(pending,/Native fixture gate timed out: held room movement/);assert.equal(t.cancelled(),1);});
