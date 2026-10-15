import {SLOTS,WORLD,harborArtRect} from './world.js';
import {PERMANENT_HOMES,ISLAND_GEOGRAPHY} from './islandGeography.js';
import {productionGeometry,residenceGeometry} from './buildingGeometry.js';
import {PORTFOLIO_SITE} from './portfolioLandmark.js';
import {RESIDENT_SHIFTS,residentSchedule} from './residentSchedule.js';

const clamp=n=>Math.max(0,Math.min(1,n)),mod=(n,m)=>((n%m)+m)%m;
export function nightLightingState(env={}){
 const hour=Number.isFinite(env.hour)?mod(env.hour,24):12,night=clamp(Number.isFinite(env.night)?env.night:hour<6||hour>=19?1:0),weather=env.weather?.id||'clear';
 const cloud={clear:1,cloudy:.32,rain:.06,snow:.16}[weather]??.32;
 return {hour,night,weather,moonVisibility:night*cloud,lunarPhase:mod((Number.isFinite(env.cycles)?env.cycles:0)/29.53+.5,1),ambient:[1-night*.51,1-night*.455,1-night*.38]};
}
// Normalized points measured on the actual, alpha-trimmed house drawings.
// Lanterns and windows are separate: a sleeping resident extinguishes the room,
// while the small porch light keeps the way home visible.
export const PRODUCTION_LIGHT_ANCHORS={
 pixel:[[[.27,.60],[.75,.60]],[[.18,.56],[.83,.56]],[[.73,.72]],[[.38,.68],[.65,.68]],[[.28,.75],[.72,.75]],[[.33,.65],[.62,.65]],[[.22,.65],[.78,.65]],[[.25,.66],[.80,.66]],[[.50,.16]],[[.24,.68],[.74,.68]],[[.38,.69],[.65,.69]],[[.36,.70],[.62,.70]],[[.31,.55],[.69,.55]],[[.31,.69],[.64,.69]],[[.35,.72],[.68,.72]],[[.36,.62],[.67,.62]],[[.18,.43],[.83,.48]],[[.35,.74],[.70,.74]],[[.36,.72],[.59,.72]],[[.25,.73],[.75,.73]],[[.28,.75],[.70,.75]],[[.15,.30],[.30,.25],[.50,.23],[.70,.26],[.85,.30],[.12,.80],[.87,.80]],[[.35,.70],[.70,.70]],[],[[.36,.74],[.65,.74]]],
 origami:[[[.23,.74],[.80,.74]],[[.08,.44],[.88,.44],[.24,.62],[.74,.62]],[[.28,.70],[.74,.70]],[[.16,.68],[.80,.68]],[[.24,.70],[.80,.70]],[],[[.20,.60],[.80,.60]],[[.93,.69]],[[.50,.18]],[[.22,.70],[.73,.70]],[[.20,.56],[.80,.56]],[[.22,.62],[.80,.62]],[[.10,.70],[.90,.70]],[[.10,.60],[.91,.60]],[[.40,.60],[.70,.60]],[[.22,.70],[.80,.70]],[[.18,.50],[.70,.65]],[[.24,.62],[.78,.62]],[],[[.53,.36]],[[.15,.50],[.80,.50]],[[.15,.78],[.90,.78]],[[.85,.75]],[],[]]
};
export const HOME_LIGHT_ANCHORS={
 origami:[[[.31,.73]],[[.335,.73],[.65,.73]],[[.655,.725]],[[.64,.73]],[[.335,.72]],[[.10,.70],[.66,.70]],[[.29,.74],[.63,.74]],[[.335,.70]],[[.315,.73]],[[.33,.73],[.64,.73]],[[.30,.72],[.64,.72]],[[.33,.70]],[[.31,.73]],[[.33,.72],[.65,.72]],[[.38,.68],[.70,.68]],[[.28,.70],[.65,.70]]],
 pixel:[[[.50,.45]],[[.35,.57]],[[.50,.46],[.83,.63]],[[.62,.65],[.25,.60]],[[.53,.57]],[[.50,.54],[.08,.67]],[[.45,.47]],[[.38,.63]],[[.51,.54]],[[.53,.50],[.08,.70]],[[.50,.53]],[[.50,.54]],[[.48,.56]],[[.50,.52]],[[.47,.52],[.77,.61]],[[.34,.62]]]
};
const HOME_WINDOWS={origami:[[[.20,.70],[.74,.70]],[[.22,.75],[.76,.75]],[],[[.23,.72],[.82,.50]],[[.15,.72],[.81,.72]],[[.25,.75],[.78,.75]],[[.14,.77],[.78,.77]],[[.21,.74],[.78,.74]],[[.16,.75]],[[.20,.75],[.76,.75]],[[.18,.71],[.79,.71]],[[.16,.74],[.80,.76]],[[.18,.75],[.78,.75]],[[.18,.74],[.80,.74]],[[.25,.69],[.80,.69]],[[.15,.70],[.80,.70]]],pixel:[[[.24,.73],[.77,.73]],[[.23,.71],[.76,.71]],[[.24,.70],[.79,.70]],[[.21,.68],[.80,.68]],[[.23,.70],[.78,.70]],[[.26,.73],[.80,.73]],[[.23,.71],[.75,.71]],[[.23,.71],[.80,.72]],[[.24,.72],[.78,.72]],[[.24,.74],[.78,.74]],[[.26,.75],[.74,.75]],[[.23,.73],[.77,.73]],[[.25,.73],[.77,.73]],[[.23,.71],[.77,.71]],[[.26,.73],[.80,.73]],[[.22,.72],[.80,.72]]]};
export function buildNightFixtures(theme,env,options={}){
 if(!['pixel','origami'].includes(theme))throw Error('invalid_light_theme');
 const tone=nightLightingState(env),lights=[],awake=new Set(options.awakeResidents||[]),occupied=new Set(options.occupiedBuildings||[]),slots=options.slots||SLOTS;
 const push=(id,kind,x,y,gain,radius=12,extra={})=>lights.push({id,kind,x,y,gain:gain*tone.night,radius,...extra});
 for(const site of slots){if(options.buildings&&!Object.hasOwn(options.buildings,site.id))continue;const b=productionGeometry(site,theme),staff=RESIDENT_SHIFTS.filter(s=>s.buildingId===site.id),working=staff.some(s=>tone.hour>=s.start&&tone.hour<s.end),late=[1,2,8,12,16,19,21].includes(site.id)&&tone.hour>=17&&tone.hour<22.5,on=working||late||occupied.has(site.id)||site.id===8;
  for(const [i,[u,v]]of PRODUCTION_LIGHT_ANCHORS[theme][site.id].entries())push('building:'+site.id+':'+i,site.id===8?'beacon':'fixture',b.x+b.w*u,b.y+b.h*v,on?1:.18,site.id===8?20:9,{buildingId:site.id});
  if(on)push('building:'+site.id+':door','pool',b.doorX,b.foot+5,.65,31,{buildingId:site.id});
 }
 for(const site of PERMANENT_HOMES){const b=residenceGeometry(site,theme),sleeping=residentSchedule(site.ownerId,env)?.sleeping&&!awake.has(site.ownerId);
  for(const [i,[u,v]]of HOME_LIGHT_ANCHORS[theme][site.ownerId].entries())push('home:'+site.ownerId+':lamp:'+i,'fixture',b.x+b.w*u,b.y+b.h*v,.7,9,{ownerId:site.ownerId});
  for(const [i,[u,v]]of HOME_WINDOWS[theme][site.ownerId].entries())push('home:'+site.ownerId+':window:'+i,'window',b.x+b.w*u,b.y+b.h*v,sleeping?0:.72,8,{ownerId:site.ownerId});
  push('home:'+site.ownerId+':porch','pool',b.doorX,b.foot+3,sleeping?.52:.8,27,{ownerId:site.ownerId});
 }
 const harbor=harborArtRect(theme);for(const [i,[u,v]]of [[.016,.18],[.105,.30],[.265,.51],[.40,.39],[.566,.43],[.69,.46],[.92,.51],[.985,.69]].entries())push('harbor:'+i,'fixture',harbor.x+harbor.w*u,harbor.y+harbor.h*v,.95,14);
 const h=PORTFOLIO_SITE.building;for(const [i,[u,v]]of [[.215,.43],[.8,.43],[.06,.69],[.41,.71],[.60,.71],[.95,.69]].entries())push('hall:'+i,'fixture',h.x-h.w/2+h.w*u,h.y-h.h+h.h*v,.85,13);
 const p=ISLAND_GEOGRAPHY.landmarks.plaza;for(const [i,[dx,dy]]of [[-98,-48],[98,-48],[-98,52],[98,52]].entries()){push('plaza:'+i,'post',p.x+dx,p.y+dy,1,35,{footY:p.y+dy+19});push('plaza:'+i+':pool','pool',p.x+dx,p.y+dy+19,.9,43);}
 return {tone,lights,moon:{x:WORLD.width-115+Math.sin((env.phase||0)*Math.PI*2)*27,y:WORLD.height*.7+Math.cos((env.phase||0)*Math.PI*2)*20,visibility:tone.moonVisibility,phase:tone.lunarPhase}};
}
export function moonRibbon(moon,time){if(moon.visibility<=.001)return [];const rows=[];for(let i=0;i<72;i++){const t=i/71,y=moon.y+18+t*620,spread=8+t*45,x=moon.x+Math.sin(time*.34+i*.73)*(2+t*4)+Math.sin(i*7.17)*spread*.75,pulse=.48+.52*Math.sin(time*.75-i*1.43)**2;rows.push({x,y,w:(3+spread*.8)*pulse,h:1.2+t*.8,alpha:moon.visibility*(1-t)**1.3*(.10+.19*pulse)});}return rows;}
