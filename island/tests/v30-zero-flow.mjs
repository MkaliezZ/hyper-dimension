import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createZeroState} from '../src/freshStart.js';
import {RESIDENTS,SLOTS,setWorldTheme,findPath,worldWalkable} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {tickCrops} from '../src/farming.js';
import {followPath} from '../src/movement.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {tickTownEconomy} from '../src/economy.js';
import {projectSteps} from '../src/projectPlans.js';
import {createFishingEvent,createFishingPlan,inviteFishingNpc,startFishingParty,fishingCheckin,finishFishingParty,FISHING_INVITES} from '../src/fishingParty.js';
import {createFishingPartyRuntime,fishingSpots} from '../src/fishingPartyRuntime.js';
import {startFishingRound,fishingAction,tickFishing} from '../src/fishingRules.js';
import {createSaveStore} from '../server/saveStore.mjs';
const reportDirectory=process.env.HD_FISHING_QA_DIR||'qa/v30';await mkdir(reportDirectory,{recursive:true});
const directory=await mkdtemp(resolve(reportDirectory+'/zero-')),saves=createSaveStore({directory}),report={directory,source:'Zero inventory and zero currency. Real autonomous NPC path/action/crop/visitor/economy rules; deterministic input for the final fishing match; no live AI or human timing claim.',checks:[]};
const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated zero-start flow"}',{status:503});
try{
 for(const theme of ['pixel','origami']){
  setWorldTheme(theme);let s=hydrateTown(createZeroState());s.freshStartPending=false;assert.equal(s.coins,0);assert(Object.values(s.inventory).every(q=>q===0));
  createFishingEvent(s,{seed:38,name:'从零筹备的海风大会'});const result=createFishingPlan(s);assert(result.ok,result.reason);const id=result.project.id;
  const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
  const resident=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  const visitors=createVisitorRuntime({getState:()=>s,followPath,onChange:()=>{},onEvent:()=>{}});visitors.setEntries(id=>SLOTS[id].entry);
  let doc=(await saves.open(theme,{legacyState:s,clientId:'zero-flow'})).document,time=0,reloaded=false;
  for(let step=0;step<18000;step++){
   time+=.2;resident.update(.2,time);visitors.update(.2,time);tickCrops(s,.2);tickTownEconomy(s,.2);
   for(const node of s.oreNodes)if(node.hp===0&&(node.regen-=.2)<=0)node.hp=3;
   if(!reloaded&&time>90){
    doc=(await saves.save(theme,{state:s,expectedVersion:doc.version,clientId:'zero-flow'})).document;
    s=(await saves.current(theme)).state;resident.reset();visitors.reset();reloaded=true;
   }
   if(step%100===0)await new Promise(r=>setImmediate(r));
   if(s.workProjects.find(p=>p.id===id).status==='ready'&&s.coins>=10)break;
  }
  const plan=s.workProjects.find(p=>p.id===id);
  assert.equal(plan.status,'ready',JSON.stringify(projectSteps(s,id).map(t=>({item:t.targetItem,status:t.status,remaining:t.remaining,result:t.result}))));
  assert(s.coins>=10);const preparationSeconds=time;
  for(const invite of FISHING_INVITES)assert(inviteFishingNpc(s,invite.id,{version:1}).ok);
  const started=startFishingParty(s);assert(started.ok,started.reason);
  const runtime=createFishingPartyRuntime({state:()=>s,npcs,followPath,resident:()=>resident,onChange:()=>{}});
  const player={x:780,y:465,path:findPath({x:780,y:465},fishingSpots()[2],worldWalkable),walkMix:0};
  for(let i=0;i<3000&&s.fishingParty.session.phase==='checkin';i++){
   time+=.1;runtime.update(.1);resident.update(.1,time);followPath(player,.1,100);
   if(!player.path.length){assert(Math.hypot(player.x-fishingSpots()[2].x,player.y-fishingSpots()[2].y)<35);fishingCheckin(s,-1)}
   if(i%100===0)await new Promise(r=>setImmediate(r));
  }
  const g=s.fishingParty.session;assert.equal(g.phase,'running');
  for(let i=0;i<18000&&g.match.phase!=='results';i++){
   const m=g.match;if(['ready','round_result'].includes(m.phase))startFishingRound(m);
   const c=m.current,l=m.rounds[m.index];
   if(c.mode==='aim')fishingAction(m,{type:'down',x:l.spot.x-l.wind,y:l.spot.y});
   else if(c.mode==='bite'&&c.modeT>.6)fishingAction(m,{type:'down'});
   else if(c.mode==='fight'){fishingAction(m,{type:'point',...c.fish});fishingAction(m,{type:!c.surge&&c.tension<.73?'down':'up'})}
   tickFishing(m,1/60);
  }
  const finish=finishFishingParty(s);assert(finish.ok,finish.reason);runtime.update(.1);
  doc=(await saves.save(theme,{state:s,expectedVersion:doc.version,clientId:'zero-flow'})).document;
  const saved=await saves.current(theme);assert.equal(saved.state.fishingParty.session.phase,'claimed');assert(saved.state.eventWonders.owned.seashell_cup);
  assert(!npcs[8].partyControlled&&!npcs[2].partyControlled);
  report.checks.push({theme,preparationSeconds,arrivalSeconds:time-preparationSeconds,reloaded,steps:projectSteps(s,id).map(t=>({item:t.targetItem,completed:t.completed,receipts:t.evidence.length})),score:finish.result.raw,reward:finish.reward,finalCoins:s.coins});
  console.log(JSON.stringify(report.checks.at(-1)));resident.reset();
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1}
finally{globalThis.fetch=original;await writeFile(reportDirectory+'/zero-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:!!report.passed,failure:report.failure}));process.exit(process.exitCode||0)}
