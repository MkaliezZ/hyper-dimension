import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fork} from 'node:child_process';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject,assignProjectStep} from '../src/projectPlans.js';
import {reserveResources} from '../src/resourceLedger.js';
import {createRecruitmentStore,recruitmentContext,validateRecruitmentRun} from '../server/recruitmentStore.mjs';
import {createRecruitmentService} from '../server/recruitmentService.mjs';
await mkdir('qa/v28',{recursive:true});
function document(theme='pixel'){
 const state=hydrateTown(createState());for(const id of Object.keys(state.inventory))state.inventory[id]=0;
 state.saveSlot='test-slot-'+theme;state.coins=20;
 assert(createProject(state,{id:'welcome',title:'迎宾灯',targets:{lantern:1}}).ok);return {state,theme};
}
function proof(context){
 return {source:'hermes',model:'deepseek-flash',parent:{id:'hd-parent-fixture',status:'completed',tools:['recruitment_delegate']},
 child:{id:'hd-child-fixture',parentId:'hd-parent-fixture',status:'completed',tools:['recruitment_take_step'],acceptedSteps:[(context.steps.find(s=>s.item==='wood')||context.steps[0]).id]},
 events:[{actor:'parent',tool:'recruitment_delegate',status:'done'},{actor:'child',tool:'recruitment_take_step',status:'done'}]};
}
async function setup(options={}){const directory=await mkdtemp(resolve('qa/v28/store-'));return {directory,store:createRecruitmentStore({directory,...options}),doc:document()}}
const request=(requestId='hire-request-1')=>({requestId,projectId:'welcome'});
const terminal=async(service,theme='pixel')=>{
 for(let i=0;i<100;i++){const status=await service.status(theme);if(status.active?.phase!=='planning'&&status.active?.phase!=='cancelling')return status;await new Promise(r=>setTimeout(r,10))}
 throw Error('job did not reach terminal state');
};

test('one seat is atomic across independent store instances, idempotent replay and style isolation',async()=>{
 const {directory,store,doc}=await setup();
 const other=createRecruitmentStore({directory});
 const results=await Promise.allSettled([store.start('pixel',doc,request()),other.start('pixel',doc,request('hire-request-2'))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(results.find(r=>r.status==='rejected').reason.code,'recruitment_full');
 const winner=results.find(r=>r.status==='fulfilled').value.contract;
 const again=await store.start('pixel',doc,request(winner.id));assert.equal(again.replayed,true);
 await assert.rejects(store.start('pixel',doc,{...request(winner.id),projectId:'other'}),{code:'recruitment_conflict'});
 await other.start('origami',document('origami'),request());
});

test('cross-process contenders hold exactly one temporary seat',async()=>{
 const {directory,doc}=await setup(),path=resolve(directory,'fixture.json');await writeFile(path,JSON.stringify(doc));
 const children=[];
 try{
  const promises=Array.from({length:5},(_,i)=>new Promise((res,rej)=>{
   const child=fork(resolve('tests/v28-recruit-lock-worker.mjs'),[directory,path,'hire-concurrent-'+i],{execPath:process.execPath,windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});children.push(child);child.stderr.resume();const timer=setTimeout(()=>rej(Error('recruitment lock worker timed out')),10000);child.once('error',e=>{clearTimeout(timer);rej(e)});child.once('message',m=>{clearTimeout(timer);res(m)});child.once('exit',code=>{clearTimeout(timer);rej(Error('recruitment lock worker exited before receipt: '+code))});
  }));
  const rows=await Promise.all(promises);assert.equal(rows.filter(r=>r.ok).length,1);assert(rows.filter(r=>!r.ok).every(r=>r.code==='recruitment_full'));
 }finally{await Promise.all(children.map(c=>new Promise(r=>{if(c.exitCode!==null||c.signalCode!==null){r();return;}c.once('exit',r);c.kill()})))}
});

test('money reserved elsewhere is unavailable; own reservation is usable, failed job does not charge',async()=>{
 const {store,doc}=await setup();reserveResources(doc.state,'other-plan',{coins:15});
 await assert.rejects(store.start('pixel',doc,request()),{code:'recruitment_funds'});
 delete doc.state.resourceLedger.reservations['other-plan'];reserveResources(doc.state,'hire:hire-request-1',{coins:8});
 const r=await store.start('pixel',doc,request());assert.equal(doc.state.coins,20);
 await store.complete('pixel',r.contract.id,1,null,'test failure');
 assert.equal((await store.list('pixel',doc)).active,null);assert.equal(doc.state.coins,20);
});

test('cancel holds the slot until the actual runtime settles, stale attempts cannot release a retry',async()=>{
 const {store,doc}=await setup();const {contract:c}=await store.start('pixel',doc,request());
 await store.cancel('pixel',doc,c.id);assert.equal((await store.list('pixel',doc)).active.phase,'cancelling');
 await assert.rejects(store.start('pixel',doc,request('hire-request-2')),{code:'recruitment_full'});
 await store.complete('pixel',c.id,1,proof(c.context));assert.equal((await store.list('pixel',doc)).active,null);
 const next=(await store.start('pixel',doc,request('hire-request-2'))).contract;
 await store.complete('pixel',next.id,1,null,'network');
 const retry=(await store.retry('pixel',doc,next.id)).contract;assert.equal(retry.attempt,2);
 assert((await store.complete('pixel',next.id,1,proof(next.context))).ignored);
 assert.equal((await store.list('pixel',doc)).active.phase,'planning');
});

test('a live process is not declared dead by elapsed time; dead owner can recover',async()=>{
 let live=true;const {store,doc}=await setup({isAlive:()=>live,now:()=>9999999999999});
 const c=(await store.start('pixel',doc,request())).contract;
 assert.equal((await store.list('pixel',doc)).active.phase,'planning');
 live=false;const state=await store.list('pixel',doc);assert.equal(state.active,null);assert.equal(state.history[0].phase,'interrupted');
 live=true;assert.equal((await store.retry('pixel',doc,c.id)).contract.attempt,2);
});

test('reset cancels the old world but waits for its running child before freeing its seat',async()=>{
 const {store,doc}=await setup();const c=(await store.start('pixel',doc,request())).contract;
 const next=structuredClone(doc);next.state.saveSlot='new-world';
 assert.equal((await store.list('pixel',next)).active.phase,'cancelling');
 await assert.rejects(store.start('pixel',next,request('hire-request-2')),{code:'recruitment_full'});
 await store.complete('pixel',c.id,1,proof(c.context));assert.equal((await store.list('pixel',next)).active,null);
});

test('activation rechecks saved work, excludes player steps and closes already fulfilled plans',async()=>{
 const {store,doc}=await setup();const c=(await store.start('pixel',doc,request())).contract;
 await store.complete('pixel',c.id,1,proof(c.context));assignProjectStep(doc.state,'welcome:wood',-1);
 assert.equal((await store.activate('pixel',doc,c.id)).contract.phase,'cancelled');
 const again=(await store.start('pixel',doc,request('hire-request-2'))).contract;
 const run=proof(again.context);assert(again.context.steps.length);run.child.acceptedSteps=[again.context.steps[0].id];await store.complete('pixel',again.id,1,run);
 doc.state.inventory.lantern=1;
 assert.equal((await store.activate('pixel',doc,again.id)).contract.phase,'cancelled');assert.equal(doc.state.coins,20);
});

test('completed parent text without real delegation evidence is rejected',async()=>{
 const context=recruitmentContext(document(),'welcome'),run=proof(context);
 for(const edit of [
  r=>r.child.parentId='wrong',r=>r.model='deepseek-v4-pro',r=>r.child.acceptedSteps=['foreign:step'],
  r=>r.events=[],r=>r.child.tools=[],r=>r.parent.status='failed'
 ]){const bad=structuredClone(run);edit(bad);assert.throws(()=>validateRecruitmentRun(bad,context),{code:'recruitment_evidence'})}
});

test('active contract survives reopening and keeps seat until saved departure receipt',async()=>{
 const {store,directory,doc}=await setup();const c=(await store.start('pixel',doc,request())).contract;
 await store.complete('pixel',c.id,1,proof(c.context));await store.activate('pixel',doc,c.id);
 const reopened=createRecruitmentStore({directory});assert.equal((await reopened.list('pixel',doc)).active.phase,'active');
 assert.equal((await reopened.activate('pixel',doc,c.id)).replayed,true);
 await reopened.cancel('pixel',doc,c.id);await assert.rejects(reopened.departed('pixel',doc,c.id));
 doc.state.recruitment={departedId:c.id,active:{id:c.id,phase:'departed',parentRunId:'hd-parent-fixture',childRunId:'hd-child-fixture',feePaid:0,hasArrived:false}};assert.equal((await reopened.departed('pixel',doc,c.id)).contract.phase,'departed');
 assert.equal((await reopened.departed('pixel',doc,c.id)).replayed,true);
});

test('corrupt current file recovers previous record, both corrupt fail closed',async()=>{
 const {store,directory,doc}=await setup();const c=(await store.start('pixel',doc,request())).contract;
 await store.complete('pixel',c.id,1,proof(c.context));await store.activate('pixel',doc,c.id);
 await writeFile(resolve(directory,'pixel/recruitment.json'),'corrupt');
 assert.equal((await store.list('pixel',doc)).active.phase,'available');
 // list() has repaired current from the previous committed record.
 await writeFile(resolve(directory,'pixel/recruitment.json'),'corrupt');
 await writeFile(resolve(directory,'pixel/recruitment.previous.json'),'corrupt');
 await assert.rejects(store.list('pixel',doc),{code:'recruitment_corrupt'});
});

test('service starts once, validates returned proof, persists outcome despite a temporary write failure',async()=>{
 const {directory,store,doc}=await setup();let calls=0,failWrite=true;
 const reliable=store.complete;store.complete=async(...args)=>{if(failWrite){failWrite=false;throw Error('temporary storage unavailable')}return reliable(...args)};
 const service=createRecruitmentService({directory,store,saves:{current:async()=>doc},run:async ctx=>{calls++;return proof(ctx)},cancel:async()=>{},pollMs:10});
 try{
  await service.hire('pixel',request());await service.hire('pixel',request());
  assert.equal((await terminal(service)).active.phase,'available');assert.equal(calls,1);
  assert.equal(service.pending().length,0);
 }finally{await service.close()}
});

test('service cancellation waits for runtime rejection; no phantom successful recruitment',async()=>{
 const {directory,doc}=await setup();let rejectRun,cancels=0;
 const service=createRecruitmentService({directory,saves:{current:async()=>doc},run:()=>new Promise((_,reject)=>{rejectRun=reject}),cancel:async()=>{cancels++;rejectRun(Error('cancelled'))},pollMs:10});
 try{
  const c=(await service.hire('pixel',request())).contract;
  await service.cancel('pixel',{id:c.id});
  const result=await terminal(service);assert.equal(result.active,null);assert.equal(result.history[0].phase,'cancelled');assert.equal(cancels,1);
 }finally{await service.close()}
});

test('service rejects claimed success without tool proof and detects missing owned runtime handles',async()=>{
 const {directory,store,doc}=await setup();
 const service=createRecruitmentService({directory,store,saves:{current:async()=>doc},run:async()=>({answer:'done'}),cancel:async()=>{},pollMs:10});
 try{
  await service.hire('pixel',request());
  const result=await terminal(service);assert.equal(result.active,null);assert.equal(result.history[0].phase,'failed');
  await store.retry('pixel',doc,'hire-request-1');
  const recovered=await service.status('pixel');assert.equal(recovered.active,null);assert.equal(recovered.history[0].phase,'failed');
 }finally{await service.close()}
});

test('cancel arriving before hire is a persistent tombstone and cannot be replayed into a worker',async()=>{
 const {store,doc}=await setup();await store.cancel('pixel',doc,'cancelled-before-start');
 const r=await store.start('pixel',doc,request('cancelled-before-start'));
 assert(r.replayed);assert.equal(r.contract.phase,'cancelled');assert.equal((await store.list('pixel',doc)).active,null);
});
test('departure rejects forged payment and disconnected parent/child evidence',async()=>{
 const {store,doc}=await setup(),c=(await store.start('pixel',doc,request())).contract;
 await store.complete('pixel',c.id,1,proof(c.context));await store.activate('pixel',doc,c.id);await store.cancel('pixel',doc,c.id);
 doc.state.recruitment={departedId:c.id,active:{id:c.id,phase:'departed',parentRunId:'hd-parent-fixture',childRunId:'hd-child-fixture',feePaid:8,hasArrived:true}};
 await assert.rejects(store.departed('pixel',doc,c.id));
 doc.state.recruitment.active.feePaid=0;doc.state.recruitment.active.childRunId='unrelated-child';
 await assert.rejects(store.departed('pixel',doc,c.id));
 assert.equal((await store.list('pixel',doc)).active.phase,'leaving');
});

test('profile edits are versioned, idempotent, scoped and cannot change contract mechanics',async()=>{
 const {store,doc}=await setup(),c=(await store.start('pixel',doc,request())).contract;
 await store.complete('pixel',c.id,1,proof(c.context));await store.activate('pixel',doc,c.id);
 const fields={name:'小麦同学',personality:'细致耐心',lifeGoal:'完成共同的筹备',speechStyle:'用清晰短句说明进度'};
 const input={id:c.id,expectedVersion:1,requestId:'edit-request-1',fields};
 const result=await store.profile('pixel',doc,input);assert.equal(result.contract.profile.version,2);assert.equal(result.contract.profileEdits[0].before.name,'小麦');
 assert.equal((await store.profile('pixel',doc,input)).replayed,true);
 await assert.rejects(store.profile('pixel',doc,{...input,requestId:'edit-request-2'}),{code:'recruitment_conflict'});
 await assert.rejects(store.profile('pixel',doc,{...input,expectedVersion:2,requestId:'edit-request-3',fields:{...fields,wage:0}}));
 assert.equal((await store.list('pixel',doc)).active.wage,8);
});
