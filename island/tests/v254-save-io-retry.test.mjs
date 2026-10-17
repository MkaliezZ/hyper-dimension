import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

async function fixture(fn){
 const names=['localStorage','sessionStorage','document','window','location','fetch'],previous=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();let client;
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('No progress replacement is allowed');}};
 const seed={saveSlot:'fictional-io-retry',workshopBests:{},coins:0,inventory:{wood:0},player:{x:0,y:0}};
 try{return await fn({seed,make:options=>client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},...options})});}
 finally{if(client){const s=client.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.cacheTail?.catch(()=>{});}for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}}
}

for(const committedBeforeError of [false,true])test('a temporary I/O reply retries the same durable command '+(committedBeforeError?'after an actual commit':'before commit')+' without a second gain',()=>fixture(async({seed,make})=>{
 let canonical=structuredClone(seed),calls=0,commits=0;const bodies=[];
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:structuredClone(canonical)}});
  assert(url.endsWith('/action'));bodies.push(init.body);calls++;
  if((committedBeforeError||calls===3)&&commits===0){commits++;canonical.inventory.wood=2;}
  if(calls<=2)return Response.json({error:'Temporary Windows file sharing',code:'EPERM'},{status:503});
  return Response.json({document:{version:'v2',state:structuredClone(canonical)},receipt:{outcome:'finished',gain:{wood:2}},replayed:committedBeforeError});
 };
 const client=make();await client.load('pixel');const result=await client.action('pixel',{kind:'field',operation:'finish',requestId:'fictional-same-command',epoch:'original-epoch',sequence:3});
 assert.equal(calls,3);assert.equal(new Set(bodies).size,1,'Request/version/epoch/sequence/client ID must remain byte-identical');assert.equal(JSON.parse(bodies[0]).expectedVersion,'v1');assert.equal(commits,1);assert.equal(result.state.inventory.wood,2);assert.equal(client.status('pixel').state.coins,0);assert.equal(client.pendingAction('pixel'),null);assert.equal(client.status('pixel').status,'saved');
}));

test('persistent I/O failure stops after bounded retries and retains the original recovery envelope',()=>fixture(async({seed,make})=>{
 const bodies=[];globalThis.fetch=async(url,init)=>{if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});bodies.push(init.body);return Response.json({error:'Still occupied',code:'EPERM'},{status:503});};
 const client=make();await client.load('pixel');await assert.rejects(client.action('pixel',{kind:'field',operation:'begin',requestId:'fictional-persistent-command'}),e=>e.status===503&&e.code==='EPERM');assert.equal(bodies.length,3);assert.equal(new Set(bodies).size,1);assert.equal(client.pendingAction('pixel').body.requestId,'fictional-persistent-command');assert.equal(client.status('pixel').status,'action_pending');assert.equal(client.status('pixel').state.inventory.wood,0);
 await assert.rejects(client.action('pixel',{kind:'field',operation:'begin',requestId:'must-not-overtake'}),e=>e.code==='action_pending');assert.equal(bodies.length,3);
}));

for(const[status,code]of[[409,'save_conflict'],[401,'unauthorized'],[500,'EPERM'],[503,'unknown_storage_error']])test('non-transient '+status+'/'+code+' never silently retries or changes progress',()=>fixture(async({seed,make})=>{
 let calls=0;globalThis.fetch=async(url)=>{if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});calls++;return Response.json({error:'Explicit failure',code},{status});};
 const client=make();await client.load('pixel');await assert.rejects(client.action('pixel',{kind:'personal',operation:'home_activity',requestId:'no-implicit-adoption'}),e=>e.code===code);assert.equal(calls,1);assert.equal(client.status('pixel').state.inventory.wood,0);assert.equal(client.status('pixel').state.coins,0);
}));
