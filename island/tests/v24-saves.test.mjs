import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,readdir,unlink,utimes} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createSaveStore} from '../server/saveStore.mjs';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {hydrateJourney,journeyView,trackJourney,claimMoment} from '../src/journey.js';
import {resourceLoot,commitRecipe,DEFAULT_RECIPES} from '../src/contentCatalog.js';
import {RAW_MATERIALS} from '../src/contentCatalog.js';
import {recordPlayerGoods,deliverTownOrder} from '../src/economy.js';
await mkdir('qa/v24',{recursive:true});
const fixture=async()=>{const directory=await mkdtemp(resolve('qa/v24/storage-'));return {directory,store:createSaveStore({directory})}};
const oldState=()=>{const s=hydrateTown(createState());s.day=31;s.coins=12345;s.playerProfile.name='雨';s.playerProfile.avatar='female_3';s.playerProfile.outfit='c4_8';delete s.wardrobe;s.playerProfile.research=9;s.inventory.c18_0=8;s.placedItems=[{building:18,item:'c18_0'}];s.activities=7;s.craftHistory.recipe_lantern=15;s.economy.daySeconds=810;s.facilities[0].upgrades=3;s.facilities[0].quality=90;s.npcAffinity[0]=99;s.npcMemory[0]=[{day:31,text:'旧经历'}];hydrateJourney(s);trackJourney(s,'craft',{item:'lantern',building:0});claimMoment(s,'light');return s};
test('first browser import is backed up before the queued zero restart; all earned progress clears',async()=>{
 const {store}=await fixture(),old=oldState();
 assert.equal((await store.restart('origami',{requestId:'first-day-test',defer:true})).pending,true);
 const opened=await store.open('origami',{legacyState:old}),s=hydrateTown(opened.document.state);hydrateJourney(s);
 assert(opened.migrated&&opened.restarted);assert.equal(s.day,1);assert.equal(s.coins,0);assert.equal(s.economy.daySeconds,0);
 assert(Object.values(s.inventory).every(v=>v===0));assert.deepEqual(s.discovered,{});assert.deepEqual(s.craftHistory,{});assert.deepEqual(s.placedItems,[]);
 assert.equal(s.activities,0);assert.deepEqual(s.npcAffinity,{});assert.deepEqual(s.npcMemory,{});
 assert.equal(s.facilities[0].quality,45);assert.equal(s.facilities[0].upgrades,0);
 assert.equal(journeyView(s).done,0);assert.equal(s.playerProfile.name,'雨');assert.equal(s.playerProfile.avatar,'female_3');assert.equal(s.playerProfile.outfit,null);assert.equal(s.playerProfile.research,0);
 assert.equal(Object.keys(s.buildings).length,25);assert.equal(s.freshStartPending,true);
 const history=await store.backups('origami');assert(history.some(x=>x.reason==='before-restart'&&x.day===31));assert(history.some(x=>x.reason==='migration'));
});
test('zero-start route can gather, craft the first light, claim seeds and earn first order income',async()=>{
 const {store}=await fixture();await store.restart('pixel',{requestId:'zero-path-test'});
 const s=hydrateTown((await store.open('pixel')).document.state);hydrateJourney(s);trackJourney(s,'meet');
 assert.equal(journeyView(s).step.id,'gather');
 resourceLoot('forest',s,6,'wood');recordPlayerGoods(s,'wood',6);trackJourney(s,'gather',{item:'wood',amount:6});
 resourceLoot('mine',s,1,'ore');recordPlayerGoods(s,'ore',1);trackJourney(s,'gather',{item:'ore',amount:1});
 for(const [id,n]of Object.entries(DEFAULT_RECIPES[0].cost))if(id!=='wood'){const source=RAW_MATERIALS.find(r=>r.id===id).source;resourceLoot(source,s,n,id);recordPlayerGoods(s,id,n);trackJourney(s,'gather',{item:id,amount:n});}
 assert(commitRecipe(DEFAULT_RECIPES[0],s));trackJourney(s,'craft',{item:'lantern',building:0});
 assert(claimMoment(s,'light'));assert.equal(s.inventory.seed,2);assert.equal(journeyView(s).step.id,'plant');
 assert(deliverTownOrder(s,0));assert(s.coins>0);
});
test('independent processes reject stale writers and keep the winner',async()=>{
 const {directory,store}=await fixture(),second=createSaveStore({directory});
 const {document:d}=await store.open('pixel',{legacyState:createState()});
 const results=await Promise.allSettled([store.save('pixel',{state:{...d.state,coins:100},expectedVersion:d.version}),second.save('pixel',{state:{...d.state,coins:200},expectedVersion:d.version})]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.find(x=>x.status==='rejected').reason.code,'save_conflict');
 const winner=results.find(x=>x.status==='fulfilled').value.document;
 assert.equal((await second.current('pixel')).state.coins,winner.state.coins);
});
test('reopening a restart request never clears new progress; themes remain independent',async()=>{
 const {store}=await fixture();await store.open('pixel',{legacyState:oldState()});
 await store.restart('origami',{requestId:'repeat-safe-test'});
 let {document:d}=await store.open('origami');d.state.inventory.wood=3;
 d=(await store.save('origami',{state:d.state,expectedVersion:d.version})).document;
 await store.restart('origami',{requestId:'repeat-safe-test'});
 assert.equal((await store.open('origami')).document.state.inventory.wood,3);
 assert.equal((await store.current('pixel')).state.day,31);
});
test('backup restore writes a recovery checkpoint and survives a fresh store instance',async()=>{
 const {directory,store}=await fixture();let {document:d}=await store.open('origami',{legacyState:oldState()});
 const backup=await store.backup('origami',{expectedVersion:d.version});
 d=(await store.save('origami',{state:{...d.state,day:32,coins:777},expectedVersion:d.version})).document;
 const restored=await store.restore('origami',{id:backup.id,expectedVersion:d.version});
 assert.equal(restored.document.state.day,31);assert.equal(restored.document.state.coins,12345);
 assert((await store.backups('origami')).some(x=>x.reason==='before-restore'&&x.day===32));
 assert.equal((await createSaveStore({directory}).current('origami')).state.coins,12345);
});
test('a truncated current file recovers the last complete save and keeps damaged bytes',async()=>{
 const {directory,store}=await fixture();let {document:d}=await store.open('pixel',{legacyState:oldState()});
 await store.save('pixel',{state:{...d.state,coins:700},expectedVersion:d.version});
 await writeFile(join(directory,'pixel/current.json'),'{truncated');
 const recovered=await createSaveStore({directory}).current('pixel');
 assert.equal(recovered.reason,'recovery');assert.equal(recovered.state.coins,12345);
 assert((await readdir(join(directory,'pixel'))).some(x=>x.startsWith('damaged-')));
});
test('invalid payload and backup traversal cannot replace a valid save',async()=>{
 const {store}=await fixture();const {document:d}=await store.open('pixel');
 await assert.rejects(store.save('pixel',{state:{...d.state,inventory:{wood:-1}},expectedVersion:d.version}),e=>e.code==='invalid_save');
 await assert.rejects(store.restore('pixel',{id:'../../current.json',expectedVersion:d.version}),e=>e.code==='invalid_save');
 assert.equal((await store.current('pixel')).version,d.version);
});

test('missing current restores previous; future schema never silently rolls back',async()=>{
 const {directory,store}=await fixture();const {document:d}=await store.open('pixel',{legacyState:oldState()});
 await store.save('pixel',{state:{...d.state,coins:700},expectedVersion:d.version});
 await unlink(join(directory,'pixel/current.json'));
 assert.equal((await store.current('pixel')).state.coins,12345);
 const next={...(await store.current('pixel')),schema:2};
 await writeFile(join(directory,'pixel/current.json'),JSON.stringify(next));
 await assert.rejects(store.open('pixel'),e=>e.code==='save_version');
 assert.equal(JSON.parse(await readFile(join(directory,'pixel/current.json'),'utf8')).schema,2);
});

test('exported documents and pending states can be imported, with a pre-import recovery copy',async()=>{
 const {store}=await fixture();let {document:d}=await store.open('origami',{legacyState:oldState()});
 const source=structuredClone(d);
 d=(await store.save('origami',{state:{...d.state,coins:888},expectedVersion:d.version})).document;
 const imported=await store.import('origami',{data:source,expectedVersion:d.version});
 assert.equal(imported.document.state.coins,12345);
 assert((await store.backups('origami')).some(x=>x.reason==='before-import'&&x.coins===888));
 await assert.rejects(store.import('pixel',{data:source}),e=>e.code==='save_corrupt');
});

test('empty abandoned lock recovers and a verified external export can repair total corruption',async()=>{
 const {directory,store}=await fixture(),folder=join(directory,'pixel');
 await mkdir(join(folder,'history'),{recursive:true});
 await writeFile(join(folder,'write.lock'),'');const old=new Date(Date.now()-60000);await utimes(join(folder,'write.lock'),old,old);
 const {document:d}=await store.open('pixel');
 await writeFile(join(folder,'current.json'),'broken');
 await assert.rejects(store.current('pixel'),e=>e.code==='save_corrupt');
 const repaired=await store.import('pixel',{data:d,expectedVersion:'corrupt'});
 assert.equal(repaired.document.state.day,1);
 assert((await readdir(folder)).some(x=>x.startsWith('damaged-')));
});
