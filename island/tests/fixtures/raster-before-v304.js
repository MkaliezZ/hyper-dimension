import {artworkURL,shoreOptions,fadeIslandEdge} from './rasterProcessing.js';
// Only original artwork URLs enter the worker; animation uses cached static images.
const entries=new WeakMap(),queue=[],cache=new Map(),maxBytes=64*1024*1024*4;
let worker=null,busy=false,disabled=false,serial=0,backend='preparing';
const requests=new Map(),stats={ready:0,pending:0,failures:0,bytes:0,encodedBytes:0,evictions:0,processed:0,processingMs:0};
function failWorker(){
 disabled=true;backend='native canvas';worker?.terminate();worker=null;
 for(const r of requests.values()){clearTimeout(r.timer);r.reject(Error('raster_worker_unavailable'));}
 requests.clear();
}
function request(job){
 if(disabled||typeof Worker==='undefined'){disabled=true;backend='native canvas';return Promise.reject(Error('raster_worker_unavailable'));}
 if(!worker){worker=new Worker(new URL('./rasterQualityWorker.js',import.meta.url),{type:'module'});worker.onerror=failWorker;worker.onmessage=({data})=>{
  const r=requests.get(data.requestId);if(!r)return;requests.delete(data.requestId);clearTimeout(r.timer);data.error?r.reject(Error(data.error)):r.resolve(data);
 };}
 const requestId=++serial;
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(failWorker,60_000);requests.set(requestId,{resolve,reject,timer});
  try{worker.postMessage({requestId,url:artworkURL(job.source.currentSrc||job.source.src,location.href),theme:job.theme,shore:job.shore});}
  catch(error){requests.delete(requestId);clearTimeout(timer);reject(error);}
 });
}
async function decode(blob){
 const url=URL.createObjectURL(blob),image=new Image();
 try{image.src=url;await image.decode();return image;}finally{URL.revokeObjectURL(url);}
}
function touch(entry){if(cache.has(entry)){cache.delete(entry);cache.set(entry,true);}}
function retain(entry,result){
 entry.surface=result.image;entry.factor=result.factor;entry.status='ready';entry.bytes=result.width*result.height*4;entry.encodedBytes=result.blob.size;
 stats.ready++;stats.bytes+=entry.bytes;stats.encodedBytes+=entry.encodedBytes;cache.set(entry,true);
 while(stats.bytes>maxBytes&&cache.size>1){
  const old=cache.keys().next().value;cache.delete(old);stats.bytes-=old.bytes;stats.encodedBytes-=old.encodedBytes;stats.ready--;stats.evictions++;
  old.surface=null;old.factor=1;old.status='evicted';old.bytes=old.encodedBytes=0;
 }
}
const yieldFrame=()=>new Promise(resolve=>setTimeout(resolve,0));
async function fallback(job){
 // Unsupported worker fallback is chunked so the shoreline mask never runs as one large loop.
 if(!job.shore)return;
 const {source,entry,shore}=job,width=source.naturalWidth||source.width,height=source.naturalHeight||source.height;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 try{
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(source,0,0);
  const pixels=ctx.getImageData(0,0,width,height);
  for(let y=0;y<height;y+=32){fadeIslandEdge(pixels.data,width,height,shore,y,y+32);await yieldFrame();}
  ctx.putImageData(pixels,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('raster_encoding_unavailable');
  retain(entry,{image:await decode(blob),factor:1,width,height,blob});
 }finally{canvas.width=1;canvas.height=1;}
}
async function schedule(){
 if(busy||!queue.length)return;busy=true;
 while(queue.length){
  const job=queue.shift();
  try{
   const result=await request(job);const image=await decode(result.blob);backend=result.backend;
   retain(job.entry,{...result,image});stats.processed++;stats.processingMs+=result.processingMs;
  }catch{
   job.entry.status='fallback';stats.failures++;
   try{await fallback(job);}catch{job.entry.status='fallback';}
  }finally{stats.pending--;}
 }
 busy=false;
}
function surfaceFor(source,theme,shore=null){
 let variants=entries.get(source);if(!variants){variants=new Map();entries.set(source,variants);}
 const key=theme+'|'+(shore?shore.width+':'+shore.height+':'+shore.rim:'plain');
 let entry=variants.get(key);if(!entry){entry={surface:source,factor:1,status:'new'};variants.set(key,entry);}
 if(entry.status==='new'||entry.status==='evicted'){
  entry.status='pending';entry.surface=source;entry.factor=1;queue.push({source,theme,shore,entry});stats.pending++;schedule();
 }else touch(entry);
 return entry;
}
function draw(ctx,source,theme,shore,rect){
 if(!(source.naturalWidth||source.width))return;
 const e=surfaceFor(source,theme,shore),factor=e.factor;
 ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.imageSmoothingQuality='high';
 if(rect.length===8){const [x,y,w,h,dx,dy,dw,dh]=rect;ctx.drawImage(e.surface,x*factor,y*factor,w*factor,h*factor,dx,dy,dw,dh);}
 else ctx.drawImage(e.surface,...rect);
 ctx.restore();
}
export function drawRaster(ctx,source,theme,...rect){draw(ctx,source,theme,null,rect);}
export function drawIslandRaster(ctx,source,theme,extent,...rect){draw(ctx,source,theme,shoreOptions({...extent,rim:128}),rect);}
export function rasterQualityStatus(){return {...stats,storage:'decoded-image',backend,cacheLimitBytes:maxBytes};}
// Match fractional OS scaling without an arbitrary DPR=2 cap.
export function canvasResolution(width,height,ratio=1){
 const native=Math.max(1,Number(ratio)||1),density=Math.min(native,Math.sqrt(48_000_000/Math.max(1,width*height)),16384/Math.max(1,width,height));
 const w=Math.max(1,Math.round(width*density)),h=Math.max(1,Math.round(height*density));
 return {width:w,height:h,x:w/Math.max(1,width),y:h/Math.max(1,height),native};
}
export function rasterTransform(width,height,worldWidth,worldHeight,zoom,camera,ratioX=1,ratioY=1){
 const scale=Math.max(width/worldWidth,height/worldHeight)*zoom;
 return {scale,ox:Math.round((width/2-camera.x*scale)*ratioX)/ratioX,oy:Math.round((height/2-camera.y*scale)*ratioY)/ratioY};
}
