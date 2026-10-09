// Presentation follows server intent. Correction vectors must never rotate a
// character, and a queued route does not mean a blocked character is walking.
export function sampleLanMotion(a,p,dt,at,passable){
 if(a.snapshotAt!==p.updatedAt){a.snapshotAt=p.updatedAt;a.snapshotReceived=at;}
 const moving=!!p.online&&p.walking===true;
 let target={x:p.x,y:p.y},travel=moving?Math.min(.55,Math.max(0,(at-(a.snapshotReceived??at))/1000))*(p.speed||80):0;
 for(const next of p.route||[]){if(travel<=0)break;const dx=next.x-target.x,dy=next.y-target.y,len=Math.hypot(dx,dy);if(!len)continue;const step=Math.min(travel,len),dest={x:target.x+dx/len*step,y:target.y+dy/len*step};if(!passable(target,dest))break;target=dest;travel-=step;}
 const d=Math.hypot(target.x-a.x,target.y-a.y),t=1-Math.exp(-Math.min(.05,Math.max(0,dt))*12);
 if(d>80||!passable(a,target)){a.x=p.x;a.y=p.y;}else{a.x+=(target.x-a.x)*t;a.y+=(target.y-a.y)*t;}
 if(Number.isFinite(p.direction))a.direction=p.direction;
 a.walking=moving;a.walkMix=(a.walkMix||0)+((moving?1:0)-(a.walkMix||0))*Math.min(1,dt*12);a.phase=(a.phase||0)+dt*12;
 return a;
}
