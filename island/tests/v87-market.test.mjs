import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createMarketGame,applyMarketEvent,marketSummary,validMarketGame,MARKET_STOCK} from '../src/marketRules.js';
import {createFestivalLayout,validFestivalLayout} from '../src/festivalLayout.js';
import {validFestivalParty} from '../src/festivalParty.js';
import {completedMarketProof,syncWonders,validEventWonders} from '../src/eventWonders.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {partyDraftStamp,eventRequests,partyPlanningContext,validatePartyProposal} from '../src/partyPlanning.js';
import {createPartyPlanningService} from '../server/partyPlanningService.mjs';
import {validActionBook} from '../server/playerActions.mjs';
import {validAchievements} from '../src/achievements.js';
import {worldWalkableForTheme} from '../src/world.js';
import {placementObstacles} from '../src/placements.js';
await mkdir('qa/v87',{recursive:true});
const action=(type,extra={})=>({action:{type,...extra}});
function solveRules(seed,difficulty='normal',stopAt=12){
 const g=createMarketGame(seed,difficulty,[6,1,2,3]);let guard=0;
 while(g.phase!=='results'&&g.results.filter(r=>r.outcome==='served').length<stopAt&&guard++<2000){
  if(['setup','intermission'].includes(g.phase))applyMarketEvent(g,action('start'));
  for(const o of g.queue)if(!o.ready)applyMarketEvent(g,action('arrive',{index:o.id}));
  if(!g.packing&&g.queue.length){applyMarketEvent(g,action('clear'));for(const item of g.queue[0].goods)applyMarketEvent(g,action('add',{item}));applyMarketEvent(g,action('pack',{index:g.queue[0].id}));}
  applyMarketEvent(g,{dt:.05});assert(validMarketGame(g),'valid trace seed '+seed+' frame '+guard);
 }
 return g;
}
test('100 seeded markets retain exact per-item stock, four unique non-staff shoppers per wave and difficulty variation',()=>{
 const decks=new Set();
 for(let seed=1;seed<=100;seed++){
  const difficulty=seed%2?'normal':'easy',g=solveRules(seed,difficulty),r=marketSummary(g);assert.equal(r.served,12);assert(r.passed);assert(r.reward<=80);assert.deepEqual(r.unsold,{bread:0,tea:0,pottery:0,bouquet:0});decks.add(JSON.stringify(g.deck));
  for(let wave=0;wave<3;wave++){const a=g.deck.slice(wave*4,wave*4+4);assert.equal(new Set(a.map(o=>o.npcId)).size,4);assert(a.every(o=>![6,1,2,3].includes(o.npcId)));assert(a.every(o=>difficulty==='easy'?o.patience>=17:o.patience<14));}
 }
 assert.equal(decks.size,100);
});
test('new shopper travel does not freeze existing patience or packing; missed unrelated orders keep the parcel',()=>{
 const g=createMarketGame(7);applyMarketEvent(g,action('start'));applyMarketEvent(g,action('arrive',{index:0}));
 for(let i=0;i<88;i++)applyMarketEvent(g,{dt:.05});
 assert.equal(g.queue.length,2);const a=g.queue[0],b=g.queue[1],remaining=a.remaining;for(const item of a.goods)applyMarketEvent(g,action('add',{item}));applyMarketEvent(g,action('pack',{index:a.id}));
 applyMarketEvent(g,{dt:.05});assert(a.remaining<remaining);assert.equal(b.remaining,b.patience);assert.equal(g.packing.elapsed,.05);
 while(g.packing)applyMarketEvent(g,{dt:.05});assert.equal(g.results[0].outcome,'served');assert.equal(b.remaining,b.patience);
 const h=createMarketGame(9);applyMarketEvent(h,action('start'));applyMarketEvent(h,action('arrive',{index:0}));applyMarketEvent(h,action('add',{item:'tea'}));
 for(let i=0;i<400&&h.results.length===0;i++)applyMarketEvent(h,{dt:.05});assert.equal(h.results[0].outcome,'missed');assert.deepEqual(h.parcel,['tea']);assert.deepEqual(h.stock,MARKET_STOCK);assert(validMarketGame(h));
});
test('wrong parcels reduce patience and combo, cannot fabricate sales; invalid inputs and forged snapshots fail',()=>{
 const g=createMarketGame(2);applyMarketEvent(g,action('start'));applyMarketEvent(g,action('arrive',{index:0}));const old=g.queue[0].remaining;applyMarketEvent(g,action('pack',{index:0}));assert.equal(g.mistakes,1);assert.equal(g.queue[0].remaining,old-2);assert.deepEqual(g.stock,MARKET_STOCK);
 assert.throws(()=>applyMarketEvent(g,{dt:1}));assert.throws(()=>applyMarketEvent(g,action('display',{station:0,item:'wood'})));assert.throws(()=>applyMarketEvent(g,action('arrive',{index:0})));
 const result=solveRules(3);for(const mutate of [x=>x.deck[0].npcId=15,x=>x.stock.bread=1,x=>x.results[0].goods=[x.results[0].goods[0]==='pottery'?'bread':'pottery'],x=>x.results[1].id=x.results[0].id,x=>x.displayHits++,x=>x.results[0].calm=3,x=>x.results[0].remaining=99,x=>x.excluded.push(4)]){const x=structuredClone(result);mutate(x);assert.equal(validMarketGame(x),false);}
});
test('both layouts preserve nine distinct legal positions, including the existing cooperation monument',()=>{
 for(const theme of ['pixel','origami']){
  const s=hydrateTown(createZeroState());s.eventWonders={owned:{cooperation_monument:{}},displays:{cooperation_monument:true}};const l=createFestivalLayout(s,theme,4);assert(validFestivalLayout(l,4));const obstacles=placementObstacles(s,theme);for(const p of [...l.staff,...l.buyers,l.player])assert(worldWalkableForTheme(theme,p.x,p.y,obstacles));
 }
});
async function fixture(theme='pixel',edit=()=>{}){
 let now=1000000;const directory=await mkdtemp(resolve('qa/v87/rules-')),store=createSaveStore({directory,now:()=>now}),s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=100;
 Object.assign(s.inventory,{bread:9,tea:7,pottery:4,bouquet:4,wood:5,c9_0:1,c8_2:1,quartz:2,rod:1,c16_4:1,c16_2:1,lantern:2,wheat:4});s.economy.playerGoods={bread:6,tea:4,pottery:3,bouquet:3};for(const n of Object.values(s.npcNeeds)){n.hunger=n.energy=n.social=100;}edit(s);
 await store.open(theme,{legacyState:s});
 const current=()=>store.current(theme),base=async(kind,operation,args={})=>{const d=await current();return store.action(theme,{kind,operation,requestId:randomUUID(),expectedVersion:d.version,epoch:d.actions?.epoch??null,expectedSequence:d.actions?.sequence||0,day:d.state.day,...args});},call=async(operation,args={})=>{const d=(await current()).state.festivalParty?.draft;return base('commerce',operation,{eventId:d?.id||null,eventVersion:d?.version||null,eventStamp:partyDraftStamp(d),...args});};
 for(const op of ['enable','hire_enable','plan_enable','night_enable','fish_enable','festival_enable'])await base('commerce',op);
 return{theme,directory,store,current,base,call,advance:n=>now+=n,other:()=>createSaveStore({directory,now:()=>now}),save:async edit=>{const d=await current(),s=structuredClone(d.state);edit(s);return store.save(theme,{state:s,expectedVersion:d.version});}};
}
const proposal={template:'market',name:'星光手作集市',description:'在星灯下挑选海岛手艺',tags:['stars','craft'],difficulty:'normal',guestId:3,guestReason:'讲述手艺和星空的故事'};
async function publish(f){await f.call('festival_create',{proposal});for(const npcId of [6,1,2,3])await f.call('festival_invite',{npcId});}
async function begin(f){const d=(await f.current()).state.festivalParty.draft;return f.base('festival','begin',{eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)});}
async function place(f,orders=[]){
 return f.save(s=>{const g=s.festivalParty.session;s.player={...g.layout.player};s.festivalAttendance??={id:g.id,people:{}};s.festivalAttendance.id=g.id;s.festivalAttendance.people[-1]={...g.layout.player,inside:null,role:'host'};s.npcPresence??=[];
  const put=(id,point,data)=>{s.festivalAttendance.people[id]={...point,inside:null,...data};const old=s.npcPresence.find(n=>n.id===id);if(old)Object.assign(old,point,{inside:null});else s.npcPresence.push({id,...point,inside:null});};
  g.participants.forEach((p,k)=>put(p.id,g.layout.staff[k],{role:'staff'}));for(const o of orders)put(o.npcId,g.layout.buyers[o.id%4],{role:'buyer',orderId:o.id});
 });
}
async function play(f,t,{stopAt=12,missAll=false}={}){
 let g=structuredClone(t.game),buffer=[],guard=0;const emit=e=>{applyMarketEvent(g,e);buffer.push(e);if(e.dt)f.advance(e.dt*1000);};
 const flush=async()=>{if(!buffer.length)return;const r=await f.base('festival','checkpoint',{requestId:t.requestId,epoch:t.epoch,sequence:t.sequence,batch:t.nextBatch,events:buffer});t=r.ticket;assert.deepEqual(t.game,g);buffer=[];};
 await place(f);
 while(g.phase!=='results'&&g.results.filter(r=>r.outcome==='served').length<stopAt&&guard++<2500){
  if(['setup','intermission'].includes(g.phase)){emit(action('start'));await flush();}
  const pending=g.queue.filter(o=>!o.ready);if(pending.length){await flush();await place(f,pending);for(const o of pending)emit(action('arrive',{index:o.id}));await flush();}
  if(!missAll&&!g.packing&&g.queue.length){emit(action('clear'));for(const item of g.queue[0].goods)emit(action('add',{item}));emit(action('pack',{index:g.queue[0].id}));}
  emit({dt:.05});if(buffer.length>=100||g.phase!=='running')await flush();
 }
 await flush();return t;
}
const settle=(f,t,operation='finish')=>f.base('festival',operation,{requestId:t.requestId,epoch:t.epoch,sequence:t.sequence,reward:9999,quality:100});
for(const theme of ['pixel','origami'])test(theme+' actual gift, ready project, three waves, original-ID reward/refund, R wonder and shared daily cap',async()=>{
 const f=await fixture(theme);await f.call('festival_create',{proposal});const plan=await f.call('festival_plan');assert.equal(plan.receipt.details.project.status,'ready');for(const npcId of [6,1,2,3])await f.call('festival_invite',{npcId});
 const before=await f.current(),r=await begin(f);assert.equal(r.document.state.coins,88);for(const [id,n] of Object.entries(MARKET_STOCK))assert.equal(r.document.state.inventory[id],before.state.inventory[id]-n);
 assert.deepEqual(r.document.state.resourceLedger.reservations['festival:'+r.ticket.eventId].items,{c8_2:1,c9_0:1});
 let t=await play(f,r.ticket);await assert.rejects(settle(f,t),e=>e.code==='action_early');f.advance(2401);const paid=await settle(f,t);assert.equal(paid.receipt.reward,marketSummary(t.game).reward);assert.equal(paid.receipt.details.result.served,12);assert.equal(paid.document.state.inventory.c9_0,1);assert.equal(paid.document.state.activities,1);assert.equal(paid.document.state.journey.stats.nightParties,0);assert.equal(paid.document.state.eventWonders.owned.market_lantern.rarity,'R');assert.equal(paid.document.state.npcAffinity[6],24);assert(completedMarketProof(paid.document.state,paid.document.state.festivalParty.session));assert(validActionBook(paid.document.actions));assert(validEventWonders(paid.document.state));assert(validAchievements(paid.document.state));
 const replay=await f.other().action(theme,{kind:'festival',operation:'finish',requestId:t.requestId,epoch:t.epoch,sequence:t.sequence,expectedVersion:'lost-response'});assert(replay.replayed);assert.equal(replay.document.version,paid.document.version);assert.equal(replay.document.state.festivalParty.history.length,1);const s=structuredClone(paid.document.state);syncWonders(s);syncWonders(s);assert.equal(s.eventWonders.owned.market_lantern.marks,0);
 await f.call('festival_archive',{eventId:t.eventId});await f.call('fish_create',{proposal:{name:'次场钓鱼',difficulty:'normal'}});for(const npcId of[8,2])await f.base('commerce','fish_invite',{eventId:(await f.current()).state.fishingParty.draft.id,eventVersion:1,eventStamp:partyDraftStamp((await f.current()).state.fishingParty.draft),npcId});
 const d=(await f.current()).state.fishingParty.draft;await assert.rejects(f.base('fishing','begin',{eventId:d.id,eventVersion:d.version}),e=>e.code==='fishing_not_ready');
});
test('cancel returns only unsold goods, restores corresponding personal credit, retains fee and gifts, never pays twice',async()=>{
 const f=await fixture();await publish(f);const before=await f.current(),r=await begin(f),t=await play(f,r.ticket,{stopAt:3}),sold=Object.fromEntries(Object.keys(MARKET_STOCK).map(id=>[id,t.game.results.filter(o=>o.outcome==='served').reduce((n,o)=>n+o.goods.filter(x=>x===id).length,0)])),cancelled=await settle(f,t,'cancel');
 for(const id of Object.keys(MARKET_STOCK)){assert.equal(cancelled.document.state.inventory[id],before.state.inventory[id]-sold[id]);assert.equal(cancelled.document.state.economy.playerGoods[id],Math.max(0,before.state.economy.playerGoods[id]-sold[id]));}
 assert.equal(cancelled.document.state.coins,88);assert.equal(cancelled.document.state.eventWonders,undefined);assert.equal(cancelled.receipt.reward,0);assert.equal(cancelled.document.state.resourceLedger.reservations['festival:'+t.eventId],undefined);
 const again=await f.other().action(f.theme,{kind:'festival',operation:'cancel',requestId:t.requestId,epoch:t.epoch,sequence:t.sequence,expectedVersion:'lost'});assert(again.replayed);assert.equal(again.document.version,cancelled.document.version);
});
test('all missed customers return every product, pay zero, grant no successful-event wonder or affinity bonus',async()=>{
 const f=await fixture();await publish(f);const before=await f.current(),r=await begin(f),t=await play(f,r.ticket,{missAll:true});f.advance(2401);const paid=await settle(f,t);assert.equal(paid.receipt.reward,0);for(const id of Object.keys(MARKET_STOCK))assert.equal(paid.document.state.inventory[id],before.state.inventory[id]);assert.equal(paid.document.state.coins,88);assert.equal(paid.document.state.eventWonders,undefined);assert.equal(paid.document.state.npcAffinity[6],21);assert(!completedMarketProof(paid.document.state,paid.document.state.festivalParty.session));
});
test('name edits retain consent; critical edits revoke version, preserve gifts; stale draft and nonce changes are rejected',async()=>{
 const f=await fixture();await publish(f);const a=await f.current(),d=a.state.festivalParty.draft;
 await f.call('festival_update',{proposal:{...d,name:'暖灯手作'}});let n=(await f.current()).state.festivalParty.draft;assert.equal(n.version,1);assert.equal(n.invites[6].version,1);
 await f.call('festival_update',{proposal:{...n,difficulty:'easy'}});n=(await f.current()).state.festivalParty.draft;assert.equal(n.version,2);assert.deepEqual(n.invites,{});await assert.rejects(begin(f),e=>e.code==='festival_not_ready');for(const npcId of [6,1,2,3])await f.call('festival_invite',{npcId});const b=await f.current();assert.deepEqual(b.state.inventory,a.state.inventory);assert.equal(b.state.npcAffinity[6],a.state.npcAffinity[6]);
 await assert.rejects(f.call('festival_update',{eventVersion:1,proposal}),e=>e.code==='festival_draft_changed');
 const r=await begin(f);await assert.rejects(f.other().action(f.theme,{kind:'festival',operation:'begin',requestId:r.ticket.requestId,eventId:r.ticket.eventId,eventVersion:2,eventStamp:'different',expectedVersion:'lost'}),e=>e.code==='action_id_conflict');
});
test('actual staff and actual shopper arrival, wall time, unchanged batch hash and protected game/holds are enforced',async()=>{
 const f=await fixture();await publish(f);const r=await begin(f),id={requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence};
 const initial=await f.current();await assert.rejects(f.base('festival','checkpoint',{...id,batch:1,events:[action('start')]}),e=>e.code==='festival_arrival');assert.equal((await f.current()).version,initial.version);
 await place(f);let a=await f.base('festival','checkpoint',{...id,batch:1,events:[action('start')]});const t=a.ticket,o=t.game.queue[0];
 await assert.rejects(f.base('festival','checkpoint',{...id,batch:2,events:[action('arrive',{index:o.id})]}),e=>e.code==='festival_arrival');
 await place(f,[o]);a=await f.base('festival','checkpoint',{...id,batch:2,events:[action('arrive',{index:o.id})]});
 const duplicate=await f.other().action(f.theme,{kind:'festival',operation:'checkpoint',...id,batch:2,events:[action('arrive',{index:o.id})],expectedVersion:'lost'});assert(duplicate.replayed);
 await assert.rejects(f.other().action(f.theme,{kind:'festival',operation:'checkpoint',...id,batch:2,events:[{neutral:true}],expectedVersion:'lost'}),e=>e.code==='festival_batch_conflict');
 await assert.rejects(f.base('festival','checkpoint',{...id,batch:3,events:Array(10).fill({dt:.05})}),e=>e.code==='festival_clock');
 const d=await f.current();for(const mutate of [s=>s.festivalParty.session.game.stock.bread--,s=>s.festivalParty.session.paid=99,s=>delete s.resourceLedger.reservations['festival:'+t.eventId]]){const s=structuredClone(d.state);mutate(s);await assert.rejects(f.store.save(f.theme,{state:s,expectedVersion:d.version}),e=>['festival_state_conflict','invalid_save','action_hold_conflict'].includes(e.code));}
 assert.equal((await f.current()).version,d.version);
});
test('trusted backup restore returns unsold stock once; raw active import does not manufacture a refund',async()=>{
 const f=await fixture();await publish(f);const before=await f.current(),r=await begin(f),active=await f.current(),backup=await f.store.backup(f.theme,{expectedVersion:active.version});
 const restored=await f.store.restore(f.theme,{id:backup.id,expectedVersion:active.version});assert.equal(restored.document.state.festivalParty.session.phase,'abandoned');for(const id of Object.keys(MARKET_STOCK))assert.equal(restored.document.state.inventory[id],before.state.inventory[id]);assert.equal(restored.document.state.coins,88);assert.equal(restored.document.actions.active,null);
 const imported=await f.store.import(f.theme,{data:active.state,expectedVersion:restored.document.version});for(const id of Object.keys(MARKET_STOCK))assert.equal(imported.document.state.inventory[id],active.state.inventory[id]);assert.deepEqual(imported.document.state.festivalParty.session.returned,{});
});
test('AI market context has three roles and legal guest pool, uses current draft and deduplicates suggestions',async()=>{
 const f=await fixture();let calls=0;const svc=createPartyPlanningService({saves:f.store,suggest:async({world})=>{calls++;assert.deepEqual(world.fixedRoles.map(r=>r.id),[6,1,2]);assert(!world.candidates.some(g=>[6,1,2].includes(g.id)));assert.equal(world.cost.pottery,3);return{guestId:3,reason:'星野熟悉岛上故事，可以让手作集市的星空主题更加具体。'};}});
 const d=await f.current(),i={requestId:randomUUID(),worldKey:d.state.saveSlot,input:proposal,expectedId:null,expectedVersion:null,expectedStamp:null};const a=await svc.propose(f.theme,i),b=await svc.propose(f.theme,i);assert.equal(a.template,'market');assert.equal(a.model,'deepseek-flash');assert.equal(a.proposalId,b.proposalId);assert.equal(calls,1);assert.equal(validatePartyProposal(d.state,{...proposal,guestId:1}).ok,false);assert.equal(partyPlanningContext(d.state,'market').fixedRoles.length,3);
 await f.call('festival_create',{proposal});await assert.rejects(svc.propose(f.theme,{...i,requestId:randomUUID()}),e=>e.code==='party_proposal_invalid');
});
test('festival schema rejects malformed histories, refunds, gear ownership and fabricated completion proofs',async()=>{
 const f=await fixture();await publish(f);const r=await begin(f),s=r.document.state;assert(validFestivalParty(s));
 for(const mutate of [s=>s.festivalParty.history.push({paid:100}),s=>s.festivalParty.session.game.results.push({}),s=>s.festivalParty.session.personalStock.bread=99,s=>s.festivalParty.session.layout.buyers[0]=s.festivalParty.session.layout.staff[0],s=>s.festivalParty.session.participants.pop()]){const x=structuredClone(s);mutate(x);assert.equal(validFestivalParty(x),false);}
 const fake=structuredClone(s);fake.festivalParty.session.game=solveRules(3);fake.festivalParty.session.phase='claimed';fake.festivalParty.session.result=marketSummary(fake.festivalParty.session.game);fake.festivalParty.session.paid=fake.festivalParty.session.result.reward;fake.festivalParty.session.returned=fake.festivalParty.session.game.stock;assert.equal(completedMarketProof(fake,fake.festivalParty.session),false);
});
