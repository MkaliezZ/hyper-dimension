import {productionGeometry,residenceGeometry} from './buildingGeometry.js';
// Explicit opt-in inspection layer; gameplay and walkability are untouched.
const active=new URLSearchParams(location.search).get('align')==='1';
export function drawGroundCalibration(ctx,theme,production,homes){
 if(!active)return;
 ctx.save();ctx.lineWidth=1;ctx.font=theme==='pixel'?'10px FusionPixel,monospace':'10px sans-serif';ctx.textAlign='left';
 for(const [kind,sites]of [['production',production],['home',homes]])for(const site of sites){
  const g=kind==='home'?residenceGeometry(site,theme):productionGeometry(site,theme),c=g.groundCentre,f=g.foundationCentre;
  ctx.strokeStyle='#ffe282';ctx.strokeRect(c.x-site.w/2,c.y-site.h/2,site.w,site.h);
  ctx.fillStyle='#ffe282';ctx.beginPath();ctx.arc(c.x,c.y,3,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#6ff0ff';ctx.beginPath();ctx.moveTo(f.x-7,f.y);ctx.lineTo(f.x+7,f.y);ctx.moveTo(f.x,f.y-7);ctx.lineTo(f.x,f.y+7);ctx.stroke();
  ctx.setLineDash([2,2]);ctx.strokeStyle='#ffffffbb';ctx.strokeRect(g.x,g.y,g.w,g.h);ctx.setLineDash([]);
  if(site.entry){ctx.strokeStyle='#ffb0b0';ctx.beginPath();ctx.moveTo(c.x,g.foot);ctx.lineTo(site.entry.x,site.entry.y);ctx.stroke();ctx.fillStyle='#ffb0b0';ctx.fillRect(site.entry.x-2,site.entry.y-2,4,4);}
  const id=kind==='home'?'H'+site.ownerId:'B'+site.id;ctx.fillStyle='#182f2d';ctx.fillRect(c.x+7,c.y-14,74,15);ctx.fillStyle='#ffffff';ctx.fillText(id+' '+c.x.toFixed(0)+','+c.y.toFixed(0),c.x+9,c.y-3);
 }
 ctx.restore();
}
