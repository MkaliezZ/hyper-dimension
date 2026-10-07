import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {availableQuantity,commitResources} from '../src/resourceLedger.js';
import {mergeActionState} from '../src/actionMerge.js';
await mkdir('qa/v46',{recursive:true});
async function fixture(){
 const directory=await mkdtemp(resolve('qa/v46/commands-'));let now=1000000;
 const store=createSaveStore({directory,now:()=>now}),s=hydrateTown(createState());s.inventory.wood=0;s.inventory.axe=1;s.freshStartPending=false;
 const {document}=await store.open('pixel',{legacyState:s});
 return {store,directory,document,advance:n=>now+=n,other:()=>createSaveStore({directory,now:()=>now})};
}
const begin=(d,itemId='wood',requestId=randomUUID())=>({operation:'begin',requestId,itemId,expectedVersion:d.version,epoch:d.actions?.epoch||null,expectedSequence:d.actions?.sequence||0});
const finish=r=>({operation:'finish',requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version});
test('server derives amount/time/tool and awards exactly once even with stale-version retries',async()=>{
 const f=await fixture(),request={...begin(f.document),amount:900,gain:{coins:99999},seconds:0};
 const start=await f.store.action('pixel',request);
 assert.equal(start.ticket.amount,2);assert.equal(start.ticket.duration,1.28);assert.equal(start.document.state.inventory.wood,0);
 assert.equal(availableQuantity(start.document.state,'axe'),0);
 const replay=await f.other().action('pixel',request);assert(replay.replayed);assert.equal(replay.ticket.sequence,1);
 await assert.rejects(f.store.action('pixel',finish(start)),e=>e.code==='action_early');
 f.advance(1280);const completed=await f.store.action('pixel',finish(start));
 assert.equal(completed.document.state.inventory.wood,2);assert.equal(completed.document.state.economy.playerGoods.wood,2);
 assert.equal(availableQuantity(completed.document.state,'axe'),1);assert.equal(completed.document.state.gatherCounts.forest,1);
 const again=await f.other().action('pixel',finish(start));assert(again.replayed);assert.equal(again.document.version,completed.document.version);assert.equal(again.document.state.inventory.wood,2);
});
test('parallel finishes share disk lock and grant a single reward',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document));f.advance(2000);
 const rows=await Promise.all([f.store.action('pixel',finish(r)),f.other().action('pixel',finish(r))]);
 assert.equal(rows.filter(x=>!x.replayed).length,1);assert.equal((await f.store.current('pixel')).state.inventory.wood,2);
});
test('second window cannot start another action or overwrite the held tool',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document));
 await assert.rejects(f.other().action('pixel',begin(f.document,'shell')),e=>e.code==='save_conflict');
 await assert.rejects(f.store.action('pixel',begin(r.document,'shell')),e=>e.code==='action_active');
 const edited=structuredClone(r.document.state);delete edited.resourceLedger.reservations[r.ticket.owner];
 await assert.rejects(f.store.save('pixel',{state:edited,expectedVersion:r.document.version}),e=>e.code==='action_hold_conflict');
 assert.equal(commitResources(r.document.state,{cost:{axe:1},category:'test'}).ok,false);
});
test('source/identity validation rejects bypassing mine farm fishing or changing a replay item',async()=>{
 const f=await fixture();
 for(const id of ['ore','wheat','fish','lantern','__proto__'])await assert.rejects(f.store.action('pixel',begin(f.document,id)),e=>e.code==='action_invalid');
 const req=begin(f.document),r=await f.store.action('pixel',req);
 await assert.rejects(f.store.action('pixel',{...req,itemId:'shell'}),e=>e.code==='action_id_conflict');
 assert.equal((await f.store.current('pixel')).version,r.document.version);
});
test('cancel, timeout and restart retain no reward and always permit tool recovery',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document));f.advance(1800001);
 await assert.rejects(f.other().action('pixel',finish(r)),e=>e.code==='action_expired');
 const cancelled=await f.other().action('pixel',{...finish(r),operation:'cancel'});
 assert.equal(cancelled.receipt.outcome,'cancelled');assert.equal(cancelled.document.state.inventory.wood,0);assert.equal(availableQuantity(cancelled.document.state,'axe'),1);
 const repeat=await f.store.action('pixel',finish(r));assert.equal(repeat.receipt.outcome,'cancelled');assert.equal(repeat.document.state.inventory.wood,0);
});
test('autosaves preserve server-owned metadata; fresh process can settle the same ticket',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document));
 const s=structuredClone(r.document.state);s.playerProfile.name='续做';
 const saved=await f.store.save('pixel',{state:s,expectedVersion:r.document.version,actions:{active:null}});
 assert.deepEqual(saved.document.actions,r.document.actions);
 f.advance(2000);const done=await f.other().action('pixel',{...finish(r),expectedVersion:saved.document.version});assert.equal(done.document.state.inventory.wood,2);assert.equal(done.document.state.playerProfile.name,'续做');
});
test('import/restore/reset create a new action epoch and old tickets cannot award into it',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document)),backup=await f.store.backup('pixel',{expectedVersion:r.document.version});
 const restored=await f.store.restore('pixel',{id:backup.id,expectedVersion:r.document.version});assert.notEqual(restored.document.actions.epoch,r.ticket.epoch);assert.equal(availableQuantity(restored.document.state,'axe'),1);
 await assert.rejects(f.store.action('pixel',{...finish(r),expectedVersion:restored.document.version}),e=>e.code==='action_stale');
 const start=await f.store.action('pixel',begin(restored.document));
 const imported=await f.store.import('pixel',{data:start.document,expectedVersion:start.document.version});
 assert.equal(imported.document.actions.active,null);assert.equal(availableQuantity(imported.document.state,'axe'),1);
 const restarted=await f.store.restart('pixel',{requestId:'v46-zero-restart',expectedVersion:imported.document.version});
 assert.notEqual(restarted.document.actions.epoch,imported.document.actions.epoch);assert.equal(restarted.document.state.inventory.wood,0);
});
test('bounded receipt history never permits settlement of an evicted sequence again',async()=>{
 const f=await fixture();let doc=f.document,first;
 for(let i=0;i<130;i++){const r=await f.store.action('pixel',begin(doc,'shell'));first??=r;f.advance(2000);doc=(await f.store.action('pixel',finish(r))).document;}
 assert.equal(doc.actions.receipts.length,128);
 await assert.rejects(f.store.action('pixel',{...finish(first),expectedVersion:doc.version}),e=>e.code==='action_stale');
 assert.equal((await f.store.current('pixel')).state.inventory.shell,f.document.state.inventory.shell+260);
});
test('book checksum tampering restores previous committed state instead of forged action',async()=>{
 const f=await fixture(),r=await f.store.action('pixel',begin(f.document));const path=join(f.directory,'pixel/current.json');
 const bad=JSON.parse(await readFile(path,'utf8'));bad.actions.active.readyAt=0;await writeFile(path,JSON.stringify(bad));
 const recovered=await f.other().current('pixel');assert.equal(recovered.reason,'recovery');assert.equal(recovered.state.inventory.wood,0);assert.equal(recovered.actions,undefined);
});
test('missing owned axe borrows a public tool without creating inventory',async()=>{
 const f=await fixture(),s=f.document.state;s.inventory.axe=0;
 const d=(await f.store.save('pixel',{state:s,expectedVersion:f.document.version})).document,r=await f.store.action('pixel',begin(d));
 assert.equal(r.ticket.tool.source,'borrowed');assert.equal(r.ticket.duration,1.6);f.advance(1600);
 const done=await f.store.action('pixel',finish(r));assert.equal(done.document.state.inventory.axe,0);assert.equal(done.document.state.inventory.wood,2);
});
test('three-way reconciliation keeps unrelated live updates and rejects inventory conflicts',()=>{
 const base={inventory:{wood:0,stone:3},day:1,events:[]};
 const local=structuredClone(base);local.events.push('居民散步');
 const remote=structuredClone(base);remote.inventory.wood=2;
 assert.deepEqual(mergeActionState(base,local,remote),{inventory:{wood:2,stone:3},day:1,events:['居民散步']});
 local.inventory.wood=1;assert.throws(()=>mergeActionState(base,local,remote),e=>e.code==='save_conflict');
});
