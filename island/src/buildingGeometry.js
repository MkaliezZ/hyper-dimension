import {HOUSE_ATLAS_BOUNDS} from './houseAtlasBounds.js';
import {HOME_ATLAS_BOUNDS} from './homeAtlasBounds.js';
import {PERMANENT_HOMES} from './islandGeography.js';
export function productionGeometry(site,theme){const crop=HOUSE_ATLAS_BOUNDS[theme]?.bounds[site.id],w=Math.min(128,site.w+8),h=crop?Math.min(112,w*crop.h/crop.w):90,foot=site.y+site.h/2-4;return {x:site.x-w/2,y:foot-h,w,h,foot,crop};}
export function residenceGeometry(site,theme){const crop=HOME_ATLAS_BOUNDS[theme]?.bounds[site.ownerId],w=104,h=crop?Math.min(108,w*crop.h/crop.w):90,foot=site.y+site.h/2-4;return {x:site.x-w/2,y:foot-h,w,h,foot,crop};}
const hit=(p,b)=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
export function mapBuildingHit(p,theme,slots){return [...slots.map(s=>({kind:'production',id:s.id,site:s,...productionGeometry(s,theme)})),...PERMANENT_HOMES.map(s=>({kind:'home',id:s.ownerId,site:s,...residenceGeometry(s,theme)}))].sort((a,b)=>b.foot-a.foot).find(b=>hit(p,b))||null;}
