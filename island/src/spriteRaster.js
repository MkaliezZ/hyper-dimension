// Crop once at the current backing-pixel scale. Rig segments still move independently.
export function createSpriteRasterCache({maxPixels=4*1024*1024,canvas=()=>document.createElement('canvas'),bitmap=typeof createImageBitmap==='function'? (...args)=>createImageBitmap(...args):null}={}){
 const identities=new WeakMap(),entries=new Map(),queue=[];let serial=0,pixels=0,hits=0,misses=0,active=0,refined=0;
 const dispose=value=>value.image?.close?.();
 function pump(){
  while(bitmap&&active<2&&queue.length){
   const job=queue.shift();if(entries.get(job.key)!==job.value)continue;active++;
   Promise.resolve().then(()=>bitmap(job.image,job.frame.x,job.frame.y,job.frame.w,job.frame.h,{resizeWidth:job.width,resizeHeight:job.height,resizeQuality:'high'}))
    .then(image=>{if(entries.get(job.key)!==job.value){image.close?.();return;}dispose(job.value);job.value.image=image;refined++;})
    .catch(()=>{}).finally(()=>{active--;pump();});
  }
 }
 function prepare(ctx,image,frame){
  if(!frame||![frame.x,frame.y,frame.w,frame.h].every(Number.isFinite)||frame.w<=0||frame.h<=0)return null;
  const transform=ctx.getTransform(),scale=Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d));
  if(!Number.isFinite(scale)||scale<=0)return null;
  const height=Math.min(frame.h,Math.max(64,Math.ceil(96*scale*1.15/64)*64));
  if(height>=frame.h*.9)return null;
  let id=identities.get(image);if(!id){id=++serial;identities.set(image,id);}
  const key=[id,frame.x,frame.y,frame.w,frame.h,height].join(':');
  if(entries.has(key)){const value=entries.get(key);entries.delete(key);entries.set(key,value);hits++;return value;}
  const factor=height/frame.h,width=frame.w*factor,w=Math.ceil(width),h=Math.ceil(height);
  if(w*h>maxPixels)return null;
  const surface=canvas();surface.width=w;surface.height=h;
  const draw=surface.getContext('2d');draw.imageSmoothingEnabled=true;draw.imageSmoothingQuality='low';
  draw.drawImage(image,frame.x,frame.y,frame.w,frame.h,0,0,w,h);
  const value={image:surface,frame:{x:0,y:0,w,h,aspectRatio:frame.w/frame.h},pixels:w*h};
  entries.set(key,value);pixels+=value.pixels;misses++;
  while(pixels>maxPixels&&entries.size>1){const oldest=entries.keys().next().value,retired=entries.get(oldest);pixels-=retired.pixels;entries.delete(oldest);dispose(retired);}
  if(bitmap){queue.push({key,value,image,frame:{...frame},width:w,height:h});pump();}
  return value;
 }
 return{prepare,inspect:()=>({entries:entries.size,pixels,hits,misses,maxPixels,refined,active,queued:queue.length})};
}
