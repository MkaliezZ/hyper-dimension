import test from 'node:test';
import assert from 'node:assert/strict';
import {createConnectedSurfaceClient} from '../src/connectedSurfaceClient.js';
import {registerSpriteSource} from '../src/spriteSource.js';

const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const raster={w:32,h:64,frame:{x:0,y:0,w:32,h:64}};
const description={kind:'refined',source:{kind:'original',url:'https://owned.invalid/assets/resident.png'},frame:{x:2,y:4,w:32,h:64},options:{resizeWidth:32,resizeHeight:64,resizeQuality:'high'}};

test('already-refined immutable artwork is cloned once without another source decode, readback or live-image transfer',async()=>{
 const messages=[],timers=new Set(),original={closed:0,close(){this.closed++;}};registerSpriteSource(original,description);
 const worker={postMessage:(data,transfer)=>messages.push({data,transfer}),terminate(){}};
 const client=createConnectedSurfaceClient({worker:()=>worker,isBitmap:image=>image===original,bitmap:()=>assert.fail('No second bitmap acquisition'),schedule:fn=>{timers.add(fn);return fn;},cancel:fn=>timers.delete(fn)});
 try{
  assert(client.request('first',original,raster,()=>{}));assert(client.request('second',original,raster,()=>{}));await flush();
  assert.equal(messages.length,1);assert.equal(messages[0].data.kind,'image');assert.equal(messages[0].data.bitmap,original);assert.deepEqual(messages[0].transfer,[]);
  const registration=messages[0].data;worker.onmessage({data:{kind:'registered',requestId:registration.requestId,imageId:registration.imageId}});await flush();
  assert.equal(messages.filter(m=>m.data.kind==='raster').length,2);assert.equal(original.closed,0);
 }finally{client.dispose();}
 assert.equal(original.closed,0);assert.equal(timers.size,0);
});

test('a rejected clone of described immutable artwork preserves the live original and releases request capacity',async()=>{
 const original={closed:0,close(){this.closed++;}};registerSpriteSource(original,description);
 const worker={postMessage(){throw Error('Rejected clone');},terminate(){}};
 const client=createConnectedSurfaceClient({worker:()=>worker,isBitmap:()=>true});
 try{assert(client.request('pose',original,raster,()=>assert.fail('No rejected pose')));await flush();assert.equal(original.closed,0);assert.equal(client.inspect().pendingRasters,0);assert.equal(client.inspect().outstandingRasterBytes,0);}finally{client.dispose();}
});

test('described non-bitmap surfaces retain the worker source path without a live Canvas readback',async()=>{
 const messages=[],surface={};registerSpriteSource(surface,description);const worker={postMessage:data=>messages.push(data),terminate(){}};
 const client=createConnectedSurfaceClient({worker:()=>worker,isBitmap:()=>false,bitmap:()=>assert.fail('No Canvas readback')});
 try{assert(client.request('pose',surface,raster,()=>{}));await flush();assert.equal(messages[0].kind,'image-source');assert.deepEqual(messages[0].source,description);}finally{client.dispose();}
});
