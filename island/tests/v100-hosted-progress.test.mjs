import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ALL_RECIPES,commitRecipe} from '../src/contentCatalog.js';
import {confirmedHostedEvents,HOSTED_TEMPLATES} from '../src/hostedProgress.js';
import {achievementMetrics,refreshAchievements,trackHostedAchievement} from '../src/achievements.js';
import {hydrateJourney,trackJourney} from '../src/journey.js';
import {transact,recordPlayerGoods,deliverSpecializationOrder} from '../src/economy.js';
import {nextOperationId} from '../src/resourceLedger.js';
import {SPECIALIZATIONS,hydrateSpecialization,specializationUnlocked,specializationGoals,specializationMetrics,specializationRank,specializationView,claimSpecialization,chooseSpecialization,specializationOffer,acceptSpecializationCommission,validSpecialization} from '../src/specialization.js';
import {createSaveStore,validateState} from '../server/saveStore.mjs';
import {fixture,produce,start,finish} from './v92-cooperation-fixture.mjs';
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;hydrateJourney(s);refreshAchievements(s);hydrateSpecialization(s);return s;};
function paid(s,template,id=template+'-'+s.day){assert(transact(s,{income:20,category:'party',receipt:template==='night'?id:id+':reward'}));trackHostedAchievement(s,{id,template,day:s.day});trackJourney(s,'party',{kind:template,eventId:id});}
function craft(s,r){for(const [item,n]of Object.entries(r.cost))s.inventory[item]=(s.inventory[item]||0)+n;const commandId=nextOperationId(s,'player:craft')+':result';assert(commitRecipe(r,s,{commandId}));recordPlayerGoods(s,r.item);trackJourney(s,'craft',{item:r.item,building:r.building,quality:95,commandId});}
function legacyHostFixture(){
 const s=fresh();s.coins=20000;for(const f of Object.values(s.facilities)){f.upgrades=4;f.quality=95;f.condition=100;}
 const host=SPECIALIZATIONS.find(p=>p.id==='host'),recipes=ALL_RECIPES.filter(r=>host.buildings.includes(r.building));
 for(let day=1;day<=12;day++){s.day=day;paid(s,day%2?'night':'fishing');craft(s,recipes[0]);}
 for(const r of recipes.slice(0,40))craft(s,r);
 for(let day=13;day<=18;day++){s.day=day;hydrateSpecialization(s);assert(chooseSpecialization(s,'host').ok);const o=specializationOffer(s);assert(acceptSpecializationCommission(s,o.id,o.item).ok);craft(s,ALL_RECIPES.find(r=>r.item===o.item));assert(deliverSpecializationOrder(s).ok);}
 const metrics=specializationMetrics(s,'host');
 for(let rank=1;rank<=5;rank++)s.specialization.awards['host_'+rank+'@1']={path:'host',rank,definitionVersion:1,title:host.titles[rank-1],day:s.day,metrics:structuredClone(metrics),goals:structuredClone(specializationGoals('host',rank,1))};
 validateState(s);return s;
}
test('all five settled templates open chapter two; entry fees, unpaid logs and future claims do not',()=>{
 for(const template of HOSTED_TEMPLATES){
  const s=fresh(),id=template+'-first';s.achievementBook.hosted[id]={template,day:1};s.economy.cashReceipts[id+':entry']=true;
  assert(!specializationUnlocked(s));assert.equal(achievementMetrics(s).host,0);
  s.economy.cashReceipts[template==='night'?id:id+':reward']=true;
  assert(specializationUnlocked(s));assert(chooseSpecialization(s,'host').ok);assert.equal(achievementMetrics(s).template,1);
  s.achievementBook.hosted[id].day=2;assert(!specializationUnlocked(s));assert.equal(confirmedHostedEvents(s).length,0);
 }
 const s=fresh();s.achievementBook.hosted.cancelled={template:'market',day:1};s.achievementBook.hosted.invalid={template:'invented',day:1};s.economy.cashReceipts['invalid:reward']=true;
 assert.equal(achievementMetrics(s).host,0);assert(!specializationUnlocked(s));
});
test('template achievements use paid unique templates, retain the existing definition and earned snapshots',()=>{
 const s=fresh();for(const [i,template]of HOSTED_TEMPLATES.entries()){paid(s,template,template+'-first');assert.equal(achievementMetrics(s).template,i+1);if(i===1)assert(s.achievementBook.awards['template_2@1']);if(i===2)assert(s.achievementBook.awards['template_3@1']);}
 assert.equal(s.achievementBook.awards['template_5@1'].rarity,'SSR');const awards=structuredClone(s.achievementBook.awards);
 paid(s,'market','market-repeat');assert.equal(achievementMetrics(s).template,5);assert.equal(achievementMetrics(s).host,6);
 s.achievementBook.hosted.unpaid={template:'market',day:1};s.achievementBook.cooperated.unpaid={day:1,proof:[]};assert.equal(achievementMetrics(s).host,6);assert.equal(achievementMetrics(s).cooperate,0);
 refreshAchievements(s,[]);for(const [id,a]of Object.entries(awards))assert.deepEqual(s.achievementBook.awards[id],a);
});
test('earned V1 five-rank host titles survive stricter V2 goals and a separate disk reopen without rewards',async()=>{
 const s=legacyHostFixture(),before=structuredClone(s.specialization.awards),coins=s.coins,inventory=structuredClone(s.inventory);
 assert.equal(specializationRank(s,'host'),5);assert.equal(specializationMetrics(s,'host').templates,2);assert.equal(specializationView(s).paths.find(p=>p.id==='host').rank,5);
 assert.equal(claimSpecialization(s,'host',5).ok,false);assert.deepEqual(s.specialization.awards,before);assert.equal(s.coins,coins);assert.deepEqual(s.inventory,inventory);
 const directory=await mkdtemp(join(tmpdir(),'hd-v100-legacy-'));await createSaveStore({directory}).open('pixel',{legacyState:s});
 const reopened=(await createSaveStore({directory}).current('pixel')).state;assert.equal(specializationRank(reopened,'host'),5);assert.deepEqual(reopened.specialization.awards,before);validateState(reopened);
});
test('mixed V1/V2 titles remain sequential; missing template variety and duplicate versions cannot bypass the goal',()=>{
 const s=legacyHostFixture();for(let rank=3;rank<=5;rank++)delete s.specialization.awards['host_'+rank+'@1'];const earned=structuredClone(s.specialization.awards);
 assert.equal(claimSpecialization(s,'host',3).ok,false);assert.deepEqual(s.specialization.awards,earned);
 paid(s,'market','market-third');assert(claimSpecialization(s,'host',3).ok);assert.equal(s.specialization.awards['host_3@2'].goals.find(g=>g.key==='templates').target,3);
 assert(!claimSpecialization(s,'host',4).ok);paid(s,'couture','couture-fourth');assert(claimSpecialization(s,'host',4).ok);
 assert(!claimSpecialization(s,'host',5).ok);paid(s,'fireworks','fireworks-fifth');assert(claimSpecialization(s,'host',5).ok);assert.equal(specializationRank(s,'host'),5);validateState(s);
 const bad=structuredClone(s);bad.specialization.awards['host_3@1']={...bad.specialization.awards['host_3@2'],definitionVersion:1,goals:specializationGoals('host',3,1)};assert(!validSpecialization(bad));
});
test('server personal title action accepts a mixed-version earned chain once, rejects autosave forgery and restores from disk',async()=>{
 const s=legacyHostFixture();for(let rank=2;rank<=5;rank++)delete s.specialization.awards['host_'+rank+'@1'];
 const directory=await mkdtemp(join(tmpdir(),'hd-v100-authority-')),store=createSaveStore({directory});let d=(await store.open('origami',{legacyState:s})).document;
 d=(await store.action('origami',{kind:'personal',operation:'enable',requestId:randomUUID(),expectedVersion:d.version})).document;
 const input={kind:'personal',operation:'specialization',requestId:randomUUID(),expectedVersion:d.version,day:d.state.day,path:'host',rank:2};
 const result=await store.action('origami',input);assert(result.document.state.specialization.awards['host_2@2']);assert(result.document.state.specialization.awards['host_1@1']);assert.equal(result.document.state.coins,s.coins);assert.deepEqual(result.document.state.inventory,s.inventory);
 const independent=createSaveStore({directory}),replay=await independent.action('origami',input);assert(replay.replayed);assert.equal(specializationRank(replay.document.state,'host'),2);
 const forged=structuredClone(replay.document.state);forged.specialization.awards['host_1@1'].day--;await assert.rejects(independent.save('origami',{state:forged,expectedVersion:replay.document.version}),e=>e.code==='personal_state_conflict');
 assert.equal(specializationRank((await independent.current('origami')).state,'host'),2);
});
for(const theme of ['pixel','origami'])for(const template of HOSTED_TEMPLATES)test(theme+' actual '+template+' server production/invitation/checkpoint/paid settlement opens chapter two and survives reload',async()=>{
 const f=await fixture(template,theme);assert(!specializationUnlocked((await f.current()).state));await produce(f);await start(f);assert(!specializationUnlocked((await f.current()).state));
 await finish(f);const d=await f.current(),events=confirmedHostedEvents(d.state);assert.equal(events.length,1);assert.equal(events[0][1].template,template);assert(specializationUnlocked(d.state));assert.equal(achievementMetrics(d.state).host,1);assert.equal(achievementMetrics(d.state).template,1);
 const reloaded=await f.other().current(theme);assert(reloaded);assert(specializationUnlocked(reloaded.state));assert.equal(achievementMetrics(reloaded.state).host,1);validateState(reloaded.state);
});
