import {findPath,worldWalkableForTheme} from './world.js';
import {placementObstacles} from './placements.js';
export function createFestivalLayout(s,theme,staffCount=3){
 if(!['pixel','origami'].includes(theme)||![3,4].includes(staffCount))return null;
 const obstacles=placementObstacles(s,theme),walk=(x,y)=>worldWalkableForTheme(theme,x,y,obstacles),source={x:786,y:458};
 const targets=[{x:714,y:432},{x:786,y:396},{x:858,y:432},...(staffCount===4?[{x:918,y:450}]:[]),{x:696,y:522},{x:750,y:522},{x:804,y:540},{x:894,y:558},{x:786,y:594}],chosen=[];
 const legal=p=>[[-12,-12],[12,-12],[-12,12],[12,12],[0,0]].every(([x,y])=>walk(p.x+x,p.y+y));
 const pool=[];for(let y=378;y<=612;y+=18)for(let x=648;x<=936;x+=18){const p={x,y};if(legal(p))pool.push(p);}
 for(const target of targets){
  let found=null;
  for(const p of [...pool].sort((a,b)=>Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y))){
   if(chosen.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<44))continue;
   const path=findPath(source,p,walk),end=path.at(-1)||source;
   if(Math.hypot(end.x-p.x,end.y-p.y)>18)continue;
   if(!Array.from({length:9},(_,i)=>walk(end.x+(p.x-end.x)*i/8,end.y+(p.y-end.y)*i/8)).every(Boolean))continue;
   found=p;break;
  }
  if(!found)return null;chosen.push({...found});
 }
 return{version:1,theme,staff:chosen.slice(0,staffCount),buyers:chosen.slice(staffCount,staffCount+4),player:chosen.at(-1)};
}
export function validFestivalLayout(l,count=3){
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=630&&p.x<=960&&p.y>=360&&p.y<=630;
 if(!l||l.version!==1||!['pixel','origami'].includes(l.theme)||!Array.isArray(l.staff)||l.staff.length!==count||!Array.isArray(l.buyers)||l.buyers.length!==4||![...l.staff,...l.buyers,l.player].every(point))return false;
 const all=[...l.staff,...l.buyers,l.player];return all.every((p,i)=>all.slice(i+1).every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=44));
}
