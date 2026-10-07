import {createSnapshotEncoder,encodedSnapshotChanges} from '../src/saveDelta.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';
import {mergeActionState,sameState} from '../src/actionMerge.js';

test('receipt merge uses an isolated durable string and preserves a progress change during the reply',async()=>{
 const keys=['localStorage','sessionStorage','document','window','location','Worker','indexedDB'],original=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const data=new Map(),stored=new Map(),merges=[];let duringMerge=null,remote;const snapshotEncoder=createSnapshotEncoder();
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{wood:0,stone:0},history:Array.from({length:1000},(_,i)=>({i,text:'记录'+i}))};remote={version:'v1',state:seed};
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={href:'http://isolated.test/',reload(){}};globalThis.indexedDB={};
 globalThis.Worker=class{
  postMessage(message){const {id,operation,value}=structuredClone(message);setTimeout(()=>{
   try{let result;
    if(operation==='entries')result=[...stored].filter(([k])=>k.startsWith(value));
    else if(operation==='encode')result=JSON.stringify(value);
    else if(operation==='snapshot')result=snapshotEncoder.encode(value);
    else if(operation==='commit'){for(const[k,v]of value)if(v===null)stored.delete(k);else stored.set(k,v);result=true;}
    else if(operation==='request')result={ok:true,status:200,text:JSON.stringify({document:remote})};
    else if(operation==='merge'){
     assert.equal(typeof value.local,'string');merges.push(value);
     let base=JSON.parse(value.base);for(const k of value.path?.split('.')||[])base=base[k];
     const local=JSON.parse(value.local),remote=JSON.parse(value.remote).document.state;
     const state=mergeActionState(base,local,remote);result=value.delta?{changes:encodedSnapshotChanges(local,state),dirty:!sameState(state,remote)}:{serialized:JSON.stringify(state),dirty:!sameState(state,remote)};
     if(duringMerge){const callback=duringMerge;duringMerge=null;callback();}
    }else throw Error(operation);this.onmessage({data:{id,result}});
   }catch(e){this.onmessage({data:{id,error:{message:e.message,code:e.code,path:e.path}}});}
  },0);}
  terminate(){}
 };
 let client;
 try{client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){throw Error('must use worker journal');}});const state=await client.load('pixel');
  state.inventory.wood=2;client.enqueue('pixel',state);remote={version:'v2',state:{...seed,coins:7}};
  duringMerge=()=>{state.inventory.stone=9;client.enqueue('pixel',state);};await client.refresh('pixel');
  assert.equal(merges.length,2);assert.equal(JSON.parse(merges[0].local).inventory.stone,0);assert.equal(JSON.parse(merges[1].local).inventory.stone,9);
  assert.deepEqual(client.status('pixel').state.inventory,{wood:2,stone:9});assert.equal(client.status('pixel').state.coins,7);assert.equal(client.status('pixel').dirty,true);
  const durable=JSON.parse(stored.get('hd-local:hyper-dimension-pixel-v3'));assert.equal(durable.coins,7);assert.equal(durable.inventory.stone,9);
 }finally{if(client){clearTimeout(client.status('pixel').timer);clearTimeout(client.status('pixel').cacheTimer);await client.idle('pixel').catch(()=>{});}for(const k of keys){if(original[k]===undefined)delete globalThis[k];else globalThis[k]=original[k];}}
});

test('non-worker merge reads the saved text and still reports a same-field conflict',async()=>{
 const keys=['localStorage','Worker','indexedDB'],original=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 globalThis.localStorage={getItem(){return null;}};delete globalThis.Worker;delete globalThis.indexedDB;
 try{const {createSaveJournal}=await import('../src/saveJournal.js');const journal=createSaveJournal();const result=await journal.reconcile(JSON.stringify({wood:1,coins:0}),JSON.stringify({wood:2,coins:0}),{wood:1,coins:5});
  assert.deepEqual(result.state,{wood:2,coins:5});assert.equal(result.dirty,true);
  await assert.rejects(journal.reconcile(JSON.stringify({wood:1}),JSON.stringify({wood:2}),{wood:3}),e=>e.code==='save_conflict'&&e.path==='state.wood');journal.dispose();
 }finally{for(const k of keys){if(original[k]===undefined)delete globalThis[k];else globalThis[k]=original[k];}}
});

test('action receipt exposes the current state when progress changes after remote publication',async()=>{
 const keys=['localStorage','sessionStorage','document','window','location','Worker','indexedDB'],original=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const values=new Map(),stored=new Map(),encoder=createSnapshotEncoder(),seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,stewardChat:{sequence:2,messages:[{id:1,role:'user',text:'first'},{id:2,role:'assistant',text:'received'}]},inventory:{wood:0}};let remote={version:'v1',state:structuredClone(seed)},client,published=null,changed=false;
 globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={href:'http://isolated.test/',reload(){}};globalThis.indexedDB={};
 globalThis.Worker=class{
  postMessage(message){const {id,operation,value}=structuredClone(message);setTimeout(()=>{
   try{let result;if(operation==='entries')result=[...stored].filter(([k])=>k.startsWith(value));else if(operation==='encode')result=JSON.stringify(value);else if(operation==='snapshot')result=encoder.encode(value);else if(operation==='commit'){for(const[k,v]of value)if(v===null)stored.delete(k);else stored.set(k,v);result=true;}
   else if(operation==='request'){if(value.url.endsWith('/action'))remote={version:'v2',state:{...remote.state,coins:7}};result={ok:true,status:200,text:JSON.stringify({document:remote})};}
   else if(operation==='merge'){let base=JSON.parse(value.base);for(const k of value.path?.split('.')||[])base=base[k];const local=JSON.parse(value.local),next=JSON.parse(value.remote).document.state,state=mergeActionState(base,local,next);result={changes:encodedSnapshotChanges(local,state),dirty:!sameState(state,next)};}else throw Error(operation);
   this.onmessage({data:{id,result}});
   }catch(e){this.onmessage({data:{id,error:{message:e.message,code:e.code,path:e.path}}});}
  },0);}terminate(){}
 };
 try{
  client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){throw Error('worker required');},onRemoteState:(_,next)=>{
   published=next;
   queueMicrotask(()=>{if(changed)return;changed=true;const updated={...next,stewardChat:{sequence:4,messages:[...next.stewardChat.messages,{id:3,role:'user',text:'next request'},{id:4,role:'assistant',status:'pending',request:'next request'}]}};client.enqueue('pixel',updated);published=updated;});
  }});await client.load('pixel');const response=await client.action('pixel',{operation:'receipt-fixture',requestId:'receipt-race'});
  assert.equal(response.state,published,'a controller must not reapply the earlier remote publication');
  assert.equal(response.state.coins,7);assert.equal(response.state.stewardChat.sequence,4);assert.equal(response.state.stewardChat.messages.at(-1).status,'pending');
  assert.equal(client.status('pixel').dirty,true);const durable=JSON.parse(stored.get('hd-local:hyper-dimension-pixel-v3'));assert.equal(durable.stewardChat.sequence,4);
 }finally{if(client){clearTimeout(client.status('pixel').timer);clearTimeout(client.status('pixel').cacheTimer);await client.idle('pixel').catch(()=>{});}for(const k of keys){if(original[k]===undefined)delete globalThis[k];else globalThis[k]=original[k];}}
});
