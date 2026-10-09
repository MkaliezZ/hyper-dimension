import {seededRandom} from './gameLevels.js';
import {validCraftEvent} from './craftGameReplay.js';
export const NIGHT_SKY_VERSION=2;
export const NIGHT_SKY_ORIGIN={x:50,y:94};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(v,a,b)=>Number.isFinite(v)&&v>=a&&v<=b;
export function nightSkyLevels(seed,difficulty='normal'){
 const r=seededRandom(seed),easy=difficulty==='easy';
 return Array.from({length:4},(_,i)=>({
  target:{x:30+r()*40,y:18+r()*17,radius:easy?7.5:4.8},
  wind:(r()-.5)*(easy?1.1:2),gust:(easy?.18:.42)+r()*.18,windPhase:r()*Math.PI*2,
  cloud:{x:34+r()*32,y:48+r()*12,radius:easy?5:7,side:r()<.5?-1:1},
  color:['#ffe09c','#f6b7c9','#b5e8df','#d0c4ff'][i]
 }));
}
export function createNightSkyGame(seed,difficulty='normal'){
 return {engine:'night-sky',rulesVersion:NIGHT_SKY_VERSION,seed,difficulty,levels:nightSkyLevels(seed,difficulty),elapsed:0,phaseTime:0,phase:'aim',round:0,score:0,aim:{angle:0,power:1},flight:null,reports:[]};
}
export function nightSkyLevel(g){return g.levels[Math.min(3,Math.max(0,g.round-(g.phase==='between'||g.phase==='complete'?1:0)))];}
export function nightSkyWind(g,after=0){const l=nightSkyLevel(g);return l.wind+Math.sin((g.elapsed+after)*1.2+l.windPhase)*l.gust;}
export function nightSkyCloud(g,after=0){const c=nightSkyLevel(g).cloud;return {...c,x:c.x+Math.sin((g.elapsed+after)*.4+g.round)*3};}
function launch(g){
 const angle=g.aim.angle*Math.PI/180;
 g.flight={...NIGHT_SKY_ORIGIN,vx:Math.sin(angle)*12,vy:-16*g.aim.power,age:0,adjusted:false,inCloud:false,trail:[],lastTrail:0,angle:g.aim.angle,power:g.aim.power};
 g.phase='flight';g.phaseTime=0;
}
function integrate(g,f,dt,after=0){
 const wind=nightSkyWind(g,after),cloud=nightSkyCloud(g,after),inside=Math.hypot(f.x-cloud.x,f.y-cloud.y)<cloud.radius;
 f.vx+=(wind*.48+(inside?cloud.side*.45:0))*dt;
 f.vy=Math.min(-9,f.vy+dt*.18);
 f.x+=f.vx*dt;f.y+=f.vy*dt;f.age+=dt;f.inCloud=inside;
}
function finishFlight(g,x){
 const f=g.flight,l=nightSkyLevel(g),error=Math.abs(x-l.target.x),precise=error<=l.target.radius;
 f.x=x;f.y=l.target.y;
 g.reports.push({round:g.round+1,x,targetX:l.target.x,error,precise,angle:f.angle,power:f.power,adjusted:f.adjusted,flightTime:f.age});
 g.round++;if(precise)g.score++;g.phase=g.round===4?'complete':'between';g.phaseTime=0;
}
export function applyNightSkyEvent(g,e){
 if(!validCraftEvent(e))throw Error('Invalid starlight input');
 if(e.neutral)return g;
 if(Object.hasOwn(e,'dt')){
  if(g.phase==='complete')return g;
  const dt=e.dt;
  if(g.phase==='flight'){
   const f=g.flight,l=nightSkyLevel(g),before={x:f.x,y:f.y};integrate(g,f,dt);
   if(f.age-f.lastTrail>=.095){f.trail.push({x:f.x,y:f.y});f.trail=f.trail.slice(-64);f.lastTrail=f.age;}
   if(f.y<=l.target.y){const ratio=(before.y-l.target.y)/(before.y-f.y||1);finishFlight(g,before.x+(f.x-before.x)*clamp(ratio,0,1));}
  }
  g.elapsed+=dt;g.phaseTime+=dt;return g;
 }
 const a=e.action,keys=Object.keys(a).sort().join(',');
 if(a.type==='aim'&&keys==='type,value,x'&&g.phase==='aim'&&finite(a.x,-38,38)&&finite(a.value,.65,1.3)){g.aim={angle:a.x,power:a.value};return g;}
 if(a.type==='launch'&&keys==='type'&&g.phase==='aim'){launch(g);return g;}
 if(a.type==='adjust'&&keys==='dir,type'&&g.phase==='flight'&&!g.flight.adjusted&&[-1,1].includes(a.dir)){
  g.flight.vx+=a.dir*(g.difficulty==='easy'?3.5:2.8);g.flight.adjusted=true;return g;
 }
 if(a.type==='next'&&keys==='type'&&g.phase==='between'&&g.phaseTime>=1.5){g.phase='aim';g.phaseTime=0;g.aim={angle:0,power:1};g.flight=null;return g;}
 throw Error('Invalid starlight move');
}
// Only the first part of the trajectory is shown; later gusts need observation.
export function previewNightTrajectory(g,seconds=1.7){
 const preview=structuredClone(g);launch(preview);const points=[{...NIGHT_SKY_ORIGIN}];
 for(let t=0;t<seconds;t+=.05){integrate(preview,preview.flight,.05,t);if(Math.round(t*20)%3===0)points.push({x:preview.flight.x,y:preview.flight.y});}
 return points;
}
export function validNightSkyGame(g){
 if(g?.engine!=='night-sky'||g.rulesVersion!==NIGHT_SKY_VERSION||!Number.isInteger(g.seed)||!finite(g.seed,0,0xffffffff)||!['normal','easy'].includes(g.difficulty))return false;
 if(!finite(g.elapsed,0,86400.15)||!finite(g.phaseTime,0,86400.15)||!['aim','flight','between','complete'].includes(g.phase)||!Number.isInteger(g.round)||!finite(g.round,0,4)||!Number.isInteger(g.score)||!finite(g.score,0,g.round))return false;
 if(JSON.stringify(g.levels)!==JSON.stringify(nightSkyLevels(g.seed,g.difficulty))||!finite(g.aim?.angle,-38,38)||!finite(g.aim?.power,.65,1.3))return false;
 if(!Array.isArray(g.reports)||g.reports.length!==g.round||g.score!==g.reports.filter(r=>r.precise).length)return false;
 if(g.reports.some((r,i)=>r.round!==i+1||!finite(r.x,-500,600)||r.targetX!==g.levels[i].target.x||r.error!==Math.abs(r.x-r.targetX)||typeof r.precise!=='boolean'||r.precise!==(r.error<=g.levels[i].target.radius)||!finite(r.angle,-38,38)||!finite(r.power,.65,1.3)||typeof r.adjusted!=='boolean'||!finite(r.flightTime,0,12)))return false;
 if(g.phase==='complete'&&g.round!==4||g.phase!=='complete'&&g.round===4||g.phase==='between'&&g.round===0)return false;
 if(g.phase==='aim')return g.flight===null;
 const f=g.flight;
 return !!f&&['x','y','vx','vy','age','lastTrail','angle','power'].every(k=>Number.isFinite(f[k]))&&finite(f.age,0,12)&&finite(f.angle,-38,38)&&finite(f.power,.65,1.3)&&typeof f.adjusted==='boolean'&&typeof f.inCloud==='boolean'&&Array.isArray(f.trail)&&f.trail.length<=64&&f.trail.every(p=>finite(p.x,-500,600)&&finite(p.y,-50,100));
}
