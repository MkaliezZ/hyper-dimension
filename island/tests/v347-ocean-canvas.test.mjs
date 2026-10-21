import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {serveGpuWorkerEndpoint} from '../src/gpuWorkerEndpoint.js';
const source=async name=>(await readFile(new URL('../src/'+name,import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');

async function workerFixture({readbackFails=false,renderFails=false}={}){
 const posts=[],order=[],copies=[],allocations=[],masks=[];
 const self={postMessage:(data,transfer)=>posts.push({data,transfer})};
 class OffscreenCanvas{
  constructor(width,height){this.width=width;this.height=height;allocations.push(this);}
  getContext(){return{setTransform(){},clearRect(){},getImageData(){order.push('readback');if(readbackFails)throw Error('actual readback failed');return{};}};}
 }
 vm.runInNewContext(await source('oceanCanvasWorker.js'),{serveGpuWorkerEndpoint:receive=>serveGpuWorkerEndpoint(receive,self),self,OffscreenCanvas,
  createCanvasOceanField:({width,height,cell})=>{const field={width,height,cell,waterMask:{width:width*cell,height:height*cell}};masks.push(field.waterMask);return field;},
  renderCanvasOcean(){order.push('draw');if(renderFails)throw Error('actual draw failed');},
  createImageBitmap(){order.push('copy');let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});copies.push({resolve,reject});return promise;}
 });
 const field=(fieldId=1)=>self.onmessage({data:{kind:'field',fieldId,width:4,height:4,cell:4,water:new Uint8Array(16)}});
 const frame=(requestId=1,extra={})=>self.onmessage({data:{kind:'frame',frame:{fieldId:1,requestId,width:16,height:16,matrix:[1,0,0,1,0,0],view:{x:0,y:0,w:16,h:16},time:1,theme:'pixel',...extra}}});
 return{posts,order,copies,allocations,masks,field,frame};
}
test('compatibility producer completes its 2D work before an independent snapshot is transferred',async()=>{
 const f=await workerFixture();await f.field();const pending=f.frame(71);assert.deepEqual(f.order,['draw','readback','copy']);assert.equal(f.posts.filter(x=>x.data.kind==='frame').length,0);
 const bitmap={close(){assert.fail('A transferred live bitmap belongs to the receiver');}};f.copies[0].resolve(bitmap);await pending;
 const message=f.posts.at(-1);assert.equal(message.data.kind,'frame');assert.equal(message.data.requestId,71);assert.equal(message.data.bitmap,bitmap);assert.equal(message.transfer[0],bitmap);
});
test('a second frame cannot overwrite a producer whose snapshot is still pending',async()=>{
 const f=await workerFixture();await f.field();const pending=f.frame(1);await f.frame(2);assert.equal(f.posts.at(-1).data.error,'canvas_ocean_frame_overlap');
 let closed=0;f.copies[0].resolve({close(){closed++;}});await pending;assert.equal(closed,1);assert.equal(f.posts.filter(x=>x.data.kind==='frame').length,0);
});
test('actual readback failure cannot report a completed frame or start a snapshot',async()=>{
 const f=await workerFixture({readbackFails:true});await f.field();await f.frame();assert.equal(f.copies.length,0);assert.equal(f.posts.at(-1).data.kind,'fatal');assert.equal(f.posts.at(-1).data.error,'actual readback failed');
});
test('actual drawing or snapshot failure remains a failure instead of a false frame acknowledgment',async()=>{
 for(const phase of ['draw','copy']){const f=await workerFixture({renderFails:phase==='draw'});await f.field();const pending=f.frame();if(phase==='copy')f.copies[0].reject(Error('actual copy failed'));await pending;assert.equal(f.posts.at(-1).data.kind,'fatal');assert.equal(f.posts.filter(x=>x.data.kind==='frame').length,0);}
});
test('aggregate frame allocations are checked before any producer surface is allocated',async()=>{
 const f=await workerFixture();await f.field();await f.frame(1,{width:5000,height:5000});assert.equal(f.posts.at(-1).data.error,'canvas_ocean_frame_budget');assert.equal(f.allocations.length,0);assert.equal(f.order.length,0);
});
test('at most two shore masks survive registration of later fields',async()=>{
 const f=await workerFixture();await f.field(1);await f.field(2);assert.equal(f.masks[0].width,16);await f.field(3);assert.equal(f.masks[0].width,0);assert.equal(f.masks[0].height,0);assert.equal(f.masks[1].width,16);assert.equal(f.masks[2].width,16);
});

async function surfaceFixture(){
 const clients=[],painted=[],state={bitmap:null,error:null};
 const context={Worker:function(){},OffscreenCanvas:function(){},createImageBitmap(){},
  createOceanSurfaceClient:()=>{const entry={disposed:0,frame(field,frame){this.field=field;this.sent=frame;return state.bitmap;},inspect:()=>({backend:'webgl2-worker',ready:true,draws:1,error:state.error}),dispose(){this.disposed++;}};clients.push(entry);return entry;}};
 const body=(await source('oceanCanvasSurface.js')).replace(/export function /g,'function ').replaceAll('import.meta.url',JSON.stringify('http://owned/src/oceanCanvasSurface.js'));
 vm.runInNewContext(body+'\nglobalThis.api={drawCanvasOcean,canvasOceanStatus,releaseCanvasOcean};',context);
 const canvas={},target={canvas,getTransform:()=>({a:2,b:0,c:0,d:2,e:3,f:4,inverse:()=>({a:.5,b:0,c:0,d:.5,e:-1.5,f:-2})}),save(){painted.push('save');},restore(){painted.push('restore');},setTransform(...args){painted.push(args);},drawImage(...args){painted.push(args);}};
 canvas.width=20;canvas.height=10;
 const draw=()=>context.api.drawCanvasOcean(target,{width:4,height:4,cell:4},'pixel',1,{night:0},{x:0,y:0,w:10,h:10});
 return{context,clients,painted,state,canvas,draw,api:context.api};
}
test('a previous-camera ready flag cannot pretend the current pending frame was painted',async()=>{
 const f=await surfaceFixture();assert.equal(f.draw(),true);assert.equal(f.api.canvasOceanStatus(f.canvas).ready,false);assert.equal(f.painted.length,0);assert.equal(f.clients.length,1);
});
test('an actual compatibility bitmap is composited at identity and is never labelled as WebGL output',async()=>{
 const f=await surfaceFixture();f.state.bitmap={};assert.equal(f.draw(),true);assert.equal(f.api.canvasOceanStatus(f.canvas).backend,'canvas-worker');assert.equal(f.api.canvasOceanStatus(f.canvas).ready,true);
 assert.equal(f.painted[0],'save');assert.deepEqual(f.painted[1],[1,0,0,1,0,0]);assert.deepEqual(f.painted[2],[f.state.bitmap,0,0]);assert.equal(f.painted[3],'restore');
});
test('explicit lifecycle release disposes one owned producer exactly once',async()=>{
 const f=await surfaceFixture();f.draw();f.api.releaseCanvasOcean(f.canvas);f.api.releaseCanvasOcean(f.canvas);assert.equal(f.clients[0].disposed,1);assert.equal(f.api.canvasOceanStatus(f.canvas).ready,false);
});
test('unsupported or actually failed Worker transport leaves the original compatibility path available',async()=>{
 const f=await surfaceFixture();f.context.Worker=undefined;assert.equal(f.draw(),false);assert.equal(f.clients.length,0);
 f.context.Worker=function(){};f.state.error='real transport failure';assert.equal(f.draw(),false);assert.equal(f.painted.length,0);
});
