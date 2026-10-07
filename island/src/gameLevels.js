import {ALL_RECIPES,ITEM_BY_ID} from './contentCatalog.js';

export const DIFFICULTIES=['','轻松','标准','挑战'];
export function seededRandom(seed){let a=seed>>>0;const random=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296};random.state=()=>a;return random}
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
export function freshSeed(){const a=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(a);else a[0]=(Date.now()+Math.random()*4294967296)>>>0;return a[0]||1}
export function chooseDifficulty(history={},mode='auto',random=Math.random){
 if(mode!=='auto')return Math.max(1,Math.min(3,Number(mode)||1));
 const wins=history.wins||0,base=1+(wins>=3)+(wins>=9);
 if(history.lossStreak)return Math.max(1,base-1);
 if((history.attempts||0)<2)return 1;
 return Math.max(1,Math.min(wins<3?2:3,base+[-1,0,0,1][Math.floor(random()*4)]));
}
export function rotatePiece(piece,rotation){let p=piece.map(a=>[...a]);for(let i=0;i<rotation;i++)p=p.map(([x,y])=>[-y,x]);const x0=Math.min(...p.map(p=>p[0])),y0=Math.min(...p.map(p=>p[1]));return p.map(([x,y])=>[x-x0,y-y0])}
// Anchor a piece on its first filled square, so empty bounding-box corners never
// require clicking outside the playable silhouette.
export function pieceOffsets(piece,rotation){
 const p=rotatePiece(piece,rotation),anchor=p.reduce((a,b)=>b[1]<a[1]||b[1]===a[1]&&b[0]<a[0]?b:a);
 return p.map(([x,y])=>[x-anchor[0],y-anchor[1]]);
}
export function packingLayout(random,difficulty){
 const shapes=[[[0,0],[1,0],[0,1],[1,1]],[[0,0],[1,0],[2,0],[1,1]],[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[0,1],[1,1]],[[0,0],[1,0],[2,0]],[[0,0],[1,0],[2,0],[3,0]],[[0,0],[1,0],[1,1]]];
 const count=2+difficulty;
 for(let attempt=0;attempt<100;attempt++){
  const pieces=Array.from({length:count},()=>rotatePiece(shapes[Math.floor(random()*shapes.length)],Math.floor(random()*4))),used=new Set(),solution=[];
  for(let i=0;i<count;i++){
   const candidates=[];
   for(let rotation=0;rotation<4;rotation++)for(let y=0;y<4;y++)for(let x=0;x<6;x++){
    const points=rotatePiece(pieces[i],rotation).map(([dx,dy])=>[x+dx,y+dy]);
    if(points.some(([xx,yy])=>xx>=6||yy>=4||used.has(yy*6+xx)))continue;
    if(i&&!points.some(([xx,yy])=>[[xx-1,yy],[xx+1,yy],[xx,yy-1],[xx,yy+1]].some(([a,b])=>a>=0&&a<6&&b>=0&&b<4&&used.has(b*6+a))))continue;
    const anchor=points.reduce((a,b)=>b[1]<a[1]||b[1]===a[1]&&b[0]<a[0]?b:a);candidates.push({piece:i,index:anchor[1]*6+anchor[0],rotation,cells:points.map(([xx,yy])=>yy*6+xx)});
   }
   if(!candidates.length)break;
   const move=candidates[Math.floor(random()*candidates.length)];solution.push(move);move.cells.forEach(k=>used.add(k));
  }
  if(solution.length===count)return {pieces,target:[...used],solution,columns:6,rows:4};
 }
 // Independent dominoes are a bounded, solvable fallback, even for a degenerate RNG.
 const pieces=Array.from({length:count},()=>[[0,0],[1,0]]),solution=pieces.map((_,piece)=>({piece,index:piece*2,rotation:0,cells:[piece*2,piece*2+1]}));
 return {pieces,solution,target:solution.flatMap(p=>p.cells),columns:6,rows:4};
}
export function mazePath(start,end,walls,cols=8,rows=6){
 const wall=new Set(walls),queue=[start],parent=new Map([[start,null]]);
 for(let k=0;k<queue.length;k++){const i=queue[k];if(i===end){const path=[];for(let p=end;p!=null;p=parent.get(p))path.push(p);return path.reverse()}for(const n of [i-1,i+1,i-cols,i+cols])if(n>=0&&n<cols*rows&&!wall.has(n)&&!parent.has(n)&&Math.abs(n%cols-i%cols)+Math.abs(Math.floor(n/cols)-Math.floor(i/cols))===1){parent.set(n,i);queue.push(n)}}
 return [];
}
export function mazeLayout(random,difficulty){
 const corners=shuffle([0,7,40,47],random),start=corners[0],exit=corners[1],walls=[];
 for(const c of shuffle(Array.from({length:48},(_,i)=>i).filter(i=>i!==start&&i!==exit),random)){
  if(walls.length>=9+difficulty*2)break;
  const next=[...walls,c],floors=Array.from({length:48},(_,i)=>i).filter(i=>!next.includes(i));
  if(floors.every(i=>mazePath(start,i,next).length))walls.push(c);
 }
 const targets=shuffle(Array.from({length:48},(_,i)=>i).filter(i=>i!==start&&i!==exit&&!walls.includes(i)&&mazePath(start,i,walls).length>3),random).slice(0,difficulty===3?4:3);
 function shortest(at,rest){if(!rest.length)return mazePath(at,exit,walls).length-1;return Math.min(...rest.map(p=>mazePath(at,p,walls).length-1+shortest(p,rest.filter(i=>i!==p))))}
 const optimal=shortest(start,targets);
 return {start,exit,walls,targets,columns:8,rows:6,optimal,steps:difficulty===1?0:optimal+(difficulty===2?24:14)};
}
const constellationTemplates=[
 {name:'海燕',names:['晨星','翼根','左翼','尾羽','右翼','归航星'],points:[[16,24],[38,38],[20,65],[52,72],[77,50],[86,20]]},
 {name:'海豚',names:['吻端','额星','背鳍','尾星','腹星','回游星'],points:[[16,52],[31,27],[58,18],[85,38],[68,63],[37,72]]},
 {name:'小熊',names:['尾星','腰星','肩星','前足','北极星','耳星','回望星'],points:[[14,68],[29,47],[45,40],[57,60],[78,48],[75,21],[52,22]]},
 {name:'风帆',names:['桅顶','上帆','风角','下帆','船首','船尾'],points:[[43,14],[29,35],[70,50],[46,57],[81,76],[18,76]]}
];
const dressSets=[
 {name:'海风航海',items:['c4_9','c4_7','c4_3'],labels:['上装','下装','帽饰']},
 {name:'星夜舞会',items:['c4_8','c4_6','c4_10'],labels:['礼服','披风','发饰']},
 {name:'花园手作',items:['c4_1','c4_2','c4_5'],labels:['衬衫','围裙','披肩']}
],homeSets=[
 {name:'海风阅读角',items:['c19_4','c19_0','c19_7'],labels:['窗边','沙发','收纳区']},
 {name:'温暖露台',items:['c19_2','c19_6','c19_9'],labels:['地面','壁炉边','休息角']},
 {name:'星夜卧室',items:['c19_1','c19_3','c19_8'],labels:['床尾','枕边','床头']}
];
export function makeLevel(id,{seed=freshSeed(),difficulty=1}={}){
 const random=seededRandom(seed^Math.imul(id+1,31337)),pick=a=>a[Math.floor(random()*a.length)],range=(lo,hi)=>lo+random()*(hi-lo),integer=(lo,hi)=>Math.floor(range(lo,hi+1));
 const d=Math.max(1,Math.min(3,difficulty)),items=ALL_RECIPES.filter(r=>r.building===id).map(r=>r.item);
 const level={id,seed,difficulty:d,label:DIFFICULTIES[d],variant:integer(1,99999),mistakeLimit:7-d*2,hints:Math.max(1,4-d),items};
 if([0,17].includes(id))Object.assign(level,packingLayout(random,d));
 if(id===1){const pairs=3+d;level.memory={values:shuffle(Array.from({length:pairs},(_,i)=>[i,i]).flat(),random),ids:shuffle(['herb','mint','lavender','rose','sunflower','honey'],random).slice(0,pairs),columns:4,mistakes:pairs+(3-d),preview:4-d};}
 if([3,9].includes(id)){
  const variant=integer(0,2),colors=shuffle([0,1,2,3,4],random).slice(0,d===3?3:2);
  level.match={variant,targets:colors.map(color=>({color,need:5+d*3,got:0})),moves:26-d*2,sealCount:variant===0?0:3+d*2};
  if(variant===1)level.match.targets=colors.slice(0,1).map(color=>({color,need:8+d*2,got:0}));
 }
 if([7,11].includes(id)){const columns=d===1?4:6,rows=d===3?6:4;level.link={columns,rows,types:Math.min(10,5+d),seconds:[0,180,150,135][d],shuffles:3-d,ids:shuffle(items,random).slice(0,5+d)}}
 if([2,10].includes(id)){const count=2+d;level.orders=Array.from({length:count},(_,i)=>({ingredients:shuffle([0,1,2,3],random).slice(0,d===3&&i%2?3:2),cook:range(1.7,2.8),window:[0,4.5,3.5,2.8][d]}));}
 if([4,19].includes(id)){
  const set=pick(id===4?dressSets:homeSets);
  level.arrangement={...set,choices:shuffle([...set.items,...shuffle(items.filter(k=>!set.items.includes(k)),random).slice(0,2+d)],random)};
 }
 if(id===5){const c=structuredClone(pick(constellationTemplates));level.constellation={name:c.name,steps:c.names,points:c.points.map(([x,y])=>[x+range(-3,3),y+range(-3,3)])}}
 if(id===6){
  level.balance=[['水温',integer(21,25),0,15,35,'℃'],['溶氧',integer(50,67),0,0,100,'%'],['水流',integer(28,50),0,0,100,'%']];
  for(const c of level.balance)c[2]=c[1]+(c[0]==='水温'?6-d:24-d*4);
  level.balanceStart=level.balance.map(c=>integer(c[3],c[4]));level.stableSeconds=2+d;
 }
 if(id===8){level.headings=shuffle(Array.from({length:24},(_,i)=>i*15),random).slice(0,2+d);level.initialHeading=integer(0,23)*15;}
 if(id===13){level.photos=Array.from({length:2+d},()=>({focus:integer(30,75),x:range(26,74),y:range(30,68),art:pick(['c3_2','fish','c18_3','c14_2','c22_2']),speed:range(.35,.75)}));level.focusTolerance=11-d*2;}
 if([14,22].includes(id))level.maze=mazeLayout(random,d);
 if([15,24].includes(id)){
  const width=range(72,105),neck=range(20,42),height=range(96,124),phase=range(-.15,.15),lean=range(-14,14);
  level.trace={radius:28-d*4,path:Array.from({length:70},(_,i)=>{const a=i/69*Math.PI*2;return {x:300+(id===15?width+neck*Math.cos(a*2+phase):width*(1+.25*Math.cos(a)))*Math.sin(a)+lean*Math.cos(a),y:174+height*Math.cos(a)}})};
 }
 if(id===16)level.fish={amplitude:range(42,55)+d*8,frequency:range(.55,.8)+d*.08,phase:range(0,6.28),secondPhase:range(0,6.28),halfHeight:62-d*6,rate:1/(4+d*2),name:pick(['巡游','回旋','跃动'])};
 if([12,21].includes(id)){
  const bpm=integer(78+d*10,86+d*10),beat=60/bpm;let at=2;
  level.music={bpm,window:.29-d*.025,notes:Array.from({length:6+d*4},(_,i)=>{at+=beat*(i&&random()<.22?.75:1);return {lane:integer(0,3),at,hit:false,miss:false}})};
 }
 if(id===18){const columns=d===3?4:3,rows=d===1?2:3,total=columns*rows;let order=shuffle(Array.from({length:total},(_,i)=>i),random);if(order.every((n,i)=>n===i))[order[0],order[1]]=[order[1],order[0]];level.puzzle={columns,rows,order,referenceItem:pick(items)};}
 if(id===20)level.launch={targets:Array.from({length:2+d},(_,i)=>({x:90+i*(420/(1+d))+range(-16,16),y:range(55,155)})),shots:5+d,charge:.2+d*.06,radius:48-d*5};
 if(id===23)level.boat={buoys:shuffle([{x:130,y:85},{x:295,y:65},{x:465,y:115},{x:280,y:220},{x:110,y:205}],random).slice(0,2+d).map(p=>({x:p.x+range(-15,15),y:p.y+range(-13,13)})),current:{x:range(-2,2)*d,y:range(-2,2)*d},radius:44-d*3};
 return level;
}
export function createGameContext(state,id,base={},mode){
 state.miniGameHistory??={};const h=state.miniGameHistory[id]={attempts:0,wins:0,lossStreak:0,winStreak:0,recentSeeds:[],completedSeeds:[],...state.miniGameHistory[id]};
 mode??=h.lastMode||'auto';const random=seededRandom(freshSeed()),difficulty=chooseDifficulty({...h,wins:Math.max(h.wins,state.roomGames?.[id]?.plays||0)},mode,random);
 let seed=freshSeed();while((h.recentSeeds||[]).includes(seed))seed=(seed+1)>>>0;
 h.attempts++;h.recentSeeds=[...(h.recentSeeds||[]),seed].slice(-12);h.lastDifficulty=difficulty;h.lastMode=mode;base.persist?.();
 const level=makeLevel(id,{seed,difficulty});
 return {...base,readBest:()=>state.workshopBests?.[id+'-'+difficulty]||{score:0,stars:0},writeBest:best=>{state.workshopBests??={};state.workshopBests[id+'-'+difficulty]=best;base.persist?.()},mode,level,nextSession:nextMode=>createGameContext(state,id,base,nextMode??mode),onOutcome:r=>{
  if((h.completedSeeds||[]).includes(seed))return;
  h.completedSeeds=[...(h.completedSeeds||[]),seed].slice(-20);h.wins+=r.passed?1:0;h.lossStreak=r.passed?0:(h.lossStreak||0)+1;h.winStreak=r.passed?(h.winStreak||0)+1:0;
  h.lastResult={passed:r.passed,quality:r.quality||0,difficulty,seed};base.persist?.();
 }};
}
export function nextGameOptions(options,mode=options.mode||'auto'){
 if(options.nextSession)return options.nextSession(mode);
 return {...options,mode,level:makeLevel(options.level?.id??options.id,{difficulty:mode==='auto'?options.level?.difficulty||1:Number(mode)})};
}
export function gameLevelOptions(id,options){return {...options,id,mode:options.mode||'auto',level:options.level||makeLevel(id,{seed:options.seed,difficulty:options.difficulty||1})}}
export function itemName(id){return ITEM_BY_ID[id]?.name||id}
