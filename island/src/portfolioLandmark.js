// One extra landmark; production parcels and building IDs stay stable.
export const PORTFOLIO_SITE=Object.freeze({
 land:{x:1300,y:280,w:544,h:400},
 building:{x:1582,y:485,w:240,h:176},entry:{x:1584,y:516},
 board:{x:1704,y:473,r:27},
 footprint:{x:1582,y:435,rx:109,ry:34}
});
export function portfolioConnectionPath(theme){return theme==='origami'?[{x:1308,y:510},{x:1370,y:510},{x:1420,y:510},{x:1470,y:500},{x:1545,y:501},{x:1582,y:515}]:[{x:1308,y:541},{x:1370,y:531},{x:1420,y:516},{x:1470,y:510},{x:1545,y:501},{x:1582,y:515}];}
function nearSegment(x,y,a,b,r=15){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<r;}
export function portfolioWalkable(x,y,theme='pixel'){
 const s=PORTFOLIO_SITE.land,u=(x-s.x)/s.w,v=(y-s.y)/s.h,path=portfolioConnectionPath(theme);
 return path.slice(1).some((b,i)=>nearSegment(x,y,path[i],b))||u>.33&&u<.71&&v>.44&&v<.65||u>.48&&u<.60&&v>.56&&v<.76;
}
export function portfolioBlocked(x,y){const p=PORTFOLIO_SITE.footprint;return Math.abs(x-p.x)<p.rx+9&&Math.abs(y-p.y)<p.ry+9;}
export function portfolioHit(x,y){const p=PORTFOLIO_SITE,b=p.building;if(Math.hypot(x-p.board.x,y-p.board.y)<p.board.r)return'guestbook';if(x>b.x-b.w/2&&x<b.x+b.w/2&&y>b.y-b.h&&y<b.y+8)return'gallery';return null;}
