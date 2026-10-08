// One extra landmark; production parcels and building IDs stay stable.
export const PORTFOLIO_SITE=Object.freeze({
 land:{x:1444,y:338,w:400,h:300},
 building:{x:1652,y:492,w:208,h:153},entry:{x:1652,y:515},
 board:{x:1741,y:483,r:25},
 footprint:{x:1652,y:447,rx:93,ry:29}
});
export function portfolioBridge(theme){return {from:theme==='origami'?{x:1414,y:505}:{x:1423,y:560},to:theme==='origami'?{x:1544,y:497}:{x:1537,y:492},width:28};}
export function portfolioConnectionPath(theme){const b=portfolioBridge(theme);return [...(theme==='origami'?[{x:1308,y:508},{x:1370,y:507}]:[{x:1308,y:545},{x:1370,y:556}]),b.from,b.to,{x:1593,y:498},{x:1652,y:515}];}
export function portfolioCoastBlocked(theme,x,y){return theme==='origami'?x>1416&&x<1530&&y>448&&y<558:x>1425&&x<1520&&y>507&&y<636;}
function nearSegment(x,y,a,b,r=15){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<r;}
export function portfolioWalkable(x,y,theme='pixel'){
 const s=PORTFOLIO_SITE.land,u=(x-s.x)/s.w,v=(y-s.y)/s.h,path=portfolioConnectionPath(theme);
 return path.slice(1).some((b,i)=>nearSegment(x,y,path[i],b))||u>.33&&u<.71&&v>.44&&v<.65||u>.48&&u<.60&&v>.56&&v<.76;
}
export function portfolioBlocked(x,y){const p=PORTFOLIO_SITE.footprint;return Math.abs(x-p.x)<p.rx+9&&Math.abs(y-p.y)<p.ry+9;}
export function portfolioHit(x,y){const p=PORTFOLIO_SITE,b=p.building;if(Math.hypot(x-p.board.x,y-p.board.y)<p.board.r)return'guestbook';if(x>b.x-b.w/2&&x<b.x+b.w/2&&y>b.y-b.h&&y<b.y+8)return'gallery';return null;}
