import {drawItem} from './artStore.js';
export function fireworksPlatforms(s){const g=s.fireworksParty?.session;if(g?.phase!=='running')return[];return g.layout.buyers.slice(0,3).map((p,lane)=>({...p,lane,game:g.game}));}
export function drawFireworksPlatform(ctx,p,s,theme,now){
 ctx.save();ctx.translate(p.x,p.y);const paper=theme==='origami';ctx.fillStyle=paper?'#53716a':'#315d53';ctx.beginPath();ctx.moveTo(-28,0);ctx.lineTo(0,-11);ctx.lineTo(28,0);ctx.lineTo(0,12);ctx.closePath();ctx.fill();ctx.strokeStyle=paper?'#c0c8a1':'#bbbd84';ctx.lineWidth=2;ctx.stroke();
 ctx.fillStyle=paper?'#d6bb86':'#c7a46b';ctx.fillRect(-18,-11,36,7);ctx.fillStyle='#35564e';ctx.fillRect(-14,-4,5,14);ctx.fillRect(9,-4,5,14);ctx.fillStyle=paper?'#8ea4a0':'#65959a';ctx.fillRect(-6,-31,12,20);
 drawItem(ctx,'firework',theme,0,-32,27);if(p.lane===1)drawItem(ctx,'c8_2',theme,22,-25,28,Math.sin(now*1.4)*.04);
 const g=p.game,shot=g.shots.filter(shot=>shot.round===g.round&&shot.config.lane===p.lane).at(-1);
 if(g.phase==='performing'&&shot){const age=g.clock-shot.at,flight=g.level.rounds[g.round].targets[shot.index].flight;if(age>=0&&age<flight){ctx.fillStyle='#f6d894';for(let i=0;i<9;i++){const q=Math.max(0,age-i*.03)/flight;ctx.globalAlpha=1-i/12;ctx.fillRect(Math.sin(q*4)*7,-35-q*88,3,4);}}else if(age>=flight&&age-flight<2){ctx.strokeStyle={coral:'#ff9b83',jade:'#8be2d5',gold:'#ffe6a5'}[shot.config.color];const t=age-flight,r=27*(1-Math.exp(-t*2));ctx.globalAlpha=1-t/2;for(let i=0;i<16;i++){const a=i*Math.PI/8;ctx.beginPath();ctx.moveTo(Math.cos(a)*r,-126+Math.sin(a)*r+t*t*6);ctx.lineTo(Math.cos(a)*(r+4),-126+Math.sin(a)*(r+4)+t*t*6);ctx.stroke();}}}
 ctx.restore();
}
