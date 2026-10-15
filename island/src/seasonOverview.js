import {TILE_MAP} from './mapTileLayout.js';
import {closeTerrainSurface} from './mapTileLoader.js';

// Two whole-season previews cover the active view and a pending transition.
// Their decoded memory is reserved separately from the regional tile budget.
export const OVERVIEW_BUDGET=TILE_MAP.width*TILE_MAP.height*4*2;
const entries=new Map();
let activeTheme='',generation=0;
export function seasonOverviewURL(theme,season){
 return `/assets/season-terrain-v187/${theme}/${season}/overview.png`;
}
function dispose(entry){entry.controller?.abort();closeTerrainSurface(entry.image);}
export function retainSeasonOverviews(theme,seasons){
 if(theme!==activeTheme){generation++;for(const e of entries.values())dispose(e);entries.clear();activeTheme=theme;}
 const keep=new Set(seasons.filter(Boolean).slice(0,2));
 for(const [season,e] of entries)if(!keep.has(season)){dispose(e);entries.delete(season);}
 for(const season of keep){
  const old=entries.get(season);
  if(old&&(old.image||old.pending||old.attempts>=3||performance.now()<old.retryAt))continue;
  const entry={attempts:(old?.attempts||0)+1,pending:true,controller:new AbortController(),image:null};
  entries.set(season,entry);const token=generation;
  const timer=setTimeout(()=>entry.controller.abort(),15000);
  entry.promise=(async()=>{
   let image;
   try{
    const response=await fetch(seasonOverviewURL(theme,season),{signal:entry.controller.signal});
    if(!response.ok)throw Error('season_overview_http_'+response.status);
    const blob=await response.blob();entry.controller.signal.throwIfAborted();
    if(typeof createImageBitmap==='function')image=await createImageBitmap(blob);
    else{const url=URL.createObjectURL(blob);try{image=new Image();image.src=url;await image.decode();}finally{URL.revokeObjectURL(url);}}
    if(image.width!==TILE_MAP.width||image.height!==TILE_MAP.height)throw Error('season_overview_dimensions');
    if(token!==generation||entries.get(season)!==entry||entry.controller.signal.aborted){closeTerrainSurface(image);return;}
    entry.image=image;entry.failed=false;
   }catch(error){closeTerrainSurface(image);entry.failed=true;entry.retryAt=performance.now()+4000;}
   finally{clearTimeout(timer);entry.pending=false;}
  })();
 }
}
export function drawSeasonOverview(ctx,season){
 const image=entries.get(season)?.image;if(!image)return false;
 ctx.save();ctx.imageSmoothingEnabled=activeTheme!=='pixel';ctx.imageSmoothingQuality='high';
 ctx.drawImage(image,0,0,TILE_MAP.width,TILE_MAP.height);ctx.restore();return true;
}
export async function preloadSeasonOverview(theme,season){
 retainSeasonOverviews(theme,[season]);
 const entry=entries.get(season);await entry?.promise;return !!entry?.image;
}
export function seasonOverviewStatus(){return {bytes:[...entries.values()].reduce((n,e)=>n+(e.image?e.image.width*e.image.height*4:0),0),ready:[...entries].filter(([,e])=>e.image).map(([s])=>s),pending:[...entries].filter(([,e])=>e.pending).map(([s])=>s),failed:[...entries].filter(([,e])=>e.failed).map(([s])=>s)};}
