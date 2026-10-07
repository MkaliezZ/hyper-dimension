import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createZeroState} from '../src/freshStart.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createRecruitmentStore} from '../server/recruitmentStore.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {prepareRecruitment,bindRecruitment,archiveRecruitment} from '../src/recruitment.js';
import {createRecruitmentRuntime} from '../src/recruitmentRuntime.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {tickCrops} from '../src/farming.js';
import {RECRUIT_CANDIDATE} from '../src/recruitmentCatalog.js';
import {createFishingEvent,createFishingPlan,inviteFishingNpc,startFishingParty,fishingCheckin,finishFishingParty,FISHING_INVITES} from '../src/fishingParty.js';
import {createFishingPartyRuntime} from '../src/fishingPartyRuntime.js';
import {startFishingRound,fishingAction,tickFishing} from '../src/fishingRules.js';
await mkdir('qa/v30',{recursive:true});const directory=await mkdtemp(resolve('qa/v30/live-party-'));
process.env.HD_HERMES_HOME=resolve(directory,'home');process.env.HD_STEWARD_WORKDIR=resolve(directory,'documents');
const {recruitmentRun}=await import('../server/agentService.mjs');
const saves=createSaveStore({directory:resolve(directory,'saves')}),registry=createRecruitmentStore({directory:resolve(directory,'saves')});
const report={directory,liveProvider:true,kind:'Actual Flash parent/child accepts party preparation; real game movement/action delivery, wage, invitations, event, and saved cooperation evidence. Deterministic fishing controls; not human acceptance.'};
const originalFetch=globalThis.fetch;
try{
 const theme='origami';setWorldTheme(theme);const s=hydrateTown(createZeroState());s.freshStartPending=false;s.saveSlot='hyper-dimension-origami-v3';s.coins=20;
 createFishingEvent(s,{seed:45,name:'与伙伴共办的海风大会'});const p=createFishingPlan(s);assert(p.ok,p.reason);
 const id='live-v30-party-recruit';assert(prepareRecruitment(s,id,p.project.id).ok);
 let doc=(await saves.open(theme,{legacyState:s,clientId:'v30-live'})).document;
 const contract=(await registry.start(theme,doc,{requestId:id,projectId:p.project.id})).contract;
 console.log('Calling actual parent and child Hermes for the party supplies');
 const run=await recruitmentRun(contract.context,'v30-live-party');report.run=run;
 await registry.complete(theme,id,1,run);const active=(await registry.activate(theme,doc,id)).contract;assert(bindRecruitment(s,active,theme).ok);
 globalThis.fetch=async()=>new Response('{"error":"automatic AI disabled in isolated mechanics"}',{status:503});
 const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
 const profile=i=>i===16?RECRUIT_CANDIDATE:RESIDENTS[i];
 const resident=createResidentRuntime({npcs,getState:()=>s,profile,followPath,onChange:()=>{},onEvent:()=>{}});
 const recruit=createRecruitmentRuntime({state:()=>s,npcs,followPath,resident:()=>resident,visitors:()=>({boats:[],guests:[]}),onChange:()=>{},onEvent:()=>{}});
 recruit.reset();for(const n of npcs.slice(0,16))n.manualUntil=1e6;
 let time=0;const stages=new Set();
 function simulate(dt){time+=dt;recruit.update(dt);resident.update(dt,time);tickCrops(s,dt);for(const node of s.oreNodes)if(node.hp===0&&(node.regen-=dt)<=0)node.hp=3}
 for(let i=0;i<18000&&s.recruitment.active.phase!=='departed';i++){simulate(.1);stages.add(s.recruitment.active.phase);if(i%100===0)await new Promise(r=>setImmediate(r))}
 assert.equal(s.recruitment.active.phase,'departed');
 doc=(await saves.save(theme,{state:s,expectedVersion:doc.version,clientId:'v30-live'})).document;
 await registry.cancel(theme,doc,id);const departed=(await registry.departed(theme,doc,id)).contract;
 assert(departed.delivery.delivered>0);assert(departed.delivery.fee<=8);report.delivery=departed.delivery;report.stages=[...stages];
 assert(archiveRecruitment(s,id));recruit.reset();for(const n of npcs)n.manualUntil=0;
 for(let i=0;i<18000&&p.project.status!=='ready';i++){simulate(.2);if(i%100===0)await new Promise(r=>setImmediate(r))}
 assert.equal(p.project.status,'ready');
 for(const n of FISHING_INVITES)assert(inviteFishingNpc(s,n.id,{version:1}).ok);
 const booked=startFishingParty(s);assert(booked.ok,booked.reason);
 const event=s.fishingParty.session;assert(event.cooperation.length>0);assert(event.cooperation.every(e=>e.parentRunId===run.parent.id&&e.childRunId===run.child.id));
 const party=createFishingPartyRuntime({state:()=>s,npcs,followPath,resident:()=>resident,onChange:()=>{}});
 fishingCheckin(s,-1);
 for(let i=0;i<3000&&event.phase==='checkin';i++){party.update(.1);simulate(.1)}
 assert.equal(event.phase,'running');
 for(let i=0;i<18000&&event.match.phase!=='results';i++){
  const m=event.match;if(['ready','round_result'].includes(m.phase))startFishingRound(m);const c=m.current,l=m.rounds[m.index];
  if(c.mode==='aim')fishingAction(m,{type:'down',x:l.spot.x-l.wind,y:l.spot.y});
  else if(c.mode==='bite'&&c.modeT>.6)fishingAction(m,{type:'down'});
  else if(c.mode==='fight'){fishingAction(m,{type:'point',...c.fish});fishingAction(m,{type:!c.surge&&c.tension<.73?'down':'up'})}
  tickFishing(m,1/60);
 }
 const finished=finishFishingParty(s);assert(finished.ok);party.update(.1);
 doc=(await saves.save(theme,{state:s,expectedVersion:doc.version,clientId:'v30-live'})).document;
 const disk=await saves.current(theme);assert.equal(disk.state.fishingParty.history[0].cooperation[0].childRunId,run.child.id);
 report.event={id:event.id,preparationSeconds:time,cooperation:event.cooperation,score:finished.result,reward:finished.reward,coins:s.coins};report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1}
finally{globalThis.fetch=originalFetch;await writeFile(resolve(directory,'result.json'),JSON.stringify(report,null,2));await writeFile('qa/v30/live-party-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:!!report.passed,parent:report.run?.parent.id,child:report.run?.child.id,delivered:report.delivery?.delivered,event:report.event?.id,error:report.failure}));process.exit(process.exitCode||0)}
