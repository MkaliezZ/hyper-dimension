import {PORTFOLIO_SITE} from './portfolioLandmark.js';
import {registerThemeArtwork} from './themeArtwork.js';
import {drawRaster} from './rasterQuality.js';
const art={};
for(const theme of ['pixel','origami']){const hall=new Image(),land=new Image();registerThemeArtwork(hall,'/assets/portfolio-v130/hall-'+theme+'.png',theme);registerThemeArtwork(land,'/assets/portfolio-v130/hall-land-'+theme+'.png',theme);art[theme]={hall,land};}
export function drawPortfolioLand(ctx,theme){const i=art[theme]?.land,p=PORTFOLIO_SITE.land;if(i?.complete&&i.naturalWidth)drawRaster(ctx,i,theme,p.x,p.y,p.w,p.h);}
export function drawPortfolioHall(ctx,theme,time){const i=art[theme]?.hall,p=PORTFOLIO_SITE.building;if(!i?.complete||!i.naturalWidth)return;ctx.save();ctx.fillStyle='#203e362c';ctx.beginPath();ctx.ellipse(p.x,p.y-3,p.w*.44,10,0,0,Math.PI*2);ctx.fill();drawRaster(ctx,i,theme,p.x-p.w/2,p.y-p.h,p.w,p.h);
 const board=PORTFOLIO_SITE.board;ctx.font=theme==='pixel'?'12px FusionPixel,monospace':'600 12px Microsoft YaHei,sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff2c7';ctx.strokeStyle='#4d6b5b';ctx.lineWidth=theme==='pixel'?2:1;ctx.fillRect(board.x-34,board.y+19,68,23);ctx.strokeRect(board.x-34,board.y+19,68,23);ctx.fillStyle='#305245';ctx.fillText('访客留言',board.x,board.y+35);ctx.fillStyle='#e8c575';ctx.globalAlpha=.4+.2*Math.sin(time*2);ctx.beginPath();ctx.arc(board.x+28,board.y+24,2,0,Math.PI*2);ctx.fill();ctx.restore();
}
export function portfolioArtStatus(theme){return{site:PORTFOLIO_SITE,loaded:!!art[theme]?.hall.complete&&!!art[theme]?.hall.naturalWidth&&!!art[theme]?.land.naturalWidth};}

