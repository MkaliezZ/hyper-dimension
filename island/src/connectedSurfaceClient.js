import {createGpuWorkerEndpoint} from './gpuWorkerEndpoint.js';
// Only original artwork and mesh coordinates enter this worker. Save state,
// character decisions, tool contacts and authority receipts remain on their
// existing threads. Every returned bitmap has one explicit owner and is closed.
import {spriteSource} from './spriteSource.js';
export function createConnectedSurfaceClient({
 worker=()=>createGpuWorkerEndpoint(new URL('./connectedSurfaceWorker.js',import.meta.url)),
 bitmap=(image)=>createImageBitmap(image,{premultiplyAlpha:'none'}),
 isBitmap=image=>typeof ImageBitmap==='function'&&image instanceof ImageBitmap,
 maxRequests=32,maxBytes=16*1024*1024,onReset=()=>{},
 schedule=(fn,ms)=>setTimeout(fn,ms),cancel=clearTimeout,clock=Date.now
}={}){
 const images=new WeakMap(),failed=new WeakSet(),pending=new Map(),registration=new Map(),submitted=new Map();
 let target=null,disabled=false,serial=0,imageSerial=0,bytes=0,lastRasterAt=null,expiredRasters=0,acquiring=0,acquiringBytes=0,submittedBytes=0,healthTimer=null,healthDeadline=null,warmStartedAt=null,workerReadyAt=null;
 let status={backend:'not needed',ready:false,draws:0,textures:0,pendingUploads:0,uploadFailures:0,textureBytes:0,limitBytes:96*1024*1024};
 const finish=entry=>{if(pending.get(entry.key)!==entry)return;cancel(entry.timer);pending.delete(entry.key);bytes-=entry.bytes;if(entry.phase==='image'){acquiring--;acquiringBytes-=entry.bytes;}};
 const releaseSubmitted=requestId=>{const job=submitted.get(requestId);if(job){submittedBytes-=job.bytes;submitted.delete(requestId);}};
 const rasterDeadline=()=>{const first=submitted.values().next().value;return first?Math.max(first.at,lastRasterAt??first.at)+15000:null;};
 const rasterOverdue=()=>{const deadline=rasterDeadline();return deadline!==null&&clock()>=deadline;};
 function watchRaster(){
  const deadline=disabled?null:rasterDeadline();if(deadline===healthDeadline)return;
  if(healthTimer!==null)cancel(healthTimer);healthTimer=null;healthDeadline=deadline;
  if(deadline===null)return;
  healthTimer=schedule(()=>{healthTimer=null;healthDeadline=null;if(rasterOverdue())fail('sprite_raster_timeout');else watchRaster();},Math.max(0,deadline-clock()));
 }
 function fail(reason='sprite_worker_unavailable'){
  if(disabled)return;const at=clock(),first=submitted.values().next().value,failureObservation={pendingRasters:pending.size,submittedRasters:submitted.size,acquiringImages:acquiring,lastRasterAgoMs:lastRasterAt===null?null:at-lastRasterAt,oldestSubmittedAgoMs:first?at-first.at:null};disabled=true;target?.terminate();target=null;
  if(healthTimer!==null)cancel(healthTimer);healthTimer=null;healthDeadline=null;
  for(const entry of pending.values())cancel(entry.timer);pending.clear();submitted.clear();bytes=0;acquiring=0;acquiringBytes=0;submittedBytes=0;
  for(const entry of registration.values()){cancel(entry.timer);entry.reject(Error('sprite_worker_unavailable'));}registration.clear();
  status={...status,backend:'Canvas connected surface',ready:false,pendingUploads:0,workerFailureCode:reason,failureObservation};onReset();
 }
 function start(){
  if(disabled)return null;if(target)return target;
  try{
   target=worker();target.onerror=()=>fail('sprite_worker_error');
   target.onmessage=({data})=>{
    if(disabled){data.bitmap?.close();return;}
    if(data.status)status=data.status;
    if(data.kind==='ready'){workerReadyAt=clock();return;}
    if(data.kind==='fatal'){data.bitmap?.close();fail(data.error||'sprite_worker_error');return;}
    if(data.kind==='registered'){
     const entry=registration.get(data.requestId);if(!entry)return;
     registration.delete(data.requestId);cancel(entry.timer);
     data.error?entry.reject(Error(data.error)):entry.resolve(data.imageId);return;
    }
    // A completed older pose still proves this worker is making progress.
    if(data.kind==='raster'&&!data.error&&data.bitmap||data.kind==='raster-cancelled')lastRasterAt=clock();
    if((data.kind==='raster'||data.kind==='raster-cancelled')&&submitted.get(data.requestId)?.key===data.key)releaseSubmitted(data.requestId);
    watchRaster();
    if(data.kind==='raster-cancelled')return;
    const entry=pending.get(data.key);
    if(!entry||entry.requestId!==data.requestId){data.bitmap?.close();return;}
    finish(entry);
    if(data.error){
     if(data.error==='artwork_evicted')images.delete(entry.image);
     else failed.add(entry.image);
     data.bitmap?.close();return;
    }
    if(!data.bitmap)return;
    try{entry.receive(data.bitmap,data.draw);}finally{data.bitmap.close();}
   };
   return target;
  }catch{fail();return null;}
 }
 function imageId(image){
  let ready=images.get(image);if(ready)return ready;
  const id=++imageSerial;
  // Decoded ImageBitmaps are immutable and structured-cloneable. Share a clone
  // with the worker without detaching or recreating the live game's bitmap.
  // A refined ImageBitmap already contains the exact original crop/resize.
  // Clone that immutable bitmap directly instead of fetching and decoding its
  // source a second time. Canvas/HTML images still use their source operation,
  // avoiding readback of a live drawing surface on the animation thread.
  const source=isBitmap(image)?null:spriteSource(image),ownedCopy=!source&&!isBitmap(image);
  ready=Promise.resolve().then(()=>source?null:ownedCopy?bitmap(image):image).then(copy=>new Promise((resolve,reject)=>{
   const endpoint=start();if(!endpoint){if(ownedCopy)copy.close();reject(Error('sprite_worker_unavailable'));return;}
   const requestId=++serial,timer=schedule(()=>fail('sprite_image_registration_timeout'),15000);registration.set(requestId,{timer,resolve,reject});
   try{endpoint.postMessage(source?{kind:'image-source',requestId,imageId:id,source}:{kind:'image',requestId,imageId:id,bitmap:copy},ownedCopy?[copy]:[]);}
   catch(error){if(ownedCopy)copy.close();registration.delete(requestId);cancel(timer);reject(error);}
  }));
  images.set(image,ready);ready.catch(()=>images.delete(image));return ready;
 }
 return {
  prepare(){
   if(disabled)return false;if(warmStartedAt!==null)return true;
   const endpoint=start();if(!endpoint)return false;warmStartedAt=clock();
   try{endpoint.postMessage({kind:'warm'});return true;}catch{fail('sprite_worker_unavailable');return false;}
  },
  request(key,image,raster,receive){
   if(disabled||failed.has(image)||pending.has(key))return false;
   // The existing low-quality preview keeps its original direct Canvas path.
   // Wait for the exact high-quality refinement before caching GPU skin poses;
   // rebuilding a live preview would introduce a GPU readback or resampling.
   if(spriteSource(image)?.kind==='preview')return false;
   const size=raster.w*raster.h*4;
   if(pending.size>=maxRequests||acquiring+submitted.size>=maxRequests||size>maxBytes||acquiringBytes+submittedBytes+size>maxBytes)return false;
   if(!start())return false;
   const requestId=++serial,entry={key,image,requestId,receive,bytes:size,phase:'image',timer:null};
   entry.timer=schedule(()=>{
    if(pending.get(key)!==entry)return;
    if(entry.phase==='image'){fail('sprite_image_copy_timeout');return;}
    // Keep the original whole-request deadline, including image acquisition.
    // GPU liveness starts when actual raster work is submitted, not during an
    // earlier idle period. Expired work retains its slot until its exact reply
    // or cancellation; a separate 15 second watchdog covers that interval.
    if(rasterOverdue()){fail('sprite_raster_timeout');return;}
    finish(entry);expiredRasters++;
    try{target?.postMessage({kind:'cancel-raster',key:entry.key,requestId:entry.requestId});}catch{fail('sprite_worker_error');}
   },15000);
   pending.set(key,entry);bytes+=size;acquiring++;acquiringBytes+=size;
   imageId(image).then(id=>{
    if(disabled||pending.get(key)!==entry)return;
    entry.phase='raster';acquiring--;acquiringBytes-=size;submitted.set(requestId,{key,at:clock(),bytes:size});submittedBytes+=size;watchRaster();
    try{start().postMessage({kind:'raster',key,requestId,imageId:id,...raster});}catch(error){releaseSubmitted(requestId);watchRaster();throw error;}
   }).catch(()=>{if(pending.get(key)===entry)finish(entry);});
   return true;
  },
  inspect:()=>({...status,renderThread:'worker',workerBoot:{requestedAt:warmStartedAt,readyAt:workerReadyAt,ready:workerReadyAt!==null},pendingRasters:pending.size,pendingRasterBytes:bytes,pendingRasterLimitBytes:maxBytes,submittedRasters:submitted.size,submittedRasterBytes:submittedBytes,outstandingRasterBytes:acquiringBytes+submittedBytes,expiredRasters}),
  dispose:fail
 };
}
