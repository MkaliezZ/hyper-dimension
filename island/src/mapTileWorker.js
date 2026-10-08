import {terrainTiles,terrainLandmarks,maskTerrain,terrainOverviewURL} from './mapTileLayout.js';
let baseTheme='',basePromise=null;
async function decode(url){const response=await fetch(url);if(!response.ok)throw Error(`terrain_http_${response.status}`);return createImageBitmap(await response.blob());}
function baseFor(theme){
 if(baseTheme!==theme){basePromise?.then(b=>b.close()).catch(()=>{});baseTheme=theme;basePromise=decode(terrainOverviewURL(theme));}
 return basePromise;
}
function prepare(source,tile,preview){
 const b=tile.bounds,width=preview?b.w:source.width,height=preview?b.h:source.height;
 if(width>4096||height>4096||width*height>12_000_000)throw Error('terrain_tile_too_large');
 const surface=new OffscreenCanvas(width,height),ctx=surface.getContext('2d',{willReadFrequently:true});
 if(preview)ctx.drawImage(source,b.x,b.y,b.w,b.h,0,0,width,height);else ctx.drawImage(source,0,0);
 const image=ctx.getImageData(0,0,width,height);maskTerrain(image.data,width,height,tile,!preview);ctx.putImageData(image,0,0);
 return surface.transferToImageBitmap();
}
self.onmessage=async({data})=>{
 const {requestId,theme,id}=data,tile=[...terrainTiles(theme),...terrainLandmarks(theme)].find(t=>t.id===id);if(!tile)return;
 let source;
 try{
  source=await decode(tile.url);
  if(source.width<tile.bounds.w*2||source.height<tile.bounds.h*2)throw Error('terrain_tile_resolution_too_low');
  const bitmap=prepare(source,tile,false);self.postMessage({requestId,phase:'ready',bitmap},[bitmap]);
 }catch(e){
  // A preview failure must never prevent a high-resolution tile from loading.
  if(!tile.patch){try{const preview=prepare(await baseFor(theme),tile,true);self.postMessage({requestId,phase:'preview',bitmap:preview},[preview]);}catch{}}
  self.postMessage({requestId,phase:'error',error:e.message});
 }finally{source?.close();}
};
