import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {setWorldTheme,setWorldDisplayColliders,worldWalkable,findPath,SLOTS,HARBOR} from '../src/world.js';
import {ALL_RECIPES,RAW_MATERIALS,commitRecipe} from '../src/contentCatalog.js';
import {RAW_IDS_V1,RECIPE_IDS_V1} from '../src/achievementUniverse.js';
import {ACHIEVEMENTS,hydrateAchievements,achievementMetrics,refreshAchievements,trackPlayerAchievement} from '../src/achievements.js';
import {syncWonders,cooperationProof,awardEventWonders,setWonderDisplay,requestWonderDisplay,redeemWonderColor,chooseWonderColor} from '../src/eventWonders.js';
import {wonderPlacements} from '../src/fishingWonderArt.js';
import {validateState,createSaveStore} from '../server/saveStore.mjs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const fixture=JSON.parse(await readFile(new URL('./fixtures/cooperation-v30.json',import.meta.url),'utf8')),live=()=>hydrateTown(structuredClone(fixture.state));
test('archived real parent/child deliveries backfill the monument once without cash or inventory changes',()=>{
 const s=live(),coins=s.coins,stock=structuredClone(s.inventory),g=s.fishingParty.history[0];
 assert.equal(cooperationProof(s,g).length,5);const w=syncWonders(s),a=w.owned.cooperation_monument;
 assert.equal(a.eventId,g.id);assert.equal(a.proof[0].parentRunId,fixture.provenance.parent);assert.equal(a.proof[0].childRunId,fixture.provenance.child);
 const original=structuredClone(w);for(let i=0;i<20;i++)syncWonders(s);assert.deepEqual(w,original);
 assert.equal(s.coins,coins);assert.deepEqual(s.inventory,stock);assert.equal(achievementMetrics(s).cooperate,1);validateState(s);
});
test('model acceptance, mismatched runs, other projects and missing actual action cannot award cooperation',()=>{
 for(const change of [
  s=>{s.fishingParty.history[0].cooperation=[];},
  s=>{for(const e of s.fishingParty.history[0].cooperation)e.childRunId='hd-child-'+ '0'.repeat(32);},
  s=>{s.taskActionReceipts={};},
  s=>{for(const t of s.agentTaskLedger)t.evidence=[];},
  s=>{for(const c of s.recruitment.history)c.projectId='other';}
 ]){
  const s=live();change(s);delete s.eventWonders;syncWonders(s);assert(s.eventWonders.owned.seashell_cup);assert(!s.eventWonders.owned.cooperation_monument);
 }
 const s=live();delete s.eventWonders;const g=s.fishingParty.history[0];delete s.economy.cashReceipts[g.id+':entry'];assert.equal(awardEventWonders(s,g).ok,false);assert(!s.eventWonders);
});
test('five marks buy each permanent color once, selection is free, insufficient marks cannot change ownership',()=>{
 const s=live(),w=syncWonders(s),a=w.owned.seashell_cup;
 const before=structuredClone(w);assert.equal(redeemWonderColor(s,'seashell_cup','violet').ok,false);assert.deepEqual(w,before);
 a.marks=5;assert(redeemWonderColor(s,'seashell_cup','violet').ok);assert.equal(a.marks,0);assert.equal(a.color,1);
 assert(redeemWonderColor(s,'seashell_cup','violet').replayed);assert.equal(a.marks,0);assert(chooseWonderColor(s,'seashell_cup','sea'));assert.equal(a.color,0);
 assert(!chooseWonderColor(s,'seashell_cup','coral'));assert(!redeemWonderColor(s,'seashell_cup','wrong').ok);assert(!redeemWonderColor(s,'cooperation_monument','violet').ok);validateState(s);
});
test('museum and plaza can both display, reclaim is local to its wonder, both theme entries remain connected',()=>{
 for(const theme of ['pixel','origami']){setWorldTheme(theme);const s=live();syncWonders(s);setWonderDisplay(s,'seashell_cup');setWonderDisplay(s,'cooperation_monument');
  const places=wonderPlacements(s,SLOTS);assert.equal(places.length,2);setWorldDisplayColliders(places);
  try{
   for(const p of places)assert(!worldWalkable(p.x,p.y));
   for(const slot of SLOTS)assert(findPath(HARBOR.gate,slot.entry).length,theme+' entrance '+slot.id);
   const route=findPath({x:800,y:505},{x:915,y:505});assert(route.length);assert(route.every(p=>worldWalkable(p.x,p.y)));
   setWonderDisplay(s,'seashell_cup',false);assert(s.eventWonders.displays.cooperation_monument);assert.equal(s.eventWonders.displayed,null);validateState(s);
  }finally{setWorldDisplayColliders([]);}
 }
});
test('occupied display requests wait without occupying space, deduplicate and can be cancelled',()=>{
 const s=live(),w=syncWonders(s);assert(requestWonderDisplay(s,'cooperation_monument',true,{canPlace:false}).pending);assert(!w.displays.cooperation_monument);const pending=structuredClone(w.pendingDisplays);
 requestWonderDisplay(s,'cooperation_monument',true,{canPlace:false});assert.deepEqual(w.pendingDisplays,pending);validateState(s);
 requestWonderDisplay(s,'cooperation_monument',false);assert(!w.pendingDisplays.cooperation_monument);
 requestWonderDisplay(s,'cooperation_monument',true,{canPlace:true});assert(w.displays.cooperation_monument);assert(!w.pendingDisplays.cooperation_monument);validateState(s);
});
test('legacy unlocked trophy colors keep their appearance and explicit migration receipt',()=>{
 const s=live();s.eventWonders.owned.seashell_cup.color=1;syncWonders(s);assert(s.eventWonders.owned.seashell_cup.colors.includes('violet'));assert.equal(s.eventWonders.exchanges['seashell_cup:violet'].marks,0);assert.equal(s.eventWonders.exchanges['seashell_cup:violet'].source,'legacy');validateState(s);
});
test('NPC production and owned stock do not grant personal collection or crafting achievements',()=>{
 const s=hydrateTown(createZeroState());for(const m of RAW_MATERIALS)s.inventory[m.id]=20;
 assert(commitRecipe(ALL_RECIPES[0],s));assert.equal(achievementMetrics(s).craft,0);assert.equal(achievementMetrics(s).collect,0);
 for(const id of RAW_IDS_V1.slice(0,10))trackPlayerAchievement(s,'gather',{item:id,amount:1});
 for(const id of RECIPE_IDS_V1.slice(0,10))trackPlayerAchievement(s,'craft',{item:id});
 const view=refreshAchievements(s);assert(view.book.awards['collect_10@1']);assert(view.book.awards['craft_10@1']);assert.equal(view.metrics.craft,10);validateState(s);
});
test('published universes and earned definition snapshots survive enlarged thresholds and retired definitions',()=>{
 const s=hydrateTown(createZeroState());assert.equal(RAW_IDS_V1.length,50);assert.equal(RECIPE_IDS_V1.length,300);
 for(const id of RAW_IDS_V1.slice(0,10))trackPlayerAchievement(s,'harvest',{item:id,amount:1});
 const old=structuredClone(s.achievementBook.awards['collect_10@1']);
 refreshAchievements(s,[{...ACHIEVEMENTS[0],version:2,goal:15}]);assert.deepEqual(s.achievementBook.awards['collect_10@1'],old);assert(!s.achievementBook.awards['collect_10@2']);
 refreshAchievements(s,[]);assert.deepEqual(s.achievementBook.awards['collect_10@1'],old);validateState(s);
});
test('malformed marks, colors, displays, awarded goals and unknown collection IDs are refused by disk validation',()=>{
 const s=live();syncWonders(s);hydrateAchievements(s);
 for(const change of [
  x=>x.eventWonders.owned.cooperation_monument.proof[0].amount=-1,
  x=>x.eventWonders.receipts[x.fishingParty.history[0].id]=false,
  x=>x.eventWonders.owned.seashell_cup.marks=-1,
  x=>x.eventWonders.owned.seashell_cup.color=2,
  x=>x.eventWonders.owned.seashell_cup.rarity='UR',
  x=>x.eventWonders.displays.unknown=true,
  x=>x.achievementBook.collected.unknown=true,
  x=>x.achievementBook.awards['cooperate_1@1'].achieved=0,
  x=>x.achievementBook.unseen.push('missing@1')
 ]){const bad=structuredClone(s);change(bad);assert.throws(()=>validateState(bad));}
});
test('color ownership, both display sites and versioned awards survive independent disk save/reopen',async()=>{
 const s=live();syncWonders(s);s.eventWonders.owned.seashell_cup.marks=5;redeemWonderColor(s,'seashell_cup','violet');setWonderDisplay(s,'seashell_cup');setWonderDisplay(s,'cooperation_monument');
 const directory=await mkdtemp(join(tmpdir(),'hd-v33-')),a=createSaveStore({directory});await a.open('origami',{legacyState:s,clientId:'collections'});
 const b=createSaveStore({directory}),saved=await b.current('origami');assert.equal(saved.state.eventWonders.owned.seashell_cup.color,1);assert(saved.state.eventWonders.displays.cooperation_monument);assert(saved.state.achievementBook.awards['cooperate_1@1']);validateState(saved.state);
});
