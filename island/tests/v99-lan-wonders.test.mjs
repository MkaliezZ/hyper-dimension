import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';import {resolve,join} from 'node:path';import {randomUUID} from 'node:crypto';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createLanActivityStore} from '../server/lanActivityStore.mjs';import {createLanTenantServices} from '../server/lanTenantServices.mjs';import {craftResult,applyCraftTrace} from '../src/craftGameReplay.js';import {chooseAction} from './v19-play-helpers.mjs';import {HARBOR_LAYOUTS,worldWalkableForTheme} from '../src/world.js';import {validLanVisit} from '../src/lanWonderEvidence.js';import {validActionBook} from '../server/playerActions.mjs';
async function fixture(theme){
 await mkdir('qa/v99',{recursive:true});let at=1800000000000,fault=()=>{},walletFault=()=>{};const directory=await mkdtemp(resolve('qa/v99/visits-')),now=()=>at,service=await createLanHttpServer({directory,port:0,enrollmentKey:'V99-NO-MODELS',now}),users=[];
 for(let i=0;i<11;i++){const ownTheme=i===2?(theme==='pixel'?'origami':'pixel'):theme,r=await service.identities.register({login:'wonder_'+i,password:'fixture-password',name:'群岛来客'+i,islandName:'来客小岛'+i,avatar:'male_'+(i%6),theme:ownTheme});users.push({...r,id:r.view.me.id,theme:ownTheme});await service.tenants.open(r.token,ownTheme);}
 const tenants=createLanTenantServices({directory,identities:service.identities,now,externalFault:(...args)=>walletFault(...args)}),options={directory,identities:service.identities,tenants,now,settlementFault:(...args)=>fault(...args)};let activities=createLanActivityStore(options);
 const f={service,tenants,users,directory,theme,now,step:ms=>at+=ms,identity:(n,operation,args={})=>service.identities.action(users[n].token,{operation,requestId:randomUUID(),...args}),call:(n,operation,args={})=>activities.action(users[n].token,{operation,requestId:randomUUID(),...args}),view:n=>activities.view(users[n].token),read:()=>tenants.readIslandForServer(users[0].id,theme),setFault:fn=>fault=fn,setWalletFault:fn=>walletFault=fn,reopen:()=>activities=createLanActivityStore(options)};
 const ownerContext=await tenants.get(users[0].token),ownerDoc=await f.read();f.previousBackup=await ownerContext.saves.backup(theme,{expectedVersion:ownerDoc.version});f.room=(await f.identity(0,'room_create',{title:'五岛相聚验收',maxPlayers:4})).view.room;return f;
}
async function arrive(f,n){
 let proof;
 for(let i=0;i<70;i++){f.step(1000);const v=await f.service.identities.view(f.users[n].token),m=v.room.members.find(m=>m.id===f.users[n].id);assert(worldWalkableForTheme(f.theme,m.position.x,m.position.y));if(m.travel.arrival){proof=m.travel.arrival;break;}}
 assert(proof,'guest must actually traverse harbor');assert.equal(proof.butlerActorId,f.users[n].id+':'+proof.guestWorldKey+':npc:15');assert(Math.hypot(proof.position.x-HARBOR_LAYOUTS[f.theme].entrance.x,proof.position.y-HARBOR_LAYOUTS[f.theme].entrance.y)<=35);return proof;
}
async function start(f,n,{walk=true}={}){
 const id=(await f.call(0,'publish',{roomId:f.room.id,title:'五岛海风茶会',kind:'tea',brief:'欢迎朋友与自己的管家从码头登岛共同完成挑战。',invitees:[f.users[n].id],requirements:{items:[],garment:null},prepareSeconds:60,difficulty:1,minQuality:55})).eventId;
 await f.call(n,'respond',{eventId:id,response:'accepted'});await f.call(n,'arrive',{eventId:id});const joined=(await f.service.identities.view(f.users[n].token)).room.members.find(m=>m.id===f.users[n].id);assert.equal(joined.travel.arrival,null);if(walk)await arrive(f,n);
 await f.call(n,'checkin',{eventId:id});f.step(60001);await f.call(0,'start',{eventId:id,expectedRevision:(await f.view(0)).events.find(e=>e.id===id).revision});return id;
}
async function play(f,n,id){
 await f.call(n,'trial_begin',{eventId:id});let t=(await f.view(n)).events.find(e=>e.id===id).trial;
 for(let k=0;k<250&&!craftResult(t.game);k++){
  const local=structuredClone(t.game),events=[];let dt=0;
  for(let j=0;j<20&&!craftResult(local);j++){const a=chooseAction(local.state),one=[];if(a)one.push({action:a});one.push({dt:.05});applyCraftTrace(local,one);events.push(...one);dt+=50;}
  f.step(dt);const r=await f.call(n,'trial_checkpoint',{eventId:id,runId:t.runId,batch:t.nextBatch,events});t=r.view.events.find(e=>e.id===id).trial;
 }
 assert(craftResult(t.game)?.passed);const result=await f.call(n,'trial_finish',{eventId:id,runId:t.runId});assert.equal(result.receipt.outcome,'completed');return result;
}
async function leave(f,n){const v=await f.service.identities.view(f.users[n].token);await f.identity(n,'room_leave',{roomId:v.room.id,expectedRevision:v.room.revision});}
for(const theme of ['pixel','origami'])test(theme+' two milestones of five distinct actually walked guest/owned-butler visits and completed event replays award one UR; membership-only, repeat visitors, faults, retry and forgery cannot inflate it',{timeout:120000},async()=>{
 const f=await fixture(theme);try{
 // Completing a challenge while still at the harbor does not count as an actual island visit.
 let id=await start(f,1,{walk:false});await play(f,1,id);await f.call(0,'finish',{eventId:id,expectedRevision:(await f.view(0)).events.find(e=>e.id===id).revision});assert.equal(Object.keys((await f.read()).state.wonderControl.visits).length,0);await leave(f,1);
 const accepted=[],preReward=await f.read();
 for(let n=1;n<=10;n++){
  id=await start(f,n);await play(f,n,id);const req={operation:'finish',requestId:randomUUID(),eventId:id,expectedRevision:(await f.view(0)).events.find(e=>e.id===id).revision};
  if(n===1){let fired=false;f.setFault(where=>{if(!fired&&where==='settlement-prepared'){fired=true;throw Error('prepared interruption');}});await assert.rejects(f.call(0,'finish',{...req}),/prepared interruption/);f.setFault(()=>{});f.reopen();await f.view(0);}
  else if((n===5||n===10)){let fired=false;f.setWalletFault(where=>{if(!fired&&where===(n===5?'wonder-journal-written':'wonder-written')){fired=true;throw Error('island write response lost');}});await assert.rejects(f.call(0,'finish',{...req}),e=>e.code==='lan_event_settlement_pending');f.setWalletFault(()=>{});f.reopen();await f.view(0);}
  else await f.call(0,'finish',{...req});
  const d=await f.read();assert(validActionBook(d.actions));assert.equal(Object.keys(d.state.wonderControl.visits).length,n);assert.equal(!!d.state.eventWonders.owned.archipelago_lighthouse,n>=5);
  const replay=await f.call(0,'finish',{...req});assert(replay.replayed);assert.equal(Object.keys((await f.read()).state.wonderControl.visits).length,n);accepted.push(id);await leave(f,n);
  if(n===1){const repeat=await start(f,1);await play(f,1,repeat);await f.call(0,'finish',{eventId:repeat,expectedRevision:(await f.view(0)).events.find(e=>e.id===repeat).revision});assert.equal(Object.keys((await f.read()).state.wonderControl.visits).length,1);await leave(f,1);}
 }
 const earned=await f.read(),a=earned.state.eventWonders.owned.archipelago_lighthouse;assert.equal(a.rarity,'UR');assert.equal(a.marks,1);assert.equal(a.wins,2);assert.equal(a.visits.length,5);assert(a.visits.every(validLanVisit));assert.equal(new Set(a.visits.map(v=>v.eventId)).size,5);assert.equal(new Set(a.visits.map(v=>v.guestAccountId)).size,5);assert.equal(earned.state.coins,0);
 const internal={id:'lan-wonder:'+a.visits.at(-1).eventId,operation:'lan_wonder',worldKey:earned.state.saveSlot,eventId:a.visits.at(-1).eventId,visits:[a.visits.at(-1)]};assert((await f.tenants.awardWonderForServer(f.users[0].id,theme,internal)).replayed);await assert.rejects(f.tenants.awardWonderForServer(f.users[0].id,theme,{...internal,visits:[{...a.visits.at(-1),quality:a.visits.at(-1).quality-1}]}),e=>e.code==='lan_wonder_id_conflict');
 const v=await f.service.identities.view(f.users[0].token);await f.identity(0,'room_close',{roomId:v.room.id,expectedRevision:v.room.revision});const c=await f.tenants.get(f.users[0].token),current=await f.read();
 for(const mutate of [s=>s.eventWonders.owned.archipelago_lighthouse.marks++,s=>delete s.wonderControl.visits[f.users[1].id],s=>s.wonderControl.visits[f.users[1].id].quality--]){const s=structuredClone(current.state);mutate(s);await assert.rejects(c.saves.save(theme,{state:s,expectedVersion:current.version}),e=>e.code==='wonder_state_conflict');}
 // An old same-world head and a historical restore must recover external guest proof without duplicating it.
 const realRestore=await c.saves.restoreClient(theme,{id:f.previousBackup.id,expectedVersion:(await f.read()).version});assert.equal(realRestore.document.state.eventWonders.owned.archipelago_lighthouse.marks,1);assert.equal(Object.keys(realRestore.document.state.wonderControl.visits).length,10);assert((await f.tenants.awardWonderForServer(f.users[0].id,theme,internal)).replayed);
 const p=join(f.directory,'_lan/islands',f.users[0].id,theme),beforeRecovery=await f.read();await writeFile(join(p,'current.json'),JSON.stringify(preReward));const recovered=await f.read();assert.equal(recovered.reason,'lan-wonder-recovery');assert.equal(recovered.state.eventWonders.owned.archipelago_lighthouse.marks,1);assert.equal(Object.keys(recovered.state.wonderControl.visits).length,10);assert.equal(recovered.state.coins,preReward.state.coins);
 const hash=(await import('node:crypto')).createHash('sha256').update(String(current.state.saveSlot)).digest('hex'),journal=join(p,'lan-wonders',hash+'.json'),bytes=await readFile(journal);await writeFile(journal,'corrupt retained evidence');await assert.rejects(f.read(),e=>e.code==='lan_wonder_corrupt');assert.equal(await readFile(journal,'utf8'),'corrupt retained evidence');await writeFile(journal,bytes);assert.equal((await f.read()).state.eventWonders.owned.archipelago_lighthouse.marks,1);
 const oldWorld=structuredClone(preReward);oldWorld.state.saveSlot+='-different';const beforeWrongWorld=await f.read();const skipped=await f.tenants.awardWonderForServer(f.users[0].id,theme,{...internal,worldKey:oldWorld.state.saveSlot});assert(skipped.skipped);assert.equal((await f.read()).version,beforeWrongWorld.version);
 await writeFile('qa/v99/'+theme+'-lighthouse-earned.json',JSON.stringify({directory:f.directory,owner:f.users[0].id,theme,visits:a.visits,events:accepted,scope:'Ten isolated guest server accounts, two five-event qualified milestones, real authoritative harbor walking and owned butlers, injected wall clock, no humans or providers'},null,2));
 }finally{await f.service.close();}
});
