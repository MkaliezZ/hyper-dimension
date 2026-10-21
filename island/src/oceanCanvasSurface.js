import {createGpuWorkerEndpoint} from './gpuWorkerEndpoint.js';
import {createOceanSurfaceClient} from './oceanSurfaceClient.js';

// The compatibility artwork has its own bounded producer. It uses the same
// one-frame flight/newest-camera protocol and original fifteen-second guards.
const surfaces=new WeakMap();
export function releaseCanvasOcean(canvas){const entry=surfaces.get(canvas);if(entry){entry.client.dispose();surfaces.delete(canvas);}}
export function canvasOceanStatus(canvas){
 const entry=surfaces.get(canvas),state=entry?.client.inspect();
 return state?{...state,ready:entry.presented,backend:entry.presented?'canvas-worker':'canvas-worker pending'}:
  {backend:'canvas-worker pending',ready:false,draws:0,renderThread:'worker'};
}
export function drawCanvasOcean(target,field,theme,time,env,view){
 if(typeof Worker!=='function'||typeof OffscreenCanvas!=='function'||typeof createImageBitmap!=='function')return false;
 let entry=surfaces.get(target.canvas);
 if(!entry){entry={client:createOceanSurfaceClient({worker:()=>createGpuWorkerEndpoint(new URL('./oceanCanvasWorker.js',import.meta.url))}),presented:false};surfaces.set(target.canvas,entry);}
 const surface=entry.client;
 const m=target.getTransform(),inverse=m.inverse();
 const bitmap=surface.frame(field,{width:target.canvas.width,height:target.canvas.height,
  worldWidth:field.width*field.cell,worldHeight:field.height*field.cell,
  inverse:[inverse.a,inverse.b,0,inverse.c,inverse.d,0,inverse.e,inverse.f,1],
  matrix:[m.a,m.b,m.c,m.d,m.e,m.f],view,theme,time,night:env?.night||0});
 entry.presented=!!bitmap;const state=surface.inspect();
 if(state.error)return false;
 if(bitmap){target.save();try{target.setTransform(1,0,0,1,0,0);target.drawImage(bitmap,0,0);}finally{target.restore();}}
 // A supported producer owns this frame even while its first copy is pending.
 // No synchronous main-thread wave/mask copies are submitted in that interval.
 return true;
}
