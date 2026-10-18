import test from 'node:test';
import assert from 'node:assert/strict';
import {cashDayReport,recordCashFlow,validCashDays} from '../src/cashAccounting.js';
import {cashReportHTML} from '../src/cashReportView.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {buySupplies,dayAccounts,settleTownDay,townDailyBudget,transact} from '../src/economy.js';
import {operatingTrend} from '../src/economyTrend.js';
const fresh=()=>{const state=hydrateTown(createZeroState());state.coins=10000;return state;};

test('400 lawful supply purchases retain every cost with a 300-row detail window',()=>{
 const state=fresh();for(let i=0;i<400;i++)assert(buySupplies(state,'seeds'));
 assert.equal(state.coins,2800);assert.equal(state.inventory.seed,2000);assert.equal(state.economy.cashLedger.length,300);
 assert.deepEqual(dayAccounts(state),{income:0,cost:7200,net:-7200});assert(validCashDays(state.economy.cashDays));
 const restored=hydrateTown(JSON.parse(JSON.stringify(state))),budget=townDailyBudget(restored).total,row=settleTownDay(restored);
 assert.equal(row.cost,7200+budget);assert.equal(row.net,-7200-budget);assert.equal(restored.coins,10000+row.net);assert.equal(row.cashComplete,true);assert.equal(settleTownDay(restored),false);
});
test('failed and replayed payments do not add any daily amount',()=>{
 const state=fresh();assert(transact(state,{income:3,cost:1,category:'party',receipt:'daily-once'}));
 const before=structuredClone(state.economy),coins=state.coins;
 assert.equal(transact(state,{income:3,cost:1,category:'party',receipt:'daily-once'}),false);
 assert.equal(transact(state,{cost:50000,category:'supplies'}),false);
 assert.equal(state.coins,coins);assert.deepEqual(state.economy,before);
});
test('invalid transaction metadata cannot debit or credit before reporting failure',()=>{
 for(const category of [null,42,[],{}]){
  const state=fresh(),before=structuredClone(state);
  assert.equal(transact(state,{income:2,cost:1,category}),false);
  assert.deepEqual(state,before);
 }
});
test('daily categories remain exact after cash details roll and the next day starts at zero',()=>{
 const state=fresh();for(let i=0;i<350;i++)assert(transact(state,{income:4,cost:1,category:'visitor'}));
 assert(transact(state,{cost:80,category:'upgrade'}));assert(transact(state,{cost:27,category:'maintenance'}));
 const row=settleTownDay(state);assert.equal(row.visitorIncome,1400);assert.equal(row.visitorCost,350);assert.equal(row.capitalCost,80);
 state.day++;assert.deepEqual(dayAccounts(state),{income:0,cost:0,net:0});assert(cashDayReport(state).complete);
});
test('older partial detail is preserved and labelled without inventing totals or changing cash',()=>{
 const state=fresh();state.economy.cashLedger=Array.from({length:300},()=>({day:1,income:2,cost:1,net:1,category:'visitor'}));
 const before=structuredClone(state);assert.equal(cashDayReport(state).complete,false);assert.match(cashReportHTML(state),/data-cash-coverage="partial"/);assert.deepEqual(state,before);
 assert(transact(state,{income:4,cost:1,category:'visitor'}));assert.equal(cashDayReport(state).complete,false);assert.deepEqual(dayAccounts(state),{income:604,cost:301,net:303});assert.equal(state.coins,10003);
 state.day++;assert(transact(state,{income:4,cost:1,category:'visitor'}));assert.equal(cashDayReport(state).complete,true);
});
test('daily storage is bounded and report reads cannot mutate its categories',()=>{
 const state=fresh();for(let day=1;day<=65;day++){state.day=day;recordCashFlow(state,{income:2,cost:1,category:'visitor'});}
 assert.equal(state.economy.cashDays.length,60);assert.equal(state.economy.cashDays[0].day,6);assert(validCashDays(state.economy.cashDays));
 const report=cashDayReport(state);report.byCategory[0].cost=999;assert.equal(cashDayReport(state).cost,1);
});
test('invalid and forged daily totals fail validation',()=>{
 const state=fresh();recordCashFlow(state,{income:2,cost:1,category:'visitor'});const original=structuredClone(state.economy.cashDays);
 for(const change of [rows=>rows[0].net++,rows=>rows[0].income++,rows=>rows[0].byCategory[0].cost++,rows=>rows.push(rows[0]),rows=>rows[0].day=0]){const copy=structuredClone(original);change(copy);assert.equal(validCashDays(copy),false);}
 assert.equal(validCashDays(undefined),true);assert.equal(validCashDays(null),false);
});
test('escrow is separate from income and costs, and category names cannot alter prototypes',()=>{
 const state=fresh();recordCashFlow(state,{category:'lan-escrow',escrowDelta:-8});recordCashFlow(state,{category:'lan-event',cost:8});recordCashFlow(state,{category:'__proto__',income:3});
 assert.deepEqual(dayAccounts(state),{income:3,cost:8,net:-5});assert.equal(state.economy.cashLedger[0].escrowDelta,-8);assert.equal({}.income,undefined);assert(validCashDays(state.economy.cashDays));
});
test('the cash view distinguishes construction from routine full-cost operation',()=>{
 const state=fresh();transact(state,{income:100,cost:20,category:'visitor'});transact(state,{cost:80,category:'upgrade'});
 const html=cashReportHTML(state),budget=townDailyBudget(state).total;
 assert.equal(budget,72);assert.match(html,/data-cash-routine>\+8</);
 assert.match(html,/data-cash-capital>-80</);assert.equal(dayAccounts(state).net,0);assert.match(html,/data-cash-coverage="complete"/);
});
test('explicitly incomplete old days do not masquerade as full-cost profitability',()=>{
 const state=fresh(),base={budget:72,paid:72,income:100,cost:90,visitorIncome:50,visitorCost:15};
 state.economy.townDays=[{...base,day:1,cashComplete:false},{...base,day:2,cashComplete:true},{...base,day:3}];
 const trend=operatingTrend(state);assert.equal(trend.count,2);assert.equal(trend.startDay,2);assert.equal(trend.dailyNet,10);
 state.economy.townDays=[{...base,day:1,cashComplete:false}];assert.equal(operatingTrend(state).dailyNet,null);
});
