import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,RESIDENTS,setWorldTheme,HOTSPOTS} from '../src/world.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {createProject,controlProject,assignProjectStep} from '../src/projectPlans.js';
import {prepareRecruitment,bindRecruitment} from '../src/recruitment.js';
import {RECRUIT_CANDIDATE} from '../src/recruitmentCatalog.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';

for(const theme of ['pixel','origami'])for(const mode of ['idle','dependency','paused','ready','hungry','tired'])test(theme+' recruited partner '+mode+' selects only agreed work or personal life',async()=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'Models disabled in fictional recruited-gap fixture'},{status:503});setWorldTheme(theme);
 try{
  const state=hydrateTown(createState());state.saveSlot='fixture-gap-'+theme;state.coins=20;for(const id of Object.keys(state.inventory))state.inventory[id]=0;
  const target=mode==='dependency'?'bread':'wood',taskId='agreed-gap:'+target,project=createProject(state,{id:'agreed-gap',title:'真实工作间隙的调度夹具',targets:{[target]:2}});assert(project.ok);
  assert(prepareRecruitment(state,'gap-contract',project.project.id).ok);
  assert(bindRecruitment(state,{id:'gap-contract',world:state.saveSlot,phase:'active',steps:[taskId],projectId:project.project.id,wage:8,startedDay:1,expiresDay:3,context:{project:project.project},runs:[{parent:{id:'fixture-parent'},child:{id:'fixture-child',acceptedSteps:[taskId]}}]},theme).ok);
  state.recruitment.active.phase='working';const task=state.agentTaskLedger.find(t=>t.id===taskId);assert.equal(task.npcId,16);
  if(mode==='idle')assert(assignProjectStep(state,task.id,5).ok);
  if(mode==='paused')assert(controlProject(state,project.project.id,'pause').ok);
  if(mode==='dependency')assert(task.dependsOn.length,'Recipe planner must supply the actual unresolved wheat prerequisite');
  for(let id=0;id<=16;id++)Object.assign(needs(id,state),{energy:100,hunger:100,social:100,rations:2});
  if(mode==='hungry')needs(16,state).hunger=20;if(mode==='tired')needs(16,state).energy=10;
  const starts=[],npcs=Array.from({length:17},(_,npcId)=>({npcId,path:[],phase:0,visible:true})),runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>id===16?RECRUIT_CANDIDATE:RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:9,cycles:0,season:'spring'}),residentRemote:{begin:async(n,d)=>{starts.push({npcId:n.npcId,...structuredClone(d)});return null;},cancel:async()=>{}}});
  for(const n of npcs.slice(0,16))n.manualUntil=10000;Object.assign(npcs[16],HOTSPOTS.find(h=>h.type==='forest').entry);
  const before={coins:state.coins,inventory:{...state.inventory}};
  for(let i=1;i<=4000&&!starts.length;i++){runtime.update(.1,i/10);if(i%10===0)await new Promise(r=>setImmediate(r));}
  assert(starts.length,'The partner must have a concrete work or life destination');assert.equal(starts[0].npcId,16);
  if(mode==='ready'){assert.equal(starts[0].action,'work');assert.equal(starts[0].assignmentId,task.id);}
  else if(mode==='hungry')assert.equal(starts[0].action,'eat');
  else if(mode==='tired')assert.equal(starts[0].action,'rest');
  else{assert.notEqual(starts[0].action,'work','No ready agreed step must not become speculative unassigned production');assert(['visit','rest','eat'].includes(starts[0].action));}
  assert.equal(state.coins,before.coins);assert.deepEqual(state.inventory,before.inventory,'Intent selection must not mint goods or settle wages');
 }finally{globalThis.fetch=oldFetch;setWorldTheme('pixel');}
});
