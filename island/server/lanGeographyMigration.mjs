import {ISLAND_GEOGRAPHY,PERMANENT_HOMES} from '../src/islandGeography.js';
import {worldWalkableForTheme,findWorldPathForTheme,worldSlots,BUILDINGS} from '../src/world.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function reachable(theme,anchor,occupied){
 const points=[];
 for(let radius=0;radius<=384;radius+=12){
  const rows=radius?Array.from({length:32},(_,i)=>({x:Math.round((anchor.x+Math.cos(i*Math.PI/16)*radius)/12)*12,y:Math.round((anchor.y+Math.sin(i*Math.PI/16)*radius)/12)*12})):[{x:Math.round(anchor.x/12)*12,y:Math.round(anchor.y/12)*12}];
  for(const point of rows)if(worldWalkableForTheme(theme,point.x,point.y)&&!occupied.some(p=>distance(p,point)<18))points.push(point);
  if(points.length)return points.sort((a,b)=>distance(a,anchor)-distance(b,anchor))[0];
 }
 throw Object.assign(Error('旧会客站位暂时无法适配新地形，原档已保留'),{code:'lan_map',status:503});
}
function routeClear(theme,start,path){let from=start;for(const to of path||[]){const n=Math.max(1,Math.ceil(distance(from,to)/3));for(let i=0;i<=n;i++)if(!worldWalkableForTheme(theme,from.x+(to.x-from.x)*i/n,from.y+(to.y-from.y)*i/n))return false;from=to;}return true;}
// V176 swaps two business identities between existing physical parcels. Keep people
// and earned work progress in place; only outdated work destinations need rerouting.
const PRE_SWAP_WORK_ENTRIES=Object.freeze({20:{x:1644,y:1200},23:{x:1800,y:744}});
function adaptMovedWorksites(room){
 const people=[...(room.residents||[]),...Object.values(room.members).flatMap(m=>m.companions||[])],occupied=[...Object.values(room.members),...people];let changed=false;
 for(const person of people){const work=person.meeting,old=PRE_SWAP_WORK_ENTRIES[work?.buildingId],site=worldSlots(room.theme).find(s=>s.id===work?.buildingId);
  if(work?.kind!=='work'||!work.target||!old||!site||distance(work.target,old)>160||distance(work.target,site.entry)<=160)continue;
  const target=reachable(room.theme,{x:site.entry.x+work.target.x-old.x,y:site.entry.y+work.target.y-old.y},occupied.filter(p=>p!==person)),route=findWorldPathForTheme(room.theme,person,target),last=route.at(-1)||person;
  if(distance(last,target)>18||!routeClear(room.theme,person,route))throw Object.assign(Error('调整后的工位暂时不能抵达，原任务和进度已保留'),{code:'lan_map',status:503});
  if(distance(last,target)>.01)route.push({...target});if(!routeClear(room.theme,person,route))throw Object.assign(Error('工位入口需要重新规划，原任务和进度已保留'),{code:'lan_map',status:503});
  person.path=route;person.walking=route.length>0;work.target=target;work.phase='approaching';person.activity='前往'+BUILDINGS[site.id].name+'调整后的共同试作工位';changed=true;
 }
 return changed;
}
// The original checksummed identity document is backed up before this result is saved.
// Closed rooms are historical records; current terrain only needs stale venue targets checked.
export function adaptOpenRoomGeography(document,at){
 const rooms=[];let relocated=0;
 for(const room of Object.values(document.rooms||{})){
  if(room.phase!=='open')continue;
  if(room.geographyVersion===ISLAND_GEOGRAPHY.version){if(adaptMovedWorksites(room))rooms.push(room.id);continue;}
  const people=[...Object.values(room.members),...(room.residents||[]),...Object.values(room.members).flatMap(m=>m.companions||[])],occupied=people.filter(p=>worldWalkableForTheme(room.theme,p.x,p.y));
  for(const person of people){
   if(!worldWalkableForTheme(room.theme,person.x,person.y)){
    const member=Object.values(room.members).find(m=>(m.companions||[]).includes(person)),id=person.person?.npcId,venue=BUILDINGS.find(b=>person.activity?.includes(b.name)),home=PERMANENT_HOMES.find(h=>h.ownerId===id);
    const anchor=member||worldSlots(room.theme).find(s=>s.id===venue?.id)?.entry||home?.entry||ISLAND_GEOGRAPHY.spawn;
    Object.assign(person,reachable(room.theme,anchor,occupied));occupied.push(person);person.path=[];person.walking=false;relocated++;
   }
   if(!routeClear(room.theme,person,person.path)){person.path=[];person.walking=false;}
   if(person.meeting?.target&&!worldWalkableForTheme(room.theme,person.meeting.target.x,person.meeting.target.y)){
    const work=worldSlots(room.theme).find(s=>s.id===person.meeting.buildingId);person.meeting.target=reachable(room.theme,work?.entry||person,occupied.filter(p=>p!==person));person.path=[];
   }
  }
  room.geographyVersion=ISLAND_GEOGRAPHY.version;room.geographyAdaptedAt=at;rooms.push(room.id);
 }
 return {changed:rooms.length>0,rooms,relocated};
}
