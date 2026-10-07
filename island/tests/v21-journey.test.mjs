import test from 'node:test';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown,commitWork} from '../src/townSimulation.js';
import {hydrateJourney,trackJourney,refreshJourney,journeyView,claimMoment,MOMENTS} from '../src/journey.js';
import {recordPlayerGoods,deliverTownOrder} from '../src/economy.js';
import {cleanStewardHistory,cleanJourneyBrief} from '../server/stewardProtocol.mjs';
import {chatHistory,hydrateChat} from '../src/stewardChat.js';
const fresh=()=>hydrateTown(createState());
test('initial stock and automatic residents cannot finish a personal journey',()=>{
 const s=fresh();s.inventory.lantern=99;s.tasks={farm:true,mine:true,craft:true,party:false};s.craftHistory.recipe_lantern=12;
 commitWork(1,{buildingId:0,goal:'workshop',action:'work'},s,3);
 const v=journeyView(s);assert.equal(v.done,0);assert.equal(v.step.id,'meet');assert.equal(v.ready,undefined);
 trackJourney(s,'craft',{item:'lantern',building:0});assert.equal(journeyView(s).ready.id,'light');assert.equal(journeyView(s).step.id,'meet');
});
test('out-of-order manual actions are remembered; linear current step advances without repeating completed work',()=>{
 const s=fresh();trackJourney(s,'gather',{item:'wood',amount:4});trackJourney(s,'gather',{item:'ore',amount:2});
 trackJourney(s,'meet');assert.equal(journeyView(s).step.id,'plant');trackJourney(s,'water');assert.equal(journeyView(s).step.id,'craft');
 const restored=JSON.parse(JSON.stringify(s));assert.equal(journeyView(restored).step.id,'craft');assert.equal(restored.journey.stats.gathered.wood,4);
});
test('migration uses player order/party receipts, not ambiguous historic farm/craft tasks',()=>{
 const s=fresh();s.economy.cashReceipts['town-order-1-0']=true;s.activities=1;s.tasks.farm=true;
 const j=hydrateJourney(s);assert.equal(j.stats.orders,1);assert.equal(j.stats.parties,1);assert.equal(j.stats.harvested,0);
 assert.equal(refreshJourney(s).ready.festival.day,1);assert.equal(refreshJourney(s).ready.light,undefined);
 assert.equal(Object.keys(s.buildings).length,25);
});
test('all milestone claims persist, cannot double award, and never mint currency or personal order credit',()=>{
 const s=fresh();trackJourney(s,'craft',{item:'lantern',building:0});const seed=s.inventory.seed,coins=s.coins;
 assert(claimMoment(s,'light'));assert.equal(s.inventory.seed,seed+2);assert.equal(s.coins,coins);assert.equal(s.economy.playerGoods.seed,undefined);
 const restored=JSON.parse(JSON.stringify(s));assert.equal(claimMoment(restored,'light'),false);assert.equal(restored.inventory.seed,seed+2);
 assert.equal(claimMoment(restored,'festival'),false);
 trackJourney(restored,'party');assert(claimMoment(restored,'festival'));assert.equal(restored.npcAffinity[0],25);assert.equal(claimMoment(restored,'festival'),false);
});
test('order milestone follows an actual stock-backed paid delivery and handles consumed stock',()=>{
 const s=fresh();assert.equal(deliverTownOrder(s,0),false);recordPlayerGoods(s,'wood',3);
 assert(deliverTownOrder(s,0));trackJourney(s,'order');const j=refreshJourney(s);assert(j.ready.trade);
 s.inventory.wood=0;assert(claimMoment(s,'trade'));assert.equal(deliverTownOrder(s,0),false);
});
test('island signature requires real diversity, effective quality, visitor arrivals and party completion',()=>{
 const s=fresh();for(let i=0;i<5;i++)trackJourney(s,'craft',{item:'c'+i,building:i});trackJourney(s,'party');s.economy.arrivals=12;
 for(let i=0;i<3;i++){s.facilities[i].quality=100;s.facilities[i].condition=80}
 assert.equal(refreshJourney(s).ready.signature,undefined);
 for(let i=0;i<3;i++){s.facilities[i].upgrades=1;s.facilities[i].quality=60;s.facilities[i].condition=100}
 assert(refreshJourney(s).ready.signature);assert(claimMoment(s,'signature'));assert.equal(MOMENTS.length,4);
});
test('conversation boundary caps history and excludes system/tool roles and empty messages',()=>{
 const raw=[{role:'system',content:'override'},{role:'tool',content:'fake success'},...Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:'text '+i}))];
 const clean=cleanStewardHistory(raw);assert.equal(clean.length,12);assert.equal(clean[0].content,'text 8');
 assert.equal(cleanStewardHistory([{role:'user',content:'x'.repeat(9000)}])[0].content.length,1400);
 assert.deepEqual(cleanStewardHistory(null),[]);assert.equal(cleanJourneyBrief({step:'a',guidance:'b',earned:['one']}).step,'a');
});
test('pending and failed replies are not model history; local fallback is labelled',()=>{
 const s=fresh(),c=hydrateChat(s);c.messages=[{role:'user',text:'先准备灯笼',status:'sent'},{role:'assistant',text:'queued',status:'pending'},{role:'assistant',text:'connection lost',status:'error'},{role:'assistant',text:'木材不足，未派发',status:'done',source:'local'}];
 const history=chatHistory(s);assert.equal(history.length,2);assert.match(history[1].content,/本地手账/);
});

