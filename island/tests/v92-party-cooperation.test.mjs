import test from'node:test';import assert from'node:assert/strict';import{writeFile}from'node:fs/promises';import{fixture,produce,start,finish,CONFIG}from'./v92-cooperation-fixture.mjs';
import{captureCooperation,verifiedCooperation}from'../src/cooperationEvidence.js';import{syncWonders,validEventWonders,awardNightCooperation}from'../src/eventWonders.js';import{validActionBook}from'../server/playerActions.mjs';import{validAchievements}from'../src/achievements.js';
for(const theme of['pixel','origami'])for(const template of Object.keys(CONFIG))test(theme+' '+template+' actual assigned production captures verified lineage, completion and lost response replay count once',{timeout:90000},async()=>{
 const f=await fixture(template,theme);await produce(f);let d=await f.current(),draft=d.state[f.config.field].draft,proof=captureCooperation(d.state,draft);assert(proof.length>0);assert.equal(d.state.workProjects.find(p=>p.id===f.projectId).status,'ready');assert(validActionBook(d.actions));
 const goods=proof.reduce((n,e)=>n+e.amount,0);assert(goods>0);assert(proof.every(e=>e.parentRunId===f.run.parent.id&&e.childRunId===f.run.child.id));
 for(const change of[s=>s.hireControl.deliveries[proof[0].operationId].amount++,s=>delete s.hireControl.deliveries[proof[0].operationId],s=>s.agentTaskLedger.find(t=>t.id===proof[0].stepId).evidence[0].amount++]){
  const forged=structuredClone(d.state);change(forged);await assert.rejects(f.store.save(theme,{state:forged,expectedVersion:d.version}),e=>['hire_state_conflict','planning_state_conflict'].includes(e.code));
 }
 const begun=await start(f),snapshot=template==='night'?begun.ticket.design:begun.document.state[f.config.field].session;assert.deepEqual(snapshot.cooperation,proof);
 const done=await finish(f),s=done.document.state,eventId=done.ticket.eventId;assert(s.eventWonders.owned.cooperation_monument);assert.equal(s.eventWonders.owned.cooperation_monument.eventId,eventId);assert.deepEqual(s.eventWonders.sources[eventId].proof,proof);assert.deepEqual(s.achievementBook.cooperated[eventId].proof,proof);assert.equal(s.achievementBook.hosted[eventId].template,template);assert(validEventWonders(s));assert(validAchievements(s));assert(validActionBook(done.document.actions));
 const before=JSON.stringify({coins:s.coins,inventory:s.inventory,achievement:s.achievementBook,wonders:s.eventWonders});syncWonders(s);syncWonders(s);assert.equal(JSON.stringify({coins:s.coins,inventory:s.inventory,achievement:s.achievementBook,wonders:s.eventWonders}),before);
 const replay=await f.other().action(theme,{kind:f.config.kind,operation:'finish',requestId:done.ticket.requestId,epoch:done.ticket.epoch,sequence:done.ticket.sequence,expectedVersion:'lost-response'});assert(replay.replayed);assert.equal(replay.document.version,done.document.version);
 const disk=await f.other().current(theme);assert.deepEqual(disk.state.eventWonders.sources[eventId].proof,proof);assert.equal(Object.keys(disk.state.achievementBook.cooperated).length,1);
 await writeFile('qa/v92/'+theme+'-'+template+'-proof.json',JSON.stringify({directory:f.directory,theme,template,eventId,proof,actualGoods:goods,paid:done.receipt.reward,uniqueCompletion:true,scope:'Synthetic canonical model lineage; actual protected save actions and valid input replays with an injected clock. Attendance positions supplied by fixture; no road or real-model claim.'},null,2));
});
test('accepting a job, cancelled work, missing server attestation and unrelated projects do not create cooperation',{timeout:90000},async()=>{
 const f=await fixture('market'),d=await f.current(),g=d.state.festivalParty.draft;assert.deepEqual(captureCooperation(d.state,g),[]);
 const t=d.state.agentTaskLedger.find(t=>t.npcId===16),begin=await f.call('resident','begin',{actorId:16,intent:{goal:'forest',buildingId:null,action:'work',resource:t.targetItem,assignmentId:t.id}});await f.call('resident','cancel',{requestId:begin.ticket.requestId,epoch:begin.ticket.epoch,sequence:begin.ticket.sequence});assert.deepEqual(captureCooperation((await f.current()).state,g),[]);
 await produce(f);const s=(await f.current()).state,rows=captureCooperation(s,g);assert(rows.length);
 for(const change of[x=>delete x.hireControl.deliveries,x=>x.hireControl.deliveries[rows[0].operationId].childRunId='hd-child-'+'0'.repeat(32),x=>x.taskActionReceipts[rows[0].operationId].delta[rows[0].item]=999]){const x=structuredClone(s);change(x);assert.deepEqual(verifiedCooperation(x,{...g,cooperation:rows}),[]);}
 assert.deepEqual(verifiedCooperation(s,{projectIds:['unrelated'],cooperation:rows}),[]);
 await start(f);const a=(await f.current()).actions.active;await f.call('festival','cancel',{requestId:a.requestId,epoch:a.epoch,sequence:a.sequence});const cancelled=(await f.current()).state;assert.equal(cancelled.eventWonders?.owned.cooperation_monument,undefined);assert.equal(cancelled.eventWonders?.owned.cooperation_tree,undefined);assert.deepEqual(cancelled.wonderControl.cooperations,{});
});
test('operation attestations survive rotating the 128-ticket receipt ring and independent store restart',{timeout:90000},async()=>{
 const f=await fixture('night','origami');await produce(f);const d=await f.current(),g=d.state.nightParty.draft,proof=captureCooperation(d.state,g);await f.call('commerce','plan_create',{project:{id:'archive-pressure',title:'长期矿材筹备',targets:{ore:50}}});
 for(let i=0;i<130;i++)await f.call('commerce','plan_control',{projectId:'archive-pressure',control:i%2?'resume':'pause'});
 const disk=await f.other().current(f.theme);assert.equal(disk.actions.receipts.length,128);assert(!disk.actions.receipts.some(r=>r.ticket.operationId===proof[0].operationId));assert.deepEqual(captureCooperation(disk.state,g),proof);assert(validActionBook(disk.actions));
});
test('night completion requires its exact entry and payout; cancelled or invented rewards grant no monument',()=>{
 const s={day:1,coins:5,inventory:{},economy:{cashReceipts:{}},resourceLedger:{receipts:{}}},g={id:'party-1-0',template:'night',phase:'finished',paid:28,score:4,entryReceiptId:'party-1-0:entry',fireworks:false};assert.equal(awardNightCooperation(s,g).ok,false);assert.equal(s.eventWonders,undefined);
});
