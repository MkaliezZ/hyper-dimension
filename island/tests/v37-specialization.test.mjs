import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ALL_RECIPES,commitRecipe,resourceLoot} from '../src/contentCatalog.js';
import {harvestPlot} from '../src/farming.js';
import {trackJourney,hydrateJourney} from '../src/journey.js';
import {refreshAchievements,trackHostedAchievement} from '../src/achievements.js';
import {transact,reserveParty,completeParty,recordPlayerGoods,deliverSpecializationOrder,townDailyBudget,tickTownEconomy} from '../src/economy.js';
import {nextOperationId,reserveResources,releaseResources} from '../src/resourceLedger.js';
import {SPECIALIZATIONS,hydrateSpecialization,specializationView,specializationMetrics,specializationMoment,claimSpecialization,chooseSpecialization,specializationOffer,acceptSpecializationCommission,trackSpecialization,specializationDelivery,validSpecialization} from '../src/specialization.js';
import {validateState,createSaveStore} from '../server/saveStore.mjs';
import {cleanJourneyBrief} from '../server/stewardProtocol.mjs';
const fresh=()=>{const s=hydrateTown(createZeroState());hydrateJourney(s);refreshAchievements(s);hydrateSpecialization(s);return s};
function funded(s){s.coins=5000;for(const f of Object.values(s.facilities)){f.upgrades=4;f.quality=95;f.condition=100;}}
function host(s,kind='night'){
 if(kind==='night'){s.inventory.lantern++;s.inventory.wheat+=2;s.partyInvites={0:true,2:true};const p=reserveParty(s);assert(p);assert(completeParty(s,3));s.activities++;trackJourney(s,'party',{kind,eventId:p.id});}
 else{const id=kind+'-'+s.day;assert(transact(s,{income:30,category:'party',receipt:id+':reward'}));trackHostedAchievement(s,{id,template:kind,day:s.day});trackJourney(s,'party',{kind});}
}
function craft(s,r,quality=80){for(const [id,n] of Object.entries(r.cost))s.inventory[id]=(s.inventory[id]||0)+n;const command=nextOperationId(s,'player:craft')+':result';assert(commitRecipe(r,s,{commandId:command}));recordPlayerGoods(s,r.item,1);trackJourney(s,'craft',{item:r.item,building:r.building,quality,commandId:command});return command;}
function harvest(s,id){s.plots[0]={crop:id,stage:4,growth:999};const r=harvestPlot(s,0);recordPlayerGoods(s,id,r.amount);trackJourney(s,'harvest',{item:id,amount:r.amount});}
function readyCommission(path='artisan'){const s=fresh();funded(s);host(s);assert(chooseSpecialization(s,path).ok);const o=specializationOffer(s);assert(acceptSpecializationCommission(s,o.id,o.item).ok);return {s,o,r:ALL_RECIPES.find(r=>r.item===o.item)};}
test('zero start and NPC production cannot open a career or give personal progression',()=>{
 const s=fresh(),coins=s.coins,stock=structuredClone(s.inventory);assert(!specializationView(s).unlocked);assert(!chooseSpecialization(s,'artisan').ok);assert(!specializationOffer(s));
 assert.equal(s.coins,coins);assert.deepEqual(s.inventory,stock);
 funded(s);const r=ALL_RECIPES[0];for(const [id,n] of Object.entries(r.cost))s.inventory[id]=n;assert(commitRecipe(r,s));resourceLoot('greenhouse',s,2,'herb');
 assert.equal(specializationMetrics(s,'artisan').designs,0);assert.equal(specializationMetrics(s,'garden').harvest,0);assert.equal(specializationMetrics(s,'artisan').days,0);
});
test('opening requires a settled hosted receipt, not an activity counter or model promise',()=>{
 const s=fresh();s.activities=10;s.journey.stats.parties=10;assert(!specializationView(s).unlocked);
 funded(s);host(s);assert(specializationView(s).unlocked);assert(chooseSpecialization(s,'garden').ok);validateState(s);
});
test('all 25 workshops map once to a direction and five ranks remain sequential',()=>{
 assert.equal(new Set(SPECIALIZATIONS.flatMap(p=>p.buildings)).size,25);assert.equal(SPECIALIZATIONS.flatMap(p=>p.buildings).length,25);
 const s=fresh();funded(s);host(s);assert.equal(claimSpecialization(s,'artisan',2).ok,false);
 for(let day=1;day<=12;day++){s.day=day;hydrateSpecialization(s);
  for(const path of SPECIALIZATIONS){const r=ALL_RECIPES.find(r=>path.buildings.includes(r.building));craft(s,r,95.5);}
  if(day>1)host(s,day%2?'night':'fishing');
  for(const id of ['wheat','tomato','pumpkin','carrot','corn','potato','rice'])for(let n=0;n<2;n++)harvest(s,id);
 }
 for(const path of SPECIALIZATIONS)for(const r of ALL_RECIPES.filter(r=>path.buildings.includes(r.building)&&(path.id==='artisan'?r.index<8:path.id==='garden'?r.index<8:true)).slice(0,path.id==='artisan'?64:path.id==='garden'?24:40))craft(s,r,95.5);
 // Six stock-backed daily celebration commissions, with fixtures for material availability.
 for(let i=0;i<6;i++){s.day=13+i;hydrateSpecialization(s);assert(chooseSpecialization(s,'host').ok);const o=specializationOffer(s);assert(acceptSpecializationCommission(s,o.id,o.item).ok);craft(s,ALL_RECIPES.find(r=>r.item===o.item));assert(deliverSpecializationOrder(s).ok);}
 for(const kind of ['market','couture','fireworks'])host(s,kind);
 const cash=s.coins,stock=structuredClone(s.inventory);
 for(const path of SPECIALIZATIONS)for(let rank=1;rank<=5;rank++){assert(specializationMoment(s,path.id),path.id+' rank '+rank+' '+JSON.stringify(specializationMetrics(s,path.id)));assert(claimSpecialization(s,path.id,rank).ok);assert.equal(claimSpecialization(s,path.id,rank).ok,false);}
 assert.equal(Object.keys(s.specialization.awards).length,15);assert.equal(s.coins,cash);assert.deepEqual(s.inventory,stock);validateState(s);
});
test('manual activity days count once, survive switching, and never use wall-clock days',()=>{
 const s=fresh();funded(s);host(s);craft(s,ALL_RECIPES[0]);craft(s,ALL_RECIPES[0]);assert.equal(specializationMetrics(s,'artisan').days,1);
 assert(chooseSpecialization(s,'artisan').ok);assert.equal(chooseSpecialization(s,'garden').ok,false);assert(chooseSpecialization(s,'artisan').replayed);
 tickTownEconomy(s,899);assert.equal(s.day,1);tickTownEconomy(s,1);assert.equal(s.day,2);
 assert(chooseSpecialization(s,'garden').ok);assert.equal(specializationMetrics(s,'artisan').days,1);validateState(s);
});
test('old personal crafts and wheat remain, ambiguous NPC history and old grades are not invented',()=>{
 const s=fresh();delete s.specialization;s.journey.stats.crafted={lantern:4};s.journey.stats.harvested=8;s.achievementBook.crafted={lantern:true};s.craftHistory.recipe_pottery=9;
 const b=hydrateSpecialization(s);assert.equal(b.harvested.wheat,8);assert.equal(specializationMetrics(s,'artisan').designs,1);assert.equal(specializationMetrics(s,'artisan').quality,0);assert.equal(specializationMetrics(s,'artisan').days,0);validateState(s);
});
test('commission is fixed per day and across reload, with no switch/accept reward reroll',()=>{
 const {s,o}=readyCommission();assert.equal(s.specialization.commission.item,o.item);assert.equal(acceptSpecializationCommission(s,o.id,o.item).ok,false);
 const reopened=JSON.parse(JSON.stringify(s));hydrateSpecialization(reopened);assert.deepEqual(reopened.specialization.commission,s.specialization.commission);assert.equal(specializationOffer(reopened),null);
 assert.equal(chooseSpecialization(s,'host').ok,false);validateState(reopened);
});
test('old stock, NPC crafts and a replayed pre-acceptance quality receipt cannot satisfy a new order',()=>{
 const s=fresh();funded(s);host(s);chooseSpecialization(s,'artisan');const o=specializationOffer(s),r=ALL_RECIPES.find(r=>r.item===o.item),before=craft(s,r,90);
 assert(acceptSpecializationCommission(s,o.id,o.item).ok);trackSpecialization(s,'craft',{item:r.item,quality:90,commandId:before});
 assert.equal(s.specialization.commission.production,null);assert(!specializationDelivery(s).ok);
 for(const [id,n] of Object.entries(r.cost))s.inventory[id]=(s.inventory[id]||0)+n;assert(commitRecipe(r,s,{commandId:nextOperationId(s,'npc:craft')+':result'}));
 assert(!deliverSpecializationOrder(s).ok);validateState(s);
});
test('low quality stays pending; qualified real craft delivers exactly once and consumes personal credit',()=>{
 const {s,o,r}=readyCommission();craft(s,r,o.quality-1);assert(!specializationDelivery(s).ok);craft(s,r,o.quality+.5);
 const cash=s.coins,qty=s.inventory[o.item],credit=s.economy.playerGoods[o.item],budget=townDailyBudget(s).total;
 assert(deliverSpecializationOrder(s).ok);assert.equal(s.coins,cash+o.net);assert.equal(s.inventory[o.item],qty-1);assert.equal(s.economy.playerGoods[o.item],credit-1);assert.equal(s.specialization.deliveries.artisan,1);
 assert(!deliverSpecializationOrder(s).ok);assert.equal(s.coins,cash+o.net);assert.equal(townDailyBudget(s).total,budget);assert.equal(s.economy.cashLedger.at(-1).category,'career_order');validateState(s);
});
test('other plans retain reserved stock and expired orders never spend or pay',()=>{
 const {s,o,r}=readyCommission();craft(s,r);reserveResources(s,'another-plan',{[o.item]:s.inventory[o.item]});const snapshot=structuredClone(s.inventory),coins=s.coins;
 assert(!deliverSpecializationOrder(s).ok);assert.deepEqual(s.inventory,snapshot);assert.equal(s.coins,coins);
 releaseResources(s,'another-plan');s.day++;assert(!deliverSpecializationOrder(s).ok);assert.equal(s.specialization.history.at(-1).status,'expired');assert.equal(s.coins,coins);assert.deepEqual(s.inventory,snapshot);validateState(s);
});
test('offers vary across 15-minute days, stay gated, and use existing catalog price without passive bonus',()=>{
 const s=fresh();funded(s);host(s);chooseSpecialization(s,'artisan');const seen=new Set(),budget=townDailyBudget(s).total;
 for(let day=1;day<=30;day++){s.day=day;const o=specializationOffer(s);seen.add(o.item);assert.equal(o.rank,0);assert.equal(o.reward,ALL_RECIPES.find(r=>r.item===o.item).price);assert(o.net>0&&o.net<=16);assert.equal(townDailyBudget(s).total,budget);}
 assert(seen.size>=10);
});
test('partial qualified order and permanent title round-trip through independent disk stores',async()=>{
 const {s,o,r}=readyCommission();craft(s,r,90);validateState(s);
 const directory=await mkdtemp(join(tmpdir(),'hd-v37-')),store=createSaveStore({directory});await store.open('pixel',{legacyState:s});
 const restored=(await createSaveStore({directory}).current('pixel')).state;assert.equal(restored.specialization.commission.production.quality,90);assert(deliverSpecializationOrder(restored).ok);
 const old=await store.current('pixel');await store.save('pixel',{state:restored,expectedVersion:old.version});const final=(await store.current('pixel')).state;
 assert.equal(final.specialization.commission.status,'delivered');assert(!deliverSpecializationOrder(final).ok);assert.equal(final.specialization.deliveries.artisan,1);
});
test('forged ranks, prices, quality claims, duplicate history and delivery totals cannot overwrite a save',()=>{
 const {s,o,r}=readyCommission();craft(s,r);assert(deliverSpecializationOrder(s).ok);validateState(s);
 for(const mutate of [
  x=>x.specialization.deliveries.artisan++,
  x=>x.specialization.commission.reward+=100,
  x=>x.specialization.commission.production.command='npc:craft:1:result',
  x=>x.specialization.quality[r.item].value=100,
  x=>x.specialization.history.push({...x.specialization.commission}),
  x=>x.specialization.selectedDay=0,
  x=>x.specialization.days.artisan.push(s.day)
 ]){const bad=structuredClone(s);mutate(bad);assert.equal(validSpecialization(bad),false);assert.throws(()=>validateState(bad));}
});

test('quality cannot be rewritten by replaying a prior craft, and nonplayer receipts do not add work days',()=>{
 const {s,o,r}=readyCommission();const command=craft(s,r,80),before=structuredClone(s.specialization),receipt=structuredClone(s.resourceLedger.receipts[command]);
 trackSpecialization(s,'craft',{item:r.item,quality:100,commandId:command});assert.deepEqual(s.specialization,before);assert.deepEqual(s.resourceLedger.receipts[command],receipt);
 s.day++;hydrateSpecialization(s);const days=s.specialization.days.artisan.length;
 trackSpecialization(s,'craft',{item:r.item,quality:100,commandId:'npc:craft:999:result'});assert.equal(s.specialization.days.artisan.length,days);validateState(s);
});
test('all real field crops including medicinal herbs advance only personal harvest goals',()=>{
 const s=fresh();harvest(s,'herb');harvest(s,'wheat');assert.equal(specializationMetrics(s,'garden').species,2);assert.equal(specializationMetrics(s,'garden').harvest,4);validateState(s);
});
test('continuous commissions remain unique after history truncation beyond sixty days',()=>{
 const {s,o,r}=readyCommission();craft(s,r);assert(deliverSpecializationOrder(s).ok);
 for(let day=2;day<=72;day++){s.day=day;hydrateSpecialization(s);const o=specializationOffer(s);assert(acceptSpecializationCommission(s,o.id,o.item).ok);craft(s,ALL_RECIPES.find(r=>r.item===o.item));assert(deliverSpecializationOrder(s).ok);}
 assert.equal(s.specialization.history.length,60);assert.equal(s.specialization.deliveries.artisan,72);assert(!deliverSpecializationOrder(s).ok);validateState(s);
});

test('steward receives bounded real career guidance and ignores unsupported career IDs',()=>{
 const {s}=readyCommission();const b=cleanJourneyBrief({step:'自由经营',growth:{path:'artisan',name:'匠心工坊',rank:1,next:['品质 50/60','手作 4/10','extra'],commission:s.specialization.commission}});
 assert.equal(b.growth.path,'artisan');assert.equal(b.growth.next.length,2);assert.equal(b.growth.commission.status,'accepted');assert.equal(cleanJourneyBrief({growth:{path:'invented'}}).growth,null);
});
