import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectedSurfaceClient} from '../src/connectedSurfaceClient.js';
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
const raster={w:16,h:16,frame:{x:0,y:0,w:16,h:16}};
function fixture(){
 let time=0,started=0,reset=0;const messages=[],timers=new Map(),endpoint={postMessage:(message,transfer)=>messages.push({message,transfer}),terminate(){}};
 const client=createConnectedSurfaceClient({worker:()=>{started++;return endpoint;},isBitmap:()=>true,clock:()=>time,onReset:()=>reset++,schedule:(fn,delay)=>{const id=Symbol();timers.set(id,{fn,at:time+delay});return id;},cancel:id=>timers.delete(id)});
 return {client,endpoint,messages,timers,started:()=>started,reset:()=>reset,advance:at=>{time=at;for(const [id,timer] of [...timers])if(timer.at<=time){timers.delete(id);timer.fn();}}};
}
test('boot preparation owns one endpoint and consumes no raster, image or memory budget',()=>{
 const f=fixture();try{assert(f.client.prepare());assert(f.client.prepare());assert.equal(f.started(),1);assert.deepEqual(f.messages,[{message:{kind:'warm'},transfer:undefined}]);assert.equal(f.timers.size,0);
  assert.equal(f.client.inspect().pendingRasters,0);assert.equal(f.client.inspect().outstandingRasterBytes,0);assert.equal(f.client.inspect().workerBoot.ready,false);
  f.endpoint.onmessage({data:{kind:'ready'}});assert.equal(f.client.inspect().workerBoot.ready,true);assert.equal(f.client.inspect().ready,false,'Module boot must not claim completed GPU initialization');
 }finally{f.client.dispose();}
});
test('a late boot acknowledgement cannot postpone the original whole-request image deadline',async()=>{
 const f=fixture();try{f.client.prepare();f.advance(2000);assert(f.client.request('pose',{},raster,()=>assert.fail('No unregistered pose')));await flush();
  f.advance(16000);f.endpoint.onmessage({data:{kind:'ready'}});assert.equal(f.reset(),0);
  f.advance(17000);assert.equal(f.reset(),1);assert.equal(f.client.inspect().workerFailureCode,'sprite_image_copy_timeout');assert.equal(f.client.inspect().outstandingRasterBytes,0);
 }finally{f.client.dispose();}
});
test('an early module boot keeps the original image attached and retires its actual raster once',async()=>{
 const f=fixture(),image={close:()=>assert.fail('The live artwork must remain attached')};let received=0;try{
  f.client.prepare();f.endpoint.onmessage({data:{kind:'ready'}});f.advance(2000);assert(f.client.request('pose',image,raster,()=>received++));await flush();
  const register=f.messages.find(r=>r.message.kind==='image');assert(register);assert.equal(register.message.bitmap,image);assert.deepEqual(register.transfer,[]);
  f.endpoint.onmessage({data:{kind:'registered',requestId:register.message.requestId,imageId:register.message.imageId}});await flush();
  const draw=f.messages.find(r=>r.message.kind==='raster');assert(draw);let closed=0;f.endpoint.onmessage({data:{kind:'raster',key:draw.message.key,requestId:draw.message.requestId,bitmap:{close:()=>closed++},draw:[]}});
  assert.equal(received,1);assert.equal(closed,1);assert.equal(f.client.inspect().pendingRasters,0);assert.equal(f.client.inspect().submittedRasters,0);
 }finally{f.client.dispose();}
});
