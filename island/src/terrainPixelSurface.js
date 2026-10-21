import {terrainSurfaceSize} from './terrainResolution.js';
import {maskTerrainRows} from './mapTileLayout.js';
// Transfer terrain as bounded CPU pixels. The Window owns the final Canvas;
// no terrain ImageBitmap or graphics resource has to survive worker shutdown.
export const TERRAIN_PIXEL_LIMITS=Object.freeze({dimension:4096,pixels:12_000_000});
export function terrainPixelSurface(value,{canvas=()=>document.createElement('canvas'),Image=globalThis.ImageData}={}){
 const {width,height,pixels}=value||{},limit=TERRAIN_PIXEL_LIMITS;
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>limit.dimension||height>limit.dimension||width*height>limit.pixels||!(pixels instanceof Uint8ClampedArray)||pixels.byteLength!==width*height*4)throw Error('terrain_pixel_surface_invalid');
 if(typeof Image!=='function')throw Error('terrain_pixel_surface_unavailable');
 const surface=canvas();surface.width=width;surface.height=height;
 try{
  const ctx=surface.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('terrain_pixel_surface_unavailable');
  ctx.putImageData(new Image(pixels,width,height),0,0);return surface;
 }catch(error){surface.width=surface.height=1;throw error;}
}

// Native resizing and the unchanged masks run in the owning Window. The PNG
// decoder transfers CPU bytes and never creates a cross-thread canvas resource.
export async function prepareTerrainPixelSurface(value,tile,{preview=false,density=1,signal,canvas=()=>document.createElement('canvas'),Image=globalThis.ImageData,yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0))}={}){
 const check=()=>{if(signal?.aborted)throw signal.reason||Error('terrain_load_cancelled');};check();
 const b=tile?.bounds;if(!b||!['x','y','w','h'].every(k=>Number.isFinite(b[k]))||b.w<=0||b.h<=0)throw Error('terrain_pixel_surface_bounds');
 if(!preview&&(value?.width<b.w*2||value?.height<b.h*2))throw Error('terrain_tile_resolution_too_low');
 const source=terrainPixelSurface(value,{canvas,Image});let surface,complete=false;
 try{
  const size=terrainSurfaceSize(source,tile,density),width=preview?b.w:size.width,height=preview?b.h:size.height,limit=TERRAIN_PIXEL_LIMITS;
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>limit.dimension||height>limit.dimension||width*height>limit.pixels)throw Error('terrain_pixel_surface_invalid');
  surface=canvas();surface.width=width;surface.height=height;const ctx=surface.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('terrain_pixel_surface_unavailable');
  ctx.imageSmoothingEnabled=tile.theme!=='pixel';ctx.imageSmoothingQuality='high';
  if(preview)ctx.drawImage(source,b.x,b.y,b.w,b.h,0,0,width,height);else ctx.drawImage(source,0,0,width,height);
  for(let y=0;y<height;y+=32){check();const count=Math.min(32,height-y),image=ctx.getImageData(0,y,width,count);maskTerrainRows(image.data,width,height,tile,y,count,!preview);ctx.putImageData(image,0,y);if(y+count<height)await yieldTask();}
  check();complete=true;return surface;
 }finally{source.width=source.height=1;if(surface&&!complete)surface.width=surface.height=1;}
}
