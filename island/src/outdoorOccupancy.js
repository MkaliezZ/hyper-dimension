import {nearestWalkable,worldWalkable} from './world.js';
// Keep both approaching and stationary residents in the occupancy model.
// Returning null lets the resident wait; a full area must not force an overlap.
export function outdoorSpot(base,owner,npcs,{radius=4,separation=35}={}){
 const occupied=npcs.filter(n=>n.npcId!==owner&&n.visible!==false&&n.inside==null).flatMap(n=>{
  const points=[];if(n.target)points.push(n.target);
  if(!n.path?.length||!n.target)points.push(n);
  return points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
 });
 const seen=new Set();
 for(let ring=0;ring<=radius;ring++){
  const offsets=[];
  for(let dy=-ring;dy<=ring;dy++)for(let dx=-ring;dx<=ring;dx++)if(Math.max(Math.abs(dx),Math.abs(dy))===ring)offsets.push({dx,dy});
  offsets.sort((a,b)=>a.dx*a.dx+a.dy*a.dy-b.dx*b.dx-b.dy*b.dy||a.dy-b.dy||a.dx-b.dx);
  for(const {dx,dy}of offsets){
   const p=nearestWalkable(base.x+dx*48,base.y+dy*48),key=p.x+':'+p.y;
   if(seen.has(key))continue;seen.add(key);
   if(worldWalkable(p.x,p.y)&&occupied.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=separation))return p;
  }
 }
 return null;
}
