export function followPath(a,dt,speed){
 a.walkMix=(a.walkMix||0)+((a.path.length?1:0)-(a.walkMix||0))*(1-Math.exp(-dt*10));
 if(!a.path.length){a.walking=false;return}
 const node=a.path[0],dx=node.x-a.x,dy=node.y-a.y,d=Math.hypot(dx,dy);
 // Set facing even on a short final step, before arrival callbacks take over.
 if(d>.001){a.direction=Math.atan2(dy,dx);a.face=dx<-.5?-1:dx>.5?1:a.face;a.phase=(a.phase||0)+Math.min(d,speed*dt)/9}
 // A close waypoint must still respect this frame's distance budget.
 if(d<=Math.max(0,speed*dt)){
  a.x=node.x;a.y=node.y;a.path.shift();a.walking=!!a.path.length;
  if(!a.path.length){const cb=a.after;a.after=null;if(cb)cb()}
  return;
 }
 a.x+=dx/d*speed*dt;a.y+=dy/d*speed*dt;a.walking=true;
}

// Continue an already approved route while a receipt is in flight. Arrival callbacks
// stay on the final waypoint until the normal simulation resumes.
export function followPendingPath(a,dt,speed){
 if(!a?.path?.length)return;
 const end=a.path.at(-1),after=a.after;a.after=null;
 try{followPath(a,dt,speed)}finally{a.after=after;}
 if(!a.path.length){a.path.push(end);a.walking=false;}
}
