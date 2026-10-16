import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkTimeBudget} from './workTimeBudget.mjs';

test('a slower second journey may use the original combined remaining-chain budget',()=>{
 const remaining=createWorkTimeBudget(240000,'Remaining chain');
 remaining.charge(130000,true); // The hosted second journey crossed the added 120s split.
 remaining.charge(105000,true);
 assert.equal(remaining.usedMs,235000);assert.equal(remaining.limitMs,240000);
 assert.throws(()=>remaining.charge(6000,true),/Remaining chain exceeded 240000ms/);
});
test('off-shift calendar waiting preserves work already spent, and the first job keeps its 120s bound',()=>{
 const first=createWorkTimeBudget(120000,'First job'),remaining=createWorkTimeBudget(240000,'Remaining chain');
 first.charge(119000,true);assert.throws(()=>first.charge(1001,true),/First job exceeded 120000ms/);
 remaining.charge(130000,true);remaining.charge(900000,false);assert.equal(remaining.usedMs,130000);
 remaining.charge(110000,true);assert.equal(remaining.usedMs,240000);assert.throws(()=>remaining.charge(1,true),/exceeded/);
});
test('invalid samples cannot reset or subtract previously spent working time',()=>{
 const remaining=createWorkTimeBudget(240000,'Remaining chain');remaining.charge(130000,true);
 for(const value of [-1,NaN,Infinity])assert.throws(()=>remaining.charge(value,true),RangeError);
 assert.throws(()=>remaining.charge(1,'work'),RangeError);assert.equal(remaining.usedMs,130000);
});
