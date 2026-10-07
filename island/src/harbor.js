import {registerThemeArtwork} from './themeArtwork.js';
import {createBoatVisualMotion} from './boatVisualMotion.js';
import {drawRaster,drawIslandRaster} from './rasterQuality.js';
import {HARBOR,WORLD,MAP_EXTENT} from './world.js';
const boatVisualMotion=createBoatVisualMotion(HARBOR);
const boatSheets={pixel:new Image(),origami:new Image()};for(const t of ['pixel','origami'])registerThemeArtwork(boatSheets[t],'/assets/boats-'+t+'-v4.png',t);
const seaSheets={pixel:new Image(),origami:new Image()},dockSheets={pixel:new Image(),origami:new Image()};
for(const t of ['pixel','origami']){registerThemeArtwork(seaSheets[t],'/assets/sea-'+t+'-v5.png',t);registerThemeArtwork(dockSheets[t],'/assets/dock-'+t+'-v17.png',t)}
// Preserve the original island anchors; the artwork worker feathers only the ocean rim.
export function drawIsland(ctx,map,theme){if(map.complete&&map.naturalWidth)drawIslandRaster(ctx,map,theme,MAP_EXTENT,0,0,MAP_EXTENT.width,MAP_EXTENT.height);}
export function drawOuterSea(ctx,map,theme,time){const im=seaSheets[theme];if(im.complete&&im.naturalWidth)drawRaster(ctx,im,theme,0,0,WORLD.width,WORLD.height);else{ctx.fillStyle='#0c94c3';ctx.fillRect(0,0,WORLD.width,WORLD.height)}ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle='#d9f8ec';ctx.lineWidth=theme==='pixel'?2:1;for(let i=0;i<40;i++){const x=1538+(i*43)%310,y=18+(i*79)%WORLD.height+Math.sin(time+i)*2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12,y-1);ctx.stroke()}for(let i=0;i<18;i++){const x=i*109,y=1070+(i*53)%162;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+14,y-1+Math.sin(time+i));ctx.stroke()}ctx.restore();}
export function drawHarbor(ctx,theme,time){const im=dockSheets[theme];if(im.complete&&im.naturalWidth){drawRaster(ctx,im,theme,1100,750,510,340)}ctx.save();ctx.globalAlpha=.20;ctx.fillStyle='#fce2a1';for(const [x,y] of [[1195,828],[1417,909],[1557,933]]){ctx.beginPath();ctx.ellipse(x,y,3+Math.sin(time*2+x)*.6,4,0,0,Math.PI*2);ctx.fill()}ctx.restore();}
export function drawBoats(ctx,boats,theme,time){const im=boatSheets[theme];if(!im.complete||!im.naturalWidth)return;boatVisualMotion.retain(boats);const cw=im.naturalWidth/2,ch=im.naturalHeight/2;for(const b of boats){const pose=boatVisualMotion.sample(b,time),leaving=b.phase==='leaving',y=pose.y+Math.sin(time*1.8+b.id)*1.8;ctx.save();ctx.globalAlpha=.24;ctx.fillStyle='#11496d';ctx.beginPath();ctx.ellipse(pose.x,y+4,85,12,0,0,Math.PI*2);ctx.fill();ctx.restore();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.drawImage(im,leaving?cw:0,0,cw,ch,pose.x-100,y-131,200,134);if(b.phase==='moored')drawGangway(ctx,theme);if(b.phase!=='moored'){ctx.strokeStyle='#d8f4e688';ctx.lineWidth=2;for(let i=0;i<4;i++){const x=pose.x+(leaving?-1:1)*(86+i*10);ctx.beginPath();ctx.moveTo(x,y-5-i*2);ctx.lineTo(x+12,y-6-i*2);ctx.stroke()}}}}

// A visible gangway spans the exact route between pier opening and ship deck.
function drawGangway(ctx,theme){
 const a=HARBOR.boarding,b=HARBOR.ship,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),nx=-dy/d,ny=dx/d,w=14;
 const poly=(offset=0)=>{ctx.beginPath();ctx.moveTo(a.x+nx*w,a.y+ny*w+offset);ctx.lineTo(b.x+nx*w,b.y+ny*w+offset);ctx.lineTo(b.x-nx*w,b.y-ny*w+offset);ctx.lineTo(a.x-nx*w,a.y-ny*w+offset);ctx.closePath();};
 ctx.save();poly(4);ctx.fillStyle=theme==='pixel'?'#705238':'#8e6847';ctx.fill();poly();
 ctx.fillStyle=theme==='pixel'?'#d9a861':'#dcb879';ctx.strokeStyle='#805b3b';ctx.lineWidth=1.2;ctx.fill();ctx.stroke();
 for(let i=1;i<7;i++){const t=i/7,x=a.x+dx*t,y=a.y+dy*t;ctx.beginPath();ctx.moveTo(x-nx*12,y-ny*12);ctx.lineTo(x+nx*12,y+ny*12);ctx.strokeStyle=theme==='pixel'?'#b48047':'#ba975f';ctx.stroke();}
 for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(a.x+side*nx*14,a.y+side*ny*14-8);ctx.lineTo(b.x+side*nx*14,b.y+side*ny*14-8);ctx.strokeStyle='#efe1ae';ctx.lineWidth=2;ctx.stroke();for(const p of [a,b]){ctx.fillStyle='#926737';ctx.fillRect(p.x+side*nx*14-1.5,p.y+side*ny*14-9,3,10);}}
 ctx.restore();
}
