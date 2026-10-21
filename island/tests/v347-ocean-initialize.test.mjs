const snapshotStub='// Snapshot acquisition is stubbed here to isolate producer ordering; the real\n// pixel plane has its own contracts and native zero-difference comparisons.\nconst captureGpuFrame=(_gl,canvas)=>createImageBitmap(canvas);\n';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const candidate=fileURLToPath(new URL('../src/',import.meta.url));
const strip=source=>source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function core({parallel=true,link=true,compile=true,flushError=false}={}){
 const calls=[],timers=new Map(),events={},fences=[];let serial=0;
 const gl={complete:false,lost:false,VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,COMPILE_STATUS:4,
  getExtension(name){calls.push(['extension',name]);return parallel?{COMPLETION_STATUS_KHR:5}:null;},
  createShader(type){return{type};},shaderSource(shader,source){calls.push(['source',shader.type,source]);},compileShader(){calls.push(['compile']);},
  createProgram(){return{};},attachShader(){},linkProgram(){calls.push(['link']);},
  getProgramParameter(_program,key){calls.push(['program-query',key]);return key===5?this.complete:link;},
  getShaderParameter(){calls.push(['shader-query']);return compile;},deleteShader(shader){calls.push(['delete-shader',shader.type]);},
  isContextLost(){return this.lost;},flush(){calls.push(['flush']);if(flushError)throw Error('native-flush-failed');},
  useProgram(){calls.push(['use']);},createBuffer(){return{};},bindBuffer(){},bufferData(){},getAttribLocation(){calls.push(['attribute-query']);return 0;},enableVertexAttribArray(){},vertexAttribPointer(){},
  createTexture(){return{};},bindTexture(){},texParameteri(...args){calls.push(['texture-parameter',...args]);},getUniformLocation(_program,name){calls.push(['uniform-query',name]);return name;},
  viewport(...args){calls.push(['viewport',...args]);},pixelStorei(){},texImage2D(){calls.push(['texture-upload']);},uniform2f(){},uniformMatrix3fv(){},uniform1i(){},uniform1f(){},drawArrays(){calls.push(['draw']);}
 };
 const canvas={width:1024,height:768,getContext(kind,options){assert.equal(kind,'webgl2');assert.equal(options.antialias,false);return gl;},addEventListener(name,fn){events[name]=fn;}};
 const api={};vm.runInNewContext(strip(await readFile(candidate+'oceanShaderCore.js','utf8'))+'\napi.create=createOceanRenderer;',{
  api,Float32Array,Uint8Array,Math,clearTimeout(){},afterGpuCommands(_gl,validate,reject){const fence={validate,reject,cancelled:false};fences.push(fence);return()=>{fence.cancelled=true;};}
 });
 let losses=0,restores=0;const renderer=api.create(canvas,{onLost(){losses++;},onRestored(){restores++;},schedule(fn,ms){assert.equal(ms,8);timers.set(++serial,fn);return serial;},cancel(id){timers.delete(id);}});
 const pump=()=>{const first=timers.entries().next().value;assert(first);timers.delete(first[0]);first[1]();};
 return{renderer,gl,canvas,calls,timers,events,fences,pump,losses:()=>losses,restores:()=>restores};
}
test('parallel initialization yields until native completion before any blocking shader, link or uniform query',async()=>{
 const f=await core();assert.equal(f.renderer.ready,false);assert.throws(()=>f.renderer.draw({},{}),/ocean_renderer_pending/);
 assert(!f.calls.some(c=>c[0].includes('query')));f.pump();f.pump();assert.deepEqual(f.calls.filter(c=>c[0].includes('query')),[['program-query',5],['program-query',5]]);
 f.gl.complete=true;f.pump();assert.equal(await f.renderer.whenReady,f.renderer);assert.equal(f.renderer.ready,true);assert.equal(f.timers.size,0);assert.equal(f.calls.filter(c=>c[0]==='shader-query').length,0);
 const frame={width:1024,height:768,fieldId:1,worldWidth:2048,worldHeight:1536,inverse:[1,0,0,0,1,0,0,0,1],theme:'origami',night:0,time:1},field={width:2,height:2,pixels:new Uint8Array(8)};
 f.renderer.draw(frame,field);f.renderer.draw(frame,field);assert.equal(f.calls.filter(c=>c[0]==='draw').length,2);assert.equal(f.calls.filter(c=>c[0]==='texture-upload').length,1);assert.equal(f.canvas.width,1024);assert.equal(f.canvas.height,768);
});
for(const [name,options,message]of [['compile',{link:false,compile:false},'ocean_shader_compile'],['link',{link:false,compile:true},'ocean_shader_link']])test(name+' errors reject readiness without publishing a ready renderer',async()=>{
 const f=await core(options),rejection=assert.rejects(f.renderer.whenReady,new RegExp(message));f.gl.complete=true;f.pump();await rejection;assert.equal(f.renderer.ready,false);assert.equal(f.timers.size,0);assert.equal(f.calls.filter(c=>c[0]==='draw').length,0);assert.equal(f.calls.filter(c=>c[0]==='delete-shader').length,2);
});
test('context loss cancels initialization and cannot resolve late; restoration remains observable',async()=>{
 const f=await core(),rejection=assert.rejects(f.renderer.whenReady,/ocean_context_lost/);f.gl.lost=true;let prevented=false;f.events.webglcontextlost({preventDefault(){prevented=true;}});await rejection;
 assert(prevented);assert.equal(f.timers.size,0);assert.equal(f.renderer.lost,true);assert.equal(f.losses(),1);assert.throws(()=>f.renderer.draw({},{}),/ocean_context_lost/);f.events.webglcontextrestored();assert.equal(f.restores(),1);assert.equal(f.renderer.ready,false);
});
test('extension-free initialization waits for GPU completion before validation',async()=>{
 const f=await core({parallel:false});assert.equal(f.fences.length,1);assert(!f.calls.some(c=>c[0].includes('query')));f.fences[0].validate();await f.renderer.whenReady;assert.equal(f.renderer.ready,true);assert.equal(f.fences[0].cancelled,true);
});
test('initial submission errors reject the same readiness promise instead of leaking it',async()=>{
 const f=await core({flushError:true});await assert.rejects(f.renderer.whenReady,/native-flush-failed/);assert.equal(f.renderer.ready,false);assert.equal(f.timers.size,0);
});
async function worker(){
 const ready=deferred(),copy=deferred(),posts=[],draws=[],sizes=[],fences=[];let receive,lifecycle;
 const gl={isContextLost:()=>false},canvas={};
 vm.runInNewContext(snapshotStub+strip(await readFile(candidate+'oceanShaderWorker.js','utf8')),{
  Uint8Array,OffscreenCanvas:class{constructor(w,h){sizes.push([w,h]);}},self:{postMessage(data,transfer){posts.push({data,transfer});}},
  serveGpuWorkerEndpoint(fn){receive=fn;},coastDistanceTexture:()=>new Uint8Array(8),
  createOceanRenderer(_canvas,options){lifecycle=options;return{canvas,gl,lost:false,whenReady:ready.promise,draw(frame){draws.push(frame.requestId);}};},
  afterGpuCommands(_gl,validate,reject){const f={validate,reject,cancelled:false};fences.push(f);return()=>{f.cancelled=true;};},createImageBitmap(value){assert.equal(value,canvas);return copy.promise;}
 });
 const send=data=>receive({data});send({kind:'field',fieldId:1,width:2,height:2,cell:4,water:new Uint8Array([0,1,1,1])});
 return{ready,copy,posts,draws,sizes,fences,lost:()=>lifecycle.onLost(),request:id=>send({kind:'frame',frame:{requestId:id,fieldId:1,width:1024,height:768}})};
}
test('worker creates the requested backing size, awaits native readiness, then fences and independently snapshots the same flight',async()=>{
 const f=await worker();f.request(12);assert.deepEqual(f.sizes,[[1024,768]]);assert.deepEqual(f.draws,[]);assert.equal(f.fences.length,0);f.ready.resolve();await flush();assert.deepEqual(f.draws,[12]);assert.equal(f.fences.length,1);assert.equal(f.posts.filter(p=>p.data.kind==='frame').length,0);
 f.fences[0].validate();await flush();const bitmap={closed:false,close(){this.closed=true;}};f.copy.resolve(bitmap);await flush();assert.equal(f.posts.at(-1).data.requestId,12);assert.equal(f.posts.at(-1).data.bitmap,bitmap);assert.equal(f.posts.at(-1).transfer[0],bitmap);assert.equal(bitmap.closed,false);
});
test('worker lost before readiness never draws or publishes a late frame',async()=>{
 const f=await worker();f.request(13);f.lost();f.ready.resolve();await flush();assert.deepEqual(f.draws,[]);assert.equal(f.fences.length,0);assert.equal(f.posts.at(-1).data.kind,'lost');assert.equal(f.posts.filter(p=>p.data.kind==='frame').length,0);
});
test('worker readiness rejection is a fatal result, never a successful frame',async()=>{
 const f=await worker();f.request(14);f.ready.reject(Error('ocean_shader_compile'));await flush();assert.deepEqual(f.draws,[]);assert.equal(f.posts.at(-1).data.kind,'fatal');assert.equal(f.posts.at(-1).data.error,'ocean_shader_compile');
});
