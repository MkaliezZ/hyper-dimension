import {drawCanvasOcean,canvasOceanStatus,releaseCanvasOcean} from './oceanCanvasSurface.js';
import {renderCanvasOcean} from './oceanCanvasRenderer.js';
export function releaseOceanMotion(canvas){releaseCanvasOcean(canvas);releaseOceanShader(canvas);}
import {drawWorldNightLighting,nightLightingStatus} from './nightLightingRenderer.js';
import {WORLD,MAP_EXTENT} from './world.js';
import {terrainTileStatus} from './mapTiles.js';
import {SEASONS,seasonalTerrain} from './seasonTerrain.js';
import {drawOceanShader,oceanShaderStatus,releaseOceanShader} from './oceanShader.js';
import {buildEnvironmentGeometry} from './environmentGeometry.js';
import {terrainViewport} from './mapTileLayout.js';
import {rainParticle,weatherParticleBudget} from './weatherVisuals.js';
const W=WORLD.width,H=WORLD.height,CELL=4,fields=new Map(),pending=new Set(),TAU=Math.PI*2;
let latest={ready:false,ripples:0,waveLoops:0,maskVersion:127};
export function environmentArtStatus(){const terrain=terrainTileStatus(),theme=terrain.theme||latest.theme||'pixel';return {...latest,nightLighting:nightLightingStatus(),seasonalArtwork:{kind:'native-seasonal-terrain',coverage:'whole-island',version:187,enabled:true,theme,season:terrain.season,targetSeason:terrain.targetSeason,variants:SEASONS.map(season=>({season,regions:seasonalTerrain(theme,season).length,ready:terrain.season===season,previewReady:terrain.overview.ready.includes(season)}))}};}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function prepare(image,theme){if(fields.has(theme))return fields.get(theme);if(!image?.complete||!image.naturalWidth||pending.has(theme))return null;pending.add(theme);
 const work=()=>{try{const small=canvas(W/CELL,H/CELL),ctx=small.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#219fc3';ctx.fillRect(0,0,small.width,small.height);ctx.drawImage(image,0,0,MAP_EXTENT.width/CELL,MAP_EXTENT.height/CELL);const pixels=ctx.getImageData(0,0,small.width,small.height),f=buildEnvironmentGeometry(pixels.data,small.width,small.height,CELL),waterPath=new Path2D(),landPath=new Path2D();waterPath.rect(0,0,W,H);
  for(const points of f.loops){for(const path of [waterPath,landPath]){path.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))path.lineTo(p.x,p.y);path.closePath();}}
  const waterMask=canvas(W,H),wc=waterMask.getContext('2d');wc.fillStyle='#fff';wc.fill(waterPath,'evenodd');
  fields.set(theme,{...f,waterPath,landPath,waterMask});
 }finally{pending.delete(theme);}};
 if(typeof requestIdleCallback==='function')requestIdleCallback(work,{timeout:500});else setTimeout(work,0);return null;
}
function visible(p,v,margin=30){return p.x>=v.x-margin&&p.x<=v.x+v.w+margin&&p.y>=v.y-margin&&p.y<=v.y+v.h+margin;}
const fract=n=>n-Math.floor(n),hash=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
function crest(ctx,points,offset,time,pixel){if(points.length<8)return;ctx.beginPath();for(let i=0;i<points.length;i++){const p=points[i],wash=offset+1.7*Math.sin(i*.063+time*.55),x=p.x+p.nx*wash,y=p.y+p.ny*wash;if(i)ctx.lineTo(pixel?Math.round(x):x,pixel?Math.round(y):y);else ctx.moveTo(x,y);}ctx.closePath();ctx.stroke();}
const buffers=new WeakMap();
function oceanSurface(target,f,theme){let b=buffers.get(target.canvas);if(!b){b={wave:canvas(1,1),mask:canvas(1,1),key:''};buffers.set(target.canvas,b);}const width=target.canvas.width,height=target.canvas.height,matrix=target.getTransform();if(b.wave.width!==width||b.wave.height!==height){for(const c of [b.wave,b.mask]){c.width=width;c.height=height;}b.key='';}const key=[theme,width,height,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f].join('|');if(key!==b.key){const mask=b.mask.getContext('2d');mask.setTransform(1,0,0,1,0,0);mask.clearRect(0,0,width,height);mask.setTransform(matrix);mask.imageSmoothingEnabled=theme!=='pixel';mask.drawImage(f.waterMask,0,0);b.key=key;}const paint=b.wave.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,width,height);paint.setTransform(matrix);return {buffer:b,paint,target};}
function finishOcean(surface){const {buffer:b,paint,target}=surface;paint.save();paint.setTransform(1,0,0,1,0,0);paint.globalCompositeOperation='destination-in';paint.drawImage(b.mask,0,0);paint.restore();target.save();target.setTransform(1,0,0,1,0,0);target.drawImage(b.wave,0,0);target.restore();}
export function drawOceanMotion(ctx,image,theme,time,env){
 const f=prepare(image,theme),view=terrainViewport(ctx.getTransform(),ctx.canvas.width,ctx.canvas.height);if(!f||!view){latest={...latest,ready:false};return;}
 if(drawOceanShader(ctx,f,theme,time,env)){latest={ready:true,theme,ripples:230,waveLoops:3,coastLoops:f.coast.length,maskVersion:127,backend:'webgl2-worker',oceanWorker:oceanShaderStatus(ctx.canvas)};return;}
 if(drawCanvasOcean(ctx,f,theme,time,env,view)){
  const status=canvasOceanStatus(ctx.canvas);latest={ready:status.ready,theme,ripples:230,waveLoops:3,coastLoops:f.coast.length,maskVersion:127,backend:status.backend,oceanWorker:oceanShaderStatus(ctx.canvas),compatibleWorker:status};return;
 }
 const counts=renderCanvasOcean(ctx,f,theme,time,env,view);latest={ready:true,theme,...counts,maskVersion:127,backend:'canvas-compatible',oceanWorker:oceanShaderStatus(ctx.canvas)};
}
// Each season uses newly drawn blossoms, foliage or snow in the original high-resolution forest geometry.
export function drawSeasonTerrain(ctx,image,theme,env){prepare(image,theme);}
export function drawEnvironmentFront(ctx,image,theme,env,time,{slots=[],buildings=null,awakeResidents=[],occupiedBuildings=[],boats=[]}={}){
 const f=prepare(image,theme),pixel=theme==='pixel',view=terrainViewport(ctx.getTransform(),ctx.canvas.width,ctx.canvas.height),budget=weatherParticleBudget(env);drawWorldNightLighting(ctx,theme,env,time,{field:f,slots,buildings,awakeResidents,occupiedBuildings,boats});ctx.save();
 if(f&&view){ctx.save();for(let i=0,count={spring:180,summer:0,autumn:150,winter:budget.snow}[env.season];i<count;i++){const x=hash(i+17)*W+Math.sin(time*.28+i)*24+Math.sin(time*.09)*18,speed={spring:12,summer:2,autumn:17,winter:16}[env.season]+hash(i+99)*10,y=(hash(i+231)*H+time*speed)%H;if(!visible({x,y},view)||env.season!=='winter'&&f.isWater(x,y))continue;const size=2.1+hash(i+54)*1.8;ctx.save();ctx.translate(x,y);ctx.globalAlpha=env.transition??1;
   if(env.season==='winter'){ctx.globalAlpha=(.62+.24*Math.sin(time+i))*(env.transition??1);ctx.fillStyle='#eef8ff';if(pixel){ctx.fillRect(-size/2,-size*.9,size,size*1.8);ctx.fillRect(-size*.9,-size/2,size*1.8,size);}else{ctx.rotate(time*.08+i);ctx.strokeStyle='#eef8ff';ctx.lineWidth=.65;ctx.beginPath();for(let arm=0;arm<6;arm++){const a=arm*TAU/6;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*size,Math.sin(a)*size);const x=Math.cos(a)*size*.55,y=Math.sin(a)*size*.55;for(const side of [-1,1]){ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a+side*.85)*size*.33,y+Math.sin(a+side*.85)*size*.33);}}ctx.stroke();}}
   else if(env.season==='autumn'){ctx.rotate(Math.sin(time*.8+i)*1.1);ctx.fillStyle=i%2?'#d98036':'#edb951';ctx.beginPath();ctx.moveTo(-size*1.8,0);ctx.lineTo(0,-size);ctx.lineTo(size*1.8,0);ctx.lineTo(0,size);ctx.closePath();ctx.fill();ctx.strokeStyle='#9c653c88';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-size*1.8,0);ctx.lineTo(size*1.8,0);ctx.stroke();}
   else if(env.season==='spring'){ctx.rotate(time*.22+i+Math.sin(time*.75+i)*.65);ctx.fillStyle=i%2?'#f7c6dac9':'#ffe2ecd9';if(pixel){ctx.fillRect(-size,-size/2,size*1.5,size);ctx.fillRect(-size*.45,-size*.9,size*.7,size*.7);}else{ctx.beginPath();ctx.moveTo(-size,0);ctx.quadraticCurveTo(-size*.7,-size*1.2,size*.8,-size*.4);ctx.quadraticCurveTo(size*1.2,size*.7,-size,0);ctx.fill();ctx.strokeStyle='#fff2f2a0';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(-size*.5,0);ctx.lineTo(size*.65,-size*.2);ctx.stroke();}}
   ctx.restore();}ctx.restore();}
 if(f&&view)for(let i=0;i<budget.rain;i++){const p=rainParticle(i,time,W,H);if(!visible(p,view,12))continue;ctx.strokeStyle='rgba(224,242,251,'+p.alpha+')';ctx.lineWidth=pixel?1.5:1;ctx.beginPath();if(p.kind==='drop'){const x=pixel?Math.round(p.x):p.x,y=pixel?Math.round(p.y):p.y;ctx.moveTo(x,y);ctx.lineTo(x+p.length*.18,y+p.length);}else{if(!f.isWater(p.x,p.y))continue;if(pixel){ctx.moveTo(Math.round(p.x-p.radius),Math.round(p.y));ctx.lineTo(Math.round(p.x-1),Math.round(p.y-1));ctx.moveTo(Math.round(p.x+1),Math.round(p.y+1));ctx.lineTo(Math.round(p.x+p.radius),Math.round(p.y));}else ctx.ellipse(p.x,p.y,p.radius,p.radius*.35,0,0,TAU);}ctx.stroke();}
 latest={...latest,weather:env.weather?.id||'clear',rain:budget.rain,snow:budget.snow};ctx.restore();
}
