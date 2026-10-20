import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {queueTask} from '../src/taskBoard.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';

for(const theme of ['pixel','origami'])test(theme+' unrelated persistence wait consumes an idle backoff but starts no work or model request',async()=>{
 const old=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;return Response.json({error:'Isolated models disabled'},{status:503});};setWorldTheme(theme);
 try{
  const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],visible:true})),runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:9,cycles:0,season:'spring'})});
  for(const n of npcs){n.manualUntil=10000;Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:100,rations:2});}
  const command={id:'retry-after-ack',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'Retain the accepted project'},task=queueTask(state,command,{targetItem:'wood'}).task,n=npcs[5];Object.assign(n,{manualUntil:-1,path:[],inside:null,intent:null,action:null,meeting:null,think:30,assignment:{...command,targetItem:'wood'},workResumeKey:command.id+':0'});
  const before=structuredClone(state);
  for(const edit of [{partyControlled:true},{recruitControlled:true},{homeRest:true},{action:{type:'axe'}},{meeting:1},{roomQueued:true},{path:[{x:1,y:1}]},{inside:0},{intent:{starting:true}},{manualUntil:1000}]){const old={...n};Object.assign(n,edit);runtime.advancePendingIdleTimers(.1);assert.equal(n.think,30,JSON.stringify(edit));Object.assign(n,old);for(const k of Object.keys(edit))if(!Object.hasOwn(old,k))delete n[k];}
  for(const dt of [0,-1,NaN,Infinity]){runtime.advancePendingIdleTimers(dt);assert.equal(n.think,30);}
  runtime.advancePendingIdleTimers(600000);assert(Math.abs(n.think-29.85)<1e-8,'A suspended frame cannot consume an idle delay in one step');n.think=30;
  for(let i=0;i<320;i++)runtime.advancePendingIdleTimers(.1);assert.equal(n.think,0);assert.equal(n.intent,null);assert.equal(n.action,null);assert.equal(requests,0);assert.deepEqual(state,before);assert.equal(task.completed,0);
  runtime.update(.1,.1);assert.equal(n.intent?.assignmentId,command.id);assert.equal(task.completed,0);assert.equal(state.inventory.wood,0);
 }finally{globalThis.fetch=old;setWorldTheme('pixel');}
});
