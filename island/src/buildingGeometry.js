import {foundationAxis} from './buildingGroundAnchors.js';
import {terrainParcel} from './terrainParcelAnchors.js';
import {HOUSE_ATLAS_BOUNDS} from './houseAtlasBounds.js';
import {HOME_ATLAS_BOUNDS} from './homeAtlasBounds.js';
import {PERMANENT_HOMES} from './islandGeography.js';
function geometry(site,theme,kind,crop,maxWidth,maxHeight){
 const parcel=terrainParcel(theme,kind,kind==='homes'?site.ownerId:site.id);
 const ratio=crop?crop.h/crop.w:1;
 const w=Math.min(maxWidth,maxHeight/ratio,parcel?parcel.w+12:maxWidth),h=crop?w*ratio:90;
 const foot=parcel?.foot??site.y+site.h/2-4,doorX=parcel?.doorX??site.x;
 const u=foundationAxis(theme,kind,kind==='homes'?site.ownerId:site.id,crop);
 return {x:doorX-w*u,y:foot-h,w,h,foot,doorX,groundCentre:parcel?.centre??{x:site.x,y:site.y},groundRect:parcel??{x:site.x-site.w/2,y:site.y-site.h/2,w:site.w,h:site.h},crop};
}
export function productionGeometry(site,theme){return geometry(site,theme,'production',HOUSE_ATLAS_BOUNDS[theme]?.bounds[site.id],Math.min(128,site.w+8),112);}
export function residenceGeometry(site,theme){return geometry(site,theme,'homes',HOME_ATLAS_BOUNDS[theme]?.bounds[site.ownerId],104,108);}
const hit=(p,b)=>p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h;
export function mapBuildingHit(p,theme,slots){return [...slots.map(s=>({kind:'production',id:s.id,site:s,...productionGeometry(s,theme)})),...PERMANENT_HOMES.map(s=>({kind:'home',id:s.ownerId,site:s,...residenceGeometry(s,theme)}))].sort((a,b)=>b.foot-a.foot).find(b=>hit(p,b))||null;}
