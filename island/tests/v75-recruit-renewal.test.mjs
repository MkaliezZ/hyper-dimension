
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {writeFile} from 'node:fs/promises';
import {finishVisit} from './v72-recruitment-fixture.mjs';import {resolveTravelRecruitment,travelPerson} from '../server/lanTravelParty.mjs';
import {fixture,meet} from './v74-travel-fixture.mjs';import {proof} from './v72-recruitment-fixture.mjs';import {prepareRecruitmentRenewal,releaseRecruitmentRenewal,renewalReadiness} from '../src/recruitmentRenewal.js';import {controlProject} from '../src/projectPlans.js';import {beginTaskStep} from '../src/taskBoard.js';import {createRecruitmentService} from '../server/recruitmentService.mjs';
async function call(f,kind,operation,args={}){const c=await f.service.tenants.get(f.accounts[1].token),d=await f.read();return c.saves.action(f.theme,{kind,operation,requestId:randomUUID(),expectedVersion:d.version,epoch:d.actions?.epoch??null,expectedSequence:d.actions?.sequence||0,day:d.state.day,...args});}
async function delivered(f){await f.update(s=>{controlProject(s,'travel-plan','resume');const t=s.agentTaskLedger.find(t=>t.npcId===16);beginTaskStep(s,t.id);});
 const d=await f.read(),t=d.state.agentTaskLedger.find(t=>t.npcId===16),start=await call(f,'resident','begin',{actorId:16,gameTime:0,intent:{goal:'forest',action:'work',resource:'wood',buildingId:null,assignmentId:t.id,operationId:t.operationId}});
 f.advance(20000);const c=await f.service.tenants.get(f.accounts[1].token),done=await c.saves.action(f.theme,{kind:'resident',operation:'finish',requestId:start.ticket.requestId,epoch:start.ticket.epoch,sequence:start.ticket.sequence,expectedVersion:start.document.version});
 await f.update(s=>{const task=s.agentTaskLedger.find(t=>t.id===start.ticket.assignmentId);controlProject(s,'travel-plan','pause');});
 return done.receipt.gain.wood;
}
async function propose(f,id=randomUUID()){
 await f.update(s=>{assert(prepareRecruitmentRenewal(s,{id,oldId:f.contract.id,projectId:'travel-plan'}).ok);});
 const next=await f.store.renew(f.theme,await f.read(),{id:f.contract.id,requestId:id,projectId:'travel-plan'});await f.store.complete(f.theme,id,1,proof(next.contract.context));return(await f.store.peek(f.theme,id));
}
for(const theme of ['pixel','origami'])test(theme+' atomic in-place renewal keeps pose, settles real first delivery once, independent new wage and durable commit',{timeout:90000},async()=>{
 const f=await fixture(theme);try{await call(f,'commerce','enable');await call(f,'commerce','hire_enable');
 await f.action(1,'travel_invite',{npcId:16});const room=await f.action(0,'room_create',{title:'续约前的相遇',maxPlayers:2});await f.action(1,'room_join',{code:room.view.room.code});const event=await meet(f);const view=await f.service.identities.view(f.accounts[1].token);await f.action(1,'room_leave',{roomId:room.roomId,expectedRevision:view.room.revision});
 const amount=await delivered(f),before=await f.read(),next=await propose(f);
 assert.equal(next.context.continuingVisit.delivered,amount);assert.equal(next.renewalDepth,1);
 const c=await f.service.tenants.get(f.accounts[1].token),d=await f.read(),input={kind:'commerce',operation:'hire_renew',contractId:f.contract.id,renewalId:next.id,requestId:randomUUID(),day:d.state.day,expectedVersion:d.version};
 const backup=await c.saves.backup(theme,{expectedVersion:d.version});const r=await c.saves.action(theme,input),s=r.document.state,fee=Math.ceil(8*amount/6);assert.equal(r.receipt.cashDelta,-fee);assert.equal(s.coins,before.state.coins-fee);assert.equal(s.recruitment.active.id,next.id);assert.equal(s.recruitment.active.phase,'working');assert(s.recruitment.active.hasArrived);assert.deepEqual(s.recruitment.active.position,before.state.recruitment.active.position);assert.equal(s.recruitment.active.visitId,f.contract.id);assert.equal(s.recruitment.history.at(-1).feePaid,fee);assert(s.resourceLedger.reservations['hire:'+next.id]);assert(!s.resourceLedger.reservations['hire:'+f.contract.id]);
 assert.equal((await c.saves.action(theme,{...input,expectedVersion:'lost-response'})).replayed,true);assert.equal((await f.read()).state.coins,s.coins);
 await assert.rejects(c.saves.action(theme,{...input,renewalId:'different-contract'}),e=>e.code==='action_id_conflict');
 const rc=await f.store.renewal_commit(theme,await f.read(),next.id);assert.equal(rc.contract.phase,'active');assert((await f.store.renewal_commit(theme,await f.read(),next.id)).replayed);assert.equal((await f.store.list(theme,await f.read())).history.find(h=>h.id===f.contract.id).phase,'renewed');
 assert.equal((await f.service.social.history(f.accounts[1].token,16,theme,next.id)).events[0].id,event.id);
 assert((await f.service.social.contextForOwner(f.accounts[1].view.me.id,theme,s.saveSlot))[16].length);
 const person=travelPerson(await f.service.identities.authorize(f.accounts[1].token),await resolveTravelRecruitment(f.directory,await f.service.identities.authorize(f.accounts[1].token),await f.read()),16);assert.equal(person.actorId,event.people.find(p=>p.npcId===16).actorId);
 await assert.rejects(c.saves.restore(theme,{id:backup.id,expectedVersion:(await f.read()).version}),e=>e.code==='hire_restore_completed');
 await assert.rejects(c.saves.import(theme,{data:d.state,expectedVersion:(await f.read()).version}),e=>e.code==='hire_restore_completed');
 f.contract=rc.contract;for(let i=0;i<5&&(await f.read()).state.agentTaskLedger.find(t=>t.npcId===16)?.remaining>0;i++)await delivered(f);
 const finishPay=await call(f,'commerce','hire_handover',{contractId:next.id});assert.equal(finishPay.receipt.details.fee,8);assert.equal(finishPay.document.state.inventory.wood,6);assert.equal(finishPay.document.state.coins,before.state.coins-fee-8);
 const finished=await f.read();await finishVisit(f.store,finished,rc.contract);await f.update(s=>Object.assign(s,finished.state));
 assert.equal((await c.saves.action(theme,{...input,expectedVersion:'old-response'})).replayed,true);
 assert.equal((await f.service.social.history(f.accounts[1].token,16,theme,next.id)).events[0].id,event.id);
 await writeFile('qa/v75/'+theme+'-renew-proof.json',JSON.stringify({passed:true,oldContract:input.contractId,newContract:next.id,amount,oldFee:fee,newWageHeld:8,poseUnchanged:true,replayed:true,actualSourceReceipt:true,newWorkDelivered:4,newFee:8,oldBackupRejected:true,memoriesRetained:true,actualDeparture:true,scope:'Isolated owners and deterministic parent/child output; actual save actions and resident delivery.'},null,2));
 }finally{await f.service.close();}
});
test('changed quantity rejects renewal with no partial old fee or new binding; cancelling restores original contract',async()=>{
 const f=await fixture();try{await call(f,'commerce','enable');await call(f,'commerce','hire_enable');const next=await propose(f),before=await f.read();await f.update(s=>{s.agentTaskLedger.find(t=>t.npcId===16).remaining--;});
 const version=(await f.read()).version;await assert.rejects(call(f,'commerce','hire_renew',{contractId:f.contract.id,renewalId:next.id}),e=>e.code==='hire_renewal');
 const d=await f.read();assert.equal(d.version,version);assert.equal(d.state.coins,before.state.coins);assert.equal(d.state.recruitment.active.id,f.contract.id);assert.equal(d.state.recruitment.active.feePaid,null);
 await f.store.cancel(f.theme,d,next.id);await f.update(s=>releaseRecruitmentRenewal(s,next.id));assert.equal((await f.store.list(f.theme,await f.read())).active.id,f.contract.id);assert(!(await f.read()).state.resourceLedger.reservations['hire:'+next.id]);
 }finally{await f.service.close();}
});
test('renewal admission refuses duplicate pending, work, exhaustion, absent hold, wrong owner and limit',async()=>{
 const f=await fixture();try{
 const doc=await f.read();assert(renewalReadiness(doc.state,f.contract).ok);for(const edit of [s=>s.npcNeeds[16]={energy:20,hunger:70},s=>s.recruitment.active.position.inside=0,s=>s.agentTaskLedger.find(t=>t.npcId===16).status='queued']){const d=structuredClone(doc);edit(d.state);assert(!renewalReadiness(d.state,f.contract).ok);}
 assert(!renewalReadiness(doc.state,{...f.contract,renewalDepth:3}).ok);
 const id=randomUUID();await assert.rejects(f.store.renew(f.theme,doc,{id:f.contract.id,requestId:id,projectId:'travel-plan'}),e=>e.code==='recruitment_renewal');
 const next=await propose(f,id);assert((await f.store.renew(f.theme,await f.read(),{id:f.contract.id,requestId:id,projectId:'travel-plan'})).replayed);
 await assert.rejects(f.store.renew(f.theme,await f.read(),{id:f.contract.id,requestId:id,projectId:'other-plan'}),e=>e.code==='recruitment_conflict');
 await assert.rejects(f.store.renew(f.theme,await f.read(),{id:f.contract.id,requestId:randomUUID(),projectId:'travel-plan'}),e=>e.code==='recruitment_full');
 const context=await f.service.tenants.get(f.accounts[0].token);const {createRecruitmentStore}=await import('../server/recruitmentStore.mjs');await assert.rejects(createRecruitmentStore({directory:context.directory}).renew(f.theme,await f.read(),{id:f.contract.id,requestId:randomUUID(),projectId:'travel-plan'}),e=>e.code==='recruitment_missing');
 }finally{await f.service.close();}
});
