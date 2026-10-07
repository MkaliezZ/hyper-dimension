import {SPECIALIZATIONS,specializationRank} from './specialization.js';
const emblems={garden:'M24 38V20 M24 28C9 28 8 15 11 10C21 11 25 15 24 28 M24 23C38 24 41 12 37 7C28 10 22 15 24 23 M11 38H37',artisan:'M12 34L32 14 M27 8L39 20L32 27L20 15Z M9 31L17 39L11 43L5 37Z',host:'M24 6L29 18L42 20L32 28L35 42L24 34L13 42L16 28L6 20L19 18Z'};
export function specializationSeal(path,rank,theme='pixel'){
 const p=SPECIALIZATIONS.find(p=>p.id===path);return '<svg class="specialization-seal" viewBox="0 0 48 48" role="img" aria-label="'+p.name+' '+rank+' 阶徽记" style="--path-color:'+p.color+'" '+(theme==='pixel'?'shape-rendering="crispEdges"':'')+'><path class="specialization-seal-base" d="M5 2H36L46 12V40L39 47H8L2 40V6Z"/><path class="specialization-seal-fold" d="M36 2V12H46"/><path class="specialization-seal-icon" d="'+emblems[path]+'"/></svg>';
}
function motif(c,path,color,theme){
 c.fillStyle=color;c.strokeStyle=color;c.lineWidth=2;c.lineCap=theme==='pixel'?'square':'round';
 if(path==='garden'){c.beginPath();c.moveTo(0,12);c.lineTo(0,-10);c.stroke();for(const [x,y,r] of [[-7,-2,-.6],[6,-9,.7]]){c.save();c.translate(x,y);c.rotate(r);c.beginPath();c.ellipse(0,0,8,4,0,0,7);c.fill();c.restore();}}
 else if(path==='artisan'){c.save();c.rotate(-.7);c.fillRect(-3,-3,6,20);c.fillRect(-10,-11,20,9);c.fillStyle='#f7e5b8';c.fillRect(-8,-9,3,5);c.restore();}
 else{c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?5:12;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?c.lineTo(x,y):c.moveTo(x,y)}c.closePath();c.fill();}
}
export function drawSpecializationLandmark(c,s,theme,t,slots){
 const b=s.specialization,p=SPECIALIZATIONS.find(p=>p.id===b?.selected);if(!p)return;
 const rank=specializationRank(s,p.id);if(!rank)return;
 const slot=slots[p.building],x=slot.x+slot.w*.34,y=slot.y+slot.h*.48;
 c.save();c.translate(x,y);c.imageSmoothingEnabled=theme!=='pixel';c.fillStyle='#413b3a35';c.beginPath();c.ellipse(2,3,15,5,0,0,7);c.fill();
 c.fillStyle='#75634d';c.fillRect(-2,-48,4,49);c.translate(Math.sin(t*1.3)*1.1,-34);
 c.fillStyle=theme==='pixel'?'#f4dfb5':'#f7e5d2';c.strokeStyle='#786147';c.lineWidth=1.5;c.fillRect(-18,-21,36,42);c.strokeRect(-18,-21,36,42);
 if(theme==='origami'){c.fillStyle='#d1b69c';c.beginPath();c.moveTo(10,-21);c.lineTo(18,-13);c.lineTo(10,-13);c.fill();}
 motif(c,p.id,p.color,theme);c.fillStyle='#8a6b49';for(let i=0;i<rank;i++)c.fillRect(-10+i*5,15,3,3);c.restore();
}
export function drawSpecializationPerformance(c,e,theme){
 const p=SPECIALIZATIONS.find(p=>e.id.startsWith('career:'+p.id+':'));if(!p)return;
 const t=e.time,x=e.center.x,y=e.center.y,fade=Math.min(1,t/1.5);c.save();c.fillStyle='rgba(25,43,52,'+.3*fade+')';c.fillRect(0,0,1856,1248);c.translate(x,y-45);
 const radius=55+Math.min(t,4)*7;c.strokeStyle=p.color+'aa';c.lineWidth=2;c.beginPath();c.ellipse(0,0,radius,radius*.45,0,0,7);c.stroke();
 for(let i=0;i<24;i++){const age=(t+i*.19)%5,a=i*Math.PI*2/24,r=25+age*23;const xx=Math.cos(a)*r,yy=Math.sin(a)*r*.5-age*8;c.globalAlpha=Math.min(1,age)*Math.max(0,1-age/5);c.fillStyle=i%3?p.color:'#f1cf80';if(theme==='pixel')c.fillRect(Math.round(xx),Math.round(yy),3,3);else{c.beginPath();c.moveTo(xx,yy-4);c.lineTo(xx+3,yy);c.lineTo(xx,yy+4);c.lineTo(xx-3,yy);c.closePath();c.fill();}}
 c.globalAlpha=fade;c.save();c.translate(0,-Math.sin(t*.7)*3);c.scale(2.2,2.2);motif(c,p.id,'#f6dfa4',theme);c.restore();c.restore();
}
