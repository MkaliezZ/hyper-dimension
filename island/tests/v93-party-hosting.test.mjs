import test from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {ITEM_BY_ID} from '../src/contentCatalog.js';import {partyDraftStamp,eventRequests} from '../src/partyPlanning.js';import {partyGuide} from '../src/partyGuide.js';import {nextHostedParty,validPartyHosting} from '../src/partyHosting.js';import {validActionBook} from '../server/playerActions.mjs';import {CONFIG,finish} from './v92-cooperation-fixture.mjs';import {createPartyProposalStore} from '../server/partyProposalStore.mjs';
import {setup} from './v93-hosting-fixture.mjs';
for(const theme of ['pixel','origami'])for(const template of Object.keys(CONFIG))test(theme+' '+template+' saved one-time hosting waits for actual personal invitations, starts once and records actual completion',{timeout:90000},async()=>{
 const f=await setup(template,theme),armed=await f.arm(),id=armed.receipt.details.hostIntentId;let d=await f.current();
 assert.equal(d.state.partyHosting.active[0].phase,'armed');assert.equal(nextHostedParty(d.state),null);assert(validPartyHosting(d.state));
 await assert.rejects(f.begin(),e=>e.code==='hosting_not_ready');assert.equal((await f.current()).state.coins,240);
 await f.invite();d=await f.current();assert(partyGuide(d.state,template).ready);assert.equal(nextHostedParty(d.state).id,id);
 const dup=await f.arm();assert(dup.receipt.details.replayed);assert.equal((await f.current()).state.partyHosting.active.length,1);
 const begun=await f.begin(),h=begun.document.state.partyHosting.active[0];assert.equal(h.phase,'started');assert.equal(h.startRequestId,begun.ticket.requestId);assert.equal(h.sessionId,begun.ticket.eventId);assert.equal(nextHostedParty(begun.document.state),null);assert(validActionBook(begun.document.actions));
 const input={kind:f.config.kind,operation:'begin',requestId:begun.ticket.requestId,eventId:h.eventId,eventVersion:h.eventVersion,eventStamp:h.eventStamp,hostIntentId:id,...(template==='night'?{fireworks:false}:{})};
 const replay=await f.other().action(theme,{...input,expectedVersion:'lost response'});assert(replay.replayed);assert.equal(replay.document.version,begun.document.version);assert.equal(replay.document.state.coins,begun.document.state.coins);
 const done=await finish(f),state=done.document.state;assert.equal(state.partyHosting.active.length,0);assert.equal(state.partyHosting.history[0].phase,'finished');assert.equal(state.partyHosting.history[0].startRequestId,done.ticket.requestId);assert.equal(nextHostedParty(state),null);assert(validActionBook(done.document.actions));
 const disk=await f.other().current(theme);assert.deepEqual(disk.state.partyHosting,state.partyHosting);
 await writeFile('qa/v93/'+theme+'-'+template+'-hosting.json',JSON.stringify({directory:f.directory,theme,template,id,eventId:done.ticket.eventId,paid:done.receipt.reward,actualServerActions:true,realTime:false,modelUsed:false,scope:'Progressed isolated stock, injected clock and fixture attendance. Actual consent/cost/start/input-replayed completion/reload and lost-response replay.'},null,2));
});
test('changed version cancels old mandate; forged autosave and old host ID cannot start',{timeout:30000},async()=>{
 const f=await setup('market');await f.arm();const old=(await f.current()).state.partyHosting.active[0];let d=await f.current(),bad=structuredClone(d.state);bad.partyHosting.active[0].name='假委托';await assert.rejects(f.store.save('pixel',{state:bad,expectedVersion:d.version}),e=>e.code==='hosting_state_conflict');
 await f.manage('festival_update',{proposal:{...d.state.festivalParty.draft,description:'新约定'}});d=await f.current();assert.equal(d.state.partyHosting.active.length,0);assert.equal(d.state.partyHosting.history[0].phase,'stale');await f.invite();
 await assert.rejects(f.begin({hostIntentId:old.id}),e=>e.code==='hosting_changed');
 await f.arm();const h=(await f.current()).state.partyHosting.active[0];await f.manage('host_cancel',{template:'market',hostIntentId:h.id});assert.equal((await f.current()).state.partyHosting.history[0].phase,'cancelled');assert.equal(nextHostedParty((await f.current()).state),null);
});
test('missing supplies and other work block auto-host; manual begin consumes same mandate; cancel records actual end',{timeout:30000},async()=>{
 const f=await setup('fishing');await f.arm();await f.invite();await f.save(s=>s.inventory.bread=0);assert.equal(nextHostedParty((await f.current()).state),null);await assert.rejects(f.begin(),e=>e.code==='hosting_not_ready');await f.save(s=>s.inventory.bread=20);const d=await f.current();assert.equal(nextHostedParty(d.state,{actionActive:true}),null);
 const begun=await f.begin({hostIntentId:undefined});assert.equal(begun.document.state.partyHosting.active[0].phase,'started');
 await f.call('fishing','cancel',{requestId:begun.ticket.requestId,epoch:begun.ticket.epoch,sequence:begun.ticket.sequence});assert.equal((await f.current()).state.partyHosting.history[0].phase,'cancelled');
});
test('Hermes verified proposal can explicitly arm hosting; plain proposal does not imply permission',{timeout:30000},async()=>{
 for(const autoHost of [false,true]){
  const f=await setup('night'),d=await f.current(),e=d.state.nightParty.draft,runId='hd-island-'+'b'.repeat(32),p={...e,id:'c'.repeat(32),expectedId:e.id,expectedVersion:e.version,expectedStamp:partyDraftStamp(e),...(autoHost?{autoHost:true}:{})};
  const proof=createPartyProposalStore({directory:f.directory});await proof.record({theme:'pixel',worldKey:d.state.saveSlot||'legacy-pixel',runId,parties:[p]});const r=await f.manage('night_steward',{runId,proposalId:p.id});
  assert.equal(r.document.state.partyHosting?.active.length||0,autoHost?1:0);if(autoHost){const h=r.document.state.partyHosting.active[0];assert.equal(h.source,'hermes');assert.equal(h.runId,runId);assert.equal(h.proposalId,p.id);assert.equal(r.receipt.details.hosting.hostIntentId,h.id);assert.equal(nextHostedParty(r.document.state),null);}
 }
});

test('saved mandate waits through the shared daily cap and opens on the next 900-second effective day',{timeout:30000},async()=>{
 const f=await setup('night');await f.arm();await f.invite();await f.begin();await finish(f);
 await f.manage('night_create',{proposal:{template:'night',name:'明日星灯之约',description:'沿用真实费用与邀请',tags:['stars'],difficulty:'normal',guestId:null,fireworks:false}});await f.arm();await f.invite();let d=await f.current();assert.equal(partyGuide(d.state,'night').phase,'tomorrow');assert.equal(nextHostedParty(d.state),null);await assert.rejects(f.begin(),e=>e.code==='hosting_not_ready');
 const day=d.state.day;for(let i=0;i<59;i++){f.advance(15000);d=await f.current();await f.store.save('pixel',{state:d.state,expectedVersion:d.version,activeSeconds:15});}d=await f.current();assert.equal(d.state.day,day);assert.equal(nextHostedParty(d.state),null);f.advance(15000);await f.store.save('pixel',{state:d.state,expectedVersion:d.version,activeSeconds:15});d=await f.current();assert.equal(d.state.day,day+1);assert(nextHostedParty(d.state));const start=await f.begin();assert.equal(start.document.state.partyHosting.active[0].startedDay,day+1);
});
