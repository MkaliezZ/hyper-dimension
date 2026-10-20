import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

// Pure client ordering/durability guards;the separate native test uses real
// IndexedDB Workers and authoritative SaveStore. This mock does not prove game outcomes.
async function fixture(run){
 const names=['localStorage','sessionStorage','document','window','location','fetch'],old=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('Unexpected navigation');}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',day:1,workshopBests:{},coins:0,inventory:{wood:0},player:{x:0,y:0},stewardChat:{draft:'initial'},commerceControl:{version:1}},q={version:1,state:structuredClone(seed),actions:{commerce:{snapshot:{day:1}}},requests:[],failSave:false};let local,client;
 const documentOf=()=>({version:'v'+q.version,state:structuredClone(q.state),actions:structuredClone(q.actions)});
 globalThis.fetch=async(url,init={})=>{
  const op=url.split('/').at(-1),body=init.body?JSON.parse(init.body):null;q.requests.push({op,body});
  if(op==='open')return Response.json({document:documentOf()});
  if(op==='save'&&q.failSave)return Response.json({code:'save_unavailable',error:'Owned uncertain autosave'},{status:503});
  assert.equal(body.expectedVersion,'v'+q.version,'Every request must reserve the acknowledged current version');
  if(op==='save')q.state=structuredClone(body.state);
  else if(op==='action')q.state.harnessRegistrations=(q.state.harnessRegistrations||0)+1;
  else throw Error('Unexpected mock endpoint');
  q.version++;return Response.json({document:documentOf(),receipt:{outcome:'finished'}});
 };
 client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(_,next)=>local=next});
 const edit=draft=>{local.stewardChat.draft=draft;client.enqueue('pixel',local);};
 const checkpoint=async(foreground=true)=>{edit('before');await client.checkpoint('pixel',{foreground});q.requests.length=0;edit('after');};
 const command=(options={foreground:true},extra={})=>client.action('pixel',{kind:'commerce',operation:'plan_batch',requestId:'owned-command-'+(q.version+1),day:1,...extra},undefined,options);
 try{local=await client.load('pixel');q.requests.length=0;await run({q,client,data,local:()=>local,edit,checkpoint,command});}
 finally{const r=client.status('pixel');clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail;clearTimeout(r.timer);clearTimeout(r.cacheTimer);for(const[k,d]of Object.entries(old)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}}
}

test('acknowledged manual planning retains the durable local draft while posting only the canonical command',()=>fixture(async({q,client,local,checkpoint,command})=>{
 await checkpoint();await command();assert.deepEqual(q.requests.map(r=>r.op),['action']);assert.equal(q.state.stewardChat.draft,'before');assert.equal(local().stewardChat.draft,'after');assert.equal(local().harnessRegistrations,1);assert(client.status('pixel').dirty);await client.flush('pixel');assert.equal(q.state.stewardChat.draft,'after');assert.equal(q.state.coins,0);assert.equal(q.state.inventory.wood,0);assert(q.requests.every(r=>!Object.hasOwn(r.body,'foreground')));
}));
test('the acknowledged planning checkpoint is consumed once',()=>fixture(async({q,checkpoint,command,edit})=>{
 await checkpoint();await command();q.requests.length=0;edit('second');await command();assert.deepEqual(q.requests.map(r=>r.op),['save','action']);assert.equal(q.state.stewardChat.draft,'second');
}));
for(const mode of ['unstamped','ordinary-checkpoint','automatic','other-day','consuming-operation','wrong-world-marker'])test(mode+' retains the original pre-action save',()=>fixture(async({q,client,edit,checkpoint,command})=>{
 if(mode==='unstamped')edit('after');else await checkpoint(mode!=='ordinary-checkpoint');
 if(mode==='wrong-world-marker')client.status('pixel').planningCheckpointWorld='another-confirmed-world';
 await command({foreground:mode!=='automatic'},mode==='other-day'?{day:2}:mode==='consuming-operation'?{operation:'supply'}:{});
 assert.deepEqual(q.requests.map(r=>r.op),['save','action']);assert.equal(q.state.stewardChat.draft,'after');
}));
test('an unknown autosave keeps its exact envelope and cannot be bypassed by the planning marker',()=>fixture(async({q,client,data,checkpoint,command})=>{
 await checkpoint();q.failSave=true;await assert.rejects(client.flush('pixel'));const key='hyper-dimension-pixel-pending-clock-save',before=data.get(key);assert(before);q.requests.length=0;await assert.rejects(command());assert(!q.requests.some(r=>r.op==='action'));assert.equal(data.get(key),before);assert.equal(q.state.harnessRegistrations,undefined);
}));
for(const mode of ['import','replacement','preview','recovering','conflict','blocked','other-command-pending'])test(mode+' still prevents new manual planning',()=>fixture(async({q,client,data,checkpoint,command})=>{
 await checkpoint();const r=client.status('pixel');
 if(mode==='import')data.set('hyper-dimension-pixel-pending-import','{}');
 else if(mode==='replacement')data.set('hyper-dimension-pixel-pending-replacement','{}');
 else if(mode==='preview')r.previewLock=true;
 else if(mode==='recovering')r.recovering=true;
 else if(mode==='other-command-pending')data.set('hyper-dimension-pixel-pending-action',JSON.stringify({body:{requestId:'different-unconfirmed-command',operation:'begin'}}));
 else r.status=mode;
 await assert.rejects(command());assert.equal(q.requests.filter(r=>r.op==='action').length,0);assert.equal(q.state.harnessRegistrations,undefined);
}));
