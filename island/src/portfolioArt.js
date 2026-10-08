import {PORTFOLIO_SITE} from './portfolioLandmark.js';
import {registerThemeArtwork} from './themeArtwork.js';
import {drawRaster} from './rasterQuality.js';
const art={};
for(const theme of ['pixel','origami']){const hall=new Image(),land=new Image();registerThemeArtwork(hall,'/assets/portfolio-v130/hall-'+theme+'.png',theme);registerThemeArtwork(land,'/assets/portfolio-v131/hall-land-'+theme+(theme==='pixel'?'-entry':'')+'.png',theme);art[theme]={hall,land};}
const projectedLand=new Map();
// Align the coastal path to the mainland before bending into the gallery court.
// Build and mask once; the game loop only draws the cached surface.
const profiles={origami:[[0,580,510],[100,580,510],[200,565,510],[300,540,510],[400,524,506],[500,554,500],[600,590,501],[700,620,508]]};
function entryOffset(theme,x,height){if(theme==='pixel'){const t=Math.max(0,Math.min(1,(x-225)/475));return 60*(1-t*t*(3-2*t));}const points=profiles[theme],last=points.at(-1);if(x>=last[0])return 0;const i=points.findIndex(p=>p[0]>x),a=points[Math.max(0,i-1)],b=points[i];const t=(x-a[0])/(b[0]-a[0]),sourceY=a[1]+(b[1]-a[1])*t,worldY=a[2]+(b[2]-a[2])*t;return (worldY-PORTFOLIO_SITE.land.y)*height/PORTFOLIO_SITE.land.h-sourceY;}
export function portfolioLandImage(theme){const source=art[theme]?.land;if(!source?.complete||!source.naturalWidth)return null;let surface=projectedLand.get(theme);if(surface)return surface;
 surface=document.createElement('canvas');surface.width=source.naturalWidth;surface.height=source.naturalHeight;const paint=surface.getContext('2d'),height=surface.height;paint.imageSmoothingEnabled=theme!=='pixel';
 for(let x=0;x<surface.width;x+=4){const w=Math.min(4,surface.width-x),raw=entryOffset(theme,x+w/2,height),dy=theme==='pixel'?Math.round(raw/2)*2:raw;paint.drawImage(source,x,0,w,height,x,dy,w,height);}
 // Keep the original parcel border and vegetation visible at the shared join.
 paint.globalCompositeOperation='destination-in';const mask=paint.createLinearGradient(96,0,170,0);mask.addColorStop(0,'#0000');mask.addColorStop(1,'#000');paint.fillStyle=mask;paint.fillRect(0,0,surface.width,height);
 surface.complete=true;surface.naturalWidth=surface.width;surface.naturalHeight=surface.height;projectedLand.set(theme,surface);return surface;
}
export function drawPortfolioLand(ctx,theme){const i=portfolioLandImage(theme),p=PORTFOLIO_SITE.land;if(i)drawRaster(ctx,i,theme,p.x,p.y,p.w,p.h);}
export function drawPortfolioHall(ctx,theme,time){const i=art[theme]?.hall,p=PORTFOLIO_SITE.building;if(!i?.complete||!i.naturalWidth)return;ctx.save();ctx.fillStyle='#203e362c';ctx.beginPath();ctx.ellipse(p.x,p.y-3,p.w*.44,10,0,0,Math.PI*2);ctx.fill();drawRaster(ctx,i,theme,p.x-p.w/2,p.y-p.h,p.w,p.h);
 const board=PORTFOLIO_SITE.board;ctx.font=theme==='pixel'?'12px FusionPixel,monospace':'600 12px Microsoft YaHei,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff2c7';ctx.strokeStyle='#4d6b5b';ctx.lineWidth=theme==='pixel'?2:1;ctx.fillRect(board.x-34,board.y+19,68,23);ctx.strokeRect(board.x-34,board.y+19,68,23);ctx.fillStyle='#305245';ctx.fillText('访客留言',board.x,board.y+35);ctx.fillStyle='#e8c575';ctx.globalAlpha=.4+.2*Math.sin(time*2);ctx.beginPath();ctx.arc(board.x+28,board.y+24,2,0,Math.PI*2);ctx.fill();ctx.restore();
}
export function portfolioArtStatus(theme){return{site:PORTFOLIO_SITE,loaded:!!art[theme]?.hall.complete&&!!art[theme]?.hall.naturalWidth&&!!art[theme]?.land.naturalWidth};}
