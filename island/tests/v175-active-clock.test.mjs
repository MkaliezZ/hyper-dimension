import test from 'node:test';
import assert from 'node:assert/strict';
import {createSaveClient} from '../src/saveClient.js';
import {visibleFrameSeconds} from '../src/frameClock.js';

async function fixture(){
 const values=new Map();
 globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 globalThis.sessionStorage=localStorage;
 globalThis.document={hidden:false,addEventListener(){}};
 globalThis.window={addEventListener(){}};
 globalThis.location={reload(){}};
 const seed={saveSlot:'hyper-dimension-pixel-v3',workshopBests:{},coins:0,inventory:{},player:{x:0,y:0},farmControl:{version:1}};
 let revision=0;const sent=[];
 globalThis.fetch=async(url,init)=>{
  const body=JSON.parse(init.body);
  if(url.endsWith('/save'))sent.push(body);
  return Response.json({document:{version:'v'+(++revision),state:body.state||structuredClone(seed)}});
 };
 const client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){}});
 await client.load('pixel');
 return {client,sent,cleanup(){clearTimeout(client.status('pixel').timer);clearTimeout(client.status('pixel').cacheTimer);}};
}

for(const fps of [8,10,15,30,60,165])test(`save requests preserve ten visible seconds at ${fps} FPS`,async()=>{
 const f=await fixture();
 try{
  let previous=0;
  for(let i=1;i<=fps*10;i++){const at=i*1000/fps;f.client.advanceTime('pixel',visibleFrameSeconds(at,previous));previous=at;}
  const state=f.client.status('pixel').state;state.player.x=1;f.client.enqueue('pixel',state);await f.client.flush('pixel');
  assert.equal(f.sent.length,1);assert(Math.abs(f.sent[0].activeSeconds-10)<1e-8,`lost active time: ${f.sent[0].activeSeconds}`);
 }finally{f.cleanup();}
});

test('hidden, paused and invalid time cannot inflate saves, including after a long suspended frame',async()=>{
 const f=await fixture();
 try{
  const r=f.client.status('pixel');
  for(const bad of [NaN,Infinity,-1,0,16])f.client.advanceTime('pixel',bad);
  assert.equal(r.activeSeconds||0,0);
  document.hidden=true;f.client.advanceTime('pixel',.125);assert.equal(r.activeSeconds||0,0);document.hidden=false;
  for(const status of ['recovering','offline','blocked','conflict','action_pending','import_pending']){
   r.activeSeconds=1;r.status=status;f.client.advanceTime('pixel',.125);assert.equal(r.activeSeconds,0);
  }
  r.status='saved';f.client.advanceTime('pixel',visibleFrameSeconds(600000,0,true));assert.equal(r.activeSeconds,0);
  f.client.advanceTime('pixel',visibleFrameSeconds(600000,0));assert(r.activeSeconds>0&&r.activeSeconds<=.15);
  for(let i=0;i<400;i++)f.client.advanceTime('pixel',.125);
  assert.equal(r.activeSeconds,15,'each request retains the server clock ceiling');
 }finally{f.cleanup();}
});
