import {makeBrushLevel,initBrush,brushAction,stepBrush,BRUSH_SCHEMA} from './brushStudio.js';
import {makePotteryLevel,initPottery,potteryAction,stepPottery,potteryShapeReview} from './potteryStudio.js';
import {seededRandom,shuffle,rotatePiece,pieceOffsets} from './gameLevels.js';
import {WORKSHOP_GAMES} from './workshopCatalog.js';
import {TOOLS} from './equipmentRules.js';
import {makeInteriorLevel,reviewInterior,placeInteriorFurniture,pickupInteriorFurniture,undoInteriorFurniture,makeInteriorWalkthrough,advanceInteriorWalkthrough} from './interiorDesign.js';
export function anglingEquipment(s){const t=TOOLS[s.equipment?.id],owned=s.equipment?.source==='owned'&&t?.action==='fish',bonus=owned?t.trackingBonus:0;return {id:t?.action==='fish'?t.id:'rod',source:owned?'owned':'borrowed',trackingRadius:130+bonus,castRadius:95+bonus};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export {clamp};
export function formatWorkshopTime(seconds){const n=Math.max(0,Math.ceil(Number.isFinite(seconds)?seconds:0));return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}

export const DIRS=[[0,-1],[1,0],[0,1],[-1,0]];
const inverse=[2,3,0,1];
export function neighbors(i,w,h){return DIRS.map(([dx,dy],dir)=>({i:i+dx+dy*w,dir})).filter(n=>n.i>=0&&n.i<w*h&&Math.abs(n.i%w-i%w)+Math.abs((n.i/w|0)-(i/w|0))===1)}
export function pathBetween(start,end,walls,w,h){const q=[start],prev=new Map([[start,-1]]),block=new Set(walls);for(let k=0;k<q.length;k++){const n=q[k];if(n===end){const p=[];for(let i=n;i!==-1;i=prev.get(i))p.push(i);return p.reverse()}for(const x of neighbors(n,w,h))if(!block.has(x.i)&&!prev.has(x.i)){prev.set(x.i,n);q.push(x.i)}}return []}
export function cluesFor(values){const out=[];let n=0;for(const v of [...values,0]){if(v)n++;else if(n){out.push(n);n=0}}return out.length?out:[0]}
export function solveNonogram(rows,cols,limit=2){
 const h=rows.length,w=cols.length,patterns=rows.map(clue=>Array.from({length:1<<w},(_,bits)=>Array.from({length:w},(_,x)=>(bits>>x)&1)).filter(a=>cluesFor(a).join()===clue.join()));
 const colPatterns=cols.map(clue=>Array.from({length:1<<h},(_,bits)=>Array.from({length:h},(_,y)=>(bits>>y)&1)).filter(a=>cluesFor(a).join()===clue.join()));
 const solutions=[],board=[];function walk(y){if(solutions.length>=limit)return;if(y===h){solutions.push(board.flat());return}for(const row of patterns[y]){board.push(row);if(cols.every((_,x)=>colPatterns[x].some(p=>board.every((r,i)=>r[x]===p[i]))))walk(y+1);board.pop();}}
 walk(0);return solutions;
}
function nonogramLevel(r,d){
 const n=4+d;
 for(let tries=0;tries<150;tries++){
  const values=Array.from({length:n*n},()=>r()<.47?1:0),rows=Array.from({length:n},(_,y)=>cluesFor(values.slice(y*n,(y+1)*n))),cols=Array.from({length:n},(_,x)=>cluesFor(Array.from({length:n},(_,y)=>values[y*n+x])));
  if(rows.some(c=>c[0]===0||c[0]===n)||cols.some(c=>c[0]===0||c[0]===n))continue;
  if(solveNonogram(rows,cols).length===1)return {n,values,rows,cols};
 }
 const values=Array.from({length:n*n},(_,i)=>i%n===0||i%n===n-1||Math.floor(i/n)===0||Math.floor(i/n)===n-1?1:0);
 return {n,values,rows:Array.from({length:n},(_,y)=>cluesFor(values.slice(y*n,(y+1)*n))),cols:Array.from({length:n},(_,x)=>cluesFor(Array.from({length:n},(_,y)=>values[y*n+x])))};
}
export function rotateMask(mask,times=1){for(let n=0;n<times;n++)mask=((mask<<1)&15)|(mask>>3);return mask}
function pipeLevel(r,d){
 const w=4+(d===3),h=3+d,n=w*h,visited=new Set([0]),stack=[0],edges=[];
 while(stack.length){const at=stack.at(-1),options=shuffle(neighbors(at,w,h).filter(x=>!visited.has(x.i)),r);if(!options.length){stack.pop();continue}const next=options[0];visited.add(next.i);edges.push([at,next.i,next.dir]);stack.push(next.i)}
 const masks=Array(n).fill(0);for(const [a,b,dir] of edges){masks[a]|=1<<dir;masks[b]|=1<<inverse[dir]}
 const leaves=masks.flatMap((m,i)=>i&&((m&(m-1))===0)?[i]:[]),tanks=shuffle(leaves,r).slice(0,2+d);
 const needed=new Set([0]);for(const tank of tanks){// Follow tree edges so every generated tank has a solution.
  const q=[0],prev=new Map([[0,-1]]);for(let k=0;k<q.length;k++)for(const [dx,dy] of DIRS){const a=q[k],b=a+dx+dy*w;if(!edges.some(e=>e[0]===a&&e[1]===b||e[1]===a&&e[0]===b)||prev.has(b))continue;prev.set(b,a);q.push(b)}
  for(let at=tank;at!==-1;at=prev.get(at))needed.add(at);
 }
 const solved=Array(n).fill(0);for(const [a,b,dir] of edges)if(needed.has(a)&&needed.has(b)){solved[a]|=1<<dir;solved[b]|=1<<inverse[dir]}
 const fixed=[0,...tanks],turns=solved.map((m,i)=>fixed.includes(i)?0:(1+(r()*3|0)));
 return {w,h,source:0,tanks,solved,initial:solved.map((m,i)=>rotateMask(m,turns[i])),fixed};
}
export function flowPipes(masks,level){
 const {w,h,source,tanks}=level,q=[source],wet=new Set(q),leaks=[];
 for(let k=0;k<q.length;k++){const i=q[k];for(let dir=0;dir<4;dir++)if(masks[i]&(1<<dir)){
  const next=neighbors(i,w,h).find(x=>x.dir===dir);if(!next||!(masks[next.i]&(1<<inverse[dir]))){leaks.push({i,dir});continue}
  if(!wet.has(next.i)){wet.add(next.i);q.push(next.i)}
 }}
 return {wet:[...wet],leaks,connected:tanks.filter(i=>wet.has(i)).length,complete:tanks.every(i=>wet.has(i))&&leaks.length===0};
}
function joineryLevel(r,d){
 const w=7,h=5,count=3+d,shapes=[[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[1,1],[1,2]],[[0,0],[1,0],[2,0],[0,1],[0,2]]];
 for(let tries=0;tries<90;tries++){
  const pieces=shuffle(shapes,r).slice(0,count).map(p=>rotatePiece(p,r()*4|0)),used=new Set(),solution=[];
  for(let p=0;p<count;p++){
   const candidates=[];for(let rotation=0;rotation<4;rotation++)for(let anchor=0;anchor<w*h;anchor++){
    const points=pieceOffsets(pieces[p],rotation).map(([dx,dy])=>[anchor%w+dx,(anchor/w|0)+dy]);
    if(points.some(([x,y])=>x<0||x>=w||y<0||y>=h||used.has(y*w+x)))continue;
    const cells=points.map(([x,y])=>y*w+x);
    if(p&&!cells.some(i=>neighbors(i,w,h).some(n=>used.has(n.i))))continue;
    candidates.push({piece:p,rotation,anchor,cells});
   }
   if(!candidates.length)break;const m=candidates[r()*candidates.length|0];solution.push(m);m.cells.forEach(i=>used.add(i));
  }
  if(solution.length===count)return {w,h,pieces,target:[...used],solution};
 }
 throw Error('Could not construct a joinery pattern');
}
function sokobanLevel(r,d){
 const w=7,h=7,walls=[];for(let i=0;i<w*h;i++)if(i%w===0||i%w===w-1||(i/w|0)===0||(i/w|0)===h-1)walls.push(i);
 // Reverse legal pulls preserve an explicit forward solution.
 const beds=shuffle([16,17,18,23,24,25,30,31,32],r).slice(0,1+d),solvedCrates=[...beds];let best;
 for(let attempt=0;attempt<90;attempt++){
  let crates=[...beds],player=36;const reverse=[];
  for(let k=0;k<100+d*35;k++){
   const options=shuffle(neighbors(player,w,h).filter(x=>!walls.includes(x.i)&&!crates.includes(x.i)),r);
   if(!options.length)break;
   const pulling=options.filter(({dir})=>{const [dx,dy]=DIRS[dir];return crates.includes(player-dx-dy*w)});
   const step=pulling.length&&r()<.84?pulling[0]:options[0],old=player,[dx,dy]=DIRS[step.dir],behind=old-dx-dy*w,crate=crates.indexOf(behind);
   const pull=crate>=0&&r()<.9;if(pull)crates[crate]=old;
   player=step.i;reverse.push({dir:inverse[step.dir],pull});
  }
  const different=crates.filter(i=>!beds.includes(i)).length,solution=reverse.reverse().map(s=>s.dir);
  if(different>=Math.min(2,beds.length)){best={w,h,walls,beds,crates,player,solution,solvedCrates};break}
 }
 return best||{w,h,walls,beds:[16,18],crates:[23,25],player:31,solution:[3,0,2,1,1,0],solvedCrates:[16,18]};
}
function expeditionLevel(r,d){
 const w=11,h=9,walls=new Set(Array.from({length:w*h},(_,i)=>i)),stack=[w+1],seen=new Set(stack);walls.delete(stack[0]);
 while(stack.length){const i=stack.at(-1),next=shuffle(DIRS.map(([dx,dy],dir)=>({i:i+dx*2+dy*w*2,between:i+dx+dy*w,dir})).filter(n=>n.i%w>0&&n.i%w<w-1&&(n.i/w|0)>0&&(n.i/w|0)<h-1&&!seen.has(n.i)),r);if(!next.length){stack.pop();continue}const n=next[0];seen.add(n.i);walls.delete(n.i);walls.delete(n.between);stack.push(n.i)}
 for(let i=0;i<5-d;i++){const candidates=[...walls].filter(i=>i%w>1&&i%w<w-2&&(i/w|0)>1&&(i/w|0)<h-2);walls.delete(candidates[r()*candidates.length|0]);}
 const start=w+1,exit=w*(h-2)+w-2,floors=Array.from({length:w*h},(_,i)=>i).filter(i=>!walls.has(i)&&i!==start&&i!==exit);
 const targets=shuffle(floors,r).slice(0,2+(d===3));
 function route(at,remaining){if(!remaining.length)return {steps:pathBetween(at,exit,[...walls],w,h).slice(1),order:[]};let best;for(const t of remaining){const tail=route(t,remaining.filter(x=>x!==t)),steps=[...pathBetween(at,t,[...walls],w,h).slice(1),...tail.steps];if(!best||steps.length<best.steps.length)best={steps,order:[t,...tail.order]}}return best}
 const best=route(start,targets);
 return {w,h,walls:[...walls],start,exit,targets,solution:best.steps,budget:best.steps.length+[24,18,12][d-1],sight:d===1?3:2};
}
const wardrobe=[
 {id:'c4_9',slot:0,cost:5,tags:[5,1,2],comfort:3},{id:'c4_8',slot:0,cost:6,tags:[1,2,6],comfort:1},{id:'c4_1',slot:0,cost:3,tags:[2,4,1],comfort:4},{id:'c4_11',slot:0,cost:5,tags:[2,3,5],comfort:2},
 {id:'c4_3',slot:1,cost:2,tags:[4,3,0],comfort:3},{id:'c4_10',slot:1,cost:4,tags:[2,1,5],comfort:1},{id:'c4_4',slot:1,cost:2,tags:[1,5,0],comfort:4},
 {id:'c4_6',slot:2,cost:5,tags:[1,1,6],comfort:2},{id:'c4_5',slot:2,cost:3,tags:[1,5,2],comfort:3},{id:'c4_2',slot:2,cost:2,tags:[1,5,0],comfort:4},{id:'c4_7',slot:0,cost:3,tags:[5,2,1],comfort:3}
];
export function outfitScore(items,level){
 const selected=items.filter(Boolean),cost=selected.reduce((n,i)=>n+i.cost,0),style=selected.reduce((n,i)=>n+i.tags[level.theme],0),comfort=selected.reduce((n,i)=>n+i.comfort,0);
 const slots=[0,1,2].every(slot=>selected.filter(i=>i.slot===slot).length===1)&&selected.length===3;
 const budget=cost<=level.budget,styled=style>=level.styleGoal,comfortable=comfort>=level.comfortGoal;
 const accentValue=level.accent?selected.find(i=>i.slot===level.accent.slot)?.tags[level.theme]||0:0;
 const accented=!level.accent||accentValue>=level.accent.minimum,complete=slots&&budget&&styled&&comfortable&&accented;
 const unmet=[!slots?'每类各选一件':null,!budget?'超预算 '+(cost-level.budget):null,!styled?'主题还差 '+(level.styleGoal-style):null,!comfortable?'舒适度还差 '+(level.comfortGoal-comfort):null,!accented?['主服','配饰','叠搭'][level.accent.slot]+'风格还差 '+(level.accent.minimum-accentValue):null].filter(Boolean);
 return {cost,style,comfort,slots,budget,styled,comfortable,accented,accentValue,complete,unmet,score:complete?clamp(Math.round(80+(style-level.styleGoal)*4+(comfort-level.comfortGoal)*2+(level.budget-cost)*2),80,100):0};
}
const coutureThemes=['海风航海','花园手作','星夜舞会'];
const coutureRequests=[
 ['海边巡游','港口合影','帆船观赛','海风漫步'],
 ['温室赏花','庭院午茶','手作市集','花园野餐'],
 ['星夜聚会','露台音乐会','月光晚宴','灯下舞会']
];
export function coutureBrief(s){return s.level.briefs?.[Math.min(s.clientIndex||0,s.level.briefs.length-1)]||s.level;}
function coutureLevel(r,d){
 const items=shuffle(wardrobe,r),themes=shuffle([0,1,2],r),briefs=[];
 for(let index=0;index<d;index++){
  const theme=themes[index],budget=[13,12,11][d-1]-(r()<.5?1:0),comfortGoal=[4,5,6][d-1]+(r()*3|0);
  const candidates=[];
  for(const a of items.filter(i=>i.slot===0))for(const b of items.filter(i=>i.slot===1))for(const c of items.filter(i=>i.slot===2)){
   const combo=[a,b,c],cost=combo.reduce((n,i)=>n+i.cost,0),comfort=combo.reduce((n,i)=>n+i.comfort,0),style=combo.reduce((n,i)=>n+i.tags[theme],0);
   if(cost<=budget&&comfort>=comfortGoal)candidates.push({ids:combo.map(i=>i.id),style,combo});
  }
  if(!candidates.length)throw new Error('Unreachable couture budget or comfort');
  let accent=null,feasible=candidates;
  if(d>1){
   const exemplar=candidates[r()*candidates.length|0],slots=[0,1,2].filter(slot=>exemplar.combo[slot].tags[theme]>0),slot=slots[r()*slots.length|0];
   if(slot!==undefined){accent={slot,minimum:Math.max(1,exemplar.combo[slot].tags[theme]-(d===2?1:0))};feasible=candidates.filter(v=>v.combo[slot].tags[theme]>=accent.minimum);}
  }
  const bestStyle=Math.max(...feasible.map(v=>v.style)),styleGoal=Math.max(1,bestStyle-[3,1,0][d-1]);
  const request=coutureRequests[theme][r()*coutureRequests[theme].length|0];
  const brief={theme,themeName:coutureThemes[theme],request,clientName:'顾客 '+(index+1),budget,comfortGoal,styleGoal,accent,
   quote:'准备参加'+request+'，请在预算内兼顾主题和舒适度。'+(accent?'希望'+['主服','配饰','叠搭'][accent.slot]+'能突出主题。':''),
   solutions:feasible.filter(v=>v.style>=styleGoal).map(v=>v.ids)};
  if(!brief.solutions.length)throw new Error('Unreachable couture style');
  briefs.push(brief);
 }
 return {...briefs[0],items,briefs,time:[180,240,300][d-1]};
}
export function makeWorkshopLevel(id,seed,d=1){
 const config=WORKSHOP_GAMES[id],r=seededRandom(seed^Math.imul(id+31,7907)),pick=a=>a[r()*a.length|0],between=(a,b)=>a+r()*(b-a);
 const l={id,seed,d,kind:config.kind,time:180,difficulty:d};
 switch(l.kind){
 case 'joinery':Object.assign(l,joineryLevel(r,d));l.time=[210,210,200][d-1];break;
 case 'tea':{const count=4+d*2,ids=shuffle(['herb','mint','lavender','rose','sunflower','honey','wheat','tea','corn','c1_2'],r).slice(0,count);l.ids=ids;l.values=shuffle(ids.flatMap((_,i)=>[i,i]),r);l.cols=d===3?5:4;l.turns=count+[8,6,4][d-1];l.preview=[4,3,2][d-1];l.time=[150,150,150][d-1];break;}
 case 'kitchen':l.ids=id===2?['fish','wheat','tomato','rice','corn']:['herb','mint','lavender','wax','honey'];l.orders=Array.from({length:6+d},(_,i)=>({ingredients:shuffle([0,1,2,3,4],r).slice(0,2+(d===3&&i%2)),cook:between(5,8),window:7-d,arrival:i*[9,5.8,4.5][d-1]+Math.floor(i/3)*(d===1?2:1.5),patience:45-d*4}));l.quota=Math.ceil(l.orders.length*.75);l.time=l.orders.at(-1).arrival+50;break;
 case 'couture':Object.assign(l,coutureLevel(r,d));break;
 case 'nonogram':Object.assign(l,nonogramLevel(r,d));l.time=[300,420,540][d-1];break;
 case 'pipes':Object.assign(l,pipeLevel(r,d));l.time=[180,210,240][d-1];break;
 case 'beacon':l.ships=Array.from({length:6+d*2},(_,i)=>({angle:between(-Math.PI,Math.PI),arrival:i*[4.8,3.6,3.0][d-1],deadline:18-d,need:2.2+d*.3}));l.quota=Math.ceil(l.ships.length*.75);l.time=l.ships.at(-1).arrival+20;l.cone=.22-d*.025;break;
 case 'rhythm':{l.bpm=76+d*12;l.beat=60/l.bpm;l.window=[.2,.16,.13][d-1];const notes=[];l.leadIn=l.beat*4;for(let i=0;i<48+d*12;i++){const lane=r()*4|0,at=l.leadIn+i*l.beat*.75+Math.floor(i/8)*l.beat*.25,hold=d>1&&i%7===4?l.beat*.55:0;notes.push({lane,at,hold});if(d===3&&i%12===8)notes.push({lane:(lane+2)%4,at,hold:0})}l.notes=notes;l.time=notes.at(-1).at+3;l.key=pick([0,2,5]);break;}
 case 'photo':l.targets=Array.from({length:2+d},(_,i)=>({species:i%3,focus:between(28,72),phase:between(0,6.28),x:between(260,650),y:between(180,350),speed:between(.5,.8)}));l.film=6+d;l.time=150;break;
 case 'sokoban':Object.assign(l,sokobanLevel(r,d));l.time=[360,420,540][d-1];break;
 case 'pottery':Object.assign(l,makePotteryLevel(r,d));break;
 case 'angling':l.spots=Array.from({length:1+(d>1)},(_,i)=>({x:between(280,720),y:between(240,380),phase:between(0,6.28)}));l.wind=between(-24,24);l.strikeWindow=1.5-d*.2;l.time=120;break;
 case 'mosaic':l.n=d===3?4:3;l.order=shuffle(Array.from({length:l.n*l.n},(_,i)=>i),r);l.rotations=l.order.map(()=>d===1?0:r()*4|0);l.panel=pick([0,1,4,5]);l.time=[240,300,420][d-1];break;
 case 'interior':Object.assign(l,makeInteriorLevel(r,d));break;
 case 'fireworks':l.wind=between(-25,25);l.targets=Array.from({length:2+d},(_,i)=>{const angle=-Math.PI/2+between(-.75,.75),power=between(.58,.83),fuse=between(.8,1.15),v=300+power*270;return {x:480+Math.cos(angle)*v*fuse+l.wind*fuse*fuse/2,y:475+Math.sin(angle)*v*fuse+210*fuse*fuse/2,angle,power,fuse,color:['#efb363','#83d6cc','#e8a6c2'][i%3]}});l.shots=l.targets.length+3;l.time=130;break;
 case 'expedition':Object.assign(l,expeditionLevel(r,d));l.time=300;break;
 case 'regatta':{const path=[{x:100,y:430},{x:170+between(-30,35),y:150+between(-35,35)},{x:440+between(-35,40),y:125+between(-35,35)},{x:720+between(-30,35),y:285+between(-30,30)},{x:820,y:440}];l.path=path;l.reefs=[{x:400,y:340,r:66},{x:635,y:105,r:50},{x:125,y:290,r:24}].filter(p=>!path.some(x=>Math.hypot(x.x-p.x,x.y-p.y)<100));l.current={x:between(-5,5)*d,y:between(-3,3)*d};l.time=110;break;}
 case 'brush':Object.assign(l,makeBrushLevel(r,d));break;
 }
 return l;
}
export function emit(s,kind,x=480,y=270,extra={}){s.events.push({kind,x,y,at:s.t,...extra});if(s.events.length>100)s.events.shift()}
export function finishWorkshop(s,pass,quality=80){
 if(s.result)return;s.phase='celebrating';s.celebration=0;s.result={passed:pass,quality:clamp(Math.round(quality),55,100),score:Math.round(s.score),total:100,stars:pass?(quality>=92?3:quality>=78?2:1):0,seconds:s.t,seed:s.level.seed};
 emit(s,pass?'victory':'failure',480,260);
}
export function createWorkshopState(level,equipment=null){
 const candidate=TOOLS[equipment?.id],tool=level.kind==='angling'&&candidate?.action==='fish'?{id:candidate.id,source:equipment.source==='owned'?'owned':'borrowed'}:null;
 const s={equipment:tool,level,id:level.id,kind:level.kind,phase:'intro',t:0,remaining:level.time,score:0,combo:0,bestCombo:0,strikes:0,moves:0,events:[],status:'',pointer:{x:480,y:300},holding:false,keys:{},history:[],selected:0,rotation:0,help:2,result:null};
 switch(s.kind){
 case 'joinery':s.placed=[];s.occupied=[];break;
 case 'tea':s.opened=[];s.found=[];s.turns=level.turns;s.preview=level.preview;s.flipAt=0;break;
 case 'kitchen':s.jobs=level.orders.map((o,i)=>({...o,id:i,state:'waiting',ingredients:[],cuts:0,cooked:0,station:null}));s.ticket=0;s.served=0;s.failed=0;s.cutFlash=0;break;
 case 'couture':s.outfit=[null,null,null];s.lastReview=null;s.clientIndex=0;s.clientReports=[];s.runway=null;break;
 case 'nonogram':s.cells=Array(level.n*level.n).fill(0);break;
 case 'pipes':s.masks=[...level.initial];s.flow=flowPipes(s.masks,level);s.running=0;break;
 case 'beacon':s.angle=-Math.PI/2;s.targetAngle=s.angle;s.ships=level.ships.map((ship,i)=>({...ship,id:i,lock:0,state:'waiting'}));s.saved=0;s.lost=0;break;
 case 'rhythm':s.notes=level.notes.map(n=>({...n,state:'waiting',precision:0}));s.hits=0;s.misses=0;s.strays=0;s.health=100;s.lanePulse=[0,0,0,0];s.lastStray=-1;break;
 case 'photo':s.shot=0;s.focus=50;s.film=level.film;s.photos=[];s.camera={x:480,y:270};s.lastPhoto=0;break;
 case 'sokoban':s.player=level.player;s.crates=[...level.crates];s.lastCrates=[...s.crates];s.lastPlayer=s.player;s.walkAt=0;break;
 case 'pottery':Object.assign(s,initPottery(level));break;
 case 'angling':s.catch=0;s.mode='cast';s.biteAt=0;s.line=0;s.tension=.25;s.progress=0;s.fish={x:480,y:320};s.castAge=0;s.castTarget=null;s.escape=0;break;
 case 'mosaic':s.order=[...level.order];s.rotations=[...level.rotations];s.selected=-1;s.reference=0;break;
 case 'interior':s.furniture=[];s.furnitureHistory=[];s.lastReview=null;s.walkthrough=null;s.routeVisible=false;s.interiorRevision=0;break;
 case 'fireworks':s.lit=[];s.shots=0;s.charge=0;s.projectile=null;s.aim=-Math.PI/2;break;
 case 'expedition':s.player=level.start;s.collected=[];s.stamina=level.budget;s.seen=[];s.lastPlayer=s.player;s.walkAt=0;break;
 case 'regatta':s.boat={x:100,y:430,angle:-Math.PI/2,speed:0};s.gate=1;s.hull=100;s.bumpAt=-5;s.wake=[];break;
 case 'brush':if(level.schemaVersion===BRUSH_SCHEMA)Object.assign(s,initBrush());else{s.stroke=0;s.node=0;s.color=0;s.ink=1;s.painted=[];s.startedStroke=false;s.offPath=0;}break;
 }
 return s;
}
export function interiorReview(s){return s.level.schemaVersion===40?reviewInterior(s):legacyInteriorReview(s);}
function legacyInteriorReview(s){
 const l=s.level,placed=s.furniture,blocked=new Set(placed.flatMap(p=>Array.from({length:p.w*p.h},(_,i)=>(p.y+(i/p.w|0))*l.w+p.x+i%p.w))),door=l.door;
 const access=pathBetween(door,l.window, [...blocked],l.w,l.h).length>0;
 const seat=placed.find(p=>p.role==='seat'),shelf=placed.find(p=>p.role==='shelf'),light=placed.find(p=>p.role==='light');
 const nearby=seat&&shelf&&Math.abs(seat.x-shelf.x)+Math.abs(seat.y-shelf.y)<=2,window=seat&&seat.y<=1,lit=seat&&light&&Math.abs(seat.x-light.x)+Math.abs(seat.y-light.y)<=2;
 const score=(placed.length===l.items.length?40:placed.length/l.items.length*40)+(access?20:0)+(nearby?15:0)+(window?15:0)+(lit?10:0);
 return {score,access,nearby:!!nearby,window:!!window,lit:!!lit,complete:placed.length===l.items.length&&access&&score>=l.requiredScore};
}
export function moveCrate(s,dir){
 const l=s.level,n=neighbors(s.player,l.w,l.h).find(n=>n.dir===dir);if(!n||l.walls.includes(n.i))return false;
 const crate=s.crates.indexOf(n.i);let next;
 if(crate>=0){next=neighbors(n.i,l.w,l.h).find(n=>n.dir===dir);if(!next||l.walls.includes(next.i)||s.crates.includes(next.i))return false}
 s.history.push({player:s.player,crates:[...s.crates]});s.lastCrates=[...s.crates];s.lastPlayer=s.player;s.player=n.i;s.walkAt=s.t;s.moves++;
 if(crate>=0){s.crates[crate]=next.i;emit(s,'push',next.i%l.w*60+290,(next.i/l.w|0)*58+80);}
 if(s.crates.every(i=>l.beds.includes(i))){s.score=1000-Math.min(400,s.moves*2);finishWorkshop(s,true,100-Math.max(0,s.moves-l.solution.length)/4)}
 return true;
}

export function photoSubject(s,index=s.shot){
 const v=s.level.targets[Math.min(index,s.level.targets.length-1)],a=s.t*v.speed+v.phase;
 return {x:v.x+Math.sin(a)*115,y:v.y+Math.cos(a*.7)*48,focus:v.focus+Math.sin(a*.35)*7,pose:(Math.sin(a*2)+1)/2,species:v.species};
}
export function potteryAccuracy(s){return potteryShapeReview(s).accuracy;}
export function firePosition(l,angle,power,age){const speed=300+power*270;return {x:480+Math.cos(angle)*speed*age+l.wind*age*age/2,y:475+Math.sin(angle)*speed*age+210*age*age/2}}
function turnDifference(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
export function progressWorkshop(s){
 const l=s.level;
 switch(s.kind){
 case 'joinery':return [s.placed.length,l.pieces.length,'零件'];
 case 'tea':return [s.found.length/2,l.ids.length,'配对'];
 case 'kitchen':return [s.served,l.quota,'交付'];
 case 'couture':return [s.clientReports.length,l.briefs?.length||1,'顾客'];
 case 'nonogram':return [s.cells.filter(x=>x===1).length,l.values.filter(Boolean).length,'星图'];
 case 'pipes':return [s.flow.connected,l.tanks.length,'水缸'];
 case 'beacon':return [s.saved,l.quota,'护航'];
 case 'rhythm':return [s.hits,l.notes.length,'音符'];
 case 'photo':return [s.shot,l.targets.length,'照片'];
 case 'sokoban':return [s.crates.filter(i=>l.beds.includes(i)).length,l.beds.length,'花床'];
 case 'pottery':return [Math.round((s.mode==='shape'?potteryAccuracy(s)*.4:s.mode==='glaze'?.4+s.glaze.reduce((n,v)=>n+v,0)/12*.25:s.mode==='firing'?.65+s.kiln.elapsed/l.kiln.duration*.3:.95+s.kiln.reveal/3.4*.05)*100),100,'器物'];
 case 'angling':return [s.catch,l.spots.length,'钓获'];
 case 'mosaic':return [s.order.filter((x,i)=>x===i&&s.rotations[i]===0).length,l.order.length,'碎片'];
 case 'interior':return [s.furniture.length,l.items.length,'家具'];
 case 'fireworks':return [s.lit.length,l.targets.length,'星光'];
 case 'expedition':return [s.collected.length,l.targets.length,'印记'];
 case 'regatta':return [s.gate-1,l.path.length-1,'航标'];
 case 'brush':return [s.stroke,l.strokes.length,'笔触'];
 }
}
function commitOutfit(s){
 if(s.runway)return;
 const brief=coutureBrief(s),review=outfitScore(s.outfit.map(id=>s.level.items.find(i=>i.id===id)),brief);s.lastReview=review;
 if(review.complete){
  s.runway={elapsed:0,duration:2.6,clientIndex:s.clientIndex,outfit:[...s.outfit],review};
  s.status=brief.clientName+' · 搭配展映与评审中';emit(s,'ribbon',480,240);
 }else{s.strikes++;s.status=review.unmet.join(' · ');emit(s,'review',480,270)}
}
function completeCoutureReview(s){
 const show=s.runway;if(!show||s.clientReports.some(r=>r.clientIndex===show.clientIndex))return;
 const brief=coutureBrief(s);
 s.clientReports.push({clientIndex:show.clientIndex,themeName:brief.themeName,request:brief.request||brief.themeName,outfit:[...show.outfit],quality:show.review.score});
 s.runway=null;s.score=Math.round(s.clientReports.reduce((n,r)=>n+r.quality,0)/s.clientReports.length)*10;
 emit(s,'review',480,270);
 if(s.clientReports.length===(s.level.briefs?.length||1)){
  const quality=s.clientReports.reduce((n,r)=>n+r.quality,0)/s.clientReports.length-Math.min(12,s.strikes*2);
  s.score=Math.round(quality)*10;s.status='全部顾客委托已完成 · 综合搭配评分 '+Math.round(quality);finishWorkshop(s,true,quality);
 }else{s.clientIndex++;s.outfit=[null,null,null];s.lastReview=null;s.status='上一位顾客已认可，开始'+coutureBrief(s).request+'的新委托。';}
}
function shotPhoto(s){
 if(s.film<=0||s.t-s.lastPhoto<.35)return;
 const target=photoSubject(s),distance=Math.hypot(target.x-s.camera.x,target.y-s.camera.y),clarity=clamp(1-Math.abs(target.focus-s.focus)/20,0,1),composition=clamp(1-distance/110,0,1);
 const quality=Math.round(clarity*45+composition*40+target.pose*15);s.film--;s.lastPhoto=s.t;emit(s,'shutter',s.camera.x,s.camera.y,{quality});
 s.photos.push({quality,accepted:quality>=[72,77,81][s.level.d-1],species:target.species,x:target.x,y:target.y,at:s.t});
 if(quality>=[72,77,81][s.level.d-1]){s.shot++;s.score+=quality*4;s.status='收录成功 · 构图 '+Math.round(composition*100)+' / 对焦 '+Math.round(clarity*100);if(s.shot===s.level.targets.length)finishWorkshop(s,true,s.photos.filter(p=>p.accepted).reduce((a,p)=>a+p.quality,0)/s.shot);}
 else{s.strikes++;s.status='这张未收录 · 让主体居中、焦点清晰，再找舒展姿态';}
 if(!s.result&&s.film<=0)finishWorkshop(s,false);
}
function rhythmPress(s,lane){
 if(s.keys['lane'+lane])return;s.keys['lane'+lane]=true;s.lanePulse[lane]=1;
 const n=s.notes.find(n=>n.lane===lane&&n.state==='waiting'&&Math.abs(s.t-n.at)<=s.level.window);
 if(n){n.precision=clamp(1-Math.abs(s.t-n.at)/s.level.window,0,1);n.state=n.hold?'holding':'hit';s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);
  if(!n.hold)s.hits++;s.score+=Math.round(100+n.precision*80+s.combo*2);emit(s,'note',313+lane*110,434,{lane,perfect:n.precision>.7});s.status=n.precision>.7?'PERFECT · '+s.combo+' 连击':'GOOD · '+s.combo+' 连击';
 }else if(s.t>2&&s.t-s.lastStray>.12){s.strays++;s.health-=3;s.combo=0;s.lastStray=s.t;s.status='注意节拍，空拍也要留白';emit(s,'miss',313+lane*110,434)}
}
function rhythmRelease(s,lane){
 s.keys['lane'+lane]=false;
 for(const n of s.notes)if(n.lane===lane&&n.state==='holding'){
  if(s.t>=n.at+n.hold-s.level.window*.6){n.state='hit';s.hits++;s.score+=80}
  else{n.state='miss';s.misses++;s.combo=0;s.health-=7;s.status='长音需要保持到尾端';}
 }
}
export function workshopAction(s,a){
 const l=s.level;
 if(a.type==='start'&&s.phase==='intro'){s.phase='playing';s.status='';emit(s,'start');return}
 if(s.phase!=='playing'||(s.kind==='couture'&&s.runway)||(s.kind==='interior'&&s.walkthrough&&!s.walkthrough.done))return;
 if(s.kind==='brush'&&brushAction(s,a,emit))return;
 if(s.kind==='pottery'&&potteryAction(s,a,emit))return;
 if(s.kind==='interior'&&a.type==='pickup'){if(pickupInteriorFurniture(s,a.value))emit(s,'snap',480,270);return;}
 if(s.kind==='interior'&&a.type==='inspectRoute'){s.routeVisible=!s.routeVisible;s.status=s.routeVisible?'绿线显示门到窗的当前最短路线；地毯可通行。':'动线预览已收起';return;}
 if(a.type==='point'){s.pointer={x:a.x,y:a.y};if(s.kind==='photo')s.camera={...s.pointer};if(s.kind==='beacon')s.targetAngle=Math.atan2(a.y-280,a.x-480);if(s.kind==='fireworks')s.aim=clamp(Math.atan2(a.y-475,a.x-480),-Math.PI+.1,-.1);return}
 if(a.type==='down'){
  s.holding=true;s.pointer={x:a.x,y:a.y};
  if(s.kind==='angling'){
   if(s.mode==='cast'){const spot=l.spots[s.catch],landing={x:a.x+l.wind,y:a.y};s.castTarget=landing;s.castAge=0;s.mode='casting';s.castGood=Math.hypot(landing.x-spot.x,landing.y-spot.y)<anglingEquipment(s).castRadius;emit(s,'cast',a.x,a.y)}
   else if(s.mode==='bite'){s.mode='fight';s.progress=0;s.tension=.25;s.fightStart=s.t;s.status='鱼正在拉线，观察挣扎提示';emit(s,'splash',s.fish.x,s.fish.y)}
   else if(s.mode==='waiting'){s.mode='cast';s.escape++;s.status='提竿太早，鱼还没咬钩';}
  }
  if(s.kind==='fireworks'&&s.projectile)detonate(s);
  return;
 }
 if(a.type==='up'){
  if(s.kind==='fireworks'&&!s.projectile&&s.holding&&s.charge>.12){
   if(s.shots<l.shots){s.projectile={angle:s.aim,power:s.charge,age:0,trail:[]};s.shots++;emit(s,'launch',480,475);s.charge=0;}
  }s.holding=false;return;
 }
 if(a.type==='select'){s.selected=a.value;s.rotation=0;return}
 if(a.type==='rotate'){
  if(s.kind==='mosaic'&&s.selected>=0){s.rotations[s.selected]=(s.rotations[s.selected]+1)%4;s.moves++;emit(s,'rotate',480,270);checkMosaic(s)}
  else{s.rotation=(s.rotation+1)%4;emit(s,'rotate',480,270)}
  return;
 }
 if(a.type==='help'){
  if(!s.help)return;s.help--;s.hintAt=s.t;
  if(s.kind==='joinery'){const hint=l.solution.find(p=>!s.placed.some(v=>v.piece===p.piece));s.hint=hint;s.status='先完成已经高亮的零件；提示会影响最终评级';}
  else if(s.kind==='mosaic')s.reference=4;
  else if(s.kind==='nonogram'){const i=l.values.findIndex((v,i)=>v&&s.cells[i]!==1);if(i>=0){s.cells[i]=1;if(s.cells.every((v,i)=>(v===1?1:0)===l.values[i])){s.score=1000;finishWorkshop(s,true,100-(2-s.help)*9)}}}
  else if(s.kind==='expedition')s.mapUntil=s.t+4;
  return;
 }
 if(a.type==='undo'){
  if(s.kind==='joinery'){const p=s.placed.pop();if(p){s.score=Math.max(0,s.score-180);s.occupied=s.occupied.filter(i=>!p.cells.includes(i));s.selected=p.piece;s.rotation=p.rotation;}}
  if(s.kind==='sokoban'){const prev=s.history.pop();if(prev){s.lastCrates=[...s.crates];s.crates=prev.crates;s.lastPlayer=s.player;s.player=prev.player;s.walkAt=s.t;s.moves++;}}
  if(s.kind==='interior')undoInteriorFurniture(s);
  return;
 }
 if(a.type==='move'){
  if(s.kind==='sokoban')moveCrate(s,a.dir);
  if(s.kind==='expedition'){
   const next=neighbors(s.player,l.w,l.h).find(x=>x.dir===a.dir);
   if(next&&!l.walls.includes(next.i)){s.lastPlayer=s.player;s.player=next.i;s.walkAt=s.t;s.stamina--;s.moves++;
    if(l.targets.includes(next.i)&&!s.collected.includes(next.i)){s.collected.push(next.i);s.score+=250;emit(s,'collect',480,270,{art:'c22_0'})}
    if(s.player===l.exit&&s.collected.length===l.targets.length){s.score+=s.stamina*10;finishWorkshop(s,true,75+Math.min(25,s.stamina));}
    else if(s.stamina<=0)finishWorkshop(s,false);
   }
  }return;
 }
 if(a.type==='cell'){
  const i=a.index;
  if(s.kind==='joinery'){
   if(s.placed.some(x=>x.piece===s.selected))return;
   const points=pieceOffsets(l.pieces[s.selected],s.rotation).map(([dx,dy])=>[i%l.w+dx,(i/l.w|0)+dy]);
   if(points.some(([x,y])=>x<0||y<0||x>=l.w||y>=l.h||!l.target.includes(y*l.w+x)||s.occupied.includes(y*l.w+x))){s.strikes++;s.status='这块还放不下，试试旋转或撤回';emit(s,'shake');return}
   const cells=points.map(([x,y])=>y*l.w+x);s.placed.push({piece:s.selected,rotation:s.rotation,cells,anchor:i,at:s.t});s.occupied.push(...cells);s.moves++;s.score+=180;emit(s,'join',480,270,{piece:s.selected});
   s.selected=l.pieces.findIndex((_,k)=>!s.placed.some(p=>p.piece===k));if(s.selected<0)s.selected=0;s.rotation=0;
   if(s.placed.length===l.pieces.length)finishWorkshop(s,true,100-s.strikes*1.5-(2-s.help)*8-Math.max(0,s.moves-l.pieces.length)*2);
  }
  if(s.kind==='tea'){
   if(s.t<l.preview||s.opened.length>=2||s.found.includes(i)||s.opened.includes(i))return;
   s.opened.push(i);emit(s,'flip',480,270);
   if(s.opened.length===2){s.turns--;s.flipAt=s.t+.65;
    const [a,b]=s.opened;if(l.values[a]===l.values[b]){s.found.push(a,b);s.combo++;s.bestCombo=Math.max(s.combo,s.bestCombo);s.score+=120+s.combo*15;emit(s,'pour',741,410,{art:l.ids[l.values[a]]});s.opened=[];if(s.found.length===l.values.length)finishWorkshop(s,true,100-s.strikes*4-(l.turns-s.turns-l.ids.length)*2);}
    else{s.combo=0;s.strikes++;}
   }
  }
  if(s.kind==='nonogram'){
   s.cells[i]=a.mark?(s.cells[i]===-1?0:-1):(s.cells[i]===1?0:1);s.moves++;emit(s,'star',i%l.n*48+350,(i/l.n|0)*48+140);
   if(s.cells.every((v,i)=>(v===1?1:0)===l.values[i])){s.score=1200-Math.min(400,s.moves*2);finishWorkshop(s,true,100-(2-s.help)*9-Math.max(0,s.moves-l.values.filter(Boolean).length)*.3)}
  }
  if(s.kind==='pipes'&&l.initial[i]&&!l.fixed.includes(i)){s.masks[i]=rotateMask(s.masks[i]);s.moves++;s.flow=flowPipes(s.masks,l);s.running=0;emit(s,'turn',480,270)}
  if(s.kind==='mosaic'){
   if(s.selected<0){s.selected=i;return}
   if(s.selected!==i){[s.order[s.selected],s.order[i]]=[s.order[i],s.order[s.selected]];[s.rotations[s.selected],s.rotations[i]]=[s.rotations[i],s.rotations[s.selected]];s.moves++;emit(s,'snap',480,270);}
   s.selected=-1;checkMosaic(s);
  }
  if(s.kind==='interior'){
   const result=placeInteriorFurniture(s,i);if(!result.ok){s.status=result.text;emit(s,'shake');return}
   s.status=result.pose.floor?'地毯已铺好，坐具可以放在上面。':'家具已安放，留意采光与侧边通路。';emit(s,'snap',480,270,{art:result.pose.id});
  }
  return;
 }
 if(a.type==='ticket'){const job=s.jobs[a.index];if(job&&['available','prep'].includes(job.state)){s.ticket=a.index;job.state='prep';}return}
 if(a.type==='ingredient'){
  if(!Number.isInteger(a.index)||a.index<0||a.index>=l.ids.length)return;
  const j=s.jobs[s.ticket];if(!j||!['available','prep'].includes(j.state))return;j.state='prep';
  if(j.ingredients.length<l.orders[s.ticket].ingredients.length){j.ingredients.push(a.index);s.status='按客单备料：'+j.ingredients.length+' / '+l.orders[s.ticket].ingredients.length;emit(s,'ingredient',421+(j.ingredients.length-1)*69,310,{art:l.ids[a.index],ticket:j.id,index:j.ingredients.length-1});}
  return;
 }
 if(a.type==='clearPrep'){const j=s.jobs[s.ticket];if(j&&['available','prep'].includes(j.state)){j.ingredients=[];j.cuts=0;s.status='备料台已清空，请按客单重新选择。'}return}
 if(a.type==='cut'){
  const j=s.jobs[s.ticket];if(!j||j.state!=='prep'||j.ingredients.length!==l.orders[s.ticket].ingredients.length||j.cuts>=j.ingredients.length*2)return;
  j.cuts=Math.min(j.ingredients.length*2,j.cuts+1);s.cutFlash=.36;s.status=j.cuts===j.ingredients.length*2?'切配完成，放入空灶开始烹调。':'切配中 '+j.cuts+' / '+j.ingredients.length*2;emit(s,'cut',390+j.cuts*17,330,{art:l.ids[j.ingredients[(j.cuts-1)%j.ingredients.length]]});return;
 }
 if(a.type==='cook'){
  const j=s.jobs[s.ticket];if(!j||j.state!=='prep'||j.ingredients.length!==l.orders[s.ticket].ingredients.length||j.cuts<j.ingredients.length*2){s.status='备齐食材并完成切配，才能开火';return}
  if([...j.ingredients].sort().join()!==[...l.orders[s.ticket].ingredients].sort().join()){j.ingredients=[];j.cuts=0;s.strikes++;s.status='配料与订单不同，重新核对一下';emit(s,'shake');return}
  const occupied=s.jobs.filter(j=>j.state==='cooking').map(j=>j.station),station=[0,1].find(i=>!occupied.includes(i));
  if(station==null){s.status='双灶都在使用，先留意即将煮好的那锅';return}
  j.state='cooking';j.station=station;j.cooked=0;emit(s,'cook',station?730:250,330);s.status='已放入'+(station?'右':'左')+'灶，可继续准备下一单。';const next=s.jobs.find(j=>['available','prep'].includes(j.state));if(next)s.ticket=next.id;return;
 }
 if(a.type==='serve'){
  const j=s.jobs.find(j=>j.state==='cooking'&&j.station===a.station);if(!j)return;
  if(j.cooked<j.cook){s.status='火候还不到，稍候再装盘';return}
  const q=clamp(100-(j.cooked-j.cook)*6,60,100);j.state='served';s.served++;s.score+=Math.round(q*3);s.combo++;s.bestCombo=Math.max(s.combo,s.bestCombo);emit(s,'serve',a.station?730:250,300,{art:s.id===2?'meal':'c10_1'});s.status='交付完成 · 品质 '+Math.round(q);
  if(s.served+s.failed===s.jobs.length)finishWorkshop(s,s.served>=l.quota,75+s.served/s.jobs.length*20-s.strikes*2);return;
 }
 if(a.type==='wear'){const item=l.items.find(i=>i.id===a.item);if(item){s.outfit[item.slot]=item.id;s.lastReview=null;const review=outfitScore(s.outfit.map(id=>l.items.find(i=>i.id===id)),coutureBrief(s));s.status=review.complete?'搭配符合委托，可以提交评审。':review.unmet.join(' · ');emit(s,'ribbon',480,270,{art:item.id})}return}
 if(a.type==='submit'){
  if(s.kind==='couture')commitOutfit(s);
  if(s.kind==='pipes'){s.flow=flowPipes(s.masks,l);if(s.flow.complete){s.running=.01;s.status='循环启动 · 观察水流到达珊瑚缸';emit(s,'water',480,270)}else{s.strikes++;s.status='尚有 '+s.flow.leaks.length+' 处漏口，'+(l.tanks.length-s.flow.connected)+' 座水缸未接通';emit(s,'leak',480,270)}}
  if(s.kind==='interior'){s.lastReview=interiorReview(s);if(s.lastReview.complete){s.walkthrough=makeInteriorWalkthrough(s);if(s.walkthrough){s.status='布局达标 · 正沿实际通路验收';s.routeVisible=true;emit(s,'start');}else s.status='动线验收无法通过，请检查家具侧边通路';}else s.status='继续调整：'+s.lastReview.unmet.join('、');}

  return;
 }
 if(a.type==='water'){s.wet=1;emit(s,'water',480,280);return}
 if(a.type==='focus'){s.focus=clamp(s.focus+a.delta,0,100);return}
 if(a.type==='shutter'){shotPhoto(s);return}
 if(a.type==='lane'){rhythmPress(s,a.lane);return}
 if(a.type==='releaseLane'){rhythmRelease(s,a.lane);return}
 if(a.type==='color'){s.color=a.index;return}
 if(a.type==='dip'){s.ink=1;s.holding=false;emit(s,'dip',820,430);return}
 if(a.type==='resetBoard'&&s.kind==='sokoban'){s.player=l.player;s.lastPlayer=l.player;s.crates=[...l.crates];s.lastCrates=[...l.crates];s.walkAt=s.t;s.history=[];s.moves+=5;return}
 if(a.type==='brake'){s.keys.brake=!!a.down;return}
 if(a.type==='steer'){s.keys[a.key]=a.down;return}
}
function checkMosaic(s){
 if(s.order.every((v,i)=>v===i&&s.rotations[i]===0)){s.score=1500-Math.min(700,s.moves*8);finishWorkshop(s,true,100-(2-s.help)*7-Math.max(0,s.moves-s.order.length*2)*.8)}
}
function detonate(s){
 const p=s.projectile;if(!p)return;const at=firePosition(s.level,p.angle,p.power,p.age);
 const i=s.level.targets.findIndex((v,i)=>!s.lit.includes(i)&&Math.hypot(v.x-at.x,v.y-at.y)<[58,48,40][s.level.d-1]);
 emit(s,'firework',at.x,at.y,{color:i>=0?s.level.targets[i].color:'#d9b5e3',large:true});
 s.projectile=null;s.holding=false;
 if(i>=0){const target=s.level.targets[i],distance=Math.hypot(target.x-at.x,target.y-at.y);s.lit.push(i);s.score+=Math.round(300-distance*2);s.status=distance<18?'绽放位置完美！':'点亮了新的星光';}
 else{s.strikes++;s.status='绽放点偏离了星光，留意风与下坠';}
 if(s.lit.length===s.level.targets.length)finishWorkshop(s,true,100-s.strikes*6);
 else if(s.shots>=s.level.shots)finishWorkshop(s,false);
}
export function stepWorkshop(s,dt){
 if(s.phase==='celebrating'){s.celebration+=dt;if(s.celebration>=2.6)s.phase='result';return}
 if(s.phase!=='playing')return;
 dt=Math.min(.05,Math.max(0,dt));s.t+=dt;s.remaining=Math.max(0,s.level.time-s.t);const l=s.level;
 if(s.kind==='couture'&&s.runway){s.runway.elapsed+=dt;if(s.remaining>0&&s.runway.elapsed+1e-9>=s.runway.duration)completeCoutureReview(s);}
 if(s.kind==='interior'&&s.walkthrough&&s.remaining>0){const before=s.walkthrough.step,complete=advanceInteriorWalkthrough(s,dt);if(s.walkthrough.step!==before)emit(s,'footstep');if(complete){s.score=s.walkthrough.review.quality*10;s.status='全屋动线与居住要求验收完成';finishWorkshop(s,true,s.walkthrough.review.quality);}}
 if(s.kind==='tea'){
  if(s.opened.length===2&&s.t>=s.flipAt)s.opened=[];
  if(s.turns<=0&&s.opened.length===0&&s.found.length<l.values.length)finishWorkshop(s,false);
 }
 if(s.kind==='kitchen'){
  s.cutFlash=Math.max(0,s.cutFlash-dt);
  for(const j of s.jobs){
   if(j.state==='waiting'&&s.t>=j.arrival){j.state='available';emit(s,'order',480,80);if(!s.jobs[s.ticket]||!['available','prep'].includes(s.jobs[s.ticket].state))s.ticket=j.id;}
   if(j.state==='cooking'){j.cooked+=dt;if(j.cooked>j.cook+j.window){j.state='failed';s.failed++;s.combo=0;s.status='火候过了，下一锅记得及时装盘';emit(s,'burn',j.station?730:250,330);}}
   else if(['available','prep'].includes(j.state)&&s.t-j.arrival>j.patience){j.state='failed';s.failed++;s.combo=0;s.status='顾客等得太久，先照顾最紧急的订单';}
  }
  if(!['available','prep'].includes(s.jobs[s.ticket]?.state)){const next=s.jobs.find(j=>['available','prep'].includes(j.state));if(next)s.ticket=next.id;}
  if(s.served+s.failed===s.jobs.length)finishWorkshop(s,s.served>=l.quota,75+s.served/s.jobs.length*20-s.strikes*2);
 }
 if(s.kind==='pipes'&&s.running){s.running+=dt;if(s.running>=2.2){s.score=1000-s.moves*4;finishWorkshop(s,true,100-s.strikes*6-Math.max(0,s.moves-l.solved.filter(Boolean).length*2)*.5)}}
 if(s.kind==='beacon'){
  if(s.keys.left){s.angle-=dt*1.8;s.targetAngle=s.angle}else if(s.keys.right){s.angle+=dt*1.8;s.targetAngle=s.angle}else{s.angle+=clamp(turnDifference(s.targetAngle,s.angle),-dt*(4.3-l.d*.35),dt*(4.3-l.d*.35));}
  for(const ship of s.ships){
   if(ship.state==='waiting'&&s.t>=ship.arrival)ship.state='approaching';
   if(ship.state==='approaching'){
    const age=s.t-ship.arrival,angle=ship.angle+Math.sin(age*.35)*.1;ship.liveAngle=angle;
    if(Math.abs(turnDifference(angle,s.angle))<l.cone)ship.lock+=dt;else ship.lock=Math.max(0,ship.lock-dt*.3);
    if(ship.lock>=ship.need){ship.state='guided';ship.guidedAt=s.t;s.saved++;s.score+=Math.round(200+(ship.deadline-age)*8);emit(s,'guide',480+Math.cos(angle)*200,280+Math.sin(angle)*170);s.status='航线确认，客船正在入港';}
    else if(age>ship.deadline){ship.state='lost';s.lost++;emit(s,'warning',480,280);s.status='这艘船错过了安全航线';}
   }
  }
  if(s.saved+s.lost===s.ships.length)finishWorkshop(s,s.saved>=l.quota,70+s.saved/s.ships.length*30);
 }
 if(s.kind==='rhythm'){
  s.lanePulse=s.lanePulse.map(v=>Math.max(0,v-dt*4));
  for(const n of s.notes){
   if(n.state==='waiting'&&s.t>n.at+l.window){n.state='miss';s.misses++;s.health-=8;s.combo=0;emit(s,'miss',313+n.lane*110,434)}
   if(n.state==='holding'&&s.t>=n.at+n.hold){n.state='hit';s.hits++;s.score+=80;emit(s,'note',313+n.lane*110,434,{lane:n.lane,perfect:n.precision>.7})}
  }
  if(s.health<=0)finishWorkshop(s,false);
  else if(s.notes.every(n=>['hit','miss'].includes(n.state))){const accuracy=s.hits/l.notes.length;finishWorkshop(s,accuracy>=.75&&s.strays<=l.notes.length*.35,accuracy*100-s.strays*.7)}
 }
 if(s.kind==='pottery'&&s.remaining>0){const result=stepPottery(s,dt,emit);if(result){s.score=Math.round(result.quality*12);finishWorkshop(s,result.passed,result.quality);}}

 if(s.kind==='angling'){
  const spot=l.spots[Math.min(s.catch,l.spots.length-1)];
  if(s.mode==='casting'){s.castAge+=dt;if(s.castAge>.8){emit(s,'splash',s.castTarget.x,s.castTarget.y);if(s.castGood){s.mode='waiting';s.biteAt=s.t+2.2+Math.sin(spot.phase)*.7;s.status='浮漂已入水，等待咬钩…'}else{s.mode='cast';s.escape++;s.status='落点离鱼影太远，参考风向重新抛竿';}}}
  if(s.mode==='waiting'&&s.t>=s.biteAt){s.mode='bite';s.status='咬钩！立即提竿';emit(s,'bite',spot.x,spot.y)}
  if(s.mode==='bite'&&s.t>s.biteAt+l.strikeWindow){s.mode='cast';s.escape++;s.status='鱼松口了，重新寻找落点';}
  if(s.mode==='fight'){
   const age=s.t-s.fightStart,burst=Math.sin(age*1.5+spot.phase)>.5;s.surge=burst;
   s.fish={x:spot.x+Math.sin(age*1.1+spot.phase)*100,y:spot.y+Math.cos(age*.8)*24};
   const tracking=Math.abs(s.pointer.x-s.fish.x)<anglingEquipment(s).trackingRadius;
   if(s.holding){s.progress+=dt*(tracking?(burst?.023:.12):.035);s.tension+=dt*(burst?.33:.06)+(tracking?0:dt*.1);}
   else{s.tension-=dt*.27;s.progress=Math.max(0,s.progress-dt*.014);}
   s.tension=clamp(s.tension,0,1);
   if(s.progress>=1){s.catch++;s.score+=350+Math.round((1-s.tension)*150);emit(s,'catch',s.fish.x,s.fish.y,{art:'fish'});s.mode='landing';s.landingAt=s.t;s.holding=false;}
   else if(s.tension>=1){s.mode='cast';s.escape++;s.progress=0;s.holding=false;s.status='鱼线受力过大，放松时机要更早';emit(s,'break',s.fish.x,s.fish.y);}
  }
  if(s.mode==='landing'&&s.t-s.landingAt>1.3){if(s.catch===l.spots.length)finishWorkshop(s,true,100-s.escape*8);else{s.mode='cast';s.status='下一条鱼已游进新的水域';}}
  if(s.escape>=5)finishWorkshop(s,false);
 }
 if(s.kind==='mosaic')s.reference=Math.max(0,s.reference-dt);
 if(s.kind==='fireworks'){
  if(s.holding&&!s.projectile)s.charge=clamp(s.charge+dt*.6,0,1);
  if(s.projectile){s.projectile.age+=dt;const p=firePosition(l,s.projectile.angle,s.projectile.power,s.projectile.age);s.projectile.trail.push(p);if(s.projectile.trail.length>35)s.projectile.trail.shift();
   if(p.y>540||p.x<-40||p.x>1000||s.projectile.age>4){detonate(s);}
  }
 }
 if(s.kind==='expedition'){
  for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++)if(Math.hypot(x-s.player%l.w,y-(s.player/l.w|0))<=l.sight&&!s.seen.includes(y*l.w+x))s.seen.push(y*l.w+x);
 }
 if(s.kind==='regatta'){
  const b=s.boat,target=Math.atan2(s.pointer.y-b.y,s.pointer.x-b.x);
  if(s.holding){b.angle+=clamp(turnDifference(target,b.angle),-1.7*dt,1.7*dt);b.speed=Math.min(122,b.speed+dt*65)}
  else b.speed*=Math.exp(-dt*1.35);
  if(s.keys.left)b.angle-=dt*1.7;if(s.keys.right)b.angle+=dt*1.7;if(s.keys.forward)b.speed=Math.min(122,b.speed+dt*65);if(s.keys.brake)b.speed*=Math.exp(-dt*5);
  b.x=clamp(b.x+(Math.cos(b.angle)*b.speed+l.current.x)*dt,45,915);b.y=clamp(b.y+(Math.sin(b.angle)*b.speed+l.current.y)*dt,70,485);
  if(s.t-(s.wake.at(-1)?.t||0)>.08){s.wake.push({x:b.x,y:b.y,a:b.angle,t:s.t});s.wake=s.wake.filter(w=>s.t-w.t<2);}
  for(const reef of l.reefs){const dx=b.x-reef.x,dy=b.y-reef.y,dist=Math.hypot(dx,dy);if(dist<reef.r+18){b.x=reef.x+dx/Math.max(1,dist)*(reef.r+19);b.y=reef.y+dy/Math.max(1,dist)*(reef.r+19);b.speed*=.35;if(s.t-s.bumpAt>1){s.hull-=20;s.bumpAt=s.t;emit(s,'crash',b.x,b.y);s.status='擦到礁石，提前减速再转弯';}}}
  const next=l.path[s.gate];
  if(next&&Math.hypot(b.x-next.x,b.y-next.y)<45){
   if(s.gate<l.path.length-1){s.gate++;s.score+=200;emit(s,'buoy',next.x,next.y);s.status='通过航标 · 提前规划下一个转弯';}
   else if(b.speed<34&&Math.abs(turnDifference(b.angle,0))<.65){s.gate++;s.score+=Math.round(s.hull*5+(l.time-s.t)*4);finishWorkshop(s,true,75+s.hull*.25);}
   else s.status='泊位：朝右进入，按刹车低速靠岸';
  }
  if(s.hull<=0)finishWorkshop(s,false);
 }
 if(s.kind==='brush'&&l.schemaVersion===BRUSH_SCHEMA){const result=stepBrush(s,dt,emit);if(result){s.status=result.passed?'作品已装裱 · 风物绘卷评审通过':'评审未通过 · 下一局注意配色、轮廓与连续运笔';finishWorkshop(s,result.passed,result.quality);}}
 if(s.kind==='brush'&&l.schemaVersion!==BRUSH_SCHEMA){
  const stroke=l.strokes[s.stroke];
  if(stroke&&s.holding&&s.color===stroke.color&&s.ink>.01){
   const next=stroke.points[s.node],distance=Math.hypot(s.pointer.x-next.x,s.pointer.y-next.y);
   if(distance<l.radius){s.startedStroke=true;s.painted.push({...next,color:s.color,stroke:s.stroke});s.node++;s.ink=Math.max(0,s.ink-.034);s.score+=16;emit(s,'ink',next.x,next.y,{color:s.color});
    if(s.node===stroke.points.length){s.stroke++;s.node=0;s.startedStroke=false;s.holding=false;s.status='这一笔完成 · 按下一笔颜色继续';if(s.stroke===l.strokes.length)finishWorkshop(s,true,100-Math.min(35,s.offPath*2));}
   }else if(s.startedStroke&&distance>l.radius*2.5){s.offPath+=dt;s.status='笔尖偏离引导，回到发亮的笔触位置';}
  }
 }
 if(!s.result&&s.remaining<=0)finishWorkshop(s,false);
}
