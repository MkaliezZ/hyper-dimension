import {terrainSurfaceSize} from './terrainResolution.js';
import {maskTerrainRows,terrainOverviewURL} from './mapTileLayout.js';
const yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
const check=signal=>signal?.throwIfAborted();
export function closeTerrainSurface(surface){
 if(!surface)return;
 if(typeof surface.close==='function')surface.close();
 else{surface.width=1;surface.height=1;}
}
async function decode(url,signal){
 const response=await fetch(url,{signal});if(!response.ok)throw Error(`terrain_http_${response.status}`);
 const blob=await response.blob();check(signal);
 if(typeof createImageBitmap==='function')return createImageBitmap(blob);
 const image=new Image(),objectURL=URL.createObjectURL(blob);
 try{image.src=objectURL;await image.decode();check(signal);return image;}finally{URL.revokeObjectURL(objectURL);}
}
async function prepare(source,tile,preview,signal,density){
 const b=tile.bounds,size=terrainSurfaceSize(source,tile,density),width=preview?b.w:size.width,height=preview?b.h:size.height;
 if(source.width>4096||source.height>4096||source.width*source.height>12_000_000)throw Error('terrain_tile_too_large');
 if(!preview&&(source.width<b.w*2||source.height<b.h*2))throw Error('terrain_tile_resolution_too_low');
 const surface=document.createElement('canvas');surface.width=width;surface.height=height;
 const ctx=surface.getContext('2d',{willReadFrequently:true});
 try{
  check(signal);
  ctx.imageSmoothingEnabled=tile.theme!=='pixel';ctx.imageSmoothingQuality='high';
  if(preview)ctx.drawImage(source,b.x,b.y,b.w,b.h,0,0,width,height);else ctx.drawImage(source,0,0,width,height);
  // A small strip per task preserves the same mask without blocking a whole map frame.
  for(let y=0;y<height;y+=32){
   check(signal);const count=Math.min(32,height-y),pixels=ctx.getImageData(0,y,width,count);
   maskTerrainRows(pixels.data,width,height,tile,y,count,!preview);ctx.putImageData(pixels,0,y);await yieldTask();
  }
  check(signal);
  if(typeof createImageBitmap!=='function')return surface;
  const bitmap=await createImageBitmap(surface);surface.width=1;surface.height=1;
  if(signal?.aborted){bitmap.close();check(signal);}return bitmap;
 }catch(error){surface.width=1;surface.height=1;throw error;}
}
export async function loadTerrainTile(tile,{signal,onPreview=()=>{},onMetadata=()=>{},density=Infinity}={}){
 let source;
 try{source=await decode(tile.url,signal);onMetadata({nativeDensity:Math.min(source.width/tile.bounds.w,source.height/tile.bounds.h)});return await prepare(source,tile,false,signal,density);}
 catch(error){
  check(signal);
  // A missing high-resolution asset keeps only its own overview crop as a fallback.
  if(!tile.patch){
   let overview;
   try{overview=await decode(terrainOverviewURL(tile.theme),signal);const preview=await prepare(overview,tile,true,signal);onPreview(preview);}
   catch(previewError){check(signal);}finally{overview?.close?.();}
  }
  throw error;
 }finally{source?.close?.();}
}
