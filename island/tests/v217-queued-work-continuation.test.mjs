import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {queueTask} from '../src/taskBoard.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';
import {NPC_CADENCE} from '../src/npcCadence.js';
for(const boundary of ['ready','off-shift','hungry','no-next-task'])test('confirmed queued work continuation: '+boundary,async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'Fictional continuation fixture; providers disabled'},{status:503});setWorldTheme('pixel');
 try{
  let hour=9;const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true}));
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour,cycles:0,season:'spring'})});for(const n of npcs){n.manualUntil=10000;Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:100,rations:2});}const n=npcs[5];n.manualUntil=-1;n.think=0;
  queueTask(state,{id:'continue-first',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'先收木材'},{targetItem:'wood'});
  if(boundary!=='no-next-task')queueTask(state,{id:'continue-second',npcId:5,goal:'dock',resource:'seaweed',quantity:1,dependsOn:['continue-first'],intent:'回执完成后去海边'},{targetItem:'seaweed'});
  let time=0;
  for(let i=0;i<1000&&state.agentTaskLedger[0].status!=='done';i++){
   if(n.action?.t>=n.action?.duration-.2){if(boundary==='off-shift')hour=18;if(boundary==='hungry')needs(5,state).hunger=25;}
   time+=.1;runtime.update(.1,time);if(i%20===0)await new Promise(r=>setImmediate(r));
  }
  assert.equal(state.agentTaskLedger[0].status,'done');assert.equal(state.agentTaskLedger[0].evidence.length,1);assert.equal(state.inventory.wood,2);
  assert.equal(n.think,boundary==='ready'?0:NPC_CADENCE.betweenPurposesSeconds,'A ready dependent task must not inherit an unrelated autonomous-purpose cooldown; shifts and essential needs retain it');
  if(boundary==='ready'){runtime.update(.1,time+.1);assert.equal(n.intent.assignmentId,'continue-second');assert.equal(n.intent.goal,'dock');assert.equal(state.agentTaskLedger[1].completed,0);}
 }finally{globalThis.fetch=old;setWorldTheme('pixel');}
});
