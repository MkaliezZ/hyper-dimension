import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectedSurfaceClient} from '../src/connectedSurfaceClient.js';
import {registerSpriteSource} from '../src/spriteSource.js';

const flush=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};
function fixture(options={}){
 const messages=[],timers=new Map(),copies=[];let serial=0,terminated=0,resets=0;
 const endpoint={postMessage:(message,transfer)=>messages.push({message,transfer}),terminate:()=>terminated++};
 const client=createConnectedSurfaceClient({worker:()=>endpoint,bitmap:async()=>{const copy={closed:0,close(){this.closed++;}};copies.push(copy);return copy;},schedule:fn=>{timers.set(++serial,fn);return serial;},cancel:id=>timers.delete(id),onReset:()=>resets++,...options});
 const deliver=data=>endpoint.onmessage({data});
 const register=()=>{const {message}=messages.find(x=>x.message.kind==='image');deliver({kind:'registered',requestId:message.requestId,imageId:message.imageId});};
 return {client,messages,timers,copies,deliver,register,endpoint,terminated:()=>terminated,resets:()=>resets};
}
const raster={w:32,h:64,x:-16,y:-64,density:1,frame:{x:0,y:0,w:32,h:64},mesh:{vertices:[],triangles:[]},smoothing:false};

test('worker raster requests clone artwork once and close each returned bitmap after exact cache handoff',async()=>{
 const f=fixture(),image={},received=[];assert(f.client.request('a',image,raster,b=>received.push(b)));await flush();
 assert.equal(f.messages.length,1);assert.equal(f.messages[0].transfer[0],f.copies[0]);f.register();await flush();
 const job=f.messages.find(x=>x.message.kind==='raster').message,result={closed:0,close(){this.closed++;}};
 f.deliver({kind:'raster',requestId:job.requestId,key:'a',bitmap:result,status:{backend:'WebGL2 connected surface',ready:true,draws:1,uploadFailures:0}});
 assert.deepEqual(received,[result]);assert.equal(result.closed,1);assert.equal(f.client.inspect().pendingRasterBytes,0);assert.equal(f.client.inspect().renderThread,'worker');
 assert(f.client.request('b',image,raster,()=>{}));await flush();assert.equal(f.copies.length,1);f.client.dispose();assert.equal(f.timers.size,0);
});

test('duplicate poses and bounded pending bytes cannot grow an unresponsive GPU queue',async()=>{
 const f=fixture({maxRequests:2,maxBytes:32*64*4*2}),image={};
 assert(f.client.request('a',image,raster,()=>{}));assert(!f.client.request('a',image,raster,()=>{}));
 assert(f.client.request('b',image,raster,()=>{}));assert(!f.client.request('c',image,raster,()=>{}));
 assert.equal(f.client.inspect().pendingRasters,2);assert.equal(f.client.inspect().pendingRasterBytes,32*64*4*2);
 await flush();f.client.dispose();await flush();assert.equal(f.client.inspect().pendingRasters,0);assert.equal(f.client.inspect().pendingRasterBytes,0);
});

test('late or duplicate bitmaps are disposed without painting a stale response',async()=>{
 const f=fixture(),image={};f.client.request('a',image,raster,()=>assert.fail('stale paint'));await flush();f.register();await flush();
 const job=f.messages.find(x=>x.message.kind==='raster').message,stale={closed:0,close(){this.closed++;}};
 f.deliver({kind:'raster',requestId:job.requestId+100,key:'a',bitmap:stale});assert.equal(stale.closed,1);assert.equal(f.client.inspect().pendingRasters,1);
 f.client.dispose();const late={closed:0,close(){this.closed++;}};f.deliver({kind:'raster',requestId:job.requestId,key:'a',bitmap:late});assert.equal(late.closed,1);
});

test('a stalled worker releases all pending capacity, cancels timers and keeps a declared Canvas fallback',async()=>{
 const f=fixture();f.client.request('a',{},raster,()=>assert.fail('timed out'));await flush();
 [...f.timers.values()][0]();await flush();assert.equal(f.terminated(),1);assert.equal(f.resets(),1);
 assert.equal(f.client.inspect().backend,'Canvas connected surface');assert.equal(f.client.inspect().ready,false);assert.equal(f.client.inspect().pendingRasterBytes,0);assert.equal(f.timers.size,0);
 assert.equal(f.client.request('b',{},raster,()=>{}),false);
});

test('an evicted source can register again while a rejected upload is never painted',async()=>{
 const f=fixture(),image={};f.client.request('a',image,raster,()=>assert.fail('unvalidated image'));await flush();f.register();await flush();
 let job=f.messages.find(x=>x.message.kind==='raster').message;f.deliver({kind:'raster',key:'a',requestId:job.requestId,error:'artwork_evicted'});
 assert(f.client.request('b',image,raster,()=>assert.fail('rejected image')));await flush();assert.equal(f.copies.length,2);
 const registration=f.messages.filter(x=>x.message.kind==='image').at(-1).message;f.deliver({kind:'registered',requestId:registration.requestId,imageId:registration.imageId});await flush();
 job=f.messages.filter(x=>x.message.kind==='raster').at(-1).message;f.deliver({kind:'raster',key:'b',requestId:job.requestId,error:'sprite_upload_failed'});
 assert.equal(f.client.request('c',image,raster,()=>{}),false);f.client.dispose();
});

test('decoded live bitmaps are structured-cloned without a GPU copy or detaching the original',async()=>{
 const original={closed:0,close(){this.closed++;}},f=fixture({isBitmap:image=>image===original,bitmap:()=>assert.fail('Must not recreate a decoded bitmap')});
 assert(f.client.request('a',original,raster,()=>{}));await flush();
 assert.equal(f.messages[0].message.bitmap,original);assert.deepEqual(f.messages[0].transfer,[]);
 f.register();await flush();f.client.dispose();assert.equal(original.closed,0);
});

test('a failed structured clone never closes the live game bitmap',async()=>{
 const original={closed:0,close(){this.closed++;}},f=fixture({isBitmap:()=>true});
 f.endpoint.postMessage=()=>{throw Error('owned clone rejected');};f.client.request('a',original,raster,()=>{});await flush();
 assert.equal(original.closed,0);assert.equal(f.client.inspect().pendingRasterBytes,0);f.client.dispose();
});

test('a described refined sprite registers only its original artwork operation, with no main-thread bitmap copy',async()=>{
 const original={},source={kind:'refined',source:{kind:'original',url:'https://owned.invalid/assets/resident.png'},frame:{x:1,y:2,w:30,h:60},options:{resizeWidth:32,resizeHeight:64,resizeQuality:'high'}};registerSpriteSource(original,source);
 const f=fixture({bitmap:()=>assert.fail('No GPU readback on the main thread')});f.client.request('a',original,raster,()=>{});await flush();
 assert.equal(f.messages[0].message.kind,'image-source');assert.deepEqual(f.messages[0].message.source,source);assert.deepEqual(f.messages[0].transfer,[]);assert.equal(f.messages[0].message.bitmap,undefined);
 const registration=f.messages[0].message;f.deliver({kind:'registered',requestId:registration.requestId,imageId:registration.imageId});await flush();f.client.dispose();
});

test('the unchanged temporary Canvas preview never requests a GPU readback or enters the validated pose cache',async()=>{
 const original={};registerSpriteSource(original,{kind:'preview'});const f=fixture({bitmap:()=>assert.fail('No preview copy')});
 assert.equal(f.client.request('a',original,raster,()=>assert.fail('No approximate preview pose')),false);await flush();assert.equal(f.messages.length,0);assert.equal(f.client.inspect().pendingRasterBytes,0);f.client.dispose();
});
