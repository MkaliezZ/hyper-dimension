import {ISLAND_GEOGRAPHY,PERMANENT_HOMES} from '../src/islandGeography.js';
import {worldWalkableForTheme,worldSlots,BUILDINGS} from '../src/world.js';
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
// The original checksummed identity document is backed up before this result is saved.
// Closed rooms are historical records, and current-version rooms do no extra work.
export function adaptOpenRoomGeography(document,at){
 const rooms=[];let relocated=0;
 for(const room of Object.values(document.rooms||{})){
  if(room.phase!=='open'||room.geographyVersion===ISLAND_GEOGRAPHY.version)continue;
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
