import test from 'node:test';import assert from 'node:assert/strict';
import {operatingTrend} from '../src/economyTrend.js';
const row=(day,overrides={})=>({day,income:160,cost:154,budget:84,paid:84,deferred:0,visitorIncome:160,visitorCost:70,...overrides});
test('no settled days produces unavailable averages rather than a profit forecast',()=>{
 const s={coins:100,economy:{cashLedger:[{income:100,cost:0}]}};
 const r=operatingTrend(s);assert.equal(r.count,0);assert.equal(r.dailyNet,null);assert.equal(r.passiveCostMargin,null);
});
test('a deferred bill is counted in the full operating cost, so relief is not displayed as earned profit',()=>{
 const r=operatingTrend({economy:{townDays:[row(1,{income:80,cost:60,budget:84,paid:20,deferred:64,visitorIncome:80,visitorCost:40})]}});
 assert.equal(r.dailyFullCost,124);assert.equal(r.dailyNet,-44);assert.equal(r.dailyPassiveNet,-44);assert.equal(r.dailyActiveNet,0);assert.equal(r.dailyDeferred,64);
});
test('orders, party receipts and capital spending are separate from visitor-only operating surplus',()=>{
 const r=operatingTrend({economy:{townDays:[row(1,{income:195,cost:172})]}});
 assert.equal(r.dailyPassiveNet,6);assert.equal(r.dailyNet,23);assert.equal(r.dailyActiveNet,17);
 assert.equal(r.passiveCostMargin,6/154);assert.equal(r.fullCostMargin,23/172);
});
test('only the last seven settled days contribute; unfinished current-day receipts do not change the report',()=>{
 const s={economy:{townDays:Array.from({length:10},(_,i)=>row(i+1,{income:154+i})),cashLedger:[{day:11,income:10000,cost:0}]}};
 const before=structuredClone(s),r=operatingTrend(s);
 assert.deepEqual([r.count,r.startDay,r.endDay,r.dailyNet],[7,4,10,6]);assert.deepEqual(s,before);
});
test('malformed historical records do not turn unavailable operating data into NaN',()=>{
 const r=operatingTrend({economy:{townDays:[null,{day:0},row(1),row(2,{visitorCost:NaN})]}});
 assert.equal(r.count,1);assert.equal(r.dailyNet,6);assert.ok(Number.isFinite(r.dailyFullCost));
});

test('older paid/budget records still account for relief when the deferred field is absent',()=>{
 const r=operatingTrend({economy:{townDays:[row(1,{income:80,cost:60,budget:84,paid:20,deferred:undefined,visitorIncome:80,visitorCost:40})]}});assert.equal(r.dailyNet,-44);assert.equal(r.dailyDeferred,64);
});
