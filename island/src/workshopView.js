import {KITCHEN_SCHEMA,kitchenTarget} from './kitchenCutting.js';
import {paintBrushStudio} from './brushPainter.js';
import {POTTERY_COLORS,potteryGlazeReview,potteryKilnTarget} from './potteryStudio.js';
import {propImage,drawProp} from './workshopProps.js';
import {drawItem,itemFrame,artReady} from './artStore.js';
import {avatarFrame} from './avatars.js';
import {pieceOffsets} from './gameLevels.js';
import {clamp,photoSubject,firePosition,outfitScore,coutureBrief,interiorReview} from './workshopRules.js';
import {WORKSHOP_GAMES} from './workshopCatalog.js';
import {interiorWalker,checkInteriorPlacement} from './interiorDesign.js';
export const W=960,H=540;
const palette=['#e4b279','#87b9ac','#c58b93','#a4aec8','#bdc782','#cca578'];
const atlases=new Map();
export function stageImage(theme){
 if(!atlases.has(theme)){const img=new Image();img.src='/assets/minigame-stages-'+theme+'-v19.png';atlases.set(theme,img);}
 return atlases.get(theme);
}
const potteryStages=new Map();
export function potteryStageImage(theme){if(!potteryStages.has(theme)){const img=new Image();img.src='/assets/pottery-stage-'+theme+'-v41.png';potteryStages.set(theme,img);}return potteryStages.get(theme);}
export async function prepareStage(theme,kind=''){const im=stageImage(theme);await Promise.allSettled([artReady,im.decode(),propImage(theme).decode()]);if(kind==='pottery')await potteryStageImage(theme).decode();return im}
export function stageCrop(im,panel){const rows=[0,384/1152,742/1152,1],row=Math.floor(panel/2);return {x:(panel%2)*im.naturalWidth/2+3,y:rows[row]*im.naturalHeight+3,w:im.naturalWidth/2-6,h:(rows[row+1]-rows[row])*im.naturalHeight-6}}
export function paintPanel(c,theme,panel,x=0,y=0,w=W,h=H){
 const im=stageImage(theme);if(!im.complete||!im.naturalWidth){c.fillStyle='#b9cab1';c.fillRect(x,y,w,h);return}
 const f=stageCrop(im,panel);c.drawImage(im,f.x,f.y,f.w,f.h,x,y,w,h);
}
function rect(c,x,y,w,h,fill,stroke,r=8){c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.stroke()}}
function line(c,points,color,width=2,dash=[]){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x??p[0],p.y??p[1]):c.moveTo(p.x??p[0],p.y??p[1]));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([])}
function circle(c,x,y,r,fill,stroke,width=2){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke()}}
function ellipse(c,x,y,rx,ry,fill,stroke){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill()}if(stroke){c.strokeStyle=stroke;c.stroke()}}
function polygon(c,points,fill,stroke){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.stroke()}}
function text(c,t,x,y,size=22,color='#f6efda',align='center'){c.fillStyle=color;c.font='600 '+size+'px "Microsoft YaHei",sans-serif';c.textAlign=align;c.textBaseline='middle';c.fillText(t,x,y)}
function star(c,x,y,r,color){const pts=Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return [x+Math.sin(a)*r*(i%2?.28:1),y-Math.cos(a)*r*(i%2?.28:1)]});polygon(c,pts,color)}
function panel(c,x,y,w,h,dark=false,pixel=false){c.save();c.shadowColor='#132b243d';c.shadowBlur=18;c.shadowOffsetY=7;rect(c,x,y,w,h,dark?'#152b43e8':'#fff8e8eb',dark?'#9baeb263':'#b3a183',pixel?2:12);c.restore();rect(c,x+6,y+6,w-12,h-12,null,dark?'#cad4c828':'#cfbfa7',pixel?1:8)}
function progress(c,x,y,w,value,color='#e6c681',bg='#152e45b0'){rect(c,x,y,w,9,bg,null,4);rect(c,x,y,Math.max(0,w*clamp(value,0,1)),9,color,null,4)}
function wood(c,x,y,w,h,color,pixel){rect(c,x,y+5,w,h,color,'#604d3670',pixel?2:6);rect(c,x,y,w,h,color,'#f7e5bb',pixel?2:6);c.save();c.globalAlpha=.22;for(let j=12;j<h;j+=13)line(c,[[x+5,y+j],[x+w*.4,y+j-2],[x+w-6,y+j+1]],'#79523a',1);c.restore()}
function fish(c,x,y,size,t,theme,color='#e4a666',a=0,flip=false,item='fish'){const f=itemFrame(item,theme);if(f?.img.complete&&f.img.naturalWidth){const r=f.frame,k=size/Math.max(r.w,r.h);c.save();c.translate(x,y);c.rotate(a);c.scale(flip?-1:1,1);if(color==='#265667'){c.globalAlpha*=.5;c.filter='brightness(.48)'}for(let i=0;i<16;i++){const u=i/16,sw=r.w/16,offset=Math.sin(t*7+u*3)*size*.065*Math.pow(1-u,2);c.drawImage(f.img,r.x+i*sw,r.y,sw,r.h,-r.w*k/2+i*sw*k,-r.h*k/2+offset,sw*k+.3,r.h*k)}c.restore();return}c.save();c.translate(x,y);c.rotate(a);const sw=Math.sin(t*6)*.25;c.rotate(sw*.15);ellipse(c,0,7,size*.57,size*.16,'#143b4c2a');polygon(c,[[-size*.36,0],[-size*.78,-size*(.25+sw*.2)],[-size*.69,size*.26]],color);if(theme==='pixel'){rect(c,-size*.35,-size*.2,size*.7,size*.4,color,null,2);rect(c,-size*.15,-size*.28,size*.35,size*.52,color,null,1);}else{ellipse(c,0,0,size*.45,size*.24,color);polygon(c,[[-size*.25,0],[size*.26,-size*.16],[size*.35,size*.08]],'#fff4cf75');}circle(c,size*.23,-size*.055,size*.043,'#243a44');polygon(c,[[0,size*.05],[-size*.12,size*.38],[size*.14,size*.14]],'#b47153');c.restore()}
function boat(c,x,y,a,size,theme,t,lit=false){if(drawProp(c,4,theme,x,y,size*1.4,a-.28)){if(lit){c.save();c.shadowBlur=9;c.shadowColor='#f9df94';circle(c,x+Math.cos(a)*size*.22,y+Math.sin(a)*size*.22,2,'#fff2ba');c.restore()}return}c.save();c.translate(x,y);c.rotate(a);ellipse(c,-3,8,size*.62,size*.27,'#113d5355');polygon(c,[[-size*.5,-size*.23],[size*.25,-size*.23],[size*.6,0],[size*.25,size*.23],[-size*.5,size*.23]],'#533f32');polygon(c,[[-size*.45,-size*.18],[size*.22,-size*.18],[size*.48,0],[size*.22,size*.18],[-size*.45,size*.18]],theme==='pixel'?'#e7c78a':'#f8e2b5','#c99b60');rect(c,-size*.19,-size*.16,size*.25,size*.32,'#c66f61',null,theme==='pixel'?0:3);line(c,[[-size*.08,-size*.23],[-size*.08,size*.23]],'#eedfc0',3);if(lit){c.shadowBlur=18;c.shadowColor='#f3d698';circle(c,size*.2,0,4,'#fff3b7')}c.restore()}
function actor(c,theme,avatar,x,y,height,heading=4,walk=0){const f=avatarFrame(avatar||'male_0',theme,heading);if(!f?.img.complete||!f.img.naturalWidth)return;const r=f.frame,k=height/r.h;c.save();ellipse(c,x,y-4,height*.23,height*.065,'#18362940');c.translate(x,y-2-Math.abs(Math.sin(walk*12))*3);c.rotate(Math.sin(walk*12)*.025);c.scale(f.flip?-1:1,1);c.drawImage(f.img,r.x,r.y,r.w,r.h,-r.w*k/2,-height,r.w*k,height);c.restore()}
export function boardGeometry(s){
 const l=s.level,k=s.kind;let cols,rows,cell,x,y;
 if(k==='joinery'){cols=l.w;rows=l.h;cell=74;}
 if(k==='tea'){cols=l.cols;rows=Math.ceil(l.values.length/cols);cell=Math.min(84,400/rows);}
 if(k==='nonogram'){cols=rows=l.n;cell=Math.min(62,376/rows);return {cols,rows,cell,x:520-cols*cell/2,y:136+(7-rows)*3};}
 if(k==='pipes'){cols=l.w;rows=l.h;cell=Math.min(86,420/rows);}
 if(['sokoban','expedition'].includes(k)){cols=l.w;rows=l.h;cell=k==='sokoban'?63:50;}
 if(k==='mosaic'){cols=rows=l.n;cell=396/l.n;}
 if(k==='interior'){cols=l.w;rows=l.h;cell=Math.min(80,390/rows,640/cols);}
 if(!cols)return null;return {cols,rows,cell,x:(W-cols*cell)/2,y:(H-rows*cell)/2+(k==='interior'?24:0)};
}
export function viewBounds(s,narrow){
 if(narrow&&s.kind==='brush'&&s.level.schemaVersion===139)return {x:186,y:56,w:590,h:426};
 if(narrow&&s.kind==='kitchen'&&s.level.schemaVersion===KITCHEN_SCHEMA)return {x:337,y:200,w:290,h:245};
 if(narrow&&s.kind==='pottery')return {x:235,y:15,w:490,h:510};
 const g=boardGeometry(s);if(!narrow||!g)return {x:0,y:0,w:W,h:H};
 if(s.kind==='nonogram')return {x:g.x-102,y:g.y-115,w:g.cols*g.cell+126,h:g.rows*g.cell+138};
 if(s.kind==='interior')return {x:g.x-24,y:g.y-74,w:g.cols*g.cell+48,h:g.rows*g.cell+103};
 return {x:g.x-22,y:g.y-22,w:g.cols*g.cell+44,h:g.rows*g.cell+44};
}
export function gridHits(s){
 const g=boardGeometry(s);if(!g)return [];
 return Array.from({length:g.cols*g.rows},(_,index)=>({index,x:g.x+index%g.cols*g.cell,y:g.y+Math.floor(index/g.cols)*g.cell,w:g.cell,h:g.cell}));
}
export function makeWorkshopPainter(canvas,theme,avatar,catchItem=null){
 const surface=document.createElement('canvas'),c=surface.getContext('2d'),out=canvas.getContext('2d'),particles=[],effects=[],reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;let last=0,clock=0,knifeX=560;
 function burst(e){
  effects.push({...e,born:clock});const n=e.kind==='firework'?100:e.kind==='victory'?80:['join','snap','serve','catch','push','collect','note','star'].includes(e.kind)?14:['clay','ink','glaze'].includes(e.kind)?3:0;
  const colors=e.color&&typeof e.color==='string'?[e.color,'#fff7dc']:palette;
  for(let i=0;i<(reduced?Math.ceil(n/4):n);i++){const a=(i/n)*Math.PI*2+Math.random()*.1,v=e.kind==='firework'?60+Math.random()*200:25+Math.random()*95;particles.push({firework:e.kind==='firework',x:e.x,y:e.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(e.kind==='victory'?90:0),life:e.kind==='firework'?1.8+Math.random():.6+Math.random()*.8,max:e.kind==='firework'?2.6:1.3,color:colors[i%colors.length],r:e.kind==='firework'?1.8:2+Math.random()*3,gravity:e.kind==='firework'?35:65});}
 }
 function gridFrame(s,dark=false){const g=boardGeometry(s);panel(c,g.x-17,g.y-17,g.cols*g.cell+34,g.rows*g.cell+34,dark,theme==='pixel');return g}
 function gridCell(g,i){return {x:g.x+i%g.cols*g.cell,y:g.y+Math.floor(i/g.cols)*g.cell}}
 function paintGrid(s){
  const l=s.level,k=s.kind,g=gridFrame(s,['nonogram','pipes'].includes(k));
  if(k==='joinery'){
   for(let i=0;i<l.w*l.h;i++){const p=gridCell(g,i);rect(c,p.x+2,p.y+2,g.cell-4,g.cell-4,l.target.includes(i)?'#aa815b38':'#65745b08',l.target.includes(i)?'#82634d66':null,2);}
   for(const p of s.placed){const age=clamp((s.t-p.at)/.23,0,1);c.save();c.globalAlpha=.6+.4*age;for(const i of p.cells){const q=gridCell(g,i);wood(c,q.x+3,q.y+3-(1-age)*15,g.cell-6,g.cell-8,palette[p.piece%6],theme==='pixel');}c.restore();}
   if(s.phase==='playing'&&s.selected>=0){const i=Math.floor((s.pointer.y-g.y)/g.cell)*g.cols+Math.floor((s.pointer.x-g.x)/g.cell);if(s.pointer.x>=g.x&&s.pointer.x<g.x+g.cols*g.cell&&s.pointer.y>=g.y&&s.pointer.y<g.y+g.rows*g.cell){const cells=pieceOffsets(l.pieces[s.selected],s.rotation).map(([dx,dy])=>({x:i%g.cols+dx,y:Math.floor(i/g.cols)+dy})),valid=cells.every(p=>p.x>=0&&p.x<l.w&&p.y>=0&&p.y<l.h&&l.target.includes(p.y*l.w+p.x)&&!s.occupied.includes(p.y*l.w+p.x));c.save();c.globalAlpha=.5;for(const p of cells)rect(c,g.x+p.x*g.cell+3,g.y+p.y*g.cell+3,g.cell-6,g.cell-6,valid?'#77b9a0':'#db8c7b','#fff2cc',3);c.restore();}}
   if(s.hint&&s.t-s.hintAt<4){for(const i of s.hint.cells){const p=gridCell(g,i);rect(c,p.x+5,p.y+5,g.cell-10,g.cell-10,null,'#fef2ae',4);}text(c,'零件 '+(s.hint.piece+1)+' · 旋转 '+s.hint.rotation+' 次',480,520,21,'#fff1cd');}
  }
  if(k==='tea'){
   l.values.forEach((v,i)=>{const p=gridCell(g,i),found=s.found.includes(i),up=found||s.opened.includes(i)||s.t<l.preview;const flip=effects.filter(e=>e.kind==='flip').at(-1),age=flip?clock-flip.born:1,scale=s.opened.at(-1)===i&&age<.22?Math.max(.09,Math.abs(Math.cos(age/.22*Math.PI))):1;
    c.save();c.translate(p.x+g.cell/2,p.y+g.cell/2);c.scale(scale,1);c.globalAlpha=found?.42:1;rect(c,-g.cell/2+4,-g.cell/2+6,g.cell-8,g.cell-10,up?'#fff9e9':'#578579',up?'#c6b183':'#a3c4ad',theme==='pixel'?2:8);
    if(up)drawItem(c,l.ids[v],theme,0,0,g.cell-18);else{rect(c,-g.cell/2+11,-g.cell/2+13,g.cell-22,g.cell-24,null,'#eed5a580',3);star(c,0,0,15,'#e4d0a7');}
    c.restore();
   });
   const pouring=effects.filter(e=>e.kind==='pour'&&clock-e.born<.85).at(-1),pourAge=pouring?clock-pouring.born:0;drawProp(c,8,theme,805,252,139,pouring?-.32*Math.sin(pourAge/.85*Math.PI):0);drawProp(c,9,theme,741,413,118);if(pouring){c.save();c.globalAlpha=Math.sin(pourAge/.85*Math.PI);line(c,[[740,266],[727,326],[741,384]],'#d4b066c9',5);c.restore();}
   if(s.t<l.preview)text(c,'记住香气 · '+Math.ceil(l.preview-s.t),480,30,25,'#405f56');
  }
  if(k==='nonogram'){
   const gg=g;
   l.rows.forEach((clue,y)=>text(c,clue.join('  '),g.x-20,g.y+y*g.cell+g.cell/2,22,'#f3dfb7','right'));
   l.cols.forEach((clue,x)=>clue.forEach((v,j)=>text(c,v,g.x+x*g.cell+g.cell/2,g.y-23-(clue.length-1-j)*24,22,'#f3dfb7')));
   s.cells.forEach((v,i)=>{const p=gridCell(gg,i);rect(c,p.x+2,p.y+2,g.cell-4,g.cell-4,v===1?'#8a967e':'#273e56',i%l.n===4?'#b9d1c39f':'#a5b9c142',2);if(v===1){c.save();c.shadowColor='#edd8a0';c.shadowBlur=12;star(c,p.x+g.cell/2,p.y+g.cell/2,g.cell*.23,'#ffedbe');c.restore()}if(v===-1)text(c,'×',p.x+g.cell/2,p.y+g.cell/2,23,'#8195a0');});
  }
  if(k==='pipes'){
   const water=s.flow.wet;
   s.masks.forEach((m,i)=>{const p=gridCell(g,i),cx=p.x+g.cell/2,cy=p.y+g.cell/2,wet=water.includes(i);
    rect(c,p.x+3,p.y+3,g.cell-6,g.cell-6,l.fixed.includes(i)?'#77989946':'#a0b8af1c','#dce7bc20',5);
    for(let d=0;d<4;d++)if(m&(1<<d)){const [dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][d],end=[cx+dx*g.cell/2,cy+dy*g.cell/2];line(c,[[cx,cy],end],'#152d35',22);line(c,[[cx-1,cy-1],[end[0]-1,end[1]-1]],'#d5b67d',17);line(c,[[cx,cy],end],wet?'#63c7cf':'#576d6c',10);if(wet){const pos=(clock*.75+i*.1)%1;circle(c,cx+dx*g.cell/2*pos,cy+dy*g.cell/2*pos,2.5,'#d4f8e1');}}
    if(m)circle(c,cx,cy,11,wet?'#74d5cc':'#718d86','#d7bd8c',3);
    if(i===l.source){circle(c,cx,cy,23,'#6dbbb5','#f2deb0',3);text(c,'泉',cx,cy,21,'#fff9dc');}
    if(l.tanks.includes(i)){circle(c,cx,cy,25,wet?'#a5ddd4':'#384f69','#d5b789',3);fish(c,cx,cy,33,clock,theme,'#ddaa86');}
   });
   for(const leak of s.flow.leaks){const p=gridCell(g,leak.i),[dx,dy]=[[0,-1],[1,0],[0,1],[-1,0]][leak.dir];circle(c,p.x+g.cell/2+dx*g.cell*.42,p.y+g.cell/2+dy*g.cell*.42,6+Math.sin(clock*4)*2,'#e59f77');}
  }
  if(k==='mosaic'){
   const im=stageImage(theme),f=im.complete?stageCrop(im,l.panel):null;
   s.order.forEach((v,i)=>{const p=gridCell(g,i);c.save();c.translate(p.x+g.cell/2,p.y+g.cell/2);c.rotate(s.rotations[i]*Math.PI/2);if(f)c.drawImage(im,f.x+v%l.n*f.w/l.n,f.y+Math.floor(v/l.n)*f.h/l.n,f.w/l.n,f.h/l.n,-g.cell/2+3,-g.cell/2+3,g.cell-6,g.cell-6);c.restore();rect(c,p.x+2,p.y+2,g.cell-4,g.cell-4,null,s.selected===i?'#feeab3':'#55473877',2);if(s.selected===i){c.lineWidth=4;rect(c,p.x+4,p.y+4,g.cell-8,g.cell-8,null,'#fff1bd',2);c.lineWidth=1;}});
   if(s.reference>0){panel(c,g.x-5,g.y-5,g.cols*g.cell+10,g.rows*g.cell+10);paintPanel(c,theme,l.panel,g.x,g.y,g.cols*g.cell,g.rows*g.cell);text(c,'原作 · '+Math.ceil(s.reference)+' 秒',480,510,22,'#6b5648');}
  }
  if(['sokoban','expedition'].includes(k)){
   for(let i=0;i<l.w*l.h;i++){const p=gridCell(g,i),known=k==='sokoban'||s.t<3||s.t<(s.mapUntil||0)||s.seen.includes(i),wall=l.walls.includes(i);
    if(!known){rect(c,p.x+1,p.y+1,g.cell-2,g.cell-2,'#294841',null,2);circle(c,p.x+g.cell*.5,p.y+g.cell*.5,2,'#6b8a76');continue}
    rect(c,p.x+1,p.y+1,g.cell-2,g.cell-2,wall?'#728767':'#e5dcb8',wall?'#587553':'#bdc39b44',2);
    if(wall){polygon(c,[[p.x+5,p.y+g.cell-7],[p.x+g.cell/2,p.y+7],[p.x+g.cell-5,p.y+g.cell-7]],theme==='pixel'?'#536e53':'#688660');line(c,[[p.x+g.cell/2,p.y+8],[p.x+g.cell/2,p.y+g.cell-7]],'#a6b881',2);}
    if(k==='sokoban'&&l.beds.includes(i)){rect(c,p.x+7,p.y+7,g.cell-14,g.cell-14,'#b0936b','#fff1c6',5);for(let j=0;j<3;j++)line(c,[[p.x+11,p.y+16+j*12],[p.x+g.cell-11,p.y+16+j*12]],'#755b42',2);star(c,p.x+g.cell/2,p.y+g.cell/2,12,'#f7df8e');}
    if(k==='expedition'&&l.targets.includes(i)&&!s.collected.includes(i))drawItem(c,'c22_1',theme,p.x+g.cell/2,p.y+g.cell/2,g.cell*.88);
    if(k==='expedition'&&i===l.exit){rect(c,p.x+6,p.y+6,g.cell-12,g.cell-12,'#588d78');polygon(c,[[p.x+7,p.y+g.cell-10],[p.x+g.cell/2,p.y+8],[p.x+g.cell-7,p.y+g.cell-10]],'#e5bd79');}
   }
   if(k==='sokoban')for(let n=0;n<s.crates.length;n++){const i=s.crates[n],p=gridCell(g,i),old=gridCell(g,s.lastCrates?.[n]??i),u=clamp((s.t-s.walkAt)/.16,0,1),x=old.x+(p.x-old.x)*u,y=old.y+(p.y-old.y)*u;drawProp(c,7,theme,x+g.cell/2,y+g.cell/2-2,g.cell*.94);if(l.beds.includes(i))star(c,x+g.cell*.77,y+g.cell*.15,6,'#fbdf99');}
   const walk=clamp((s.t-s.walkAt)/.16,0,1),a=gridCell(g,s.lastPlayer),b=gridCell(g,s.player),heading=s.player===s.lastPlayer?4:s.player-s.lastPlayer===1?2:s.player-s.lastPlayer===-1?6:s.player>s.lastPlayer?4:0;
   actor(c,theme,avatar,a.x+(b.x-a.x)*walk+g.cell/2,a.y+(b.y-a.y)*walk+g.cell*.9,g.cell*1.12,heading,walk<1?s.t:0);
  }
  if(k==='interior')roomDesign(s,g);
 }

 function roomDesign(s,g){
  const l=s.level,r=interiorReview(s),floorColors=theme==='pixel'?['#eee1bd','#e8d8ad']:['#f2e7d4','#ebe0cc'];
  panel(c,g.x-14,g.y-13,g.cols*g.cell+28,g.rows*g.cell+30,false,theme==='pixel');
  for(let i=0;i<l.w*l.h;i++){
   const p=gridCell(g,i);rect(c,p.x,p.y,g.cell,g.cell,floorColors[(i%l.w+(i/l.w|0))%2],null,0);
   line(c,[[p.x+2,p.y+g.cell*.33],[p.x+g.cell-2,p.y+g.cell*.33]],'#b9a77a24',1);
   line(c,[[p.x+2,p.y+g.cell*.66],[p.x+g.cell-2,p.y+g.cell*.66]],'#b9a77a24',1);
   rect(c,p.x+1,p.y+1,g.cell-2,g.cell-2,null,'#ab976825',0);
  }
  const win=gridCell(g,l.window),door=gridCell(g,l.door);
  rect(c,win.x-16,g.y-37,g.cell+32,29,'#a7c9c7','#f8ecd0',theme==='pixel'?0:3);
  line(c,[[win.x+g.cell/2,g.y-36],[win.x+g.cell/2,g.y-10]],'#fff7e8',3);
  polygon(c,[[win.x-10,g.y],[win.x+g.cell+10,g.y],[win.x+g.cell+28,g.y+g.cell*2.4],[win.x-22,g.y+g.cell*2.4]],'#ffffe23a');
  for(const p of s.furniture.filter(p=>p.floor)){
   const x=g.x+(p.x+p.w/2)*g.cell,y=g.y+(p.y+p.h/2)*g.cell;
   rect(c,g.x+p.x*g.cell+3,g.y+p.y*g.cell+3,p.w*g.cell-6,p.h*g.cell-6,'#a2b59755','#cfcfa155',theme==='pixel'?0:4);
   drawItem(c,p.id,theme,x,y,Math.min(p.w,p.h)*g.cell*.96,p.rotation*Math.PI/2);
  }
  if(s.routeVisible){
   const route=s.walkthrough?.route||r.route;
   if(route.length>1)line(c,route.map(i=>{const p=gridCell(g,i);return [p.x+g.cell/2,p.y+g.cell/2]}),'#689e8480',4,[7,5]);
   for(const i of route){const p=gridCell(g,i);circle(c,p.x+g.cell/2,p.y+g.cell/2,3,'#63997d');}
  }
  for(const i of l.walls){
   const p=gridCell(g,i);rect(c,p.x+2,p.y+8,g.cell-4,g.cell-8,'#95856b','#766a54',theme==='pixel'?0:3);
   rect(c,p.x+3,p.y+2,g.cell-6,g.cell-16,'#c1b393','#e7d7b8',theme==='pixel'?0:3);
   line(c,[[p.x+8,p.y+7],[p.x+g.cell-8,p.y+7]],'#f6e7c388',2);
  }
  const solids=s.furniture.filter(p=>!p.floor).sort((a,b)=>a.y+a.h-b.y-b.h);
  for(const p of solids){
   const x=g.x+(p.x+p.w/2)*g.cell,y=g.y+(p.y+p.h*.68)*g.cell;
   if(p.role==='light'){c.save();c.globalAlpha=.15+Math.sin(clock*1.1)*.025;ellipse(c,x,y-10,g.cell*1.1,g.cell*.75,'#f5d795');c.restore();}
   rect(c,g.x+p.x*g.cell+3,g.y+p.y*g.cell+3,p.w*g.cell-6,p.h*g.cell-6,null,'#7c816647',theme==='pixel'?0:3);
   ellipse(c,x,y+g.cell*.21,Math.max(17,p.w*g.cell*.33),g.cell*.12,'#64755522');
   const entry=clamp((s.t-p.at)/.25,0,1),size=Math.min(Math.max(p.w,p.h)*g.cell*.77,g.cell*1.25);
   drawItem(c,p.id,theme,x,y-(1-entry)*8,size);
   line(c,[[g.x+p.x*g.cell+7,g.y+(p.y+p.h)*g.cell-7],[g.x+(p.x+p.w)*g.cell-7,g.y+(p.y+p.h)*g.cell-7]],'#8f795949',2);
  }
  rect(c,door.x+6,door.y+g.cell-7,g.cell-12,13,'#a98462','#ead8b4',theme==='pixel'?0:3);
  text(c,'门',door.x+g.cell/2,door.y+g.cell+18,17,'#76654b');
  const walking=interiorWalker(s),position=walking||{x:l.door%l.w,y:l.door/l.w|0,heading:0,walking:false};
  actor(c,theme,avatar,g.x+(position.x+.5)*g.cell,g.y+(position.y+.82)*g.cell,g.cell*.92,position.heading,position.walking?s.t:0);
  rect(c,306,27,348,32,theme==='pixel'?'#efe3bbee':'#fff7e9ee','#b8a77d',theme==='pixel'?0:4);
  text(c,l.themeName+' · '+l.layoutName,480,43,19,'#49675d');
  const item=l.items[s.selected];
  if(item&&!s.walkthrough&&!s.furniture.some(p=>p.id===item.id)&&s.phase==='playing'){
   const x=Math.floor((s.pointer.x-g.x)/g.cell),y=Math.floor((s.pointer.y-g.y)/g.cell);
   if(x>=0&&x<l.w&&y>=0&&y<l.h){
    const check=checkInteriorPlacement(s,item,x,y,s.rotation),w=s.rotation%2?item.h:item.w,h=s.rotation%2?item.w:item.h;
    c.save();c.globalAlpha=.65;rect(c,g.x+x*g.cell+2,g.y+y*g.cell+2,w*g.cell-4,h*g.cell-4,check.ok?'#9eba9455':'#c9867c55',check.ok?'#658861':'#b3756b',theme==='pixel'?0:3);c.restore();
   }
  }
 }

 function kitchen(s,dt){
  panel(c,350,205,260,205,false,theme==='pixel');wood(c,372,253,216,125,'#c8a375',theme==='pixel');
  const j=s.jobs[s.ticket];
  if(j&&['prep','available'].includes(j.state)){j.ingredients.forEach((v,i)=>{const arrival=effects.findLast(e=>e.kind==='ingredient'&&e.ticket===j.id&&e.index===i),u=arrival?clamp((clock-arrival.born)/.24,0,1):1;c.save();c.globalAlpha=.55+.45*u;const cx=421+i*69,cy=322-(1-u)*22,parts=s.level.schemaVersion===KITCHEN_SCHEMA?Math.min(2,Math.max(0,j.cuts-i*2)):0;
    if(parts){const count=parts+1;for(let part=0;part<count;part++){c.save();c.beginPath();c.rect(cx-28+part*56/count+(part-(count-1)/2)*4,cy-30,56/count,60);c.clip();drawItem(c,s.level.ids[v],theme,cx+(part-(count-1)/2)*4,cy,55);c.restore();}}
    else drawItem(c,s.level.ids[v],theme,cx,cy,55);c.restore();});if(j.cuts&&s.level.schemaVersion!==KITCHEN_SCHEMA){for(let i=0;i<j.cuts;i++){const x=402+i*26;rect(c,x,353,11,6,palette[i%6],null,1);}}}
  // Grip anchor is on the wooden handle. Lift, contact and recovery share the same board coordinates.
  const cut=s.cutFlash>0,phase=cut?clamp(1-s.cutFlash/.36,0,1):0,stroke=cut?Math.sin(Math.min(1,phase/.58)*Math.PI):0;
  const guide=kitchenTarget(s);
  const targetX=s.level.schemaVersion===KITCHEN_SCHEMA?(cut?s.cutX+66:guide?guide.x+66:560):(cut&&j?.ingredients.length?487+((j.cuts-1)%j.ingredients.length)*69:560);knifeX+=(targetX-knifeX)*(1-Math.exp(-dt*18));
  const grip={x:knifeX,y:267-stroke*36},angle=-.05-stroke*.28;
  ellipse(c,494,346,43,7,'#58422d20');
  if(!drawProp(c,2,theme,grip.x,grip.y,151,angle,null,{x:.78,y:.26})){
   c.save();c.translate(grip.x,grip.y);c.rotate(angle);polygon(c,[[-80,28],[-18,-9],[-2,30],[-66,68]],'#d7dfda','#8b9e99');line(c,[[-18,-9],[16,-38]],'#795c45',14);c.restore();
  }
  if(guide){const x=guide.x;c.save();line(c,[[x,281],[x,352]],'#477c6990',2,[4,5]);circle(c,x,328,26,null,'#ebc77e',2);text(c,'↓ '+guide.remaining+' 刀',x,242,17,'#446b5a');c.restore();}
  if(s.level.schemaVersion===KITCHEN_SCHEMA&&s.kitchenStroke){const p=s.kitchenStroke;line(c,[[p.x,p.y],[s.pointer.x,s.pointer.y]],'#fff8d8',3);}
  if(cut&&phase>.5&&phase<.7){const x=s.level.schemaVersion===KITCHEN_SCHEMA?s.cutX:486;line(c,[[x-18,335],[x,338],[x+20,335]],'#fff7dc',2);}
  for(let station=0;station<2;station++){
   const x=station?735:225,y=335,job=s.jobs.find(j=>j.state==='cooking'&&j.station===station),ready=job&&job.cooked>=job.cook,over=job?clamp((job.cooked-job.cook)/job.window,0,1):0;
   ellipse(c,x,y+71,107,22,'#233b4028');rect(c,x-95,y+30,190,57,'#354b49','#b2bbad',10);rect(c,x-92,y+67,184,18,'#213e40',null,6);circle(c,x-55,y+75,5,'#c8b891');circle(c,x+55,y+75,5,'#c8b891');ellipse(c,x,y+29,76,20,'#e1bb75');if(job)for(let i=0;i<5;i++){const xx=x-52+i*26,yy=y+35;polygon(c,[[xx-9,yy+3],[xx-4,yy-15-Math.sin(clock*12+i)*8],[xx+3,yy-7],[xx+10,yy+3]],'#f4bb68');}
   if(!drawProp(c,s.id===10?1:0,theme,x,y-42,220)){
   const metal=c.createLinearGradient(x-84,0,x+84,0);metal.addColorStop(0,s.id===10?'#466e64':'#75503c');metal.addColorStop(.24,s.id===10?'#a3b8a0':'#d39766');metal.addColorStop(.58,s.id===10?'#789c86':'#b4764c');metal.addColorStop(1,s.id===10?'#355d55':'#754532');rect(c,x-81,y-26,162,63,metal,'#d4af76',19);ellipse(c,x,y+30,76,12,s.id===10?'#497a6c':'#8c5939');line(c,[[x-69,y+16],[x-69,y-7]],'#f5cd9580',5);ellipse(c,x,y-25,83,27,'#573f31','#e5c899');ellipse(c,x,y-26,71,19,job?(ready?'#d5b95b':'#b78b4b'):'#73655a');
   line(c,[[x-82,y-12],[x-104,y-12],[x-104,y+10],[x-79,y+10]],'#c99568',8);line(c,[[x+82,y-12],[x+104,y-12],[x+104,y+10],[x+79,y+10]],'#c99568',8);
   }
   if(job)ellipse(c,x,y-75,57,18,ready?'#c2b05a':'#9e844b');
   if(job){
    for(let n=0;n<6;n++){const phase=(clock*.45+n*.17)%1,xx=x+Math.sin(n*2+clock*.7)*45,yy=y-105-phase*100;c.save();c.globalAlpha=(1-phase)*.4;ellipse(c,xx,yy,7+phase*9,12+phase*12,'#fffae7');c.restore();}
    for(let n=0;n<5;n++){const a=n*2.3+clock*2;circle(c,x+Math.cos(a)*42,y-75+Math.sin(a)*10,2+Math.sin(clock*5+n),'#eddb97');}
    const a=Math.sin(clock*1.7)*.3;line(c,[[x+Math.sin(a)*35,y-75],[x+62+Math.sin(a)*35,y-165]],'#b89463',8);ellipse(c,x+Math.sin(a)*35,y-75,11,5,'#7b6443');
    progress(c,x-87,y+107,174,job.cooked/job.cook,ready?'#87b99d':'#dcb978');text(c,ready?'装盘窗口 '+Math.max(0,job.window-(job.cooked-job.cook)).toFixed(1)+'s':'温煮 '+job.cooked.toFixed(1)+' / '+job.cook.toFixed(1)+'s',x,y+138,21,'#475b53');
    if(ready){c.save();c.globalAlpha=.6+Math.sin(clock*8)*.3;circle(c,x,y-28,94,null,over>.7?'#d78665':'#fff4ba',3);c.restore();}
   }else text(c,'空闲炉灶',x,y+130,22,'#5c6e63');
  }
  // Order receipts are physical slips; actions and full ingredient names also appear below.
  const active=s.jobs.filter(j=>!['waiting','served','failed'].includes(j.state)).slice(0,5);
  active.forEach((j,i)=>{const x=80+i*167;panel(c,x,27,152,113,false,theme==='pixel');text(c,'客单 '+(j.id+1),x+76,51,21,'#527163');s.level.orders[j.id].ingredients.forEach((v,k)=>drawItem(c,s.level.ids[v],theme,x+42+k*37,88,40));progress(c,x+15,125,122,1-(s.t-j.arrival)/j.patience,'#d5a369','#d7ccad');if(s.ticket===j.id)line(c,[[x+12,36],[x+140,36]],'#6eaa91',4);});
  text(c,'切配工作台',480,430,23,'#50645a');
 }
 function pottery(s){
  const l=s.level,top=125,dy=270/11,pixel=theme==='pixel',clay='#d2a17c';
  const title=s.mode==='shape'?'拉坯 · '+l.formName:s.mode==='glaze'?'施釉 · 从口沿到器足':s.mode==='firing'?'守窑 · '+s.kiln.stage:'出窑 · 釉色显现';
  panel(c,302,29,356,42,false,pixel);text(c,title,480,50,22,'#594a3a');
  const vessel=(cx=480,cy=270,k=1,guide=false)=>{
   c.save();c.translate(cx,cy);c.scale(k,k);c.translate(-480,-270);
   const pts=s.radii.map((r,i)=>[480-r,top+i*dy]).concat([...s.radii].reverse().map((r,i)=>[480+r,top+(11-i)*dy]));
   const grad=c.createLinearGradient(320,0,640,0);grad.addColorStop(0,'#81573f');grad.addColorStop(.28,'#e0b18c');grad.addColorStop(.63,'#c79772');grad.addColorStop(1,'#77513f');
   ellipse(c,480,397,s.radii.at(-1),14,grad,'#75513d');polygon(c,pts,grad,'#6f563c');
   c.save();c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.clip();
   for(let i=0;i<38;i++)line(c,[[300,top+i*7],[660,top+i*7]],i%2?'#f2d9ae30':'#634d3820',1);
   for(let i=0;i<12;i++)for(let color=0;color<3;color++){
    c.globalAlpha=s.glaze[i]*s.pigments[i][color]*.9;
    rect(c,300,top+(i-.5)*dy,360,dy+1,POTTERY_COLORS[color].color,null,0);
   }
   c.globalAlpha=s.mode==='shape'?.07:.17;
   const sheen=425+Math.sin(clock*.6)*28;polygon(c,[[sheen-15,110],[sheen+10,110],[sheen+40,410],[sheen+15,410]],'#fff4de');
   c.globalAlpha=1;c.restore();ellipse(c,480,top,s.radii[0],17,s.mode==='shape'?clay:POTTERY_COLORS[l.ringColors[0]].color,'#74533b');ellipse(c,480,top,s.radii[0]-12,10,'#654836');
   if(guide){line(c,l.target.map((r,i)=>[480-r,top+i*dy]),'#fff1c5',3,[7,5]);line(c,l.target.map((r,i)=>[480+r,top+i*dy]),'#fff1c5',3,[7,5]);}
   if(s.mode==='reveal'&&!s.potteryOutcome?.passed)line(c,[[473,180],[483,230],[471,259],[483,300]],'#644338',3);
   c.restore();
  };
  if(s.mode==='shape'||s.mode==='glaze'){
   ellipse(c,480,445,194,46,'#57493843');ellipse(c,480,427,182,43,'#695448','#b69c73');ellipse(c,480,415,171,40,'#a17d59','#e5c18d');
   for(let i=0;i<6;i++){c.save();c.translate(480,415);c.scale(1,.23);c.rotate(clock*1.8+i*Math.PI/3);line(c,[[30,0],[166,0]],'#e5cc9860',3);c.restore();}
   drawProp(c,6,theme,480,450,373,0,171);vessel(480,270,1,s.mode==='shape');
   if(s.mode==='glaze'){
    text(c,'目标',684,100,15,'#fff1d2');
    l.glazeOrder.forEach((color,b)=>{const y=top+b*12/l.glazeBands*dy;
     rect(c,670,y-7,27,12/l.glazeBands*dy-6,POTTERY_COLORS[color].color,'#fff1d2',pixel?1:4);
     text(c,String(b+1),683,y+(12/l.glazeBands*dy-20)/2,17,'#fff6e8');
    });
   }
   if(s.holding){
    const y=clamp(s.pointer.y,top,395),x=s.pointer.x,left=x<480;c.save();c.translate(x,y);c.rotate(left?.3:-.3);
    if(s.mode==='shape'){ellipse(c,left?-17:17,6,26,14,'#eed2ae','#bc9878');for(let i=0;i<3;i++)ellipse(c,(left?1:-1)*5,(-1+i)*7,17,4,'#edd0a9');}
    else{line(c,[[0,0],[58,-51]],'#b69769',10);polygon(c,[[-11,3],[5,-15],[18,-3],[0,17]],POTTERY_COLORS[s.glazeColor].color);}
    c.restore();
   }
   progress(c,351,488,258,s.mode==='shape'?s.wet:potteryGlazeReview(s).quality,s.mode==='shape'?'#96c9c7':'#d5b493');
   text(c,s.mode==='shape'?'湿润时慢推，先修最偏离的一段':'刷错可以用正确釉色重新覆盖',480,514,17,'#fff1d2');
   return;
  }
  const k=s.kiln,target=potteryKilnTarget(l,k.elapsed),heat=clamp(k.temperature/100,0,1);
  if(s.mode==='firing'){
   const brick=pixel?'#a47858':'#b88c69';rect(c,290,99,380,279,brick,'#70513b',pixel?3:35);
   for(let row=0;row<7;row++){const y=105+row*37;line(c,[[294,y],[666,y]],'#f0cf9970',3);
    for(let x=300+(row%2)*40;x<665;x+=80)line(c,[[x,y],[x,y+35]],'#6e4c3f60',2);}
   rect(c,337,127,286,198,'#4c3930','#e6bc7c',pixel?3:60);
   const glow=c.createRadialGradient(480,276,25,480,240,160);glow.addColorStop(0,'#e9ac6680');glow.addColorStop(1,'#452f1a00');rect(c,339,130,282,193,glow,null,pixel?2:50);
   vessel(480,223,.60);
   rect(c,350,330,260,29,'#3f3028','#d8a878',pixel?1:8);
   for(let i=0;i<11;i++){const x=365+i*22,a=clock*(3+i*.07)+i,tip=334-(15+Math.sin(a)*9)*(k.actualFire+.15);
    polygon(c,[[x-10,357],[x+8,357],[x+3,tip]],i%2?'#e4a255':'#edc57a');}
   rect(c,425,89,110,11,'#5c493b','#d1b08b',pixel?1:4);rect(c,426,90,107*k.vent,9,'#c9d1c6',null,1);
   for(let i=0;i<4;i++){const age=(clock*.4+i*.25)%1;c.save();c.globalAlpha=(1-age)*k.vent*.3;
    ellipse(c,480+Math.sin(i+clock)*12,84-age*35,6+age*12,4+age*8,'#dfd7c3');c.restore();}
   text(c,Math.round(k.temperature)+'%',480,372,20,Math.abs(k.temperature-target.temperature)>l.kiln.tolerance?'#f0b59c':'#fff1d2');
  }else{
   const u=clamp(k.reveal/3.4,0,1);c.save();c.globalAlpha=.12+u*.17;
   circle(c,480,248,145,'#fff0b4');c.restore();ellipse(c,480,376,155,26,'#e3c58f','#b88e5c');
   vessel(480,235,.82+u*.05);if(s.potteryOutcome?.passed)for(let i=0;i<7;i++)star(c,480+Math.cos(clock*.6+i)*142,242+Math.sin(clock*.6+i)*124,3+Math.sin(clock*3+i),'#fff1c2');
   text(c,s.potteryOutcome?.passed?'釉色成器 · 正在评审':'窑变记录 · 本次材料保留',480,383,19,'#fff1d2');
  }
  panel(c,264,400,432,99,true,pixel);
  const chart={x:282,y:422,w:393,h:58},map=(at,t)=>[chart.x+at/l.kiln.duration*chart.w,chart.y+chart.h*(1-clamp((t-15)/85,0,1))];
  const curve=Array.from({length:61},(_,i)=>({at:l.kiln.duration*i/60,...potteryKilnTarget(l,l.kiln.duration*i/60)}));
  polygon(c,curve.map(v=>map(v.at,v.temperature+l.kiln.tolerance)).concat([...curve].reverse().map(v=>map(v.at,v.temperature-l.kiln.tolerance))),'#82bcb332');
  line(c,curve.map(v=>map(v.at,v.temperature)),'#93c7bc',2,[4,4]);line(c,k.trace.map(v=>map(v.at,v.temperature)),'#f1bd7b',3);
  const [x,y]=map(k.elapsed,k.temperature);circle(c,x,y,4,'#fff1cf');text(c,'目标曲线  ·  实际窑温',480,414,13,'#e8e3cc');
 }
 function waters(s){
  for(let i=0;i<18;i++){const x=(i*137+clock*12)%980,y=110+(i*73)%330;line(c,[[x,y],[x+18,y+Math.sin(clock+i)*2],[x+40,y]],'#dcf9e31a',2);}
  if(s.kind==='angling'){
   const l=s.level,spot=l.spots[Math.min(s.catch,l.spots.length-1)];
   l.spots.forEach((p,i)=>{if(i<s.catch)return;c.save();c.globalAlpha=.6;fish(c,p.x+Math.sin(clock+i)*9,p.y,52,clock,theme,'#265667',Math.PI,false,catchItem||'fish');c.restore();for(let r=0;r<2;r++)ellipse(c,p.x,p.y,58+r*24+Math.sin(clock*2)*3,22+r*10,null,'#cef2d75e');});
   // Rod flex and line arc make cast / waiting / fighting visually distinct.
   const origin={x:160,y:490},end=s.mode==='fight'?s.fish:s.castTarget||{x:330,y:335};
   const flex=s.mode==='fight'?s.tension*38:0,rodAngle=flex*.002;let tip={x:209+100*Math.cos(rodAngle)+92*Math.sin(rodAngle),y:402+100*Math.sin(rodAngle)-92*Math.cos(rodAngle)};
   const toolFrame=s.equipment&&itemFrame(s.equipment.id,theme);
   if(toolFrame?.img.complete&&toolFrame.img.naturalWidth){const r=toolFrame.frame,scale=180/Math.max(r.w,r.h),dx=(.94-.15)*r.w*scale,dy=(.06-.84)*r.h*scale;c.save();c.translate(209,402);c.rotate(rodAngle);c.drawImage(toolFrame.img,r.x,r.y,r.w,r.h,-.15*r.w*scale,-.84*r.h*scale,r.w*scale,r.h*scale);c.restore();tip={x:209+dx*Math.cos(rodAngle)-dy*Math.sin(rodAngle),y:402+dx*Math.sin(rodAngle)+dy*Math.cos(rodAngle)}}else drawProp(c,10,theme,209,402,213,rodAngle);
   let float=end;
   if(s.mode==='casting'){const t=clamp(s.castAge/.8,0,1);float={x:tip.x+(end.x-tip.x)*t,y:tip.y+(end.y-tip.y)*t-Math.sin(t*Math.PI)*120};}
   if(s.mode!=='cast'){
    c.beginPath();c.moveTo(tip.x,tip.y);c.quadraticCurveTo((tip.x+float.x)/2,Math.max(tip.y,float.y)+(s.mode==='fight'?20:55),float.x,float.y);c.strokeStyle='#fbf5d9bc';c.lineWidth=2;c.stroke();
    if(s.mode==='fight'){fish(c,s.fish.x,s.fish.y,76,clock*(s.surge?2:1),theme,'#d3a67a',Math.sin(clock)*.15,Math.cos((s.t-s.fightStart)*1.1+spot.phase)>0,catchItem||'fish');if(s.surge)for(let i=0;i<3;i++)ellipse(c,s.fish.x,s.fish.y,45+(clock*35+i*20)%65,12+(clock*10+i*8)%23,null,'#fff8dbaa');}
    else{const bob=s.mode==='bite'?Math.sin(clock*26)*9:Math.sin(clock*4)*3;ellipse(c,float.x,float.y+7,19,6,'#d0f1e548');rect(c,float.x-3,float.y-13+bob,6,22,'#f4e6b7','#456b68',2);rect(c,float.x-3,float.y-14+bob,6,9,'#d77965',null,1);if(s.mode==='bite'){circle(c,float.x,float.y-28,27,null,'#ffe6a1',3);text(c,'!',float.x,float.y-30,29,'#ffefb5');}}
   }
   const reelAngle=s.holding?clock*13:0;line(c,[[219,432],[219+Math.cos(reelAngle)*15,432+Math.sin(reelAngle)*15]],'#d9bd71',4);circle(c,219+Math.cos(reelAngle)*15,432+Math.sin(reelAngle)*15,4,'#6c5543');
   if(s.mode==='fight'){panel(c,325,435,410,75,true,theme==='pixel');text(c,s.surge?'猛烈挣扎 · 松线':'鱼渐渐平静 · 收线',530,458,24,s.surge?'#efb09b':'#c6e8ca');progress(c,350,485,360,s.progress,'#abd4bd');}
  }
  if(s.kind==='regatta'){
   const l=s.level;
   for(const reef of l.reefs){ellipse(c,reef.x,reef.y+15,reef.r+19,reef.r*.5+10,'#1b8e9255');polygon(c,[[reef.x-reef.r,reef.y+12],[reef.x-reef.r*.5,reef.y-reef.r*.5],[reef.x+reef.r*.12,reef.y-reef.r*.7],[reef.x+reef.r*.8,reef.y-reef.r*.2],[reef.x+reef.r,reef.y+20],[reef.x+10,reef.y+reef.r*.5]],'#697f83','#c5d3bc');polygon(c,[[reef.x-reef.r*.5,reef.y-reef.r*.5],[reef.x+reef.r*.12,reef.y-reef.r*.7],[reef.x+12,reef.y+reef.r*.4]],'#a5b9af');}
   l.path.slice(1,-1).forEach((p,i)=>{const active=s.gate===i+1,done=s.gate>i+1;ellipse(c,p.x,p.y+16,23,9,'#ecf4d873');circle(c,p.x,p.y-1,13,done?'#79bcb1':active?'#e6bb72':'#bdd6c5','#f8e9bb',3);line(c,[[p.x,p.y],[p.x,p.y-26]],'#f5dfb4',3);polygon(c,[[p.x,p.y-26],[p.x+20,p.y-20],[p.x,p.y-14]],active?'#e7a76a':'#9ebcb7');text(c,i+1,p.x,p.y-43,23,'#fff0c8');if(active){circle(c,p.x,p.y,40+Math.sin(clock*3)*3,null,'#f9e5a481',2);}});
   wood(c,868,397,90,103,'#b69365',theme==='pixel');for(let i=0;i<4;i++)circle(c,877+i%2*66,408+Math.floor(i/2)*79,5,'#72563e');rect(c,777,408,85,65,'#d1ebc128','#e5ebbd',5);text(c,'泊位 →',817,390,23,'#f7ebbf');
   for(const p of s.wake){const age=s.t-p.t;c.save();c.globalAlpha=clamp(1-age/2,0,1)*.55;c.translate(p.x,p.y);c.rotate(p.a);line(c,[[-age*12,-10-age*9],[2,0],[-age*12,10+age*9]],'#eef7d3',2);c.restore();}
   boat(c,s.boat.x,s.boat.y,s.boat.angle,69,theme,clock,true);
   if(s.holding){circle(c,s.pointer.x,s.pointer.y,18,null,'#f5ecc390',2);line(c,[[s.pointer.x-25,s.pointer.y],[s.pointer.x+25,s.pointer.y]],'#f5ecc390',1);}
  }
 }
 function night(s){
  const k=s.kind,l=s.level;
  if(k==='beacon'){
   c.fillStyle='#162843a8';c.fillRect(0,0,W,H);for(let i=0;i<20;i++){const x=(i*137+clock*7)%980,y=40+(i*79)%455;line(c,[[x,y],[x+22,y+Math.sin(clock+i)*2],[x+44,y]],'#bce1d719',2);}
   c.save();c.translate(480,280);c.rotate(s.angle);const g=c.createLinearGradient(0,0,425,0);g.addColorStop(0,'#fff0b89c');g.addColorStop(1,'#ffedb306');polygon(c,[[0,0],[440,-Math.tan(l.cone)*440],[440,Math.tan(l.cone)*440]],g);c.restore();
   for(const ship of s.ships){
    if(!['approaching','guided'].includes(ship.state))continue;
    const a=ship.liveAngle??ship.angle,age=s.t-ship.arrival,range=ship.state==='guided'?clamp(1-(s.t-ship.guidedAt)/3,0,1)*200:240-age/ship.deadline*90,x=480+Math.cos(a)*range,y=280+Math.sin(a)*range;
    if(ship.state==='guided'&&range===0)continue;
    boat(c,x,y,ship.state==='guided'?a+Math.PI:a+Math.PI/2,55,theme,clock,ship.state==='guided');if(ship.state==='approaching'){circle(c,x,y,38,null,'#e2ddaa70');progress(c,x-31,y-47,62,ship.lock/ship.need,'#f0d994');text(c,Math.ceil(ship.deadline-age)+'s',x,y+45,20,age>ship.deadline*.7?'#efa28c':'#e0e5ca');}
   }
   ellipse(c,480,389,93,32,'#8ad2c32b');polygon(c,[[399,389],[424,360],[478,348],[528,365],[560,391],[529,414],[446,418]],'#6c867f','#b8c0a0');polygon(c,[[411,385],[432,365],[479,354],[533,374],[548,389],[517,403],[449,408]],'#bbc1a2');drawProp(c,5,theme,480,324,theme==='pixel'?121:83,0,180);c.save();c.shadowBlur=20;c.shadowColor='#fff0b1';circle(c,480,280,6,'#fff8d7');c.restore();text(c,'灯塔',480,421,23,'#f0e6bf');
  }
  if(k==='rhythm'){
   panel(c,236,25,488,479,true,theme==='pixel');
   for(let lane=0;lane<4;lane++){const x=260+lane*110;rect(c,x,45,106,419,s.lanePulse[lane]>0?'#426b74c9':'#dce1c109',null,2);line(c,[[x+106,46],[x+106,465]],'#b3cbc039',1);circle(c,x+53,450,31,s.lanePulse[lane]?'#edcc98':'#36535f','#9fbdb2',2);text(c,['A','S','D','F'][lane],x+53,451,25,s.lanePulse[lane]?'#294e56':'#e9e1c4');}
   line(c,[[253,434],[707,434]],'#f4e2b0',4);
   for(const n of s.notes){
    const x=313+n.lane*110,y=434-(n.at-s.t)*145;if(y<-70||y>500||['hit','miss'].includes(n.state))continue;
    if(n.hold){rect(c,x-13,y-n.hold*145,26,n.hold*145,palette[n.lane]+'b3',null,8);rect(c,x-33,y-n.hold*145-5,66,10,palette[n.lane],null,3);}
    c.save();c.shadowBlur=15;c.shadowColor=palette[n.lane];rect(c,x-38,y-11,76,22,palette[n.lane],'#ffefcf',theme==='pixel'?2:8);c.restore();
   }
   if(s.combo>=3){text(c,s.combo,822,195,62,'#f2d7a6');text(c,'连击',822,241,24,'#c2d1c8');}
   text(c,l.bpm+' BPM',135,235,25,'#f0d5a5');
   if(s.t<l.leadIn)text(c,Math.max(1,Math.ceil((l.leadIn-s.t)/l.beat)),480,235,78,'#ffedbf');
  }
  if(k==='fireworks'){
   for(let i=0;i<l.targets.length;i++){const p=l.targets[i],lit=s.lit.includes(i);c.save();c.shadowColor=p.color;c.shadowBlur=lit?25:5;star(c,p.x,p.y,lit?21:13,p.color);c.restore();if(!lit){circle(c,p.x,p.y,[58,48,40][l.d-1],null,p.color+'70',2);text(c,i+1,p.x,p.y-29,23,'#f0deb8');}}
   c.save();c.translate(480,475);c.rotate(s.aim+Math.PI/2);rect(c,-17,-47,34,68,'#62768c','#d7c299',4);rect(c,-20,-54,40,15,'#ae8966','#eed8ab',2);c.restore();wood(c,443,491,74,17,'#947753',theme==='pixel');
   if(s.holding&&!s.projectile){line(c,[[480,475],[480+Math.cos(s.aim)*130,475+Math.sin(s.aim)*130]],'#e6d7b5',2,[5,8]);circle(c,480,475,59,null,'#e7d1a251',4);c.beginPath();c.arc(480,475,59,-Math.PI/2,-Math.PI/2+s.charge*Math.PI*2);c.lineWidth=6;c.strokeStyle='#f2cb8b';c.stroke();}
   if(s.projectile){const p=s.projectile,pos=firePosition(l,p.angle,p.power,p.age);c.save();c.shadowColor='#ffe2a0';c.shadowBlur=14;line(c,p.trail,'#f7cf8c',3);circle(c,pos.x,pos.y,5,'#fff7da');c.restore();}
   text(c,'海风 '+(l.wind<0?'←':'→')+' '+Math.abs(l.wind).toFixed(0),122,68,24,'#cfdfd1');
  }
 }
 function photo(s){
  const q=photoSubject(s),clarity=clamp(1-Math.abs(q.focus-s.focus)/20,0,1);
  c.save();c.filter='blur('+((1-clarity)*5).toFixed(1)+'px)';
  if(q.species===0){c.save();c.translate(q.x,q.y);const wing=.45+Math.abs(Math.sin(clock*7))*.65;c.scale(wing,1);ellipse(c,-21,-8,26,32,'#eac993','#a87755');ellipse(c,21,-8,26,32,'#ebba9b','#a87755');ellipse(c,-13,21,15,18,'#ca96b5');ellipse(c,13,21,15,18,'#cba9c4');c.restore();line(c,[[q.x,q.y-26],[q.x,q.y+26]],'#695648',5);}
  if(q.species===1){c.save();c.translate(q.x,q.y);ellipse(c,0,7,38,22,'#dfb97e','#956f53');const flap=Math.sin(clock*5)*20;polygon(c,[[-6,0],[-60,-28-flap],[-37,11]],'#b78162');polygon(c,[[9,0],[57,-25-flap],[38,9]],'#e5cd96');circle(c,24,-8,14,'#f2dfb8');circle(c,29,-10,2.5,'#445455');polygon(c,[[35,-9],[48,-4],[36,0]],'#c69662');c.restore();}
  if(q.species===2){c.save();c.translate(q.x,q.y);const open=.6+q.pose*.4;for(let i=0;i<6;i++){const a=i*Math.PI/3;c.save();c.rotate(a);ellipse(c,0,-23,14*open,29*open,palette[(i+2)%6],'#cfaaa170');c.restore();}circle(c,0,0,13,'#d2ad56');line(c,[[0,30],[5,80]],'#60805d',7);ellipse(c,15,61,18,8,'#8ba476');c.restore();}
  c.restore();const a=s.camera;rect(c,70,55,820,432,null,'#f1e5bb77',2);
  c.save();c.setLineDash([3,8]);line(c,[[342,56],[342,487]],'#f1e5bb44');line(c,[[616,56],[616,487]],'#f1e5bb44');line(c,[[70,199],[890,199]],'#f1e5bb44');line(c,[[70,343],[890,343]],'#f1e5bb44');c.restore();
  const color=clarity>.85?'#fff1b9':'#efd5b580';for(const [dx,dy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){line(c,[[a.x+dx*75,a.y+dy*46],[a.x+dx*75,a.y+dy*65],[a.x+dx*55,a.y+dy*65]],color,4);}
  const delta=(1-clarity)*18;circle(c,a.x-delta,a.y,24,null,'#eecc9777',2);circle(c,a.x+delta,a.y,24,null,'#fcf5d3aa',2);
  text(c,['蝶影','海鸟','花开的瞬间'][q.species],151,30,22,'#e9efd3');drawProp(c,11,theme,113,440,95);text(c,'焦距 '+Math.round(s.focus),807,30,22,'#e9efd3');text(c,'姿态 '+(q.pose>.7?'舒展':'等待时机'),795,508,21,'#e9efd3');
 }
 function fashion(s){
  const l=s.level,brief=coutureBrief(s),review=s.runway?.review||outfitScore(s.outfit.map(id=>l.items.find(i=>i.id===id)),brief),show=s.runway,u=show?clamp(show.elapsed/show.duration,0,1):0;
  panel(c,236,31,488,460,false,theme==='pixel');
  text(c,brief.themeName,480,64,28,'#5d7466');text(c,(brief.clientName||'顾客')+' · '+(brief.request||'主题搭配'),480,92,18,'#8b816a');line(c,[[286,110],[674,110]],'#caba97',1);
  const labels=['主服','配饰','叠搭'],positions=show?[[342,242],[480,242],[618,242]]:[[350,244],[605,185],[580,355]];
  if(show){
   c.save();c.globalAlpha=.12+Math.sin(u*Math.PI)*.1;
   for(let i=0;i<3;i++)polygon(c,[[310+i*170,113],[positions[i][0]-65,358],[positions[i][0]+65,358]],theme==='pixel'?'#d7b775':'#ead49d');
   c.restore();line(c,[[280,367],[680,367]],'#c4b290',2);
  }
  positions.forEach(([x,y],slot)=>{
   const id=show?show.outfit[slot]:s.outfit[slot],width=show?124:160,entry=show?clamp((u-slot*.045)/.24,0,1):1,ease=1-(1-entry)**3,cy=y+(show?(1-ease)*30:0);
   c.save();c.globalAlpha=show?.35+ease*.65:1;
   ellipse(c,x,cy+57,width*.42,12,'#83927c19');
   rect(c,x-width/2,cy-80,width,150,id?'#fffaf0':'#e2decd44','#bfb79977',theme==='pixel'?0:5);
   if(theme==='origami')polygon(c,[[x+width/2-17,cy-80],[x+width/2,cy-63],[x+width/2-17,cy-63]],'#e5d9bd');
   if(id){const change=effects.findLast(e=>e.kind==='ribbon'&&e.art===id),v=show?1:change?clamp((clock-change.born)/.24,0,1):1;drawItem(c,id,theme,x,cy-5-(1-v)*18,(show?132:153)+(1-v)*8);}
   else text(c,labels[slot],x,cy,27,'#a6aa96');
   circle(c,x-width/2+20,cy-71,4,'#b79a66');
   if(show)text(c,labels[slot],x,cy+93,18,'#81715a');
   c.restore();
  });
  if(show){
   const checks=['预算合宜','主题鲜明','穿着舒适'],revealed=Math.min(3,Math.floor(clamp((u-.28)/.5,0,1)*3)+1);
   checks.forEach((label,i)=>{if(i<revealed){const alpha=clamp((u-.28-i*.16)/.09,0,1);c.save();c.globalAlpha=alpha;text(c,'✓ '+label,338+i*142,402,18,'#607c66');c.restore();}});
   if(u>.72){c.save();c.globalAlpha=clamp((u-.72)/.12,0,1);text(c,review.score+' 分 · 顾客认可',480,453,25,'#957541');c.restore();}
   else text(c,'搭配展映 · 逐项评审',480,453,21,'#7a806b');
  }else text(c,'主题 '+review.style+' / '+brief.styleGoal+'     舒适 '+review.comfort+' / '+brief.comfortGoal,480,459,22,'#60786b');
 }
 function brush(s){
  if(paintBrushStudio(c,s,theme,clock))return;
  panel(c,182,65,588,416,false,theme==='pixel');line(c,[[204,84],[744,84]],'#c2b493',2);
  const colors=['#4e817a','#7d995f','#b78490'];
  for(let k=0;k<s.level.strokes.length;k++)line(c,s.level.strokes[k].points,'#acae9745',2,[4,7]);
  for(let k=0;k<s.level.strokes.length;k++){const pts=s.painted.filter(p=>p.stroke===k);if(pts.length>1){line(c,pts,colors[k]+'40',19);line(c,pts,colors[k],11);line(c,pts.map(p=>({x:p.x-2,y:p.y-1})), '#f8eaca33',2);}}
  const current=s.level.strokes[s.stroke],target=current?.points[s.node];if(target){circle(c,target.x,target.y,s.level.radius,null,colors[current.color]+'6f',2);circle(c,target.x,target.y,5+Math.sin(clock*4)*1.5,colors[current.color]);}
  const p=s.pointer;if(s.phase==='playing'&&!drawProp(c,3,theme,p.x+36,p.y-49,103,-.04)){c.save();c.translate(p.x,p.y);c.rotate(.65);polygon(c,[[-3,4],[-7,-18],[6,-18]],colors[s.color]);rect(c,-5,-99,10,84,'#ad8859','#d6b87f',3);c.restore();}
  for(let i=0;i<3;i++){ellipse(c,822,164+i*99,32,15,'#d0c0a1','#826e55');ellipse(c,822,161+i*99,26,10,colors[i]);}text(c,'蘸墨',822,462,23,'#7f7b61');
 }
 function animationEffects(dt){
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-dt*.7);p.vy+=p.gravity*dt;c.save();c.globalAlpha=clamp(p.life/p.max,0,1);if(p.firework){c.globalCompositeOperation='lighter';line(c,[[p.x-p.vx*.06,p.y-p.vy*.06],[p.x,p.y]],p.color,p.r);if(theme==='pixel'){rect(c,p.x-1,p.y-1,3,3,'#fff2ce',null,0)}else{circle(c,p.x,p.y,1.5,'#fff2cf')}}else if(theme==='pixel'){rect(c,p.x,p.y,p.r*1.8,p.r*1.8,p.color,null,0)}else{c.translate(p.x,p.y);c.rotate(clock*2);polygon(c,[[-p.r,0],[0,-p.r*1.7],[p.r,0],[0,p.r]],p.color)}c.restore();}
  for(let i=effects.length-1;i>=0;i--){const e=effects[i],age=clock-e.born;if(age>2.8){effects.splice(i,1);continue}c.save();
   if(['splash','water','bite','buoy','guide'].includes(e.kind)&&age<1){c.globalAlpha=1-age;for(let j=0;j<3;j++)ellipse(c,e.x,e.y,12+age*80+j*10,5+age*25+j*4,null,'#edfad5');}
   if(['serve','catch','collect','pour'].includes(e.kind)&&e.art&&age<1){c.globalAlpha=clamp((1-age)*2,0,1);drawItem(c,e.art,theme,e.x,e.y-age*90-Math.sin(age*Math.PI)*30,60+age*20,Math.sin(age*Math.PI)*.2);}
   if(e.kind==='firework'&&age<.45&&!reduced){c.globalCompositeOperation='lighter';const r=24+age*210,g=c.createRadialGradient(e.x,e.y,0,e.x,e.y,r);g.addColorStop(0,'#fff0bf88');g.addColorStop(.28,(e.color||'#dfb8dc')+'44');g.addColorStop(1,'#e6b58d00');circle(c,e.x,e.y,r,g);circle(c,e.x,e.y,age*175,null,(e.color||'#dfb8dc')+'55',1.4);}
   if(e.kind==='shutter'&&age<.18&&!reduced){c.globalAlpha=(.18-age)*3;c.fillStyle='#fff8e6';c.fillRect(0,0,W,H);}
   if(e.kind==='note'&&age<.7){c.globalAlpha=1-age/.7;circle(c,e.x,e.y,20+age*60,null,e.perfect?'#fbe4a7':'#afdfcf',3);}
   if(['shake','crash','burn','break','failure'].includes(e.kind)&&age<.3){c.globalAlpha=(.3-age)*.35;c.fillStyle='#b25c51';c.fillRect(0,0,W,H);}
   if(e.kind==='victory'&&age>1&&age<2.7){c.globalAlpha=Math.sin((age-1)/1.7*Math.PI)*.92;circle(c,480,255,65,'#213d4966','#f6e2b2',2);star(c,480,255,41,'#f8db9c');}
   c.restore();
  }
 }
 return {
  event:burst,
  render(s,now){
   const dt=last?Math.min(.05,(now-last)/1000):0;last=now;clock+=dt;
   const dpr=Math.min(2,window.devicePixelRatio||1),width=Math.max(1,Math.round(canvas.clientWidth*dpr)),height=Math.max(1,Math.round(canvas.clientHeight*dpr));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   const scale=theme==='pixel'?.75:Math.min(1.5,Math.max(1,canvas.clientWidth/W));if(surface.width!==Math.round(W*scale)||surface.height!==Math.round(H*scale)){surface.width=Math.round(W*scale);surface.height=Math.round(H*scale);}c.setTransform(scale,0,0,scale,0,0);c.imageSmoothingEnabled=theme!=='pixel';c.lineJoin='round';c.lineCap='round';c.lineWidth=1;c.clearRect(0,0,W,H);
   if(s.kind==='pottery'){const im=potteryStageImage(theme);if(im.complete&&im.naturalWidth)c.drawImage(im,0,0,W,H);else{c.fillStyle='#b88b68';c.fillRect(0,0,W,H);}}else paintPanel(c,theme,WORKSHOP_GAMES[s.id].panel);
   if(s.kind==='regatta'){const im=stageImage(theme);if(im.complete&&im.naturalWidth){const f=stageCrop(im,2);c.drawImage(im,f.x+f.w*.15,f.y+f.h*.08,f.w*.7,f.h*.84,0,0,W,H);}}
   const v=viewBounds(s,canvas.clientWidth<600);c.save();c.scale(W/v.w,H/v.h);c.translate(-v.x,-v.y);
   if(boardGeometry(s))paintGrid(s);
   if(s.kind==='kitchen')kitchen(s,dt);
   if(s.kind==='pottery')pottery(s);
   if(['angling','regatta'].includes(s.kind))waters(s);
   if(['beacon','rhythm','fireworks'].includes(s.kind))night(s);
   if(s.kind==='photo')photo(s);
   if(s.kind==='couture')fashion(s);
   if(s.kind==='brush')brush(s);
   animationEffects(dt);c.restore();out.imageSmoothingEnabled=theme!=='pixel';out.clearRect(0,0,canvas.width,canvas.height);out.drawImage(surface,0,0,canvas.width,canvas.height);
  },
  destroy(){particles.length=0;effects.length=0}
 };
}
