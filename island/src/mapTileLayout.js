import {TERRAIN_SEAMS} from './terrainSeams.js';
import {TERRAIN_JOIN_REPAIRS} from './terrainJoinRepairs.js';
// Production and resident IDs stay stable while the calibrated landscape expands.
export const TILE_MAP = Object.freeze({width:2304,height:1792,cell:384,overlap:32,columns:6,rows:5,version:169});
export function terrainOverviewURL(theme){
 if(!['pixel','origami'].includes(theme))throw Error('invalid_terrain_theme');
 return `/assets/map-tiles-v169/${theme}-overview.png`;
}
export function terrainTiles(theme){
 if(!['pixel','origami'].includes(theme))throw Error('invalid_terrain_theme');
 return Array.from({length:30},(_,i)=>{
  const col=i%6,row=Math.floor(i/6),x=col*384,y=row*384,w=Math.min(384,2304-x),h=Math.min(384,1792-y);
  const left=Math.max(0,x-32),top=Math.max(0,y-32),right=Math.min(2304,x+w+32),bottom=Math.min(1792,y+h+32);
  return {id:`${theme}-${col}-${row}`,theme,col,row,core:{x,y,w,h},bounds:{x:left,y:top,w:right-left,h:bottom-top},url:`/assets/map-tiles-v169/${theme}-${col}-${row}.png`};
 });
}
const PATCHES=[{"name":"plaza","bounds":{"x":855,"y":515,"w":448,"h":448},"core":{"x":879,"y":539,"w":400,"h":400}},{"name":"home-6","bounds":{"x":861,"y":1046,"w":196,"h":176},"core":{"x":883,"y":1068,"w":152,"h":132}},{"name":"home-8","bounds":{"x":1632,"y":905,"w":196,"h":176},"core":{"x":1654,"y":927,"w":152,"h":132}},{"name":"home-11","bounds":{"x":1660,"y":349,"w":196,"h":176},"core":{"x":1682,"y":371,"w":152,"h":132}},{"name":"home-12","bounds":{"x":1060,"y":829,"w":196,"h":176},"core":{"x":1082,"y":851,"w":152,"h":132}},{"name":"home-13","bounds":{"x":576,"y":951,"w":196,"h":176},"core":{"x":598,"y":973,"w":152,"h":132}},{"name":"home-14","bounds":{"x":1547,"y":414,"w":196,"h":176},"core":{"x":1569,"y":436,"w":152,"h":132}}];
export function terrainLandmarks(theme){if(!['pixel','origami'].includes(theme))throw Error('invalid_terrain_theme');return [...PATCHES.map(p=>({id:theme+'-'+p.name,theme,patch:true,bounds:p.bounds,core:p.core,url:'/assets/map-tiles-v169/'+theme+'-'+p.name+'.png'})),...TERRAIN_JOIN_REPAIRS.map(p=>({id:theme+'-'+p.name,theme,patch:true,bounds:p.bounds,core:p.core,url:'/assets/map-joins-v180/'+theme+'-'+p.name+'.png'}))].map((p,patchOrder)=>({...p,patchOrder}));}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function edge(theme,axis,index,position,fallback){const a=TERRAIN_SEAMS[theme]?.[axis]?.[index];if(!a)return fallback;const i=Math.max(0,Math.min(a.length-1,Math.floor(position))),next=Math.min(a.length-1,i+1);return a[i]+(a[next]-a[i])*Math.max(0,Math.min(1,position-i));}
export function tileWeight(tile,x,y){
 const c=tile.core,o=TERRAIN_SEAMS[tile.theme]?.transition||1;
 if(tile.patch){const b=tile.bounds;return smooth(Math.min(x-b.x,b.x+b.w-x)/16)*smooth(Math.min(y-b.y,b.y+b.h-y)/16);}
 const left=edge(tile.theme,'vertical',tile.col-1,y,c.x),right=edge(tile.theme,'vertical',tile.col,y,c.x+c.w),top=edge(tile.theme,'horizontal',tile.row-1,x,c.y),bottom=edge(tile.theme,'horizontal',tile.row,x,c.y+c.h);
 return (tile.col>0?smooth((x-left+o)/(2*o)):1)*(tile.col<TILE_MAP.columns-1?1-smooth((x-right+o)/(2*o)):1)*(tile.row>0?smooth((y-top+o)/(2*o)):1)*(tile.row<TILE_MAP.rows-1?1-smooth((y-bottom+o)/(2*o)):1);
}
export function tileIntersects(tile,view,margin=0){const b=tile.bounds;return b.x<view.x+view.w+margin&&b.x+b.w>view.x-margin&&b.y<view.y+view.h+margin&&b.y+b.h>view.y-margin;}
export function terrainViewport(matrix,width,height){
 const {a,b,c,d,e,f}=matrix,det=a*d-b*c;if(!Number.isFinite(det)||Math.abs(det)<1e-10)return null;
 const points=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>({x:(d*(x-e)-c*(y-f))/det,y:(a*(y-f)-b*(x-e))/det}));
 const x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
 return {x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y};
}
// Apply feather weights once in the worker; never read terrain pixels in the game loop.
export function maskTerrainRows(data,width,height,tile,firstRow=0,rowCount=height,fadeCoast=true){
 const b=tile.bounds;
 for(let py=firstRow;py<Math.min(height,firstRow+rowCount);py++)for(let px=0;px<width;px++){
  const x=b.x+(px+.5)*b.w/width,y=b.y+(py+.5)*b.h/height,i=((py-firstRow)*width+px)*4;
  let alpha=tileWeight(tile,x,y),distance=Math.min(TILE_MAP.width-x,TILE_MAP.height-y);
  const r=data[i],g=data[i+1],blue=data[i+2];
  if(fadeCoast&&distance<128&&g>r*1.45&&blue>r*1.65&&blue>g*.87)alpha*=smooth(distance/128);
  data[i+3]=Math.round(data[i+3]*alpha);
 }
}

export function maskTerrain(data,width,height,tile,fadeCoast=true){maskTerrainRows(data,width,height,tile,0,height,fadeCoast);}
