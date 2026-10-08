import {applyFarmCommand} from '../server/farmActions.mjs';
import {cleanResidents,selectResidentDecision} from '../server/agentService.mjs';
import {groundedConversation} from '../src/conversationFallback.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {setWorldTheme} from '../src/world.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,CAREERS,purposeOptions} from '../src/townSimulation.js';
import {createFishingEvent} from '../src/fishingParty.js';
import {RESIDENTS,BUILDINGS} from '../src/world.js';
import {RECIPE_BY_ID} from '../src/contentCatalog.js';
import {nextOperationId,reserveResources,availableQuantity} from '../src/resourceLedger.js';
import {activityCooperationNeeds,chooseResidentCooperation,cooperationPlanFor} from '../src/residentCooperation.js';
import {recordResidentConversation,claimResidentStory,validResidentStories,residentStoryOptions,advanceResidentStories} from '../src/residentStories.js';
import {newActionBook} from '../server/playerActions.mjs';
import {applyResidentCommand} from '../server/residentActions.mjs';
import {applyFieldCommand} from '../server/fieldActions.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;s.inventory.seed=3;return s};
function episode(s,people,plans){const row={id:nextOperationId(s,'npc-talk'),day:s.day,time:0,participants:people,type:'negotiate',changes:[],summary:'商定各自的物资分工',source:'local',lines:people.map(speaker=>({speaker,text:'按各自工作准备'}))};s.npcConversations.push(row);return recordResidentConversation(s,row,plans).episode;}
const draft=s=>{assert(createFishingEvent(s).ok);return s.fishingParty.draft};
const plan=(s,ids)=>chooseResidentCooperation(s,ids,{careers:CAREERS,activityOnly:true});
const raw=(goal,resource)=>({goal,buildingId:null,resource});
const claim=(s,e,id)=>{const op=nextOperationId(s,'story-work');assert(claimResidentStory(s,e.id,id,op,'work',{...cooperationPlanFor(e,id),action:'work'}));return op};
const begin=(s,b,e,id,extra={})=>({kind:'resident',operation:'begin',actorId:id,requestId:randomUUID(),epoch:b.epoch,expectedSequence:b.sequence,intent:{...cooperationPlanFor(e,id),action:'work',storyId:e.id,operationId:e.inFlight[id].operationId,...extra}});
const finish=(r)=>({kind:r.ticket.kind,operation:'finish',requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence});

test('published activity matches farming and forestry to two distinct, genuinely missing materials',()=>{const s=fresh();draft(s);const p=plan(s,[0,5]);assert(p.demand);assert.equal(p.plans[0].goal,'farm');assert.equal(p.plans[5].goal,'forest');assert.notEqual(p.plans[0].resource,p.plans[5].resource);const e=episode(s,[0,5],p);assert.equal(e.dueDay,s.day);assert(validResidentStories(s));assert.match(residentStoryOptions(s,0)[0].reason,/小麦/);const blocked=plan(s,[3,14]);assert.equal(blocked,null,'unrelated careers must not be assigned generic wood work');});

test('unreserved inventory, delivered gifts and steward ownership control actual demand',()=>{const s=fresh(),d=draft(s),first=activityCooperationNeeds(s)[0];for(const [id,n]of Object.entries(first.targets))s.inventory[id]=n;assert.equal(plan(s,[0,5]),null);reserveResources(s,'other-job',{bread:3});assert(activityCooperationNeeds(s)[0].nodes.some(n=>n.item==='wheat'));s.workProjects=[{id:'steward-event',status:'paused'}];d.projectId='steward-event';assert.deepEqual(activityCooperationNeeds(s),[]);delete d.projectId;s.inventory.bread=0;d.inviteGifts={0:{delivered:{bread:1}}};const r=activityCooperationNeeds(s)[0];assert(r.targets.bread<=first.targets.bread);});

test('cooperation offers obey career fit, needs, pair cooldown and existing work',()=>{const s=fresh();draft(s);const offer=purposeOptions(0,s,RESIDENTS[0],10).find(o=>o.purposeId.startsWith('activity-cooperation:'));assert(offer);assert.equal(offer.socialType,'negotiate');const e=episode(s,[0,offer.partnerId],plan(s,[0,offer.partnerId]));assert(!purposeOptions(0,s,RESIDENTS[0],10).some(o=>o.purposeId.startsWith('activity-cooperation:')));s.npcNeeds[0].energy=10;assert(purposeOptions(0,s,RESIDENTS[0],10).every(o=>o.action==='rest'));assert.equal(e.status,'scheduled');});

test('invalid per-person plans fail validation without throwing, legacy single plans remain valid',()=>{const s=fresh(),e=episode(s,[0,5],raw('forest','wood'));assert(validResidentStories(s));e.plans={0:null,5:raw('forest','wood')};e.contributions={0:{operationId:'bad',day:1,amount:1}};assert.equal(validResidentStories(s),false);});

test('cancelled, revised, handed-over or fully supplied activities close without invented credit',()=>{for(const mutate of [s=>delete s.fishingParty.draft,s=>s.fishingParty.draft.version++,s=>{s.workProjects=[{id:'handed',status:'preparing'}];s.fishingParty.draft.projectId='handed'},s=>{for(const [id,n]of Object.entries(activityCooperationNeeds(s)[0].targets))s.inventory[id]=n}]){const s=fresh();draft(s);const e=episode(s,[0,5],plan(s,[0,5]));mutate(s);assert(advanceResidentStories(s));assert.equal(e.status,'closed');assert.deepEqual(e.contributions,{});assert.equal(s.npcRelations[0]?.[5],undefined);}});

test('an already running real delivery finishes once after an activity change, then remaining work closes',()=>{const s=fresh();draft(s);const e=episode(s,[0,5],plan(s,[0,5])),b=newActionBook();claim(s,e,5);const r=applyResidentCommand(s,b,begin(s,b,e,5),1000000);delete s.fishingParty.draft;advanceResidentStories(s);assert.equal(e.status,'working');applyResidentCommand(s,b,finish(r),1020000);assert.equal(e.contributions[5].amount,2);assert.equal(s.inventory[e.plans[5].resource],2);advanceResidentStories(s);assert.equal(e.status,'closed');assert.equal(e.contributions[0],undefined);assert(validResidentStories(s));});

test('server rejects changing a promised recipe/item and accounts actual crafting inputs and output',()=>{const s=fresh(),r=RECIPE_BY_ID.recipe_lantern;for(const [id,n]of Object.entries(r.cost))s.inventory[id]=n;const p={goal:BUILDINGS[r.building].kind,buildingId:r.building,resource:r.item,recipeId:r.id},e=episode(s,[1,5],{plan:p,plans:{1:p,5:raw('forest','fiber')}});s.day=2;const b=newActionBook();claim(s,e,1);assert.throws(()=>applyResidentCommand(s,b,begin(s,b,e,1,{resource:'bread'}),1000000),e=>e.code==='resident_story_changed');const a=applyResidentCommand(s,b,begin(s,b,e,1),1000000);for(const id of Object.keys(r.cost))assert.equal(availableQuantity(s,id),0);const d=applyResidentCommand(s,b,finish(a),1020000);assert.deepEqual(d.receipt.gain,{lantern:1});assert.equal(e.contributions[1].amount,1);for(const id of Object.keys(r.cost))assert.equal(s.inventory[id],0);assert(validResidentStories(s));});

test('server mining enforces the individual promised mineral, not just the story id',()=>{const s=fresh(),p=raw('mine','copper'),e=episode(s,[11,5],{plan:p,plans:{11:p,5:raw('forest','fiber')}});s.day=2;const op=claim(s,e,11),b=newActionBook(),q={kind:'field',operation:'begin',field:'mine',itemId:'stone',index:0,actor:'npc',actorId:11,requestId:randomUUID(),epoch:b.epoch,expectedSequence:b.sequence,storyId:e.id,operationId:op};assert.throws(()=>applyFieldCommand(s,b,q,1000000),e=>e.code==='field_story_changed');const a=applyFieldCommand(s,b,{...q,itemId:'copper'},1000000);applyFieldCommand(s,b,finish(a),1020000);assert.equal(e.contributions[11].amount,1);assert.equal(s.inventory.copper,1);assert(validResidentStories(s));});

for(const theme of ['pixel','origami'])test(theme+' real farm authority advances four stages; only harvest credits the agreed crop, and replay is unique',async()=>{
 await mkdir('qa/v111',{recursive:true});const directory=await mkdtemp(resolve('qa/v111/farm-story-'));let now=1000000;const store=createSaveStore({directory,now:()=>now});const s=fresh(),p=raw('farm','wheat'),e=episode(s,[0,5],{plan:p,plans:{0:p,5:raw('forest','fiber')}});s.day=2;let doc=(await store.open(theme,{legacyState:s})).document;
 for(const step of ['hoe','sow','water','harvest']){
  doc.state.economy.daySeconds+=45;const story=doc.state.residentStories.episodes[0],op=claim(doc.state,story,0);doc=(await store.save(theme,{state:doc.state,expectedVersion:doc.version})).document;
  const body={kind:'farm',operation:'begin',actor:'npc',actorId:0,index:1,step,crop:'wheat',storyId:e.id,operationId:op,requestId:randomUUID(),expectedVersion:doc.version,expectedSequence:doc.actions?.sequence||0,epoch:doc.actions?.epoch||null};
  if(step==='sow')await assert.rejects(store.action(theme,{...body,crop:'tomato'}),e=>e.code==='farm_story_changed');
  const r=await store.action(theme,body);now+=r.ticket.duration*1000;
  const done=await store.action(theme,{...finish(r),expectedVersion:r.document.version});doc=done.document;
  assert.equal(Object.keys(doc.state.residentStories.episodes[0].contributions).length,step==='harvest'?1:0);if(step!=='harvest')assert.equal(doc.state.residentStories.episodes[0].retryAt,0,'legitimate multi-step work must remain the priority after the normal action cadence');
  if(step==='water')for(let i=0;i<12;i++){now+=15000;doc=(await store.save(theme,{state:doc.state,expectedVersion:doc.version,saveId:randomUUID(),activeSeconds:15})).document;}
  if(step==='harvest'){assert.equal(doc.state.inventory.wheat,2);assert.equal(doc.state.residentStories.episodes[0].contributions[0].amount,2);assert.equal(doc.state.taskActionReceipts[op].storyId,e.id);const again=await store.action(theme,{...finish(r),expectedVersion:doc.version});assert(again.replayed);assert.equal(again.document.state.inventory.wheat,2);assert(validResidentStories(doc.state));}
 }
});

test('story cooldown follows the actual effective economic clock within the same day',()=>{const s=fresh(),e=episode(s,[0,5],raw('forest','wood'));s.day=2;e.retryAt=930;s.economy.daySeconds=29;assert.equal(claimResidentStory(s,e.id,0,nextOperationId(s,'story-work'),'work'),false);s.economy.daySeconds=30;assert.equal(claimResidentStory(s,e.id,0,nextOperationId(s,'story-work'),'work'),true);});

test('activity dialogue preserves the proposed jobs even when the career option has no raw resource',()=>{const s=fresh();draft(s);const p=plan(s,[0,1]);const d=groundedConversation([0,1],s,i=>RESIDENTS[i],'negotiate',10,p);assert.equal(d.type,'negotiate');assert(d.lines.some(l=>l.speaker===0&&l.text.includes('小麦')));assert(d.lines.some(l=>l.speaker===1&&l.text.includes('铁矿')));assert.equal(s.inventory.wheat,0);});
for(const theme of ['pixel','origami'])test(theme+' residents 0 and 1 actually meet at the routed endpoints instead of timing out side by side',async()=>{setWorldTheme(theme);const s=fresh();draft(s);for(let id=0;id<16;id++)s.npcNeeds[id]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};const npcs=Array.from({length:16},(_,npcId)=>({npcId,x:0,y:0,visible:true,path:[]})),prior=globalThis.fetch;globalThis.fetch=async()=>{throw Error('isolated local fallback')};try{const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});for(let i=2;i<16;i++)npcs[i].manualUntil=10000;for(let i=0;i<900&&!s.residentStories.episodes.some(e=>e.people.includes(0)&&e.people.includes(1));i++){runtime.update(.1,i*.1);await Promise.resolve();}const e=s.residentStories.episodes.find(e=>e.people.includes(0)&&e.people.includes(1));assert(e,'two nearby residents must finish negotiating rather than wait for the 75s timeout');assert.equal(e.source.type,'negotiate');assert.equal(e.plans[0].resource,'wheat');assert.equal(e.plans[1].resource,'iron');assert.equal(s.inventory.wheat,0);}finally{globalThis.fetch=prior;setWorldTheme('pixel')}});

test('model context retains browser-generated story identity and each actual promised item',()=>{const s=fresh();draft(s);const e=episode(s,[0,5],plan(s,[0,5]));e.id='resident-story-ui-1234567890abcdef1234567890abcdef';const options=residentStoryOptions(s,0),clean=cleanResidents({residents:[{...RESIDENTS[0],options,commitments:[{id:e.id,title:e.title,partnerId:5,dueDay:1,stage:'work',item:e.plans[0].resource,activity:e.demand.name}]}]});assert.equal(clean[0].commitments[0].id,e.id);assert.equal(clean[0].commitments[0].item,'wheat');assert.equal(clean[0].commitments[0].activity,e.demand.name);const selected=selectResidentDecision(clean,{id:0,purposeId:options[0].purposeId},[0]);assert.equal(selected.storyId,e.id);assert.equal(selected.resource,'wheat');});

test('a cooperation bed keeps its crop between steps; the player can explicitly take over and end the hold',()=>{const s=fresh(),p=raw('farm','wheat'),e=episode(s,[0,5],{plan:p,plans:{0:p,5:raw('forest','fiber')}});s.day=2;const op=claim(s,e,0),b=newActionBook();const input={kind:'farm',operation:'begin',actor:'npc',actorId:0,index:1,step:'hoe',crop:'wheat',storyId:e.id,operationId:op,requestId:randomUUID(),epoch:b.epoch,expectedSequence:b.sequence};const r=applyFarmCommand(s,b,input,1000000);applyFarmCommand(s,b,finish(r),1020000);assert.equal(e.workSites[0].farmIndex,1);const other={...input,actorId:6,storyId:null,operationId:null,step:'sow',crop:'cotton',requestId:randomUUID(),expectedSequence:b.sequence};assert.throws(()=>applyFarmCommand(s,b,other,1020000),e=>e.code==='farm_story_occupied');const player=applyFarmCommand(s,b,{...other,actor:'player'},1020000);assert.equal(e.workSites[0],undefined);applyFarmCommand(s,b,{...finish(player),operation:'cancel'},1020000);assert(validResidentStories(s));});
