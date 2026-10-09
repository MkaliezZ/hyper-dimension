import {BRUSH_SCHEMA,brushGuide} from '../src/brushStudio.js';
import {potteryShapeReview,potteryGlazeReview,potteryKilnTarget,potteryKilnLoss} from '../src/potteryStudio.js';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop,neighbors,rotateMask,photoSubject,potteryAccuracy,firePosition,coutureBrief} from '../src/workshopRules.js';
export function chooseAction(s){
 const l=s.level,k=s.kind;
 if(s.phase==='intro')return {type:'start'};
 if(s.phase!=='playing')return null;
 if(k==='joinery'){const p=l.solution.find(p=>!s.placed.some(q=>q.piece===p.piece));if(!p)return null;if(s.selected!==p.piece)return {type:'select',value:p.piece};if(s.rotation!==p.rotation)return {type:'rotate'};return {type:'cell',index:p.anchor};}
 if(k==='tea'){if(s.t<l.preview||s.opened.length===2)return null;const i=l.values.findIndex((v,i)=>!s.found.includes(i)&&!s.opened.includes(i)&&(!s.opened.length||v===l.values[s.opened[0]]));return i>=0?{type:'cell',index:i}:null;}
 if(k==='nonogram'){const i=l.values.findIndex((v,i)=>v&&s.cells[i]!==1);return i>=0?{type:'cell',index:i}:null;}
 if(k==='pipes'){const i=s.masks.findIndex((m,i)=>m!==l.solved[i]&&!l.fixed.includes(i));return i>=0?{type:'cell',index:i}:s.running?null:{type:'submit'};}
 if(k==='kitchen'){
  const ready=s.jobs.find(j=>j.state==='cooking'&&j.cooked>=j.cook+.08);if(ready)return {type:'serve',station:ready.station};
  const j=s.jobs[s.ticket];if(j&&['available','prep'].includes(j.state)){const target=l.orders[j.id];if(j.ingredients.length<target.ingredients.length)return {type:'ingredient',index:target.ingredients[j.ingredients.length]};if(j.cuts<j.ingredients.length*2)return {type:'cut'};if(s.jobs.filter(j=>j.state==='cooking').length<2)return {type:'cook'};return null;}
  const next=s.jobs.find(j=>['available','prep'].includes(j.state));return next?{type:'ticket',index:next.id}:null;
 }
 if(k==='couture'){if(s.runway)return null;const ids=coutureBrief(s).solutions[0],id=ids.find(id=>!s.outfit.includes(id));return id?{type:'wear',item:id}:{type:'submit'};}
 if(k==='beacon'){const ship=s.ships.filter(v=>v.state==='approaching').sort((a,b)=>(a.arrival+a.deadline)-(b.arrival+b.deadline))[0];if(!ship)return null;const a=ship.liveAngle??ship.angle;return {type:'point',x:480+Math.cos(a)*200,y:280+Math.sin(a)*200};}
 if(k==='rhythm'){
  for(let lane=0;lane<4;lane++)if(s.keys['lane'+lane]&&!s.notes.some(n=>n.lane===lane&&n.state==='holding'))return {type:'releaseLane',lane};
  const n=s.notes.find(n=>n.state==='waiting'&&s.t>=n.at-.015&&s.t<n.at+l.window);return n?{type:'lane',lane:n.lane}:null;
 }
 if(k==='photo'){
  const p=photoSubject(s);if(Math.abs(p.focus-s.focus)>1)return {type:'focus',delta:p.focus-s.focus};
  if(Math.hypot(p.x-s.camera.x,p.y-s.camera.y)>3)return {type:'point',x:p.x,y:p.y};
  return p.pose>.7&&s.t-s.lastPhoto>.4?{type:'shutter'}:null;
 }
 if(k==='sokoban'){
  // Forward path is verified separately; use a persistent cursor for the legal input sequence.
  s._testStep??=0;return s._testStep<l.solution.length?{type:'move',dir:l.solution[s._testStep++]}:null;
 }
 if(k==='pottery'){
  if(s.mode==='shape'){
   if(s.wet<.35)return {type:'water'};if(potteryShapeReview(s).complete)return {type:'submit'};
   const ring=s.radii.map((v,i)=>({i,error:Math.abs(v-l.target[i])})).sort((a,b)=>b.error-a.error)[0].i;
   const dx=Math.max(-35,Math.min(35,l.target[ring]-s.radii[ring])),p={x:480+s.radii[ring]+dx,y:125+ring/11*270};
   return {type:s.holding?'point':'down',...p};
  }
  if(s.mode==='glaze'){
   if(potteryGlazeReview(s).complete)return {type:'submit'};
   const ring=s.glaze.map((v,i)=>({i,value:Math.min(v/.8,s.pigments[i][l.ringColors[i]]/l.glazeGoal)})).sort((a,b)=>a.value-b.value)[0].i;
   if(s.glazeColor!==l.ringColors[ring])return {type:'glazeColor',index:l.ringColors[ring]};
   return {type:s.holding?'point':'down',x:480,y:125+ring/11*270};
  }
  if(s.mode==='firing'){
   const k=s.kiln,target=potteryKilnTarget(l,k.elapsed),rate=target.slope+(target.temperature-k.temperature)*1.2;
   const vent=target.stage==='退火'?Math.max(.15,Math.min(.95,(-rate/Math.max(1,k.temperature-20)-.045)/.08)):.15;
   const wantedVent=Math.round(vent*10)/10;if(Math.abs(k.vent-wantedVent)>.055)return {type:'kilnVent',delta:k.vent<wantedVent?10:-10};
   const needed=Math.max(0,Math.min(1,(rate+potteryKilnLoss(s)*(k.temperature-20))/9.5));
   const fire=Math.max(0,Math.min(1,needed+(needed-k.actualFire)*.9));
   if(Math.abs(k.fire-fire)>.065)return {type:'kilnFire',delta:k.fire<fire?10:-10};
  }return null;
 }
 if(k==='angling'){
  const spot=l.spots[Math.min(s.catch,l.spots.length-1)];
  if(s.mode==='cast')return {type:'down',x:spot.x-l.wind,y:spot.y};
  if(s.mode==='casting'||s.mode==='waiting')return s.holding?{type:'up'}:null;
  if(s.mode==='bite')return {type:'down',x:spot.x,y:spot.y};
  if(s.mode==='fight'){
   if(Math.abs(s.pointer.x-s.fish.x)>10)return {type:'point',...s.fish};
   if(s.holding&&(s.surge&&s.tension>.32||s.tension>.7))return {type:'up'};
   if(!s.holding&&(!s.surge&&s.tension<.7||s.tension<.13))return {type:'down',...s.fish};
  }return null;
 }
 if(k==='mosaic'){
  const pos=s.order.findIndex((v,i)=>v!==i);if(pos>=0){if(s.selected!==pos)return {type:'cell',index:pos};return {type:'cell',index:s.order.indexOf(pos)};}
  const rot=s.rotations.findIndex(v=>v!==0);if(rot>=0)return s.selected!==rot?{type:'cell',index:rot}:{type:'rotate'};return null;
 }
 if(k==='interior'){
  if(s.walkthrough)return null;const i=l.items.findIndex(v=>!s.furniture.some(p=>p.id===v.id));if(i<0)return {type:'submit'};
  if(s.selected!==i)return {type:'select',value:i};const p=l.solution[i];if(s.rotation!==(p.rotation||0))return {type:'rotate'};return {type:'cell',index:p.y*l.w+p.x};
 }
 if(k==='fireworks'){
  const p=l.targets.find((_,i)=>!s.lit.includes(i));if(!p)return null;
  if(s.projectile)return s.projectile.age>=p.fuse-.02?{type:'down',x:p.x,y:p.y}:null;
  if(Math.abs(s.aim-p.angle)>.001)return {type:'point',x:480+Math.cos(p.angle)*250,y:475+Math.sin(p.angle)*250};
  if(!s.holding)return {type:'down',...s.pointer};if(s.charge>=p.power)return {type:'up'};return null;
 }
 if(k==='expedition'){
  s._testStep??=0;const to=l.solution[s._testStep++];if(to==null)return null;return {type:'move',dir:neighbors(s.player,l.w,l.h).find(v=>v.i===to)?.dir};
 }
 if(k==='regatta'){
  const b=s.boat,next=l.path[s.gate];if(!next)return null;
  // Approach the final slip from its left, then align and brake.
  let target=next;
  if(s.gate===l.path.length-1){
   s._dockLeg??=0;
   if(s._dockLeg===0){target={x:704,y:435};if(Math.hypot(b.x-target.x,b.y-target.y)<25)s._dockLeg=1;}
   else target={x:845,y:440};
  }
  // Steer away from reefs when the immediate target line intersects their safety radius.
  const dx=target.x-b.x,dy=target.y-b.y,dist=Math.hypot(dx,dy);
  let aim=Math.atan2(dy,dx);
  for(const r of l.reefs){
   const along=((r.x-b.x)*dx+(r.y-b.y)*dy)/Math.max(1,dist),cross=((r.x-b.x)*dy-(r.y-b.y)*dx)/Math.max(1,dist);
   if(along>0&&along<Math.min(dist,140)&&Math.abs(cross)<r.r+42){const sign=cross>0?1:-1;aim+=sign*.9;}
  }
  const p={x:b.x+Math.cos(aim)*150,y:b.y+Math.sin(aim)*150};
  if(s.gate===l.path.length-1&&s._dockLeg===1&&Math.hypot(b.x-next.x,b.y-next.y)<35){if(s.holding)return {type:'up'};if(!s.keys.brake)return {type:'brake',down:true};if(s.keys.left)return {type:'steer',key:'left',down:false};if(s.keys.right)return {type:'steer',key:'right',down:false};const delta=Math.atan2(Math.sin(-b.angle),Math.cos(-b.angle));if(Math.abs(delta)>.2)return {type:'steer',key:delta>0?'right':'left',down:true};return null;}
  if(s.keys.brake)return {type:'brake',down:false};
  const angleDiff=Math.abs(Math.atan2(Math.sin(aim-b.angle),Math.cos(aim-b.angle)));
  if(angleDiff>.65&&b.speed>54){if(s.holding)return {type:'up'};const delta=Math.atan2(Math.sin(aim-b.angle),Math.cos(aim-b.angle));return {type:'steer',key:delta>0?'right':'left',down:true};}
  if(s.keys.left)return {type:'steer',key:'left',down:false};if(s.keys.right)return {type:'steer',key:'right',down:false};
  if(!s.holding)return {type:'down',...p};return {type:'point',...p};
 }
 if(k==='brush'){
  const stroke=l.strokes[s.stroke];if(!stroke)return null;
  if(l.schemaVersion===BRUSH_SCHEMA){if(s.mode!=='drawing'||s.dryRemaining>0)return null;if(s.color!==stroke.color)return {type:'color',index:stroke.color};if(s.ink<.06)return {type:'dip'};if(!s.holding||!s.brushAnchored)return {type:'down',x:brushGuide(s).x,y:brushGuide(s).y};const p=stroke.points.find(p=>p.arc>s.arc+.15)||stroke.points.at(-1);return {type:'point',x:p.x,y:p.y};}
  if(s.color!==stroke.color)return {type:'color',index:stroke.color};if(s.ink<.08)return {type:'dip'};const p=stroke.points[s.node];return {type:s.holding?'point':'down',...p};
 }
 return null;
}
export function simulateWorkshop(id,seed=731,d=2){
 const s=createWorkshopState(makeWorkshopLevel(id,seed,d));let actions=0;
 for(let frame=0;frame<18000&&!s.result;frame++){
  const a=chooseAction(s);if(a){workshopAction(s,a);actions++}stepWorkshop(s,1/30);s.events.length=0;
 }
 return {state:s,actions};
}
