import test from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';import {resolve,join} from 'node:path';
import {createRunLedger,normalizeRunUsage,combineRunUsage} from '../server/runLedger.mjs';
async function fixture(){await mkdir('qa/v43',{recursive:true});const directory=await mkdtemp(resolve('qa/v43/ledger-'));let time=Date.parse('2026-10-04T09:00:00+08:00');return {directory,now:()=>time,set:v=>{time=v},ledger:createRunLedger({directory,now:()=>time})}}
const reported=n=>({input:n-10,output:10,total:n,calls:1,knownTotal:n,reportedCalls:1,unknownCalls:0});
async function policy(l,values,id='setting'){const s=await l.snapshot();return l.setPolicy({requestId:id,expectedVersion:s.policy.version,policy:{...s.policy,...values,version:undefined}})}
test('unknown or inconsistent usage never becomes zero; reported lower bound is retained',()=>{
 assert.equal(normalizeRunUsage(null),null);assert.equal(normalizeRunUsage({total_tokens:-1}),null);
 assert.equal(normalizeRunUsage({input:20,output:10,total:999}).total,null);
 assert.equal(normalizeRunUsage({calls:1,total:null,knownTotal:0,unknownCalls:1}).total,null);
 const partial=combineRunUsage(reported(30),{calls:1,total:null,knownTotal:0,unknownCalls:1,reportedCalls:0});
 assert.equal(partial.total,null);assert.equal(partial.knownTotal,30);assert.equal(partial.calls,2);assert.equal(partial.unknownCalls,1);
});
test('two store instances and concurrent themes share a single persistent automatic deadline',async()=>{
 const f=await fixture(),other=createRunLedger({directory:f.directory,now:f.now});
 const rows=await Promise.allSettled(Array.from({length:10},(_,i)=>(i%2?f.ledger:other).begin({kind:'plans',automatic:true,theme:i%2?'pixel':'origami'})));
 assert.equal(rows.filter(r=>r.status==='fulfilled').length,1);assert(rows.filter(r=>r.status==='rejected').every(r=>r.reason.code==='automatic_cooldown'));
 let s=await other.snapshot();assert.equal(s.today.automaticRuns,1);assert.equal(s.channels.plans.limited,9);assert.equal(s.channels.plans.retryAfter,300);
 f.set(f.now()+300000);await other.begin({kind:'plans',automatic:true});assert.equal((await f.ledger.snapshot()).today.automaticRuns,2);
});
test('persisted pause and count budget block only new automatic work; manual remains immediate',async()=>{
 const f=await fixture();let s=await f.ledger.snapshot();s=await f.ledger.setPolicy({requestId:'pause',expectedVersion:1,policy:{paused:true,dailyRunLimit:1,dailyTokenLimit:null}});
 await assert.rejects(f.ledger.begin({kind:'plans',automatic:true}),e=>e.code==='automatic_paused');
 const manual=await f.ledger.begin({kind:'steward_manual'});assert(!manual.automatic);
 const restarted=createRunLedger({directory:f.directory,now:f.now});assert((await restarted.snapshot()).policy.paused);
 s=await restarted.setPolicy({requestId:'resume',expectedVersion:s.policy.version,policy:{paused:false,dailyRunLimit:1,dailyTokenLimit:null}});
 await f.ledger.begin({kind:'plans',automatic:true});await assert.rejects(restarted.begin({kind:'conversations',automatic:true}),e=>e.code==='automatic_budget_exhausted');
 await restarted.begin({kind:'steward_manual'});assert.equal((await restarted.snapshot()).today.manualRuns,2);
});
test('manual tokens do not exhaust automatic allowance; actual failed response does count',async()=>{
 const f=await fixture();await f.ledger.setPolicy({requestId:'tokens',expectedVersion:1,policy:{paused:false,dailyRunLimit:null,dailyTokenLimit:30}});
 const manual=await f.ledger.begin({kind:'steward_manual'});await f.ledger.providerStarted(manual.id);await f.ledger.finish(manual.id,{usage:reported(1000)});
 const auto=await f.ledger.begin({kind:'plans',automatic:true});await f.ledger.providerStarted(auto.id);await f.ledger.finish(auto.id,{phase:'failed',usage:reported(30),resultCode:'bad_json'});
 const s=await f.ledger.snapshot();assert.equal(s.today.knownTokens,1030);assert.equal(s.today.automaticTokens,30);assert.equal(s.today.failed,1);
 await assert.rejects(f.ledger.begin({kind:'conversations',automatic:true}),e=>e.code==='automatic_budget_exhausted');await f.ledger.begin({kind:'steward_manual'});
});
test('midnight refreshes natural-day quotas while pause and global deadlines remain',async()=>{
 const f=await fixture();f.set(Date.parse('2026-10-04T23:59:59+08:00'));
 await f.ledger.setPolicy({requestId:'one',expectedVersion:1,policy:{paused:false,dailyRunLimit:1,dailyTokenLimit:null}});await f.ledger.begin({kind:'plans',automatic:true});
 f.set(f.now()+2000);assert.equal((await f.ledger.snapshot()).budgetDay,'2026-10-05');
 await assert.rejects(f.ledger.begin({kind:'plans',automatic:true}),e=>e.code==='automatic_cooldown');
 await f.ledger.begin({kind:'conversations',automatic:true});assert.equal((await f.ledger.snapshot()).today.automaticRuns,1);
});
test('unknown timeout then late actual usage updates one record without double counting',async()=>{
 const f=await fixture(),r=await f.ledger.begin({kind:'plans',automatic:true});await f.ledger.providerStarted(r.id);
 await f.ledger.finish(r.id,{phase:'timed_out'});let s=await f.ledger.snapshot();assert.equal(s.today.unknownFinished,1);assert.equal(s.today.knownTokens,0);assert.equal(s.runs[0].usage,null);
 await f.ledger.finish(r.id,{usage:reported(40),resultCode:'late_response'});await f.ledger.finish(r.id,{usage:reported(40),resultCode:'late_response'});
 s=await f.ledger.snapshot();assert.equal(s.today.knownTokens,40);assert.equal(s.today.unknownFinished,0);assert.equal(s.runs.length,1);assert.equal(s.runs[0].phase,'late_completed');
});
test('main and child lineage is inspectable but only combined root usage enters totals',async()=>{
 const f=await fixture(),r=await f.ledger.begin({kind:'recruitment',participants:[15,16]});await f.ledger.providerStarted(r.id);
 await f.ledger.finish(r.id,{usage:combineRunUsage(reported(30),reported(40)),providerRunId:'real-parent',children:[{id:'real-parent',parentId:null,phase:'completed',usage:reported(30)},{id:'real-child',parentId:'real-parent',phase:'completed',usage:reported(40)}]});
 const s=await f.ledger.snapshot();assert.equal(s.today.knownTokens,70);assert.equal(s.runs[0].children[1].parentId,'real-parent');assert.equal(s.runs[0].usage.calls,2);
});
test('a dead owner is interrupted; newer policy requires CAS and duplicate submissions are safe',async()=>{
 const f=await fixture(),dead=createRunLedger({directory:f.directory,now:f.now,pid:2147483646}),r=await dead.begin({kind:'steward_manual'});await dead.providerStarted(r.id);
 assert.equal((await f.ledger.snapshot()).runs[0].phase,'interrupted');
 const input={requestId:'single',expectedVersion:1,policy:{paused:true,dailyRunLimit:null,dailyTokenLimit:50}};
 const a=await f.ledger.setPolicy(input),b=await f.ledger.setPolicy(input);assert.equal(a.policy.version,b.policy.version);assert.equal(b.settingsHistory.length,1);
 await assert.rejects(f.ledger.setPolicy({...input,requestId:'stale'}),e=>e.code==='policy_conflict');
 await assert.rejects(f.ledger.setPolicy({...input,policy:{...input.policy,paused:false}}),e=>e.code==='policy_conflict');
 await assert.rejects(f.ledger.setPolicy({requestId:'bad',expectedVersion:2,policy:{paused:false,dailyRunLimit:-1,dailyTokenLimit:null}}),e=>e.code==='invalid_policy');
});
test('snapshots do not continually rewrite files; corruption preserves bytes and blocks new runs',async()=>{
 const f=await fixture();await f.ledger.snapshot();const before=await readFile(join(f.directory,'current.json'),'utf8');await f.ledger.snapshot();assert.equal(await readFile(join(f.directory,'current.json'),'utf8'),before);
 await writeFile(join(f.directory,'current.json'),'{broken');await assert.rejects(f.ledger.begin({kind:'steward_manual'}),e=>e.code==='run_ledger_corrupt');assert.equal(await readFile(join(f.directory,'current.json'),'utf8'),'{broken');
});
