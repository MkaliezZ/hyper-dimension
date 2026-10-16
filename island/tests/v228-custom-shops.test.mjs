import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createCoCreationStore} from '../server/cocreationStore.mjs';
import {createSaveStore,validateState} from '../server/saveStore.mjs';
import {validActionBook} from '../server/playerActions.mjs';
import {hydrateTown,visitQuote,settleVisit,assessIsland,TOURISTS} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {configureShopfront,validShopfronts,shopItemOffer,shopCapacity,shopListing} from '../src/shopfronts.js';
import {reserveResources} from '../src/resourceLedger.js';
import {customItemId,customRecipeId} from '../src/customContent.js';
import {visitorPrice,operatingCost} from '../src/economy.js';
import {itemPurpose} from '../src/itemPurpose.js';
import {validCommerceBook} from '../server/commerceActions.mjs';
import {pack,image} from './v224-content-fixtures.mjs';

async function fixture(theme='pixel'){
 const directory=await mkdtemp(join(tmpdir(),'hd-custom-shops-'));let now=1000000,saves,attached=true;
 const co=createCoCreationStore({directory,now:()=>now,catalogBaseline:async t=>(await saves.current(t))?.state.customCatalog||null,worldExists:async(t,key)=>(await saves.current(t))?.state.saveSlot===key});
 const contentProvider=(t,key)=>attached?co.catalog(t,key):null;saves=createSaveStore({directory,now:()=>now,contentProvider});
 const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+randomUUID();Object.assign(seed.inventory,{wood:50,resin:50,fiber:50});seed.facilities[11].quality=90;await saves.open(theme,{legacyState:seed,protect:true});
 const current=()=>saves.current(theme),call=async(kind,operation,fields={})=>{const d=await current();return saves.action(theme,{kind,operation,requestId:randomUUID(),expectedVersion:d.version,day:d.state.day,epoch:d.actions.epoch,expectedSequence:d.actions.sequence,...fields});};
 const manage=async(operation,fields={})=>co.action(theme,{operation,requestId:randomUUID(),expectedVersion:(await co.current(theme)).version,...fields});
 const publish=async(p=pack())=>{p=structuredClone(p);p.content.recipes[0].cost={wood:5,resin:2};const old=(await co.current(theme)).packages[p.id];await manage(old?'edit':'import',{packageId:p.id,pack:p});await co.assets.put(image);const v=(await co.current(theme)).packages[p.id].versions.at(-1);await manage('submit',{packageId:p.id,version:v.number,hash:v.hash});await manage('review',{packageId:p.id,version:v.number,hash:v.hash,decision:'approve',note:'核对共创物品的真实制作、上架与游客账单'});await manage('activate',{packageId:p.id,version:v.number,hash:v.hash,worldKey:seed.saveSlot});return v;};
 const shelf=async(listing,buildingId=11)=>call('commerce','shopfront',{buildingId,listing,expectedShopRevision:(await current()).state.shopfronts?.revision||0});
 const craft=async name=>{const r=await call('resident','begin',{actorId:10,intent:{goal:'gallery',buildingId:11,action:'work',recipeId:customRecipeId(pack().id,name)}});now=r.ticket.readyAt+1;return call('resident','finish',{requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence});};
 const letters=async n=>{for(let i=0;i<n;i++){await craft('seal');await craft('letter');}};
 const advance=async seconds=>{for(let left=seconds;left>0;left-=15){const seconds=Math.min(left,15),d=await current();now+=seconds*1000;await saves.save(theme,{state:d.state,expectedVersion:d.version,activeSeconds:seconds,saveId:randomUUID()});}};
 await publish();await call('commerce','enable');return {directory,co,saves,theme,current,call,manage,publish,shelf,craft,letters,advance,setTime:value=>{now=value;},detach:()=>{attached=false;},reopen:()=>createSaveStore({directory,now:()=>now,contentProvider})};
}
const item=customItemId(pack().id,'letter'),recipeId=customRecipeId(pack().id,'letter');

test('custom shelves require explicit listing and preserve stock floors, project holds and per-venue identities',async()=>{
 const f=await fixture(),s=(await f.current()).state;s.inventory[item]=3;assert.deepEqual(shopItemOffer(s,item),{listed:false,keep:0,available:0});
 const old=shopCapacity(11);assert.equal(configureShopfront(s,{buildingId:11,listing:[{item,keep:1}],expectedShopRevision:0}).ok,true);assert.equal(shopCapacity(11,s),old+2);assert.equal(shopItemOffer(s,item).available,2);reserveResources(s,'project:party',{[item]:2});assert.equal(shopItemOffer(s,item).available,0);assert.equal(validShopfronts(s),true);validateState(s,f.theme);
 const before=structuredClone(s.shopfronts);for(const listing of [[{item,keep:1,price:999}],[{item:'opc_foreign_product',keep:0}],[{item:'constructor',keep:0}],[{item:'wood',keep:0}],[{item,keep:0},{item,keep:1}]])assert.equal(configureShopfront(s,{buildingId:11,listing,expectedShopRevision:1}).ok,false);
 assert.equal(configureShopfront(s,{buildingId:0,listing:[{item,keep:0}],expectedShopRevision:1}).ok,false);assert.deepEqual(s.shopfronts,before);
});

test('a declared custom product uses its conservative published price and unchanged operating fee',async()=>{
 const f=await fixture(),s=(await f.current()).state,r=s.customCatalog.recipes.find(r=>r.id===recipeId);assert.equal(r.price,7);assert.equal(visitorPrice(item,r),7);assert.equal(operatingCost(visitorPrice(item,r)),3);
 s.inventory[item]=2;configureShopfront(s,{buildingId:11,listing:[{item,keep:1}],expectedShopRevision:0});const quote=visitQuote(s,{name:'虚构旅人',budget:28},11);assert.equal(quote.item,item);assert.equal(quote.paid,7);assert.equal(quote.cost,3);assert.equal(quote.net,4);
 const buyer={name:'虚构旅人',budget:28},before=s.coins;assert.equal(settleVisit(s,buyer,11,'fictional-custom-sale',0).paid,7);assert.equal(s.inventory[item],1);assert.equal(s.coins,before+4);assert.equal(buyer.budget,21);assert.equal(settleVisit(s,buyer,11,'fictional-custom-sale',0).paid,0);assert.equal(s.coins,before+4);assert.notEqual(visitQuote(s,{name:'后来旅人',budget:28},11).item,item);
});

test('explicit custom goods attract fitting visitors to additional venues without adding default stock or changing tastes',async()=>{
 const f=await fixture(),s=(await f.current()).state;s.inventory[item]=2;const scholar=TOURISTS.find(t=>t.taste==='收藏与知识'),food=TOURISTS.find(t=>t.taste==='海岛美食');assert.equal(scholar.likes.includes(11),false);assert.equal(assessIsland(s,scholar).itinerary.includes(11),false);
 configureShopfront(s,{buildingId:11,listing:[{item,keep:1}],expectedShopRevision:0});assert.equal(assessIsland(s,scholar).itinerary[0],11);assert.equal(assessIsland(s,food).itinerary.includes(11),false);assert.equal(scholar.likes.includes(11),false);assert.equal(shopListing(s,11).length,1);
 s.inventory[item]=1;assert.equal(assessIsland(s,scholar).itinerary.includes(11),false);
});

for(const theme of ['pixel','origami'])test(theme+' canonical custom sale survives unlisting, new publication, exact-once settlement and disk reopen',async()=>{
 const f=await fixture(theme);await f.letters(3);await f.shelf([{item,keep:1}]);await f.call('visitor','enable',{theme});await f.advance(20);const arrived=await f.call('visitor','arrive'),guest=arrived.receipt.accepted.find(g=>g.itinerary[0]===11);assert(guest,'A collector must select the explicitly stocked postal gift');
 f.setTime(guest.landReadyAt);await f.call('visitor','land',{guestId:guest.id});const begun=await f.call('visitor','begin',{guestId:guest.id,buildingId:11,stop:0}),ticket=begun.ticket;assert.equal(ticket.quote.item,item);assert.equal(ticket.quote.paid,7);assert.equal(shopItemOffer(begun.document.state,item).available,1);assert(validActionBook(begun.document.actions));
 await f.shelf([]);const revised=pack();revised.content.recipes[1].cost={'@seal':2,fiber:2};await f.publish(revised);const changed=await f.current();assert.notEqual(changed.state.customCatalog.recipes.find(r=>r.id===recipeId).price,ticket.quote.paid);assert.equal(changed.actions.visitor.leases[ticket.requestId].quote.paid,7);
 f.setTime(ticket.readyAt+1);const done=await f.call('visitor','finish',{requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});assert.equal(done.receipt.paid,7);assert.equal(done.document.state.coins,4);assert.equal(done.document.state.inventory[item],2);assert.equal(shopItemOffer(done.document.state,item).listed,false);assert(validActionBook(done.document.actions));
 const replay=await f.call('visitor','finish',{requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});assert.equal(replay.replayed,true);assert.equal(replay.document.version,done.document.version);assert.equal((await f.reopen().current(theme)).state.inventory[item],2);
});

test('retiring a recipe retains the explicitly listed owned product without granting further stock',async()=>{
 const f=await fixture();await f.letters(2);await f.shelf([{item,keep:1}]);f.detach();const d=await f.current();assert.equal(d.state.customCatalog.recipes.length,0);assert.equal(d.state.inventory[item],2);assert.equal(validShopfronts(d.state),true);assert.equal(shopItemOffer(d.state,item).available,1);assert.equal(visitQuote(d.state,{name:'虚构收藏旅人',budget:28},11).item,item);assert.equal((await f.reopen().current(f.theme)).state.inventory[item],2);
});

test('custom product purposes show real buyers, shelf route, downstream uses and retained retired stock',async()=>{
 const f=await fixture();await f.letters(2);const d=await f.current(),p=itemPurpose(item,d.state),seal=customItemId(pack().id,'seal');
 assert.deepEqual(p.shop,{listed:false,keep:0,available:0});assert.equal(p.marketPrice,7);assert.equal(p.building,'邮局');assert(p.buyers.includes('森久'));assert(!p.buyers.includes(TOURISTS.find(t=>t.taste==='海岛美食').name));assert(itemPurpose(seal,d.state).next.some(r=>r.id===item));
 await f.shelf([{item,keep:1}]);assert.deepEqual(itemPurpose(item,(await f.current()).state).shop,{listed:true,keep:1,available:1});f.detach();const retired=itemPurpose(item,(await f.current()).state);assert.equal(retired.recipe,null);assert.equal(retired.marketPrice,7);assert.equal(retired.building,'邮局');assert.equal(retired.shop.available,1);assert(retired.buyers.includes('森久'));
});

test('private commerce shelf metadata is minimal and cannot authorize a forged client product',async()=>{
 const f=await fixture();await f.letters(2);await f.shelf([{item,keep:1}]);const d=await f.current(),book=d.actions.commerce;
 assert.deepEqual(book.snapshot.customShelfBuildings,{[item]:11});assert.equal(Object.hasOwn(book.snapshot,'customCatalog'),false);assert(validCommerceBook(book));
 for(const change of [b=>b.snapshot.customShelfBuildings.opc_unlisted_product=11,b=>b.snapshot.customShelfBuildings[item]=0,b=>delete b.snapshot.customShelfBuildings]){const bad=structuredClone(book);change(bad);assert.equal(validCommerceBook(bad),false);}
 const forged=structuredClone(d.state);forged.shopfronts.venues[11]=[{item:'opc_other_island_product',keep:0}];forged.customShelfBuildings={'opc_other_island_product':11};assert.throws(()=>validateState(forged,f.theme));await assert.rejects(f.saves.save(f.theme,{state:forged,expectedVersion:d.version}));assert.equal((await f.current()).version,d.version);
});

test('custom merchandise obeys the same finite guest budget and cannot be bought past the protected floor',async()=>{
 const f=await fixture(),s=(await f.current()).state;s.inventory[item]=3;configureShopfront(s,{buildingId:11,listing:[{item,keep:1}],expectedShopRevision:0});const guest={name:'有限预算旅人',budget:13};
 const before=s.coins;assert.equal(settleVisit(s,guest,11,'budget-sale-one',0).paid,7);assert.equal(guest.budget,6);const next=visitQuote(s,guest,11);assert.notEqual(next.item,item);assert(next.paid<=guest.budget);assert.equal(s.inventory[item],2);assert.equal(s.coins,before+4);
 reserveResources(s,'project:protected-gift',{[item]:1});assert.equal(shopItemOffer(s,item).available,0);assert.notEqual(visitQuote(s,{name:'充足预算旅人',budget:100},11).item,item);assert.equal(visitorPrice(item,{source:'cocreation',price:999999}),24);assert.equal(visitorPrice(item,{source:'cocreation',price:NaN}),2);
});

test('published identity prevents venue relocation and leaves shelves, stock and accepted sales intact',async()=>{
 const f=await fixture();await f.letters(2);await f.shelf([{item,keep:1}]);await f.call('visitor','enable',{theme:f.theme});await f.advance(20);const arrived=await f.call('visitor','arrive'),guest=arrived.receipt.accepted.find(g=>g.itinerary[0]===11);assert(guest);f.setTime(guest.landReadyAt);await f.call('visitor','land',{guestId:guest.id});const begun=await f.call('visitor','begin',{guestId:guest.id,buildingId:11,stop:0}),ticket=begun.ticket;
 const changed=pack();changed.content.items[1].building=0;await assert.rejects(f.publish(changed),e=>e.code==='cocreation_identity');const kept=await f.current();assert.equal(kept.version,begun.document.version);assert.equal(kept.state.inventory[item],2);assert.deepEqual(kept.state.shopfronts,begun.document.state.shopfronts);assert(validActionBook(kept.actions));assert.equal((await f.reopen().current(f.theme)).version,kept.version);
 f.setTime(ticket.readyAt+1);const sale=await f.call('visitor','finish',{requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});assert.equal(sale.receipt.paid,7);assert.equal(sale.document.state.inventory[item],1);assert.equal(sale.document.state.coins,4);assert.equal(shopItemOffer(sale.document.state,item).available,0);
});
