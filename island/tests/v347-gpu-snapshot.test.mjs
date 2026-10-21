import test from 'node:test';
import assert from 'node:assert/strict';
import {captureGpuFrame,gpuFrameSnapshotStatus,GPU_FRAME_LIMITS} from '../src/gpuFrameSnapshot.js';
class Pixels{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}}
function fixture(width=2,height=3,{premultiplied=false,error=0,attributes=true}={}){
 const bytes=new Uint8Array(width*height*4);for(let i=0;i<bytes.length;i++)bytes[i]=(i*29+7)%256;
 const calls=[],images=[],canvas={width,height};let readback;
 const gl={RGBA:6408,UNSIGNED_BYTE:5121,NO_ERROR:0,readPixels(...args){calls.push(args.slice(0,6));readback=args[6];readback.set(bytes);},getError:()=>error,getContextAttributes:()=>attributes?{premultipliedAlpha:premultiplied}:null};
 const bitmap=async(image,options)=>{images.push({image,options});return{width:image.width,height:image.height,closed:0,close(){this.closed++;}};};
 return {bytes,calls,images,canvas,gl,bitmap,get readback(){return readback;},capture(options={}){return captureGpuFrame(gl,canvas,{bitmap,Image:Pixels,...options});}};
}
test('GPU bytes are vertically oriented in one owned plane and no live canvas enters bitmap acquisition',async()=>{
 const f=fixture(),before=f.bytes.slice(),out=await f.capture();assert.equal(out.width,2);assert.equal(out.height,3);assert.deepEqual(f.calls,[[0,0,2,3,6408,5121]]);const image=f.images[0].image;assert(image instanceof Pixels);assert.notEqual(image,f.canvas);assert.equal(image.data.buffer,f.readback.buffer);assert.deepEqual([...image.data],[...before.slice(16,24),...before.slice(8,16),...before.slice(0,8)]);assert.deepEqual(f.bytes,before);assert.equal(f.images[0].options.premultiplyAlpha,'none');assert.equal(out.closed,0);const plane=f.readback.buffer,beforeAllocations=gpuFrameSnapshotStatus().allocations;await f.capture();assert.equal(f.readback.buffer,plane);assert.equal(gpuFrameSnapshotStatus().allocations,beforeAllocations);
});
test('one pixel keeps its original straight-alpha channels',async()=>{
 const f=fixture(1,1);f.bytes.set([241,1,129,1]);await f.capture();assert.deepEqual([...f.images[0].image.data],[241,1,129,1]);
});
test('every valid eight-bit premultiplied channel survives the display round trip',async()=>{
 const f=fixture(256,129,{premultiplied:true});f.bytes.fill(0);const values=[];let n=0;
 for(let alpha=0;alpha<256;alpha++)for(let color=0;color<=alpha;color++){const i=n++*4;f.bytes.set([color,alpha-color,Math.floor(color/2),alpha],i);values.push([color,alpha-color,Math.floor(color/2),alpha]);}
 await f.capture();const data=f.images[0].image.data;
 assert.equal(f.images[0].options.premultiplyAlpha,'premultiply');
 for(let index=0;index<values.length;index++){const x=index%256,y=Math.floor(index/256),i=((128-y)*256+x)*4,[r,g,b,a]=values[index];assert.equal(data[i+3],a);for(const[channel,original]of [[0,r],[1,g],[2,b]])assert.equal(Math.round(data[i+channel]*a/255),original);}
});
test('transparent premultiplied pixels cannot leak invisible color',async()=>{
 const f=fixture(1,1,{premultiplied:true});f.bytes.set([127,255,43,0]);await f.capture();assert.deepEqual([...f.images[0].image.data],[0,0,0,0]);
});
for(const [name,width,height]of [['zero',0,1],['negative',-1,1],['fraction',1.5,1],['nan',NaN,1],['dimension',16385,1],['area',16384,16384]])test(name+' dimensions reject before GPU readback',async()=>{
 let reads=0;await assert.rejects(captureGpuFrame({readPixels(){reads++;}},{width,height},{bitmap(){throw Error('Unexpected bitmap');},Image:Pixels}),/gpu_snapshot_budget/);assert.equal(reads,0);
});
for(const maxBytes of [0,1.5,GPU_FRAME_LIMITS.bytes+1,15])test('invalid or insufficient '+maxBytes+' byte budget cannot read or allocate a bitmap',async()=>{
 const f=fixture(2,2);await assert.rejects(f.capture({maxBytes}),/gpu_snapshot_budget/);assert.equal(f.calls.length,0);assert.equal(f.images.length,0);
});
test('unavailable ImageData cannot start a readback',async()=>{const f=fixture();await assert.rejects(f.capture({Image:null}),/image_data_unavailable/);assert.equal(f.calls.length,0);});
test('a real readback error cannot return a successful frame',async()=>{const f=fixture(2,2,{error:1282});await assert.rejects(f.capture(),/readback_failed/);assert.equal(f.images.length,0);});
test('context loss retains an explicit failure',async()=>{const f=fixture(2,2,{attributes:false});await assert.rejects(f.capture(),/context_lost/);assert.equal(f.images.length,0);});
test('driver readback exceptions retain their original error',async()=>{const f=fixture();f.gl.readPixels=()=>{throw Error('Driver refused the read');};await assert.rejects(f.capture(),/Driver refused the read/);assert.equal(f.images.length,0);});
test('a rejected bitmap operation never reports completed output',async()=>{const f=fixture(),before=gpuFrameSnapshotStatus().frames;await assert.rejects(f.capture({bitmap:()=>Promise.reject(Error('Copy rejected'))}),/Copy rejected/);assert.equal(gpuFrameSnapshotStatus().frames,before);});
test('a malformed returned bitmap is closed once and cannot report a completed frame',async()=>{const f=fixture(),out={width:9,height:9,closed:0,close(){this.closed++;}},before=gpuFrameSnapshotStatus().frames;await assert.rejects(f.capture({bitmap:async()=>out}),/dimensions/);assert.equal(out.closed,1);assert.equal(gpuFrameSnapshotStatus().frames,before);});
test('a later producer mutation and simultaneous capture cannot overwrite an outstanding pixel plane',async()=>{
 const f=fixture(1,1);f.bytes.set([12,34,56,255]);let resolve;const first=f.capture({bitmap:()=>new Promise(r=>resolve=r)}),plane=f.readback;f.bytes.set([90,80,70,255]);const second=await f.capture();assert.notEqual(f.readback.buffer,plane.buffer);assert.deepEqual([...plane],[12,34,56,255]);resolve({width:1,height:1});await first;assert.deepEqual([...f.images[0].image.data],[90,80,70,255]);assert.equal(second.closed,0);
});
