import {MATERIAL_ART_CLIPS} from './materialArtClips.js';
import {FACILITY_ART_FRAMES,FACILITY_CUP_ART} from './facilityArtFrames.js';
import {teaCupLayout} from './facilityArtModel.js';
import {functionalDefinition} from './facilityCatalog.js';
import {ITEM_BY_ID,RAW_MATERIALS,ALL_RECIPES} from './contentCatalog.js';
import {heldToolGeometry,TOOL_ART} from './toolArt.js';
const images=new Map();let metadata={},clipSerial=0;
export const artReady=fetch('/assets/art-frames-v8.json').then(r=>r.ok?r.json():{}).then(d=>metadata=d).catch(()=>{});
function raster(file){if(!images.has(file)){const im=new Image();im.src='/assets/'+file;images.set(file,im)}return images.get(file)}
export function artFrame(file,index,columns,rows){const img=raster(file),m=metadata[file],frame=m?.frames?.[index]||{x:(index%columns)*(img.naturalWidth||columns*128)/columns,y:Math.floor(index/columns)*(img.naturalHeight||rows*128)/rows,w:(img.naturalWidth||columns*128)/columns,h:(img.naturalHeight||rows*128)/rows};return {img,frame,width:m?.width||img.naturalWidth||columns*128,height:m?.height||img.naturalHeight||rows*128,ready:!!m&&img.complete&&img.naturalWidth>0,file}}
export function itemFrame(id,theme){const item=ITEM_BY_ID[id];if(!item)return null;const tool=TOOL_ART[theme]?.[id];if(tool?.file){const img=raster(tool.file);return {img,frame:tool.frame,width:tool.width,height:tool.height,ready:img.complete&&img.naturalWidth>0,file:tool.file,id};}const facility=functionalDefinition(id);if(facility){const meta=FACILITY_ART_FRAMES[theme],file=meta.file,img=raster(file),frame=meta.rows[['irrigation','nursery','tea'].indexOf(facility.kind)][0];return {img,frame,width:meta.width,height:meta.height,ready:img.complete&&img.naturalWidth>0,file,id,facility:facility.kind};}const material=item.category==='material',pack=material?null:Math.floor(item.index/60),file=`items-${theme}-${material?'materials':'products-'+pack}-v8.png`,index=material?item.index:item.index%60;return {...artFrame(file,index,material?5:6,10),id,sourceClip:material&&metadata[file]?MATERIAL_ART_CLIPS[theme]?.[index]:null}}
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
export function itemMarkup(id,theme,cls='item-art'){const item=ITEM_BY_ID[id],f=itemFrame(id,theme);if(!f)return '';const clip='art-clip-'+(++clipSerial);return `<svg class="${cls}" role="img" aria-label="${escape(item.name)}" viewBox="${f.frame.x} ${f.frame.y} ${f.frame.w} ${f.frame.h}" preserveAspectRatio="xMidYMid meet" overflow="hidden" style="overflow:hidden"><defs><clipPath id="${clip}">${f.sourceClip?`<polygon points="${f.sourceClip.vertical}"/>`:`<rect x="${f.frame.x}" y="${f.frame.y}" width="${f.frame.w}" height="${f.frame.h}"/>`}</clipPath>${f.sourceClip?`<clipPath id="${clip}-h"><polygon points="${f.sourceClip.horizontal}"/></clipPath><clipPath id="${clip}-f"><rect x="${f.frame.x}" y="${f.frame.y}" width="${f.frame.w}" height="${f.frame.h}"/></clipPath>`:""}</defs>${f.sourceClip?`<g clip-path="url(#${clip}-f)"><g clip-path="url(#${clip}-h)">`:""}<image clip-path="url(#${clip})" href="/assets/${f.file}" width="${f.width}" height="${f.height}"/>${f.sourceClip?"</g></g>":""}${f.facility==='tea'?teaCupMarkup(theme,0,0,f.frame.x,f.frame.y):''}</svg>`}
export function rasterMarkup(file,index,columns,rows,label,cls,region){const base=artFrame(file,index,columns,rows),f=region?{...base,frame:region,width:region.atlasWidth||base.width,height:region.atlasHeight||base.height}:base,clip='art-clip-'+(++clipSerial),shape=region?.points?'<polygon points="'+region.points+'"/>':'<rect x="'+f.frame.x+'" y="'+f.frame.y+'" width="'+f.frame.w+'" height="'+f.frame.h+'"/>';return `<svg class="${cls}" role="img" aria-label="${escape(label)}" viewBox="${f.frame.x} ${f.frame.y} ${f.frame.w} ${f.frame.h}" preserveAspectRatio="xMidYMid meet" overflow="hidden" style="overflow:hidden"><defs><clipPath id="${clip}">${shape}</clipPath></defs><image clip-path="url(#${clip})" href="/assets/${file}" width="${f.width}" height="${f.height}"/></svg>`}
const rasterClips=new Map();
function drawClippedRaster(ctx,f,x,y,w,h){
 const r=f.frame;if(!f.sourceClip){ctx.drawImage(f.img,r.x,r.y,r.w,r.h,x,y,w,h);return;}
 let clips=rasterClips.get(f.sourceClip);if(!clips){clips=[f.sourceClip.vertical,f.sourceClip.horizontal].map(points=>new Path2D('M'+points.split(' ').join(' L')+' Z'));rasterClips.set(f.sourceClip,clips);}
 const sx=w/r.w,sy=h/r.h;ctx.save();ctx.translate(x-r.x*sx,y-r.y*sy);ctx.scale(sx,sy);for(const clip of clips)ctx.clip(clip);ctx.drawImage(f.img,r.x,r.y,r.w,r.h,r.x,r.y,r.w,r.h);ctx.restore();
}
export function drawItem(ctx,id,theme,x,y,size=32,angle=0){const f=itemFrame(id,theme);if(!f?.img.complete||!f.img.naturalWidth)return false;const r=f.frame,scale=size/Math.max(r.w,r.h);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=theme!=='pixel';drawClippedRaster(ctx,f,-r.w*scale/2,-r.h*scale/2,r.w*scale,r.h*scale);if(f.facility==='tea')drawTeaCups(ctx,theme,0,-r.w*scale/2,-r.h*scale/2,scale,0);ctx.restore();return true}
export function drawHeldItem(ctx,id,theme,x,y,size,angle,grip){const f=itemFrame(id,theme);if(!f?.img.complete||!f.img.naturalWidth)return false;const r=f.frame,scale=size/Math.max(r.w,r.h),w=r.w*scale,h=r.h*scale;ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.imageSmoothingEnabled=theme!=='pixel';drawClippedRaster(ctx,f,-grip.x*w,-grip.y*h,w,h);if(f.facility==='tea')drawTeaCups(ctx,theme,0,-grip.x*w,-grip.y*h,scale,0);ctx.restore();return true;}
export function drawHeldTool(ctx,id,theme,x,y,size,angle=0){const f=itemFrame(id,theme);if(!f?.ready)return null;const geometry=heldToolGeometry(id,theme,f.frame,size,angle);if(!geometry)return null;drawHeldItem(ctx,id,theme,x,y,size,geometry.rotation,geometry.grip);return geometry;}

export function teaCupArtStatus(theme){const meta=FACILITY_CUP_ART[theme],img=raster(meta.file);return {file:meta.file,loaded:img.complete&&img.naturalWidth>0,permanentCount:3};}
export function teaCupMarkup(theme,rotation=0,servings=0,originX=0,originY=0){
 const meta=FACILITY_CUP_ART[theme],r=meta.frame;
 return teaCupLayout(theme,rotation,servings).map(c=>'<g data-tea-cup="'+c.index+'" data-filled="'+c.filled+'"><svg x="'+(originX+c.x)+'" y="'+(originY+c.y)+'" width="'+c.w+'" height="'+c.h+'" viewBox="'+[r.x,r.y,r.w,r.h].join(' ')+'" overflow="hidden"><image href="/assets/'+meta.file+'" width="'+meta.width+'" height="'+meta.height+'"/></svg>'+(c.filled?'<ellipse cx="'+(originX+c.liquid.x)+'" cy="'+(originY+c.liquid.y)+'" rx="'+c.liquid.rx+'" ry="'+c.liquid.ry+'" fill="#a46d38"/>':'')+'</g>').join('');
}
export function drawTeaCups(ctx,theme,rotation,x,y,scale=1,servings=0){
 const meta=FACILITY_CUP_ART[theme],img=raster(meta.file),r=meta.frame;
 if(!img.complete||!img.naturalWidth)return 0;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.imageSmoothingEnabled=theme!=='pixel';
 for(const c of teaCupLayout(theme,rotation,servings)){
  ctx.drawImage(img,r.x,r.y,r.w,r.h,c.x,c.y,c.w,c.h);
  if(c.filled){ctx.fillStyle='#a46d38';ctx.beginPath();ctx.ellipse(c.liquid.x,c.liquid.y,c.liquid.rx,c.liquid.ry,0,0,Math.PI*2);ctx.fill();}
 }
 ctx.restore();return 3;
}
if(typeof Image!=='undefined')for(const theme of ['pixel','origami'])raster(FACILITY_CUP_ART[theme].file);

export function artStatus(){return {metadata:Object.keys(metadata).length,loaded:[...images].map(([file,im])=>({file,ready:im.complete&&im.naturalWidth>0}))}}
