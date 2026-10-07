import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createPartyProposalStore} from '../server/partyProposalStore.mjs';
import {manualPartyContext} from '../server/manualPartyContext.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {partyPlanningContexts,cleanPartyContexts,cleanPartyContext,partyDraftStamp,eventRequests} from '../src/partyPlanning.js';
import {validNightParty} from '../src/nightPartyPlanning.js';
import {validFestivalParty} from '../src/festivalParty.js';
import {validActionBook} from '../server/playerActions.mjs';
await mkdir('qa/v88',{recursive:true});
const runId='hd-island-'+'a'.repeat(32),pid=()=>randomUUID().replaceAll('-',''),op={night:'night_steward',market:'festival_steward'};
async function fixture(theme='pixel',stock={}){
 const directory=await mkdtemp(resolve('qa/v88/rules-')),store=createSaveStore({directory}),s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=0;Object.assign(s.inventory,stock);
 await store.open(theme,{legacyState:s});const current=()=>store.current(theme),call=async(operation,args={})=>{const d=await current();return store.action(theme,{kind:'commerce',operation,requestId:randomUUID(),day:d.state.day,expectedVersion:d.version,...args});};
 await call('enable');await call('plan_enable');return{theme,directory,store,current,call,proof:createPartyProposalStore({directory})};
}
const getDraft=(s,t)=>t==='night'?s.nightParty?.draft:s.festivalParty?.draft;
async function record(f,template,extra={}){
 const s=(await f.current()).state,d=getDraft(s,template),p={template,id:pid(),name:template==='night'?'管家星灯之约':'管家手作集市',description:'共同准备星空与海岛手艺',tags:['stars'],difficulty:'easy',guestId:3,guestReason:'星野分享海岛星图',expectedId:d?.id??null,expectedVersion:d?.version??null,expectedStamp:partyDraftStamp(d),...(template==='night'?{fireworks:true}:{}),...extra};
 await f.proof.record({theme:f.theme,worldKey:s.saveSlot||'legacy-'+f.theme,runId,parties:[p]});return p;
}
test('clean observations retain exact template roles/costs and bounded user profiles, ignoring injected role/gift fields',()=>{
 const s=hydrateTown(createZeroState()),raw=partyPlanningContexts(s);raw.market.fixedRoles[0].item='coins';raw.market.fixedRoles[0].quantity=999;raw.market.fixedRoles[0].name='摊主昵称';raw.market.candidates.push({id:15,tags:['stars']});raw.market.candidates[0].personality='x'.repeat(1000);
 const c=cleanPartyContexts(raw);assert.deepEqual(Object.keys(c),['fishing','night','market','couture','fireworks']);assert.deepEqual(c.fireworks.fixedRoles.map(x=>x.id),[1,3,12]);assert.deepEqual(c.fireworks.equipment,{firework:6,c8_2:1});assert.equal(c.fireworks.cost.coins,14);assert(!c.fireworks.candidates.some(x=>[1,3,12].includes(x.id)));assert.deepEqual(c.night.fixedRoles.map(x=>x.id),[0,2]);assert.deepEqual(c.market.fixedRoles.map(x=>x.id),[6,1,2]);assert.equal(c.market.fixedRoles[0].name,'摊主昵称');assert.equal(c.market.fixedRoles[0].item,'bread');assert.equal(c.market.fixedRoles[0].quantity,1);assert.equal(c.market.cost.coins,12);assert(!c.market.candidates.some(x=>[1,2,6,15].includes(x.id)));assert(c.market.candidates.every(x=>x.personality.length<=160));assert.equal(cleanPartyContext({template:'invented'}),null);assert.deepEqual(cleanPartyContexts({market:{...raw.market,template:'night'}}),{});
});
test('manual context uses real saved slot and prevents home event tools while visiting',()=>{
 const s=hydrateTown(createZeroState());s.saveSlot='own-slot';const c=manualPartyContext(s,'pixel',{saveSlot:'own-slot'});assert.equal(c.saveSlot,'own-slot');assert.equal(c.partyTemplates.market.template,'market');assert.throws(()=>manualPartyContext(s,'pixel',{saveSlot:'forged'}),e=>e.code==='party_world_changed');assert.deepEqual(manualPartyContext(s,'pixel',{visiting:true}),{saveSlot:'own-slot',party:null,partyTemplates:{}});assert.deepEqual(manualPartyContext(null,'pixel'),{party:null,partyTemplates:{}});
});
for(const theme of ['pixel','origami'])for(const template of ['night','market'])test(theme+' '+template+' real service proof registers a zero-stock actual dependency plan without consent, fee or duplicate plan',async()=>{
 const f=await fixture(theme),p=await record(f,template),r=await f.call(op[template],{runId,proposalId:p.id}),d=getDraft(r.document.state,template),plan=r.document.state.workProjects.find(x=>x.id===d.projectId);
 assert(r.receipt.details.ok);assert.equal(r.receipt.details.template,template);assert.equal(d.source,'hermes');assert.equal(d.runId,runId);assert.equal(d.proposalId,p.id);assert.equal(plan.source,'hermes');assert.equal(plan.runId,runId);assert.deepEqual(d.invites,{});assert.equal(r.document.state.coins,0);assert.equal(r.document.state.activities,0);assert(r.document.state.agentTaskLedger.some(x=>x.projectId===plan.id));assert.equal(template==='night'?validNightParty(r.document.state):validFestivalParty(r.document.state),true);assert(validActionBook(r.document.actions,r.document.state));
 const retry=await f.call(op[template],{runId,proposalId:p.id});assert(retry.receipt.details.replayed);assert.equal(retry.document.state.workProjects.length,1);assert.equal(getDraft(retry.document.state,template).id,d.id);
 const prefix=template==='night'?'night':'festival';await f.call(prefix+'_cancel',{eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)});const repeated=await f.call(op[template],{runId,proposalId:p.id});assert(repeated.receipt.details.replayed);assert.equal(getDraft(repeated.document.state,template),null);assert.equal(repeated.document.state.workProjects.length,1);
});
test('server ignores client-injected proofs and rejects wrong owner/template/run or a changed draft without mutation',async()=>{
 const f=await fixture(),p=await record(f,'market'),before=await f.current();
 await assert.rejects(f.call('festival_steward',{runId:'hd-island-'+'b'.repeat(32),proposalId:p.id,verifiedProposal:p}),e=>e.code==='festival_proof');
 await assert.rejects(f.call('night_steward',{runId,proposalId:p.id}),e=>e.code==='night_not_ready');
 assert.equal((await f.current()).version,before.version);
 const r=await f.call('festival_steward',{runId,proposalId:p.id}),d=r.document.state.festivalParty.draft,stale=await record(f,'market',{name:'观察后的旧修改'});
 await f.call('festival_update',{eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d),proposal:{...d,name:'岛主亲自改名'}});const edited=await f.current();
 await assert.rejects(f.call('festival_steward',{runId,proposalId:stale.id}),e=>e.code==='festival_not_ready');assert.equal((await f.current()).version,edited.version);assert.equal(await f.proof.peek({theme:'origami',worldKey:edited.state.saveSlot||'legacy-pixel',runId,proposalId:p.id}),null);
 const forged=structuredClone(edited.state);forged.festivalParty.hermesReceipts[runId+':'+p.id].title='篡改回执';await assert.rejects(f.store.save('pixel',{state:forged,expectedVersion:edited.version}),e=>e.code==='festival_state_conflict');
});
test('continued native session atomically appends new immutable proposals and never loses earlier IDs',async()=>{
 const f=await fixture(),a=await record(f,'night'),b={...a,id:pid(),template:'market',name:'第二轮集市'},c={...a,id:pid(),name:'第三轮星灯'};
 await Promise.all([f.proof.record({theme:'pixel',worldKey:'legacy-pixel',runId,parties:[b]}),createPartyProposalStore({directory:f.directory}).record({theme:'pixel',worldKey:'legacy-pixel',runId,parties:[c]})]);
 for(const p of [a,b,c])assert.deepEqual(await f.proof.peek({theme:'pixel',worldKey:'legacy-pixel',runId,proposalId:p.id}),p);
 await assert.rejects(f.proof.record({theme:'pixel',worldKey:'legacy-pixel',runId,parties:[{...a,name:'覆盖'}]}));await assert.rejects(f.proof.record({theme:'origami',worldKey:'legacy-pixel',runId,parties:[a]}));assert.deepEqual(await f.proof.peek({theme:'pixel',worldKey:'legacy-pixel',runId,proposalId:a.id}),a);
});
test('Hermes key changes preserve delivered gifts but require re-consent without a second debit',async()=>{
 const f=await fixture('pixel',{wheat:4,lantern:3,firework:1,quartz:1}),p=await record(f,'night',{guestId:null,tags:[],fireworks:false});const a=await f.call('night_steward',{runId,proposalId:p.id}),d=a.document.state.nightParty.draft,oldPlan=d.projectId;
 for(const npcId of [0,2])await f.call('night_invite',{npcId,eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)});const gifted=await f.current();assert(gifted.state.nightParty.draft.inviteGifts[0].delivered.wheat===1);assert(gifted.state.nightParty.draft.inviteGifts[2].delivered.lantern===1);
 const next=await record(f,'night',{description:'改为星空主题',tags:['stars'],guestId:3,fireworks:true});const r=await f.call('night_steward',{runId,proposalId:next.id}),newDraft=r.document.state.nightParty.draft;assert.equal(newDraft.version,2);assert(r.receipt.details.reinvite);assert.deepEqual(newDraft.invites,{});assert.equal(r.document.state.workProjects.find(p=>p.id===oldPlan).status,'completed');assert.equal(r.document.state.workProjects.length,2);assert.equal(r.document.state.coins,0);
 for(const npcId of [0,2])await f.call('night_invite',{npcId,eventId:newDraft.id,eventVersion:newDraft.version,eventStamp:partyDraftStamp(newDraft)});const confirmed=await f.current();assert.deepEqual(confirmed.state.inventory,gifted.state.inventory);assert.equal(confirmed.state.npcAffinity[0],gifted.state.npcAffinity[0]);assert.equal(confirmed.state.npcAffinity[2],gifted.state.npcAffinity[2]);assert.equal(confirmed.state.nightParty.draft.invites[3],undefined);assert(eventRequests(newDraft).some(r=>r.id===3));
});
