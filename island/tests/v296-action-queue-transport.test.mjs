import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

const gate=()=>{let release;const waiting=new Promise(resolve=>release=resolve);return {waiting,release};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

async function fixture(run){
 const names=['localStorage','sessionStorage','document','window','location','fetch'];
 const old=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)])),storage=new Map();
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected navigation');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{wood:0},player:{x:0,y:0},farmControl:{version:1},shopfronts:{revision:0,venues:{}}};
 let canonical=structuredClone(seed),version=1,local,client;const order=[],gates=new Map();
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);
  if(url.endsWith('/open'))return Response.json({document:{version:'v'+version,state:structuredClone(canonical)}});
  assert.equal(body.expectedVersion,'v'+version);
  if(url.endsWith('/save'))canonical=structuredClone(body.state);
  else if(url.endsWith('/backup')){order.push('backup');return Response.json({backup:{id:'fictional-backup'}});}
  else{
   order.push(body.requestId);const delayed=gates.get(body.requestId);if(delayed){delayed.started.release();await delayed.waiting.waiting;if(delayed.fail)return Response.json({error:'Fictional uncertain response',code:'save_unavailable'},{status:503});}
   if(body.kind==='commerce')canonical.shopfronts={revision:1,venues:{11:body.listing}};else canonical.inventory.wood++;
  }
  version++;return Response.json({document:{version:'v'+version,state:structuredClone(canonical)},receipt:{outcome:'finished'}});
 };
 client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(_,next)=>local=next});
 const work=id=>client.action('pixel',{kind:'resident',operation:'begin',requestId:id,intent:{npcId:0,action:'rest'}});
 const setting=()=>client.action('pixel',{kind:'commerce',operation:'shopfront',requestId:'shelf-config',buildingId:11,listing:[{item:'wood',keep:1}]},undefined,{foreground:true});
 const hold=(id,fail=false)=>{const value={started:gate(),waiting:gate(),fail};gates.set(id,value);return value;};
 try{local=await client.load('pixel');await run({client,work,setting,hold,order,local:()=>local,canonical:()=>canonical});}
 finally{for(const delayed of gates.values())delayed.waiting.release();const s=client.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.cacheTail;for(const [name,descriptor]of Object.entries(old)){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
}

test('idle still drains every queued job after a foreground setting completes early',()=>fixture(async({client,work,setting,hold,order,local,canonical})=>{
 const first=hold('npc-0'),later=hold('npc-1'),jobs=[work('npc-0')];await first.started.waiting;
 jobs.push(work('npc-1'),work('npc-2'));local().player.x=3;client.enqueue('pixel',local());const configured=setting();
 first.waiting.release();await configured;await later.started.waiting;
 assert.deepEqual(order,['npc-0','shelf-config','npc-1']);let idleDone=false;
 const idle=client.idle('pixel').then(()=>idleDone=true);await tick();assert.equal(idleDone,false,'Foreground completion cannot make older work disappear from idle');
 later.waiting.release();await Promise.all(jobs);await idle;
 assert.equal(canonical().inventory.wood,3);assert.equal(client.status('pixel').state.inventory.wood,3);assert.equal(canonical().player.x,3);assert.equal(canonical().shopfronts.revision,1);assert.equal(client.pendingAction('pixel'),null);
}));

test('a real save-client backup checkpoint cannot be overtaken by a later setting',()=>fixture(async({client,work,setting,hold,order})=>{
 const held=hold('npc-0'),jobs=[work('npc-0')];await held.started.waiting;
 jobs.push(work('npc-1'));const backup=client.backup('pixel');const configured=setting();held.waiting.release();
 await Promise.all([...jobs,backup,configured]);assert.deepEqual(order,['npc-0','npc-1','backup','shelf-config']);
}));

test('an uncertain active command keeps its journal and blocks a promoted setting from sending',()=>fixture(async({client,work,setting,hold,order,canonical})=>{
 const held=hold('npc-0',true),active=work('npc-0');const activeRejected=assert.rejects(active,/Fictional uncertain response/);await held.started.waiting;
 const configured=setting(),configurationRejected=assert.rejects(configured,e=>e.code==='action_pending');held.waiting.release();await Promise.all([activeRejected,configurationRejected]);
 assert(order.every(id=>id==='npc-0'),'No shelf request crosses an uncertain durable command');assert.equal(canonical().inventory.wood,0);assert.equal(canonical().shopfronts.revision,0);assert.equal(client.pendingAction('pixel').body.requestId,'npc-0');
}));
