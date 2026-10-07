
import {findPath,worldWalkable} from './world.js';
export const NIGHT_PARTY_SPOTS=[{x:735,y:430},{x:845,y:430},{x:790,y:480}];
const people=g=>g?.participants||[0,2];
export function nightPartyArrived(s){const a=s.nightAttendance;if(!a||!s.partySession||a.id!==s.partySession.id)return false;return people(s.partySession).every((id,i)=>{const p=a.people?.[id],n=s.npcPresence?.find(n=>n.id===id),target=NIGHT_PARTY_SPOTS[i];return p?.arrived===true&&p.inside===null&&Math.hypot(p.x-target.x,p.y-target.y)<=8&&n?.inside===null&&Math.hypot(n.x-target.x,n.y-target.y)<=8;});}
export function createNightPartyRuntime({state,npcs,resident,followPath,occupied,now}){
 let eventId=null;const held=new Set();
 function release(){for(const id of held){const n=npcs[id];n.partyControlled=false;n.action=null;n.path=[];n.after=null;n.intent=null;n.walkMix=0;n.think=0;}held.clear();eventId=null;}
 function update(dt){
  const s=state(),g=s.partySession;if(!s.partyControl||!g){if(held.size)release();return;}
  if(eventId&&eventId!==g.id)release();
  if(eventId!==g.id){eventId=g.id;const saved=s.nightAttendance?.id===g.id?s.nightAttendance:null;for(const id of people(g)){const p=saved?.people?.[id];if(p?.controlled&&p.inside===null&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&worldWalkable(p.x,p.y)){const n=npcs[id];n.x=p.x;n.y=p.y;n.inside=null;n.indoorActor=null;}}s.nightAttendance=saved||{id:g.id,people:{}};}
  if(!s.nightAttendance||s.nightAttendance.id!==g.id||!s.nightAttendance.people)s.nightAttendance={id:g.id,people:{}};
  for(const [i,id] of people(g).entries()){
   const n=npcs[id],target=NIGHT_PARTY_SPOTS[i];
   if(!held.has(id)){
    if(n.action||n.meeting||n.inside!=null||occupied(id)){n.status='收尾当前工作，再到广场放飞星灯';continue;}
    resident().releaseActor(n);n.partyControlled=true;held.add(id);n.path=findPath(n,target,worldWalkable);const end=n.path.at(-1)||n;if(Array.from({length:9},(_,j)=>worldWalkable(end.x+(target.x-end.x)*j/8,end.y+(target.y-end.y)*j/8)).every(Boolean))n.path.push({...target});
   }
   const distance=Math.hypot(n.x-target.x,n.y-target.y);
   if(distance>8){n.action=null;n.status='沿道路前往星灯夜集';if(!n.path.length)n.path=findPath(n,target,worldWalkable);followPath(n,dt,65);}
   else{n.path=[];n.after=null;n.walkMix=0;n.direction=i===0?0:Math.PI;n.status='星灯夜集 · 专属放飞站位';n.action={type:'celebrate',t:(now()+i*.6)%1.6,duration:1.6};}
   s.nightAttendance.people[id]={x:n.x,y:n.y,inside:null,controlled:true,arrived:Math.hypot(n.x-target.x,n.y-target.y)<=8};
  }
 }
 return {update,reset:()=>{release();},release};
}
