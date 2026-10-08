import {BUILDINGS} from '../src/world.js';
// Only public game facts cross the A2A boundary. Private jobs, files, chats and credentials stay local.
export function islandExchangeContext(state,person,travelMembers=[]){
 const text=(v,n=100)=>typeof v==='string'?v.slice(0,n):'';
 return {islandName:text(person.homeIslandName,40),theme:person.homeTheme,visualDay:Math.max(1,Math.floor(Number(state.day)||1)),
  steward:{name:text(person.name,24),job:text(person.job,40),personality:text(person.personality,100)},
  buildings:BUILDINGS.filter(b=>state.buildings?.[b.id]!=null).map(b=>({name:b.name,purpose:b.desc,quality:Math.max(0,Math.min(100,Math.round(Number(state.facilities?.[b.id]?.quality)||0)))})),
  companions:travelMembers.slice(0,4).map(p=>({name:text(p.name,24),job:text(p.job,40),kind:p.kind==='hermes'?'steward':p.kind==='agent_recruited'?'recruited-agent':'resident',interests:(Array.isArray(p.interest)?p.interest:[]).filter(x=>typeof x==='string').slice(0,6).map(x=>text(x,40))}))};
}
