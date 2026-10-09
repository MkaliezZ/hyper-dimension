import test from 'node:test';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject,assignProjectStep} from '../src/projectPlans.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {RESIDENTS} from '../src/world.js';
import {followPath} from '../src/movement.js';
for(const kind of ['resident','field','farm'])for(const indoor of [false,true])test(kind+' reassignment cancels once across synchronous save reconciliation'+(indoor?' and walks out of the room':''),async()=>{
 const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0})),calls=[];let runtime;
 const remote={cancel:async ticket=>{calls.push(ticket.requestId);if(calls.length>4)throw Error('Reentrant cancellation');runtime.syncProjects();return{receipt:{outcome:'cancelled'}};}};
 runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>({...RESIDENTS[id],id}),followPath(){},onChange(){},onEvent(){},[kind+'Remote']:remote});
 const project=createProject(state,{id:'handover-'+kind,title:'交接木料',targets:{wood:4}});assert(project.ok);const task=state.agentTaskLedger.find(t=>t.projectId===project.project.id&&t.targetItem==='wood'),oldNpc=task.npcId,n=npcs[oldNpc];
 const ticket={kind,requestId:'real-job-'+kind,actorId:oldNpc};n.assignment={id:task.id};n.intent={assignmentId:task.id,projectId:project.project.id,goal:'forest',['server'+kind[0].toUpperCase()+kind.slice(1)+'Ticket']:ticket};
 if(indoor){n.inside=0;n.indoorActor={x:500,y:540,path:[],action:{type:'work'},after:null};}
 assert(assignProjectStep(state,task.id,6).ok);runtime.syncProjects();await Promise.resolve();runtime.syncProjects();await Promise.resolve();
 assert.deepEqual(calls,[ticket.requestId]);assert.equal(n.assignment,null);assert.equal(n.intent,null);assert.equal(state.agentTaskLedger.find(t=>t.id===task.id).npcId,6);
 if(indoor){assert(n.indoorActor.path.length>0,'room departure route retained');assert.equal(typeof n.indoorActor.after,'function');}
});

test('a cancelled actor ignores its old animation completion callback after reassignment',async()=>{
 const state=hydrateTown(createZeroState()),npcs=[{npcId:0,path:[],phase:0}],finishes=[],cancels=[],oldFetch=globalThis.fetch;let runtime;
 globalThis.fetch=async()=>new Response('{"error":"isolated callback regression; models blocked"}',{status:503});
 const remote={begin:async(n,d)=>({kind:'resident',requestId:'old-animation',actorId:n.npcId,action:'axe',duration:20,operationId:'old-work'}),finish:async t=>{finishes.push(t.requestId);return{receipt:{text:'Unexpected late completion'}};},cancel:async t=>{cancels.push(t.requestId);runtime.syncProjects();}};
 try{
  runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},residentRemote:remote});
  const p=createProject(state,{id:'callback-handover',targets:{wood:4}});assert(p.ok);const task=state.agentTaskLedger.find(t=>t.projectId===p.project.id&&t.targetItem==='wood');assert(assignProjectStep(state,task.id,0).ok);
  for(let i=1;i<1800&&!npcs[0].action;i++){runtime.update(.1,i*.1);await new Promise(r=>setImmediate(r));}
  const actor=npcs[0];assert(actor.action?.onDone,'actor must reach the worksite and start its accepted animation');const oldDone=actor.action.onDone;
  assert(assignProjectStep(state,task.id,6).ok);runtime.syncProjects();await Promise.resolve();oldDone();await Promise.resolve();
  assert.deepEqual(cancels,['old-animation']);assert.deepEqual(finishes,[]);assert.equal(task.npcId,6);assert.equal(task.completed,0);assert.equal(actor.intent,null);
 }finally{runtime?.reset();await new Promise(r=>setImmediate(r));globalThis.fetch=oldFetch;}
});

test('a late rejected finish cannot cancel the actor new purpose',async()=>{
 const state=hydrateTown(createZeroState()),npcs=[{npcId:0,path:[],phase:0}],cancels=[],oldFetch=globalThis.fetch;let runtime,rejectOld;
 globalThis.fetch=async()=>new Response('{"error":"isolated late response; models blocked"}',{status:503});
 const remote={begin:async(n,d)=>({kind:'resident',requestId:'old-finish',actorId:n.npcId,action:'axe',duration:20,operationId:'old-work'}),finish:()=>new Promise((_,reject)=>{rejectOld=reject;}),cancel:async t=>{cancels.push(t.requestId);runtime.syncProjects();}};
 try{
  runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},residentRemote:remote});
  const p=createProject(state,{id:'late-response',targets:{wood:4}});assert(p.ok);const task=state.agentTaskLedger.find(t=>t.projectId===p.project.id&&t.targetItem==='wood');assert(assignProjectStep(state,task.id,0).ok);
  let now=0;for(let i=1;i<1800&&!npcs[0].action;i++){now=i*.1;runtime.update(.1,now);await new Promise(r=>setImmediate(r));}
  const actor=npcs[0];assert(actor.action?.onDone);actor.action.onDone();assert.equal(typeof rejectOld,'function');
  assert(assignProjectStep(state,task.id,6).ok);runtime.syncProjects();await Promise.resolve();
  for(let i=0;i<600&&!actor.intent;i++){now+=.1;runtime.update(.1,now);await new Promise(r=>setImmediate(r));}
  const next=actor.intent,status=actor.status;assert(next,'actor resumes its own next purpose');rejectOld(Error('old finish rejected after handover'));
  await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  assert.equal(actor.intent,next);assert.equal(actor.status,status);assert.deepEqual(cancels,['old-finish']);assert.equal(task.completed,0);
 }finally{runtime?.reset();await new Promise(r=>setImmediate(r));globalThis.fetch=oldFetch;}
});
