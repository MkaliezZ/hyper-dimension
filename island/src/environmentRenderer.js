import {PORTFOLIO_SITE} from './portfolioLandmark.js';
import {portfolioLandImage} from './portfolioArt.js';
import {drawOceanShader} from './oceanShader.js';
import {terrainTileStatus} from './mapTiles.js';
import {buildEnvironmentGeometry} from './environmentGeometry.js';
import {terrainViewport} from './mapTileLayout.js';
const W=1856,H=1248,CELL=4,fields=new Map(),pending=new Set(),TAU=Math.PI*2;
let latest={ready:false,ripples:0,waveLoops:0,maskVersion:127};
export function environmentArtStatus(){return {...latest};}
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function prepare(image,theme){if(fields.has(theme))return fields.get(theme);const extraLand=portfolioLandImage(theme);if(!image?.complete||!image.naturalWidth||!extraLand?.complete||!extraLand.naturalWidth||pending.has(theme))return null;pending.add(theme);
 const work=()=>{try{const small=canvas(W/CELL,H/CELL),ctx=small.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,1536/CELL,1024/CELL);const land=PORTFOLIO_SITE.land;ctx.drawImage(extraLand,land.x/CELL,land.y/CELL,land.w/CELL,land.h/CELL);const pixels=ctx.getImageData(0,0,small.width,small.height),f=buildEnvironmentGeometry(pixels.data,small.width,small.height,CELL),waterPath=new Path2D(),landPath=new Path2D();waterPath.rect(0,0,W,H);
  for(const points of f.loops){for(const path of [waterPath,landPath]){path.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))path.lineTo(p.x,p.y);path.closePath();}}
  const waterMask=canvas(W,H),wc=waterMask.getContext('2d');wc.fillStyle='#fff';wc.fill(waterPath,'evenodd');
  const foliage=canvas(W,H),fc=foliage.getContext('2d',{willReadFrequently:true});fc.drawImage(image,0,0,1536,1024);fc.drawImage(extraLand,land.x,land.y,land.w,land.h);const original=fc.getImageData(0,0,W,H),fd=fc.createImageData(W,H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){const n=(y*W+x)*4,r=original.data[n],g=original.data[n+1],b=original.data[n+2];if(!f.isWater(x,y)&&g>r+5&&g>b+7&&g>38){fd.data[n]=fd.data[n+1]=fd.data[n+2]=255;fd.data[n+3]=Math.min(255,Math.max(0,(g-Math.max(r,b)-4)*13));}}
  fc.putImageData(fd,0,0);const seasons={};for(const [season,color]of Object.entries({spring:'#81b87b',summer:'#4d9a62',autumn:'#e89235',winter:'#e9f3ff'})){const c=canvas(foliage.width,foliage.height),pc=c.getContext('2d');pc.fillStyle=color;pc.fillRect(0,0,c.width,c.height);pc.globalCompositeOperation='destination-in';pc.drawImage(foliage,0,0);seasons[season]=c;}
  fields.set(theme,{...f,waterPath,landPath,waterMask,seasons,foliage});
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
  const pulse=Math.pow(Math.max(0,Math.sin(time*.82+i*2.31)),2),length=7+hash(i+4)*13,alpha=(.11+.24*pulse)*(1-env.night*.35);ripples++;
  ctx.strokeStyle='rgba(225,251,248,'+alpha+')';ctx.lineWidth=pixel?1.7:1.1;ctx.beginPath();ctx.moveTo(x-length/2,y);if(pixel){ctx.lineTo(x-2,y);ctx.lineTo(x-2,y-1.5);ctx.lineTo(x+length/2,y-1.5);}else ctx.quadraticCurveTo(x,y-2.4,x+length/2,y-.9);ctx.stroke();
  if(!pixel&&pulse>.55){ctx.fillStyle='rgba(178,238,248,'+(pulse*.1)+')';ctx.beginPath();ctx.moveTo(x-length/2,y+2);ctx.lineTo(x+length/2,y+1);ctx.lineTo(x+length/3,y+5);ctx.closePath();ctx.fill();}
 }
 // Broken sunlight / moonlight trails sample the same water mask as shoreline foam.
 const reflection=env.night>.5?'210,230,255':'255,244,184';for(let i=0;i<68;i++){const y=70+i*17.2,x=1410+Math.sin(y*.016+time*.18)*45+Math.sin(i*5.1)*35;if(!visible({x,y},view)||!f.isWater(x,y))continue;const pulse=Math.max(0,Math.sin(time*1.1+i*1.73)),length=5+pulse*16;ctx.fillStyle='rgba('+reflection+','+(.07+pulse*.18)+')';if(pixel)ctx.fillRect(Math.round(x-length/2),Math.round(y),Math.round(length),1.4);else{ctx.beginPath();ctx.moveTo(x-length/2,y);ctx.lineTo(x,y-1.6);ctx.lineTo(x+length/2,y);ctx.lineTo(x,y+1.2);ctx.closePath();ctx.fill();}}
 ctx.restore();finishOcean(surface);latest={ready:true,theme,ripples,waveLoops,coastLoops:f.coast.length,maskVersion:127,backend:'canvas-compatible'};
}
const seasonBuffers=new WeakMap();
export function drawSeasonTerrain(ctx,image,theme,env){const f=prepare(image,theme);if(!f)return;const matrix=ctx.getTransform(),width=ctx.canvas.width,height=ctx.canvas.height,transition=env.transition??1,key=[theme,width,height,matrix.a,matrix.b,matrix.c,matrix.d,matrix.e,matrix.f,terrainTileStatus().redraws,env.season,env.previousSeason,Math.floor(transition*24)].join('|');let b=seasonBuffers.get(ctx.canvas);if(!b){b={paint:canvas(width,height),mask:canvas(width,height),key:''};seasonBuffers.set(ctx.canvas,b);}if(b.paint.width!==width||b.paint.height!==height){for(const c of [b.paint,b.mask]){c.width=width;c.height=height;}b.key='';}
 if(key!==b.key){const paint=b.paint.getContext('2d'),mask=b.mask.getContext('2d');paint.setTransform(1,0,0,1,0,0);paint.clearRect(0,0,width,height);paint.globalAlpha=1;paint.globalCompositeOperation='source-over';paint.drawImage(ctx.canvas,0,0);paint.setTransform(matrix);paint.imageSmoothingEnabled=theme!=='pixel';for(const [season,weight]of [[env.previousSeason||env.season,1-transition],[env.season,transition]]){if(weight<=0)continue;paint.globalAlpha={spring:.18,summer:.34,autumn:.96,winter:.9}[season]*weight;paint.globalCompositeOperation='color';paint.drawImage(f.seasons[season],0,0,W,H);if(season==='winter'){paint.globalCompositeOperation='screen';paint.globalAlpha=.21*weight;paint.drawImage(f.seasons[season],0,0,W,H);}}
 mask.setTransform(1,0,0,1,0,0);mask.clearRect(0,0,width,height);mask.setTransform(matrix);mask.imageSmoothingEnabled=theme!=='pixel';mask.drawImage(f.foliage,0,0,W,H);paint.setTransform(1,0,0,1,0,0);paint.globalAlpha=1;paint.globalCompositeOperation='destination-in';paint.drawImage(b.mask,0,0);b.key=key;}
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(b.paint,0,0);ctx.restore();}
const glowSheets=new Map();
function glow(ctx,x,y,radius,strength,pixel){const key=pixel?'pixel':'origami';let image=glowSheets.get(key);if(!image){image=canvas(96,64);const paint=image.getContext('2d');if(pixel){for(let ring=5;ring>=1;ring--){paint.fillStyle='rgba(255,187,99,.028)';paint.beginPath();paint.ellipse(48,32,47*ring/5,30*ring/5,0,0,TAU);paint.fill();}}else{const g=paint.createRadialGradient(48,32,0,48,32,47);g.addColorStop(0,'rgba(255,207,129,.30)');g.addColorStop(.35,'rgba(255,179,84,.12)');g.addColorStop(1,'rgba(255,167,79,0)');paint.fillStyle=g;paint.fillRect(0,0,96,64);}glowSheets.set(key,image);}ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=strength;ctx.imageSmoothingEnabled=!pixel;ctx.drawImage(image,x-radius,y-radius*.67,radius*2,radius*1.34);ctx.restore();}
export function drawEnvironmentFront(ctx,image,theme,env,time,{slots=[],buildings=null}={}){
 const f=prepare(image,theme),pixel=theme==='pixel',view=terrainViewport(ctx.getTransform(),ctx.canvas.width,ctx.canvas.height);ctx.save();
 if(env.night>.015){ctx.fillStyle='rgba(17,30,66,'+(env.night*.44)+')';ctx.fillRect(0,0,W,H);}if(env.dawn+env.dusk>.02){ctx.fillStyle='rgba(245,158,101,'+((env.dawn+env.dusk)*.13)+')';ctx.fillRect(0,0,W,H);}if(env.season==='summer'){ctx.fillStyle='rgba(255,227,152,'+(env.daylight*.024)+')';ctx.fillRect(0,0,W,H);}
 if(env.night>.1){for(const s of slots){if(buildings&&buildings[s.id]===undefined||view&&!visible(s,view,100))continue;glow(ctx,s.entry?.x||s.x,(s.entry?.y||s.y)-9,30,env.night,pixel);}for(const [x,y]of [[1195,828],[1417,909],[1557,933],[1535,474],[1582,469],[1635,474],[1704,473],[692,316],[882,316],[679,625],[895,625]])if(!view||visible({x,y},view,75))glow(ctx,x,y,45,env.night,pixel);
  const lighthouse=slots.find(s=>s.id===8);if(lighthouse&&(!view||visible(lighthouse,view,450))){ctx.save();ctx.translate(lighthouse.x,lighthouse.y-26);ctx.rotate(Math.sin(time*.17)*.55+.3);ctx.fillStyle='rgba(255,236,167,'+(env.night*.045)+')';ctx.beginPath();ctx.moveTo(0,0);ctx.arc(0,0,320,-.075,.075);ctx.closePath();ctx.fill();ctx.restore();}
 }
 if(f&&view){ctx.save();for(let i=0;i<54;i++){const x=hash(i+17)*W+Math.sin(time*.28+i)*24,y=fract(hash(i+231)+time*({spring:.018,summer:.004,autumn:.012,winter:.024}[env.season])/10)*H;if(!visible({x,y},view)||f.isWater(x,y))continue;const size=1.4+hash(i+54)*1.7;ctx.save();ctx.translate(x,y);ctx.globalAlpha=env.transition??1;
   if(env.season==='winter'){ctx.globalAlpha=(.62+.24*Math.sin(time+i))*(env.transition??1);ctx.fillStyle='#eef8ff';if(pixel){ctx.fillRect(-size/2,-size/2,size,size);}else{ctx.rotate(.7);ctx.fillRect(-size/2,-size/2,size,size);}}
   else if(env.season==='autumn'){ctx.rotate(Math.sin(time*.8+i)*1.1);ctx.fillStyle=i%2?'#d98036':'#edb951';ctx.beginPath();ctx.moveTo(-size*1.8,0);ctx.lineTo(0,-size);ctx.lineTo(size*1.8,0);ctx.lineTo(0,size);ctx.closePath();ctx.fill();ctx.strokeStyle='#9c653c88';ctx.lineWidth=.65;ctx.beginPath();ctx.moveTo(-size*1.8,0);ctx.lineTo(size*1.8,0);ctx.stroke();}
   else if(env.season==='spring'){ctx.rotate(time*.22+i);ctx.fillStyle=i%2?'#f7c6daaa':'#ffe2ecb0';if(pixel)ctx.fillRect(-size,-size/2,size*2,size);else{ctx.beginPath();ctx.ellipse(0,0,size,size*.6,0,0,TAU);ctx.fill();}}
   else if(env.night>.1){const a=Math.max(0,Math.sin(time*1.6+i*1.8));ctx.fillStyle='rgba(233,252,161,'+(a*env.night*.8)+')';ctx.fillRect(-1,-1,2,2);}
   ctx.restore();}ctx.restore();}
 ctx.restore();
}
