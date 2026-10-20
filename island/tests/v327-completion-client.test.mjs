import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createSaveClient} from '../src/saveClient.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,RECIPES} from '../src/townSimulation.js';
async function fixture(kind,mode,run){
 const names=['localStorage','sessionStorage','document','window','location','fetch','Worker','indexedDB'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),storage=new Map(),bodies=[],requests=[];let reads=0,attempts=0,client,local,time=100000;
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){},removeEventListener(){}};globalThis.location={href:'http://owned.test/'};globalThis.Worker=undefined;globalThis.indexedDB=undefined;
 const directory=await mkdtemp(join(tmpdir(),'hd-v327-client-')),store=createSaveStore({directory,now:()=>time}),seed=hydrateTown(createZeroState());seed.saveSlot='hyper-dimension-pixel-v3';seed.freshStartPending=false;seed.inventory.axe=1;seed.inventory.pickaxe=1;
 if(kind==='visitor'){seed.coins=100;for(const r of Object.values(RECIPES))seed.inventory[r.item]=4;}
 const command=async body=>{const current=await store.current('pixel');return store.action('pixel',{requestId:randomUUID(),expectedVersion:current.version,...(body.operation==='begin'?{epoch:current.actions.epoch,expectedSequence:current.actions.sequence}:{}),...body});};
 try{
  await store.open('pixel',{legacyState:seed,protect:true});let ticket;
  if(kind==='visitor'){
   await command({kind,operation:'enable',theme:'pixel'});for(const seconds of [15,5]){const d=await store.current('pixel');time+=seconds*1000;await store.save('pixel',{state:d.state,expectedVersion:d.version,activeSeconds:seconds,saveId:randomUUID()});}
   const arrival=await command({kind,operation:'arrive'}),guest=arrival.receipt.accepted[0];assert(guest);time=Math.max(time,guest.landReadyAt);await command({kind,operation:'land',guestId:guest.id});ticket=(await command({kind,operation:'begin',guestId:guest.id,stop:0,buildingId:guest.itinerary[0]})).ticket;assert(ticket.quote.item&&ticket.quote.net>0);
  }else if(kind==='resident')ticket=(await command({kind,operation:'begin',actorId:5,intent:{goal:'forest',action:'work',resource:'wood',source:'rule'}})).ticket;
  else ticket=(await command({kind,operation:'begin',field:'mine',actor:'npc',actorId:5,index:0,itemId:'ore'})).ticket;
  time=ticket.readyAt;const before=await store.current('pixel');
  globalThis.fetch=async(url,init={})=>{
   const path=new URL(url,'http://owned.test').pathname,operation=path.split('/')[4]||'',body=init.body?JSON.parse(init.body):{};requests.push({operation,method:init.method||'GET',requestId:body.requestId});
   if(!operation){reads++;if(mode==='get-failed')return Response.json({error:'Owned authority read unavailable',code:'save_unavailable'},{status:503});const document=await store.current('pixel');if(mode==='wrong-world')document.state.saveSlot='hyper-dimension-pixel-v3-restart-other-world';if(mode==='missing-receipt')document.actions.receipts=[];if(mode==='wrong-receipt')document.actions.receipts.find(r=>r.ticket.requestId===ticket.requestId).ticket.sequence++;return Response.json({document});}
   try{
    if(operation==='action'&&body.operation==='finish'){
     attempts++;bodies.push(init.body);
     if(mode==='uncommitted')throw new DOMException('Owned expired completion','AbortError');
     let result;if(mode==='cancelled'&&attempts===1)result=await store.action('pixel',{...body,operation:'cancel'});else result=await store.action('pixel',body);
     if(mode==='connection-lost')throw new TypeError('Owned lost connection');
     if(mode==='finished'&&attempts===1){local={...local,player:{...local.player,x:local.player.x+9}};client.enqueue('pixel',local);}
     if(attempts<=(mode==='first-only'?1:2))throw new DOMException('Owned expired completion','AbortError');
     return Response.json(result);
    }
    const result=operation==='open'?await store.open('pixel',body):operation==='save'?await store.save('pixel',body):{document:await store.current('pixel')};return Response.json(result);
   }catch(error){if(error.status)return Response.json({error:error.message,code:error.code},{status:error.status});throw error;}
  };
  client=createSaveClient({loadLocal:()=>createZeroState(),storeLocal(){},onRemoteState:(_,state)=>local=state});local=await client.load('pixel');const initialX=local.player.x,input={kind,operation:'finish',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence};
  await run({client,store,ticket,before,bodies,requests,input,initialX,local:()=>local,reads:()=>reads,attempts:()=>attempts});
 }finally{
  if(client){const r=client.status('pixel');clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail;clearTimeout(r.timer);clearTimeout(r.cacheTimer);}
  for(const[k,d]of Object.entries(old))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];
 }
}
for(const kind of ['resident','field','visitor']){
 for(const mode of ['finished','first-only'])test(kind+' '+mode+' reconciles only the stored receipt and continues independent edits',()=>fixture(kind,mode,async f=>{
  const r=await f.client.action('pixel',f.input);assert.equal(r.replayed,true);assert.equal(!!r.recoveredReceipt,mode==='finished');assert.equal(f.reads(),mode==='finished'?1:0);assert.equal(f.attempts(),2);assert.equal(new Set(f.bodies).size,1);assert.equal(f.client.pendingAction('pixel'),null);if(mode==='finished')assert.equal(r.state.player.x,f.initialX+9);
  await f.client.flush('pixel');const done=await f.store.current('pixel');assert.equal(done.actions.receipts.filter(r=>r.ticket.requestId===f.ticket.requestId).length,1);assert.equal(done.actions[kind].leases[f.ticket.requestId],undefined);assert.equal(f.local().coins,done.state.coins);assert.deepEqual(f.local().inventory,done.state.inventory);
  if(kind==='visitor'){assert.equal(done.state.coins,f.before.state.coins+f.ticket.quote.net);assert.equal(done.state.inventory[f.ticket.quote.item],f.before.state.inventory[f.ticket.quote.item]-1);}else if(kind==='field'){assert.equal(done.state.inventory.stone,f.before.state.inventory.stone+1);assert.equal(done.state.oreNodes[0].hp,f.before.state.oreNodes[0].hp-1);assert.equal(done.state.inventory.ore,f.before.state.inventory.ore);}else assert.equal(done.state.inventory.wood,f.before.state.inventory.wood+2);
 }));
 for(const mode of ['uncommitted','missing-receipt','wrong-world','cancelled','get-failed','wrong-receipt','connection-lost'])test(kind+' '+mode+' preserves the original uncertain journal and does not invent completion',()=>fixture(kind,mode,async f=>{
  await assert.rejects(f.client.action('pixel',f.input),mode==='connection-lost'?/Owned lost connection/:/Owned expired completion/);
  assert.equal(f.attempts(),mode==='connection-lost'?1:2);assert.equal(f.reads(),mode==='connection-lost'?0:1);assert.equal(new Set(f.bodies).size,1);assert.equal(f.client.status('pixel').status,'action_pending');assert(f.client.blocked('pixel'));assert.deepEqual(f.client.pendingAction('pixel').body,JSON.parse(f.bodies[0]));assert.equal(f.local().coins,f.before.state.coins);assert.deepEqual(f.local().inventory,f.before.state.inventory);
  const done=await f.store.current('pixel');if(mode==='uncommitted'){assert(done.actions[kind].leases[f.ticket.requestId]);assert.equal(done.actions.receipts.filter(r=>r.ticket.requestId===f.ticket.requestId).length,0);}else assert.equal(done.actions.receipts.filter(r=>r.ticket.requestId===f.ticket.requestId).length,1);
 }));
}
