import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs,purposeOptions,commitWork} from '../src/townSimulation.js';
import {hydratePlacements,decorate,checkDecoration} from '../src/placements.js';
import {hydrateFunctionalFacilities,functionalCommand,tickFunctionalFacilities,functionalUnit,validFunctionalFacilities,irrigationConnected} from '../src/functionalFacilities.js';
import {reserveResources,availableQuantity} from '../src/resourceLedger.js';
import {itemUse,ITEM_BY_ID} from '../src/contentCatalog.js';import {itemPurpose} from '../src/itemPurpose.js';
import {tickCrops,CROPS} from '../src/farming.js';import {RESIDENTS} from '../src/world.js';
import {validateState,createSaveStore} from '../server/saveStore.mjs';
const fresh=theme=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;hydratePlacements(s,theme);hydrateFunctionalFacilities(s);s.journey={completed:{harvest:true}};return s;};
function place(s,item,x=800,y=560){s.inventory[item]=1;const r=decorate(s,{commandId:'place:'+item,action:'place',item,x,y,rotation:0},{theme:s.placementBook.theme});assert(r.ok,r.reason);hydrateFunctionalFacilities(s);return r.id;}
let serial=0;const cmd=(s,id,action,extra={},hooks={})=>functionalCommand(s,{commandId:'command:'+(++serial),displayId:id,action,expectedRevision:s.functionalFacilities.revision,...extra},hooks);
function farmPosition(s){for(let y=624;y<790;y+=16)for(let x=344;x<640;x+=16){const p={item:'c14_6',x,y,rotation:0};if(checkDecoration(s,p,{theme:s.placementBook.theme}).ok)return p;}throw Error('No safe farm facility point');}
for(const theme of ['pixel','origami']){
 test(theme+' nursery consumes only unreserved input, advances effective time, pauses and harvests exactly once',()=>{
  const s=fresh(theme),id=place(s,'c6_8');s.inventory.shrimp=2;s.inventory.c6_0=2;reserveResources(s,'party:stock',{shrimp:1,c6_0:1});
  const input={commandId:'same-load',displayId:id,action:'load',expectedRevision:s.functionalFacilities.revision};
  assert(functionalCommand(s,input).ok);assert(functionalCommand(s,input).replayed);assert.equal(s.inventory.shrimp,1);assert.equal(availableQuantity(s,'shrimp'),0);
  assert(!cmd(s,id,'load').ok);tickFunctionalFacilities(s,239);assert.equal(functionalUnit(s,id).phase,'growing');assert(cmd(s,id,'pause').ok);tickFunctionalFacilities(s,10000);assert.equal(functionalUnit(s,id).elapsed,239);
  assert(!decorate(s,{commandId:'store-batch',action:'store',displayId:id},{theme}).ok);assert.equal(s.placedItems.length,1);
  const snapshot=JSON.parse(JSON.stringify(s));hydrateFunctionalFacilities(snapshot);assert.equal(functionalUnit(snapshot,id).elapsed,239);assert(cmd(snapshot,id,'resume').ok);
  tickFunctionalFacilities(snapshot,1);assert.equal(functionalUnit(snapshot,id).phase,'ready');assert(!cmd(snapshot,id,'load').ok);
  const harvest={commandId:'same-harvest',displayId:id,action:'harvest',expectedRevision:snapshot.functionalFacilities.revision};
  assert(functionalCommand(snapshot,harvest).ok);assert(functionalCommand(snapshot,harvest).replayed);assert.equal(snapshot.inventory.shrimp,4);assert.equal(snapshot.economy.playerGoods.shrimp||0,0);assert.equal(snapshot.coins,0);
  assert(!cmd(snapshot,id,'harvest').ok);assert.equal(snapshot.inventory.shrimp,4);validateState(snapshot,theme);
 });
 test(theme+' irrigation protects player plots, respects busy NPCs, uses a charge on contact only and does not shorten growth',()=>{
  const s=fresh(theme),p=farmPosition(s),id=place(s,'c14_6',p.x,p.y);assert(irrigationConnected(s,id));s.inventory.c6_5=1;assert(cmd(s,id,'load').ok);
  for(let i=0;i<4;i++)Object.assign(s.plots[i],{stage:2,crop:'wheat',growth:0});s.plots[1].playerTended=true;s.journey.completed.harvest=false;
  assert(cmd(s,id,'configure',{targets:[0,1,2,3],enabled:true}).ok);
  const claims=new Map([[2,'npc']]),hooks={claimPlot:(i,owner)=>{if(claims.has(i)&&claims.get(i)!==owner)return false;claims.set(i,owner);return true;},releasePlot:(i,owner)=>{if(claims.get(i)===owner)claims.delete(i);}};
  tickFunctionalFacilities(s,2,hooks);assert.equal(functionalUnit(s,id).currentPlot,3);assert.equal(functionalUnit(s,id).charges,8);assert.equal(claims.get(3),'facility:'+id);assert.equal(s.plots[3].stage,2);
  assert(!decorate(s,{commandId:'move-water',action:'move',displayId:id,x:800,y:560,rotation:0},{theme}).ok);
  tickFunctionalFacilities(s,1,hooks);assert.equal(s.plots[3].stage,3);assert.equal(s.plots[3].growth,0);assert.equal(functionalUnit(s,id).charges,7);assert(!claims.has(3));assert.equal(s.plots[0].stage,2);assert.equal(s.plots[1].stage,2);assert.equal(s.plots[2].stage,2);
  tickCrops(s,179);assert.equal(s.plots[3].stage,3);tickCrops(s,1);assert.equal(s.plots[3].stage,4);assert.equal(s.plots[3].growth,CROPS.wheat.seconds);assert.equal(s.inventory.wheat,0);
  validateState(s,theme);
 });
}
test('tea is one real serving per NPC, need-based action, supply exhaustion, dedupe and no AI API call',()=>{
 const s=fresh('pixel'),id=place(s,'c1_9');s.inventory.tea=4;s.inventory.wood=1;reserveResources(s,'party:tea',{tea:1});assert(cmd(s,id,'load').ok);assert.equal(s.inventory.tea,1);tickFunctionalFacilities(s,12);assert.equal(functionalUnit(s,id).servings,3);
 needs(0,s).hunger=25;const option=purposeOptions(0,s,RESIDENTS[0],30).find(o=>o.facilityId===id);assert(option);assert.equal(option.buildingId,null);assert.equal(option.action,'eat');
 const d={...option,operationId:'test-tea-npc'},before=needs(0,s).hunger;commitWork(0,d,s,30);assert.equal(needs(0,s).hunger,before+22);assert.equal(functionalUnit(s,id).servings,2);
 commitWork(0,d,s,30);assert.equal(functionalUnit(s,id).servings,2);assert.equal(needs(0,s).hunger,before+22);
 s.npcPresence=[{id:0,facilityId:id}];needs(1,s).hunger=25;assert(!purposeOptions(1,s,RESIDENTS[1],30).some(o=>o.facilityId===id));assert(!cmd(s,id,'clear').ok);s.npcPresence=[];
 for(let i=1;i<=2;i++){needs(i,s).hunger=25;commitWork(i,{...option,operationId:'test-tea-npc-'+i},s,31+i);}
 assert.equal(functionalUnit(s,id).servings,0);assert.equal(functionalUnit(s,id).phase,'idle');assert(!purposeOptions(0,s,RESIDENTS[0],40).some(o=>o.facilityId===id));assert.equal(s.inventory.tea,1);assert.equal(s.coins,0);
});
test('clear and storage are explicit, consumed inputs are never returned, the facility and personal ownership conserve',()=>{
 const s=fresh('pixel');s.inventory.c6_8=1;s.economy.playerGoods.c6_8=1;const id=place(s,'c6_8');s.inventory.shrimp=1;s.inventory.c6_0=1;assert(cmd(s,id,'load').ok);
 assert(!decorate(s,{commandId:'deny-store',action:'store',displayId:id},{theme:'pixel'}).ok);
 assert(cmd(s,id,'clear').ok);assert.equal(s.inventory.shrimp,0);assert.equal(s.inventory.c6_0,0);
 assert(decorate(s,{commandId:'safe-store',action:'store',displayId:id},{theme:'pixel'}).ok);assert.equal(s.inventory.c6_8,1);assert.equal(s.economy.playerGoods.c6_8,1);assert(!s.functionalFacilities.units[id]);validateState(s,'pixel');
});
test('changed irrigation crop/stage releases its claimed plot without losing a charge',()=>{
 const s=fresh('pixel'),p=farmPosition(s),id=place(s,'c14_6',p.x,p.y);s.inventory.c6_5=1;Object.assign(s.plots[2],{stage:2,crop:'wheat'});assert(cmd(s,id,'load').ok);assert(cmd(s,id,'configure',{targets:[2],enabled:true}).ok);const releases=[];
 const hooks={claimPlot:()=>true,releasePlot:(i,owner)=>releases.push([i,owner])};tickFunctionalFacilities(s,1,hooks);s.plots[2].crop='tomato';tickFunctionalFacilities(s,10,hooks);assert.equal(functionalUnit(s,id).charges,8);assert.equal(s.plots[2].stage,2);assert.equal(releases.length,1);
});
test('worn device needs real maintenance, invalid and stale commands leave stock intact, receipts are bounded',()=>{
 const s=fresh('pixel'),id=place(s,'c6_8');s.inventory.shrimp=30;s.inventory.c6_0=30;
 for(let i=0;i<12;i++){assert(cmd(s,id,'load').ok);tickFunctionalFacilities(s,240);assert(cmd(s,id,'harvest').ok);}
 assert.equal(functionalUnit(s,id).condition,4);assert(!cmd(s,id,'load').ok);s.inventory.seaweed=1;s.inventory.sand=1;reserveResources(s,'keep:sand',{sand:1});assert(!cmd(s,id,'clean').ok);delete s.resourceLedger.reservations['keep:sand'];assert(cmd(s,id,'clean').ok);assert.equal(functionalUnit(s,id).condition,100);assert.equal(s.inventory.sand,0);
 const before=JSON.stringify(s);assert(!functionalCommand(s,{commandId:'stale',displayId:id,action:'load',expectedRevision:0}).ok);assert.equal(JSON.stringify(s),before);
 for(let i=0;i<220;i++)assert(cmd(s,id,'clear').ok);assert.equal(Object.keys(s.functionalFacilities.receipts).length,200);assert.equal(s.functionalFacilities.history.length,80);validateState(s,'pixel');
});
test('new facility purpose is visible, irrigation is placed rather than destroyed for unrelated seeds',()=>{
 const s=fresh('pixel');s.inventory.c14_6=1;assert.equal(itemUse('c14_6',s).route,'placement');assert.equal(s.inventory.c14_6,1);assert.equal(s.inventory.seed,0);
 assert.equal(itemPurpose('c14_6',s).primary.action,'布置功能设施');assert(itemPurpose('c6_0',s).facilityUses.some(x=>x.item==='c6_8'));assert(itemPurpose('tea',s).facilityUses.some(x=>x.item==='c1_9'));
});
test('real disk reload retains remaining time, rejects corrupt facilities and a fresh restart clears them',async()=>{
 const theme='origami',s=fresh(theme),id=place(s,'c6_8');s.inventory.shrimp=1;s.inventory.c6_0=1;assert(cmd(s,id,'load').ok);tickFunctionalFacilities(s,123);
 const directory=await mkdtemp(join(tmpdir(),'hd-v45-')),store=createSaveStore({directory}),doc=await store.open(theme,{legacyState:s,clientId:'facility'});
 const reopened=await createSaveStore({directory}).current(theme);assert.equal(functionalUnit(reopened.state,id).elapsed,123);assert.equal(reopened.state.inventory.shrimp,0);validateState(reopened.state,theme);
 for(const change of [u=>u.servings=4,u=>u.item='tea',u=>u.phase='brewing',u=>u.targets=[9],u=>u.condition=-1]){const bad=structuredClone(s);change(functionalUnit(bad,id));assert(!validFunctionalFacilities(bad));assert.throws(()=>validateState(bad,theme));}
 const reset=createZeroState(reopened.state);assert.equal(reset.functionalFacilities,undefined);assert.equal(reset.inventory.shrimp||0,0);assert.equal((reset.placedItems||[]).length,0);
});
