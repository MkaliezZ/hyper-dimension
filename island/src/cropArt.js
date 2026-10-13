import {CROP_ART_FRAMES} from './cropArtFrames.js';
import {registerThemeArtwork} from './themeArtwork.js';
const images=new Map(),validated=new WeakMap(),preparedThemes=new Set();
export function cropPlantingGrid(crop){return ['cabbage','kale','pumpkin','blueberry','eggplant','cucumber','pea','sweet_potato','daikon','corn','cotton','strawberry','potato','tomato'].includes(crop)?{rows:2,columns:3}:{rows:3,columns:4};}
export function growthFrameIndex(stage,growth=0){if(stage<2)return -1;if(stage===4)return 3;if(stage===2)return 0;return growth<.32?0:growth<.68?1:2;}
export function validCropArt(spec){return !!spec&&typeof spec.file==='string'&&Number.isInteger(spec.width)&&Number.isInteger(spec.height)&&spec.width>0&&spec.height>0&&Array.isArray(spec.frames)&&spec.frames.length===4&&spec.frames.every(f=>f&&Array.isArray(f.root)&&[f.x,f.y,f.w,f.h,f.renderHeight,...f.root].every(Number.isFinite)&&f.x>=0&&f.y>=0&&f.w>0&&f.h>0&&f.x+f.w<=spec.width&&f.y+f.h<=spec.height&&f.root?.length===2&&f.root.every(n=>n>=0&&n<=1)&&f.root[1]>=.75&&f.renderHeight>0&&f.renderHeight<=64);}
export function cropFrameGeometry(frame,x,y){const scale=frame.renderHeight/frame.h;return {x:x-frame.root[0]*frame.w*scale,y:y-frame.root[1]*frame.h*scale,w:frame.w*scale,h:frame.h*scale,scale,root:{x,y}};}
// Lower stem and soil contact stay exactly fixed. Only canopy strips receive a bounded breeze.
export function cropWindStrips(frame,time=0,seed=0,theme='origami'){
 const step=Math.max(1,Math.ceil(frame.h/12)),rootY=frame.root[1]*frame.h,stillFrom=rootY*(frame.windStart??.78),out=[];
 for(let y=0;y<frame.h;y+=step){const h=Math.min(step,frame.h-y),weight=Math.max(0,1-(y+h)/Math.max(1,stillFrom)),wave=Math.sin(time*1.55+seed*.73+y/frame.h*.8),amplitude=theme==='pixel'?.55:.85;out.push({y,h,dx:weight?wave*amplitude*weight*weight:0});}return out;
}
function usableSpec(spec){if(!spec||typeof spec!=='object')return false;if(!validated.has(spec))validated.set(spec,validCropArt(spec));return validated.get(spec);}
function imageFor(theme,spec){const key=theme+':'+spec.file;if(!images.has(key)&&typeof Image!=='undefined'){const image=new Image();registerThemeArtwork(image,'/assets/'+spec.file,theme);images.set(key,image);}return images.get(key);}
export function prepareCropArt(theme){if(preparedThemes.has(theme))return;preparedThemes.add(theme);for(const spec of Object.values(CROP_ART_FRAMES[theme]||{}))if(usableSpec(spec))imageFor(theme,spec);}
export function drawCropPlant(ctx,{crop,theme,x,y,stage,growth=0,time=0,seed=0}){
 const spec=CROP_ART_FRAMES[theme]?.[crop],index=growthFrameIndex(stage,growth);if(index<0||!usableSpec(spec))return false;const image=imageFor(theme,spec);if(!image?.complete||!image.naturalWidth)return false;
 const frame=spec.frames[index],g=cropFrameGeometry(frame,x,y);ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';
 for(const band of cropWindStrips(frame,time,seed,theme))ctx.drawImage(image,frame.x,frame.y+band.y,frame.w,band.h,g.x+band.dx,g.y+band.y*g.scale,g.w,band.h*g.scale+.035);
 ctx.restore();return true;
}
export function cropArtStatus(theme){return Object.fromEntries(Object.entries(CROP_ART_FRAMES[theme]||{}).map(([id,s])=>{const image=images.get(theme+':'+s.file);return [id,{valid:validCropArt(s),ready:!!(image?.complete&&image.naturalWidth),source:image?.currentSrc||image?.src||null,width:image?.naturalWidth||0,height:image?.naturalHeight||0,frames:s.frames.length,file:s.file}];}));}
