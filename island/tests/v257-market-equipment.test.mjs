import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import * as gear from '../src/marketRules.js';
import * as festival from '../src/festivalParty.js';
import {partyDraftStamp,partyInputSignature,partyPlanningContext,cleanPartyContext,eventRequests} from '../src/partyPlanning.js';
import {partyGuide} from '../src/partyGuide.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {ITEM_BY_ID,RECIPE_BY_ID,recipeGate,canCraft} from '../src/contentCatalog.js';
import {beginTaskStep,recordTaskStep} from '../src/taskBoard.js';
import {commitResources} from '../src/resourceLedger.js';
import {syncProjects} from '../src/projectPlans.js';

const equipment={c9_5:1,c9_7:1},legacyEquipment={c9_0:1,c8_2:1};
const proposal={template:'market',name:'四季手作集市',tags:['craft'],description:'实际商品、真实陈列与居民邀请',difficulty:'normal',guestId:null};
// Declared inventory fixture; ordinary starting proficiency/quality, with no grant of recipe progress.
function state(){const s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=100;Object.assign(s.inventory,{bread:9,tea:7,pottery:4,bouquet:4,wood:5,c9_0:1,c8_2:1,c9_5:1,c9_7:1});for(const n of Object.values(s.npcNeeds))n.hunger=n.energy=n.social=100;return s;}
function oldDraft(s){assert(festival.createFestivalEvent(s,proposal).ok);delete s.festivalParty.draft.equipmentVersion;return s.festivalParty.draft;}
async function fixture(theme){await mkdir('qa/v257',{recursive:true});const directory=await mkdtemp(resolve('qa/v257/market-')),s=state(),d=oldDraft(s);for(const r of eventRequests(d))assert(festival.inviteFestivalNpc(s,r.id).ok);assert(festival.createFestivalPlan(s).ok);const store=createSaveStore({directory});await store.open(theme,{legacyState:s});const current=()=>store.current(theme),call=async(operation,args={})=>{const doc=await current(),d=doc.state.festivalParty?.draft;return store.action(theme,{kind:'commerce',operation,requestId:randomUUID(),expectedVersion:doc.version,epoch:doc.actions?.epoch??null,expectedSequence:doc.actions?.sequence||0,day:doc.state.day,eventId:d?.id||null,eventVersion:d?.version||null,eventStamp:partyDraftStamp(d),...args});};await call('enable');await call('festival_enable');return{store,current,call,theme,directory};}

test('new market contracts require durable price tags and display shelf without seasonal crops',()=>{
 const s=state();assert(festival.createFestivalEvent(s,{...proposal,equipmentVersion:1}).ok);const d=s.festivalParty.draft;
 assert.equal(d.equipmentVersion,2);assert.deepEqual(gear.marketEquipment(d),equipment);
 for(const id of Object.keys(equipment))assert(recipeGate(RECIPE_BY_ID[ITEM_BY_ID[id].recipeId],s).ready);
 assert.equal(recipeGate(RECIPE_BY_ID.recipe_c9_6,s).ready,false);assert.equal(canCraft(RECIPE_BY_ID.recipe_c9_7,s),false);
 assert.equal(ITEM_BY_ID.c9_5.price,14);assert.equal(ITEM_BY_ID.c9_7.price,16);
 const closed=structuredClone(s);delete closed.buildings[9];assert.equal(recipeGate(RECIPE_BY_ID.recipe_c9_5,closed).ready,false);
 const costs=festival.festivalNeeds(s).cost;assert.equal(costs.c9_0,undefined);assert.equal(costs.c8_2,undefined);assert.equal(costs.c9_5,1);assert.equal(costs.c9_7,1);
 const raw=new Set();function visit(id){const i=ITEM_BY_ID[id],r=RECIPE_BY_ID[i?.recipeId];assert(i);if(r)Object.keys(r.cost).forEach(visit);else raw.add(id);}Object.keys(equipment).forEach(visit);
 assert.deepEqual([...raw].sort(),['fiber','ink','iron','wood']);
});
test('opening a legacy draft and computing its stamp never silently replaces old equipment',()=>{
 const s=state(),d=oldDraft(s),before=structuredClone(d),stamp=JSON.stringify([d.id,d.version,d.name,partyInputSignature(d)]);
 assert.equal(partyDraftStamp(d),stamp);festival.hydrateFestival(s);assert(festival.validFestivalDesign(d));assert.deepEqual(d,before);
 assert.deepEqual(gear.marketEquipment(d),legacyEquipment);assert.deepEqual(gear.marketEquipment({...d,equipmentVersion:1}),legacyEquipment);
 assert.equal(festival.festivalNeeds(s).cost.c9_0,1);
});
test('equipment version is bounded and included in new stamps while old stamps remain byte compatible',()=>{
 const s=state(),d=oldDraft(s),stamp=partyDraftStamp(d);assert.equal(partyDraftStamp({...d,equipmentVersion:1}),stamp);
 assert.notEqual(partyDraftStamp({...d,equipmentVersion:2}),stamp);
 for(const v of [null,0,3,'2',{},[]])assert.equal(festival.validFestivalDesign({...d,equipmentVersion:v}),false,'version '+JSON.stringify(v));
 assert(festival.validFestivalDesign({...d,equipmentVersion:2}));
});
test('changing market gear retains completed task evidence and earned materials in a cancelled old plan',()=>{
 const s=state(),d=oldDraft(s);s.inventory.c9_0=0;assert(festival.createFestivalPlan(s).ok);const oldId=d.projectId,t=s.agentTaskLedger.find(t=>t.projectId===oldId&&t.targetItem==='bamboo');assert(t);
 const operationId=beginTaskStep(s,t.id),delta={bamboo:t.quantity};assert(commitResources(s,{id:operationId,gain:delta,category:'qa_declared_task_fixture'}).ok);assert(recordTaskStep(s,t.id,{operationId,result:'controlled fixture material completion',delta}).done);
 syncProjects(s);const completed=structuredClone(t),inventory=structuredClone(s.inventory);assert(festival.upgradeFestivalEquipment(s).ok);
 assert.deepEqual(s.agentTaskLedger.find(n=>n.id===t.id),completed);assert.deepEqual(s.inventory,inventory);assert.equal(s.workProjects.find(p=>p.id===oldId).status,'cancelled');assert(d.projectIds.includes(oldId));
});
test('guide, designer model context and cleaned model context retain the contract equipment',()=>{
 const s=state();assert.deepEqual(partyPlanningContext(s,'market').equipment,equipment);
 let d=oldDraft(s);assert.deepEqual(partyPlanningContext(s,'market').equipment,legacyEquipment);
 assert.deepEqual(cleanPartyContext(partyPlanningContext(s,'market')).equipment,legacyEquipment);
 assert(partyGuide(s,'market').materials.some(r=>r.item==='c9_0'));d.equipmentVersion=2;
 assert.deepEqual(partyPlanningContext(s,'market').equipment,equipment);assert.deepEqual(cleanPartyContext(partyPlanningContext(s,'market')).equipment,equipment);
 const guide=partyGuide(s,'market');assert(guide.materials.some(r=>r.item==='c9_7'));assert(!guide.materials.some(r=>r.item==='c9_0'));
});
for(const theme of ['pixel','origami'])test(theme+' protected upgrade preserves stock, completed work, gifts and project history; stale and replayed requests cannot change it twice',async()=>{
 const f=await fixture(theme),before=await f.current(),d=before.state.festivalParty.draft,oldId=d.projectId,version=d.version,stamp=partyDraftStamp(d);
 const forged=structuredClone(before.state);forged.festivalParty.draft.equipmentVersion=2;
 await assert.rejects(f.store.save(theme,{state:forged,expectedVersion:before.version}),e=>['festival_state_conflict','invalid_save'].includes(e.code));
 const requestId=randomUUID(),result=await f.call('festival_upgrade',{requestId}),s=result.document.state,n=s.festivalParty.draft;
 assert.equal(n.version,version+1);assert.equal(n.equipmentVersion,2);assert.equal(n.projectId,null);assert(n.projectIds.includes(oldId));assert.deepEqual(n.invites,{});assert.deepEqual(n.inviteGifts,d.inviteGifts);
 assert.deepEqual(s.inventory,before.state.inventory);assert.equal(s.coins,before.state.coins);assert.equal(s.workProjects.find(p=>p.id===oldId).status,'cancelled');
 const oldCompleted=before.state.agentTaskLedger.filter(t=>t.projectId===oldId&&t.status==='done');for(const t of oldCompleted)assert.deepEqual(s.agentTaskLedger.find(n=>n.id===t.id),t);
 assert.equal(s.resourceLedger.reservations['project:'+oldId],undefined);assert.equal(festival.festivalReadiness(s).ready,false);
 const reopened=createSaveStore({directory:f.directory}),replay=await reopened.action(theme,{kind:'commerce',operation:'festival_upgrade',requestId,expectedVersion:'lost',epoch:before.actions.epoch,expectedSequence:before.actions.sequence,day:before.state.day,eventId:d.id,eventVersion:version,eventStamp:stamp});assert(replay.replayed);assert.equal(replay.document.version,result.document.version);
 await assert.rejects(f.call('festival_upgrade',{eventVersion:version,eventStamp:stamp}),e=>e.code==='festival_draft_changed');
 const once=await f.call('festival_upgrade');assert(once.receipt.details.replayed);assert.equal(once.document.state.festivalParty.draft.version,version+1);
 for(const r of eventRequests(n))await f.call('festival_invite',{npcId:r.id});const invited=await f.current();assert.deepEqual(invited.state.inventory,before.state.inventory);assert.deepEqual(invited.state.npcAffinity,before.state.npcAffinity);
 await f.call('festival_plan');const planned=await f.current(),project=planned.state.workProjects.find(p=>p.id===planned.state.festivalParty.draft.projectId);
 assert.equal(project.targets.c9_0,undefined);assert.equal(project.targets.c9_5,1);assert.equal(project.targets.c9_7,1);assert(planned.state.festivalParty.draft.projectIds.includes(oldId));assert(festival.validFestivalParty(planned.state));
});
test('active legacy market keeps original held equipment and cannot be upgraded in place',()=>{
 const s=state(),d=oldDraft(s);for(const r of eventRequests(d))assert(festival.inviteFestivalNpc(s,r.id).ok);
 assert(festival.startFestivalParty(s,{seed:23,theme:'pixel'}).ok);const before=structuredClone(s),g=s.festivalParty.session;
 assert.deepEqual(gear.marketEquipment(g),legacyEquipment);assert.equal(s.resourceLedger.reservations['festival:'+g.id].items.c9_0,1);
 assert.equal(festival.upgradeFestivalEquipment(s).ok,false);assert.deepEqual(s,before);assert(festival.validFestivalParty(s));
});
