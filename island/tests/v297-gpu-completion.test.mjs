import test from 'node:test';
import assert from 'node:assert/strict';
import {afterGpuCommands} from '../src/gpuCompletion.js';
import {createSpriteMesh} from '../src/characterRig.js';

function fixture(){
 let id=0,lost=false,error=0;const timers=new Map(),calls=[];
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,TIMEOUT_EXPIRED:2,ALREADY_SIGNALED:3,CONDITION_SATISFIED:4,WAIT_FAILED:5,NO_ERROR:0,MAX_TEXTURE_SIZE:6,
  fenceSync:()=>{calls.push('fence');return {};},flush:()=>calls.push('flush'),deleteSync:()=>calls.push('deleteSync'),
  isContextLost:()=>lost,clientWaitSync:(_sync,flags,timeout)=>{calls.push(['wait',flags,timeout]);return gl.waitState;},
  getError:()=>{calls.push('getError');return error;},waitState:2};
 const schedule=fn=>{timers.set(++id,fn);return id;},cancel=id=>timers.delete(id);
 return {gl,calls,timers,schedule,cancel,lose(){lost=true;},error(value){error=value;},run(){const [key,fn]=timers.entries().next().value||[];assert(fn,'A future polling task must exist');timers.delete(key);fn();}};
}

test('GPU upload validation yields between zero-timeout polls and checks errors only after completion',()=>{
 const f=fixture();let valid=0,rejected=0;afterGpuCommands(f.gl,()=>{assert.equal(f.gl.getError(),0);valid++;},()=>rejected++,f);
 assert.equal(valid,0);assert.deepEqual(f.calls,['fence','flush']);
 for(let n=0;n<4;n++){f.run();assert.equal(valid,0);assert.equal(f.calls.includes('getError'),false);assert.equal(f.timers.size,1);}
 f.gl.waitState=f.gl.CONDITION_SATISFIED;f.run();assert.equal(valid,1);assert.equal(rejected,0);assert.equal(f.timers.size,0);
 assert(f.calls.filter(Array.isArray).every(call=>call[1]===0&&call[2]===0));assert.equal(f.calls.filter(c=>c==='deleteSync').length,1);
});

test('allocation errors after a completed fence reject the upload',()=>{
 const f=fixture();let rejection;f.error(1285);f.gl.waitState=f.gl.ALREADY_SIGNALED;
 afterGpuCommands(f.gl,()=>{if(f.gl.getError())throw Error('out of memory');},error=>rejection=error,f);f.run();
 assert.equal(rejection.message,'out of memory');assert.equal(f.timers.size,0);assert.equal(f.calls.filter(c=>c==='deleteSync').length,1);
});

test('context loss and failed fences reject without querying a busy GPU',()=>{
 for(const contextLost of [true,false]){const f=fixture();let count=0;afterGpuCommands(f.gl,()=>assert.fail('must not validate'),()=>count++,f);
  if(contextLost)f.lose();else f.gl.waitState=f.gl.WAIT_FAILED;f.run();assert.equal(count,1);assert.equal(f.calls.includes('getError'),false);assert.equal(f.timers.size,0);
 }
});

test('missing fence and submit failure reject without leaving a timer',()=>{
 for(const kind of ['fence','flush']){const f=fixture();let count=0;if(kind==='fence')f.gl.fenceSync=()=>null;else f.gl.flush=()=>{throw Error('submit failed');};
  afterGpuCommands(f.gl,()=>assert.fail('must not validate'),()=>count++,f);assert.equal(count,1);assert.equal(f.timers.size,0);
 }
});

test('cancelling an outstanding upload cleans its fence and cannot validate later',()=>{
 const f=fixture();const stop=afterGpuCommands(f.gl,()=>assert.fail('cancelled'),()=>assert.fail('cancelled'),f),stale=[...f.timers.values()][0];
 stop();stop();stale();assert.equal(f.timers.size,0);assert.equal(f.calls.filter(c=>c==='deleteSync').length,1);assert.equal(f.calls.some(Array.isArray),false);
});

async function rendererFixture(t){
 const f=fixture(),listeners=new Map();let textureId=0;const deleted=[],draws=[];
 Object.assign(f.gl,{COMPILE_STATUS:10,LINK_STATUS:11,createShader:()=>({}),getShaderParameter:()=>true,createProgram:()=>({}),getProgramParameter:()=>true,
  getAttribLocation:()=>0,getUniformLocation:()=>({}),createBuffer:()=>({}),getParameter:parameter=>{assert.equal(parameter,f.gl.MAX_TEXTURE_SIZE);return 4096;},
  createTexture:()=>({id:++textureId}),deleteTexture:texture=>deleted.push(texture.id)});
 const gl=new Proxy(f.gl,{get:(target,key)=>key in target?target[key]:()=>{}}),context=new Proxy({imageSmoothingEnabled:true,getTransform:()=>({a:1,b:0,c:0,d:1}),drawImage:(...args)=>draws.push(args)},{get:(target,key)=>key in target?target[key]:()=>{}});
 t.mock.method(globalThis,'setTimeout',f.schedule);t.mock.method(globalThis,'clearTimeout',f.cancel);
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({width:0,height:0,getContext:kind=>kind==='webgl2'?gl:context,addEventListener:(kind,fn)=>listeners.set(kind,fn)})}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;});
 const renderer=await import('../src/connectedSpriteSurface.js?gpu-test='+Math.random()),image={width:64,height:128},frame={x:0,y:0,w:64,h:128},pose={width:32,height:64,gait:.2},mesh=createSpriteMesh(pose);
 const draw=(art=image)=>renderer.drawConnectedSurface(context,art,frame,mesh,next=>createSpriteMesh(next),()=>assert.fail('Pending poses must not enter the atlas through a fallback'));
 const beginUpload=()=>{assert.equal(draw(),false);assert.equal(renderer.connectedSurfaceStatus().ready,false);assert.equal(f.calls.includes('getError'),false);f.gl.waitState=f.gl.CONDITION_SATISFIED;f.run();assert.equal(renderer.connectedSurfaceStatus().ready,true);assert.equal(draw(),false);f.gl.waitState=f.gl.TIMEOUT_EXPIRED;};
 return {...f,renderer,draw,beginUpload,deleted,draws,listeners};
}

test('a pending native surface never caches a temporary fallback and later uses the validated image',async t=>{
 const f=await rendererFixture(t);f.beginUpload();assert.equal(f.renderer.connectedSurfaceStatus().poseCache.entries,0);
 assert.equal(f.renderer.connectedSurfaceStatus().pendingUploads,1);const before=f.calls.filter(c=>c==='getError').length;f.run();assert.equal(f.draw(),false);assert.equal(f.calls.filter(c=>c==='getError').length,before);
 f.gl.waitState=f.gl.CONDITION_SATISFIED;f.run();assert.equal(f.draw(),true);const status=f.renderer.connectedSurfaceStatus();assert.equal(status.pendingUploads,0);assert(status.poseCache.entries>0);assert.equal(status.uploadFailures,0);
 const errors=f.calls.filter(c=>c==='getError').length;assert.equal(f.draw(),true);assert.equal(f.calls.filter(c=>c==='getError').length,errors,'Cached poses must not query GL errors');
});

test('a failed upload releases its budget and never draws an unvalidated texture',async t=>{
 const f=await rendererFixture(t);f.beginUpload();f.error(1285);f.gl.waitState=f.gl.CONDITION_SATISFIED;f.run();
 assert.equal(f.draw(),false);assert.equal(f.draw(),false);const status=f.renderer.connectedSurfaceStatus();assert.equal(status.textures,0);assert.equal(status.textureBytes,0);assert.equal(status.poseCache.entries,0);assert.equal(status.uploadFailures,1);assert.deepEqual(f.deleted,[1]);assert.equal(f.timers.size,0);
});

test('another pending image cannot force an already validated pose back to triangle drawing',async t=>{
 const f=await rendererFixture(t);f.beginUpload();f.gl.waitState=f.gl.CONDITION_SATISFIED;f.run();assert.equal(f.draw(),true);
 assert.equal(f.draw({width:66,height:128}),false);assert.equal(f.renderer.connectedSurfaceStatus().pendingUploads,1);
 const queries=f.calls.filter(c=>c==='getError').length;assert.equal(f.draw(),true);assert.equal(f.calls.filter(c=>c==='getError').length,queries);assert.equal(f.renderer.connectedSurfaceStatus().uploadFailures,0);
 // End the owned fake upload so no test leaves a pending callback behind.
 f.run();
});

test('context loss cancels pending upload validation and clears retained surfaces',async t=>{
 const f=await rendererFixture(t);f.beginUpload();const before=f.calls.filter(c=>c==='getError').length;let prevented=false;f.lose();f.listeners.get('webglcontextlost')({preventDefault(){prevented=true;}});
 const status=f.renderer.connectedSurfaceStatus();assert(prevented);assert.equal(status.backend,'Canvas connected surface');assert.equal(status.textureBytes,0);assert.equal(status.poseCache.entries,0);assert.equal(f.timers.size,0);assert.equal(f.calls.filter(c=>c==='getError').length,before);
});
