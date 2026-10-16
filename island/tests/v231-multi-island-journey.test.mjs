import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {LAN_EVENT_KINDS} from '../server/lanActivityStore.mjs';
import {seedLegacyAuthority} from './fixtures/trusted-initial-state.mjs';
import {DEFAULT_RECIPES} from '../src/contentCatalog.js';
import {equipOutfit} from '../src/equipmentRules.js';
import {applyCraftTrace,craftResult} from '../src/craftGameReplay.js';
import {chooseAction} from './v19-play-helpers.mjs';
import {worldWalkableForTheme,HARBOR_LAYOUTS} from '../src/world.js';
import {A2A_EXTENSION} from '../server/a2aGateway.mjs';
import {sendParams,successful} from './fixtures/a2a-standard.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v231/multi-island');
const realModels=process.env.HD_QA_REAL_A2A==='1',matrix=process.env.HD_QA_ALL_ACTIVITIES==='1';
if(matrix&&realModels)throw Error('The activity matrix uses controlled provider replies; real provider coverage is a separate explicit journey.');
let scenarios=matrix?LAN_EVENT_KINDS.flatMap(activity=>[1,2,3].map(difficulty=>({activity,difficulty}))):[{activity:LAN_EVENT_KINDS[0],difficulty:1}];
if(process.env.HD_QA_EVENT_KIND){assert(LAN_EVENT_KINDS.some(x=>x.id===process.env.HD_QA_EVENT_KIND));scenarios=scenarios.filter(x=>x.activity.id===process.env.HD_QA_EVENT_KIND);}
if(process.env.HD_QA_DIFFICULTY){const n=Number(process.env.HD_QA_DIFFICULTY);assert([1,2,3].includes(n));scenarios=scenarios.filter(x=>x.difficulty===n);}
assert(scenarios.length);
if(realModels)assert(process.env.DEEPSEEK_API_KEY&&process.env.HD_QA_OUT,'Live verification needs an explicitly configured private provider and isolated output directory');
await mkdir(out,{recursive:true});
const report={scope:'Four fictional accounts with mixed home themes; required personal stewards and two consenting residents each; canonical harbor movement, standard A2A transport, paid shared activity, restart/replay, return and original-island preservation. Time and progressed initial resources are declared fixtures. Provider mode is recorded separately; this does not claim human/new-player or physical multi-device acceptance.',matrixRequested:matrix,httpActivityRequests:matrix,originalWallBudgetSecondsPerCase:180,replayTickBudget:3750,ticksPerCheckpoint:matrix?100:25,selectedScenarios:scenarios.map(({activity,difficulty})=>({kind:activity.id,difficulty})),clockInjected:true,initialStateSynthetic:true,modelsCalled:realModels,modelResponsesSynthetic:!realModels,humanAcceptance:false,cases:[],passed:false};

for(const hostTheme of ['pixel','origami'])for(const {activity,difficulty} of scenarios)test(hostTheme+' '+activity.id+' level'+difficulty+' four-island travel, A2A, funded event and return remain one coherent journey',{timeout:180000+(realModels?11*260000:0)},async context=>{
 const row={hostTheme,activity:activity.id,difficulty,passed:false},directory=await mkdtemp(resolve(out,hostTheme+'-private-'));report.cases.push(row);
 let now=1800000000000,service;
 const calls=[],users=[];
 const runtime=({ownerId})=>({documents:'FICTIONAL_PRIVATE_DOCUMENTS',async call(method,p){
  if(method==='status')return{hermes:{configured:true}};
  calls.push({ownerId,method,stage:p.stage});
  assert.equal(method,'a2a');
  return{source:'hermes',model:'deepseek-flash',ledgerRunId:'fictional-'+randomUUID(),runId:'fictional-provider-'+randomUUID(),reply:{decision:p.stage==='exchange'?'share':p.stage==='offer'?'propose':p.stage==='confirm'?'confirm':p.preparation.ready?'accept':'clarify',message:p.stage==='exchange'?p.sharedContext.islandName+'介绍了本岛设施及随行居民。':'已按各自岛屿的实际准备条件核对活动。'}};
 },async close(){}});
 const start=()=>createLanHttpServer({directory,port:0,enrollmentKey:'FOUR-ISLAND-FICTIONAL',now:()=>now,...(!realModels?{agentRuntimeFactory:runtime}:{})});
 const identity=(n,operation,args={})=>service.identities.action(users[n].token,{operation,requestId:randomUUID(),...args});
 const activityInput=async(n,input)=>{if(!matrix)return service.activities.action(users[n].token,input);const response=await fetch('http://127.0.0.1:'+service.port+'/api/lan/activities/action',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hd_lan_session='+users[n].token,'X-HD-Island':users[n].id},body:JSON.stringify(input)}),data=await response.json();assert.equal(response.status,200,data.error||'Activity HTTP request failed');return data;};
 const act=(n,operation,args={})=>activityInput(n,{operation,requestId:randomUUID(),...args});
 const read=n=>service.tenants.readIslandForServer(users[n].id,users[n].theme);
 const heartbeat=async(ms=1000)=>{now+=ms;for(const u of users)await service.identities.view(u.token);};
 let f;
 try{
  service=await start();
  const originals=[];
  for(let n=0;n<4;n++){
   const theme=n%2?(hostTheme==='pixel'?'origami':'pixel'):hostTheme;
   const a=await service.identities.register({login:'four_island_'+n,password:'fictional-password',name:'虚构岛主'+n,islandName:'虚构群岛'+n,avatar:'male_'+n,theme});
   users.push({...a,id:a.view.me.id,theme});await seedLegacyAuthority(service.tenants,a.token,theme);await service.tenants.open(a.token,theme,{});
   const c=await service.tenants.get(a.token),d=await c.saves.current(theme),s=structuredClone(d.state);
   s.coins=100;s.inventory.wood=6;for(const id of Object.keys(DEFAULT_RECIPES[activity.building].cost))s.inventory[id]=20;s.inventory.outfit=1;assert(equipOutfit('outfit',s).ok);
   s.npcProfiles[15]={name:'专属管家'+n};s.butlerAvatar=n%2?'female_3':'male_2';s.npcMemory[0]=[{text:'FICTIONAL_PRIVATE_MEMORY_'+n}];
   await c.saves.save(theme,{state:s,expectedVersion:d.version});originals.push((await read(n)).state);
   await identity(n,'travel_invite',{npcId:0});await identity(n,'travel_invite',{npcId:1});
  }
  const room=(await identity(0,'room_create',{title:'四岛联合茶会',maxPlayers:4})).view.room;
  for(let n=1;n<4;n++)await identity(n,'room_join',{code:room.code});
  const initial=await service.identities.view(users[0].token),people=initial.room.members.flatMap(m=>m.travel.members);
  assert.equal(initial.room.members.length,4);assert.equal(people.length,12);assert.equal(new Set(people.map(p=>p.actorId)).size,12);
  for(const m of initial.room.members){assert.equal(m.travel.members[0].kind,'hermes');assert.equal(m.travel.members[0].name,'专属管家'+users.findIndex(u=>u.id===m.id));assert.equal(m.travel.members.filter(p=>p.kind==='ai').length,2);}
  for(const m of initial.room.members.filter(m=>m.id!==users[0].id)){assert.equal(m.position.x,HARBOR_LAYOUTS[hostTheme].boarding.x);assert.equal(m.position.y,HARBOR_LAYOUTS[hostTheme].boarding.y);}
  assert(!JSON.stringify(initial.room).includes('FICTIONAL_PRIVATE_MEMORY'));
  for(let i=0;i<70;i++){
   context.signal.throwIfAborted();await heartbeat();const v=await service.identities.view(users[0].token);
   for(const m of v.room.members){assert(worldWalkableForTheme(hostTheme,m.position.x,m.position.y));for(const p of m.companions)assert(worldWalkableForTheme(hostTheme,p.position.x,p.position.y));}
  }
  row.travel={players:4,stewards:4,residents:8,uniqueSourceActors:12,harborAndRoutesWalkable:true};
  for(const u of users)for(const operation of ['preference','information_preference'])await service.collaboration.action(u.token,{operation,requestId:randomUUID(),receive:true});
  f={users,room,get eventId(){return row.eventId;},async rpc(n,method,params={}){
   const response=await fetch('http://127.0.0.1:'+service.port+'/api/lan/a2a',{method:'POST',headers:{'Content-Type':'application/a2a+json','A2A-Version':'1.0',Authorization:'Bearer '+users[n].token},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return{response,data:await response.json()};
  }};
  const info=(await successful(f,1,'SendMessage',sendParams(f,{recipient:2,text:'请向另一位来访岛主介绍本岛设施和随行居民。'}))).task;
  const reply=(await successful(f,2,'SendMessage',sendParams(f,{taskId:info.id,text:'请回应对方并说明本岛适合合作的设施。'}))).task;
  assert.equal(reply.history.length,4);assert.equal((await f.rpc(3,'GetTask',{id:info.id})).data.error.code,-32001);
  const beforeEvent=await Promise.all(users.map((_,n)=>read(n)));
  const publication=await act(0,'publish',{roomId:room.id,title:'四岛共同筹办茶会',kind:activity.id,brief:'携带木材并穿上主题衣服，完成真实挑战后结算。',invitees:users.slice(1).map(u=>u.id),requirements:{items:[{item:'wood',quantity:2}],garment:'outfit'},prepareSeconds:60,difficulty,minQuality:55,economyMode:'funded',deliveryMode:'transfer'});
  row.eventId=publication.eventId;
  for(let n=1;n<4;n++){
   await act(n,'respond',{eventId:row.eventId,response:'accepted'});
   const offer=(await successful(f,0,'SendMessage',sendParams(f,{recipient:n,capability:'event.checkin'}))).task;
   const reviewed=(await successful(f,n,'SendMessage',sendParams(f,{taskId:offer.id}))).task;assert.equal(reviewed.metadata[A2A_EXTENSION].nextAction,'execute');
   const execute=sendParams(f,{taskId:offer.id,action:'execute',text:'确认按约定预留本人材料及入场费。'});
   const accepted=(await successful(f,n,'SendMessage',execute)).task;assert.equal(accepted.metadata[A2A_EXTENSION].receipt.verified,true);assert.deepEqual(accepted.metadata[A2A_EXTENSION].receipt.reserved,{coins:12,wood:2});
   const reserved=await read(n);await successful(f,n,'SendMessage',execute);assert.equal((await read(n)).version,reserved.version);
   assert.equal((await successful(f,0,'SendMessage',sendParams(f,{taskId:offer.id}))).task.status.state,'TASK_STATE_COMPLETED');
  }
  await heartbeat(60001);
  const event=async n=>(await service.activities.view(users[n].token)).events.find(e=>e.id===row.eventId);
  await act(0,'start',{eventId:row.eventId,expectedRevision:(await event(0)).revision});
  // Persist two simultaneous unfinished trials, then reopen the service before continuing.
  await act(1,'trial_begin',{eventId:row.eventId});await act(2,'trial_begin',{eventId:row.eventId});
  const runIds=[(await event(1)).trial.runId,(await event(2)).trial.runId];
  await service.close();service=await start();
  assert.deepEqual([(await event(1)).trial.runId,(await event(2)).trial.runId],runIds);
  assert.equal((await service.identities.view(users[0].token)).room.members.length,4);
  row.results=[];
  for(let n=1;n<4;n++){
   if(n===3)await act(n,'trial_begin',{eventId:row.eventId});
   let trial=(await event(n)).trial;assert.equal(trial.building,activity.building);assert.equal(trial.difficulty,difficulty);row.gameKind=trial.game.state?.kind||trial.game.engine;
   let ticks=0;for(let batch=0;ticks<3750&&!craftResult(trial.game);batch++){
    context.signal.throwIfAborted();const game=structuredClone(trial.game),events=[];let elapsed=0;
    for(let i=0;i<(matrix?100:25)&&ticks<3750&&!craftResult(game);i++,ticks++){const action=chooseAction(game.state);if(action){events.push({action});applyCraftTrace(game,[{action}]);}events.push({dt:.05});applyCraftTrace(game,[{dt:.05}]);elapsed+=50;}
    await heartbeat(elapsed);const r=await act(n,'trial_checkpoint',{eventId:row.eventId,runId:trial.runId,batch:trial.nextBatch,events});trial=r.view.events.find(e=>e.id===row.eventId).trial;
   }
   assert(craftResult(trial.game)?.passed);const input={operation:'trial_finish',eventId:row.eventId,runId:trial.runId,requestId:randomUUID()},done=await activityInput(n,input);
   assert.equal(done.receipt.outcome,'completed');assert((await activityInput(n,input)).replayed);row.results.push({accountIndex:n,quality:done.receipt.result.quality});row.stage='completed-guest-'+n;await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));
  }
  const finishInput={operation:'finish',requestId:randomUUID(),eventId:row.eventId,expectedRevision:(await event(0)).revision};
  const settled=await activityInput(0,finishInput);assert.equal(settled.view.events.find(e=>e.id===row.eventId).economy.status,'settled');
  const after=await Promise.all(users.map((_,n)=>read(n))),settlement=(await event(0)).economy.settlement;
  assert.equal(settlement.deliveries.length,3);assert.equal(settlement.awards.length,3);
  assert.equal(after.reduce((v,d)=>v+d.state.coins,0),beforeEvent.reduce((v,d)=>v+d.state.coins,0)-8,'Shared event coins must only lose the venue fee');
  const materials=DEFAULT_RECIPES[activity.building].cost;
  for(const item of new Set(['wood',...Object.keys(materials)]))assert.equal(after.reduce((v,d)=>v+(d.state.inventory[item]||0),0),beforeEvent.reduce((v,d)=>v+(d.state.inventory[item]||0),0)-(materials[item]||0),'Cross-island transfers must conserve '+item);
  for(let n=0;n<4;n++){assert.deepEqual(after[n].state.lanEconomyControl.holds,{});assert.equal(after[n].state.saveSlot,originals[n].saveSlot);assert.equal(after[n].state.npcProfiles[15].name,'专属管家'+n);assert.deepEqual(after[n].state.npcMemory[0],originals[n].npcMemory[0]);}
  for(let n=1;n<4;n++){await act(n,'rate',{eventId:row.eventId,stars:4,comment:'虚构验证：活动流程完整。'});await act(n,'subscribe',{hostId:users[0].id,subscribed:true});}
  if(matrix){
   const beforeCancel=await Promise.all(users.map((_,n)=>read(n))),cancelled=await act(0,'publish',{roomId:room.id,title:'取消退款核对',kind:activity.id,brief:'取消后按原来源退还各岛资金与物资。',invitees:users.slice(1).map(u=>u.id),requirements:{items:[{item:'wood',quantity:2}],garment:'outfit'},prepareSeconds:60,difficulty,minQuality:55,economyMode:'funded',deliveryMode:'transfer'});
   for(let n=1;n<4;n++){await act(n,'respond',{eventId:cancelled.eventId,response:'accepted'});await act(n,'checkin',{eventId:cancelled.eventId});}
   const cancelEvent=(await service.activities.view(users[0].token)).events.find(e=>e.id===cancelled.eventId),cancelInput={operation:'cancel',requestId:randomUUID(),eventId:cancelled.eventId,expectedRevision:cancelEvent.revision};await activityInput(0,cancelInput);assert((await activityInput(0,cancelInput)).replayed);
   const refunded=await Promise.all(users.map((_,n)=>read(n)));for(let n=0;n<4;n++){assert.equal(refunded[n].state.coins,beforeCancel[n].state.coins);assert.deepEqual(refunded[n].state.inventory,beforeCancel[n].state.inventory);assert.deepEqual(refunded[n].state.lanEconomyControl.holds,{});}row.preparingCancellation={http:true,guests:3,allMaterialsAndCashRefunded:true,uniqueReplay:true};
  }
  await service.close();service=await start();assert((await activityInput(0,finishInput)).replayed);
  assert.deepEqual((await Promise.all(users.map((_,n)=>read(n)))).map(d=>d.state.inventory),after.map(d=>d.state.inventory));assert.equal((await event(0)).reviews.length,3);
  for(let n=1;n<4;n++){const v=await service.identities.view(users[n].token);await identity(n,'room_leave',{roomId:room.id,expectedRevision:v.room.revision});const c=await service.tenants.get(users[n].token),d=await c.saves.current(users[n].theme);await c.saves.save(users[n].theme,{state:d.state,expectedVersion:d.version,saveId:randomUUID()});}
  row.a2a={informationTurns:2,eventStewardTurns:9,exactOwnerRuntimeRouting:true,explicitExecution:true,privateThirdPartyIsolation:true};
  if(realModels){
   row.a2a.actualOwnerRuns=[];
   for(let n=0;n<4;n++){const ledger=await service.agents.work(users[n].token,'ledger',{}),runs=ledger.runs.filter(r=>r.kind==='a2a');assert.equal(runs.length,[6,2,2,1][n]);assert(runs.every(r=>r.phase==='completed'&&r.model==='deepseek-flash'));row.a2a.actualOwnerRuns.push({accountIndex:n,completedRuns:runs.length,model:'deepseek-flash'});}
  }else{assert.equal(calls.filter(c=>c.method==='a2a').length,11);assert.deepEqual(calls.filter(c=>c.method==='a2a').map(c=>c.ownerId),[users[1].id,users[2].id,...users.slice(1).flatMap(u=>[users[0].id,u.id,users[0].id])]);}
  row.settlement={completedGuests:3,ratings:3,totalCoinDelta:-8,materialsConserved:true,holdsCleared:true,restartAndReplayUnique:true,returnHomeWritable:true};context.signal.throwIfAborted();row.passed=true;
 }catch(e){row.failure=e.stack;throw e;}finally{await service?.close();if(context.signal.aborted){row.passed=false;row.failure??='Verification timed out at the original per-case budget';}await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
});
test.after(async()=>{report.passed=report.cases.length===2*scenarios.length&&report.cases.every(c=>c.passed);await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));});
