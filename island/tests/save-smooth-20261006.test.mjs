import test from 'node:test';import assert from 'node:assert/strict';import {followPath,followPendingPath} from '../src/movement.js';import {createSaveClient} from '../src/saveClient.js';
test('pending receipt keeps walking and turns without running arrival callback',()=>{
 let arrivals=0;const a={x:0,y:0,path:[{x:5,y:0},{x:5,y:5}],after:()=>arrivals++};
 for(let i=0;i<30;i++)followPendingPath(a,.05,60);
 assert.equal(a.x,5);assert.equal(a.y,5);assert.equal(arrivals,0);assert.equal(a.path.length,1);assert.equal(a.walking,false);
 followPath(a,.05,60);followPath(a,.05,60);assert.equal(arrivals,1);assert.equal(a.path.length,0);
});
test('coalesces burst saves, durably writes latest snapshot before HTTP and on pagehide',async()=>{
 const data=new Map(),listeners={};globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener:(k,fn)=>listeners[k]=fn};globalThis.location={reload(){}};
 let writes=0,notifications=0;const state={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{},player:{x:0,y:0}},doc={version:'v1',state};globalThis.fetch=async()=>Response.json({document:doc});
 const client=createSaveClient({loadLocal:()=>structuredClone(state),storeLocal:(t,s,serialized)=>{assert.deepEqual(JSON.parse(serialized),s);writes++;},onStatus:()=>notifications++});
 try{const s=await client.load('pixel');writes=0;notifications=0;for(let i=1;i<=80;i++){s.coins=i;client.enqueue('pixel',s);}assert.equal(writes,0);assert.equal(notifications,1);await new Promise(r=>setTimeout(r,280));assert.equal(writes,1);
 assert.equal(JSON.parse(localStorage.getItem('hyper-dimension-pixel-pending-server-save')).state.coins,80);
 let requests=0;globalThis.fetch=async(url,init)=>{requests++;const body=JSON.parse(init.body);assert.equal(JSON.parse(localStorage.getItem('hyper-dimension-pixel-pending-server-save')).state.coins,body.state.coins);return Response.json({document:{version:'v'+(requests+1),state:body.state}});};
 s.coins=81;client.enqueue('pixel',s);await client.flush('pixel');assert.equal(requests,1);assert.equal(localStorage.getItem('hyper-dimension-pixel-pending-server-save'),null);
 s.coins=82;client.enqueue('pixel',s);listeners.pagehide();await client.idle('pixel');assert.equal(requests,2);assert.equal(client.status('pixel').state.coins,82);
 }finally{clearTimeout(client.status('pixel').timer);clearTimeout(client.status('pixel').cacheTimer);}
});

test('encoded remote baseline survives local mutation and cached slot is not rewritten',async()=>{
 const data=new Map(),slotWrites=[];
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>{data.set(k,String(v));if(k.endsWith('-active-slot'))slotWrites.push(k);},removeItem:k=>data.delete(k)};
 globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){}};
 const state={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{wood:0},player:{x:0,y:0}},doc={version:'v1',state};
 localStorage.setItem('hyper-dimension-pixel-active-slot',state.saveSlot);slotWrites.length=0;
 globalThis.fetch=async()=>Response.json({document:doc});
 const client=createSaveClient({loadLocal:()=>structuredClone(state),storeLocal(){}});
 try{
  const local=await client.load('pixel');assert.equal(client.status('pixel').remoteState,null);local.inventory.wood=2;client.enqueue('pixel',local);
  globalThis.fetch=async()=>Response.json({document:{version:'v2',state:{...state,coins:7}}});await client.refresh('pixel');
  assert.equal(client.status('pixel').state.inventory.wood,2);assert.equal(client.status('pixel').state.coins,7);assert.equal(slotWrites.length,0);
 }finally{clearTimeout(client.status('pixel').timer);clearTimeout(client.status('pixel').cacheTimer);}
});


test("save copy waits until after all callbacks of the animation frame",async()=>{
 const previous={raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame,document:globalThis.document};
 let callback;const order=[];globalThis.document={hidden:false};globalThis.requestAnimationFrame=fn=>{callback=fn;return 7};globalThis.cancelAnimationFrame=()=>{};
 try{const {yieldForSave}=await import("../src/saveScheduler.js");const waiting=yieldForSave().then(()=>order.push("copy"));callback();await Promise.resolve();order.push("paint");assert.deepEqual(order,["paint"]);await waiting;assert.deepEqual(order,["paint","copy"]);}
 finally{for(const [key,value]of Object.entries({requestAnimationFrame:previous.raf,cancelAnimationFrame:previous.cancel,document:previous.document})){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

test("save copy cannot wait forever when a tab loses its animation frames",async()=>{
 const previous={raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame,document:globalThis.document};
 let cancelled;globalThis.document={hidden:false};globalThis.requestAnimationFrame=()=>42;globalThis.cancelAnimationFrame=id=>{cancelled=id;};
 try{const {yieldForSave}=await import("../src/saveScheduler.js");await Promise.race([yieldForSave(),new Promise((_,reject)=>setTimeout(()=>reject(Error("save stayed blocked")),500))]);assert.equal(cancelled,42);}
 finally{for(const [key,value]of Object.entries({requestAnimationFrame:previous.raf,cancelAnimationFrame:previous.cancel,document:previous.document})){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});


test("reuses a durable snapshot and still records every new generation and receipt",async()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){}};
 const seed={saveSlot:"hyper-dimension-pixel-v3",workshopBests:{},coins:0,inventory:{wood:0},player:{x:0,y:0}};let revision=1,writes=0;const sent=[];
 globalThis.fetch=async(url,init)=>{const body=JSON.parse(init.body);if(url.endsWith("/save")){sent.push(body.state.coins);revision++;}return Response.json({document:{version:"v"+revision,state:body.state||structuredClone(seed)}});};
 const client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal:(t,s,raw)=>{writes++;assert.deepEqual(JSON.parse(raw),s);}});
 try{const state=await client.load("pixel");writes=0;state.coins=1;client.enqueue("pixel",state);await new Promise(r=>setTimeout(r,280));assert.equal(writes,1);await client.flush("pixel");assert.equal(writes,2);assert.deepEqual(sent,[1]);assert.equal(client.status("pixel").version,"v2");
 state.coins=2;client.enqueue("pixel",state);await client.flush("pixel");assert.equal(writes,4);assert.deepEqual(sent,[1,2]);assert.equal(client.status("pixel").version,"v3");assert.equal(localStorage.getItem("hyper-dimension-pixel-pending-server-save"),null);
 }finally{clearTimeout(client.status("pixel").timer);clearTimeout(client.status("pixel").cacheTimer);}
});
