// One extra landmark; production parcels and building IDs stay stable.
export const PORTFOLIO_SITE=Object.freeze({land:{x:2000,y:660,w:260,h:250},building:{x:2129.01,y:785.42,w:208,h:153},entry:{x:2124,y:804},board:{x:2212,y:802,r:25},footprint:{x:2129.01,y:763,rx:84,ry:20}});
export function portfolioConnectionPath(){return [{x:1944,y:804},{x:2028,y:816},PORTFOLIO_SITE.entry];}
export function portfolioCoastBlocked(){return false;}
function nearSegment(x,y,a,b,r=17){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)||0));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<r;}
export function portfolioWalkable(){return false;}
export function portfolioBlocked(x,y){const p=PORTFOLIO_SITE.footprint;return Math.abs(x-p.x)<p.rx+9&&Math.abs(y-p.y)<p.ry+9;}
export function portfolioHit(x,y){const p=PORTFOLIO_SITE,b=p.building;if(Math.hypot(x-p.board.x,y-p.board.y)<p.board.r)return'guestbook';if(x>b.x-b.w/2&&x<b.x+b.w/2&&y>b.y-b.h&&y<b.y+8)return'gallery';return null;}
