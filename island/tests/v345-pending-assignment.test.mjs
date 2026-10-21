import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {queueTask} from '../src/taskBoard.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath,followPendingPath} from '../src/movement.js';

const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const animate=app.slice(app.indexOf('function animatePendingSave('),app.indexOf('\nfunction update(dt,travelDt='));
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function fixture(theme,fn){
 const original=globalThis.fetch;let modelRequests=0;
 globalThis.fetch=async()=>{modelRequests++;return Response.json({error:'Isolated providers disabled'},{status:503});};setWorldTheme(theme);
 try{
  let hour=9,changes=0;const calls=[],state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],visible:true}));state.planningControl={enabled:true};
  const remote={begin(n,d){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});calls.push({actorId:n.npcId,intent:structuredClone(d),resolve,reject});return promise;},finish(){assert.fail('Unacknowledged work cannot deliver');},cancel:async()=>{}};
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){changes++;},onEvent(){},getEnvironment:()=>({hour,cycles:0,season:'spring'}),residentRemote:remote,fieldRemote:remote,farmRemote:remote});
  for(const n of npcs){n.manualUntil=10000;Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:100,rations:2});}
  const command={id:'queued-during-peer-save',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'Continue the same accepted assignment'},task=queueTask(state,command,{targetItem:'wood'}).task,n=npcs[5];
  Object.assign(n,{manualUntil:-1,path:[],inside:null,intent:null,action:null,meeting:null,think:0,assignment:{...command,targetItem:'wood'}});
  const scope={runtime,npcs,now:1,scene:'world',actor:{path:[],x:650,y:520},animateParticles(){},celebration:null,visitors:null,followPendingPath,shouldYield:()=>false,advanceAcceptedPlayerAction:()=>false,advancePendingActionPose(){},saves:{status:()=>({actions:{}})},theme,worldSound:{contact(){}}};
  vm.createContext(scope);vm.runInContext(animate+';this.pending=animatePendingSave;',scope);
  const tick=(count=1)=>{for(let i=0;i<count;i++){scope.now+=.1;scope.pending(.1,.1);}};
  return await fn({state,n,npcs,task,runtime,calls,tick,setHour:value=>hour=value,modelRequests:()=>modelRequests,changes:()=>changes});
 }finally{globalThis.fetch=original;setWorldTheme('pixel');}
}
for(const theme of ['pixel','origami']){
 test(theme+' the actual pending-save frame dispatches one ready canonical assignment without awaiting unrelated work',()=>fixture(theme,async f=>{
  const protectedBefore=structuredClone({task:f.task,inventory:f.state.inventory,coins:f.state.coins});
  f.tick(400);await flush();assert.equal(f.n.intent?.assignmentId,f.task.id);assert.equal(f.calls.length,1);assert.equal(f.n.intent.starting,true);assert.equal(f.n.action,null);
  assert.equal(f.calls[0].intent.assignmentId,f.task.id);assert.equal(f.calls[0].actorId,5);assert.equal(f.modelRequests(),0);
  assert.deepEqual({task:f.task,inventory:f.state.inventory,coins:f.state.coins},protectedBefore);
  f.calls[0].resolve({kind:'resident',actor:'npc',actorId:5,action:'axe',duration:20,operationId:'authoritative-step',requestId:'one-grant'});await flush();
  assert.equal(f.n.action.type,'axe');assert.equal(f.n.intent.starting,false);assert.equal(f.n.intent.serverResidentTicket.requestId,'one-grant');assert.equal(f.task.completed,0);assert.equal(f.state.inventory.wood,0);
 }));
 for(const boundary of ['off-shift','hungry','exhausted','paused','blocked-dependency','receipt','party','recruitment','manual','no-assignment','local-only','backoff']){
  test(theme+' pending assignment continuation respects '+boundary,()=>fixture(theme,async f=>{
   if(boundary==='off-shift')f.setHour(18);
   if(boundary==='hungry')needs(5,f.state).hunger=25;
   if(boundary==='exhausted')needs(5,f.state).energy=15;
   if(boundary==='paused')f.task.status='paused';
   if(boundary==='blocked-dependency')f.task.dependsOn=['unfinished'];
   if(boundary==='receipt')f.n.intent={assignmentId:f.task.id,starting:true,goal:'forest',action:'work'};
   if(boundary==='party')f.n.partyControlled=true;
   if(boundary==='recruitment')f.n.recruitControlled=true;
   if(boundary==='manual')f.n.manualUntil=100;
   if(boundary==='no-assignment'){f.n.assignment=null;f.state.agentTaskLedger=[];}
   if(boundary==='local-only')f.state.planningControl.enabled=false;
   if(boundary==='backoff'){f.n.think=20;f.n.workResumeKey=f.task.id+':0';}
   const before=structuredClone({task:f.task,inventory:f.state.inventory,coins:f.state.coins});f.tick();await flush();
   assert.equal(f.calls.length,0);assert.equal(f.modelRequests(),0);assert.deepEqual({task:f.task,inventory:f.state.inventory,coins:f.state.coins},before);
  }));
 }
}
