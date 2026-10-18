import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {dayAccounts} from '../src/economy.js';
import {cashDayReport} from '../src/cashAccounting.js';
import {mergeActionState} from '../src/actionMerge.js';

async function fixture(theme){
 const directory=await mkdtemp(join(tmpdir(),'hd-cash-authority-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());state.coins=200;state.freshStartPending=false;
 await store.open(theme,{legacyState:state});await store.openClient(theme);
 const current=()=>store.current(theme),command=async(operation,extra={})=>{const d=await current();return store.action(theme,{kind:'commerce',operation,requestId:randomUUID(),expectedVersion:d.version,epoch:d.actions.epoch,expectedSequence:d.actions.sequence,day:d.state.day,...extra});};
 await command('enable');return{theme,directory,store,current,command};
}
for(const theme of ['pixel','origami']){
 test(theme+' signed action replay and a fresh store retain one exact daily cash record',async()=>{
  const f=await fixture(theme),paid=await f.command('supply',{supply:'seeds'}),d=paid.document;assert.equal(d.state.coins,182);assert.deepEqual(dayAccounts(d.state),{income:0,cost:18,net:-18});
  const other=createSaveStore({directory:f.directory}),replayed=await other.action(theme,{kind:'commerce',operation:'supply',supply:'seeds',requestId:paid.ticket.requestId,expectedVersion:'response-was-lost',day:1});
  assert(replayed.replayed);assert.equal(replayed.document.state.coins,182);assert.deepEqual(cashDayReport((await other.current(theme)).state),cashDayReport(d.state));
 });
 test(theme+' browser cannot rewrite cash details, totals, receipt flags or daily categories',async()=>{
  const f=await fixture(theme),paid=await f.command('supply',{supply:'seeds'}),d=paid.document,file=join(f.directory,theme,'current.json'),bytes=await readFile(file);
  const changes=[s=>s.economy.cashLedger=[],s=>s.economy.costs=0,s=>s.economy.cashReceipts.forged=true,s=>{s.economy.cashDays[0].income=99;s.economy.cashDays[0].net=81;s.economy.cashDays[0].byCategory.push({category:'forged',income:99,cost:0,net:99});},s=>delete s.economy.cashDays];
  for(const change of changes){const state=structuredClone(d.state);change(state);await assert.rejects(f.store.save(theme,{state,expectedVersion:d.version}),e=>e.code==='economy_journal_conflict');assert.deepEqual(await readFile(file),bytes);}
 });
 test(theme+' unrelated profile edits merge with a new canonical cash book without overwriting either',async()=>{
  const f=await fixture(theme),base=(await f.current()).state,local=structuredClone(base);local.playerProfile.bio='Fictional biography edit during payment';const paid=await f.command('supply',{supply:'seeds'}),merged=mergeActionState(base,local,paid.document.state);
  const saved=(await f.store.save(theme,{state:merged,expectedVersion:paid.document.version})).document;
  assert.equal(saved.state.playerProfile.bio,local.playerProfile.bio);assert.equal(saved.state.coins,182);assert.deepEqual(dayAccounts(saved.state),{income:0,cost:18,net:-18});
 });
 test(theme+' the first canonical payment reconstructs short legacy details without altering their cash',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'hd-cash-legacy-')),store=createSaveStore({directory}),s=hydrateTown(createZeroState());s.coins=200;s.freshStartPending=false;s.economy.costs=3;s.economy.cashLedger=[{day:1,category:'party',note:'legacy paid',income:5,cost:3,net:2}];
  await store.open(theme,{legacyState:s});await store.openClient(theme);let d=await store.current(theme);await store.action(theme,{kind:'commerce',operation:'enable',requestId:randomUUID(),day:1,expectedVersion:d.version});d=await store.current(theme);
  const paid=await store.action(theme,{kind:'commerce',operation:'supply',supply:'seeds',requestId:randomUUID(),day:1,expectedVersion:d.version});
  assert.equal(paid.document.state.coins,182);assert.deepEqual(dayAccounts(paid.document.state),{income:5,cost:21,net:-16});assert.equal(cashDayReport(paid.document.state).complete,true);assert.equal(paid.document.state.economy.cashLedger[0].note,'legacy paid');
 });
}
