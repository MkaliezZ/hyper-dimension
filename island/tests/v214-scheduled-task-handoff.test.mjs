import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {queueTask} from '../src/taskBoard.js';
import {RESIDENTS,SLOTS,BUILDINGS,findPath,worldWalkable} from '../src/world.js';
import {followPath} from '../src/movement.js';
import {taskWorkWindow} from '../src/taskWorkWindow.js';
import {cleanResidents} from '../server/agentService.mjs';

test('queued-work presentation explains fixed shifts and essential needs without changing task progress',()=>{
 assert.match(taskWorkWindow(5,{hour:18,cycles:0}),/已下班.*07:00–16:00/);
 assert.match(taskWorkWindow(5,{hour:23,cycles:0}),/正在休息/);
 assert.equal(taskWorkWindow(5,{hour:7,cycles:0},{hunger:100,energy:100}),'');
 assert.match(taskWorkWindow(5,{hour:8,cycles:0},{hunger:10,energy:100}),/用餐/);
 assert.match(taskWorkWindow(5,{hour:8,cycles:0},{hunger:100,energy:10}),/休息/);
 assert.equal(taskWorkWindow(16,{hour:18,cycles:0}),'');
});

test('the real model observation retains only bounded schedule fields',()=>{
 const schedule={period:'leisure',hour:18,work:[7,16],wake:6,sleep:22,home:'潮汐船屋',instruction:'untrusted extra data'};
 const cleaned=cleanResidents({residents:[{id:5,name:'祁舟',schedule}]})[0].schedule;
 assert.deepEqual(cleaned,{period:'leisure',hour:18,work:[7,16],wake:6,sleep:22,home:'潮汐船屋'});assert.notEqual(cleaned.work,schedule.work);
 for(const bad of [{...schedule,work:[7,99]},{...schedule,period:'override'},{...schedule,wake:'06:00'}])assert.equal(cleanResidents({residents:[{id:5,schedule:bad}]})[0].schedule,undefined);
});

test('off-shift work waits, then a queued task replaces unleased leisure travel when work starts',async()=>{
 const state=hydrateTown(createZeroState());state.freshStartPending=false;let hour=18,time=0;
 for(let id=0;id<16;id++)state.npcNeeds[id]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};
 const npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],x:780,y:465,phase:0,walkMix:0}));
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated schedule check"}',{status:503,headers:{'Content-Type':'application/json'}});
 try{
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange:()=>{},onEvent:()=>{},getEnvironment:()=>({hour,cycles:0,season:'spring'})});
  for(const n of npcs)if(n.npcId!==5)n.manualUntil=1e6;
  const n=npcs[5];n.intent={goal:BUILDINGS[22].kind,buildingId:22,action:'visit',activity:'leisure',duration:14,reason:'下班后去营地'};n.path=findPath(n,SLOTS[22].entry,worldWalkable);assert(n.path.length>5);n.after=()=>{};n.action=null;
  queueTask(state,{id:'shift-wood',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'上班后采集木材'},{targetItem:'wood'});
  for(let i=0;i<10;i++){time+=.1;runtime.update(.1,time);}assert.equal(n.intent.buildingId,22);assert.equal(state.agentTaskLedger[0].completed,0);
  hour=7;time+=.1;runtime.update(.1,time);assert.equal(n.intent.assignmentId,'shift-wood');assert.equal(n.intent.goal,'forest');
  for(let i=0;i<300&&state.agentTaskLedger[0].status!=='done';i++){time+=.2;runtime.update(.2,time);}
  assert.equal(state.agentTaskLedger[0].status,'done');assert.equal(state.agentTaskLedger[0].evidence.length,1);assert.equal(state.inventory.wood,2);
  await new Promise(r=>setImmediate(r));
 }finally{globalThis.fetch=original;}
});

test('handoff never takes over an active action, receipt, or conversation',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated schedule boundary"}',{status:503});
 try{
  for(const boundary of ['action','receipt','conversation']){
   const state=hydrateTown(createZeroState());const npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],x:780,y:465,phase:0,walkMix:0}));
   const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange:()=>{},onEvent:()=>{},getEnvironment:()=>({hour:8,cycles:0,season:'spring'})});
   for(const n of npcs)n.manualUntil=1e6;npcs[5].manualUntil=0;state.npcNeeds[5]={energy:100,hunger:100,social:100,rations:2};
   queueTask(state,{id:'wait-'+boundary,npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'当前活动结束后收集'},{targetItem:'wood'});
   const n=npcs[5],intent={goal:BUILDINGS[22].kind,buildingId:22,action:'visit',activity:'leisure'};n.intent=intent;n.path=findPath(n,SLOTS[22].entry,worldWalkable);n.after=()=>{};
   if(boundary==='action')n.action={type:'observe',t:0,duration:100,onDone:()=>assert.fail('Premature action completion')};
   if(boundary==='receipt')intent.serverResidentTicket={kind:'resident',actor:'npc',actorId:5,requestId:'existing-receipt'};
   if(boundary==='conversation')n.meeting='existing-conversation';
   runtime.update(.1,.1);assert.equal(n.intent,intent);assert.equal(state.agentTaskLedger[0].completed,0);
  }
  await new Promise(r=>setImmediate(r));
 }finally{globalThis.fetch=original;}
});
