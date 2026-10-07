import test from 'node:test';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
import {fixture,meet} from './v74-travel-fixture.mjs';import {controlProject} from '../src/projectPlans.js';import {finishVisit} from './v72-recruitment-fixture.mjs';import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function prepare(theme,options){
 const f=await fixture(theme,options);await f.update(s=>{s.freshStartPending=false;for(const id of ['wood','stone','ore','clay','herb','wheat','seed','fish'])s.inventory[id]=100;},0);
 await f.action(1,'travel_invite',{npcId:16});const room=await f.action(0,'room_create',{title:'客岛共同试作',maxPlayers:2});await f.action(1,'room_join',{code:room.view.room.code});
 const e=await meet(f),offer=await f.service.social.cooperate(f.accounts[1].token,{eventId:e.id,operation:'propose'});f.event=offer.event;f.roomId=room.roomId;f.cooperate=(i,operation)=>f.service.social.cooperate(f.accounts[i].token,{eventId:e.id,operation});f.host=()=>f.service.tenants.get(f.accounts[0].token).then(c=>c.saves.current(theme));return f;
}
async function agree(f){await f.cooperate(1,'accept');return (await f.cooperate(0,'accept')).event.cooperation;}
async function progress(f,max=300){
 const path=[];for(let i=0;i<max;i++){await f.step();const view=await f.service.social.view(f.accounts[0].token),e=view.events.find(e=>e.id===f.event.id),c=e.cooperation;
  const r=await f.service.identities.roomStateForServer(f.roomId),actors=[...(r.residents||[]),...Object.values(r.members).flatMap(m=>m.companions||[])].filter(x=>c.parts.some(p=>p.actorId===x.person.actorId));path.push(actors.map(x=>({actorId:x.person.actorId,x:x.x,y:x.y,work:x.meeting?.kind==='work',phase:x.meeting?.phase})));
  if(c.status==='completed'||c.status==='cancelled')return{event:e,path};}
 throw Error('Guest work did not finish');
}
for(const theme of ['pixel','origami'])test(theme+' guest craft: actual workstations, host escrow/outputs, exact original contract survives return',{timeout:90000},async()=>{
 const f=await prepare(theme);try{
  const original=await f.read(),originalHash=hash({recruitment:original.state.recruitment,tasks:original.state.agentTaskLedger,coins:original.state.coins,day:original.state.day}),hostBefore=await f.host(),c=await agree(f);
  assert.equal(c.mode,'host_workshop');assert(c.parts.some(p=>p.contract?.id===f.contract.id));await assert.rejects(f.cooperate(1,'start'),e=>e.code==='lan_social_owner');
  const start=await f.cooperate(0,'start'),reserved=await f.host();assert.equal(start.event.cooperation.status,'assembling');assert.deepEqual(reserved.state.lanEconomyControl.holds[c.holdId].cost,c.cost);
  for(const [id,n]of Object.entries(c.cost))assert.equal(reserved.state.inventory[id],hostBefore.state.inventory[id]-n);assert.equal(reserved.state.coins,hostBefore.state.coins);
  const replay=await f.cooperate(0,'start');assert.equal((await f.host()).version,reserved.version);assert.equal(replay.event.cooperation.funded,true);
  const {event,path}=await progress(f),done=event.cooperation;assert.equal(done.status,'completed');assert(done.elapsed>=20);
  assert(path.some(frame=>frame.some(x=>x.phase==='working')));assert(path.some((frame,i)=>i>0&&frame.some((x,j)=>Math.hypot(x.x-path[i-1][j].x,x.y-path[i-1][j].y)>.1)));
  for(const frame of path){if(frame.length===2)assert(Math.hypot(frame[0].x-frame[1].x,frame[0].y-frame[1].y)>=15);}
  const hostAfter=await f.host(),gains={};for(const p of done.parts){gains[p.item]=(gains[p.item]||0)+1;assert(p.proof.kind==='guest-craft');assert.equal(p.proof.walletReceiptId,'guest:'+event.id+':credit:'+done.parts.indexOf(p));assert(Math.hypot(p.proof.station.x-p.proof.station.target.x,p.proof.station.y-p.proof.station.target.y)<8);}
  for(const id of new Set([...Object.keys(c.cost),...Object.keys(gains)]))assert.equal(hostAfter.state.inventory[id],(hostBefore.state.inventory[id]||0)-(c.cost[id]||0)+(gains[id]||0));
  assert.equal(hostAfter.state.lanEconomyControl.holds[c.holdId],undefined);assert.equal(hostAfter.state.coins,hostBefore.state.coins);
  const guestAfter=await f.read();assert.equal(hash({recruitment:guestAfter.state.recruitment,tasks:guestAfter.state.agentTaskLedger,coins:guestAfter.state.coins,day:guestAfter.state.day}),originalHash);assert.equal(guestAfter.state.crossIslandTasks,undefined);
  const committed=hostAfter.version;await f.service.social.view(f.accounts[0].token);await f.cooperate(0,'start');assert.equal((await f.host()).version,committed);await assert.rejects(f.cooperate(0,'withdraw'));
  const book=JSON.parse(await readFile(f.directory+'/_lan/islands/'+(await f.service.identities.authorize(f.accounts[0].token)).id+'/'+theme+'/lan-wallet.json','utf8'));
  for(const p of done.parts)assert.deepEqual(book.receipts[p.proof.walletReceiptId].result.gain,{[p.item]:1});
  const v=await f.service.identities.view(f.accounts[1].token);await f.action(1,'room_leave',{roomId:f.roomId,expectedRevision:v.room.revision});
  await f.update(s=>{assert(controlProject(s,'travel-plan','resume').ok);});const returned=await f.read(),ended=await finishVisit(f.store,returned,f.contract);assert.equal(returned.state.inventory.wood,6);assert.equal(ended.delivery.fee,8);
  await writeFile('qa/v77/'+theme+'-guest-proof.json',JSON.stringify({passed:true,scope:'Isolated accounts; real registry/escrow/server walking/crafting/return work; social model output deterministic.',originalContractId:f.contract.id,parentRunId:f.contract.runs.at(-1).parent.id,childRunId:f.contract.runs.at(-1).child.id,actualWork:done,positions:path,hostMaterialDelta:c.cost,hostOutputs:gains,originalTasksAndWagePreserved:true,returnOriginalWood:6,returnOriginalFee:8},null,2));
 }finally{await f.service.close();}
});
for(const reason of ['withdraw','leave','expired'])test('guest craft '+reason+' refunds host materials and leaves original hire untouched',{timeout:90000},async()=>{
 const f=await prepare('pixel');try{const before=await f.host(),guest=await f.read(),c=await agree(f);await f.cooperate(0,'start');
 if(reason==='withdraw')await f.cooperate(1,'withdraw');else if(reason==='leave'){const v=await f.service.identities.view(f.accounts[1].token);await f.action(1,'room_leave',{roomId:f.roomId,expectedRevision:v.room.revision});}else f.advance(1800001);
 const history=await f.service.social.history(f.accounts[1].token,16,f.theme,f.contract.id);assert.equal(history.events[0].cooperation.status,'cancelled');const after=await f.host();assert.deepEqual(after.state.inventory,before.state.inventory);assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.lanEconomyControl.holds,{});assert.deepEqual((await f.read()).state.recruitment,guest.state.recruitment);
 await f.service.social.history(f.accounts[1].token,16,f.theme,f.contract.id);assert.equal((await f.host()).version,after.version);
 }finally{await f.service.close();}
});
test('guest craft requires consent and funds and cannot use home queue',{timeout:90000},async()=>{
 const f=await prepare('pixel');try{
  await assert.rejects(f.cooperate(0,'start'));await f.cooperate(0,'accept');await assert.rejects(f.cooperate(0,'start'));
  await f.cooperate(1,'accept');const hostContext=await f.service.tenants.get(f.accounts[0].token),d=await hostContext.saves.current(f.theme),s=structuredClone(d.state);for(const id of Object.keys(f.event.cooperation.cost))s.inventory[id]=0;
  // Trusted fixture modifies resources before reserve; no endpoint can mint these.
  const {createSaveStore}=await import('../server/saveStore.mjs');const raw=createSaveStore({directory:hostContext.directory,externalEconomy:true});await raw.save(f.theme,{state:s,expectedVersion:d.version});
  await assert.rejects(f.cooperate(0,'start'),e=>e.code==='lan_wallet_funds');const c=(await f.service.social.view(f.accounts[0].token)).events[0].cooperation;assert.equal(c.status,'agreed');assert(!c.funded);assert.equal((await f.host()).state.lanEconomyControl,undefined);
  await assert.rejects(f.service.social.queueCooperation(f.accounts[1].token,f.theme,{eventId:f.event.id,operation:'queue',requestId:'guest-home-queue'}),e=>e.code==='lan_social_contract');
 }finally{await f.service.close();}
});

async function httpAction(f,i,operation,args={}){
 const base='http://127.0.0.1:'+f.service.port,r=await fetch(base+'/api/lan/action',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hd_lan_session='+f.accounts[i].token},body:JSON.stringify({operation,requestId:crypto.randomUUID(),...args})}),body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body;
}
for(const operation of ['room_leave','room_close','logout'])test('guest work '+operation+' immediately refunds escrow through HTTP without a social poll',{timeout:90000},async()=>{
 const f=await prepare('pixel');try{
  const before=await f.host();await agree(f);await f.cooperate(0,'start');
  if(operation==='logout'){const r=await fetch('http://127.0.0.1:'+f.service.port+'/api/lan/logout',{method:'POST',headers:{'Content-Type':'application/json',Cookie:'hd_lan_session='+f.accounts[1].token},body:'{}'});assert.equal(r.status,200);}
  else {const i=operation==='room_leave'?1:0,v=await f.service.identities.view(f.accounts[i].token);await httpAction(f,i,operation,{roomId:f.roomId,expectedRevision:v.room.revision});}
  const after=await f.host();assert.deepEqual(after.state.inventory,before.state.inventory);assert.deepEqual(after.state.lanEconomyControl.holds,{});
  const d=JSON.parse(await readFile(f.directory+'/_lan/social.json','utf8'));assert.equal(d.events.find(e=>e.id===f.event.id).cooperation.status,'cancelled');
 }finally{await f.service.close();}
});

for(const cut of ['reserve','capture','credit0','saved'])test('guest work survives service restart after '+cut+' with one material consumption and one output per worker',{timeout:90000},async()=>{
 let fired=false;const fault=(stage,{index,plan})=>{
  const c=plan.next.events.find(e=>e.cooperation?.mode==='host_workshop')?.cooperation;
  const match=cut==='reserve'?stage==='settlement-step'&&plan.steps[0].input.operation==='reserve':cut==='capture'?stage==='settlement-step'&&index===0&&plan.steps[0].input.operation==='capture':cut==='credit0'?stage==='settlement-step'&&index===1&&plan.steps[0].input.operation==='capture':stage==='settlement-saved'&&c?.status==='completed';
  if(match&&!fired){fired=true;throw Error('Injected persistent settlement cut '+cut);}
 };
 const f=await prepare('pixel',{socialFault:fault});try{
  const before=await f.host(),original=(await f.read()).state.recruitment,c=await agree(f);let done;
  if(cut==='reserve'){await assert.rejects(f.cooperate(0,'start'),e=>e.code==='lan_event_settlement_pending');assert(fired);}
  else{await f.cooperate(0,'start');await assert.rejects(progress(f),e=>e.code==='lan_event_settlement_pending'||e.message.startsWith('Injected persistent'));assert(fired);}
  const pending=JSON.parse(await readFile(f.directory+'/_lan/social-settlement.json','utf8'));assert(pending.applied>=1);
  await f.restart(); // Startup resumes the durable plan before accepting pages.
  await assert.rejects(readFile(f.directory+'/_lan/social-settlement.json'),e=>e.code==='ENOENT');
  if(cut==='reserve')done=(await progress(f)).event.cooperation;
  else done=(await f.service.social.view(f.accounts[0].token)).events.find(e=>e.id===f.event.id).cooperation;
  assert.equal(done.status,'completed');const after=await f.host(),gains={};for(const p of done.parts)gains[p.item]=(gains[p.item]||0)+1;
  for(const id of new Set([...Object.keys(c.cost),...Object.keys(gains)]))assert.equal(after.state.inventory[id],(before.state.inventory[id]||0)-(c.cost[id]||0)+(gains[id]||0));
  assert.deepEqual(after.state.lanEconomyControl.holds,{});assert.deepEqual((await f.read()).state.recruitment,original);
  const version=after.version,effects=hash(done.effects);await f.restart();const replay=(await f.service.social.view(f.accounts[0].token)).events.find(e=>e.id===f.event.id).cooperation;
  assert.equal((await f.host()).version,version);assert.equal(hash(replay.effects),effects);
 }finally{await f.service.close();}
});

for(const pin of ['contract','recipe'])test('guest work stops and refunds when its '+pin+' source changes',{timeout:90000},async()=>{
 const f=await prepare('pixel');try{
  const before=await f.host();await agree(f);await f.cooperate(0,'start');
  const {createSaveStore}=await import('../server/saveStore.mjs'),i=pin==='contract'?1:0,ctx=await f.service.tenants.get(f.accounts[i].token),d=await ctx.saves.current(f.theme),s=structuredClone(d.state);
  if(pin==='contract')s.recruitment.active.parentRunId='another-parent-run';
  else{for(const p of f.event.cooperation.parts){delete s.buildings[p.command.buildingId];}}
  const raw=createSaveStore({directory:ctx.directory,externalEconomy:true});await raw.save(f.theme,{state:s,expectedVersion:d.version});
  const c=(await f.service.social.view(f.accounts[0].token)).events.find(e=>e.id===f.event.id).cooperation;assert.equal(c.status,'cancelled');assert(!c.parts.some(p=>p.proof));const after=await f.host();assert.deepEqual(after.state.inventory,before.state.inventory);assert.deepEqual(after.state.lanEconomyControl.holds,{});
 }finally{await f.service.close();}
});

test('corrupt social ledger is preserved and does not block independent home saves after restart',{timeout:90000},async()=>{
 const f=await prepare('pixel');try{
  const before=await f.host(),file=f.directory+'/_lan/social.json',source=await readFile(file,'utf8');
  const broken=source.replace('"version":1','"version":9');assert.notEqual(broken,source);await writeFile(file,broken);await f.restart();
  const r=await fetch('http://127.0.0.1:'+f.service.port+'/api/lan/status'),d=await r.json();assert.equal(r.status,200);assert.equal(d.travel.socialRecovery.ready,false);assert.equal(d.travel.socialRecovery.code,'lan_social_corrupt');
  await assert.rejects(f.service.social.view(f.accounts[0].token),e=>e.code==='lan_social_corrupt');assert.equal(await readFile(file,'utf8'),broken);assert.equal((await f.host()).version,before.version);
 }finally{await f.service.close();}
});
