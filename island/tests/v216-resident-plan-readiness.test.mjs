import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {residentPlanAvailability} from '../src/residentPlanning.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';

const option={purposeId:'career:0',goal:'forest',action:'work',reason:'准备木料'},schedule=period=>({period,hour:period==='sleep'?0:9,work:[7,16],wake:6,sleep:22,home:'测试住所'});
test('planning requests cover awake actionable residents, excluding sleep, empty and malformed purposes',()=>{
 const residents=[{id:0,schedule:schedule('sleep'),options:[option]},{id:1,schedule:schedule('work'),options:[option]},{id:2,options:[]},{id:3,options:[{...option,goal:'unknown'}]},{id:4,options:[{...option,purposeId:''}]},{id:5,options:[{...option,action:'override'}]},{id:15,options:[option]}];
 assert.deepEqual(residentPlanAvailability(residents).requestedIds,[1]);assert.deepEqual(residentPlanAvailability(residents).skippedIds,[0,2,3,4,5]);
 assert.equal(residentPlanAvailability([{id:0,schedule:schedule('sleep'),options:[]}]).reason,'sleeping');assert.equal(residentPlanAvailability([{id:1,options:[]}]).reason,'no_actionable_purposes');
});

for(const theme of ['pixel','origami'])test(theme+' sleeping residents skip automatic planning; wake-up and manual steward remain available',async()=>{
 const previous=globalThis.fetch,calls=[];globalThis.fetch=async(route,init)=>{calls.push({route,body:JSON.parse(init?.body||'{}')});return Response.json(route==='/api/npc/tick'?{decisions:[],source:'deepseek'}:{commands:[],source:'hermes',answer:'隔离测试的手动回应'});};setWorldTheme(theme);
 try{
  let hour=0;const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true}));
  for(let id=0;id<16;id++)state.npcNeeds[id]={energy:100,hunger:100,social:100,rations:2};
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour,cycles:hour/24,season:'spring'})});
  for(let frame=1;frame<=3500;frame++){runtime.update(.1,frame/10);if(frame%20===0)await new Promise(r=>setImmediate(r));}
  assert(npcs.every(n=>n.homeRest));assert.equal(calls.filter(c=>c.route==='/api/npc/tick').length,0,'Empty sleeping purposes must not start automatic provider requests');assert.match(runtime.health.deepseek,/休息/);
  await runtime.steward('隔离测试：休息时仍可处理我的手动委托');assert.equal(calls.filter(c=>c.route==='/api/hermes/command').length,1);
  hour=9;runtime.update(.1,602);await new Promise(r=>setImmediate(r));await new Promise(r=>setImmediate(r));
  const awake=calls.filter(c=>c.route==='/api/npc/tick');assert.equal(awake.length,1);assert(residentPlanAvailability(awake[0].body.residents).requestedIds.length>0);assert(npcs.every(n=>!n.homeRest));
 }finally{globalThis.fetch=previous;setWorldTheme('pixel');}
});

test('the actual backend skips empty night batches before reserving budget, but awake work cannot pretend to be an AI result',async()=>{
 await mkdir('qa/v216',{recursive:true});const directory=await mkdtemp(resolve('qa/v216/plan-budget-')),keys=['DEEPSEEK_API_KEY','HD_SAVE_DIR','HD_RUN_LEDGER_DIR','HD_ARTIFACT_DIR','HD_HERMES_HOME','HD_STEWARD_WORKDIR','HD_DOCUMENT_ROOT'],previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.DEEPSEEK_API_KEY='';for(const key of keys.slice(1))process.env[key]=join(directory,key.toLowerCase());
 let service;
 try{
  service=await import('../server/agentService.mjs');const {runLedger}=await import('../server/runLedger.mjs');assert.equal(service.agentStatus().deepseek.configured,false,'This fixture must not use any configured provider key');
  const initial=await runLedger.snapshot();assert.equal(initial.runs.length,0);
  const residents=[0,1].map(id=>({id,name:'虚构居民'+id,schedule:schedule('sleep'),options:[]}));const night=await service.decideBatch({theme:'pixel',day:1,residents});
  assert.equal(night.source,'schedule');assert.equal(night.model,null);assert.equal(night.skipped,true);assert.deepEqual(night.decisions,[]);assert.deepEqual(night.skippedIds,[0,1]);assert.deepEqual(night.missingIds,[]);
  const after=await runLedger.snapshot();assert.equal(after.runs.length,0);assert.equal(after.channels.plans.accepted,0);assert.equal(after.channels.plans.retryAfter,0);
  await assert.rejects(service.decideBatch({theme:'pixel',day:1,residents:[residents[0],{id:1,name:'虚构醒来居民',schedule:schedule('work'),options:[option]}]}),/尚未配置/);
  const day=await runLedger.snapshot();assert.equal(day.runs.length,1);assert.deepEqual(day.runs[0].participants,[1]);assert.equal(day.runs[0].providerStarted,false);assert.equal(day.channels.plans.accepted,1);
 }finally{await service?.stopAgentWorkers();for(const key of keys)if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
});
