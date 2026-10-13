import {syncFacilityState} from './facilityActions.mjs';
import {ISLAND_GEOGRAPHY} from '../src/islandGeography.js';
import {worldSlots,worldWalkableForTheme,HOTSPOTS} from '../src/world.js';
import {worldSlots as legacySlots} from '../src/legacyWorldGeometry.js';
import {checkDecoration,snapDisplay,connectedPlacements} from '../src/placements.js';
import {createFestivalLayout} from '../src/festivalLayout.js';
const VERSION=169;
function nearest(theme,p){if(worldWalkableForTheme(theme,p.x,p.y))return {...p};for(let r=12;r<=240;r+=12)for(let i=0;i<32;i++){const a=i*Math.PI/16,q={x:p.x+Math.cos(a)*r,y:p.y+Math.sin(a)*r};if(worldWalkableForTheme(theme,q.x,q.y))return q;}return {...ISLAND_GEOGRAPHY.spawn};}
export function migrateWorldGeography(s,b,theme){
 if(s.geographyVersion===VERSION)return false;
 const appearance=s.worldAppearance||s.placementBook?.theme||theme,previous=legacySlots(appearance),current=worldSlots(appearance),plaza=ISLAND_GEOGRAPHY.landmarks.plaza;
 const anchors=[...previous.map(p=>({old:p.entry,next:current.find(q=>q.id===p.id).entry})),{old:{x:786,y:458},next:ISLAND_GEOGRAPHY.spawn},{old:{x:430,y:703},next:HOTSPOTS.find(h=>h.type==='farm').entry},{old:{x:1157,y:275},next:HOTSPOTS.find(h=>h.type==='mine').entry}];
 const source=anchors.sort((a,b)=>Math.hypot(s.player.x-a.old.x,s.player.y-a.old.y)-Math.hypot(s.player.x-b.old.x,s.player.y-b.old.y))[0];
 s.player=nearest(appearance,{x:source.next.x+s.player.x-source.old.x,y:source.next.y+s.player.y-source.old.y});
 if(s.placementBook){const old=s.placedItems||[];s.placedItems=[];for(const item of old){if(item.version!==2){s.placedItems.push(item);continue;}const from=previous.find(p=>p.id===item.building),to=current.find(p=>p.id===item.building),origin={x:item.x+to.x-from.x,y:item.y+to.y-from.y};let found=null;for(let radius=0;radius<=480&&!found;radius+=12)for(let i=0;i<(radius?32:1);i++){const a=i*Math.PI/16,p={...item,...snapDisplay(origin.x+Math.cos(a)*radius,origin.y+Math.sin(a)*radius)};if(checkDecoration(s,p,{theme:appearance,connectivity:false}).ok){found=p;break;}}if(!found)throw Object.assign(Error('新地形暂时找不到完整陈列空间；原存档与摆件保持不变'),{status:409,code:'geography_pending'});delete found.appearancePositions;s.placedItems.push(found);}if(!connectedPlacements(s,appearance).ok)throw Object.assign(Error('新地图的陈列挡住通路；原存档保持不变'),{status:409,code:'geography_pending'});s.placementBook.revision++;}
 const remap=v=>{if(!v||typeof v!=='object')return;for(const [key,value]of Object.entries(v)){if(key==='layout'&&value?.version===1&&Array.isArray(value.staff)&&value.geographyVersion!==VERSION){const next=createFestivalLayout(s,appearance,value.staff.length);if(!next)throw Object.assign(Error('当前活动需要保留完整席位，原存档保持不变'),{status:409,code:'geography_pending'});v[key]=next;}else if(key!=='game')remap(value);}};
 for(const key of ['festivalParty','coutureParty','fireworksParty'])remap(s[key]);for(const key of ['festival','couture','fireworks'])remap(b[key]);
 for(const key of ['festivalAttendance','coutureAttendance','fireworksAttendance','nightAttendance','fishingAttendance'])delete s[key];
 s.npcPresence=[];s.geographyVersion=VERSION;syncFacilityState(s,b);s.geographyMigration={version:VERSION,previousVersion:168,productionIdsPreserved:true,homes:16};return true;
}
