import {ROOMS} from '../src/rooms.js';
import {travelPerson} from './lanTravelParty.mjs';
import {worldSlots,worldWalkableForTheme,BUILDINGS} from '../src/world.js';
const venues=[[14,3],[0,15],[21,9],[5,7],[3,14],[23,0],[17,2],[13,18],[9,16],[10,14],[7,18],[0,23],[12,21],[4,24],[18,7]];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const roomPeople=r=>[...(r.residents||[]),...Object.values(r.members).flatMap(m=>m.companions||[])];
export function publicPerson(c,online=true){return {...structuredClone(c.person),work:c.meeting?.kind==='work'?structuredClone(c.meeting):null,activity:c.activity||'在岛上走走',meetingId:c.meeting?.id||null,speech:c.speech||null,position:{x:c.x,y:c.y,direction:c.direction,walking:c.walking,online,updatedAt:c.updatedAt,route:c.path.slice(0,12),speed:62}}}
function places(theme,anchor,occupied=[],radius=108){
 const rows=[];for(let y=-radius;y<=radius;y+=18)for(let x=-radius;x<=radius;x+=18){const p={x:anchor.x+x,y:anchor.y+y};if(worldWalkableForTheme(theme,p.x,p.y)&&!occupied.some(q=>distance(p,q)<20))rows.push(p);}
 return rows.sort((a,b)=>distance(a,anchor)-distance(b,anchor));
}
export function seedRoomResidents(r,account,doc,route,at){
 if(r.residents)return;r.residents=[];
 const existing=new Set(roomPeople(r).map(c=>c.person.actorId)),occupied=Object.values(r.members).flatMap(m=>[m,...(m.companions||[])]);
 const slots=worldSlots(r.theme);
 for(let i=0;i<15;i++){
  const person=travelPerson(account,doc,i);if(existing.has(person.actorId))continue;
  const interests=venues[i],venue=slots.find(s=>s.id===interests[0])||slots[i%slots.length],anchor=venue.entry;
  const p=places(r.theme,anchor,occupied).find(p=>{try{route(r.theme,r.members[r.owner],p);return true}catch{return false}});
  if(!p)continue;const c={person,...p,path:[],direction:Math.PI/2,walking:false,updatedAt:at,visitAt:at+15000+i*2000,visitIndex:0,activity:'在'+BUILDINGS[venue.id].name+'附近接待来访者'};
  r.residents.push(c);occupied.push(c);
 }
}
export function stepPerson(r,c,dt,route,occupied=[]){
 let left=Math.min(2,Math.max(0,dt))*62;c.walking=false;
 while(left>0&&c.path.length){const p=c.path[0],dx=p.x-c.x,dy=p.y-c.y,len=Math.hypot(dx,dy);if(len<.05){c.path.shift();continue;}const step=Math.min(left,len,4),next=len?{x:c.x+dx/len*step,y:c.y+dy/len*step}:p;
  if(!worldWalkableForTheme(r.theme,next.x,next.y)){c.path=[];break}
  if(occupied.some(q=>q!==c&&distance(next,q)<15)){
   c.blockedFor=(c.blockedFor||0)+Math.min(2,Math.max(0,dt));
   if(c.blockedFor>=.6){c.blockedFor=0;const target=c.meeting?.target||c.path.at(-1),avoid=occupied.filter(q=>q!==c);
    try{const path=route(r.theme,c,target,avoid),last=path.at(-1)||c,n=Math.max(1,Math.ceil(distance(last,target)/3));
     for(let i=0;i<=n;i++){const p={x:last.x+(target.x-last.x)*i/n,y:last.y+(target.y-last.y)*i/n};if(!worldWalkableForTheme(r.theme,p.x,p.y)||avoid.some(q=>distance(p,q)<15))throw Error('等待让路');}
     if(distance(last,target)>.01)path.push({...target});c.path=path;
    }catch{}
   }break;
  }
  if(len)c.direction=Math.atan2(dy,dx);c.x=next.x;c.y=next.y;c.walking=step>0;left-=step;if(len<=step+.001)c.path.shift();
 }
}
export function advanceResidents(r,at,route){
 const occupied=[...Object.values(r.members),...roomPeople(r)];
 for(const c of r.residents||[]){
  const dt=Math.min(2,Math.max(0,(at-(c.updatedAt||at))/1000));c.updatedAt=at;
  if(at-r.members[r.owner].lastSeen>45000){c.walking=false;continue;}
  if(c.meeting){if(c.meeting.until<at){c.meeting=null;c.path=[];}else{stepPerson(r,c,dt,route,occupied);continue}}
  if(!c.path.length&&at>=c.visitAt){
   const ids=venues[c.person.npcId]||[];if(!ids.length)ids.push(c.person.npcId%25);
   const venueId=ids[c.visitIndex++%ids.length],venue=worldSlots(r.theme).find(s=>s.id===venueId);
   for(const p of places(r.theme,venue.entry,occupied.filter(x=>x!==c))){try{c.path=route(r.theme,c,p);c.activity='前往'+BUILDINGS[venue.id].name+'，交流'+c.person.job+'见闻';break}catch{}}
   c.visitAt=at+60000+c.person.npcId*1000;
  }
  stepPerson(r,c,dt,route,occupied);
 }
}
export function prepareMeeting(r,ids,id,at,route){
 const people=roomPeople(r),pair=ids.map(id=>people.find(c=>c.person.actorId===id));
 if(pair.some(c=>!c||!['ai','agent_recruited'].includes(c.person.kind)))throw Error('会面居民已离开');
 if(pair[0].person.ownerAccountId===pair[1].person.ownerAccountId)throw Error('会面需要来自不同岛的居民');
 if(pair.some(c=>c.meeting&&c.meeting.id!==id&&c.meeting.until>at))throw Error('居民正在进行另一场交谈');
 if(pair.every(c=>c.meeting?.id===id))return;
 const host=pair.find(c=>c.person.ownerAccountId===r.owner)||pair[0],occupied=[...Object.values(r.members),...people.filter(c=>!pair.includes(c))];
 for(const a of places(r.theme,host,occupied,90)){
  for(const b of places(r.theme,{x:a.x+36,y:a.y},[...occupied,a],54).filter(p=>distance(p,a)>=30&&distance(p,a)<=65)){
   try{const paths=pair.map((c,n)=>{const target=n?b:a;if(distance(c,target)<1)return [];const path=route(r.theme,c,target,occupied),last=path.at(-1)||c,steps=Math.max(1,Math.ceil(distance(last,target)/3));for(let i=0;i<=steps;i++)if(!worldWalkableForTheme(r.theme,last.x+(target.x-last.x)*i/steps,last.y+(target.y-last.y)*i/steps))throw Error('站位不可抵达');if(distance(last,target)>.01)path.push({...target});return path;});pair.forEach((c,n)=>{c.path=paths[n];c.meeting={id,until:at+180000,target:n?b:a};c.activity='与'+pair[1-n].person.name+'碰面';});return;}catch{}
  }
 }
 throw Error('附近没有可用的交谈站位');
}
export function meetingReady(r,ids,id,at){
 const pair=ids.map(id=>roomPeople(r).find(c=>c.person.actorId===id));
 return pair.every(c=>c?.meeting?.id===id&&c.meeting.until>=at&&distance(c,c.meeting.target)<8)&&distance(pair[0],pair[1])<=75;
}
export function finishMeeting(r,id,event=null){
 const pair=roomPeople(r).filter(c=>c.meeting?.id===id);
 pair.forEach((c,n)=>{const peer=pair[1-n];if(peer)c.direction=Math.atan2(peer.y-c.y,peer.x-c.x);c.path=[];c.activity=event?'刚刚与朋友交流过':'继续参观小岛';c.meeting=event?{id,until:event.at+event.lines.length*3500,target:{x:c.x,y:c.y}}:null;c.speech=event?{at:event.at,lines:event.lines.map((l,i)=>({...l,start:i*3500}))}:null;});
}

export function prepareRoomWork(r,parts,id,at,route){
 const people=roomPeople(r),actors=parts.map(p=>people.find(c=>c.person.actorId===p.actorId));if(actors.some(c=>!c))throw Error('共同试作的参与者已离岛');
 if(actors.every(c=>c.meeting?.id===id&&c.meeting.kind==='work'))return;
 if(actors.some(c=>c.meeting&&c.meeting.id!==id&&c.meeting.until>at))throw Object.assign(Error('居民正在把这段话说完，稍后会前往工位。'),{code:'lan_work_wait'});
 const occupied=[...Object.values(r.members),...people.filter(c=>!actors.includes(c))],plans=[];
 for(const [index,c]of actors.entries()){
  const part=parts[index],slot=worldSlots(r.theme).find(s=>s.id===part.command.buildingId);if(!slot)throw Error('工作建筑不存在');let plan;
  for(const target of places(r.theme,slot.entry,occupied,108).filter(p=>plans.every(q=>distance(p,q.target)>=65))){
   try{const path=route(r.theme,c,target,occupied),last=path.at(-1)||c,n=Math.max(1,Math.ceil(distance(last,target)/3));for(let i=0;i<=n;i++)if(!worldWalkableForTheme(r.theme,last.x+(target.x-last.x)*i/n,last.y+(target.y-last.y)*i/n))throw Error('工位不能抵达');if(distance(last,target)>.01)path.push({...target});plan={target,path};break;}catch{}
  }
  if(!plan)throw Error('建筑附近暂时没有可行走的工作位置');plans.push(plan);
 }
 actors.forEach((c,i)=>{const part=parts[i];c.path=plans[i].path;c.speech=null;c.meeting={id,kind:'work',until:at+1800000,target:plans[i].target,buildingId:part.command.buildingId,recipeId:part.command.recipeId,output:part.item,action:ROOMS[part.command.buildingId].action,duration:part.duration,elapsed:0,phase:'approaching'};c.activity='前往'+BUILDINGS[part.command.buildingId].name+'的共同试作工位';});
}
export function roomWorkProgress(r,id,at,elapsed=null){
 const actors=roomPeople(r).filter(c=>c.meeting?.id===id&&c.meeting.kind==='work');
 const ready=actors.length>=2&&actors.every(c=>c.meeting.until>=at&&distance(c,c.meeting.target)<8&&r.members[c.person.ownerAccountId]&&at-r.members[c.person.ownerAccountId].lastSeen<=45000);
 if(ready&&elapsed!==null)for(const c of actors){c.meeting.phase='working';c.meeting.elapsed=elapsed;c.direction=Math.PI*1.5;c.activity='在'+BUILDINGS[c.meeting.buildingId].name+'共同试作';}
 return {ready,actors:actors.map(c=>({actorId:c.person.actorId,x:c.x,y:c.y,target:c.meeting.target,phase:c.meeting.phase}))};
}
