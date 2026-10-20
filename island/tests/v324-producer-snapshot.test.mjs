import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const sourceRoot=new URL('../src/',import.meta.url);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const image=()=>({width:32,height:48,closed:0,close(){this.closed++;}});
async function fixture(kind){
 const name=kind==='sprite'?'connectedSurfaceWorker.js':'oceanShaderWorker.js',source=(await readFile(new URL(name,sourceRoot),'utf8')).replace(/^import .*;\n/gm,'');
 const posts=[],timers=[],fences=[],snapshots=[],draws=[],self={postMessage:value=>posts.push(value)},canvas={frame:null,transferToImageBitmap(){throw Error('The live producer must not be transferred');}},gl={lost:false,isContextLost(){return this.lost;}};
 let lifecycle;
 const context={self,Uint8Array,OffscreenCanvas:class{},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
  afterGpuCommands(_gl,validate,reject){const entry={validate,reject,cancelled:false};fences.push(entry);return()=>{entry.cancelled=true;};},
  createImageBitmap(value){assert.equal(value,canvas);const pending=deferred();snapshots.push({frame:canvas.frame,...pending});return pending.promise;},
  decodeSpriteSource:async()=>image(),spriteSourceStatus:()=>({}),connectedSurfaceStatus:()=>({backend:'WebGL2 connected surface'}),connectedTextureFailed:()=>false,prepareConnectedTexture:()=>true,
  renderConnectedSurfaceInWorker(_image,_frame,mesh){canvas.frame=mesh.id;draws.push(mesh.id);return{canvas,gl,draw:[0,0,32,48]};},
  coastDistanceTexture:()=>new Uint8Array(16),createOceanRenderer(_canvas,options){lifecycle=options;return{canvas,gl,lost:false,draw(frame){canvas.frame=frame.requestId;draws.push(frame.requestId);}};}
 };
 vm.runInNewContext(source,context,{filename:name});
 if(kind==='sprite')await self.onmessage({data:{kind:'image',requestId:1,imageId:1,bitmap:image()}});
 else self.onmessage({data:{kind:'field',fieldId:1,width:2,height:2,cell:4,water:new Uint8Array([0,1,1,1])}});
 const request=id=>kind==='sprite'?self.onmessage({data:{kind:'raster',key:'pose-'+id,requestId:id,imageId:1,frame:{},mesh:{id},density:1,smoothing:false}}):self.onmessage({data:{kind:'frame',frame:{requestId:id,fieldId:1}}});
 return{self,posts,timers,fences,snapshots,draws,gl,request,lost:()=>lifecycle.onLost(),pump:()=>{assert(timers.length);timers.shift()();},canvas};
}
test('sprite surfaces stay unchanged until fence and independent copy finish; queued poses cannot overwrite them',async()=>{
 const f=await fixture('sprite');f.request(10);f.pump();f.request(11);assert.deepEqual(f.draws,[10]);assert.equal(f.snapshots.length,0);assert.equal(f.timers.length,0);
 f.fences[0].validate();await flush();assert.equal(f.snapshots.length,1);assert.equal(f.snapshots[0].frame,10);assert.equal(f.canvas.frame,10);assert.equal(f.posts.filter(p=>p.kind==='raster').length,0);
 const first=image();f.snapshots[0].resolve(first);await flush();assert.equal(f.posts.filter(p=>p.kind==='raster').length,1);assert.equal(f.posts.at(-1).requestId,10);assert.equal(first.closed,0);
 f.pump();assert.deepEqual(f.draws,[10,11]);f.fences[1].validate();await flush();const second=image();f.snapshots[1].resolve(second);await flush();assert.equal(f.posts.at(-1).requestId,11);assert.equal(second.closed,0);
});
test('sprite snapshot failure is fatal and never reports a successful raster',async()=>{
 const f=await fixture('sprite');f.request(10);f.pump();f.fences[0].validate();await flush();f.snapshots[0].reject(Error('owned-copy-failed'));await flush();assert.equal(f.posts.at(-1).kind,'fatal');assert.equal(f.posts.at(-1).error,'owned-copy-failed');assert.equal(f.posts.filter(p=>p.kind==='raster').length,0);
});
test('sprite failed GPU completion never starts an independent copy',async()=>{
 const f=await fixture('sprite');f.request(10);f.pump();f.fences[0].reject(Error('owned-gpu-failed'));await flush();assert.equal(f.snapshots.length,0);assert.equal(f.posts.at(-1).kind,'fatal');assert.equal(f.posts.at(-1).error,'owned-gpu-failed');
});
test('ocean publishes only the completed independent snapshot with its original request identity',async()=>{
 const f=await fixture('ocean');f.request(20);assert.deepEqual(f.draws,[20]);assert.equal(f.snapshots.length,0);f.fences[0].validate();await flush();assert.equal(f.posts.filter(p=>p.kind==='frame').length,0);const bitmap=image();f.snapshots[0].resolve(bitmap);await flush();assert.equal(f.posts.at(-1).kind,'frame');assert.equal(f.posts.at(-1).requestId,20);assert.equal(bitmap.closed,0);
 f.request(21);assert.deepEqual(f.draws,[20,21]);
});
test('a late ocean snapshot after actual context loss is closed and never published',async()=>{
 const f=await fixture('ocean');f.request(20);f.fences[0].validate();await flush();f.lost();const bitmap=image();f.snapshots[0].resolve(bitmap);await flush();assert.equal(bitmap.closed,1);assert.equal(f.posts.filter(p=>p.kind==='frame').length,0);assert(f.posts.some(p=>p.kind==='lost'));
});
test('failed ocean copy preserves a fatal failure instead of a frame acknowledgment',async()=>{
 const f=await fixture('ocean');f.request(20);f.fences[0].validate();await flush();f.snapshots[0].reject(Error('owned-ocean-copy-failed'));await flush();assert.equal(f.posts.at(-1).kind,'fatal');assert.equal(f.posts.at(-1).error,'owned-ocean-copy-failed');assert.equal(f.posts.filter(p=>p.kind==='frame').length,0);
});

test('an evicted queued image is rejected without a false GPU failure or an empty-queue crash',async()=>{
 const f=await fixture('sprite');
 await f.self.onmessage({data:{kind:'raster',key:'missing',requestId:9,imageId:999,frame:{},mesh:{id:9},density:1,smoothing:false}});
 f.pump();assert.equal(f.posts.at(-1).error,'artwork_evicted');assert(!f.posts.some(p=>p.kind==='fatal'));assert.equal(f.draws.length,0);
 f.request(10);f.pump();f.fences[0].validate();await flush();f.snapshots[0].resolve(image());await flush();assert.equal(f.posts.at(-1).requestId,10);assert.equal(f.posts.at(-1).kind,'raster');
});
