import {HOME_ATLAS_BOUNDS} from './homeAtlasBounds.js';
import {residenceGeometry} from './buildingGeometry.js';
import {registerThemeArtwork} from './themeArtwork.js';
import {drawRaster} from './rasterQuality.js';
const images={};for(const theme of ['pixel','origami']){images[theme]=new Image();registerThemeArtwork(images[theme],HOME_ATLAS_BOUNDS[theme].src,theme);}
export function drawResidence(ctx,site,theme){const r=residenceGeometry(site,theme),im=images[theme];if(im?.complete&&im.naturalWidth&&r.crop){ctx.save();ctx.fillStyle='#2243322b';ctx.beginPath();ctx.ellipse(r.x+r.w/2,r.foot-2,r.w*.39,8,0,0,Math.PI*2);ctx.fill();drawRaster(ctx,im,theme,r.crop.x,r.crop.y,r.crop.w,r.crop.h,r.x,r.y,r.w,r.h);ctx.restore();}return r;}
export function residenceArtStatus(theme){return {version:HOME_ATLAS_BOUNDS[theme]?.version??169,count:HOME_ATLAS_BOUNDS[theme]?.bounds.length||0,loaded:!!images[theme]?.complete&&!!images[theme]?.naturalWidth};}
export function residencePortrait(site,theme){const m=HOME_ATLAS_BOUNDS[theme],b=m.bounds[site.ownerId];return '<svg class="residence-portrait" viewBox="'+[b.x,b.y,b.w,b.h].join(' ')+'" role="img" aria-label="'+site.name+'"><image href="'+m.src+'" width="'+m.width+'" height="'+m.height+'" /></svg>';}
