// Actual Flash + Hermes parent/child, then real simulation and persisted settlement.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createState,RESIDENTS,setWorldTheme} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject} from '../src/projectPlans.js';
import {createRecruitmentStore} from '../server/recruitmentStore.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {prepareRecruitment,bindRecruitment,archiveRecruitment} from '../src/recruitment.js';
import {createRecruitmentRuntime} from '../src/recruitmentRuntime.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {RECRUIT_CANDIDATE} from '../src/recruitmentCatalog.js';
await mkdir('qa/v29',{recursive:true});const directory=await mkdtemp(resolve('qa/v29/live-'));
process.env.HD_HERMES_HOME=resolve(directory,'home');process.env.HD_STEWARD_WORKDIR=resolve(directory,'documents');
const {recruitmentRun}=await import('../server/agentService.mjs');
const saves=createSaveStore({directory:resolve(directory,'saves')}),registry=createRecruitmentStore({directory:resolve(directory,'saves')});
const report={directory,liveProvider:true,kind:'actual parent/child Hermes run, deterministic game simulation, actual saved wage and departure'};
const originalFetch=globalThis.fetch;
try{
 const theme='origami';setWorldTheme(theme);const s=hydrateTown(createState());s.saveSlot='hyper-dimension-origami-v3';s.coins=20;for(const k of Object.keys(s.inventory))s.inventory[k]=0;
 const p=createProject(s,{id:'live-v29-wood',title:'码头修缮木材',targets:{wood:6}});assert(p.ok);
 const id='live-v29-recruit';assert(prepareRecruitment(s,id,p.project.id).ok);
 let doc=(await saves.open(theme,{legacyState:s,clientId:'v29-live'})).document;
 const contract=(await registry.start(theme,doc,{requestId:id,projectId:p.project.id})).contract;
 const run=await recruitmentRun(contract.context,'v29-live-child');report.run=run;
 await registry.complete(theme,id,1,run);const active=(await registry.activate(theme,doc,id)).contract;assert(bindRecruitment(s,active,theme).ok);
 globalThis.fetch=async()=>new Response('{"error":"automatic island model calls disabled for simulation isolation"}',{status:503});
 const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
 const profile=i=>i===16?RECRUIT_CANDIDATE:RESIDENTS[i];
 const resident=createResidentRuntime({npcs,getState:()=>s,profile,followPath,onChange:()=>{},onEvent:()=>{}});
 const runtime=createRecruitmentRuntime({state:()=>s,npcs,followPath,resident:()=>resident,visitors:()=>({boats:[],guests:[]}),onChange:()=>{},onEvent:()=>{}});
 runtime.reset();for(const n of npcs.slice(0,16))n.manualUntil=1e6;
 let time=0;const stages=new Set();
 for(let i=0;i<10000&&s.recruitment.active.phase!=='departed';i++){time+=.1;runtime.update(.1);resident.update(.1,time);stages.add(s.recruitment.active.phase)}
 assert.equal(s.recruitment.active.phase,'departed');assert.equal(s.inventory.wood,6);assert.equal(s.coins,12);
 assert.equal(s.recruitment.active.parentRunId,run.parent.id);assert.equal(s.recruitment.active.childRunId,run.child.id);
 doc=(await saves.save(theme,{state:s,expectedVersion:doc.version,clientId:'v29-live'})).document;
 await registry.cancel(theme,doc,id);const departed=(await registry.departed(theme,doc,id)).contract;
 assert.equal(departed.delivery.fee,8);assert.equal(departed.delivery.delivered,6);assert.equal(departed.delivery.evidence[0].operations.length,3);
 assert(archiveRecruitment(s,id));runtime.reset();assert.equal(npcs.length,16);
 doc=(await saves.save(theme,{state:s,expectedVersion:doc.version,clientId:'v29-live'})).document;
 const disk=await saves.current(theme);assert.equal(disk.state.recruitment.history[0].childRunId,run.child.id);assert.equal((await registry.list(theme,disk)).active,null);
 report.delivery=departed.delivery;report.stages=[...stages];report.simulatedSeconds=time;report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1}
finally{
 globalThis.fetch=originalFetch;await writeFile(resolve(directory,'result.json'),JSON.stringify(report,null,2));await writeFile('qa/v29/live-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:!!report.passed,parent:report.run?.parent.id,child:report.run?.child.id,delivery:report.delivery,error:report.failure}));
 process.exit(process.exitCode||0);
}