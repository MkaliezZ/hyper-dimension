import {decodeTerrainPNG,readTerrainPNG} from './terrainPngPixels.js';
import {serveGpuWorkerEndpoint} from './gpuWorkerEndpoint.js';
import {terrainOverviewURL} from './mapTileLayout.js';
import {seasonalTerrain} from './seasonTerrain.js';
let baseTheme='',basePromise=null;
async function decode(url){const response=await fetch(url);if(!response.ok)throw Error(`terrain_http_${response.status}`);return decodeTerrainPNG(await readTerrainPNG(response));}
function baseFor(theme){if(baseTheme!==theme){baseTheme=theme;basePromise=decode(terrainOverviewURL(theme));}return basePromise;}
const receive=async({data})=>{
 const {requestId,theme,id,season='summer'}=data,tile=seasonalTerrain(theme,season).find(t=>t.id===id);if(!tile)return;
 try{
  const source=await decode(tile.url);
  if(source.width<tile.bounds.w*2||source.height<tile.bounds.h*2)throw Error('terrain_tile_resolution_too_low');
  const nativeDensity=Math.min(source.width/tile.bounds.w,source.height/tile.bounds.h);
  self.postMessage({requestId,phase:'source',width:source.width,height:source.height,pixels:source.data,nativeDensity,decodeBackend:'cpu-png'},[source.data.buffer]);
 }catch(error){
  if(error.code==='terrain_png_unsupported'){self.postMessage({requestId,phase:'compatible',error:error.code});return;}
  // The owner creates the original preview and then retires this failed job.
  // Keep its two phases ordered even though owner-side preparation yields.
  if(!tile.patch&&tile.season==='summer')try{
   const source=await baseFor(theme),pixels=new Uint8ClampedArray(source.data);
   self.postMessage({requestId,phase:'source',preview:true,width:source.width,height:source.height,pixels,error:error.message,decodeBackend:'cpu-png'},[pixels.buffer]);return;
  }catch{}
  self.postMessage({requestId,phase:'error',error:error.message});
 }
};
// This worker owns bounded PNG bytes only. All drawing resources belong to
// the document that displays them, so worker shutdown has no canvas to retire.
serveGpuWorkerEndpoint(receive);
