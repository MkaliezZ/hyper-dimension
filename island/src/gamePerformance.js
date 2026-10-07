import {drawItem} from './artStore.js';
import {getSoundMixer} from './soundMixer.js';
// Each game owns its clock and effects. Destroying a room cancels presentation and rewards.
export function createGamePerformance(board,theme,item){
 const canvas=document.createElement('canvas');canvas.className='performance-canvas';canvas.width=600;canvas.height=340;canvas.setAttribute('aria-hidden','true');board.append(canvas);
 const sound=getSoundMixer().createScope('game-performance');
 const ctx=canvas.getContext('2d'),particles=[];let clock=0,presentation=null,callback=null,alive=true,events=0;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function emit(kind,x=300,y=170,art=null){
  sound.play(kind);events++;const count=reduced?4:kind==='firework'?40:kind==='trail'?3:12;
  for(let i=0;i<count;i++){const a=i/count*Math.PI*2,speed=kind==='firework'?85+Math.random()*65:22+Math.random()*52;particles.push({kind,x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-(kind==='steam'?50:15),age:0,life:kind==='firework'?1.3:.65,art:i===0?art:null,color:kind==='trail'?'#ffe6a7':kind==='steam'?'#fff7e6':['#f5cb77','#7fc7b6','#cba2cf','#e8a491'][i%4]})}
 }
 function present(pass,finish){presentation={pass,age:0,duration:reduced?.18:1.1};callback=finish;board.classList.add('presenting-result');emit(pass?'firework':'retry',300,150);if(pass){sound.play('victory');emit('collect',300,160,item)}}
 function tick(dt){
  if(!alive)return;if(dt>0)sound.resume();else sound.pause();clock+=dt;ctx.clearRect(0,0,600,340);ctx.imageSmoothingEnabled=theme!=='pixel';
  if(presentation){
   const p=presentation;p.age+=dt;const ratio=Math.min(1,p.age/p.duration),ease=1-Math.pow(1-ratio,3);
   ctx.fillStyle=theme==='origami'?'#f7eadbec':'#eedebcec';ctx.fillRect(0,0,600,340);
   ctx.fillStyle='#63513b33';ctx.beginPath();ctx.ellipse(300,248,65*ease,12,0,0,7);ctx.fill();
   drawItem(ctx,item,theme,300,215-55*ease,90+45*ease,p.pass?Math.sin(p.age*8)*.07:0);
   ctx.fillStyle=theme==='origami'?'#795853':'#5f4d35';ctx.font='bold 19px sans-serif';ctx.textAlign='center';ctx.fillText(p.pass?'成品完成 · 已准备好入库':'调整准备，再试一次',300,292);
   if(ratio===1&&callback){const fn=callback;callback=null;fn()}
  }
  for(let i=particles.length-1;i>=0;i--){
   const p=particles[i];p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.kind==='steam'?-10:65)*dt;ctx.globalAlpha=Math.max(0,1-p.age/p.life);
   if(p.art)drawItem(ctx,p.art,theme,p.x,p.y,28);
   else if(p.kind==='steam'){ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(p.x,p.y,4+p.age*6,8+p.age*10,0,0,7);ctx.fill()}
   else if(p.kind==='splash'){ctx.strokeStyle='#c6f7fa';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y,5+p.age*14,2+p.age*5,0,0,7);ctx.stroke()}
   else {ctx.fillStyle=p.color;if(theme==='pixel')ctx.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,4,4);else{ctx.beginPath();ctx.moveTo(p.x,p.y-5);ctx.lineTo(p.x+5,p.y+3);ctx.lineTo(p.x-4,p.y+5);ctx.closePath();ctx.fill()}}
   if(p.age>=p.life)particles.splice(i,1);
  }
  ctx.globalAlpha=1;
 }
 return {emit,present,tick,pause:()=>sound.pause(),inspect:()=>({events,particles:particles.length,presenting:!!presentation,age:presentation?.age||0,ready:!!presentation&&!callback}),destroy(){alive=false;sound.destroy();callback=null;particles.splice(0);canvas.remove();board.classList.remove('presenting-result')}};
}
