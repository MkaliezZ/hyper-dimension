import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
import {createZeroState}from'../src/freshStart.js';import{hydrateTown,needs,choosePurpose,availableMealQuantity}from'../src/townSimulation.js';import{createResidentRuntime}from'../src/residentRuntime.js';import{RESIDENTS}from'../src/world.js';import{newActionBook}from'../server/playerActions.mjs';import{applyResidentCommand}from'../server/residentActions.mjs';import{availableQuantity}from'../src/resourceLedger.js';
const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;for(let i=0;i<16;i++)Object.assign(needs(i,s),{hunger:100,energy:100,social:100,rations:0});return s;};
function runtime(s,{followPath=()=>{},residentRemote=null}={}){const npcs=Array.from({length:16},(_,npcId)=>({npcId,path:[],visible:true}));const r=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{},residentRemote});for(const n of npcs)n.think=1000;return {r,npcs};}
test('two hungry residents plan around one bread before either reaches the bakery, without mutating inventory or authority holds',()=>{
 const s=fresh();s.inventory.bread=1;const {r,npcs}=runtime(s);needs(0,s).hunger=20;needs(1,s).hunger=20;r.update(.1,.2);assert.equal(npcs[0].intent.foodId,'bread');assert.equal(npcs[1].intent.purposeId,'need:food-supply');assert.equal(npcs[1].intent.resource,'mushroom');assert.equal(s.inventory.bread,1);assert.equal(availableQuantity(s,'bread'),1);assert.equal(availableMealQuantity(s,'bread',0),1);assert.equal(availableMealQuantity(s,'bread',1),0);
 r.releaseActor(npcs[0]);r.refresh();assert.equal(availableMealQuantity(s,'bread',1),1,'cancelled route releases advisory demand');
});
test('authoritative meal lease is not counted a second time as walking demand',()=>{
 const s=fresh(),b=newActionBook();s.inventory.bread=2;s.npcPresence=[{id:0,mealFood:'bread',mealOrder:1}];const t=applyResidentCommand(s,b,{kind:'resident',operation:'begin',actorId:0,requestId:randomUUID(),epoch:b.epoch,expectedSequence:b.sequence,intent:{action:'eat',goal:'bakery',buildingId:17,foodId:'bread',purposeId:'need:food:bread'}},1000).ticket;assert(t);assert.equal(availableQuantity(s,'bread'),1);assert.equal(availableMealQuantity(s,'bread',1),1);
});
test('existing meal line priority is honored and switching foods cannot jump another line',()=>{
 const s=fresh();s.inventory.bread=1;s.inventory.tea=1;s.npcPresence=[{id:0,mealFood:'tea',mealOrder:1},{id:1,mealFood:'bread',mealOrder:2},{id:2,mealFood:'bread',mealOrder:3}];assert.equal(availableMealQuantity(s,'bread',0),0);assert.equal(availableMealQuantity(s,'bread',1),1);assert.equal(availableMealQuantity(s,'bread',2),0);assert.equal(availableMealQuantity(s,'tea',0),1);
});
test('food consumed during travel is re-planned at arrival instead of requesting the missing meal',()=>{
 const s=fresh();s.inventory.bread=1;s.inventory.tea=1;needs(0,s).hunger=20;const requested=[];
 const {r,npcs}=runtime(s,{followPath:a=>{const end=a.path.at(-1);if(end)Object.assign(a,end);a.path=[];const done=a.after;a.after=null;done?.()},residentRemote:{begin:async(n,d)=>{requested.push({...d});return null},cancel:async()=>{}}});
 r.update(.1,.2);assert.equal(npcs[0].intent.foodId,'bread');s.inventory.bread=0;
 for(const t of [.3,.4,.5,.6,.7,.8,.9])r.update(.1,t);
 assert(requested.length>0);assert(requested.every(d=>d.foodId==='tea'));assert.equal(npcs[0].intent.buildingId,1);assert.equal(s.inventory.tea,1,'planning never consumes stock');
});
test('runtime reset clears obsolete meal intent and does not carry old-world walking claims',()=>{
 const s=fresh();s.inventory.bread=1;const {r,npcs}=runtime(s);needs(0,s).hunger=20;r.update(.1,.2);assert(npcs[0].intent);r.reset();r.refresh();assert.equal(npcs[0].intent,null);assert.equal(availableMealQuantity(s,'bread',1),1);
});
