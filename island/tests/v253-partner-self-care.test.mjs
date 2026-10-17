import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs,career} from '../src/townSimulation.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {RECRUIT_CANDIDATE} from '../src/recruitmentCatalog.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {newActionBook} from '../server/playerActions.mjs';
import {applyResidentCommand,residentReplay} from '../server/residentActions.mjs';

const fresh=()=>{const s=hydrateTown(createZeroState());s.freshStartPending=false;s.recruitment={active:{phase:'working',leaveRequested:false,feePaid:null}};Object.assign(needs(16,s),{hunger:5,energy:75,social:80,rations:0});career(16,s);return s;};
const intent=()=>({goal:'forest',buildingId:null,action:'eat',activity:'gather',foodId:'mushroom',purposeId:'need:forage-meal'});
const begin=(b,actorId=16,d=intent())=>({kind:'resident',operation:'begin',actorId,intent:d,gameTime:0,requestId:randomUUID(),expectedSequence:b.sequence,epoch:b.epoch});
const finish=t=>({kind:'resident',operation:'finish',requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});

for(const theme of ['pixel','origami']){
 test(theme+' temporary partner with no rations or unreserved meals makes a concrete personal food plan instead of waiting forever',()=>{
  setWorldTheme(theme);try{
   const s=fresh(),npcs=Array.from({length:17},(_,npcId)=>({npcId,path:[],visible:true})),runtime=createResidentRuntime({npcs,getState:()=>s,profile:id=>id===16?RECRUIT_CANDIDATE:RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:9,cycles:0,season:'spring'})});
   const options=runtime.person(16).options,food=options.find(o=>o.purposeId==='need:forage-meal');assert(food,'A hungry temporary partner needs a valid self-care destination even when its supplies are exhausted');assert.equal(food.action,'eat');assert.equal(food.goal,'forest');assert.equal(food.foodId,'mushroom');assert(!options.some(o=>o.action==='work'),'Personal food must not reopen unassigned contract production');
  }finally{setWorldTheme('pixel');}
 });
 test(theme+' protected personal forage uses a full gathering action, feeds only the actor, and grants no stock, wages or task delivery',()=>{
  setWorldTheme(theme);try{
   const s=fresh(),b=newActionBook(),before={coins:s.coins,inventory:{...s.inventory},phase:career(16,s).phase},r=applyResidentCommand(s,b,begin(b),1000000),t=r.ticket;
   assert.equal(t.duration,20);assert.equal(t.action,'gather');assert.deepEqual(t.cost,{});assert.equal(needs(16,s).hunger,5);assert.equal(s.recruitment.active.feePaid,null);
   assert.throws(()=>applyResidentCommand(s,b,finish(t),1019999),e=>e.code==='action_early');assert.equal(needs(16,s).hunger,5);
   const done=applyResidentCommand(s,b,finish(t),1020000);assert.equal(needs(16,s).hunger,43);assert.deepEqual(done.receipt.gain,{});assert.deepEqual(done.receipt.cost,{});assert.deepEqual(s.inventory,before.inventory);assert.equal(s.coins,before.coins);assert.equal(career(16,s).phase,before.phase);assert.equal(s.recruitment.active.feePaid,null);assert(!s.agentTaskLedger.some(t=>t.evidence.length),'A self-care receipt is not contract delivery');
   const after=JSON.stringify(s),replay=residentReplay({actions:b},finish(t));assert(replay.replayed);assert.equal(replay.receipt,done.receipt);assert.equal(JSON.stringify(s),after);
  }finally{setWorldTheme('pixel');}
 });
}

test('personal foraging cannot replace an available ration/meal, ignore hunger or leave an active contract',()=>{
 const cases=[s=>needs(16,s).rations=1,s=>needs(16,s).hunger=60,s=>s.inventory.bread=1,s=>s.inventory.mushroom=1,s=>s.recruitment.active.phase='departed',s=>s.recruitment.active.leaveRequested=true];
 for(const edit of cases){const s=fresh(),b=newActionBook();edit(s);const before={coins:s.coins,inventory:{...s.inventory},hunger:needs(16,s).hunger};assert.throws(()=>applyResidentCommand(s,b,begin(b),1000000));assert.deepEqual(s.inventory,before.inventory);assert.equal(s.coins,before.coins);assert.equal(needs(16,s).hunger,before.hunger);assert.equal(b.receipts.length,0);}
 for(const [id,d]of [[15,intent()],[16,{...intent(),goal:'dock'}],[16,{...intent(),purposeId:'career:0'}],[16,{...intent(),foodId:'wood'}]]){const s=fresh(),b=newActionBook();assert.throws(()=>applyResidentCommand(s,b,begin(b,id,d),1000000));assert.equal(b.receipts.length,0);}
});
