import {HARBOR,pierWalkable,nearPolyline} from './world.js';

// Each ship transfer follows painted decking, never a shortcut through the sea.
export function harborSurfaceWalkable(x,y,ship=false){
 return pierWalkable(x,y)||ship&&nearPolyline(x,y,[HARBOR.boarding,HARBOR.ship,HARBOR.cabin],18);
}
export function arrivalRoute(){return [HARBOR.cabin,HARBOR.ship,...HARBOR.arrival].map(p=>({...p}))}
export function returnRoute(queue){
 const q=HARBOR.waiting[queue];
 return [...HARBOR.departure,{x:q.x,y:q.y+19},q].map(p=>({...p}));
}
export function boardingRoute(queue){
 const q=HARBOR.waiting[queue],last=HARBOR.waiting.at(-1);
 return [q,{x:q.x,y:q.y+19},{x:1565,y:last.y+19},HARBOR.boarding,HARBOR.ship,HARBOR.cabin].map(p=>({...p}));
}
export function queueFor(guests){
 const occupied=new Set(guests.filter(g=>g.stage!=='departed'&&Number.isInteger(g.harborQueue)).map(g=>g.harborQueue));
 return HARBOR.waiting.findIndex((_,i)=>!occupied.has(i));
}
export function shouldYield(g,guests){
 const node=g.path[0];if(!node||!g.harborLeg)return false;
 const dx=node.x-g.x,dy=node.y-g.y,d=Math.hypot(dx,dy);if(d<1)return false;
 // Give a passenger ahead 30 units of personal space in the same lane.
 return guests.some(other=>{
  if(other===g||!other.visible||other.inside!=null||other.harborLeg!==g.harborLeg)return false;
  const ox=other.x-g.x,oy=other.y-g.y,along=(ox*dx+oy*dy)/d,lateral=Math.abs(ox*dy-oy*dx)/d;
  return along>1&&along<30&&lateral<14;
 });
}
