import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';import {createState} from '../src/world.js';import {hydrateTown} from '../src/townSimulation.js';
import {GARMENTS} from '../src/equipmentRules.js';import {ITEM_BY_ID} from '../src/contentCatalog.js';import {reserveResources} from '../src/resourceLedger.js';
import {hydrateJourney} from '../src/journey.js';
await mkdir('qa/v83',{recursive:true});
const garment=Object.keys(GARMENTS).find(k=>GARMENTS[k].slot==='body'),study=Object.values(ITEM_BY_ID).find(i=>i.category==='seedling').id;
async function fixture({external=false,prepare=()=>{}}={}){
 const directory=await mkdtemp(resolve('qa/v83/personal-'));let clock=1000000;
 const state=hydrateTown(createState());hydrateJourney(state);state.freshStartPending=false;state.inventory[garment]=3;state.inventory[study]=3;state.inventory.cotton=5;state.inventory.hoe=1;state.coins=100;
 prepare(state);const store=createSaveStore({directory,now:()=>clock,externalEconomy:external});let {document}=await store.open('pixel',{legacyState:state});
 document=(await store.action('pixel',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
 return {store,document,other:()=>createSaveStore({directory,now:()=>clock,externalEconomy:external}),advance:n=>clock+=n};
}
const command=(d,operation,args={})=>({kind:'personal',operation,requestId:randomUUID(),day:d.state.day,expectedVersion:d.version,...args});
test('personal gifts are committed once across simultaneous processes and immutable-ID replay',async()=>{
 const f=await fixture(),input=command(f.document,'gift',{itemId:'cotton',npcId:3});const rows=await Promise.all([f.store.action('pixel',input),f.other().action('pixel',input)]);
 assert.equal(rows.filter(r=>!r.replayed).length,1);const d=await f.other().current('pixel');assert.equal(d.state.inventory.cotton,4);assert.equal(d.state.giftLog.length,1);assert(d.state.npcAffinity[3]>20);
 await assert.rejects(f.other().action('pixel',{...input,npcId:4}),e=>e.code==='action_id_conflict');assert.equal((await f.store.current('pixel')).version,d.version);
});
test('inventory/cash, gift cap, research, player credit and confirmed journey cannot be overwritten by autosave',async()=>{
 const f=await fixture();for(const mutate of [s=>s.inventory.wood++,s=>s.coins++,s=>s.giftLog.push({item:'cotton',npcId:3,day:1}),s=>s.research[14]=99,s=>s.economy.playerGoods.wood=90,s=>s.journey.stats.crafted.lantern=1,s=>s.craftHistory.r4_0=99,s=>s.roomGames[4]={plays:999,best:100},s=>s.discovered.legendary_fake=true]){
 const state=structuredClone(f.document.state);mutate(state);await assert.rejects(f.store.save('pixel',{state,expectedVersion:f.document.version}),e=>e.code==='personal_state_conflict');assert.equal((await f.store.current('pixel')).version,f.document.version);}
 const state=structuredClone(f.document.state);state.player.x+=8;state.playerProfile.bio='合法个性资料';state.journey.stats.met=true;
 const saved=await f.store.save('pixel',{state,expectedVersion:f.document.version});assert.equal(saved.document.state.player.x,state.player.x);assert.equal(saved.document.state.playerProfile.bio,'合法个性资料');
});
test('clothing, public tools, study consumption and unequip retain real shared inventory',async()=>{
 const f=await fixture();let r=await f.store.action('pixel',command(f.document,'equip',{itemId:garment}));assert.equal(r.document.state.inventory[garment],2);
 const worn=r.document.state.wardrobe;assert(Object.values(worn.slots).some(v=>v?.item===garment));
 r=await f.store.action('pixel',command(r.document,'unequip',{itemId:garment}));assert.equal(r.document.state.inventory[garment],3);
 r=await f.store.action('pixel',command(r.document,'tool',{itemId:'hoe'}));assert.equal(r.document.state.inventory.hoe,1);assert.equal(r.document.state.toolbelt.hoe,'hoe');
 const seeds=r.document.state.inventory.seed,research=r.document.state.research?.[14]||0;
 r=await f.store.action('pixel',command(r.document,'use',{itemId:study}));assert.equal(r.document.state.inventory[study],2);assert.equal(r.document.state.inventory.seed,seeds+2);assert.equal(r.document.state.research[14],research+1);
 const before=r.document;await assert.rejects(f.store.action('pixel',command(before,'use',{itemId:'cotton'})),e=>e.code==='personal_unavailable');assert.equal((await f.store.current('pixel')).version,before.version);
});
test('reserved items and invalid recipients do not commit a consumption or gift',async()=>{
 const f=await fixture({prepare:s=>reserveResources(s,'project:test',{[study]:3,cotton:5},{purpose:'真实共享预留'})});
 for(const input of [command(f.document,'use',{itemId:study}),command(f.document,'gift',{itemId:'cotton',npcId:3}),command(f.document,'gift',{itemId:garment,npcId:999})])await assert.rejects(f.store.action('pixel',input),e=>['personal_unavailable','personal_invalid'].includes(e.code));
 assert.equal((await f.store.current('pixel')).version,f.document.version);
});
test('moments derive confirmed conditions, award once after restart and ignore requested amounts',async()=>{
 const bad=await fixture(),fake=structuredClone(bad.document.state);fake.journey.ready.light={day:1};
 const saved=await bad.store.save('pixel',{state:fake,expectedVersion:bad.document.version});
 await assert.rejects(bad.store.action('pixel',command(saved.document,'moment',{momentId:'light'})),e=>e.code==='personal_unavailable');
 const f=await fixture({prepare:s=>{s.journey.stats.crafted.lantern=1}}),before=f.document.state.inventory.seed,input=command(f.document,'moment',{momentId:'light',gain:{seed:9999}});
 const r=await f.store.action('pixel',input);assert.equal(r.document.state.inventory.seed,before+2);assert(r.document.state.journey.claimed.light);
 const replay=await f.other().action('pixel',input);assert(replay.replayed);assert.equal(replay.document.state.inventory.seed,before+2);
 await assert.rejects(f.other().action('pixel',command(r.document,'moment',{momentId:'light'})),e=>e.code==='personal_unavailable');
 await assert.rejects(f.other().action('pixel',command(r.document,'specialization',{path:'bogus',rank:99})),e=>e.code==='personal_invalid');
});
test('server gather still succeeds and external escrow stays canonical under personal inventory protection',async()=>{
 const f=await fixture({external:true});const start=await f.store.action('pixel',{operation:'begin',itemId:'wood',requestId:randomUUID(),epoch:f.document.actions.epoch,expectedSequence:0,expectedVersion:f.document.version});f.advance(2000);
 const done=await f.store.action('pixel',{operation:'finish',requestId:start.ticket.requestId,epoch:start.ticket.epoch,sequence:start.ticket.sequence,expectedVersion:start.document.version});
 assert.equal(done.document.state.inventory.wood,f.document.state.inventory.wood+2);assert.equal(done.document.actions.personal.snapshot.inventory.wood,done.document.state.inventory.wood);
 const w=done.document.state.saveSlot,input={id:'escrow:'+randomUUID(),holdId:'hold:'+randomUUID(),worldKey:w,operation:'reserve',cost:{cotton:2,coins:5},eventId:'fixture'};const held=await f.other().externalTransaction('pixel',input);
 assert.equal(held.document.state.inventory.cotton,3);assert.equal(held.document.state.coins,95);assert.equal(held.document.actions.personal.snapshot.coins,95);
 const refund=await f.other().externalTransaction('pixel',{...input,id:'refund:'+randomUUID(),operation:'release',cost:undefined});assert.equal(refund.document.state.inventory.cotton,5);assert.equal(refund.document.state.coins,100);
 assert.equal((await f.other().current('pixel')).version,refund.document.version);
});

test('inherited object keys and invalid reward IDs are definite rejections without changed saves',async()=>{const f=await fixture();for(const args of [{operation:'use',itemId:'__proto__'},{operation:'equip',itemId:'toString'},{operation:'unequip',itemId:'__proto__'},{operation:'specialization',path:'__proto__',rank:1},{operation:'moment',momentId:'constructor'}]){await assert.rejects(f.store.action('pixel',command(f.document,args.operation,args)),e=>e.code==='personal_invalid'&&e.status===409);assert.equal((await f.store.current('pixel')).version,f.document.version);}});
