// One extra landmark; production parcels and building IDs stay stable.
export const PORTFOLIO_SITE=Object.freeze({
 land:{x:1444,y:338,w:400,h:300},
 building:{x:1652,y:468,w:208,h:153},entry:{x:1652,y:492},
 board:{x:1741,y:492,r:25},
 footprint:{x:1652,y:423,rx:93,ry:29}
});
export function portfolioConnectionPath(theme){return theme==='origami'?[{x:1308,y:451},{x:1360,y:476},{x:1440,y:480},{x:1535,y:510},{x:1652,y:512},{x:1652,y:492}]:[{x:1308,y:434},{x:1400,y:437},{x:1490,y:450},{x:1560,y:477},{x:1652,y:501},{x:1652,y:492}];}
export function portfolioCoastBlocked(theme,x,y){return x>1300&&y>350&&y<730;}
function nearSegment(x,y,a,b,r=17){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)||0));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<r;}
export function portfolioWalkable(x,y,theme='pixel'){
 const path=portfolioConnectionPath(theme);return path.slice(1).some((b,i)=>nearSegment(x,y,path[i],b))||Math.pow((x-1652)/73,2)+Math.pow((y-510)/37,2)<1;
}
export function portfolioBlocked(x,y){const p=PORTFOLIO_SITE.footprint;return Math.abs(x-p.x)<p.rx+9&&Math.abs(y-p.y)<p.ry+9;}
export function portfolioHit(x,y){const p=PORTFOLIO_SITE,b=p.building;if(Math.hypot(x-p.board.x,y-p.board.y)<p.board.r)return'guestbook';if(x>b.x-b.w/2&&x<b.x+b.w/2&&y>b.y-b.h&&y<b.y+8)return'gallery';return null;}
