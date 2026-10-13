// Interpolate only the part of a server route that has actually been traversed.
// A straight chord between two receipts can cut a corner and force a visible snap.
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function confirmedLeg(previous,next){
 if(!previous)return null;
 if(distance(previous,next)<.001)return [];
 let from=previous;const leg=[];
 for(const to of previous.route||[]){
  const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
  const t=length?((next.x-from.x)*dx+(next.y-from.y)*dy)/length:0;
  const error=Math.hypot(next.x-from.x-dx*t,next.y-from.y-dy*t);
  if(t>=-.001&&t<=1.001&&error<.1){leg.push({x:next.x,y:next.y});return leg;}
  leg.push({x:to.x,y:to.y});from=to;
 }
 return null;
}
function samplePath(a,p,passable){
 const before={x:a.x,y:a.y},leg=confirmedLeg(a.confirmedMotion,p);
 const tail=a.motionSample?.path?.slice((a.motionIndex||0)+1)||[];
 const path=leg?[before,...tail,...leg]:[before,{x:p.x,y:p.y}];
 const rows=path.filter((v,i)=>!i||distance(v,path[i-1])>.001);
 for(let i=1;i<rows.length;i++)if(!passable(rows[i-1],rows[i]))return [before];
 return rows;
}
export function sampleLanMotion(a,p,dt,at,passable){
 const safeDt=Math.min(.05,Math.max(0,dt));
 if(a.snapshotAt!==p.updatedAt||!a.motionSample){
  if(a.snapshotAt!=null&&p.updatedAt<a.snapshotAt)return a;
  const interval=a.snapshotAt==null?.12:Math.max(.12,Math.min(.7,(p.updatedAt-a.snapshotAt)/1000));
  const path=samplePath(a,p,passable),length=path.slice(1).reduce((n,v,i)=>n+distance(v,path[i]),0);
  a.motionSample={path,length,at,duration:interval};a.motionIndex=0;
  a.snapshotAt=p.updatedAt;
  a.confirmedMotion={x:p.x,y:p.y,route:(p.route||[]).map(v=>({...v}))};
 }
 const sample=a.motionSample,before={x:a.x,y:a.y},jump=distance(p,a)>80;
 if(jump){a.x=p.x;a.y=p.y;sample.path=[{x:p.x,y:p.y}];sample.length=0;a.motionIndex=0;}
 else{
  let left=Math.max(0,Math.min(1,(at-sample.at)/(sample.duration*1000)))*sample.length;
  let target=sample.path[0],index=0;
  for(let i=1;i<sample.path.length;i++){
   const from=sample.path[i-1],to=sample.path[i],len=distance(from,to);
   if(left<len){const t=len?left/len:0;target={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};index=i-1;break;}
   left-=len;target=to;index=i;
  }
  a.x=target.x;a.y=target.y;a.motionIndex=index;
 }
 const travelled=distance(a,before),moving=!!p.online&&!jump&&travelled>.001;
 if(moving)a.direction=Math.atan2(a.y-before.y,a.x-before.x);
 else if(distance(a,p)<.1&&Number.isFinite(p.direction))a.direction=p.direction;
 a.walking=moving;a.walkMix=(a.walkMix||0)+((moving?1:0)-(a.walkMix||0))*Math.min(1,safeDt*12);
 a.phase=a.walkMix>.001?((a.phase||0)+travelled*.16)%(Math.PI*2):0;
 return a;
}
export function resetLanMotion(a){a.motionSample=null;a.confirmedMotion=null;a.motionIndex=0;a.walking=false;a.walkMix=0;a.phase=0;}
