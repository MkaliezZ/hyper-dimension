const snapshotStub='// Snapshot acquisition is stubbed here to isolate producer ordering; the real\n// pixel plane has its own contracts and native zero-difference comparisons.\nconst captureGpuFrame=(_gl,canvas)=>createImageBitmap(canvas);\n';
import test from 'node:test';
import {serveGpuWorkerEndpoint} from '../src/gpuWorkerEndpoint.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createConnectedSurfaceClient} from '../src/connectedSurfaceClient.js';
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function fixture(){
 let now=0,terminated=0,resets=0;const timers=[],messages=[],paints=[],image={width:1,height:1};
 const endpoint={postMessage(message){messages.push(message);if(message.kind==='image')queueMicrotask(()=>endpoint.onmessage({data:{kind:'registered',requestId:message.requestId,imageId:message.imageId}}));},terminate(){terminated++;}};
 const client=createConnectedSurfaceClient({worker:()=>endpoint,isBitmap:()=>true,clock:()=>now,schedule:(fn,ms)=>{const timer={fn,ms,cancelled:false};timers.push(timer);return timer;},cancel:timer=>{timer.cancelled=true;},onReset:()=>resets++});
 const request=key=>client.request(key,image,{w:1,h:1},bitmap=>paints.push(bitmap));
 function reply(key,id){const job=messages.find(m=>m.kind==='raster'&&m.key===key&&(!id||m.requestId===id));assert(job);const bitmap={closed:0,close(){this.closed++;}};endpoint.onmessage({data:{kind:'raster',key,requestId:job.requestId,bitmap,status:{backend:'WebGL2 connected surface',ready:true,draws:1}}});return bitmap;}
 return{client,request,reply,timers,messages,paints,deliver:data=>endpoint.onmessage({data}),time:t=>{now=t;},counts:()=>({terminated,resets})};
}
test('an overdue pose does not terminate a worker with actual recent completed peers',async()=>{
 const f=fixture();f.request('slow');await flush();const timer=f.timers.find(t=>!t.cancelled);f.request('peer');await flush();f.time(10000);f.reply('peer');f.time(15000);timer.fn();
 assert.equal(timer.ms,15000);assert.equal(f.client.inspect().backend,'WebGL2 connected surface');assert.equal(f.client.inspect().expiredRasters,1);assert.equal(f.client.inspect().pendingRasterBytes,0);assert.deepEqual(f.counts(),{terminated:0,resets:0});assert(f.messages.some(m=>m.kind==='cancel-raster'&&m.key==='slow'));f.client.dispose();
});
test('a late bitmap is closed and cannot consume a newer same-key request',async()=>{
 const f=fixture();f.request('same');await flush();const oldId=f.messages.find(m=>m.kind==='raster').requestId,timer=f.timers.find(t=>!t.cancelled);f.request('peer');await flush();f.time(10000);f.reply('peer');f.time(15000);timer.fn();f.request('same');await flush();
 const late=f.reply('same',oldId);assert.equal(late.closed,1);assert.equal(f.paints.length,1);assert.equal(f.client.inspect().pendingRasters,1);const newId=f.messages.filter(m=>m.kind==='raster'&&m.key==='same').at(-1).requestId;const current=f.reply('same',newId);assert.equal(current.closed,1);assert.equal(f.paints.length,2);f.client.dispose();
});
test('no first output or no output for a full original deadline still fails closed',async()=>{
 for(const prior of [false,true]){const f=fixture();if(prior){f.request('peer');await flush();f.time(10);f.reply('peer');}f.request('stall');await flush();const timer=f.timers.find(t=>!t.cancelled);f.time(prior?15011:15000);timer.fn();assert.equal(f.client.inspect().workerFailureCode,'sprite_raster_timeout');assert.equal(f.counts().terminated,1);assert.equal(f.client.request('new',{}, {w:1,h:1},()=>{}),false);}
});
test('a completed cancelled GPU copy proves progress without painting or claiming a new pose',async()=>{
 const f=fixture();f.request('next');await flush();const timer=f.timers.find(t=>!t.cancelled);f.time(10000);f.deliver({kind:'raster-cancelled',key:'retired',requestId:1});f.time(15000);timer.fn();assert.equal(f.client.inspect().expiredRasters,1);assert.equal(f.counts().terminated,0);assert.equal(f.paints.length,0);f.client.dispose();
});
test('original pending count,byte limits and disposal ownership remain bounded',async()=>{
 const f=fixture();for(let n=0;n<32;n++)assert(f.request('k'+n));assert.equal(f.request('overflow'),false);assert.equal(f.client.inspect().pendingRasters,32);assert.equal(f.client.inspect().pendingRasterBytes,128);await flush();f.client.dispose();assert(f.timers.every(t=>t.cancelled));assert.equal(f.client.inspect().pendingRasterBytes,0);
});
async function workerFixture(){
 const source=(await readFile(new URL('../src/connectedSurfaceWorker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const posts=[],timers=[],fences=[],copies=[],draws=[],self={postMessage:data=>posts.push(data)},canvas={},gl={};let gpuCancels=0;
 const context={serveGpuWorkerEndpoint:receive=>serveGpuWorkerEndpoint(receive,self),self,Uint8Array,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
  afterGpuCommands(_gl,done){fences.push(done);return()=>gpuCancels++;},
  createImageBitmap(){let resolve;const promise=new Promise(r=>resolve=r);copies.push({resolve});return promise;},
  connectedSurfaceStatus:()=>({backend:'WebGL2 connected surface'}),spriteSourceStatus:()=>({}),connectedTextureFailed:()=>false,prepareConnectedTexture:()=>true,
  renderConnectedSurfaceInWorker(_image,_frame,mesh){draws.push(mesh.id);return{canvas,gl,draw:[0,0,1,1]};}
 };
 vm.runInNewContext(snapshotStub+source,context);await self.onmessage({data:{kind:'image',requestId:100,imageId:1,bitmap:{width:1,height:1,close(){}}}});
 const request=(key,id)=>self.onmessage({data:{kind:'raster',key,requestId:id,imageId:1,frame:{},mesh:{id},density:1,smoothing:false}}),cancel=(key,id)=>self.onmessage({data:{kind:'cancel-raster',key,requestId:id}});
 return{posts,timers,fences,copies,draws,request,cancel,gpuCancels:()=>gpuCancels,pump(){assert(timers.length);timers.shift()();}};
}
test('queued cancellation matches both key and request identity',async()=>{
 const f=await workerFixture();await f.request('same',1);await f.request('same',2);await f.cancel('same',1);f.pump();assert.deepEqual(f.draws,[2]);await f.cancel('same',1);assert.equal(f.gpuCancels(),0);f.fences[0]();await flush();f.copies[0].resolve({close(){assert.fail('Transferred live snapshot must not close in producer');}});await flush();assert.equal(f.posts.at(-1).requestId,2);assert.equal(f.posts.at(-1).kind,'raster');
});
test('cancelled in-flight work completes without surface reuse,then closes its bitmap once',async()=>{
 const f=await workerFixture();await f.request('pose',1);f.pump();await f.cancel('pose',1);await f.request('pose',2);assert.equal(f.gpuCancels(),0);assert.deepEqual(f.draws,[1]);f.fences[0]();await flush();let closed=0;f.copies[0].resolve({close(){closed++;}});await flush();assert.equal(closed,1);assert.equal(f.posts.at(-1).kind,'raster-cancelled');assert.equal(f.posts.at(-1).requestId,1);f.pump();assert.deepEqual(f.draws,[1,2]);
});
