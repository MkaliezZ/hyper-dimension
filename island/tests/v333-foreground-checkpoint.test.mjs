import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient as candidate} from '../src/saveClient.js';

const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(label)),5000))]);}finally{clearTimeout(timer);}}

for(const[variant,make]of [['foreground',candidate],['ordinary',candidate]])test(variant+' checkpoint keeps its acknowledged user input while later background state remains durable',async()=>{
 const globals=['localStorage','sessionStorage','document','window','location','fetch'],previous=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected reload');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{},player:{x:0,y:0},farmControl:{version:1},stewardChat:{messages:[]}},entered=[null,deferred(),deferred(),deferred()],gates=[null,deferred(),deferred(),deferred()];
 let revision=1,canonical=structuredClone(seed),local,client,saveCount=0,checkpointDone=false,actionSent=false;const promises=[];
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)}});
  const body=JSON.parse(init.body);
  if(url.endsWith('/save')){const n=++saveCount;assert(n<=3,'No unexplained fourth save');entered[n].resolve(structuredClone(body));await gates[n].promise;assert.equal(body.expectedVersion,'v'+revision);canonical=structuredClone(body.state);revision++;return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)}});}
  assert(url.endsWith('/action'));actionSent=true;assert.equal(body.expectedVersion,'v'+revision);revision++;return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)},receipt:{outcome:'finished'}});
 };
 client=make({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(_,next)=>local=next});
 try{
  local=await client.load('pixel');local.player.x=1;client.enqueue('pixel',local);promises.push(client.flush('pixel'));await bounded(entered[1].promise,'first save did not start');
  // This already-waiting ordinary flush receives the second flight. The user's
  // checkpoint must retain all previous queue barriers and the first actual save.
  promises.push(client.flush('pixel'));local.stewardChat.messages.push({id:'fictional-input',role:'user',text:'按顺序收木材、去海边、再回林地'});client.enqueue('pixel',local);
  const checkpoint=client.checkpoint('pixel',{foreground:variant==='foreground'}).then(()=>checkpointDone=true);promises.push(checkpoint);await new Promise(r=>setImmediate(r));
  assert.equal(checkpointDone,false,'The active earlier save must still block');gates[1].resolve();
  const second=await bounded(entered[2].promise,'second save did not start');assert.equal(second.state.stewardChat.messages[0].id,'fictional-input');
  local.player.y=2;client.enqueue('pixel',local);promises.push(client.flush('pixel'));gates[2].resolve();
  await bounded(entered[3].promise,'later background save did not start');await new Promise(r=>setImmediate(r));
  assert.equal(canonical.stewardChat.messages[0].id,'fictional-input','User intent is actually acknowledged in the canonical second document');
  const beforeThird={checkpointDone,canonicalInputDurable:true,laterBackgroundInFlight:true};assert.equal(checkpointDone,variant==='foreground');
  const command=client.action('pixel',{kind:'craft',operation:'begin',requestId:'fictional-cutoff-command'});promises.push(command);await new Promise(r=>setImmediate(r));assert.equal(actionSent,false,'A game mutation must still wait for the actual third save');
  gates[3].resolve();await bounded(Promise.all(promises),'save/checkpoint/command did not finish');
  assert.equal(canonical.player.y,2);assert.equal(canonical.stewardChat.messages[0].id,'fictional-input');assert(actionSent);assert.equal(revision,5);assert.equal(client.pendingAction('pixel'),null);
 }finally{
  for(const gate of gates)gate?.resolve();await Promise.allSettled(promises);
  if(client){const s=client.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.cacheTail;}
  for(const[k,d]of Object.entries(previous)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
 }
});

test('replaying an older autosave cannot acknowledge later user input',async()=>{
 const globals=['localStorage','sessionStorage','document','window','location','fetch'],previous=Object.fromEntries(globals.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected reload');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{},player:{x:0,y:0},farmControl:{version:1},stewardChat:{messages:[]}},replayEntered=deferred(),replayRelease=deferred(),newSaveEntered=deferred(),newSaveRelease=deferred();
 let revision=1,canonical=structuredClone(seed),local,client,saveCount=0,checkpointDone=false,originalBytes;const promises=[];
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)}});
  assert(url.endsWith('/save'));const body=JSON.parse(init.body),n=++saveCount;
  if(n===1){assert.equal(body.expectedVersion,'v1');originalBytes=init.body;canonical=structuredClone(body.state);revision++;throw TypeError('Fictional committed autosave reply lost');}
  if(n===2){assert.equal(init.body,originalBytes,'The old uncertain save replays identical bytes');replayEntered.resolve();await replayRelease.promise;return Response.json({document:{version:'v2',state:structuredClone(canonical)}});}
  assert.equal(n,3);assert.equal(body.expectedVersion,'v2');newSaveEntered.resolve(body);await newSaveRelease.promise;canonical=structuredClone(body.state);revision++;return Response.json({document:{version:'v'+revision,state:structuredClone(canonical)}});
 };
 client=candidate({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(_,next)=>local=next});
 try{
  local=await client.load('pixel');local.player.x=1;client.enqueue('pixel',local);
  await assert.rejects(client.flush('pixel'),/committed autosave reply lost/);
  local.stewardChat.messages.push({id:'later-input',role:'user',text:'保留这次的新指令'});client.enqueue('pixel',local);
  promises.push(client.flush('pixel'));await bounded(replayEntered.promise,'old save replay did not start');
  promises.push(client.checkpoint('pixel',{foreground:true}).then(()=>checkpointDone=true));await new Promise(r=>setImmediate(r));
  replayRelease.resolve();const body=await bounded(newSaveEntered.promise,'new user input was not saved after old replay');
  assert.equal(canonical.stewardChat.messages.length,0);assert.equal(checkpointDone,false,'An old receipt cannot release the new input checkpoint');assert.equal(body.state.stewardChat.messages[0].id,'later-input');
  newSaveRelease.resolve();await bounded(Promise.all(promises),'checkpoint did not finish after actual new save');
  assert.equal(checkpointDone,true);assert.equal(canonical.stewardChat.messages[0].id,'later-input');assert.equal(revision,3);assert.equal(client.status('pixel').dirty,false);
 }finally{
  replayRelease.resolve();newSaveRelease.resolve();await Promise.allSettled(promises);
  if(client){const s=client.status('pixel');clearTimeout(s.timer);clearTimeout(s.cacheTimer);await s.cacheTail;}
  for(const[k,d]of Object.entries(previous)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}
 }
});
