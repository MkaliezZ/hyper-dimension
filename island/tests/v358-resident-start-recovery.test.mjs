import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createSaveClient} from '../src/saveClient.js';
import {residentStartRecoveryContext,canonicalResidentStartResult} from '../src/residentStartRecovery.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';

async function fixture(theme,mode,run){
 const names=['localStorage','sessionStorage','document','window','location','fetch','Worker','indexedDB'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),storage=new Map(),bodies=[];
 let reads=0,attempts=0,client,local,time=100000;
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.location={href:'http://owned.test/'};globalThis.Worker=undefined;globalThis.indexedDB=undefined;
 const directory=await mkdtemp(join(tmpdir(),'hd-v358-start-')),store=createSaveStore({directory,now:()=>time}),seed=hydrateTown(createZeroState());seed.saveSlot='hyper-dimension-'+theme+'-v3';seed.freshStartPending=false;seed.inventory.axe=1;
 const input={kind:'resident',operation:'begin',requestId:randomUUID(),actorId:5,gameTime:5,intent:{goal:'forest',action:'work',resource:'wood',source:'rule',operationId:'npc-work:'+randomUUID()}};
 try{
  await store.open(theme,{legacyState:seed,protect:true});
  globalThis.fetch=async(url,init={})=>{
   const operation=new URL(url,'http://owned.test').pathname.split('/')[4]||'',body=init.body?JSON.parse(init.body):{};
   if(!operation){
    reads++;if(mode==='get-failed')return Response.json({error:'Owned read unavailable',code:'save_unavailable'},{status:503});
    const document=await store.current(theme),ticket=document.actions.resident?.leases?.[input.requestId];
    if(mode==='wrong-world')document.state.saveSlot+='-other';
    if(mode==='wrong-epoch')document.actions.epoch=randomUUID();
    if(ticket){
     if(mode==='wrong-actor')ticket.actorId++;
     if(mode==='wrong-sequence')ticket.sequence++;
     if(mode==='wrong-operation')ticket.operationId+='-other';
     if(mode==='wrong-intent-operation')ticket.intent.operationId+='-other';
     if(mode==='wrong-resource')ticket.intent.resource='bark';
     if(mode==='wrong-assignment')ticket.assignmentId='another-assignment';
     if(mode==='missing-signature')delete ticket.beginSignature;
     if(mode==='wrong-signature')ticket.beginSignature=ticket.beginSignature.replace('wood','bark');
     if(mode==='invalid-times')ticket.readyAt=ticket.startedAt;
     if(mode==='contradictory-receipt')document.actions.receipts.push({ticket:structuredClone(ticket),outcome:'cancelled',at:time});
     if(mode==='missing-lease')delete document.actions.resident.leases[input.requestId];
    }
    return Response.json({document});
   }
   try{
    if(operation==='action'&&body.operation==='begin'){
     attempts++;bodies.push(init.body);
     if(mode==='uncommitted')throw new DOMException('Owned lost start acknowledgement','AbortError');
     const result=await store.action(theme,body);
     if(mode==='connection-lost')throw new TypeError('Owned connection lost');
     if(mode==='accepted'&&attempts===1){local={...local,player:{...local.player,x:local.player.x+9}};client.enqueue(theme,local);}
     if(attempts<=(mode==='first-only'?1:2))throw new DOMException('Owned lost start acknowledgement','AbortError');
     return Response.json(result);
    }
    return Response.json(operation==='open'?await store.open(theme,body):operation==='save'?await store.save(theme,body):operation==='action'?await store.action(theme,body):{document:await store.current(theme)});
   }catch(error){if(error.status)return Response.json({error:error.message,code:error.code},{status:error.status});throw error;}
  };
  client=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){},onRemoteState:(_,state)=>local=state});local=await client.load(theme);
  const before=await store.current(theme),initialX=local.player.x;
  await run({client,store,input,before,initialX,bodies,local:()=>local,reads:()=>reads,attempts:()=>attempts,setTime:value=>time=value});
 }finally{
  if(client){const r=client.status(theme);clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail;clearTimeout(r.timer);clearTimeout(r.cacheTimer);}
  for(const[k,d]of Object.entries(old))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];
  const target=resolve(directory);assert.equal(dirname(target),resolve(tmpdir()));assert(basename(target).startsWith('hd-v358-start-'));await rm(target,{recursive:true,force:true});
 }
}

for(const theme of ['pixel','origami']){
 for(const mode of ['accepted','first-only'])test(theme+' '+mode+' resumes the actual accepted lease once, before any reward',()=>fixture(theme,mode,async f=>{
  const result=await f.client.action(theme,f.input),ticket=result.ticket;
  assert.equal(f.attempts(),2);assert.equal(f.reads(),mode==='accepted'?1:0);assert.equal(new Set(f.bodies).size,1);assert.equal(!!result.recoveredStart,mode==='accepted');assert.equal(f.client.pendingAction(theme),null);assert.equal(f.client.blocked(theme),false);
  const started=await f.store.current(theme);assert.equal(started.actions.sequence,f.before.actions.sequence+1);assert.deepEqual(started.actions.resident.leases[f.input.requestId],ticket);assert.equal(started.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId).length,0);assert.deepEqual(started.state.inventory,f.before.state.inventory);
  if(mode==='accepted')assert.equal(result.state.player.x,f.initialX+9);
  f.setTime(ticket.readyAt);await f.client.action(theme,{kind:'resident',operation:'finish',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});await f.client.flush(theme);
  const done=await f.store.current(theme);assert.equal(done.actions.resident.leases[ticket.requestId],undefined);assert.equal(done.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId).length,1);assert.equal(done.state.inventory.wood,f.before.state.inventory.wood+2);assert.deepEqual(f.local().inventory,done.state.inventory);
 }));
 for(const mode of ['uncommitted','missing-lease','wrong-world','wrong-epoch','wrong-actor','wrong-sequence','wrong-operation','wrong-intent-operation','wrong-resource','wrong-assignment','missing-signature','wrong-signature','invalid-times','contradictory-receipt','get-failed','connection-lost'])test(theme+' '+mode+' retains the original uncertain command and invents no result',()=>fixture(theme,mode,async f=>{
  await assert.rejects(f.client.action(theme,f.input),mode==='connection-lost'?/Owned connection lost/:/Owned lost start acknowledgement/);
  assert.equal(f.attempts(),mode==='connection-lost'?1:2);assert.equal(f.reads(),mode==='connection-lost'?0:1);assert.equal(new Set(f.bodies).size,1);assert.equal(f.client.status(theme).status,'action_pending');assert(f.client.blocked(theme));assert.deepEqual(f.client.pendingAction(theme).body,JSON.parse(f.bodies[0]));assert.deepEqual(f.local().inventory,f.before.state.inventory);
  const done=await f.store.current(theme);assert.equal(done.actions.receipts.filter(r=>r.ticket.requestId===f.input.requestId).length,0);assert.deepEqual(done.state.inventory,f.before.state.inventory);assert.equal(done.actions.sequence,f.before.actions.sequence+(mode==='uncommitted'?0:1));
 }));
}
test('Unbound, player, other-kind and stale-sequence starts cannot authorize a canonical recovery',()=>{
 const base={kind:'resident',operation:'begin',requestId:randomUUID(),actorId:5,epoch:randomUUID(),expectedSequence:3,intent:{goal:'forest',action:'work',operationId:'npc-work:'+randomUUID()}},actions={epoch:base.epoch,sequence:3};
 const context=residentStartRecoveryContext(base,actions,'owned-world');assert(context);base.intent.goal='dock';assert.equal(context.input.intent.goal,'forest');
 for(const change of [{actor:'player'},{kind:'field'},{operation:'finish'},{expectedSequence:2},{epoch:randomUUID()},{actorId:17},{intent:{goal:'forest',action:'work'}}])assert.equal(residentStartRecoveryContext({...base,...change},actions,'owned-world'),null);
 assert.equal(canonicalResidentStartResult(null,{}),null);
});
