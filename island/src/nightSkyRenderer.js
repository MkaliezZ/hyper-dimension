import {drawItem} from './artStore.js';
import {drawAnimatedCharacter} from './characters.js';
import {seededRandom} from './gameLevels.js';
import {nightSkyLevel,nightSkyWind,nightSkyCloud,previewNightTrajectory,NIGHT_SKY_ORIGIN} from './nightSkyGame.js';
export const NIGHT_STAGE={width:960,height:540};
const point=p=>({x:50+p.x*8.6,y:24+p.y*4.9});
export function createNightSkyRenderer(canvas,{theme,people,reduced=false}){
 const ctx=canvas.getContext('2d'),stars=Array.from({length:48},(_,i)=>{const r=seededRandom(931+i*177);return{x:30+r()*900,y:24+r()*385,size:i%9===0?3:1.5,phase:r()*6};});
 const actors=people.map(p=>({npcId:p.id,x:0,y:512,direction:Math.PI/2,walkMix:0,phase:0,facing8:0,appearance:p.appearance||null}));
 let density=0;
 function resize(){const d=Math.min(2,Math.max(1,window.devicePixelRatio||1));if(d!==density){density=d;canvas.width=Math.round(960*d);canvas.height=Math.round(540*d);}}
 function star(x,y,size,color,opacity=1){ctx.save();ctx.globalAlpha=opacity;ctx.fillStyle=color;if(theme==='pixel'){x=Math.round(x);y=Math.round(y);size=Math.max(1,Math.round(size));ctx.fillRect(x-size,y,2*size+1,1);ctx.fillRect(x,y-size,1,2*size+1);ctx.fillRect(x-1,y-1,3,3);}else{ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,s=i%2?size*.24:size;const xx=x+Math.cos(a)*s,yy=y+Math.sin(a)*s;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.closePath();ctx.fill();}ctx.restore();}
 function sky(time){
  const pixel=theme==='pixel';
  if(pixel){['#17334f','#254761','#42677b','#7b9292'].forEach((c,i)=>{ctx.fillStyle=c;ctx.fillRect(0,i*135,960,136);});}
  else{const g=ctx.createLinearGradient(0,0,0,540);g.addColorStop(0,'#4a4768');g.addColorStop(.65,'#8a7f98');g.addColorStop(1,'#c5afa7');ctx.fillStyle=g;ctx.fillRect(0,0,960,540);ctx.fillStyle='#fff1dd0b';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(630,0);ctx.lineTo(270,400);ctx.lineTo(0,310);ctx.fill();ctx.fillStyle='#242d5020';ctx.beginPath();ctx.moveTo(960,0);ctx.lineTo(540,190);ctx.lineTo(960,420);ctx.fill();}
  for(const s of stars)star(s.x,s.y,s.size,'#fff0cb',reduced?.7:.42+.28*(1+Math.sin(time*.8+s.phase))/2);
  ctx.fillStyle='#ffe8bc';if(pixel){ctx.fillRect(848,43,24,6);ctx.fillRect(842,49,36,30);ctx.fillRect(848,79,24,6);ctx.fillStyle='#17334f';ctx.fillRect(858,40,24,30);}
  else{ctx.beginPath();ctx.arc(858,65,25,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f3d4a5';ctx.beginPath();ctx.moveTo(858,40);ctx.lineTo(874,78);ctx.lineTo(838,81);ctx.fill();ctx.fillStyle='#514d6e';ctx.beginPath();ctx.arc(872,54,23,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle=pixel?'#183c56':'#6c8195';ctx.fillRect(0,436,960,104);
  for(let row=0;row<4;row++){ctx.strokeStyle=(pixel?['#5e869a','#86a5b0']:['#b6c0c7','#d3c7c3'])[row%2];ctx.lineWidth=pixel?2:1.3;ctx.globalAlpha=.38;for(let x=-80;x<960;x+=130){const y=448+row*22+Math.sin((x+row*41)/90+(reduced?0:time*.55))*3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+38,y-(pixel?0:2));ctx.lineTo(x+72,y);ctx.stroke();}}ctx.globalAlpha=1;
  ctx.fillStyle=pixel?'#5b696c':'#9f9290';ctx.beginPath();ctx.ellipse(480,532,292,52,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle=pixel?'#8d9790':'#c5b2a0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(480,524,290,43,0,0,Math.PI*2);ctx.stroke();
  ctx.save();ctx.beginPath();ctx.ellipse(480,532,289,50,0,0,Math.PI*2);ctx.clip();ctx.strokeStyle=pixel?'#788486':'#b6a59c';for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(150+i*84,480);ctx.lineTo(110+i*94,540);ctx.stroke();}ctx.beginPath();ctx.moveTo(220,518);ctx.lineTo(740,518);ctx.stroke();ctx.restore();
 }
 function draw(g,time,arrived){
  resize();ctx.setTransform(density,0,0,density,0,0);ctx.imageSmoothingEnabled=theme!=='pixel';sky(time);
  const l=nightSkyLevel(g),cloud=nightSkyCloud(g),c=point(cloud),wind=nightSkyWind(g);
  ctx.save();ctx.globalAlpha=.32;ctx.fillStyle=theme==='pixel'?'#c8dce0':'#e0d4dc';if(theme==='pixel'){ctx.fillRect(Math.round(c.x-46),Math.round(c.y-11),92,23);ctx.fillRect(Math.round(c.x-28),Math.round(c.y-23),53,16);}else{ctx.beginPath();ctx.moveTo(c.x-61,c.y+5);ctx.lineTo(c.x-24,c.y-21);ctx.lineTo(c.x+22,c.y-11);ctx.lineTo(c.x+64,c.y+13);ctx.lineTo(c.x-26,c.y+23);ctx.closePath();ctx.fill();}ctx.restore();
  ctx.strokeStyle='#d7e4e566';ctx.lineWidth=theme==='pixel'?2:1;for(let i=0;i<5;i++){const y=195+i*33,x=80+((i*170+(reduced?0:time*wind*24))%800+800)%800;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sign(wind||1)*26,y-4);ctx.stroke();}
  for(let i=1;i<g.levels.length;i++){const a=point(g.levels[i-1].target),b=point(g.levels[i].target);ctx.strokeStyle=g.reports[i]?.precise&&g.reports[i-1]?.precise?'#ffeab2':'#dce1e324';ctx.lineWidth=2;ctx.setLineDash(g.reports[i]?.precise&&g.reports[i-1]?.precise?[]:[4,9]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}ctx.setLineDash([]);
  for(let i=0;i<4;i++){const t=g.levels[i].target,p=point(t),active=i===g.round&&g.phase!=='complete'&&g.phase!=='between',report=g.reports[i];star(p.x,p.y,report?.precise?11:active?9:5,g.levels[i].color,active||report?.precise?1:.28);if(active){ctx.strokeStyle=l.color;ctx.globalAlpha=.6;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(p.x,p.y,t.radius*8.6,t.radius*4.9,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}}
  if(g.phase==='aim'&&arrived){for(const p of previewNightTrajectory(g)){const q=point(p);ctx.fillStyle=l.color;ctx.globalAlpha=.5;ctx.fillRect(Math.round(q.x)-2,Math.round(q.y)-2,4,4);}ctx.globalAlpha=1;}
  if(arrived){
   const active=(g.phase==='between'||g.phase==='complete'?g.round-1:g.round)%actors.length;
   actors.forEach((a,i)=>{const passive=i<active?i:i-1;a.x=i===active?468:passive===0?345:620;a.action={type:g.phase==='aim'?'rest':'celebrate',t:reduced?0:g.phase==='flight'?Math.min(g.phaseTime,1.4):g.phaseTime%1.6,duration:1.6,leisure:true,...(g.phase==='aim'&&i===active?{output:'lantern'}:{})};drawAnimatedCharacter(ctx,a,theme,'#bea77d',true,reduced?0:time,.76);});
  }
  const f=g.flight;if(f){
   const flying=g.phase==='flight',fade=flying?1:Math.max(.15,1-g.phaseTime*.3);ctx.save();ctx.globalAlpha=fade;ctx.strokeStyle=l.color;ctx.lineWidth=theme==='pixel'?3:2;ctx.beginPath();f.trail.forEach((v,i)=>{const p=point(v);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);});ctx.stroke();
   const p=point(f);if(theme==='pixel'){ctx.fillStyle='#ffe1a033';ctx.fillRect(Math.round(p.x)-20,Math.round(p.y)-23,40,46);}else{const glow=ctx.createRadialGradient(p.x,p.y,2,p.x,p.y,38);glow.addColorStop(0,'#ffefb56b');glow.addColorStop(1,'#ffdf9900');ctx.fillStyle=glow;ctx.fillRect(p.x-38,p.y-38,76,76);}
   drawItem(ctx,'lantern',theme,theme==='pixel'?Math.round(p.x):p.x,theme==='pixel'?Math.round(p.y):p.y,44,reduced?0:Math.sin(time*2)*.04);
   for(let i=0;i<5;i++)star(p.x+Math.sin(time+i*1.7)*12,p.y+15+i*7,1.5,l.color,.55*(1-i/5));ctx.restore();
   if(!flying){const hit=g.reports.at(-1)?.precise,t=point(l.target),pulse=reduced?1:Math.min(1,g.phaseTime/1.2);ctx.strokeStyle=hit?l.color:'#d1dfe0';ctx.globalAlpha=(1-pulse)*.8;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(t.x,t.y,14+pulse*65,9+pulse*40,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  }
  if(g.phase==='complete')for(let i=0;i<g.reports.length;i++)if(g.reports[i].precise){const p=point(g.levels[i].target);star(p.x,p.y,14,g.levels[i].color);if(!reduced)for(let j=0;j<5;j++)star(p.x+Math.sin(time*.7+j*1.26)*26,p.y+Math.cos(time*.7+j*1.26)*19,2,g.levels[i].color,.65);}
 }
 return{draw,inspect:()=>({width:canvas.width,height:canvas.height,density,characters:actors.map(a=>a.npcId),positions:actors.map(a=>({id:a.npcId,x:a.x,y:a.y})),theme})};
}
