// Reproduce the original source crop/refinement inside the artwork worker.
// No live Canvas or decoded game bitmap needs a main-thread GPU readback.
const originals=new Map(),SOFT_LIMIT=48*1024*1024,HARD_LIMIT=96*1024*1024;
let bytes=0,serial=0;
function trim(){
 while(bytes>SOFT_LIMIT){
  const oldest=[...originals].filter(([,entry])=>entry.image&&!entry.references).sort((a,b)=>a[1].used-b[1].used)[0];
  if(!oldest)return;originals.delete(oldest[0]);bytes-=oldest[1].bytes;oldest[1].image.close();
 }
}
async function original(url,premultiplyAlpha,operation){
 const parsed=new URL(url,location.href);if(parsed.origin!==location.origin||!/^https?:$/.test(parsed.protocol))throw Error('invalid_artwork_source');
 const key=parsed.href+'|'+premultiplyAlpha;let entry=originals.get(key);
 if(!entry){
  entry={references:0,used:++serial,image:null,bytes:0,ready:null};originals.set(key,entry);
  entry.ready=(async()=>{
   const response=await fetch(parsed.href,{credentials:'same-origin'});if(!response.ok)throw Error('artwork_unavailable');
   const image=await createImageBitmap(await response.blob(),{premultiplyAlpha}),size=image.width*image.height*4;
   if(size>HARD_LIMIT||bytes+size>HARD_LIMIT){image.close();throw Error('original_artwork_budget');}
   entry.image=image;entry.bytes=size;bytes+=size;return image;
  })();entry.ready.catch(()=>originals.delete(key));
 }
 entry.references++;entry.used=++serial;
 try{return await operation(await entry.ready);}finally{entry.references--;trim();}
}
export async function decodeSpriteSource(description,usage='texture'){
 if(description.kind==='original')return original(description.url,usage==='texture'?'none':'default',image=>createImageBitmap(image,{premultiplyAlpha:usage==='texture'?'none':'default'}));
 if(description.kind!=='refined'||description.source?.kind!=='original')throw Error('invalid_artwork_description');
 const {frame}=description;if(!frame||![frame.x,frame.y,frame.w,frame.h].every(Number.isFinite)||frame.w<=0||frame.h<=0)throw Error('invalid_artwork_frame');
 return original(description.source.url,'default',image=>createImageBitmap(image,frame.x,frame.y,frame.w,frame.h,description.options));
}
export const spriteSourceStatus=()=>({originalArtworkBytes:bytes,originalArtworkCacheLimitBytes:SOFT_LIMIT,originalArtworkHardLimitBytes:HARD_LIMIT});
