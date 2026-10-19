import {prepareConnectedTexture,renderConnectedSurfaceInWorker,connectedTextureFailed,connectedSurfaceStatus} from './connectedSpriteSurface.js';
import {decodeSpriteSource,spriteSourceStatus} from './spriteSourceDecoder.js';
const images=new Map(),jobs=[],MAX_IMAGE_BYTES=96*1024*1024;
let bytes=0,serial=0,timer=null;
const status=()=>({...connectedSurfaceStatus(),...spriteSourceStatus(),artworkBitmapBytes:bytes,artworkBitmapLimitBytes:MAX_IMAGE_BYTES});
const send=(data,transfer=[])=>self.postMessage({...data,status:status()},transfer);
function schedule(){if(timer===null)timer=setTimeout(pump,8);}
function drop(index,error){const [job]=jobs.splice(index,1);send({kind:'raster',key:job.key,requestId:job.requestId,error});}
function pump(){
 timer=null;if(!jobs.length)return;
 try{
  let ready=true;
  for(let i=0;i<jobs.length;i++){
   const image=images.get(jobs[i].imageId);
   if(!image){drop(i--,'artwork_evicted');continue;}
   if(connectedTextureFailed(image.bitmap)){drop(i--,'sprite_upload_failed');continue;}
   if(!prepareConnectedTexture(image.bitmap))ready=false;
  }
  if(status().backend==='Canvas connected surface')throw Error('sprite_gpu_unavailable');
  if(!ready){schedule();return;}
  while(jobs.length){
   const job=jobs[0],image=images.get(job.imageId);
   if(!image){drop(0,'artwork_evicted');continue;}
   image.used=++serial;
   const rendered=renderConnectedSurfaceInWorker(image.bitmap,job.frame,job.mesh,job.density,job.smoothing);
   if(!rendered){schedule();return;}
   const bitmap=rendered.canvas.transferToImageBitmap();jobs.shift();
   try{send({kind:'raster',key:job.key,requestId:job.requestId,bitmap,draw:rendered.draw},[bitmap]);}catch(error){bitmap.close();throw error;}
  }
 }catch(error){send({kind:'fatal',error:error.message});}
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
 }else if(data.kind==='raster'){
  jobs.push(data);schedule();
 }
};
function dispose(image){if(image.close)image.close();else{image.width=0;image.height=0;}}
