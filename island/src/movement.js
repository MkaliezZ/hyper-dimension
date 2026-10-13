export function followPath(a,dt,speed){
 const seconds=Number.isFinite(dt)?Math.max(0,dt):0;let budget=Number.isFinite(speed)?Math.max(0,speed*seconds):0;
 a.walkMix=(a.walkMix||0)+((a.path.length?1:0)-(a.walkMix||0))*(1-Math.exp(-seconds*10));
 if(!a.path.length){a.walking=false;return;}
 // Spend one distance budget along the existing route, regardless of waypoint density or frame rate.
 while(a.path.length){const node=a.path[0],dx=node.x-a.x,dy=node.y-a.y,d=Math.hypot(dx,dy);
  if(d>.001){a.direction=Math.atan2(dy,dx);a.face=dx<-.5?-1:dx>.5?1:a.face;}
  if(d>budget){if(budget>0){a.x+=dx/d*budget;a.y+=dy/d*budget;a.phase=(a.phase||0)+budget/9;}a.walking=true;return;}
  a.x=node.x;a.y=node.y;a.phase=(a.phase||0)+d/9;budget=Math.max(0,budget-d);a.path.shift();
  if(!a.path.length){a.walking=false;const cb=a.after;a.after=null;if(cb)cb();return;}
  if(budget<=0){a.walking=true;return;}
 }
}

// Scene and information views have no resource side effects. Mark only those
// callbacks so background receipts cannot keep a player waiting at their door.
export function navigationArrival(callback){
 if(typeof callback!=='function')throw Error('invalid_navigation_arrival');
 const arrive=()=>callback();arrive.navigationOnly=true;return arrive;
}
// Continue an approved route while a receipt is in flight. Work and transfer
// callbacks wait for confirmation; explicitly marked views may open on arrival.
export function followPendingPath(a,dt,speed){
 if(!a?.path)return;
 if(!a.path.length){followPath(a,dt,speed);return;}
 if(a.after?.navigationOnly===true){followPath(a,dt,speed);return;}
 // Reaching a work/transfer waypoint is an idle wait, not an endless walking pose.
 if(a.path.length===1&&Math.hypot(a.path[0].x-a.x,a.path[0].y-a.y)<=1e-8){const seconds=Number.isFinite(dt)?Math.max(0,dt):0;a.walking=false;a.walkMix=(a.walkMix||0)*Math.exp(-seconds*10);return;}
 const end=a.path.at(-1),after=a.after;a.after=null;
 try{followPath(a,dt,speed)}finally{a.after=after;}
 if(!a.path.length){a.path.push(end);a.walking=false;}
}
