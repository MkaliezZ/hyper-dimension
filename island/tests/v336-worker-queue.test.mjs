const snapshotStub='// Snapshot acquisition is stubbed here to isolate producer ordering; the real\n// pixel plane has its own contracts and native zero-difference comparisons.\nconst captureGpuFrame=(_gl,canvas)=>createImageBitmap(canvas);\n';
import test from 'node:test';
import {serveGpuWorkerEndpoint} from '../src/gpuWorkerEndpoint.js';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
async function fixture(){
 const source=(await readFile(new URL('../src/connectedSurfaceWorker.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const posts=[],timers=[],prepared=[],drawn=[];let cold=false,closed=0;
 const self={postMessage:(data,transfer)=>posts.push({data,transfer})};
 vm.runInNewContext(snapshotStub+source,{serveGpuWorkerEndpoint:receive=>serveGpuWorkerEndpoint(receive,self),self,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
  connectedSurfaceStatus:()=>({backend:'WebGL2 connected surface'}),spriteSourceStatus:()=>({}),
  prepareConnectedTexture:img=>{prepared.push(img.tag);return img.tag==='ready'||cold;},
  connectedTextureFailed:img=>img.tag==='failed',
  renderConnectedSurfaceInWorker:img=>{drawn.push(img.tag);return{canvas:{},gl:{},draw:[0,0,2,2]};},
  afterGpuCommands:(_gl,done)=>{done();return()=>{};},
  createImageBitmap:async()=>({close(){closed++;}})
 });
 for(const[id,tag]of [[1,'ready'],[2,'cold'],[3,'failed']])await self.onmessage({data:{kind:'image',requestId:id,imageId:id,bitmap:{width:2,height:2,tag,close(){}}}});
 return{posts,timers,prepared,drawn,ready:()=>{cold=true;},closed:()=>closed,
  request:(key,requestId,imageId)=>self.onmessage({data:{kind:'raster',key,requestId,imageId,frame:{},mesh:{},density:1,smoothing:false}}),
  async pump(){assert(timers.length);timers.shift()();await flush();}};
}

test('a ready oldest pose completes while thirty-one later poses have cold textures',async()=>{
 const f=await fixture();await f.request('head',10,1);for(let n=0;n<31;n++)await f.request('tail-'+n,11+n,2);
 await f.pump();assert.deepEqual(f.prepared,['ready']);assert.deepEqual(f.drawn,['ready']);
 const first=f.posts.filter(p=>p.data.kind==='raster');assert.equal(first.length,1);assert.equal(first[0].data.key,'head');assert.equal(first[0].data.requestId,10);
 f.ready();for(let n=0;n<31;n++)await f.pump();const replies=f.posts.filter(p=>p.data.kind==='raster');
 assert.equal(replies.length,32);assert.deepEqual(replies.map(p=>p.data.requestId),Array.from({length:32},(_,n)=>10+n));
 assert(replies.every(p=>p.transfer[0]===p.data.bitmap));assert.equal(f.closed(),0,'Transferred snapshots keep their receiver ownership');
});

test('evicted and failed queue heads retire in order before the next ready pose',async()=>{
 const f=await fixture();await f.request('evicted',10,99);await f.request('failed',11,3);await f.request('ready',12,1);await f.request('cold',13,2);
 await f.pump();const replies=f.posts.filter(p=>p.data.kind==='raster');assert.equal(replies.length,3);
 assert.deepEqual(replies.map(p=>[p.data.requestId,p.data.error||null]),[[10,'artwork_evicted'],[11,'sprite_upload_failed'],[12,null]]);
 assert.deepEqual(f.prepared,['ready']);assert.deepEqual(f.drawn,['ready']);f.ready();await f.pump();
 assert.deepEqual(f.posts.filter(p=>p.data.kind==='raster').map(p=>p.data.requestId),[10,11,12,13]);
});
