import test from 'node:test';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {fixture,complete} from './v69-social-fixture.mjs';import {beginTaskStep} from '../src/taskBoard.js';import {RECIPE_BY_ID} from '../src/contentCatalog.js';
await mkdir('qa/v69',{recursive:true});
async function agreement(f){
 const event=await complete(f);
 await f.service.social.cooperate(f.accounts[0].token,{operation:'propose',eventId:event.id});
 await f.service.social.cooperate(f.accounts[0].token,{operation:'accept',eventId:event.id});
 const one=(await f.service.social.history(f.accounts[0].token,event.people[0].npcId,event.people[0].homeTheme)).events[0];
 assert.equal(one.cooperation.status,'proposed');
 await f.service.social.cooperate(f.accounts[1].token,{operation:'accept',eventId:event.id});
 const v=await f.service.identities.view(f.accounts[0].token);await f.action(0,'room_close',{roomId:f.roomId,expectedRevision:v.room.revision});return event;
}
async function queue(f,n,event,theme){
 const c=await f.service.tenants.get(f.accounts[n].token),doc=await c.saves.current(theme);
 return f.service.social.queueCooperation(f.accounts[n].token,theme,{kind:'cross-social',operation:'queue',eventId:event.id,requestId:randomUUID(),expectedVersion:doc.version});
}
async function produce(f,n,queued,theme){
 const c=await f.service.tenants.get(f.accounts[n].token),s=structuredClone(queued.document.state),t=s.agentTaskLedger.find(t=>t.id===queued.receipt.taskId),recipe=RECIPE_BY_ID[t.command.recipeId];
 // Fixture supplies only this recipe's costs; actual resident work deducts them and yields one product.
 for(const [id,amount]of Object.entries(recipe.cost))s.inventory[id]=(s.inventory[id]||0)+amount;
 beginTaskStep(s,t.id);const saved=await c.saves.save(theme,{state:s,expectedVersion:queued.document.version});
 const started=await c.saves.action(theme,{kind:'resident',operation:'begin',actorId:t.npcId,requestId:randomUUID(),expectedVersion:saved.document.version,expectedSequence:saved.document.actions?.sequence||0,epoch:saved.document.actions?.epoch||null,intent:{...t.command,action:'work',assignmentId:t.id,operationId:t.operationId}});
 f.advance(started.ticket.duration*1000);
 const body={kind:'resident',operation:'finish',requestId:started.ticket.requestId,epoch:started.ticket.epoch,sequence:started.ticket.sequence,expectedVersion:started.document.version};
 const done=await c.saves.action(theme,body);assert(done.document.state.crossIslandTasks[t.id].proof);assert.equal((await c.saves.action(theme,body)).replayed,true);
 return {done,taskId:t.id,recipe};
}
for(const theme of ['pixel','origami'])test(theme+' cross-island agreement requires both owners and actual resident recipe receipts, survives restart and feeds home memories',{timeout:90000},async()=>{
 const f=await fixture(theme);
 try{
  const e=await agreement(f),q0=await queue(f,0,e,theme),q1=await queue(f,1,e,theme);
  assert.equal((await queue(f,0,e,theme)).replayed,true);
  const c=await f.service.tenants.get(f.accounts[0].token),forged=structuredClone(q0.document.state);
  forged.crossIslandTasks[q0.receipt.taskId].proof={item:'tea',quantity:1};
  await assert.rejects(c.saves.save(theme,{state:forged,expectedVersion:q0.document.version}),x=>x.code==='cross_task_conflict');
  const fake=structuredClone(q0.document.state);fake.agentTaskLedger.find(t=>t.id===q0.receipt.taskId).status='done';
  const fakeSaved=await c.saves.save(theme,{state:fake,expectedVersion:q0.document.version});
  const h0=await f.service.social.history(f.accounts[0].token,e.people[0].npcId,theme);assert.equal(h0.events[0].cooperation.parts[0].proof,null);
  const reset=structuredClone(fakeSaved.document.state);reset.agentTaskLedger.find(t=>t.id===q0.receipt.taskId).status='queued';const resetSaved=await c.saves.save(theme,{state:reset,expectedVersion:fakeSaved.document.version});q0.document=resetSaved.document;
  const a=await produce(f,0,q0,theme);
  assert.equal((await f.service.social.history(f.accounts[0].token,e.people[0].npcId,theme)).events[0].cooperation.status,'working');
  const b=await produce(f,1,q1,theme);
  const history=await f.service.social.history(f.accounts[0].token,e.people[0].npcId,theme),cooperation=history.events[0].cooperation;assert.equal(cooperation.status,'completed');assert(cooperation.parts.every(p=>p.proof));
  const context=await f.service.social.contextForOwner(f.accounts[0].view.me.id,theme,a.done.document.state.saveSlot);assert.match(context[e.people[0].npcId].at(-1),/双方已通过生产收据确认完成/);
  await f.service.agents.automatic(f.accounts[0].token,'conversations',{theme,saveSlot:a.done.document.state.saveSlot,residents:[{id:e.people[0].npcId,name:e.people[0].name,memories:[]},{id:14,name:'小果',memories:[]}]});
  assert(f.calls.at(-1).residents.find(p=>p.id===e.people[0].npcId).memories.some(m=>m.includes('双方已通过生产收据确认完成')));
  await f.restart();const again=(await f.service.social.history(f.accounts[1].token,e.people[1].npcId,theme)).events[0];assert.deepEqual(again.cooperation,cooperation);
  assert.equal(a.done.document.state.coins,0);assert.equal(b.done.document.state.coins,0);
  await writeFile('qa/v69/'+theme+'-proof.json',JSON.stringify({directory:f.directory,cooperation,homeModelMemory:context,uniqueProducts:true,noCoinMint:true,scope:'Two synthetic owners; real save transactions and timed resident recipe work; costs supplied by fixture; deterministic model'},null,2));
 }finally{await f.service.close()}
});
test('unauthorized owners, incomplete consent, and a new island cannot activate an old promise',{timeout:90000},async()=>{
 const f=await fixture('pixel');try{
  const e=await complete(f),c=await f.service.tenants.get(f.accounts[0].token),d=await c.saves.current('pixel');
  const outsider=await f.service.identities.register({login:'social_outsider',password:'fixture-password',name:'第三方',islandName:'第三岛',avatar:'male_0',theme:'pixel'});
  await assert.rejects(f.service.social.cooperate(outsider.token,{operation:'propose',eventId:e.id}),x=>x.code==='lan_social_owner');
  await f.service.social.cooperate(f.accounts[0].token,{operation:'propose',eventId:e.id});
  await f.service.social.cooperate(f.accounts[0].token,{operation:'accept',eventId:e.id});
  await assert.rejects(queue(f,0,e,'pixel'));
  await f.service.social.cooperate(f.accounts[1].token,{operation:'accept',eventId:e.id});
  await assert.rejects(queue(f,0,e,'pixel'),x=>x.code==='lan_travel_active');
  const v=await f.service.identities.view(f.accounts[0].token);await f.action(0,'room_close',{roomId:f.roomId,expectedRevision:v.room.revision});
  await c.saves.restart('pixel',{requestId:randomUUID(),expectedVersion:d.version});
  await assert.rejects(queue(f,0,e,'pixel'),x=>x.code==='lan_social_world');
  const old=(await f.service.social.history(f.accounts[1].token,e.people[1].npcId,'pixel')).events[0];assert.equal(old.cooperation.status,'cancelled');
 }finally{await f.service.close()}
});

test('parallel queue requests create one task; withdrawing prevents later work from granting cooperation trust',{timeout:90000},async()=>{
 const f=await fixture('pixel');try{
  const e=await agreement(f),queued=await Promise.all([queue(f,0,e,'pixel'),queue(f,0,e,'pixel')]);
  assert.equal(queued.filter(r=>!r.replayed).length,1);
  const q1=await queue(f,1,e,'pixel');
  await f.service.social.cooperate(f.accounts[1].token,{operation:'withdraw',eventId:e.id});
  const a=await produce(f,0,queued[0],'pixel');await produce(f,1,q1,'pixel');
  const c=(await f.service.social.history(f.accounts[0].token,e.people[0].npcId,'pixel')).events[0].cooperation;
  assert.equal(c.status,'cancelled');assert.equal(c.effects,undefined);assert.equal(a.done.document.state.inventory[a.recipe.item],1);
  await assert.rejects(queue(f,0,e,'pixel'));
 }finally{await f.service.close()}
});
