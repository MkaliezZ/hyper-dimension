import {drawItem} from './artStore.js';
export function drawGuestWorkstation(ctx,member,actor,theme){
 const work=member.work;if(!work)return;
 const x=work.target.x+18,y=work.target.y+6,fold=theme==='origami',w=fold?50:44,h=14;
 ctx.save();ctx.translate(x,y);
 ctx.fillStyle='#25403440';ctx.beginPath();ctx.ellipse(0,8,w*.65,7,0,0,Math.PI*2);ctx.fill();
 const polygon=(points,color)=>{ctx.fillStyle=color;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fill();};
 polygon([[-w/2,-8],[w/2,-8],[w/2,0],[-w/2,0]],fold?'#bd9681':'#80623f');
 polygon([[-w/2,-8],[-w/2+8,-h],[w/2+8,-h],[w/2,-8]],fold?'#f4dbc4':'#d5bd83');
 polygon([[w/2,-8],[w/2+8,-h],[w/2+8,-7],[w/2,0]],fold?'#987866':'#65502f');
 ctx.fillStyle=fold?'#b9937d':'#715137';ctx.fillRect(-w/2+4,0,4,9);ctx.fillRect(w/2-7,0,4,9);
 ctx.strokeStyle=fold?'#eac5ad':'#a68c5c';ctx.lineWidth=1;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(-w/2+5,-12+i*2);ctx.lineTo(w/2,-12+i*2);ctx.stroke();}
 ctx.save();ctx.globalAlpha=.45;drawItem(ctx,work.output,theme,10,-17,13);ctx.restore();
 const p=Math.max(0,Math.min(1,(work.elapsed||0)/work.duration));ctx.fillStyle=fold?'#e8d9cb':'#504632';ctx.fillRect(-20,12,40,3);ctx.fillStyle=fold?'#829c7b':'#e6bf63';ctx.fillRect(-20,12,40*p,3);
 if(work.phase==='working'&&member.position.online){const t=performance.now()/1000,alpha=.3+.2*Math.sin(t*3);ctx.globalAlpha=alpha;for(let i=0;i<3;i++){ctx.fillStyle=fold?'#f2cf9c':'#ffeac0';ctx.fillRect(-12+i*10,-23-Math.sin(t*2+i)*3,2,2);}}
 ctx.restore();
}
