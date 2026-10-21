import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectedSurfaceClient} from '../src/connectedSurfaceClient.js';

const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
const raster={w:32,h:64,x:-16,y:-64,density:1,frame:{x:0,y:0,w:32,h:64},mesh:{vertices:[],triangles:[]},smoothing:false};
function fixture({maxRequests=32,maxBytes=16*1024*1024}={}){
 let now=0,terminated=0,resets=0,draws=0;const timers=[],messages=[],painted=[];
 const schedule=(fn,ms)=>{const timer={fn,ms,at:now+ms,active:true};timers.push(timer);return timer;};
 const cancel=timer=>{if(timer)timer.active=false;};
 const endpoint={postMessage:message=>messages.push(message),terminate:()=>terminated++};
 const client=createConnectedSurfaceClient({worker:()=>endpoint,bitmap:async image=>{if(image.copyReady)await image.copyReady;return{close(){}};},isBitmap:()=>false,schedule,cancel,clock:()=>now,onReset:()=>resets++,maxRequests,maxBytes});
 const deliver=data=>endpoint.onmessage({data});
 const register=async()=>{const message=messages.filter(m=>m.kind==='image').at(-1);assert(message);deliver({kind:'registered',requestId:message.requestId,imageId:message.imageId});await flush();};
 const request=(key,image={})=>client.request(key,image,raster,()=>painted.push(key));
 const reply=key=>{const job=messages.filter(m=>m.kind==='raster'&&m.key===key).at(-1);assert(job);const bitmap={closed:0,close(){this.closed++;}};deliver({kind:'raster',key,requestId:job.requestId,bitmap,status:{backend:'WebGL2 connected surface',ready:true,draws:++draws}});return bitmap;};
 async function advance(ms){const end=now+ms;for(;;){const timer=timers.filter(t=>t.active&&t.at<=end).sort((a,b)=>a.at-b.at)[0];if(!timer)break;now=timer.at;timer.active=false;timer.fn();await flush();}now=end;await flush();}
 const seed=async()=>{request('warm');await flush();await register();reply('warm');assert.equal(client.inspect().ready,true);};
 async function delayedImage(){await advance(20000);let resolve;const image={copyReady:new Promise(r=>resolve=r)};assert(request('delayed',image));await flush();await advance(14000);resolve();await flush();await advance(500);await register();assert(messages.some(m=>m.kind==='raster'&&m.key==='delayed'));return image;}
 return{client,messages,timers,painted,deliver,request,reply,register,advance,seed,delayedImage,counts:()=>({terminated,resets})};
}

test('idle time and late image acquisition cannot prematurely retire a newly submitted healthy GPU pose',async()=>{
 const f=fixture();try{
  await f.seed();const image=await f.delayedImage();await f.advance(500);
  assert.equal(f.client.inspect().pendingRasters,0,'The original pose request still expires at15000ms');assert.equal(f.client.inspect().expiredRasters,1);
  assert.equal(f.client.inspect().ready,true,'Only500ms of actual raster work has elapsed');assert.deepEqual(f.counts(),{terminated:0,resets:0});
  await f.advance(50);assert.equal(f.reply('delayed').closed,1,'An expired result closes without painting');assert.deepEqual(f.painted,['warm']);
  assert(f.request('fresh',image));await flush();f.reply('fresh');assert.deepEqual(f.painted,['warm','fresh']);assert.equal(f.client.inspect().ready,true);
 }finally{f.client.dispose();}
});

test('a truly stalled GPU still retires at its original15000ms submitted-work deadline',async()=>{
 const f=fixture();try{
  await f.seed();await f.delayedImage();await f.advance(500);assert.equal(f.counts().terminated,0);assert.equal(f.client.inspect().pendingRasters,0);
  await f.advance(14499);assert.equal(f.counts().terminated,0);await f.advance(1);
  assert.equal(f.client.inspect().workerFailureCode,'sprite_raster_timeout');assert.deepEqual(f.counts(),{terminated:1,resets:1});assert.equal(f.client.request('new',{},raster,()=>{}),false);assert.equal(f.client.inspect().pendingRasterBytes,0);
 }finally{f.client.dispose();}
});

test('an expired unacknowledged pose retains its original queue capacity until its exact cancellation receipt',async()=>{
 const f=fixture({maxRequests:1});try{
  await f.seed();const image=await f.delayedImage();await f.advance(500);assert.equal(f.request('blocked',image),false,'A timed-out request must not enlarge the GPU queue');
  const job=f.messages.find(m=>m.kind==='raster'&&m.key==='delayed');f.deliver({kind:'raster-cancelled',key:job.key,requestId:job.requestId});assert(f.request('after-cancel',image));await flush();f.reply('after-cancel');assert.deepEqual(f.painted,['warm','after-cancel']);
 }finally{f.client.dispose();}
});

test('later image registrations cannot reset a stalled raster deadline',async()=>{
 const f=fixture();try{
  await f.seed();await f.advance(100);f.request('stalled');await flush();await f.register();await f.advance(14000);
  f.request('later-image');await flush();await f.register();await f.advance(1000);
  assert.equal(f.client.inspect().workerFailureCode,'sprite_raster_timeout');assert.equal(f.counts().terminated,1);assert.deepEqual(f.painted,['warm']);
 }finally{f.client.dispose();}
});

test('expired unacknowledged pixels retain the byte budget until their exact GPU receipt',async()=>{
 const size=raster.w*raster.h*4,f=fixture({maxBytes:size});try{
  await f.seed();const image=await f.delayedImage();await f.advance(500);
  assert.equal(f.client.inspect().pendingRasterBytes,0);assert.equal(f.client.inspect().submittedRasterBytes,size);assert.equal(f.client.inspect().outstandingRasterBytes,size);
  assert.equal(f.request('over-byte-budget',image),false,'Expiry cannot silently enlarge the original16MiB budget');
  const job=f.messages.find(m=>m.kind==='raster'&&m.key==='delayed');
  f.deliver({kind:'raster-cancelled',key:'wrong-key',requestId:job.requestId});assert.equal(f.request('still-blocked',image),false);
  f.deliver({kind:'raster-cancelled',key:job.key,requestId:job.requestId});assert.equal(f.client.inspect().outstandingRasterBytes,0);
  assert(f.request('after-exact-ack',image));await flush();f.reply('after-exact-ack');assert.equal(f.client.inspect().outstandingRasterBytes,0);
 }finally{f.client.dispose();}
});
