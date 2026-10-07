import {registerThemeArtwork} from './themeArtwork.js';
import {createBoatVisualMotion} from './boatVisualMotion.js';
import {drawRaster,drawIslandRaster} from './rasterQuality.js';
import {HARBOR,WORLD,MAP_EXTENT} from './world.js';
import {FERRY_ART,ferryBob,gangwayPlacement} from './harborArtwork.js';
const boatVisualMotion=createBoatVisualMotion(HARBOR);
const boatSheets={pixel:new Image(),origami:new Image()};for(const t of ['pixel','origami'])registerThemeArtwork(boatSheets[t],'/assets/boats-'+t+'-v4.png',t);
const seaSheets={pixel:new Image(),origami:new Image()},dockSheets={pixel:new Image(),origami:new Image()};
for(const t of ['pixel','origami']){registerThemeArtwork(seaSheets[t],'/assets/sea-'+t+'-v5.png',t);registerThemeArtwork(dockSheets[t],'/assets/dock-'+t+'-v17.png',t)}
const gangwaySheets={pixel:new Image(),origami:new Image()};
for(const theme of ['pixel','origami'])registerThemeArtwork(gangwaySheets[theme],'/assets/gangway-'+theme+'-v109.png',theme);
// Preserve the original island anchors; the artwork worker feathers only the ocean rim.
export function drawIsland(ctx,map,theme){if(map.complete&&map.naturalWidth)drawIslandRaster(ctx,map,theme,MAP_EXTENT,0,0,MAP_EXTENT.width,MAP_EXTENT.height);}
export function drawOuterSea(ctx,map,theme,time){const im=seaSheets[theme];if(im.complete&&im.naturalWidth)drawRaster(ctx,im,theme,0,0,WORLD.width,WORLD.height);else{ctx.fillStyle='#0c94c3';ctx.fillRect(0,0,WORLD.width,WORLD.height)}ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle='#d9f8ec';ctx.lineWidth=theme==='pixel'?2:1;for(let i=0;i<40;i++){const x=1538+(i*43)%310,y=18+(i*79)%WORLD.height+Math.sin(time+i)*2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12,y-1);ctx.stroke()}for(let i=0;i<18;i++){const x=i*109,y=1070+(i*53)%162;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+14,y-1+Math.sin(time+i));ctx.stroke()}ctx.restore();}
export function drawHarbor(ctx,theme,time){const im=dockSheets[theme];if(im.complete&&im.naturalWidth){drawRaster(ctx,im,theme,1100,750,510,340)}ctx.save();ctx.globalAlpha=.20;ctx.fillStyle='#fce2a1';for(const [x,y] of [[1195,828],[1417,909],[1557,933]]){ctx.beginPath();ctx.ellipse(x,y,3+Math.sin(time*2+x)*.6,4,0,0,Math.PI*2);ctx.fill()}ctx.restore();}
export function drawBoats(ctx,boats,theme,time){
 const im=boatSheets[theme];if(!im.complete||!im.naturalWidth)return;
 boatVisualMotion.retain(boats);const cw=im.naturalWidth/2,ch=im.naturalHeight/2;
 for(const b of boats){
  const pose=boatVisualMotion.sample(b,time),leaving=b.phase==='leaving',x=pose.x+FERRY_ART.offsetX,y=pose.y+ferryBob(b,time);
  ctx.save();ctx.globalAlpha=.24;ctx.fillStyle='#11496d';ctx.beginPath();ctx.ellipse(x,y+4,85,12,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';
  // The next atlas row starts slightly above the half-image seam: exclude its mast tip.
  ctx.drawImage(im,leaving?cw:0,0,cw,ch*FERRY_ART.frameHeight,x-100,y+FERRY_ART.top,FERRY_ART.width,FERRY_ART.height*FERRY_ART.frameHeight);ctx.restore();
  drawGangway(ctx,theme,b,pose,time,false);
  if(b.phase!=='moored'){ctx.save();ctx.strokeStyle='#d8f4e688';ctx.lineWidth=2;for(let i=0;i<4;i++){const wx=x+(leaving?-1:1)*(86+i*10);ctx.beginPath();ctx.moveTo(wx,y-5-i*2);ctx.lineTo(wx+12,y-6-i*2);ctx.stroke()}ctx.restore()}
 }
}
function drawGangway(ctx,theme,boat,pose,time,foreground){
 const image=gangwaySheets[theme],placement=gangwayPlacement(theme,HARBOR,boat,pose,time);
 if(!placement||!image.complete||!image.naturalWidth)return;
 ctx.save();ctx.transform(...placement.matrix);ctx.imageSmoothingEnabled=theme!=='pixel';
 if(foreground){const points=placement.foreground;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();}
 ctx.drawImage(image,0,0);ctx.restore();
}
// Near ropes and timber fascia must cover passengers' feet, while the far rail stays behind them.
export function drawHarborForeground(ctx,boats,theme,time){
 for(const boat of boats)if(boat.phase==='moored')drawGangway(ctx,theme,boat,{x:boat.x,y:boat.y},time,true);
}
