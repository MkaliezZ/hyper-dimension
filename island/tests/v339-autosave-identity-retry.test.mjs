import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';

async function fixture(theme,run){
 const names=['localStorage','sessionStorage','document','window','location','fetch'],previous=Object.fromEntries(names.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)])),data=new Map();let client;
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
 globalThis.sessionStorage=localStorage;globalThis.document={hidden:false,addEventListener(){}};globalThis.window={addEventListener(){}};globalThis.location={reload(){throw Error('An identity-writer reply must not replace the island');}};
 const seed={saveSlot:'hyper-dimension-'+theme+'-v3',day:1,coins:0,inventory:{wood:50},player:{x:0,y:0},workshopBests:{},farmControl:{version:1}};
 try{return await run({seed,data,make:options=>client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},...options})});}
 finally{if(client){const r=client.status(theme);clearTimeout(r.timer);clearTimeout(r.cacheTimer);await r.cacheTail?.catch(()=>{});}for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]);else delete globalThis[name];}}
}

for(const theme of ['pixel','origami'])for(const afterCommit of [false,true])test(theme+' planning survives a temporary identity-writer rejection of its durable autosave '+(afterCommit?'after a commit':'before a commit'),()=>fixture(theme,async({seed,make})=>{
 let canonical=structuredClone(seed),version='v1',saveCalls=0,saveCommits=0,actionCommits=0;const bodies=[],order=[];let retainedSaveId;
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version,state:structuredClone(canonical)}});
  const body=JSON.parse(init.body);order.push(url.split('/').at(-1));
  if(url.endsWith('/save')){
   saveCalls++;bodies.push(init.body);assert(body.saveId);retainedSaveId??=body.saveId;assert.equal(body.saveId,retainedSaveId);
   if((afterCommit||saveCalls===3)&&saveCommits===0){assert.equal(body.expectedVersion,version);canonical=structuredClone(body.state);canonical.farmControl.activeSeconds=body.activeSeconds;version='v2';saveCommits++;}
   if(saveCalls<3)return Response.json({error:'联机档案正在写入，请稍后重试',code:'lan_busy',retryAfter:1},{status:503});
   return Response.json({document:{version,state:structuredClone(canonical)}});
  }
  assert(url.endsWith('/action'));assert.equal(body.expectedVersion,'v2');assert.equal(body.operation,'plan_create');assert.equal(saveCommits,1);actionCommits++;
  canonical.workProjects=[{id:body.project.id,targets:body.project.targets}];version='v3';return Response.json({document:{version,state:structuredClone(canonical)},receipt:{outcome:'created'}});
 };
 const client=make(),state=await client.load(theme);state.player.x=12;client.enqueue(theme,state);for(let frame=0;frame<30;frame++)client.advanceTime(theme,.1);
 const result=await client.action(theme,{kind:'commerce',operation:'plan_create',requestId:'same-manual-project',project:{id:'fictional-letter',targets:{wood:10}}},undefined,{foreground:true});
 assert.equal(saveCalls,3);assert.equal(new Set(bodies).size,1,'State, active time, version, client and save ID must remain byte-identical');assert.equal(saveCommits,1);assert.equal(actionCommits,1);assert.deepEqual(order,['save','save','save','action']);
 assert(Math.abs(JSON.parse(bodies[0]).activeSeconds-3)<1e-9);assert(Math.abs(result.state.farmControl.activeSeconds-3)<1e-9);
 assert.equal(result.state.player.x,12);assert.equal(result.state.inventory.wood,50);assert.equal(result.state.coins,0);assert.equal(result.state.workProjects.length,1);assert.equal(client.pendingAction(theme),null);assert.equal(client.status(theme).status,'saved');
}));

for(const theme of ['pixel','origami'])test(theme+' persistent identity contention retains the autosave and blocks a following project until the same save is acknowledged',()=>fixture(theme,async({seed,data,make})=>{
 let busy=true;const bodies=[];
 globalThis.fetch=async(url,init)=>{
  if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:structuredClone(seed)}});
  assert(url.endsWith('/save'),'No project may overtake an unacknowledged autosave');bodies.push(init.body);
  if(busy)return Response.json({error:'Still writing',code:'lan_busy'},{status:503});
  return Response.json({document:{version:'v2',state:JSON.parse(init.body).state}});
 };
 const client=make(),state=await client.load(theme);state.player.y=24;client.enqueue(theme,state);
 await assert.rejects(client.action(theme,{kind:'commerce',operation:'plan_create',requestId:'must-wait-for-save',project:{id:'not-created',targets:{wood:1}}},undefined,{foreground:true}),e=>e.code==='lan_busy'&&e.status===503);
 assert.equal(bodies.length,3);assert.equal(new Set(bodies).size,1);const pending=JSON.parse(data.get('hyper-dimension-'+theme+'-pending-clock-save'));assert.equal(pending.body.saveId,JSON.parse(bodies[0]).saveId);assert.equal(pending.body.state.player.y,24);assert.equal(client.pendingAction(theme),null);assert.equal(client.status(theme).state.inventory.wood,50);
 busy=false;await client.flush(theme);assert.equal(bodies.length,4);assert.equal(new Set(bodies).size,1);assert.equal(data.has('hyper-dimension-'+theme+'-pending-clock-save'),false);assert.equal(client.status(theme).state.player.y,24);
}));

for(const [status,code]of [[401,'unauthorized'],[500,'lan_busy'],[503,'unknown_storage_error'],[503,'EPERM']])test('an autosave does not infer a safe retry from '+status+'/'+code,()=>fixture('pixel',async({seed,make})=>{
 let calls=0;globalThis.fetch=async(url)=>{if(url.endsWith('/open'))return Response.json({document:{version:'v1',state:seed}});calls++;return Response.json({error:'Explicit non-identity failure',code},{status});};
 const client=make(),state=await client.load('pixel');state.player.x=1;client.enqueue('pixel',state);await assert.rejects(client.flush('pixel'),e=>e.code===code);assert.equal(calls,1);assert.equal(client.status('pixel').state.inventory.wood,50);assert.equal(client.pendingAction('pixel'),null);
}));
