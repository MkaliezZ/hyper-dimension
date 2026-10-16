import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {hydrateTown} from '../src/townSimulation.js';
import {ECONOMY_POLICY_VERSION,townDailyBudget} from '../src/economy.js';
import {assertCommerceState} from '../server/commerceActions.mjs';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');

async function legacy({external=false,pending=false,corrupt=false}={}){
 const directory=await mkdtemp(join(tmpdir(),'hd-policy-legacy-'));let now=1800000000000;
 const store=createSaveStore({directory,externalEconomy:external,now:()=>now});let d=(await store.open('origami',{protect:true})).document;
 const call=async(kind,operation,fields={})=>{const current=await store.current('origami');return store.action('origami',{kind,operation,requestId:randomUUID(),expectedVersion:current.version,epoch:current.actions.epoch,expectedSequence:current.actions.sequence,day:current.state.day,...fields});};
 let ticket=null;
 if(pending){await call('commerce','plan_create',{project:{id:'legacy-wood',title:'旧档未完木材筹备',targets:{wood:2}}});d=await store.current('origami');const task=d.state.agentTaskLedger.find(t=>t.projectId==='legacy-wood');ticket=(await call('resident','begin',{actorId:task.npcId,intent:{goal:'forest',buildingId:null,action:'work',resource:'wood',assignmentId:task.id}})).ticket;d=await store.current('origami');}
 // A trusted historical server file, not a client import or a minting endpoint.
 const old=structuredClone(d);Object.assign(old.state.economy,{budgetPolicyVersion:105,budgetPolicyStartsDay:1,budgetPreviousVersion:12,daySeconds:300});old.state.commerceControl.daySeconds=300;old.state.commerceControl.activeSeconds=300;old.actions.commerce.activeSeconds=300;old.actions.commerce.snapshot.daySeconds=300;
 old.actions.commerce.snapshot.policy={budgetPolicyVersion:corrupt?32:105,budgetPolicyStartsDay:1,budgetPreviousVersion:12,accountingStartedDay:old.state.economy.accountingStartedDay,townBudgetStartedDay:old.state.economy.townBudgetStartedDay};
 old.checksum=hash(old.state);old.actionsChecksum=hash(old.actions);const file=join(directory,'origami/current.json');await writeFile(file,JSON.stringify(old));
 return {directory,store,old,file,ticket,call,advance:n=>now+=n,reopen:()=>createSaveStore({directory,externalEconomy:external,now:()=>now})};
}

for(const external of [false,true])test('protected open migrates acknowledged policy105 once, external wallet='+external,async()=>{
 const f=await legacy({external}),opened=(await f.store.open('origami',{protect:true})).document;
 assert.equal(opened.state.economy.budgetPolicyVersion,ECONOMY_POLICY_VERSION);assert.equal(opened.state.economy.budgetPreviousVersion,105);assert.equal(opened.state.economy.budgetPolicyStartsDay,2);assert.equal(opened.state.day,1);assert.equal(opened.state.economy.daySeconds,300);
 assert.deepEqual(opened.state.inventory,f.old.state.inventory);assert.equal(opened.state.coins,f.old.state.coins);assert.deepEqual(opened.state.economy.cashLedger,f.old.state.economy.cashLedger);assert.deepEqual(opened.state.economy.townDays,f.old.state.economy.townDays);assert.equal(townDailyBudget(opened.state).policyVersion,105);assertCommerceState(opened.state,opened.actions);
 const oldBackup=(await f.store.backups('origami')).find(b=>b.reason==='before-economy-policy');assert(oldBackup,'Original canonical document must be preserved before migration');
 const frontend=hydrateTown(structuredClone(opened.state));assertCommerceState(frontend,opened.actions);await f.store.save('origami',{state:frontend,expectedVersion:opened.version});
 const read=await f.reopen().current('origami'),again=(await f.reopen().open('origami',{protect:true})).document;assert.equal(again.version,read.version);assert.equal(again.state.economy.budgetPolicyStartsDay,2);assertCommerceState(again.state,again.actions);
 const forged=structuredClone(again.state);forged.economy.budgetPolicyStartsDay=1;await assert.rejects(f.store.save('origami',{state:forged,expectedVersion:again.version}),e=>e.code==='commerce_state_conflict');
});

test('policy migration preserves a live resident ticket, task, holds and exactly one eventual delivery',async()=>{
 const f=await legacy({pending:true}),migrated=(await f.store.open('origami',{protect:true})).document;
 assert.equal(migrated.state.economy.budgetPolicyVersion,ECONOMY_POLICY_VERSION);assert.deepEqual(migrated.actions.resident,f.old.actions.resident);assert.deepEqual(migrated.state.agentTaskLedger,f.old.state.agentTaskLedger);assert.deepEqual(migrated.state.resourceLedger,f.old.state.resourceLedger);
 f.advance(20001);const request={requestId:f.ticket.requestId,epoch:f.ticket.epoch,sequence:f.ticket.sequence},done=await f.call('resident','finish',request);assert.equal(done.document.state.inventory.wood,2);assert.equal(done.document.state.agentTaskLedger.find(t=>t.projectId==='legacy-wood').completed,2);assert((await f.call('resident','finish',request)).replayed);assert.equal((await f.reopen().current('origami')).state.inventory.wood,2);
});

test('a mismatched old canonical policy is preserved and rejected, never silently legitimized',async()=>{
 const f=await legacy({corrupt:true}),before=await readFile(f.file);await assert.rejects(f.store.open('origami',{protect:true}),e=>e.code==='save_corrupt');assert.deepEqual(await readFile(f.file),before);
});
