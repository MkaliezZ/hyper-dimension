import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {DEFAULT_CLOCK,environmentAt,SEASONS} from '../src/environmentClock.js';
import {weatherForEnvironment} from '../src/weatherRules.js';
import {canPlantCrop} from '../src/cropSeasons.js';
import {CROPS} from '../src/farming.js';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {activeWeatherIntervals,gameEnvironment} from '../server/gameEnvironment.mjs';
import {makeWorkshopLevel,createWorkshopState,anglingEquipment,stepWorkshop} from '../src/workshopRules.js';
import {createFishingMatch,fishingBiteWindow,startFishingRound,tickFishing,validFishingMatch} from '../src/fishingRules.js';
import {chooseAction} from './v19-play-helpers.mjs';
import {applyCraftEvent} from '../src/craftGameReplay.js';
import {partyDraftStamp} from '../src/partyPlanning.js';
const base={...DEFAULT_CLOCK,clockId:'weather-fixture',epochMs:1000000,phaseAtEpoch:0};
const atDay=(day,fraction=.45)=>base.epochMs+(day+fraction)*base.dayLengthMs;
const weatherDay=(id,season='spring')=>Array.from({length:30},(_,i)=>i+SEASONS.indexOf(season)*30).find(d=>environmentAt(base,atDay(d)).weather.id===id);
const qa=resolve('qa/v175/season-gameplay');await mkdir(qa,{recursive:true});
async function fixture({weather='clear',season='spring',at=atDay(weatherDay(weather,season)),edit=()=>{}}={}){
 let time=at;const directory=await mkdtemp(resolve(qa,'farm-')),provider=()=>({clock:base,serverNowMs:time}),store=createSaveStore({directory,now:()=>time,environmentProvider:provider});
 const s=hydrateTown(createZeroState());s.freshStartPending=false;s.inventory.seed=3;s.inventory.rod=1;edit(s);let d=(await store.open('pixel',{legacyState:s})).document;
 const current=()=>store.current('pixel');
 const call=async(kind,operation,extra={})=>{d=await current();return store.action('pixel',{kind,operation,requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,day:d.state.day,...extra});};
 const pulse=async(seconds,elapsed=seconds*1000)=>{d=await current();time+=elapsed;const input={state:d.state,expectedVersion:d.version,saveId:randomUUID(),activeSeconds:seconds};return{...await store.save('pixel',input),input};};
 return{store,directory,current,call,pulse,provider,advance:ms=>time+=ms};
}
const finish=r=>({kind:r.ticket.kind,operation:'finish',requestId:r.ticket.requestId,epoch:r.ticket.epoch,sequence:r.ticket.sequence,expectedVersion:r.document.version});

test('one deterministic world weather schedule with 30-day seasons and both beneficial and non-watering winter days',()=>{
 for(const day of [0,29,30,59,60,89,90,119,120])assert.equal(environmentAt(base,atDay(day)).season,SEASONS[Math.floor(day/30)%4]);
 for(const season of SEASONS){const ids=new Set();for(let n=0;n<30;n++){const e=environmentAt(base,atDay(SEASONS.indexOf(season)*30+n));assert.deepEqual(e.weather,weatherForEnvironment(e));assert.deepEqual(environmentAt({...base,revision:2},atDay(SEASONS.indexOf(season)*30+n)).weather,e.weather);ids.add(e.weather.id);}assert(ids.has(season==='winter'?'snow':'rain'));}
});

test('all existing crops have explicit season choices, with four usable winter staples',()=>{
 for(const id of Object.keys(CROPS))assert(SEASONS.some(s=>canPlantCrop(id,s)),id);
 assert.equal(canPlantCrop('strawberry','spring'),true);assert.equal(canPlantCrop('strawberry','winter'),false);
 assert.equal(Object.keys(CROPS).filter(id=>canPlantCrop(id,'winter')).length,4);
});

test('server rejects out-of-season seed reservation even if request forges the environment',async()=>{
 const f=await fixture({season:'winter',edit:s=>s.plots[0]={stage:1,crop:'wheat',growth:0}});
 await assert.rejects(f.call('farm','begin',{index:0,step:'sow',crop:'strawberry',gameEnvironment:{environment:{season:'spring'}}}),e=>e.code==='farm_crop_season');
 const d=await f.current();assert.equal(d.state.inventory.seed,3);assert.equal(Object.keys(d.state.resourceLedger?.reservations||{}).length,0);
 const r=await f.call('farm','begin',{index:0,step:'sow',crop:'carrot'});assert.equal(r.ticket.crop,'carrot');
});

test('rain watering needs accepted active time; reads, zero-time save and offline delay do not water',async()=>{
 const f=await fixture({weather:'rain',edit:s=>s.plots[0]={stage:2,crop:'wheat',growth:0}});await f.call('farm','enable');
 assert.equal((await f.current()).state.plots[0].stage,2);
 let r=await f.pulse(0,900000*120);assert.equal(r.document.state.plots[0].stage,2);
 // Return to a known rain day without granting any time from the clock change.
 const g=await fixture({weather:'rain',edit:s=>s.plots[0]={stage:2,crop:'wheat',growth:0}});await g.call('farm','enable');r=await g.pulse(5);
 assert.equal(r.document.state.plots[0].stage,3);assert.equal(r.document.state.plots[0].wateredBy,'rain');assert.equal(r.document.state.plots[0].growth,5);
 const replay=await g.store.save('pixel',r.input);assert(replay.replayed);assert.equal(replay.document.state.plots[0].growth,5);assert.equal(replay.document.state.inventory.wheat,0);
});

test('weather change partway through an accepted interval applies only the actual rainy part',async()=>{
 let day;for(let d=1;d<89;d++){const before=environmentAt(base,atDay(d-1)).weather,after=environmentAt(base,atDay(d)).weather;if(!before.watersCrops&&after.watersCrops){day=d;break;}}assert(Number.isInteger(day));
 const boundary=atDay(day,0),f=await fixture({at:boundary-5000,edit:s=>s.plots[0]={stage:2,crop:'wheat',growth:0}});await f.call('farm','enable');
 const r=await f.pulse(10);assert.equal(r.document.state.plots[0].stage,3);assert.equal(r.document.state.plots[0].growth,5);
 const parts=activeWeatherIntervals(gameEnvironment(()=>({clock:base}),boundary+5000),10);assert.deepEqual(parts.map(p=>p.seconds),[5,5]);
});

test('rain does not steal an in-flight watering lease and cannot double-complete a manual action',async()=>{
 const f=await fixture({weather:'rain',edit:s=>s.plots[0]={stage:2,crop:'wheat',growth:0}}),r=await f.call('farm','begin',{index:0,step:'water'}),saved=await f.pulse(5);
 assert.equal(saved.document.state.plots[0].stage,2);const done=await f.store.action('pixel',{...finish(r),expectedVersion:saved.document.version});
 assert.equal(done.document.state.plots[0].wateredBy,'manual');assert.equal(done.document.state.plots[0].growth,0);assert.equal((await f.store.action('pixel',finish(r))).replayed,true);
});

test('snow never waters; old cross-season crops still grow and produce exactly one harvest',async()=>{
 const f=await fixture({season:'winter',weather:'snow',edit:s=>{s.plots[0]={stage:2,crop:'tomato',growth:0};s.plots[1]={stage:3,crop:'strawberry',growth:CROPS.strawberry.seconds-5};}});await f.call('farm','enable');
 const r=await f.pulse(5);assert.equal(r.document.state.plots[0].stage,2);assert.equal(r.document.state.plots[1].stage,4);
 const begun=await f.call('farm','begin',{index:1,step:'harvest'});f.advance(2000);const done=await f.store.action('pixel',finish(begun));assert.equal(done.document.state.inventory.strawberry,2);assert.equal(done.document.state.inventory.seed,4);
 assert((await f.store.action('pixel',finish(begun))).replayed);assert.equal((await f.current()).state.inventory.strawberry,2);
});

test('accepted sowing action finishes across a season boundary; only new out-of-season sowing is rejected',async()=>{
 const f=await fixture({at:atDay(30,0)-1000,edit:s=>s.plots[0]={stage:1,crop:'wheat',growth:0}}),r=await f.call('farm','begin',{index:0,step:'sow',crop:'strawberry'});f.advance(2000);
 const d=(await f.store.action('pixel',finish(r))).document;assert.equal(d.state.plots[0].stage,2);assert.equal(d.state.plots[0].crop,'strawberry');assert.equal(d.state.inventory.seed,2);
});

test('ordinary fishing opens with trusted locked rain assistance, independent of client-supplied weather',async()=>{
 for(const weather of ['clear','rain']){const f=await fixture({weather}),r=await f.call('field','begin',{field:'fishing',itemId:'fish',mode:'2',weather:'rain',gameEnvironment:{environment:{weather:{id:'rain'}}}});
 assert.equal(r.ticket.game.state.weather.id,weather);const e=anglingEquipment(r.ticket.game.state);assert.equal(e.castRadius,101+(weather==='rain'?15:0));
 f.advance(900000);const d=await f.current();assert.deepEqual(d.actions.active.game.state.weather,r.ticket.game.state.weather);assert.equal(d.state.inventory.fish,0);}
});

test('rain changes actual catch window and tension in ordinary angling, while old game state keeps its rules',()=>{
 const old=createWorkshopState(makeWorkshopLevel(16,23,2)),rain=structuredClone(old);rain.weather={id:'rain',assist:1};
 for(const s of [old,rain]){s.phase='playing';s.mode='bite';s.biteAt=0;s.t=s.level.strikeWindow+.10;stepWorkshop(s,.01);}
 assert.equal(old.mode,'cast');assert.equal(rain.mode,'bite');
 for(const s of [old,rain]){s.phase='playing';s.mode='fight';s.t=0;s.fightStart=0;s.holding=true;s.tension=.3;s.pointer={...s.level.spots[0]};stepWorkshop(s,.05);}
 assert(rain.tension<old.tension);assert(old.weather===undefined);
});

test('rain fishing-party benefit is deterministic, validated, and does not silently alter old matches',()=>{
 const dry=createFishingMatch(42),rain=createFishingMatch(42,'normal',{id:'rain'});assert(validFishingMatch(dry));assert(validFishingMatch(rain));assert.deepEqual(rain.rounds,dry.rounds);assert(Math.abs(fishingBiteWindow(rain)-1.55)<1e-10);
 for(const m of [dry,rain]){startFishingRound(m);m.current.mode='bite';m.current.modeT=1.25;tickFishing(m,.01);}
 assert.equal(dry.current.mode,'lost');assert.equal(rain.current.mode,'bite');
 const corrupt=createFishingMatch(42,'normal',{id:'rain'});corrupt.weather.assist=999;assert.equal(validFishingMatch(corrupt),false);
});

test('real fishing-party start stores server rain in replay and persists it across reload',async()=>{
 const f=await fixture({weather:'rain',edit:s=>{s.coins=100;Object.assign(s.inventory,{c8_2:1,c16_4:1,c16_2:2,bread:5});for(const n of Object.values(s.npcNeeds))n.hunger=n.energy=n.social=100;}});
 await f.call('commerce','enable');const manage=async(operation,extra={})=>{const d=await f.current(),g=d.state.fishingParty?.draft;return f.call('commerce',operation,{eventId:g?.id||null,eventVersion:g?.version||null,eventStamp:partyDraftStamp(g),...extra});};
 await manage('fish_create',{proposal:{name:'雨中海风',difficulty:'normal'}});for(const npcId of [8,2])await manage('fish_invite',{npcId});
 const d=await f.current(),g=d.state.fishingParty.draft,r=await f.call('fishing','begin',{eventId:g.id,eventVersion:g.version});assert.deepEqual(r.ticket.game.match.weather,{id:'rain',assist:1});assert(validFishingMatch(r.ticket.game.match));assert.equal(r.document.state.coins,90);
 const other=createSaveStore({directory:f.directory,environmentProvider:f.provider});assert.deepEqual((await other.current('pixel')).actions.active.game.match.weather,{id:'rain',assist:1});
});

test('rain-assisted ordinary fishing still requires the real trace and awards its selected fish only once',async()=>{
 const f=await fixture({weather:'rain'});let r=await f.call('field','begin',{field:'fishing',itemId:'fish',mode:'2'});
 await assert.rejects(f.store.action('pixel',finish(r)),e=>e.code==='field_unfinished');
 const game=structuredClone(r.ticket.game);let events=[];
 for(let i=0;i<7000&&!game.state.result;i++){
  const a=chooseAction(game.state);if(a){const e={action:a};applyCraftEvent(game,e);events.push(e);}
  const e={dt:.05};applyCraftEvent(game,e);events.push(e);f.advance(50);
  if(events.length>900||game.state.result){r=await f.store.action('pixel',{...finish(r),operation:'checkpoint',batch:r.ticket.nextBatch,events});events=[];}
 }
 assert.equal(game.state.result?.passed,true);f.advance(Math.ceil(r.ticket.duration*1000));
 const body=finish(r),done=await f.store.action('pixel',body);assert.deepEqual(done.receipt.gain,{fish:1});assert.equal(done.document.state.inventory.fish,1);
 const again=await f.store.action('pixel',body);assert(again.replayed);assert.equal(again.document.state.inventory.fish,1);assert.equal(again.document.state.inventory.rod,1);
});

test('real LAN tenant stores in both styles use the shared authoritative seasonal clock',async()=>{
 let time=atDay(weatherDay('clear','winter'));const directory=await mkdtemp(resolve(qa,'lan-'));
 const service=await createLanHttpServer({directory,port:0,now:()=>time,enrollmentKey:'FICTIONAL-WEATHER'});
 try{
  await service.environmentService.synchronize({...base,source:'central'});
  for(const theme of ['pixel','origami']){
   const account=await service.identities.register({login:'weather_'+theme,password:'fictional-password',name:'雨水试验',islandName:'时令试验岛',avatar:'female_1',theme}),tenant=await service.tenants.get(account.token),s=hydrateTown(createZeroState());
   s.freshStartPending=false;s.worldAppearance=theme;s.inventory.seed=2;s.plots[0]={stage:1,crop:'wheat',growth:0};const d=(await tenant.saves.open(theme,{legacyState:s})).document;
   await assert.rejects(tenant.saves.action(theme,{kind:'farm',operation:'begin',requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,index:0,step:'sow',crop:'tomato',gameEnvironment:{environment:{season:'summer'}}}),e=>e.code==='farm_crop_season');
   assert.equal((await tenant.saves.current(theme)).state.inventory.seed,2);
  }
 }finally{await service.close();}
});
