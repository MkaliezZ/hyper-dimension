import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

test('confirmed recovery stays sealed until the old page unloads, even when navigation is delayed',async()=>{
 const names=['localStorage','sessionStorage','document','window','location','fetch'],previous=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),values=new Map(),events={};
 globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener:(name,fn)=>{events[name]=fn;}};
 const stale={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:9,inventory:{wood:2},resourceControl:{version:1,enabled:true},resourceLedger:{version:1,sequence:1,reservations:{'unfinished-craft':{items:{wood:2}}},receipts:{},events:[]}},canonical=structuredClone(stale);canonical.resourceLedger.reservations={};
 let client,reloads=0,reads=0;
 globalThis.location={reload(){reloads++;client.enqueue('pixel',stale);}};
 globalThis.fetch=async()=>Response.json({document:{version:++reads===1?'old-version':'confirmed-version',state:structuredClone(reads===1?stale:canonical)}});
 client=createSaveClient({loadLocal:()=>structuredClone(stale),storeLocal(){}});
 try{
  await client.load('pixel');await client.acceptServer('pixel');
  // Browsers can keep executing timers and RAF callbacks after reload() returns.
  // These callbacks still close over the old game state, not the adopted record.
  client.enqueue('pixel',stale);events.pagehide();await client.idle('pixel');
  assert.deepEqual(client.status('pixel').state.resourceLedger,canonical.resourceLedger);
  assert.equal(client.status('pixel').dirty,false);assert.equal(localStorage.getItem('hyper-dimension-pixel-pending-server-save'),null);
  assert(client.blocked('pixel'),'a committed recovery must not resume the outgoing simulation');
  await assert.rejects(client.action('pixel',{kind:'resident',operation:'begin',requestId:'old-page-job'}),e=>e.code==='save_recovering');
  await client.acceptServer('pixel');assert.equal(reloads,1,'repeated clicks cannot start another recovery while unloading');assert.equal(reads,2);
 }finally{const r=client.status('pixel');clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail;for(const[k,d]of Object.entries(previous))if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
});
