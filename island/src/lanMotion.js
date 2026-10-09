// Interpolate only confirmed server positions. Predicting down a queued route
// overshoots a resident who stops for another actor, then pulls it backwards.
export function sampleLanMotion(a,p,dt,at,passable){
 const safeDt=Math.min(.05,Math.max(0,dt));
 if(a.snapshotAt!==p.updatedAt||!a.motionSample){
  const interval=a.snapshotAt==null?.12:Math.max(.12,Math.min(.7,(p.updatedAt-a.snapshotAt)/1000));
  a.motionSample={from:{x:a.x,y:a.y},to:{x:p.x,y:p.y},at,duration:interval};
  a.snapshotAt=p.updatedAt;
 }
 const sample=a.motionSample,progress=Math.max(0,Math.min(1,(at-sample.at)/(sample.duration*1000))),target={x:sample.from.x+(sample.to.x-sample.from.x)*progress,y:sample.from.y+(sample.to.y-sample.from.y)*progress};
 const before={x:a.x,y:a.y},jump=Math.hypot(p.x-a.x,p.y-a.y)>80;
 if(jump||!passable(before,target)){a.x=p.x;a.y=p.y;sample.from={x:p.x,y:p.y};sample.to={...sample.from};}
 else{a.x=target.x;a.y=target.y;}
 if(Number.isFinite(p.direction))a.direction=p.direction;
 const moving=!!p.online&&p.walking===true&&!jump&&Math.hypot(a.x-before.x,a.y-before.y)>.001;
 a.walking=moving;a.walkMix=(a.walkMix||0)+((moving?1:0)-(a.walkMix||0))*Math.min(1,safeDt*12);
 a.phase=a.walkMix>.001?((a.phase||0)+safeDt*12)%(Math.PI*2):0;
 return a;
}
export function resetLanMotion(a){a.motionSample=null;a.walking=false;a.walkMix=0;a.phase=0;}
