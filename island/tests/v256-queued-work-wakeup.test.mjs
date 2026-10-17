import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {queueTask} from '../src/taskBoard.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';

async function fixture(fn){
 const original=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'Isolated scheduling fixture; models disabled'},{status:503});setWorldTheme('pixel');
 try{
  let hour=9;const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true})),runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour,cycles:0,season:'spring'})});
  for(const n of npcs){n.manualUntil=10000;Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:100,rations:2});}
  const command={id:'wakeup-queue',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'Continue the original accepted work'},t=queueTask(state,command,{targetItem:'wood'}).task,n=npcs[5];Object.assign(n,{manualUntil:-1,path:[],inside:null,intent:null,action:null,meeting:null,think:20,assignment:{...command,targetItem:'wood'}});
  return await fn({state,n,runtime,t,setHour:value=>hour=value});
 }finally{globalThis.fetch=original;setWorldTheme('pixel');}
}
test('an already accepted queued task resumes when a fixed shift opens without carrying an off-shift idle pause',()=>fixture(async f=>{
 f.setHour(6.9);f.runtime.update(.1,.1);assert.equal(f.n.intent,null);assert(f.n.think>19);
 f.setHour(7.1);f.runtime.update(.1,.2);assert.equal(f.n.intent?.assignmentId,'wakeup-queue');assert.equal(f.n.intent.goal,'forest');assert.equal(f.t.completed,0);
}));
test('returning to an in-shift idle resident resumes its ready task without an inherited autonomous delay',()=>fixture(async f=>{
 f.runtime.update(.1,.1);assert.equal(f.n.intent?.assignmentId,'wakeup-queue');assert.equal(f.t.completed,0);assert.equal(f.state.inventory.wood,0);
}));
for(const boundary of ['off-shift','hungry','exhausted','pending-receipt','paused'])test('queued wakeup respects '+boundary,()=>fixture(async f=>{
 let intent;
 if(boundary==='off-shift')f.setHour(18);
 if(boundary==='hungry')needs(5,f.state).hunger=25;
 if(boundary==='exhausted')needs(5,f.state).energy=15;
 if(boundary==='pending-receipt')f.n.intent=intent={goal:'forest',action:'work',assignmentId:'original-inflight',starting:true};
 if(boundary==='paused')f.t.status='paused';
 f.runtime.update(.1,.1);
 if(intent){assert.equal(f.n.intent,intent);assert.equal(f.n.think,20);}else assert.notEqual(f.n.intent?.assignmentId,'wakeup-queue');
 assert.equal(f.t.completed,0);assert.equal(f.state.inventory.wood,0);
}));
