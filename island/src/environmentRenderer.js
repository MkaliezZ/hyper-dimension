import {drawSeasonArtwork,seasonArtworkStatus} from './seasonArtwork.js';
import {drawOceanShader} from './oceanShader.js';
import {buildEnvironmentGeometry} from './environmentGeometry.js';
import {terrainViewport} from './mapTileLayout.js';
const W=1856,H=1248,CELL=4,fields=new Map(),pending=new Set(),TAU=Math.PI*2;
let latest={ready:false,ripples:0,waveLoops:0,maskVersion:127};
export function environmentArtStatus(){return {...latest,seasonalArtwork:seasonArtworkStatus(latest.theme)};}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function prepare(image,theme){if(fields.has(theme))return fields.get(theme);if(!image?.complete||!image.naturalWidth||pending.has(theme))return null;pending.add(theme);
 const work=()=>{try{const small=canvas(W/CELL,H/CELL),ctx=small.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#219fc3';ctx.fillRect(0,0,small.width,small.height);ctx.drawImage(image,0,0,W/CELL,1024/CELL);const pixels=ctx.getImageData(0,0,small.width,small.height),f=buildEnvironmentGeometry(pixels.data,small.width,small.height,CELL),waterPath=new Path2D(),landPath=new Path2D();waterPath.rect(0,0,W,H);
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
 if(drawOceanShader(ctx,f,theme,time,env)){latest={ready:true,theme,ripples:230,waveLoops:3,coastLoops:f.coast.length,maskVersion:127,backend:'webgl2'};return;}
 const pixel=theme==='pixel',surface=oceanSurface(ctx,f,theme);ctx=surface.paint;let ripples=0,waveLoops=0;ctx.save();
 // Three shoreward crests: translucent swell, bright breaking rim and dispersing foam.
 for(let band=0;band<3;band++){const progress=fract(time/6.8+band/3),offset=(1-progress)*27,alpha=Math.pow(Math.sin(progress*Math.PI),1.35);if(alpha<.02)continue;
  for(const full of f.coast){if(full.length<40)continue;const points=full.filter((_,i)=>i%4===0);if(!points.some(p=>visible(p,view,35)))continue;waveLoops++;ctx.strokeStyle='rgba(112,227,238,'+(alpha*.19)+')';ctx.lineWidth=pixel?6:8;crest(ctx,points,offset+3,time,pixel);ctx.strokeStyle='rgba(243,255,243,'+(alpha*(pixel?.34:.28))+')';ctx.lineWidth=pixel?1.6:1.2;crest(ctx,points,offset,time,pixel);ctx.strokeStyle='rgba(215,249,245,'+(alpha*.25)+')';ctx.lineWidth=.8;crest(ctx,points,offset-2,time,pixel);}
 }
 // World-anchored wavelets never restart when dragging, zooming or opening a room.
 for(let i=0;i<230;i++){const x=hash(i*3.1)*W+Math.sin(time*.24+i)*4,y=hash(i*5.3+2)*H+Math.sin(time*.36+i*.7)*1.8;if(!visible({x,y},view)||!f.isWater(x,y))continue;
  const pulse=Math.pow(Math.max(0,Math.sin(time*.82+i*2.31)),2),length=7+hash(i+4)*13,alpha=(.11+.24*pulse);ripples++;
  ctx.strokeStyle='rgba(225,251,248,'+alpha+')';ctx.lineWidth=pixel?1.7:1.1;ctx.beginPath();ctx.moveTo(x-length/2,y);if(pixel){ctx.lineTo(x-2,y);ctx.lineTo(x-2,y-1.5);ctx.lineTo(x+length/2,y-1.5);}else ctx.quadraticCurveTo(x,y-2.4,x+length/2,y-.9);ctx.stroke();
  if(!pixel&&pulse>.55){ctx.fillStyle='rgba(178,238,248,'+(pulse*.1)+')';ctx.beginPath();ctx.moveTo(x-length/2,y+2);ctx.lineTo(x+length/2,y+1);ctx.lineTo(x+length/3,y+5);ctx.closePath();ctx.fill();}
 }
 // Broken sunlight trails sample the same water mask as shoreline foam.
 const reflection='255,244,184';for(let i=0;i<68;i++){const y=70+i*17.2,x=1410+Math.sin(y*.016+time*.18)*45+Math.sin(i*5.1)*35;if(!visible({x,y},view)||!f.isWater(x,y))continue;const pulse=Math.max(0,Math.sin(time*1.1+i*1.73)),length=5+pulse*16;ctx.fillStyle='rgba('+reflection+','+(.07+pulse*.18)+')';if(pixel)ctx.fillRect(Math.round(x-length/2),Math.round(y),Math.round(length),1.4);else{ctx.beginPath();ctx.moveTo(x-length/2,y);ctx.lineTo(x,y-1.6);ctx.lineTo(x+length/2,y);ctx.lineTo(x,y+1.2);ctx.closePath();ctx.fill();}}
 ctx.restore();finishOcean(surface);latest={ready:true,theme,ripples,waveLoops,coastLoops:f.coast.length,maskVersion:127,backend:'canvas-compatible'};
}
// Each season uses newly drawn blossoms, foliage or snow in the original high-resolution forest geometry.
export function drawSeasonTerrain(ctx,image,theme,env){prepare(image,theme);drawSeasonArtwork(ctx,theme,env);}
export function drawEnvironmentFront(ctx,image,theme,env,time,{slots=[],buildings=null}={}){
 const f=prepare(image,theme),pixel=theme==='pixel',view=terrainViewport(ctx.getTransform(),ctx.canvas.width,ctx.canvas.height);ctx.save();
 if(f&&view){ctx.save();for(let i=0,count={spring:180,summer:68,autumn:150,winter:260}[env.season];i<count;i++){const x=hash(i+17)*W+Math.sin(time*.28+i)*24+Math.sin(time*.09)*18,speed={spring:12,summer:2,autumn:17,winter:16}[env.season]+hash(i+99)*10,y=(hash(i+231)*H+time*speed)%H;if(!visible({x,y},view)||env.season!=='winter'&&f.isWater(x,y))continue;const size=2.1+hash(i+54)*1.8;ctx.save();ctx.translate(x,y);ctx.globalAlpha=env.transition??1;
   if(env.season==='winter'){ctx.globalAlpha=(.62+.24*Math.sin(time+i))*(env.transition??1);ctx.fillStyle='#eef8ff';if(pixel){ctx.fillRect(-size/2,-size*.9,size,size*1.8);ctx.fillRect(-size*.9,-size/2,size*1.8,size);}else{ctx.rotate(time*.08+i);ctx.strokeStyle='#eef8ff';ctx.lineWidth=.65;ctx.beginPath();for(let arm=0;arm<6;arm++){const a=arm*TAU/6;ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*size,Math.sin(a)*size);const x=Math.cos(a)*size*.55,y=Math.sin(a)*size*.55;for(const side of [-1,1]){ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(a+side*.85)*size*.33,y+Math.sin(a+side*.85)*size*.33);}}ctx.stroke();}}
   else if(env.season==='autumn'){ctx.rotate(Math.sin(time*.8+i)*1.1);ctx.fillStyle=i%2?'#d98036':'#edb951';ctx.beginPath();ctx.moveTo(-size*1.8,0);ctx.lineTo(0,-size);ctx.lineTo(size*1.8,0);ctx.lineTo(0,size);ctx.closePath();ctx.fill();ctx.strokeStyle='#9c653c88';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-size*1.8,0);ctx.lineTo(size*1.8,0);ctx.stroke();}
   else if(env.season==='spring'){ctx.rotate(time*.22+i+Math.sin(time*.75+i)*.65);ctx.fillStyle=i%2?'#f7c6dac9':'#ffe2ecd9';if(pixel){ctx.fillRect(-size,-size/2,size*1.5,size);ctx.fillRect(-size*.45,-size*.9,size*.7,size*.7);}else{ctx.beginPath();ctx.moveTo(-size,0);ctx.quadraticCurveTo(-size*.7,-size*1.2,size*.8,-size*.4);ctx.quadraticCurveTo(size*1.2,size*.7,-size,0);ctx.fill();ctx.strokeStyle='#fff2f2a0';ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(-size*.5,0);ctx.lineTo(size*.65,-size*.2);ctx.stroke();}}
   ctx.restore();}ctx.restore();}
 ctx.restore();
}
