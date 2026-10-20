import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

async function fixture(run){
 const names=['localStorage','sessionStorage','document','window','location','fetch'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();let client;
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected navigation');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{wood:0},player:{x:0,y:0},commerceControl:{version:1},stewardChat:{draft:'before'}};
 const q={state:structuredClone(seed),actions:{commerce:{activeSeconds:0,snapshot:{day:1}}},version:1,calls:[],commits:0,seen:new Set()},doc=()=>({version:'v'+q.version,state:structuredClone(q.state),actions:structuredClone(q.actions)});
 try{await run({q,doc,seed,data,make:()=>client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){}})});}
 finally{if(client){const r=client.status('pixel');clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail?.catch(()=>{});clearTimeout(r.timer);clearTimeout(r.cacheTimer);}for(const[k,d]of Object.entries(old)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}
for(const code of ['lan_event_busy','save_busy'])for(const postcommit of [false,true])test('durable autosave replays exact bytes through '+code+' '+(postcommit?'after commit':'before commit')+' and credits clock once',()=>fixture(async({q,doc,make})=>{
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:doc()});assert(url.endsWith('/save'));const body=JSON.parse(init.body);q.calls.push(init.body);
  const commit=()=>{if(!q.seen.has(body.saveId)){q.seen.add(body.saveId);q.state=body.state;q.version++;q.commits++;q.actions.commerce.activeSeconds+=body.activeSeconds;}};
  if(postcommit||q.calls.length===3)commit();if(q.calls.length<3)return Response.json({error:'Owned transient file lock',code},{status:503});return Response.json({document:doc()});
 };
 const client=make(),state=await client.load('pixel');state.stewardChat.draft='after';client.enqueue('pixel',state);client.advanceTime('pixel',.1);await client.flush('pixel');
 assert.equal(q.calls.length,3);assert.equal(new Set(q.calls).size,1);const body=JSON.parse(q.calls[0]);assert(body.saveId);assert.equal(body.expectedVersion,'v1');assert.equal(body.activeSeconds,.1);assert.equal(q.commits,1);assert.equal(q.actions.commerce.activeSeconds,.1);assert.equal(client.status('pixel').state.stewardChat.draft,'after');assert.equal(client.status('pixel').state.coins,0);assert.equal(client.status('pixel').state.inventory.wood,0);assert(!client.status('pixel').dirty);
}));
for(const code of ['lan_event_corrupt','save_corrupt','planning_state_conflict','save_unavailable','EPERM'])test(code+' is not retried as a definite autosave lock and retains the original envelope',()=>fixture(async({q,doc,make,data})=>{
 globalThis.fetch=async(url,init)=>{if(url.endsWith('/open'))return Response.json({document:doc()});q.calls.push(init.body);return Response.json({error:'Owned definite rejection',code},{status:code.endsWith('conflict')?409:503});};
 const client=make(),state=await client.load('pixel');state.stewardChat.draft='after';client.enqueue('pixel',state);await assert.rejects(client.flush('pixel'),e=>e.code===code);assert.equal(q.calls.length,1);assert(data.get('hyper-dimension-pixel-pending-clock-save'));assert.equal(q.commits,0);assert.equal(q.actions.commerce.activeSeconds,0);
}));
for(const code of ['lan_event_busy','save_busy'])test('persistent '+code+' stops at three identical autosave requests and preserves its journal',()=>fixture(async({q,doc,make,data})=>{
 globalThis.fetch=async(url,init)=>{if(url.endsWith('/open'))return Response.json({document:doc()});q.calls.push(init.body);return Response.json({error:'Owned persistent lock',code},{status:503});};
 const client=make(),state=await client.load('pixel');state.stewardChat.draft='after';client.enqueue('pixel',state);await assert.rejects(client.flush('pixel'),e=>e.code===code);assert.equal(q.calls.length,3);assert.equal(new Set(q.calls).size,1);const envelope=JSON.parse(data.get('hyper-dimension-pixel-pending-clock-save'));assert.equal(envelope.body.saveId,JSON.parse(q.calls[0]).saveId);assert.equal(q.commits,0);assert.equal(q.actions.commerce.activeSeconds,0);
}));
test('a legacy save without an idempotent save ID never automatically repeats a lock reply',()=>fixture(async({q,doc,make})=>{
 delete q.state.commerceControl;globalThis.fetch=async(url,init)=>{if(url.endsWith('/open'))return Response.json({document:doc()});q.calls.push(init.body);return Response.json({error:'Owned legacy lock',code:'lan_event_busy'},{status:503});};
 const client=make(),state=await client.load('pixel');state.stewardChat.draft='after';client.enqueue('pixel',state);await assert.rejects(client.flush('pixel'));assert.equal(q.calls.length,1);assert(!JSON.parse(q.calls[0]).saveId);assert.equal(q.commits,0);
}));
