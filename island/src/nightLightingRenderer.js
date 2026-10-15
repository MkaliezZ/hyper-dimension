import {WORLD,worldWalkableForTheme} from './world.js';
import {terrainViewport} from './mapTileLayout.js';
import {buildNightFixtures,moonRibbon} from './nightLighting.js';
import {clipHarborReflection} from './harbor.js';

const lamps=new Map(),moons=new Map(),TAU=Math.PI*2;
let latest={enabled:true,night:0,visibleFixtures:0,roomWindows:0,moonVisibility:0,moonStrips:0,worldOnly:true};
export const nightLightingStatus=()=>({...latest});
function makeCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function glow(theme){if(lamps.has(theme))return lamps.get(theme);const c=makeCanvas(96,96),g=c.getContext('2d');if(theme==='pixel'){for(let r=46;r>=2;r-=4){g.fillStyle='rgba(255,207,121,'+(.014+(1-r/48)**3*.075)+')';g.fillRect(48-r,48-r,r*2,r*2);}}else{const p=g.createRadialGradient(48,48,0,48,48,48);p.addColorStop(0,'#ffe8b2bb');p.addColorStop(.16,'#ffd48485');p.addColorStop(.45,'#efb46728');p.addColorStop(1,'#efb46700');g.fillStyle=p;g.fillRect(0,0,96,96);}lamps.set(theme,c);return c;}
function moonDisc(theme,phase){const bucket=Math.round(phase*40),key=theme+':'+bucket;if(moons.has(key))return moons.get(key);const c=makeCanvas(128,128),g=c.getContext('2d'),r=48,angle=bucket/40;
 g.fillStyle='#f3ecce';g.beginPath();if(theme==='pixel'){for(let y=-48;y<48;y+=4){const w=Math.floor(Math.sqrt(Math.max(0,r*r-y*y))/4)*4;g.rect(64-w,64+y,w*2,4);}}else for(let i=0;i<20;i++){const a=i*TAU/20;if(i)g.lineTo(64+Math.cos(a)*r,64+Math.sin(a)*r);else g.moveTo(64+r,64);}g.closePath();g.fill();
 const lit=.5-.5*Math.cos(angle*TAU);if(lit<.995){g.globalCompositeOperation='destination-out';g.beginPath();g.ellipse(64+(angle<.5?1:-1)*r*2*lit,64,r,r,0,0,TAU);g.fill();g.globalCompositeOperation='source-over';}
 g.globalCompositeOperation='source-atop';g.fillStyle='#cbd5d042';for(const[x,y,s]of [[48,48,12],[77,78,8],[79,45,6]]){if(theme==='pixel')g.fillRect(x,y,s,s/2);else{g.beginPath();g.ellipse(x,y,s,s*.55,0,0,TAU);g.fill();}}g.globalCompositeOperation='source-over';moons.set(key,c);if(moons.size>12)moons.delete(moons.keys().next().value);return c;
}
const visible=(x,y,v,r=30)=>x>=v.x-r&&x<=v.x+v.w+r&&y>=v.y-r&&y<=v.y+v.h+r;
function post(ctx,p,theme,night){ctx.save();ctx.fillStyle=night>.5?'#414b4e':'#716552';if(theme==='pixel'){ctx.fillRect(p.x-1,p.y+2,2,p.footY-p.y);ctx.fillRect(p.x-4,p.footY-1,8,2);ctx.fillStyle=night>.5?'#887054':'#b7986a';ctx.fillRect(p.x-3,p.y-4,6,8);ctx.fillStyle='#655d50';ctx.fillRect(p.x-4,p.y-6,8,2);}else{ctx.beginPath();ctx.moveTo(p.x-1.3,p.footY);ctx.lineTo(p.x-.7,p.y+2);ctx.lineTo(p.x+.7,p.y+2);ctx.lineTo(p.x+1.8,p.footY);ctx.closePath();ctx.fill();ctx.fillStyle=night>.5?'#aa8962':'#d3b78e';ctx.beginPath();ctx.moveTo(p.x-3,p.y-3);ctx.lineTo(p.x,p.y-5);ctx.lineTo(p.x+3,p.y-3);ctx.lineTo(p.x+2.4,p.y+3);ctx.lineTo(p.x,p.y+4);ctx.lineTo(p.x-2.4,p.y+3);ctx.closePath();ctx.fill();ctx.strokeStyle='#655d50';ctx.lineWidth=.7;ctx.stroke();}ctx.restore();}
// Environmental illumination applies only to the world canvas. DOM panels and
// controls retain their own palette; no overlay element can intercept input.
export function drawWorldNightLighting(ctx,theme,env,time,{field=null,boats=[],...options}={}){
 const view=terrainViewport(ctx.getTransform(),ctx.canvas.width,ctx.canvas.height);if(!view)return;
 const plan=buildNightFixtures(theme,env,options),{tone,moon}=plan;let visibleFixtures=0,roomWindows=0,moonStrips=0,posts=0;
 ctx.save();ctx.beginPath();ctx.rect(0,0,WORLD.width,WORLD.height);ctx.clip();
 if(tone.night>.001){ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgb('+tone.ambient.map(n=>Math.round(n*255)).join(',')+')';ctx.fillRect(view.x,view.y,view.w,view.h);ctx.restore();}
 // A moon image broken into horizontal water strips, plus a widening specular
 // path. It stays in world coordinates and is clipped by the connected ocean.
 if(field&&moon.visibility>.001){ctx.save();ctx.clip(field.waterPath,'evenodd');clipHarborReflection(ctx,boats,theme,time,{x:moon.x-101,y:moon.y-51,w:202,h:702});ctx.imageSmoothingEnabled=theme!=='pixel';const disc=moonDisc(theme,moon.phase),w=96,h=56;
  ctx.globalCompositeOperation='source-over';if(visible(moon.x,moon.y,view,70)){for(let y=0;y<128;y+=4){const wave=Math.sin(time*.85+y*.19)*1.8;ctx.globalAlpha=moon.visibility*(.82+.1*Math.sin(time*.45+y*.13));ctx.drawImage(disc,0,y,128,4,moon.x-w/2+wave,moon.y-h/2+y/128*h,w,h/32);moonStrips++;}}
  ctx.globalCompositeOperation='screen';ctx.globalAlpha=1;for(const r of moonRibbon(moon,time)){if(!visible(r.x,r.y,view)||!field.isWater(r.x,r.y))continue;ctx.fillStyle='rgba(242,237,211,'+r.alpha+')';if(theme==='pixel')ctx.fillRect(Math.round(r.x-r.w/2),Math.round(r.y),Math.round(r.w),Math.max(1,Math.round(r.h)));else{ctx.beginPath();ctx.moveTo(r.x-r.w/2,r.y);ctx.quadraticCurveTo(r.x,r.y-r.h*1.4,r.x+r.w/2,r.y);ctx.lineTo(r.x+r.w*.2,r.y+r.h);ctx.lineTo(r.x-r.w*.3,r.y+r.h*.65);ctx.closePath();ctx.fill();}moonStrips++;}ctx.restore();
 }
 for(const p of plan.lights){if(!visible(p.x,p.y,view,p.radius*2))continue;if(p.kind==='post'){if(!worldWalkableForTheme(theme,p.x,p.footY))continue;post(ctx,p,theme,tone.night);posts++;}if(p.gain<.015)continue;visibleFixtures++;if(p.kind==='window')roomWindows++;
  ctx.save();ctx.globalCompositeOperation='screen';const flicker=p.kind==='window'?1:1+Math.sin(time*1.1+p.x*.03)*.022;
  ctx.globalAlpha=Math.min(1,p.gain*flicker);const radius=p.kind==='pool'?p.radius:p.radius*1.3;ctx.drawImage(glow(theme),p.x-radius,p.y-radius*(p.kind==='pool'?.32:.85),radius*2,radius*(p.kind==='pool'?.64:1.7));
  if(p.kind!=='pool'){ctx.globalAlpha=p.gain*.85;ctx.fillStyle=p.kind==='window'?'#ffdc95':'#fff2cb';if(theme==='pixel')ctx.fillRect(Math.round(p.x-.7),Math.round(p.y-1.2),1.4,2.4);else{ctx.beginPath();ctx.ellipse(p.x,p.y,p.kind==='window'?.8:.9,p.kind==='window'?1.4:1.9,0,0,TAU);ctx.fill();}}
  if(p.kind==='beacon'&&field){ctx.clip(field.waterPath,'evenodd');ctx.translate(p.x,p.y);ctx.rotate(.75+Math.sin(time*.09)*1.05);const reach=330,beam=ctx.createLinearGradient(0,0,reach,0);beam.addColorStop(0,'#fff4c02a');beam.addColorStop(1,'#fff4c000');ctx.fillStyle=beam;ctx.globalAlpha=p.gain;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(reach,-reach*.1);ctx.lineTo(reach,reach*.1);ctx.closePath();ctx.fill();}
  ctx.restore();
 }
 ctx.restore();latest={enabled:true,night:tone.night,ambient:tone.ambient,weather:tone.weather,visibleFixtures,roomWindows,posts,moonVisibility:moon.visibility,moonStrips,moonPosition:{x:moon.x,y:moon.y},worldOnly:true,textureCache:{lights:lamps.size,moons:moons.size,reflectionPixels:0,occlusion:'cached-art-alpha-contours'}};
 return latest;
}
