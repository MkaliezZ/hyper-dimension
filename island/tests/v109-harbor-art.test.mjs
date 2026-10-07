import test from 'node:test';import assert from 'node:assert/strict';import {GANGWAY_ART,FERRY_ART,gangwayPlacement,ferryBob} from '../src/harborArtwork.js';import {HARBOR_LAYOUTS} from '../src/world.js';
const map=(m,p)=>({x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]});
for(const theme of ['pixel','origami'])test(theme+' boarding artwork stays attached to the fixed pier and floating ferry, without changing passenger routes',()=>{
 const h=HARBOR_LAYOUTS[theme],original=structuredClone(h),boat={id:1,phase:'moored',...h.berth},art=GANGWAY_ART[theme];let prior=null;
 for(let i=0;i<120;i++){
  const t=i/60,p=gangwayPlacement(theme,h,boat,h.berth,t),a=map(p.matrix,art.start),b=map(p.matrix,art.end);
  assert(Math.hypot(a.x-p.a.x,a.y-p.a.y)<1e-8);assert(Math.hypot(b.x-p.b.x,b.y-p.b.y)<1e-8);
  const vx=b.x-a.x,vy=b.y-a.y,n=vx*vx+vy*vy;
  for(const anchor of [h.boarding,h.ship]){const u=((anchor.x-a.x)*vx+(anchor.y-a.y)*vy)/n;assert(u>0&&u<1,'logical passenger anchors must land inside the two end shoes');assert(Math.abs((anchor.x-a.x)*vy-(anchor.y-a.y)*vx)/Math.sqrt(n)<.5,'route feet remain centred on painted decking');}
  if(prior){assert(Math.hypot(a.x-prior.a.x,a.y-prior.a.y)<1e-8,'shore hinge must not drift with the boat');assert(Math.abs(b.y-prior.b.y)<.02,'ship hinge must move continuously');}prior={a,b};
  assert(Math.abs(ferryBob(boat,t))<=.45);
 }
 assert.equal(gangwayPlacement(theme,h,{...boat,phase:'approaching'},h.berth,0),null);assert.equal(gangwayPlacement(theme,h,{...boat,phase:'leaving'},h.berth,0),null);assert.deepEqual(h,original,'art must not mutate save/navigation geometry');
 const leftHull=h.berth.x+FERRY_ART.offsetX-100+7;assert(leftHull>=1600,'hull must clear the outer pier edge');assert(FERRY_ART.frameHeight<.97,'adjacent atlas-row mast must stay outside the crop');
});
