import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createSaveStore,validateState} from '../server/saveStore.mjs';
import {syncPersonalState,personalSnapshot} from '../server/personalActions.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,visitQuote} from '../src/townSimulation.js';
import {ITEM_BY_ID,ALL_RECIPES,RECIPE_BY_ID,hydrateContent,recipeGate} from '../src/contentCatalog.js';
import {SEASONAL_RECIPES} from '../src/seasonalRecipes.js';
import {configureShopfront,validShopfronts,shopCapacity} from '../src/shopfronts.js';
import {reserveResources} from '../src/resourceLedger.js';
import {townOrders,ECONOMY_RULES} from '../src/economy.js';
await mkdir('qa/v176',{recursive:true});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;return s;};
async function fixture(theme,externalEconomy=false){
 const directory=await mkdtemp(resolve('qa/v176/catalog-audit-')),s=fresh();
 Object.assign(s.inventory,RECIPE_BY_ID.recipe_lantern.cost,{tea:1,cabbage:7,season_blueberry_tart:3,unknown_future_material:9});
 s.catalogPresence={version:7,declared:['wood','cabbage','unknown_future_material']};
 const store=createSaveStore({directory,externalEconomy,now:()=>1000000});
 const document=(await store.open(theme,{legacyState:s,protect:true})).document;
 return {directory,store,document,theme,reopen:()=>createSaveStore({directory,externalEconomy,now:()=>1000000})};
}
async function writeCanonical(f,d){syncPersonalState(d.state,d.actions);d.checksum=hash(d.state);d.actionsChecksum=hash(d.actions);await writeFile(join(f.directory,f.theme,'current.json'),JSON.stringify(d));}

test('inventory root must be an object; absent reserved stock cannot be legitimized by zero migration',()=>{
 for(const inventory of [undefined,null,[],true,false,1,-1,'','inventory'])assert.throws(()=>validateState({...fresh(),inventory}));
 const s=fresh();s.inventory.wood=2;assert(reserveResources(s,'old-accepted-craft',{wood:2}).ok);delete s.inventory.wood;
 assert.throws(()=>validateState(s),/物资预留/);
});

for(const theme of ['pixel','origami'])for(const externalEconomy of [false,true])test(`${theme} ${externalEconomy?'LAN':'standalone'} catalog migration preserves nonzero and unknown stock, accepted work, receipt hashes and autosave replay`,async()=>{
 const f=await fixture(theme,externalEconomy);
 const eat={kind:'personal',operation:'use',itemId:'tea',day:f.document.state.day,requestId:randomUUID(),expectedVersion:f.document.version};
 const used=await f.store.action(theme,eat);
 const craft=await f.store.action(theme,{kind:'craft',operation:'begin',recipeId:'recipe_lantern',mode:'1',requestId:randomUUID(),expectedSequence:used.document.actions.sequence,epoch:used.document.actions.epoch,expectedVersion:used.document.version});
 const legacy=structuredClone(craft.document);legacy.state.productionVersion=123;legacy.actions.active.recipeContract.catalogVersion=123;
 // An older catalog need not have preallocated zero slots for all original or new items.
 for(const [id,n] of Object.entries(legacy.state.inventory))if(n===0)delete legacy.state.inventory[id];
 await writeCanonical(f,legacy);
 const saveRequest={state:legacy.state,expectedVersion:legacy.version,saveId:randomUUID(),activeSeconds:0};
 const old=(await f.store.save(theme,saveRequest)).document;
 const receiptHash=hash(old.actions.receipts),resourceHash=hash(old.state.resourceLedger),active=structuredClone(old.actions.active);
 const hostile=structuredClone(old.state);hostile.inventory.cabbage=99999;hostile.catalogPresence={version:999};
 const migrated=(await f.reopen().openClient(theme,{legacyState:hostile})).document;
 assert.equal(migrated.reason,'catalog-migration-v176');assert.equal(migrated.revision,old.revision+1);
 assert.deepEqual(migrated.actions.active,active);assert.equal(hash(migrated.actions.receipts),receiptHash);assert.equal(hash(migrated.state.resourceLedger),resourceHash);
 assert.deepEqual(migrated.state.catalogPresence,old.state.catalogPresence);
 for(const [id,n] of Object.entries(old.state.inventory))assert.equal(migrated.state.inventory[id],n,id);
 for(const id of Object.keys(ITEM_BY_ID))assert.equal(migrated.state.inventory[id],old.state.inventory[id]??0,id);
 assert.equal(migrated.state.inventory.cabbage,7);assert.equal(migrated.state.inventory.season_blueberry_tart,3);assert.equal(migrated.state.inventory.unknown_future_material,9);
 assert.equal(migrated.state.discovered.unknown_future_material,undefined);
 assert.deepEqual(personalSnapshot(hydrateContent(structuredClone(migrated.state))),migrated.actions.personal.snapshot);
 assert.equal(migrated.checksum,hash(migrated.state));assert.equal(migrated.actionsChecksum,hash(migrated.actions));
 const replay=await f.reopen().save(theme,saveRequest);assert(replay.replayed);assert.equal(replay.document.version,migrated.version);
 const ateAgain=await f.reopen().action(theme,eat);assert(ateAgain.replayed);assert.equal(ateAgain.document.version,migrated.version);assert.equal(ateAgain.document.state.inventory.tea,0);
 assert.equal((await f.reopen().openClient(theme)).document.version,migrated.version);
 const saved=await f.reopen().save(theme,{state:migrated.state,expectedVersion:migrated.version,saveId:randomUUID(),activeSeconds:0});
 const cancelled=await f.store.action(theme,{kind:'craft',operation:'cancel',requestId:active.requestId,epoch:active.epoch,sequence:active.sequence,expectedVersion:saved.document.version});
 assert.equal(cancelled.receipt.outcome,'cancelled');assert.equal(cancelled.document.state.inventory.cabbage,7);
 for(const [id,n] of Object.entries(active.recipeContract.cost))assert.equal(cancelled.document.state.inventory[id],old.state.inventory[id]);
});

test('a valid empty old inventory gets only zero slots and does not receive starter tools or manufactured goods',async()=>{
 const f=await fixture('pixel'),legacy=structuredClone(f.document);legacy.state.inventory={};legacy.state.discovered={};legacy.state.productionVersion=123;
 await writeCanonical(f,legacy);const result=(await f.reopen().openClient('pixel')).document;
 assert.equal(Object.keys(result.state.inventory).length,Object.keys(ITEM_BY_ID).length);
 assert(Object.values(result.state.inventory).every(n=>n===0));assert.deepEqual(result.state.discovered,{});
 assert.deepEqual(personalSnapshot(hydrateContent(structuredClone(result.state))),result.actions.personal.snapshot);
});

test('larger shop capacities still exclude cross-venue and reserved stock and cannot bypass recipe unlocks or daily order limits',()=>{
 const s=fresh();for(const r of ALL_RECIPES)s.inventory[r.item]=100;
 for(const raw of ['cabbage','pea','cucumber','eggplant','blueberry','sweet_potato','daikon','kale'])s.inventory[raw]=100;
 for(const r0 of SEASONAL_RECIPES){
  const r=RECIPE_BY_ID[r0.id];assert.equal(recipeGate(r,s).ready,r.tier===0);
  const locked=structuredClone(s);delete locked.buildings[r.building];assert(!recipeGate(r,locked).ready);
  const rows=ALL_RECIPES.filter(x=>x.building===r.building).map(x=>({item:x.item,keep:0}));assert.equal(rows.length,shopCapacity(r.building));
  assert(configureShopfront(s,{buildingId:r.building,listing:rows,expectedShopRevision:s.shopfronts?.revision||0}).ok);assert(validShopfronts(s));
  assert(!configureShopfront(s,{buildingId:r.building,listing:[{item:'lantern',keep:0}],expectedShopRevision:s.shopfronts.revision}).ok);
  assert(configureShopfront(s,{buildingId:r.building,listing:[{item:r.item,keep:0}],expectedShopRevision:s.shopfronts.revision}).ok);
  assert(reserveResources(s,'audit:'+r.item,{[r.item]:100}).ok);assert.equal(visitQuote(s,{name:'游客',budget:100},r.building).paid,0);
 }
 const orders=townOrders(s);assert.equal(orders.length,3);assert.deepEqual(orders.map(o=>o.reward),[9,15,12]);assert.equal(orders.reduce((n,o)=>n+o.net,0),24);
 assert(orders.every(o=>!o.item.startsWith('season_')));assert.equal(ECONOMY_RULES.daySeconds,900);
});
