// Find actual safe space in the current artwork; currency/lease assertions remain in each scenario.
import {MAP_EXTENT,HOTSPOTS} from '../src/world.js';import {checkDecoration} from '../src/placements.js';
export function safePlacement(state,item,{theme=state.placementBook?.theme||'pixel',rotation=0,rotations=[rotation],around=null,maxRadius=Infinity,except=null,awayFrom=null,minDistance=0}={}){
 const points=[];for(let y=48;y<MAP_EXTENT.height-24;y+=8)for(let x=48;x<MAP_EXTENT.width-24;x+=8){if(around&&Math.hypot(x-around.x,y-around.y)>maxRadius||awayFrom&&Math.hypot(x-awayFrom.x,y-awayFrom.y)<minDistance)continue;points.push({x,y});}
 if(around)points.sort((a,b)=>Math.hypot(a.x-around.x,a.y-around.y)-Math.hypot(b.x-around.x,b.y-around.y));
 for(const p of points)if(rotations.every(r=>checkDecoration(state,{...p,item,rotation:r},{theme,except,connectivity:false}).ok)&&checkDecoration(state,{...p,item,rotation},{theme,except}).ok)return {...p,rotation};throw Error('No safe '+item+' placement in '+theme);
}
export const plazaCenter=()=>({...HOTSPOTS.find(h=>h.type==='plaza').entry});
