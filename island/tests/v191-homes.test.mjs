import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {RESIDENCE_LAYOUTS,homeWalkable} from '../src/residenceLayouts.js';
import {findPath} from '../src/world.js';
import {SEASONS} from '../src/environmentClock.js';
import {canPlantCrop} from '../src/cropSeasons.js';
import {nurseryChallenge,nurserySolved,solveNursery,joineryChallenge,replayJoinery,joinerySolved,evaluateHomeActivity} from '../src/homeActivities.js';

test('each calibrated room has connected furniture approaches without crossing solid furniture',()=>{
  assert.notDeepEqual(RESIDENCE_LAYOUTS[0].floor,RESIDENCE_LAYOUTS[1].floor);
  for(const layout of Object.values(RESIDENCE_LAYOUTS))for(const from of [layout.entry,...layout.zones.map(z=>z.entry)])for(const zone of layout.zones){
    assert(homeWalkable(layout,zone.entry.x,zone.entry.y),zone.name);
    const path=findPath(from,zone.entry,(x,y)=>homeWalkable(layout,x,y),10);
    assert(path.length||Math.hypot(from.x-zone.entry.x,from.y-zone.entry.y)<15,layout.name+' '+zone.id);
    let previous=from;for(const point of path){for(let t=0;t<=1;t+=.1)assert(homeWalkable(layout,previous.x+(point.x-previous.x)*t,previous.y+(point.y-previous.y)*t),layout.name+' route crossed furniture');previous=point;}
  }
});
test('seasonal nursery challenges are solvable, use actual seasonal crops, and reject changed clues',()=>{
  const layouts=new Set();
  for(const season of SEASONS)for(let day=1;day<=40;day++){
    const c=nurseryChallenge(day,season),solved=solveNursery(c);assert(solved);assert(nurserySolved(c,solved));assert.equal(new Set(c.crops).size,4);assert(c.crops.every(id=>canPlantCrop(id,season)));
    const bad=[...solved],i=c.givens.findIndex(v=>v!==null);bad[i]=(bad[i]+1)%4;assert(!nurserySolved(c,bad));assert(!nurserySolved(c,c.givens));layouts.add(c.givens.join(','));
  }
  assert(layouts.size>100);assert.equal(evaluateHomeActivity({homeId:0,season:'bogus',board:[]},1),null);
});
test('wood pictures vary but always have a legal solution, and illegal/replayed fabricated moves cannot complete them',()=>{
  const layouts=new Set();for(let day=1;day<=120;day++){
    const c=joineryChallenge(day),moves=[...c.scramble].reverse().join('');assert(!joinerySolved(c.board));assert(joinerySolved(replayJoinery(c,moves)));layouts.add(c.board.join(','));
    assert.equal(replayJoinery(c,'8'),null);assert.equal(replayJoinery(c,'0'.repeat(2001)),null);
  }
  assert(layouts.size>100);assert.equal(evaluateHomeActivity({homeId:100,moves:''},1),null);
});
test('home records commit once, survive a new store and reject forged autosaves without changing cash or inventory',async()=>{
  await mkdir('qa/v191',{recursive:true});const directory=await mkdtemp(resolve('qa/v191/home-book-'));
  const store=createSaveStore({directory}),state=hydrateTown(createZeroState());state.freshStartPending=false;
  let {document}=await store.open('pixel',{legacyState:state,protect:true});
  document=(await store.action('pixel',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:document.version})).document;
  // An old personal snapshot has no homeActivities field: first new action must migrate naturally.
  assert(!Object.hasOwn(document.actions.personal.snapshot,'homeActivities'));
  const before={coins:document.state.coins,inventory:structuredClone(document.state.inventory)},c=nurseryChallenge(document.state.day,'spring');
  const input={kind:'personal',operation:'home_activity',homeId:0,season:'spring',board:solveNursery(c),day:document.state.day,expectedVersion:document.version,requestId:randomUUID()};
  const result=await store.action('pixel',input);document=result.document;assert.equal(result.receipt.cashDelta,0);assert.deepEqual(result.receipt.stockDelta,{});
  const again=await createSaveStore({directory}).action('pixel',input);assert(again.replayed);assert.equal(again.document.state.homeActivities[0].completedDays,1);
  await assert.rejects(store.action('pixel',{...input,board:Array(16).fill(0)}),e=>e.code==='action_id_conflict');
  const fake=structuredClone(document.state);fake.homeActivities[0].completedDays=999;
  await assert.rejects(store.save('pixel',{state:fake,expectedVersion:document.version}),e=>e.code==='personal_state_conflict');
  const wood=joineryChallenge(document.state.day);
  const saved=await store.action('pixel',{kind:'personal',operation:'home_activity',homeId:1,moves:[...wood.scramble].reverse().join(''),day:document.state.day,expectedVersion:document.version,requestId:randomUUID()});
  const restarted=await createSaveStore({directory}).current('pixel');assert.equal(restarted.state.homeActivities[1].completedDays,1);assert.equal(restarted.state.homeActivities[0].last.season,'spring');
  assert.equal(restarted.state.coins,before.coins);assert.deepEqual(restarted.state.inventory,before.inventory);
  const bad={kind:'personal',operation:'home_activity',homeId:1,moves:'',day:restarted.state.day,expectedVersion:restarted.version,requestId:randomUUID()};
  await assert.rejects(store.action('pixel',bad),e=>e.code==='personal_unavailable');assert.equal((await store.current('pixel')).version,saved.document.version);
});
