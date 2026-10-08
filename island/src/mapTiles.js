import {terrainTiles,terrainLandmarks,terrainViewport,tileIntersects} from './mapTileLayout.js';
const LIMIT=128*1024*1024,MAX_JOBS=2,entries=new Map(),jobs=new Map();
let activeTheme='',generation=0,serial=0,revision=0,worker=null,unsupported=false,layer=null,layerKey='',wanted=[];
const stats={loads:0,failures:0,evictions:0,redraws:0,bytes:0};
function dispose(entry){for(const key of ['bitmap','preview'])if(entry[key]){stats.bytes-=entry[key].width*entry[key].height*4;entry[key].close();entry[key]=null;}}
function workerFailure(){unsupported=true;worker?.terminate();worker=null;for(const job of jobs.values())clearTimeout(job.timer);jobs.clear();revision++;}
function select(theme){
 if(activeTheme===theme)return;
 generation++;activeTheme=theme;worker?.terminate();worker=null;for(const job of jobs.values())clearTimeout(job.timer);jobs.clear();
 for(const entry of entries.values())dispose(entry);entries.clear();wanted=[];layerKey='';revision++;
}
function evict(){
 const visible=new Set(wanted.map(t=>t.id));
 for(const entry of [...entries.values()].sort((a,b)=>a.used-b.used)){
  if(stats.bytes<=LIMIT)break;if(visible.has(entry.tile.id)||entry.pending)continue;
  dispose(entry);entries.delete(entry.tile.id);stats.evictions++;revision++;
 }
}
function pump(){
 if(unsupported||typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'){unsupported=true;return;}
 if(!worker){
  worker=new Worker(new URL('./mapTileWorker.js',import.meta.url),{type:'module'});worker.onerror=workerFailure;
  worker.onmessage=({data})=>{
   const job=jobs.get(data.requestId);if(!job||job.generation!==generation){data.bitmap?.close();return;}
   const entry=job.entry;
   if(data.bitmap){const key=data.phase==='ready'?'bitmap':'preview';entry[key]?.close();entry[key]=data.bitmap;stats.bytes+=data.bitmap.width*data.bitmap.height*4;revision++;}
   if(data.phase!=='preview'){
    clearTimeout(job.timer);jobs.delete(data.requestId);entry.pending=false;
    if(data.phase==='error'){entry.failed=true;stats.failures++;}else stats.loads++;
    evict();pump();
   }
  };
 }
 for(const tile of wanted){
  if(jobs.size>=MAX_JOBS)break;
  let entry=entries.get(tile.id);if(entry&&(entry.bitmap||entry.pending||entry.failed))continue;
  if(!entry){entry={tile,used:performance.now()};entries.set(tile.id,entry);}
  entry.pending=true;const requestId=++serial,timer=setTimeout(workerFailure,45_000);jobs.set(requestId,{entry,generation,timer});worker.postMessage({requestId,id:tile.id,theme:tile.theme});
 }
}
export function drawTerrainTiles(ctx,theme){
 select(theme);if(unsupported)return false;
 const matrix=ctx.getTransform(),view=terrainViewport(matrix,ctx.canvas.width,ctx.canvas.height);if(!view)return false;
 // Below native map resolution the overview is cheaper and already sufficiently detailed.
 const magnification=Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d));
 if(magnification<1.12){wanted=[];return false;}
 const cx=view.x+view.w/2,cy=view.y+view.h/2;
 wanted=[...terrainTiles(theme),...terrainLandmarks(theme)].filter(t=>tileIntersects(t,view)).sort((a,b)=>Math.hypot(a.core.x+192-cx,a.core.y+192-cy)-Math.hypot(b.core.x+192-cx,b.core.y+192-cy));
 if(!wanted.length)return false;
 for(const tile of wanted){const e=entries.get(tile.id);if(e)e.used=performance.now();}
 pump();evict();
 // Keep the complete overview until each visible support has at least its masked preview.
 if(wanted.some(t=>{const e=entries.get(t.id);return !t.patch&&!e?.bitmap&&!e?.preview;}))return false;
 if(!layer)layer=document.createElement('canvas');
 const width=ctx.canvas.width,height=ctx.canvas.height;
 if(layer.width!==width||layer.height!==height){layer.width=width;layer.height=height;layerKey='';}
 const key=[theme,revision,width,height,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].join('|');
 if(key!==layerKey){
  const paint=layer.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,width,height);paint.setTransform(matrix);
  paint.imageSmoothingEnabled=theme!=='pixel';paint.imageSmoothingQuality='high';
  // Complementary premultiplied weights sum to one, including four-tile corners.
  // Add inside a transparent layer, never directly onto the island/sea.
  paint.globalCompositeOperation='lighter';
  for(const tile of wanted.filter(t=>!t.patch)){const e=entries.get(tile.id),b=tile.bounds;paint.drawImage(e.bitmap||e.preview,b.x,b.y,b.w,b.h);}
  paint.globalCompositeOperation='source-over';
  for(const tile of wanted.filter(t=>t.patch)){const e=entries.get(tile.id),b=tile.bounds;if(e?.bitmap)paint.drawImage(e.bitmap,b.x,b.y,b.w,b.h);}
  layerKey=key;stats.redraws++;
 }
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(layer,0,0);ctx.restore();return true;
}
export function terrainTileStatus(){return {...stats,theme:activeTheme,backend:unsupported?'overview fallback':'worker tiles',limitBytes:LIMIT,pending:jobs.size,resident:entries.size,visible:wanted.map(t=>t.id),ready:[...entries.values()].filter(e=>e.bitmap).map(e=>e.tile.id),preview:[...entries.values()].filter(e=>e.preview&&!e.bitmap).map(e=>e.tile.id),failed:[...entries.values()].filter(e=>e.failed).map(e=>e.tile.id)};}
