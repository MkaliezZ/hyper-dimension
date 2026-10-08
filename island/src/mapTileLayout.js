// World coordinates never change when terrain artwork is replaced.
export const TILE_MAP = Object.freeze({width:1856,height:1024,cell:384,overlap:32,columns:5,rows:3,version:134});
export function terrainOverviewURL(theme){
 if(!['pixel','origami'].includes(theme))throw Error('invalid_terrain_theme');
 return `/assets/map-tiles-v134/${theme}-overview.png`;
}
export function terrainTiles(theme){
 if(!['pixel','origami'].includes(theme))throw Error('invalid_terrain_theme');
 return Array.from({length:15},(_,i)=>{
  const col=i%5,row=Math.floor(i/5),x=col*384,y=row*384,w=Math.min(384,1856-x),h=Math.min(384,1024-y);
  const left=Math.max(0,x-32),top=Math.max(0,y-32),right=Math.min(1856,x+w+32),bottom=Math.min(1024,y+h+32);
  return {id:`${theme}-${col}-${row}`,theme,col,row,core:{x,y,w,h},bounds:{x:left,y:top,w:right-left,h:bottom-top},url:`/assets/map-tiles-v134/${theme}-${col}-${row}.png`};
 });
}
export function terrainLandmarks(theme){return [{id:`${theme}-plaza`,theme,patch:true,bounds:{x:576,y:288,w:432,h:336},core:{x:600,y:312,w:384,h:288},url:`/assets/map-tiles-v119/${theme}-plaza.png`}];}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function tileWeight(tile,x,y){
 const c=tile.core,o=12;
 if(tile.patch){const b=tile.bounds;return smooth(Math.min(x-b.x,b.x+b.w-x)/24)*smooth(Math.min(y-b.y,b.y+b.h-y)/24);}
 return (c.x>0?smooth((x-c.x+o)/(2*o)):1)*(c.x+c.w<TILE_MAP.width?1-smooth((x-c.x-c.w+o)/(2*o)):1)*
  (c.y>0?smooth((y-c.y+o)/(2*o)):1)*(c.y+c.h<TILE_MAP.height?1-smooth((y-c.y-c.h+o)/(2*o)):1);
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
