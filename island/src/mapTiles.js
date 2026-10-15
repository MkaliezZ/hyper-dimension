import {terrainDensity} from './terrainResolution.js';
import {terrainViewport,tileIntersects} from './mapTileLayout.js';
import {loadTerrainTile,closeTerrainSurface} from './mapTileLoader.js';
import {seasonalTerrain} from './seasonTerrain.js';
import {OVERVIEW_BUDGET,retainSeasonOverviews,drawSeasonOverview,seasonOverviewStatus} from './seasonOverview.js';
const LIMIT=128*1024*1024,MAX_JOBS=2,MAX_ATTEMPTS=3,entries=new Map(),jobs=new Map();
const TILE_LIMIT=LIMIT-OVERVIEW_BUDGET;
let activeTheme='',generation=0,serial=0,revision=0,worker=null,workerUnavailable=false,wanted=[];
let activeSeason=null,targetSeason='summer',fromSeason=null,fadeAt=-Infinity;
const seasonLayers=new Map();
const stats={loads:0,failures:0,evictions:0,redraws:0,bytes:0,retries:0};
function dispose(entry){for(const key of ['bitmap','preview'])if(entry[key]){stats.bytes-=entry[key].width*entry[key].height*4;closeTerrainSurface(entry[key]);entry[key]=null;}}
function workerFailure(){
 workerUnavailable=true;worker?.terminate();worker=null;
 for(const [id,job]of jobs)if(job.backend==='worker'){clearTimeout(job.timer);job.entry.pending=false;jobs.delete(id);}
 revision++;pump();
}
function select(theme){
 if(activeTheme===theme)return;
 generation++;activeTheme=theme;activeSeason=null;fromSeason=null;fadeAt=-Infinity;worker?.terminate();worker=null;
 for(const job of jobs.values()){clearTimeout(job.timer);job.controller?.abort();}jobs.clear();
 for(const entry of entries.values())dispose(entry);entries.clear();wanted=[];revision++;
 for(const l of seasonLayers.values())closeTerrainSurface(l.canvas);seasonLayers.clear();
}
function evict(){
 const visible=new Set(wanted.map(t=>t.id));
 for(const entry of [...entries.values()].sort((a,b)=>a.used-b.used)){
  if(stats.bytes<=TILE_LIMIT)break;if(visible.has(entry.tile.id)||entry.pending)continue;
  dispose(entry);entries.delete(entry.tile.id);stats.evictions++;revision++;
 }
}
function receive(data){
 const job=jobs.get(data.requestId);
 if(!job||job.generation!==generation){closeTerrainSurface(data.bitmap);return;}
 const entry=job.entry;
 if(data.bitmap){
  const key=data.phase==='ready'?'bitmap':'preview';
  if(entry[key]){stats.bytes-=entry[key].width*entry[key].height*4;closeTerrainSurface(entry[key]);}
  entry[key]=data.bitmap;stats.bytes+=data.bitmap.width*data.bitmap.height*4;
  if(key==='bitmap'&&entry.preview){stats.bytes-=entry.preview.width*entry.preview.height*4;closeTerrainSurface(entry.preview);entry.preview=null;}
  if(key==='bitmap'){entry.nativeDensity=data.nativeDensity||entry.nativeDensity;entry.density=Math.min(entry.bitmap.width/entry.tile.bounds.w,entry.bitmap.height/entry.tile.bounds.h);}
  revision++;
 }
 if(data.phase!=='preview'){
  clearTimeout(job.timer);jobs.delete(data.requestId);entry.pending=false;
  if(data.phase==='error'){entry.failed=true;entry.retryAt=performance.now()+(entry.attempts===1?1000:4000);stats.failures++;}
  else{entry.failed=false;stats.loads++;}
  evict();pump();
 }
}
function pump(){
 if(!workerUnavailable&&(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'))workerUnavailable=true;
 if(!workerUnavailable&&!worker){
  try{worker=new Worker(new URL('./mapTileWorker.js',import.meta.url),{type:'module'});worker.onerror=event=>{event.preventDefault();workerFailure();};worker.onmessage=({data})=>receive(data);}
  catch{workerUnavailable=true;worker=null;}
 }
 for(const tile of wanted){
  if(jobs.size>=MAX_JOBS)break;
  let entry=entries.get(tile.id);
  if(entry)entry.tile=tile;
  const downsize=entry?.bitmap&&tile.shrink&&entry.density>tile.density+.01;
  if(entry?.bitmap&&!downsize&&entry.density+.01>=Math.min(tile.density,entry.nativeDensity||Infinity)){entry.failed=false;continue;}
  if(entry&&(entry.pending||(entry.failed&&(entry.attempts>=MAX_ATTEMPTS||performance.now()<entry.retryAt))))continue;
  if(!entry){entry={tile,used:performance.now(),attempts:0};entries.set(tile.id,entry);}
  else if(entry.failed)stats.retries++;
  if(entry.bitmap&&!entry.failed)entry.attempts=0;
  entry.pending=true;entry.attempts++;const requestId=++serial;
  if(workerUnavailable){
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Error('terrain_load_timeout')),45_000);
   jobs.set(requestId,{entry,generation,timer,controller,backend:'main'});
   loadTerrainTile(tile,{signal:controller.signal,density:tile.density,onMetadata:m=>entry.nativeDensity=m.nativeDensity,onPreview:bitmap=>receive({requestId,phase:'preview',bitmap})})
    .then(bitmap=>receive({requestId,phase:'ready',bitmap}),error=>receive({requestId,phase:'error',error:error.message}));
  }else{
   const timer=setTimeout(workerFailure,45_000);jobs.set(requestId,{entry,generation,timer,backend:'worker'});
   try{worker.postMessage({requestId,id:tile.id,theme:tile.theme,season:tile.season,density:tile.density});}catch{workerFailure();break;}
  }
 }
}
function viewportReady(tiles){
 return tiles.length>0&&tiles.every(t=>{const e=entries.get(t.id);return e?.bitmap||(t.season==='summer'&&e?.failed&&(t.patch||e.preview));});
}
function paintSeason(ctx,theme,season,tiles,matrix){
 let l=seasonLayers.get(season);
 if(!l){l={canvas:document.createElement('canvas'),key:''};seasonLayers.set(season,l);}
 const width=ctx.canvas.width,height=ctx.canvas.height;
 if(l.canvas.width!==width||l.canvas.height!==height){l.canvas.width=width;l.canvas.height=height;l.key='';}
 const viewKey=[width,height,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].join('|');
 // Preserve the displayed sharp old frame while its decoded tiles shrink to share the budget.
 if(season!==targetSeason&&l.key&&l.viewKey===viewKey)return l.canvas;
 const key=[theme,season,revision,width,height,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].join('|');
 if(key!==l.key){
  const paint=l.canvas.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,width,height);paint.setTransform(matrix);
  paint.imageSmoothingEnabled=theme!=='pixel';paint.imageSmoothingQuality='high';paint.globalCompositeOperation='lighter';
  for(const tile of tiles.filter(t=>!t.patch)){const e=entries.get(tile.id),b=tile.bounds;if(e?.bitmap||e?.preview)paint.drawImage(e.bitmap||e.preview,b.x,b.y,b.w,b.h);}
  paint.globalCompositeOperation='source-over';
  for(const tile of tiles.filter(t=>t.patch).sort((a,b)=>a.patchOrder-b.patchOrder)){const e=entries.get(tile.id),b=tile.bounds;if(e?.bitmap)paint.drawImage(e.bitmap,b.x,b.y,b.w,b.h);}
  l.key=key;l.viewKey=viewKey;stats.redraws++;
 }return l.canvas;
}
export function drawTerrainTiles(ctx,theme,{nativeResolution=false,season='summer',now=performance.now()}={}){
 select(theme);targetSeason=season;
 retainSeasonOverviews(theme,[activeSeason||season,season]);
 const matrix=ctx.getTransform(),view=terrainViewport(matrix,ctx.canvas.width,ctx.canvas.height);if(!view)return false;
 const cx=view.x+view.w/2,cy=view.y+view.h/2;
 const visible=s=>seasonalTerrain(theme,s).filter(t=>tileIntersects(t,view)).sort((a,b)=>Math.hypot(a.core.x+a.core.w/2-cx,a.core.y+a.core.h/2-cy)-Math.hypot(b.core.x+b.core.w/2-cx,b.core.y+b.core.h/2-cy));
 let target=visible(season),current=activeSeason?visible(activeSeason):[],previous=fromSeason?visible(fromSeason):[];
 if(!target.length)return false;
 const combined=[...new Map([...target,...current,...previous].map(t=>[t.id,t])).values()];
 const density=nativeResolution?Infinity:terrainDensity(matrix,combined,TILE_LIMIT);
 wanted=combined.map(t=>({...t,density,shrink:t.season!==season&&Number.isFinite(density)}));
 // Fit the retained old view before admitting another decoded season into the cache.
 wanted.sort((a,b)=>Number(!!entries.get(b.id)?.bitmap&&b.shrink&&entries.get(b.id).density>b.density+.01)-Number(!!entries.get(a.id)?.bitmap&&a.shrink&&entries.get(a.id).density>a.density+.01));
 for(const tile of wanted){const e=entries.get(tile.id);if(e)e.used=performance.now();}pump();evict();
 // An incomplete seasonal viewport never replaces the previous complete season.
 if(viewportReady(target)&&activeSeason!==season){fromSeason=activeSeason;activeSeason=season;fadeAt=now;current=target;previous=fromSeason?visible(fromSeason):[];}
 if(!activeSeason||!viewportReady(current))return drawSeasonOverview(ctx,activeSeason||season);
 const blend=fromSeason?Math.max(0,Math.min(1,(now-fadeAt)/4000)):1;
 ctx.save();ctx.setTransform(1,0,0,1,0,0);
 if(fromSeason&&blend<1&&viewportReady(previous)){ctx.drawImage(paintSeason(ctx,theme,fromSeason,previous,matrix),0,0);ctx.globalAlpha*=blend;}
 ctx.drawImage(paintSeason(ctx,theme,activeSeason,current,matrix),0,0);ctx.restore();
 if(fromSeason&&blend>=1){const l=seasonLayers.get(fromSeason);if(l){closeTerrainSurface(l.canvas);seasonLayers.delete(fromSeason);}fromSeason=null;}
 return true;
}
export function terrainTileStatus(){const overview=seasonOverviewStatus();return {...stats,bytes:stats.bytes+overview.bytes,tileBytes:stats.bytes,overview,theme:activeTheme,season:activeSeason,targetSeason,fromSeason,requestedDensity:wanted[0]?.density||null,backend:workerUnavailable?'compatible tiles':'worker tiles',limitBytes:LIMIT,tileLimitBytes:TILE_LIMIT,pending:jobs.size,resident:entries.size,visible:wanted.map(t=>t.id),ready:[...entries.values()].filter(e=>e.bitmap).map(e=>e.tile.id),preview:[...entries.values()].filter(e=>e.preview&&!e.bitmap).map(e=>e.tile.id),densities:[...entries.values()].filter(e=>e.bitmap).map(e=>({id:e.tile.id,decoded:e.density,native:e.nativeDensity})),failed:[...entries.values()].filter(e=>e.failed).map(e=>e.tile.id)};}
