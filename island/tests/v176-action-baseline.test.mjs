import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSaveClient} from '../src/saveClient.js';
import {createSnapshotEncoder,encodedSnapshotChanges} from '../src/saveDelta.js';
import {createSaveResponseCache} from '../src/saveResponse.js';
import {mergeActionState,sameState} from '../src/actionMerge.js';
import {requestWonderDisplay} from '../src/eventWonders.js';
import {setup} from './v93-hosting-fixture.mjs';
import {finish} from './v92-cooperation-fixture.mjs';

// Real server fixture: earned fireworks wonder, then a legitimate resident gather.
// Only browser persistence and the network response-loss boundary are simulated.
for(const worker of [false,true])for(const [loss,legacy] of [[false,false],[true,false],[true,true]])test(`${worker?'worker':'fallback'} ${loss?(legacy?'legacy pending reply and reload':'lost reply and reload'):'normal reply'} preserves a display edited after flush, pays resident once`,async()=>{
 const names=['localStorage','sessionStorage','document','window','location','Worker','indexedDB','fetch'],original=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
 const f=await setup('fireworks','pixel');await f.invite();await f.begin();const earned=await finish(f);assert(earned.document.state.eventWonders.owned.fireworks_orbit);
 const local=new Map(),stored=new Map(),actionRequests=[],envelopes=[],clients=[];let client,armed=false,edited=false,drop=loss;
 globalThis.localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,String(v)),removeItem:k=>local.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={href:'http://isolated.test/',reload(){}};
 const request=async(url,init={})=>{const body=init.body?JSON.parse(init.body):{},op=new URL(url,'http://isolated.test').pathname.split('/').at(-1);let result;
  if(op==='open')result=await f.store.openClient('pixel',body);else if(op==='save')result=await f.store.save('pixel',body);else if(op==='action'){
   actionRequests.push(structuredClone(body));const key='hyper-dimension-pixel-pending-action',text=worker?stored.get('hd-local:'+key):local.get(key);envelopes.push(JSON.parse(text));result=await f.store.action('pixel',body);
   if(drop&&body.kind==='resident'&&body.operation==='finish'){drop=false;throw Error('Accepted response intentionally lost');}
  }else result={document:await f.current()};return {ok:true,status:200,text:JSON.stringify(result)};
 };
 if(worker){globalThis.indexedDB={};globalThis.Worker=class{
  constructor(){this.encoder=createSnapshotEncoder();this.responses=createSaveResponseCache();}
  postMessage(message){const {id,operation,value}=structuredClone(message);setTimeout(async()=>{try{let result;
   if(operation==='entries')result=[...stored].filter(([k])=>k.startsWith(value));else if(operation==='encode')result=JSON.stringify(value);else if(operation==='snapshot')result=this.encoder.encode(value);else if(operation==='commit'){for(const[k,v]of value)if(v===null)stored.delete(k);else stored.set(k,v);result=true;}
   else if(operation==='request'){const r=await request(value.url,value.init);result=this.responses.prepare({...r,url:value.url,headers:value.init?.headers,metadataOnly:value.metadataOnly,actionsVersion:value.actionsVersion});}
   else if(operation==='merge'){let base=JSON.parse(value.base);for(const k of value.path?.split('.')||[])base=base[k];const current=JSON.parse(value.local),remote=JSON.parse(value.remote).document.state,next=mergeActionState(base,current,remote);result={changes:encodedSnapshotChanges(current,next),dirty:!sameState(next,remote)};}
   else throw Error(operation);this.onmessage({data:{id,result}});
  }catch(e){this.onmessage({data:{id,error:{message:e.message,code:e.code,path:e.path}}});}},0);}terminate(){}
 };}else{delete globalThis.Worker;delete globalThis.indexedDB;globalThis.fetch=async(url,init)=>{const r=await request(url,init);return new Response(r.text,{status:r.status});};}
 const make=()=>{const c=createSaveClient({loadLocal:()=>structuredClone(earned.document.state),storeLocal:(theme,state,serialized)=>local.set(state.saveSlot,serialized),onStatus:()=>{
  if(armed&&!edited&&client.status('pixel').status==='saved'){
   // The accepted autosave has completed. A user edit is queued ahead of the
   // continuation which captures the pending resident command's merge base.
   armed=false;queueMicrotask(()=>{edited=true;const s=client.status('pixel').state;assert(requestWonderDisplay(s,'fireworks_orbit',true).ok);client.enqueue('pixel',s);});
  }
 }});clients.push(c);return c;};
 const stop=c=>{clearTimeout(c.status('pixel').timer);clearTimeout(c.status('pixel').cacheTimer);};
 try{
  client=make();await client.load('pixel');const before=client.status('pixel').state.inventory.wood;
  const begin=await client.action('pixel',{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',buildingId:null,action:'work',resource:'wood'},gameTime:100,requestId:randomUUID()});f.advance(begin.ticket.duration*1000);
  const s=client.status('pixel').state;s.playerProfile.bio='The pre-action autosave is legitimate.';client.enqueue('pixel',s);armed=true;
  const input={kind:'resident',operation:'finish',requestId:begin.ticket.requestId,epoch:begin.ticket.epoch,sequence:begin.ticket.sequence};
  if(loss){await assert.rejects(client.action('pixel',input),/Accepted response intentionally lost/);assert(edited);stop(client);
   if(legacy){const key=(worker?'hd-local:':'')+'hyper-dimension-pixel-pending-action',storage=worker?stored:local,old=JSON.parse(storage.get(key));old.baseState=old.baseDocument.document.state;delete old.baseDocument;storage.set(key,JSON.stringify(old));}
   client=make();await client.load('pixel');
  }
  else await client.action('pixel',input);
  assert(edited,'boundary was exercised');assert.equal(client.status('pixel').state.eventWonders.displays.fireworks_orbit,true,'new display must survive the resident response');assert.equal(client.status('pixel').state.inventory.wood,before+2);
  await client.flush('pixel');const disk=await f.current();assert.equal(disk.state.eventWonders.displays.fireworks_orbit,true,'display reaches canonical disk');assert.equal(disk.state.inventory.wood,before+2);assert.equal(disk.actions.receipts.filter(r=>r.ticket?.kind==='resident'&&r.ticket.requestId===input.requestId).length,1);
  const finishes=actionRequests.filter(r=>r.operation==='finish');assert.equal(finishes.length,loss?2:1);assert(finishes.every(r=>r.requestId===input.requestId&&r.epoch===input.epoch&&r.sequence===input.sequence));if(loss)assert.deepEqual(finishes[0],finishes[1],'reload resends exactly the persisted envelope');if(legacy)assert(envelopes.at(-1).baseState&&!envelopes.at(-1).baseDocument,'old baseState envelope actually exercised');
  const envelope=envelopes.find(e=>e.body.operation==='finish');assert.equal(envelope.baseDocument.document.version,envelope.body.expectedVersion);assert.equal(envelope.baseDocument.document.state.eventWonders.displays.fireworks_orbit,undefined,'merge baseline includes only acknowledged changes');
 }finally{for(const c of clients)stop(c);for(const c of clients)await c.idle('pixel').catch(()=>{});for(const key of names)if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];}
});
