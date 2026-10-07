// Artwork anchors are calibrated in the original transparent sprite coordinates.
// Logical pier, queue and passenger routes remain in their existing save space.
export const GANGWAY_ART={
 origami:{start:{x:310,y:425},end:{x:1260,y:688},verticalScale:.1,foreground:[[158,328],[274,328],[274,414],[470,493],[760,580],[1020,641],[1132,658],[1132,577],[1260,577],[1273,845],[0,845],[0,328]]},
 pixel:{start:{x:253,y:457},end:{x:1336,y:726},verticalScale:.095,foreground:[[140,345],[218,345],[218,413],[460,517],[740,603],[1030,670],[1229,689],[1229,594],[1345,594],[1360,880],[0,880],[0,345]]}
};
export const FERRY_ART={offsetX:45,width:200,height:134,top:-131,frameHeight:.96};
export function ferryBob(boat,time){return Math.sin(time*1.8+boat.id)*(boat.phase==='moored'?.45:1.8)}
export function gangwayPlacement(theme,harbor,boat,pose,time){
 if(boat.phase!=='moored')return null;
 const art=GANGWAY_ART[theme],vx=harbor.ship.x-harbor.boarding.x,vy=harbor.ship.y-harbor.boarding.y,length=Math.hypot(vx,vy),ux=vx/length,uy=vy/length;
 // End shoes overlap solid deck on both sides; passenger anchors stay inside the painted walkway.
 const a={x:harbor.boarding.x-ux*13,y:harbor.boarding.y-uy*13},b={x:harbor.ship.x+ux*6+pose.x-harbor.berth.x,y:harbor.ship.y+uy*6+pose.y-harbor.berth.y+ferryBob(boat,time)};
 const dx=art.end.x-art.start.x,dy=art.end.y-art.start.y,sx=(b.x-a.x)/dx,sy=art.verticalScale,shear=(b.y-a.y-sy*dy)/dx;
 return {a,b,matrix:[sx,shear,0,sy,a.x-sx*art.start.x,a.y-shear*art.start.x-sy*art.start.y],foreground:art.foreground};
}
