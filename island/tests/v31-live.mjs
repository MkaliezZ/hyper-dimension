import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createState,RESIDENTS,SLOTS,setWorldTheme,findPath,worldWalkable} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {createPartyPlanningService} from '../server/partyPlanningService.mjs';
import {partyPlanningContext,eventRequests} from '../src/partyPlanning.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {applyStewardParty,inviteFishingNpc,startFishingParty,fishingCheckin} from '../src/fishingParty.js';
import {followPath} from '../src/movement.js';
import {createFishingPartyRuntime} from '../src/fishingPartyRuntime.js';
import {tickTownEconomy} from '../src/economy.js';
import {tickCrops} from '../src/farming.js';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {fishingSpots} from '../src/fishingPartyRuntime.js';
import {startFishingRound,fishingAction,tickFishing} from '../src/fishingRules.js';
import {finishFishingParty} from '../src/fishingParty.js';
await mkdir('qa/v31',{recursive:true});const directory=await mkdtemp(resolve('qa/v31/live-'));
process.env.HD_HERMES_HOME=resolve(directory,'hermes-home');process.env.HD_STEWARD_WORKDIR=resolve(directory,'documents');
const {steward,suggestParty,agentStatus}=await import('../server/agentService.mjs');
const report={directory,kind:'real Flash recommendation and Hermes island_party, followed by actual zero-start game rules and disk save; simulated time, not human acceptance'};
try{
 setWorldTheme('origami');const s=hydrateTown(createZeroState()),saves=createSaveStore({directory:resolve(directory,'saves')});s.saveSlot='v31-live';await saves.open('origami',{legacyState:s,clientId:'fixture'});
 const svc=createPartyPlanningService({saves,suggest:suggestParty});
 const suggestion=await svc.propose('origami',{requestId:'live-theme',worldKey:s.saveSlot,expectedId:null,expectedVersion:null,input:{name:'星空海风小聚',description:'钓完鱼一起看星星，推荐一位喜欢星空的岛民来陪伴。',tags:['stars','sea'],difficulty:'normal'}});
 assert.equal(suggestion.source,'deepseek');assert.equal(suggestion.model,'deepseek-flash');assert(suggestion.guestReason);report.suggestion=suggestion;
 const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0})),runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
 const nativeFetch=globalThis.fetch;globalThis.fetch=async(url,options)=>{if(url==='/api/hermes/command'){const answer=await steward(JSON.parse(options.body));return new Response(JSON.stringify(answer),{headers:{'Content-Type':'application/json'}});}return nativeFetch(url,options);};
 const answer=await runtime.steward('帮我创建一场名为「星空海风小聚」的钓鱼大会，主题 sea 和 stars，标准难度；描述为「钓完鱼一起看星星」。请推荐一位喜欢星空、匹配标签的嘉宾，使用 island_party 建立活动并展开物资筹备，不要重复 prepare 或 dispatch。邀请由我亲自完成，现在不要操作现实文档。');
 assert.equal(answer.source,'hermes',JSON.stringify(answer));assert.equal(answer.model,'deepseek-flash');assert.equal(answer.parties?.length,1);assert.equal(answer.plans.length,0);assert.equal(answer.commands.length,0);
 const accepted=answer.partyResults[0];assert(accepted.ok,accepted.reason);assert(accepted.projectId);assert.equal(s.workProjects[0].runId,answer.runId);report.hermes={answer:answer.answer,runId:answer.runId,parties:answer.parties,accepted,tools:answer.tools};
 const progress=await runtime.steward('刚才星空海风小聚的筹备进度怎样？只说明实际缺口和我该邀请谁，不新建、不修改、不派新任务，也不操作现实文档。',false,[{role:'user',content:'帮我创建星空海风小聚'},{role:'assistant',content:answer.answer}]);
 assert.equal(progress.source,'hermes');assert.equal(progress.parties.length,0);assert.equal(progress.plans.length,0);assert.equal(progress.commands.length,0);report.progress={answer:progress.answer,runId:progress.runId};
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated after real planning"}',{status:503});
 try{
  let seconds=0,ready=false;const project=s.workProjects.find(p=>p.id===accepted.projectId);const visitors=createVisitorRuntime({getState:()=>s,followPath,onChange:()=>{},onEvent:()=>{}});visitors.setEntries(id=>SLOTS[id].entry);
  for(let i=1;i<=18000;i++){seconds=i*.2;runtime.update(.2,seconds);visitors.update(.2,seconds);tickCrops(s,.2);tickTownEconomy(s,.2);for(const node of s.oreNodes)if(node.hp===0&&(node.regen-=.2)<=0)node.hp=3;if(i%100===0)await new Promise(r=>setImmediate(r));if(project.status==='ready'&&s.coins>=10){ready=true;break;}}
  assert(ready,JSON.stringify({status:project.status,missing:project.missing,tasks:s.agentTaskLedger.map(t=>({item:t.targetItem,status:t.status,completed:t.completed}))}));
  assert(s.coins>=10);report.organizationFeeSource='Actual visitor consumption from zero initial currency';report.coinsBeforeEntry=s.coins;
  for(const r of eventRequests(s.fishingParty.draft)){const invited=inviteFishingNpc(s,r.id,{version:1});assert(invited.ok,invited.reason);}
  const launch=startFishingParty(s);assert(launch.ok,launch.reason);
  const party=createFishingPartyRuntime({state:()=>s,npcs,followPath,resident:()=>runtime,onChange:()=>{}});
  const player={x:780,y:465,path:findPath({x:780,y:465},fishingSpots()[2],worldWalkable),walkMix:0};
  for(let i=1;i<=3000&&s.fishingParty.session.phase==='checkin';i++){party.update(.1);runtime.update(.1,seconds+i*.1);followPath(player,.1,100);if(!player.path.length){assert(Math.hypot(player.x-fishingSpots()[2].x,player.y-fishingSpots()[2].y)<35);fishingCheckin(s,-1);}}
  assert(s.fishingParty.session.participants.every(p=>p.arrived));assert.equal(s.fishingParty.session.phase,'running');
  const m=s.fishingParty.session.match;for(let i=0;i<18000&&m.phase!=='results';i++){if(['ready','round_result'].includes(m.phase))startFishingRound(m);const c=m.current,l=m.rounds[m.index];if(c.mode==='aim')fishingAction(m,{type:'down',x:l.spot.x-l.wind,y:l.spot.y});else if(c.mode==='bite'&&c.modeT>.6)fishingAction(m,{type:'down'});else if(c.mode==='fight'){fishingAction(m,{type:'point',...c.fish});fishingAction(m,{type:!c.surge&&c.tension<.73?'down':'up'});}tickFishing(m,1/60);}
  const finish=finishFishingParty(s);assert(finish.ok,finish.reason);report.competition={score:finish.result.raw,reward:finish.reward,caught:m.results.filter(r=>r.caught).length};
  report.execution={preparationSeconds:seconds,projectStatus:project.status,version:s.fishingParty.session.version,guestId:s.fishingParty.session.guestId,participants:s.fishingParty.session.participants,actualSteps:s.agentTaskLedger.map(t=>({item:t.targetItem,completed:t.completed,receipts:t.evidence.length,status:t.status})),sameRunId:s.workProjects[0].runId===answer.runId};
 }finally{globalThis.fetch=old}
 const opened=await saves.current('origami');await saves.save('origami',{clientId:'fixture',expectedVersion:opened.version,state:s});const disk=await saves.current('origami');assert.equal(disk.state.fishingParty.session.runId,answer.runId);report.savedRevision=disk.revision;report.status=agentStatus();report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1}
finally{await writeFile('qa/v31/live-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exit(process.exitCode||0);}
