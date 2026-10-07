import test from 'node:test';import assert from 'node:assert/strict';
import {createState,RESIDENTS,setWorldTheme} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {queueTask} from '../src/taskBoard.js';
import {bootstrapSaveAuthority} from '../server/saveBootstrap.mjs';
import {assertCommerceState,migrateEconomyPolicy} from '../server/commerceActions.mjs';
const policy=(s,b,version=32)=>{Object.assign(s.economy,{budgetPolicyVersion:version,budgetPolicyStartsDay:1,budgetPreviousVersion:26,daySeconds:105});b.commerce.snapshot.daySeconds=105;b.commerce.snapshot.policy=Object.fromEntries(Object.keys(b.commerce.snapshot.policy).map(k=>[k,s.economy[k]]));s.commerceControl.daySeconds=105;};
test('server migration updates the protected policy snapshot, keeps world/clock/stock/receipts, and is idempotent',()=>{
 const s=hydrateTown(createState()),b=bootstrapSaveAuthority(s,'pixel',Date.now());policy(s,b);const before=structuredClone({coins:s.coins,stock:s.inventory,day:s.day,seconds:s.economy.daySeconds,receipts:b.receipts,epoch:b.epoch,lease:b.active,townDays:s.economy.townDays});
 assertCommerceState(s,b);assert.equal(migrateEconomyPolicy(s,b),true);assertCommerceState(s,b);assert.equal(s.economy.budgetPreviousVersion,32);assert.equal(s.economy.budgetPolicyStartsDay,2);assert.equal(b.commerce.snapshot.policy.budgetPolicyVersion,105);
 assert.deepEqual({coins:s.coins,stock:s.inventory,day:s.day,seconds:s.economy.daySeconds,receipts:b.receipts,epoch:b.epoch,lease:b.active,townDays:s.economy.townDays},before);
 const migrated=JSON.stringify([s,b]);assert.equal(migrateEconomyPolicy(s,b),false);assert.equal(JSON.stringify([s,b]),migrated);
});
test('server policy migration rejects a mismatched old ledger before changing anything',()=>{
 const s=hydrateTown(createState()),b=bootstrapSaveAuthority(s,'pixel',Date.now());policy(s,b);s.economy.budgetPreviousVersion=12;const before=JSON.stringify([s,b]);assert.throws(()=>migrateEconomyPolicy(s,b),e=>e.code==='commerce_state_conflict');assert.equal(JSON.stringify([s,b]),before);
});
for(const theme of ['pixel','origami'])for(const field of ['farm','mine'])test(theme+' assigned '+field+' waits without a fake resident lease, then uses the correct field when free',async()=>{
 setWorldTheme(theme);const s=hydrateTown(createState());s.planningControl={version:1,enabled:true};let busy=true,farmStarts=0,mineStarts=0,wrongStarts=0;
 const item=field==='farm'?'wheat':'ore',id='waiting-'+field;assert(queueTask(s,{id,npcId:0,goal:field,buildingId:null,resource:item,quantity:2,intent:'真实田间分工'},{targetItem:item}).ok);
 for(const p of s.plots){p.stage=0;p.playerTended=false;}s.journey??={completed:{}};s.journey.completed??={};s.journey.completed.harvest=true;
 const npcs=[{npcId:0}],oldFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated routing test"}',{status:503});
 const walk=a=>{const end=a.path.at(-1);if(end)Object.assign(a,end);a.path=[];const fn=a.after;a.after=null;fn?.();};
 const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath:walk,onChange:()=>{},onEvent:()=>{},farmRemote:{occupied:()=>busy,begin:async(n,d,type)=>{assert.equal(d.assignmentId,id);assert.equal(type,'hoe');farmStarts++;return null;},cancel:async()=>{}},fieldRemote:{occupied:()=>busy,begin:async(n,d)=>{assert.equal(d.assignmentId,id);mineStarts++;return null;},cancel:async()=>{}},residentRemote:{begin:async()=>{wrongStarts++;return null;},cancel:async()=>{}}});
 try{
  for(let i=1;i<=40;i++){runtime.update(.1,i*.1);await new Promise(r=>setImmediate(r));}
  assert.equal(wrongStarts,0);assert.equal(farmStarts,0);assert.equal(mineStarts,0);assert.equal(s.agentTaskLedger[0].status,'queued');assert.equal(s.agentTaskLedger[0].operationId,undefined);assert.equal(s.agentTaskLedger[0].evidence.length,0);assert.match(npcs[0].status,/等待/);
  busy=false;for(let i=41;i<=110;i++){runtime.update(.1,i*.1);await new Promise(r=>setImmediate(r));}
  assert.equal(wrongStarts,0);assert.ok(field==='farm'?farmStarts>0:mineStarts>0);assert.equal(s.agentTaskLedger[0].completed,0);
 }finally{runtime.reset();globalThis.fetch=oldFetch;}
});
