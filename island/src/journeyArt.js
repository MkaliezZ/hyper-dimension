import {drawSpecializationPerformance} from './specializationArt.js';
import {drawItem} from './artStore.js';
function polygon(c,points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke()}}
function star(c,x,y,r,fill){polygon(c,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,z=i%2?r*.46:r;return [x+Math.cos(a)*z,y+Math.sin(a)*z]}),fill)}
function lamp(c,x,y,theme,t,scale=1){c.save();c.translate(x,y);c.scale(scale,scale);c.fillStyle='#635d4777';c.beginPath();c.ellipse(0,0,14,5,0,0,7);c.fill();c.fillStyle='#907552';c.fillRect(-3,-33,6,33);c.fillStyle='#edbf6266';c.beginPath();c.ellipse(0,-40,17+Math.sin(t)*2,22,0,0,7);c.fill();drawItem(c,'lantern',theme,0,-40,29);c.restore()}
export function drawJourneyLandmarks(c,s,theme,t,slots,harbor){
 const j=s.journey;if(!j)return;c.save();c.lineWidth=1.5;c.imageSmoothingEnabled=theme!=='pixel';
 if(j.claimed.light){lamp(c,746,472,theme,t);lamp(c,828,472,theme,t+.7)}
 if(j.claimed.trade){const b=slots[9],x=b.x,y=b.y-b.h*.35;c.strokeStyle='#6d7455';c.beginPath();c.moveTo(x-43,y);c.quadraticCurveTo(x,y+14,x+43,y);c.stroke();for(let i=0;i<7;i++){const xx=x-37+i*12,yy=y+3+Math.sin(i*Math.PI/6)*4;polygon(c,[[xx,yy],[xx+10,yy],[xx+5+Math.sin(t*2+i)*1.5,yy+13]],['#dcab62','#83aa9a','#c58079'][i%3])}}
 if(j.claimed.festival){c.fillStyle='#f4dfae88';c.beginPath();c.ellipse(786,443,24,11,0,0,7);c.fill();polygon(c,[[767,440],[786,431],[805,440],[786,449]],'#d2ae70','#776549');star(c,786,420,18,'#f4d380');polygon(c,[[786,402],[786,420],[769,425]],'#ffebba');for(let i=0;i<6;i++){const a=t*.15+i*Math.PI/3;star(c,786+Math.cos(a)*28,420+Math.sin(a)*9,2.5,'#fff1b8')}}
 if(j.claimed.signature){const x=harbor.gate.x-22,y=harbor.gate.y-18;c.fillStyle='#6c7660';c.fillRect(x-2,y-48,4,48);polygon(c,[[x,y-48],[x+25,y-43],[x,y-22]],'#79b1aa','#516d65');star(c,x+9,y-39,5,'#f6dd9b')}
 c.restore();
}
export function drawMomentPerformance(c,e,theme){
 if(!e)return;if(e.id.startsWith('career:')){drawSpecializationPerformance(c,e,theme);return;}const t=e.time,center=e.center||{x:786,y:460};c.save();c.imageSmoothingEnabled=theme!=='pixel';
 const fade=Math.min(1,t/1.5);c.fillStyle='rgba(25,43,65,'+((e.id==='trade'?.08:e.id==='festival'?.45:.23)*fade)+')';c.fillRect(0,0,1856,1248);
 const x0=center.x,y0=center.y;
 if(e.id==='light'||e.id==='festival'){
  const n=e.id==='light'?5:16;
  for(let i=0;i<n;i++){const age=t*.65-i*.14;if(age<0)continue;const x=x0+(i-(n-1)/2)*23+Math.sin(age+i)*9,y=y0+22-age*29-(i%3)*10;
   c.globalAlpha=Math.min(1,age*2)*Math.max(0,1-age/12);c.fillStyle='#ffcf6844';c.beginPath();c.ellipse(x,y,15,19,0,0,7);c.fill();drawItem(c,'lantern',theme,x,y,18+(i%3)*3)}
 }else if(e.id==='trade'){
  for(let i=0;i<44;i++){const age=(t+i*.23)%5,x=x0-145+(i*61)%290+Math.sin(age+i)*8,y=y0-155+age*36;c.globalAlpha=Math.min(1,age)*Math.min(1,5-age);c.save();c.translate(x,y);c.rotate(Math.sin(t*2+i));polygon(c,[[0,-4],[3,0],[0,4],[-3,0]],['#efbf6c','#9eccaf','#e6a397'][i%3]);c.restore()}
  for(let i=0;i<5;i++){const a=(t*.45+i*.35)%3.6;drawItem(c,['bouquet','tea','bread','lantern','painting'][i],theme,x0+(i-2)*38,y0-a*24,24)}
 }else{
  c.strokeStyle='#c6e4dc';c.lineWidth=1;c.globalAlpha=fade;
  const stars=Array.from({length:8},(_,i)=>({x:x0-125+i*35,y:y0-65-Math.sin(i*.8)*55}));
  c.beginPath();stars.forEach((s,i)=>i?c.lineTo(s.x,s.y):c.moveTo(s.x,s.y));c.stroke();for(const [i,s] of stars.entries())star(c,s.x,s.y,5+Math.sin(t+i)*1.2,'#f5dca1');
  star(c,x0,y0-10,24+Math.sin(t)*2,'#f9df98');
 }
 c.globalAlpha=1;
 if(e.id==='festival'&&t>1.2)for(let b=0;b<3;b++){
  const cycle=(t-1.2-b*.65)%4.2;if(cycle<0||cycle>2.8)continue;const x=x0-125+b*125,y=y0-155+(b%2)*-55;
  for(let i=0;i<34;i++){const a=i*Math.PI*2/34,r=8+cycle*39,alpha=Math.max(0,1-cycle/2.8);c.globalAlpha=alpha;const xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r+cycle*cycle*6;
   c.fillStyle=['#ffdfa0','#bde5d2','#eab6ba'][b];c.strokeStyle=c.fillStyle;c.lineWidth=1.6;c.beginPath();c.moveTo(xx-Math.cos(a)*9,yy-Math.sin(a)*9);c.lineTo(xx,yy);c.stroke();if(theme==='pixel')c.fillRect(Math.round(xx),Math.round(yy),3,3);else polygon(c,[[xx,yy-3],[xx+2,yy],[xx,yy+3],[xx-2,yy]],c.fillStyle);
  }
 }c.restore();
}
