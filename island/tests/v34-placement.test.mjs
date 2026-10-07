import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {ALL_RECIPES,itemUse} from '../src/contentCatalog.js';
import {reserveResources} from '../src/resourceLedger.js';
import {hydratePlacements,decorate,canPlaceItem,validPlacements,checkDecoration,decorationColliders,displayShape,connectedPlacements} from '../src/placements.js';
import {worldSlots,setWorldTheme,setWorldDisplayColliders,HARBOR,findPath,worldWalkable} from '../src/world.js';
import {validateState,createSaveStore} from '../server/saveStore.mjs';
const fresh=(theme='pixel')=>{const s=hydrateTown(createZeroState());hydratePlacements(s,theme);s.freshStartPending=false;return s;};
const at={x:800,y:560,rotation:0};
const request=(s,action,extra={})=>({action,commandId:'test:'+s.placementBook.revision+':'+action,expectedRevision:s.placementBook.revision,...extra});
test('preview preserves inventory and quality; confirmation, command replay, move and storage conserve personal goods',()=>{
 const s=fresh();s.inventory.lantern=2;s.economy.playerGoods.lantern=2;const base=s.facilities[0].quality;
 assert.equal(itemUse('lantern',s).route,'placement');assert.equal(s.inventory.lantern,2);assert.equal(s.facilities[0].quality,base);
 const input=request(s,'place',{item:'lantern',...at}),r=decorate(s,input,{theme:'pixel'});assert(r.ok);assert.equal(s.inventory.lantern,1);assert.equal(s.economy.playerGoods.lantern,1);assert.equal(s.facilities[0].quality,base+1);
 for(let n=0;n<10;n++)assert(decorate(s,input,{theme:'pixel'}).replayed);assert.equal(s.inventory.lantern,1);assert.equal(s.placedItems.length,1);
 const conflict=structuredClone(s);assert(!decorate(s,{...input,x:808},{theme:'pixel'}).ok);assert.deepEqual(s,conflict);
 assert(decorate(s,request(s,'move',{displayId:r.id,x:784,y:552,rotation:1}),{theme:'pixel'}).ok);assert.equal(s.inventory.lantern,1);assert.equal(s.facilities[0].quality,base+1);
 const store=request(s,'store',{displayId:r.id});assert(decorate(s,store,{theme:'pixel'}).ok);assert.equal(s.inventory.lantern,2);assert.equal(s.economy.playerGoods.lantern,2);assert.equal(s.facilities[0].quality,base);
 assert(decorate(s,store,{theme:'pixel'}).replayed);assert.equal(s.inventory.lantern,2);validateState(s,'pixel');
});
test('reservations, invalid positions, residents, stale drafts and live activity locks reject atomically',()=>{
 const s=fresh();s.inventory.lantern=1;reserveResources(s,'party:kit',{lantern:1});const before=structuredClone(s);assert(!decorate(s,request(s,'place',{item:'lantern',...at}),{theme:'pixel'}).ok);assert.deepEqual(s,before);
 for(const p of [{x:20,y:700},{x:1300,y:191},{x:786,y:458},{x:854,y:505},worldSlots('pixel')[0]]){
  const z=fresh();z.inventory.lantern=1;const snapshot=structuredClone(z);assert(!decorate(z,request(z,'place',{item:'lantern',...p,rotation:0}),{theme:'pixel'}).ok);assert.deepEqual(z,snapshot);
 }
 const z=fresh();z.inventory.lantern=1;assert(!decorate(z,request(z,'place',{item:'lantern',...at}),{theme:'pixel',actors:[{...at}]}).ok);assert.equal(z.inventory.lantern,1);
 assert(!decorate(z,{...request(z,'place',{item:'lantern',...at}),expectedRevision:9},{theme:'pixel'}).ok);assert.equal(z.inventory.lantern,1);
 assert(decorate(z,request(z,'place',{item:'lantern',...at}),{theme:'pixel'}).ok);z.partySession={id:'night'};
 assert(!decorate(z,request(z,'store',{displayId:z.placedItems[0].id}),{theme:'pixel'}).ok);assert.equal(z.placedItems.length,1);
});
test('all placeable recipe outputs use real theme geometry and four directions without inventory or quality farming',()=>{
 for(const theme of ['pixel','origami'])for(const r of ALL_RECIPES.filter(r=>canPlaceItem(r.item))){
  const s=fresh(theme);s.inventory[r.item]=1;const base=s.facilities[r.building].quality;
  const placed=decorate(s,request(s,'place',{item:r.item,...at}),{theme});assert(placed.ok,theme+' '+r.item+' '+placed.reason);
  for(let rotation=0;rotation<4;rotation++){const moved=decorate(s,request(s,'move',{displayId:placed.id,...at,rotation}),{theme});assert(moved.ok,r.item+' '+moved.reason);assert.equal(s.inventory[r.item],0);}
  assert.equal(s.facilities[r.building].quality,base+1+r.tier);assert(decorate(s,request(s,'store',{displayId:placed.id}),{theme}).ok);assert.equal(s.inventory[r.item],1);assert.equal(s.facilities[r.building].quality,base);
 }
});
test('multiple decorations retain only highest workshop bonus and reclaim returns only the chosen item',()=>{
 const s=fresh();s.inventory.lantern=2;const base=s.facilities[0].quality;
 assert(decorate(s,request(s,'place',{item:'lantern',...at}),{theme:'pixel'}).ok);
 assert(decorate(s,request(s,'place',{item:'lantern',x:720,y:568,rotation:0}),{theme:'pixel'}).ok);
 assert.equal(s.facilities[0].quality,base+1);const first=s.placedItems[0].id;
 assert(decorate(s,request(s,'store',{displayId:first}),{theme:'pixel'}).ok);assert.equal(s.placedItems.length,1);assert.equal(s.inventory.lantern,1);assert.equal(s.facilities[0].quality,base+1);
 const capped=fresh();capped.facilities[0].quality=94;capped.inventory.lantern=1;capped.inventory.c0_10=1;
 assert(decorate(capped,request(capped,'place',{item:'lantern',...at}),{theme:'pixel'}).ok);assert.equal(capped.facilities[0].quality,95);
 const higher=decorate(capped,request(capped,'place',{item:'c0_10',x:720,y:552,rotation:0}),{theme:'pixel'});assert(higher.ok);assert.equal(capped.facilities[0].quality,95);
 assert(decorate(capped,request(capped,'store',{displayId:higher.id}),{theme:'pixel'}).ok);assert.equal(capped.facilities[0].quality,95);
 assert(decorate(capped,request(capped,'store',{displayId:capped.placedItems[0].id}),{theme:'pixel'}).ok);assert.equal(capped.facilities[0].quality,94);validateState(capped,'pixel');
});
test('both themes route around placed footprints and preserve all 25 entrances and resource/harbor access',()=>{
 for(const theme of ['pixel','origami']){
  const s=fresh(theme);s.inventory.lantern=1;assert(decorate(s,request(s,'place',{item:'lantern',x:848,y:560,rotation:0}),{theme}).ok);
  setWorldTheme(theme);setWorldDisplayColliders(decorationColliders(s));
  try{assert(!worldWalkable(848,560));for(const p of worldSlots(theme))assert(findPath(HARBOR.entrance,p.entry).length,theme+' '+p.id);
   const route=findPath({x:792,y:552},{x:912,y:552});assert(route.length);assert(route.every(p=>worldWalkable(p.x,p.y)));assert(connectedPlacements(s,theme).ok);
  }finally{setWorldDisplayColliders([]);}
 }
});
test('legacy fixed displays migrate once with conservation, and corrupt theme/position/IDs cannot overwrite saves',()=>{
 for(const theme of ['pixel','origami']){
  const s=hydrateTown(createZeroState());s.inventory.lantern=2;s.placedItems=[{item:'lantern',building:0,personalCredit:true},{item:'pottery',building:15,personalCredit:false}];const before={lantern:s.inventory.lantern+1,pottery:s.inventory.pottery+1};
  hydratePlacements(s,theme);assert.equal(s.inventory.lantern+s.placedItems.filter(p=>p.item==='lantern').length,before.lantern);assert.equal(s.inventory.pottery+s.placedItems.filter(p=>p.item==='pottery').length,before.pottery);
  const migrated=structuredClone(s);hydratePlacements(s,theme);assert.deepEqual(s,migrated);assert(validPlacements(s,{connectivity:true}));validateState(s,theme);
  for(const change of [z=>z.placedItems[0].x=10,z=>z.placedItems[0].rotation=4,z=>z.placedItems.push({...z.placedItems[0]}),z=>z.placementBook.serial=0]){const bad=structuredClone(s);change(bad);assert.throws(()=>validateState(bad,theme));}
  assert.throws(()=>validateState(s,theme==='pixel'?'origami':'pixel'));
 }
});
test('placements, personal credit and movement survive independent disk reopen and cross-theme imports are refused',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'hd-v34-')),store=createSaveStore({directory});
 for(const theme of ['pixel','origami']){const s=fresh(theme);s.inventory.lantern=1;s.economy.playerGoods.lantern=1;assert(decorate(s,request(s,'place',{item:'lantern',...at}),{theme}).ok);await store.open(theme,{legacyState:s,clientId:'placement'});}
 const reopened=createSaveStore({directory}),pixel=await reopened.current('pixel'),origami=await reopened.current('origami');
 assert.equal(pixel.state.placedItems.length,1);assert.equal(origami.state.placedItems[0].personalCredit,true);assert.equal(origami.state.placementBook.theme,'origami');
 await assert.rejects(()=>reopened.import('origami',{data:pixel.state,expectedVersion:origami.version,clientId:'wrong-theme'}),/布置画风与存档不一致/);
});
