import {drawItem} from './artStore.js';
const images=new Map();
export function marketStalls(s){const g=s.festivalParty?.session;if(g?.phase!=='running')return[];return g.layout.staff.slice(0,3).map((p,station)=>({x:p.x,y:p.y-18,station}));}
export function drawMarketStall(ctx,p,s,theme,now){
 const file='/assets/market-stall-'+theme+'-v87.png';if(!images.has(file)){const im=new Image();im.src=file;images.set(file,im);}
 const im=images.get(file);if(!im.complete||!im.naturalWidth)return;
 const h=100,w=h*im.naturalWidth/im.naturalHeight;ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.fillStyle='#344e4930';ctx.beginPath();ctx.ellipse(p.x,p.y,w*.37,8,0,0,Math.PI*2);ctx.fill();ctx.drawImage(im,p.x-w/2,p.y-h,w,h);
 const id=s.festivalParty.session.game.layout[p.station];drawItem(ctx,id,theme,p.x,p.y-40,27);ctx.fillStyle='rgba(255,231,156,'+(.28+.15*Math.sin(now*2+p.station))+')';ctx.beginPath();ctx.arc(p.x-w*.24,p.y-h*.62,2.3,0,Math.PI*2);ctx.fill();ctx.restore();
}
