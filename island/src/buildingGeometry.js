import {foundationAxis} from './buildingGroundAnchors.js';
import {HOUSE_ATLAS_BOUNDS} from './houseAtlasBounds.js';
import {HOME_ATLAS_BOUNDS} from './homeAtlasBounds.js';
import {PERMANENT_HOMES} from './islandGeography.js';
export function productionGeometry(site,theme){const crop=HOUSE_ATLAS_BOUNDS[theme]?.bounds[site.id],ratio=crop?crop.h/crop.w:1,w=Math.min(128,site.w+8,112/ratio),h=crop?w*ratio:90,foot=site.y+site.h/2-4,doorX=site.x,u=foundationAxis(theme,'production',site.id,crop);return {x:doorX-w*u,y:foot-h,w,h,foot,doorX,groundCentre:{x:site.x,y:site.y},foundationCentre:{x:doorX,y:foot-(site.h/2-4)},crop};}
export function residenceGeometry(site,theme){const crop=HOME_ATLAS_BOUNDS[theme]?.bounds[site.ownerId],ratio=crop?crop.h/crop.w:1,w=Math.min(104,108/ratio),h=crop?w*ratio:90,foot=site.y+site.h/2-4,doorX=site.x,u=foundationAxis(theme,'homes',site.ownerId,crop);return {x:doorX-w*u,y:foot-h,w,h,foot,doorX,groundCentre:{x:site.x,y:site.y},foundationCentre:{x:doorX,y:foot-(site.h/2-4)},crop};}
const hit=(p,b)=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
export function mapBuildingHit(p,theme,slots){return [...slots.map(s=>({kind:'production',id:s.id,site:s,...productionGeometry(s,theme)})),...PERMANENT_HOMES.map(s=>({kind:'home',id:s.ownerId,site:s,...residenceGeometry(s,theme)}))].sort((a,b)=>b.foot-a.foot).find(b=>hit(p,b))||null;}
