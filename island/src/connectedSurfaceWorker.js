import {prepareConnectedTexture,renderConnectedSurfaceInWorker,connectedTextureFailed,connectedSurfaceStatus} from './connectedSpriteSurface.js';
import {decodeSpriteSource,spriteSourceStatus} from './spriteSourceDecoder.js';
import {afterGpuCommands} from './gpuCompletion.js';
const images=new Map(),jobs=[],MAX_IMAGE_BYTES=96*1024*1024;
let bytes=0,serial=0,timer=null,flight=null;
const status=()=>({...connectedSurfaceStatus(),...spriteSourceStatus(),artworkBitmapBytes:bytes,artworkBitmapLimitBytes:MAX_IMAGE_BYTES});
const send=(data,transfer=[])=>self.postMessage({...data,status:status()},transfer);
function schedule(){if(timer===null&&!flight)timer=setTimeout(pump,8);}
function drop(index,error){const [job]=jobs.splice(index,1);send({kind:'raster',key:job.key,requestId:job.requestId,error});}
function pump(){
 timer=null;if(flight||!jobs.length)return;
 try{
  // Later cold uploads must not postpone an already-ready oldest pose.
  // Retire invalid heads in order, then prepare only the current head. The
  // existing GPU fence, independent snapshot and cancellation identity remain.
  while(jobs.length){
   const image=images.get(jobs[0].imageId);
   if(!image){drop(0,'artwork_evicted');continue;}
   if(connectedTextureFailed(image.bitmap)){drop(0,'sprite_upload_failed');continue;}
   break;
  }
  if(!jobs.length)return;
  const job=jobs[0],image=images.get(job.imageId);
  const ready=prepareConnectedTexture(image.bitmap);
  if(status().backend==='Canvas connected surface')throw Error('sprite_gpu_unavailable');
  if(!ready){schedule();return;}
  image.used=++serial;
  const rendered=renderConnectedSurfaceInWorker(image.bitmap,job.frame,job.mesh,job.density,job.smoothing);
  if(!rendered){schedule();return;}
  const pending={job,cancel:null};flight=pending;
  const reject=error=>{if(flight!==pending)return;flight=null;send({kind:'fatal',error:error.message});};
  pending.cancel=afterGpuCommands(rendered.gl,()=>{
   if(flight!==pending)return;
   // Keep the producer surface stable until an independent snapshot is ready.
   // No next pose overwrites or transfers away this live drawing buffer.
   Promise.resolve().then(()=>createImageBitmap(rendered.canvas)).then(bitmap=>{
    if(flight!==pending){bitmap.close();return;}
    try{if(job.cancelled){bitmap.close();send({kind:'raster-cancelled',key:job.key,requestId:job.requestId});}else send({kind:'raster',key:job.key,requestId:job.requestId,bitmap,draw:rendered.draw},[bitmap]);}
    catch(error){bitmap.close();throw error;}
    jobs.shift();flight=null;schedule();
   }).catch(reject);
  },reject);
 }catch(error){flight?.cancel?.();flight=null;send({kind:'fatal',error:error.message});}
}
self.onmessage=async({data})=>{
 if(data.kind==='image'||data.kind==='image-source'){
  let bitmap=data.bitmap;
  try{
   if(data.kind==='image-source')bitmap=await decodeSpriteSource(data.source);
   const size=bitmap.width*bitmap.height*4;
   if(!size||size>MAX_IMAGE_BYTES)throw Error('sprite_image_budget');
   const old=images.get(data.imageId);if(old){images.delete(data.imageId);bytes-=old.bytes;dispose(old.bitmap);}
   const pinned=new Set(jobs.map(job=>job.imageId));
   while(bytes+size>MAX_IMAGE_BYTES){
    const retired=[...images].filter(([id])=>!pinned.has(id)).sort((a,b)=>a[1].used-b[1].used)[0];
    if(!retired)throw Error('sprite_image_budget');
    images.delete(retired[0]);bytes-=retired[1].bytes;dispose(retired[1].bitmap);
   }
   images.set(data.imageId,{bitmap,bytes:size,used:++serial});bytes+=size;
   send({kind:'registered',requestId:data.requestId,imageId:data.imageId});
  }catch(error){if(bitmap)dispose(bitmap);send({kind:'registered',requestId:data.requestId,imageId:data.imageId,error:error.message});}
 }else if(data.kind==='cancel-raster'){
  const index=jobs.findIndex(job=>job.key===data.key&&job.requestId===data.requestId);
  if(index>=0){
   // Finish a live GPU surface before reuse; queued obsolete poses can retire.
   // Both identities prevent a late cancellation touching a newer same-key pose.
   if(flight?.job===jobs[index])jobs[index].cancelled=true;
   else jobs.splice(index,1);
  }
  if(jobs.length)schedule();
 }else if(data.kind==='raster'){
  jobs.push(data);schedule();
 }
};
function dispose(image){if(image.close)image.close();else{image.width=0;image.height=0;}}
