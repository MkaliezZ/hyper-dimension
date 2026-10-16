import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveClient} from '../src/saveClient.js';
import {RECIPE_BY_ID} from '../src/contentCatalog.js';

for(const mode of ['preserve','cancel','lost-cancel-response','different-ticket'])test('recovery return: '+mode,async()=>{
 const names=['localStorage','sessionStorage','document','window','location','fetch'],previous=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),values=new Map();
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};globalThis.sessionStorage=localStorage;
 let reloads=0;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){reloads++}};
 await mkdir('qa/v205',{recursive:true});const store=createSaveStore({directory:await mkdtemp(resolve('qa/v205/recovery-'))}),seed=hydrateTown(createZeroState()),recipe=RECIPE_BY_ID.recipe_c14_8;
 seed.freshStartPending=false;seed.coins=100;for(const[id,n]of Object.entries(recipe.cost))seed.inventory[id]=n;
 let doc=(await store.open('pixel',{legacyState:seed,protect:true})).document;
 const begun=await store.action('pixel',{kind:'craft',operation:'begin',recipeId:recipe.id,mode:'auto',requestId:crypto.randomUUID(),expectedVersion:doc.version,expectedSequence:doc.actions.sequence,epoch:doc.actions.epoch});doc=begun.document;
 const ticket=begun.ticket,identity={kind:ticket.kind,requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence};let lose=mode==='lost-cancel-response',cancelRequests=0;
 globalThis.fetch=async(url,init={})=>{const body=JSON.parse(init.body||'{}');try{let result;if(url.endsWith('/open'))result=await store.openClient('pixel',body);else if(url.endsWith('/action')){cancelRequests++;assert.equal(body.operation,'cancel');assert.deepEqual(JSON.parse(localStorage.getItem('hyper-dimension-pixel-pending-action')).body,body);result=await store.action('pixel',body);if(lose){lose=false;throw Error('Fictional lost response');}}else result={document:await store.current('pixel')};return Response.json(result);}catch(e){if(!e.code)throw e;return Response.json({code:e.code,error:e.message},{status:e.status||500});}};
 const client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){}});
 try{
  await client.load('pixel');const options={cancelActive:true,expectedActive:identity};
  if(mode==='different-ticket'){await assert.rejects(client.acceptServer('pixel',{...options,expectedActive:{...identity,requestId:'another-job'}}),e=>e.code==='action_recovery_changed');assert.equal(cancelRequests,0);assert.equal(reloads,0);assert.equal((await store.current('pixel')).actions.active.requestId,ticket.requestId);return;}
  if(mode==='lost-cancel-response'){await assert.rejects(client.acceptServer('pixel',options),/lost response/);assert.equal(reloads,0);assert.equal(client.pendingAction('pixel').body.operation,'cancel');assert.equal((await store.current('pixel')).actions.active,null);}
  await client.acceptServer('pixel',mode==='preserve'?undefined:options);
  const after=await store.current('pixel');assert.equal(reloads,1);
  if(mode==='preserve'){assert.equal(after.actions.active.requestId,ticket.requestId);assert.equal(cancelRequests,0);}
  else{assert.equal(after.actions.active,null);assert.equal(after.actions.receipts.filter(r=>r.ticket.requestId===ticket.requestId&&r.outcome==='cancelled').length,1);assert.equal(after.state.inventory.c14_8||0,0);assert.equal(after.state.coins,100);for(const[id,n]of Object.entries(recipe.cost))assert.equal(after.state.inventory[id],n);assert.equal(client.pendingAction('pixel'),null);assert.equal(cancelRequests,mode==='lost-cancel-response'?2:1);}
 }finally{const r=client.status('pixel');clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail;for(const[k,d]of Object.entries(previous))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
