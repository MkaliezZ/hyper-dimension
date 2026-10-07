import {drawFunctionalFacility} from './functionalArt.js';
import {drawItem} from './artStore.js';
import {displayShape} from './placements.js';
export function drawDecoration(ctx,p,theme,{ghost=false,ok=true,s=null,now=0}={}){
 const {rx,ry,h}=displayShape(p.item,p.rotation),paper=theme==='origami',color=ghost?(ok?'#65a78b':'#c46d72'):paper?'#d2b292':'#ac8b54';
 if(drawFunctionalFacility(ctx,p,theme,{ghost,s,now})){if(ghost){ctx.save();ctx.strokeStyle=ok?'#65a78b':'#c46d72';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.strokeRect(p.x-rx,p.y-ry,rx*2,ry*2);ctx.restore();}return;}
 ctx.save();ctx.translate(p.x,p.y);ctx.imageSmoothingEnabled=paper;
 ctx.fillStyle='#3f48392d';ctx.beginPath();ctx.ellipse(2,4,rx+4,ry*.6,0,0,Math.PI*2);ctx.fill();
 if(ghost){ctx.fillStyle=ok?'#6abc9b40':'#db777740';ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.setLineDash([5,3]);ctx.beginPath();ctx.moveTo(-rx,0);ctx.lineTo(0,-ry);ctx.lineTo(rx,0);ctx.lineTo(0,ry);ctx.closePath();ctx.fill();ctx.stroke();ctx.setLineDash([]);}
 ctx.fillStyle=color;ctx.strokeStyle=paper?'#a78371':'#765d3d';ctx.lineWidth=1;
 ctx.beginPath();ctx.moveTo(-rx*.72,-3);ctx.lineTo(0,-ry*.52-3);ctx.lineTo(rx*.72,-3);ctx.lineTo(0,ry*.52-3);ctx.closePath();ctx.fill();ctx.stroke();
 const v=[[0,1],[1,0],[0,-1],[-1,0]][p.rotation],dx=v[0]*rx*.60,dy=v[1]*ry*.43;
 ctx.strokeStyle=paper?'#f8dfc2':'#efcf81';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(dx*.55,dy*.55-3);ctx.lineTo(dx,dy-3);ctx.stroke();
 ctx.globalAlpha=ghost?.72:1;drawItem(ctx,p.item,theme,0,-h*.43,h);
 ctx.restore();
}
export function hitDecoration(s,x,y){
 return [...s.placedItems].reverse().find(p=>{const f=displayShape(p.item,p.rotation);return Math.abs(p.x-x)<Math.max(20,f.rx)&&y>=p.y-f.h&&y<=p.y+f.ry;});
}
