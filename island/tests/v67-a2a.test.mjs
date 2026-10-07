import {createLanCollaborationStore} from '../server/lanCollaborationStore.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,readFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import {createLanHttpServer} from '../server/lanServer.mjs';import {DEFAULT_RECIPES} from '../src/contentCatalog.js';
async function fixture({fault,modelGate=async()=>{}}={}){
 await mkdir('qa/v67',{recursive:true});const directory=await mkdtemp(resolve('qa/v67/authority-')),calls=[];let clock=Date.now();
 const runtime=({ownerId})=>({documents:'fixture',async call(method,p){if(method==='status')return {hermes:{configured:true}};assert.equal(method,'a2a');calls.push({ownerId,p});await modelGate();await new Promise(r=>setTimeout(r,20));return{source:'hermes',model:'deepseek-flash',ledgerRunId:'run-'+randomUUID(),runId:'provider-'+randomUUID(),reply:{decision:p.stage==='offer'?'propose':p.stage==='confirm'?'confirm':p.preparation.ready?'accept':'clarify',message:p.stage==='review'&&!p.preparation.ready?p.preparation.missing.join('，'):'这是一条经过明确核对的管家协作答复。'}};},async close(){}});
 let service=await createLanHttpServer({directory,port:0,enrollmentKey:'A2A-FIXTURE-KEY',agentRuntimeFactory:runtime,now:()=>clock,collaborationFault:fault}),accounts=[];
 for(let n=0;n<3;n++){const theme=n===1?'origami':'pixel',a=await service.identities.register({login:'cooperate_'+n,password:'fixture-password',name:'协作岛主'+n,islandName:'协作小岛'+n,avatar:'male_'+n,theme});await service.tenants.open(a.token,theme,{});const c=await service.tenants.get(a.token),doc=await c.saves.current(theme),state=structuredClone(doc.state);state.coins=100;state.inventory.wood=3;Object.assign(state.inventory,Object.fromEntries(Object.keys(DEFAULT_RECIPES[1].cost).map(k=>[k,10])));await c.saves.save(theme,{state,expectedVersion:doc.version});accounts.push(a);}
 const call=(n,operation,data={})=>service.collaboration.action(accounts[n].token,{operation,requestId:randomUUID(),...data}),act=(n,operation,data={})=>service.activities.action(accounts[n].token,{operation,requestId:randomUUID(),...data});
 const room=await service.identities.action(accounts[0].token,{operation:'room_create',requestId:randomUUID(),title:'合作茶会',maxPlayers:4});
 const event=await act(0,'publish',{roomId:room.view.room.id,title:'海风协作茶会',kind:'tea',brief:'一起核对茶会的入场准备。',invitees:[accounts[1].view.me.id],requirements:{items:[{item:'wood',quantity:2}],garment:null},prepareSeconds:60,difficulty:1,minQuality:55,economyMode:'funded',deliveryMode:'transfer'});
 await act(1,'respond',{eventId:event.eventId,response:'accepted'});await service.identities.action(accounts[1].token,{operation:'room_join',requestId:randomUUID(),code:room.view.room.code});
 return{service,async restart(){await service.close();service=await createLanHttpServer({directory,port:0,enrollmentKey:'A2A-FIXTURE-KEY',agentRuntimeFactory:runtime,now:()=>clock,collaborationFault:fault});this.service=service;},accounts,call,act,roomId:room.view.room.id,eventId:event.eventId,calls,directory,advance:ms=>clock+=ms};
}
async function until(f,n,id,status){for(let i=0;i<150;i++){const t=(await f.service.collaboration.view(f.accounts[n].token)).tasks.find(t=>t.id===id);if(status.includes(t?.status))return t;await new Promise(r=>setTimeout(r,20));}throw Error('task did not reach '+status);}
async function offer(f){await f.call(0,'preference',{receive:true});await f.call(1,'preference',{receive:true});const r=await f.call(0,'offer',{eventId:f.eventId,recipientId:f.accounts[1].view.me.id});await until(f,0,r.taskId,['offered']);return r.taskId;}
test('two personal agents exchange scoped messages, prepare real held materials and confirm linked receipts',async()=>{
 const f=await fixture();try{
 await assert.rejects(f.call(0,'offer',{eventId:f.eventId,recipientId:f.accounts[1].view.me.id}),e=>e.code==='a2a_consent');
 const id=await offer(f);assert.equal((await f.service.collaboration.view(f.accounts[2].token)).tasks.length,0);await assert.rejects(f.call(2,'review',{taskId:id}),e=>e.code==='a2a_forbidden');
 await f.call(1,'review',{taskId:id});await until(f,1,id,['accepted']);const before=(await f.service.tenants.readIslandForServer(f.accounts[1].view.me.id,'origami')).state;
 const request={operation:'execute',taskId:id,requestId:randomUUID()};const r=await f.service.collaboration.action(f.accounts[1].token,request),replay=await f.service.collaboration.action(f.accounts[1].token,request);assert(replay.replayed);const t=r.view.tasks.find(x=>x.id===id);assert.equal(t.status,'executed');assert.deepEqual(t.receipt.reserved,{coins:12,wood:2});
 const after=(await f.service.tenants.readIslandForServer(f.accounts[1].view.me.id,'origami')).state;assert.equal(after.coins,before.coins-12);assert.equal(after.inventory.wood,before.inventory.wood-2);const host=(await f.service.tenants.readIslandForServer(f.accounts[0].view.me.id,'pixel')).state;assert.equal(host.inventory.wood,3,'preparation must not credit host before the actual event settlement');
 await f.call(0,'confirm',{taskId:id});const complete=await until(f,0,id,['completed']);assert.equal(complete.messages.length,3);assert.equal(f.calls.length,3);assert.equal(f.calls[0].ownerId,f.accounts[0].view.me.id);assert.equal(f.calls[1].ownerId,f.accounts[1].view.me.id);assert.equal(complete.messages[1].parentRunId,complete.messages[0].ledgerRunId);assert.equal(complete.messages[2].parentRunId,complete.messages[1].ledgerRunId);
 const guest=(await f.service.collaboration.view(f.accounts[1].token)).tasks[0];assert.deepEqual(guest,complete);assert(!JSON.stringify(complete).includes('fixture-password'));
 }finally{await f.service.close();}
});
test('lost receipt after real checkin retries the same activity operation and reserves once',async()=>{
 let failOnce=true;const f=await fixture({fault:()=>{if(failOnce){failOnce=false;throw Error('injected lost response');}}});try{
 const id=await offer(f);await f.call(1,'review',{taskId:id});await until(f,1,id,['accepted']);
 await f.call(1,'execute',{taskId:id});assert.equal((await f.service.collaboration.view(f.accounts[1].token)).tasks[0].status,'execution_failed');
 const before=(await f.service.tenants.readIslandForServer(f.accounts[1].view.me.id,'origami')).state;await f.call(1,'execute',{taskId:id});const after=(await f.service.tenants.readIslandForServer(f.accounts[1].view.me.id,'origami')).state;assert.equal(after.coins,before.coins);assert.equal(after.inventory.wood,before.inventory.wood);assert.equal((await f.service.collaboration.view(f.accounts[1].token)).tasks[0].status,'executed');
 }finally{await f.service.close();}
});
test('expiration, consent revocation and forged execution cannot produce completed tasks',async()=>{
 const f=await fixture();try{
 const id=await offer(f);await assert.rejects(f.call(0,'execute',{taskId:id}),e=>e.code==='a2a_stage');await assert.rejects(f.call(1,'execute',{taskId:id}),e=>e.code==='a2a_stage');
 await f.call(1,'preference',{receive:false});assert.equal((await f.service.collaboration.view(f.accounts[0].token)).tasks[0].status,'cancelled');
 await f.call(1,'preference',{receive:true});const second=await f.call(0,'offer',{eventId:f.eventId,recipientId:f.accounts[1].view.me.id});await until(f,0,second.taskId,['offered']);f.advance(1800001);assert.equal((await f.service.collaboration.view(f.accounts[0].token)).tasks.find(t=>t.id===second.taskId).status,'expired');
 await assert.rejects(f.call(0,'confirm',{taskId:second.taskId}),e=>e.code==='a2a_ended');
 }finally{await f.service.close();}
});

test('leaving the room stops collaboration without spending guest resources',async()=>{
 const f=await fixture();try{
 const id=await offer(f);await f.service.identities.action(f.accounts[1].token,{operation:'room_leave',roomId:f.roomId,expectedRevision:(await f.service.identities.view(f.accounts[1].token)).room.revision,requestId:randomUUID()});
 const t=await until(f,0,id,['cancelled']);assert.match(t.error,/离岛/);
 await assert.rejects(f.call(1,'review',{taskId:id}),e=>e.code==='a2a_ended');
 const s=(await f.service.tenants.readIslandForServer(f.accounts[1].view.me.id,'origami')).state;assert.equal(s.coins,100);assert.equal(s.inventory.wood,3);
 }finally{await f.service.close()}
});
test('a late checkin receipt cannot resurrect collaboration cancelled by leaving',async()=>{
 let release,entered;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
 const f=await fixture({fault:async()=>{entered();await gate}});try{
 const id=await offer(f);await f.call(1,'review',{taskId:id});await until(f,1,id,['accepted']);
 const execution=f.call(1,'execute',{taskId:id});await ready;
 await f.service.identities.action(f.accounts[1].token,{operation:'room_leave',roomId:f.roomId,expectedRevision:(await f.service.identities.view(f.accounts[1].token)).room.revision,requestId:randomUUID()});
 await until(f,0,id,['cancelled']);release();await execution;
 const t=await until(f,0,id,['cancelled']);assert(t.receipt?.verified,'keep evidence of the already committed checkin');
 await assert.rejects(f.call(0,'confirm',{taskId:id}),e=>e.code==='a2a_ended');
 }finally{release();await f.service.close()}
});
test('restart after a lost checkin receipt reserves once and can finish confirmation',async()=>{
 let once=true;const f=await fixture({fault:()=>{if(once){once=false;throw Error('lost receipt')}}});try{
 const id=await offer(f);await f.call(1,'review',{taskId:id});await until(f,1,id,['accepted']);await f.call(1,'execute',{taskId:id});
 await f.restart();assert.equal((await f.service.collaboration.view(f.accounts[1].token)).tasks[0].status,'execution_failed');
 await f.call(1,'execute',{taskId:id});const s=(await f.service.tenants.readIslandForServer(f.accounts[1].view.me.id,'origami')).state;
 assert.equal(s.coins,88);assert.equal(s.inventory.wood,1);await f.call(0,'confirm',{taskId:id});await until(f,0,id,['completed']);
 }finally{await f.service.close()}
});

test('a new coordinator recovers interrupted model work and ignores the old reply',async()=>{
 let release,entered,first=true;const gate=new Promise(r=>release=r),ready=new Promise(r=>entered=r);
 const f=await fixture({modelGate:async()=>{if(first){first=false;entered();await gate}}});let replacement;
 try{
 await f.call(0,'preference',{receive:true});await f.call(1,'preference',{receive:true});
 const r=await f.call(0,'offer',{eventId:f.eventId,recipientId:f.accounts[1].view.me.id});await ready;
 replacement=createLanCollaborationStore({directory:f.directory,identities:f.service.identities,tenants:f.service.tenants,activities:f.service.activities,agents:f.service.agents});
 assert.equal((await replacement.view(f.accounts[0].token)).tasks[0].status,'retry');
 release();await f.service.collaboration.close();
 assert.equal((await replacement.view(f.accounts[0].token)).tasks[0].messages.length,0,'old runtime reply must not overwrite recovered state');
 await replacement.action(f.accounts[0].token,{operation:'retry',taskId:r.taskId,requestId:randomUUID()});
 await replacement.close();const t=(await replacement.view(f.accounts[0].token)).tasks[0];assert.equal(t.status,'offered');assert.equal(t.messages.length,1);
 }finally{release();await replacement?.close();await f.service.close()}
});
