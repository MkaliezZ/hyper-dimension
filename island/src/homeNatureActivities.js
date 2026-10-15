const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const dayOK=day=>{if(!Number.isSafeInteger(day)||day<1||day>9999999)throw Error('invalid_home_challenge');};
const normalize=cells=>{const x=Math.min(...cells.map(p=>p[0])),y=Math.min(...cells.map(p=>p[1]));return cells.map(([a,b])=>[a-x,b-y]);};
export const PACK_ITEMS=[
 {id:'rod',name:'渔竿套',cells:[[0,0],[1,0],[2,0],[3,0]],color:'#709ca4'},
 {id:'c16_7',name:'渔网包',cells:[[0,0],[1,0],[0,1],[1,1]],color:'#7f9d75'},
 {id:'c23_3',name:'船绳袋',cells:[[0,0],[0,1],[1,1]],color:'#b68b65'},
 {id:'c16_2',name:'浮漂盒',cells:[[0,0],[1,0],[0,1],[1,1]],color:'#bf8a83'},
 {id:'c2_11',name:'便当盒',cells:[[0,0],[1,0],[2,0]],color:'#c29e66'},
 {id:'c1_1',name:'凉饮架',cells:[[0,0],[1,0],[2,0]],color:'#9d95b8'}
];
export function packCells(piece,rotation=0){let cells=piece.cells.map(p=>[...p]);for(let i=0;i<rotation;i++)cells=cells.map(([x,y])=>[-y,x]);return normalize(cells);}
export const packAnchor=(piece,rotation)=>packCells(piece,rotation).sort((a,b)=>a[1]-b[1]||a[0]-b[0])[0];
const validPlacement=p=>p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===3&&['x','y','r'].every(k=>Number.isInteger(p[k]))&&p.r>=0&&p.r<4;
export function packingOccupancy(c,placements){
 if(!Array.isArray(placements)||placements.length!==6)return null;
 const cells=Array(24).fill(null);for(const block of c.blocked)cells[block]=-1;
 for(let i=0;i<6;i++){const p=placements[i];if(p===null)continue;if(!validPlacement(p))return null;
  for(const[dx,dy]of packCells(PACK_ITEMS[i],p.r)){const x=p.x+dx,y=p.y+dy;if(x<0||x>=6||y<0||y>=4||cells[y*6+x]!==null)return null;cells[y*6+x]=i;}
 }return cells;
}
export function placePacking(c,board,piece,x,y,r){if(!Array.isArray(board)||board.length!==7||!Number.isInteger(piece)||piece<0||piece>5)return null;const next=board.map(v=>v&&typeof v==='object'?{...v}:v);next[piece+1]={x,y,r};return packingOccupancy(c,next.slice(1))?next:null;}
export function voyageChallenge(day){
 dayOK(day);const random=rng(day*7069+196),flipX=random()<.5,flipY=random()<.5;
 const origin=[{x:0,y:0,r:0},{x:4,y:0,r:0},{x:0,y:1,r:0},{x:2,y:1,r:0},{x:0,y:3,r:0},{x:3,y:3,r:0}];
 const transform=([x,y])=>[flipX?5-x:x,flipY?3-y:y];
 const solution=origin.map((p,i)=>{const target=packCells(PACK_ITEMS[i],p.r).map(([x,y])=>transform([x+p.x,y+p.y])),x=Math.min(...target.map(p=>p[0])),y=Math.min(...target.map(p=>p[1]));const key=cells=>cells.map(p=>p.join(',')).sort().join(';'),shape=key(normalize(target));return {x,y,r:[0,1,2,3].find(r=>key(packCells(PACK_ITEMS[i],r))===shape)};});
 const blocked=[7,16,17].map(i=>{const[x,y]=transform([i%6,Math.floor(i/6)]);return y*6+x;});
 const departure=Math.floor(random()*4),forecast=Array.from({length:4},(_,i)=>{const type=(i-departure+4)%4;return {hour:6+i*3,tide:type===1?'退潮':'涨潮',wind:type===2?5:2+Math.floor(random()*2),weather:type===3?'风雨':'多云'};});
 return {kind:'voyage',day,blocked,forecast,solution:[departure,...solution],board:[null,...Array(6).fill(null)],rotations:PACK_ITEMS.map(()=>Math.floor(random()*4))};
}
export const suitableDeparture=f=>!!f&&f.tide==='涨潮'&&f.wind<=3&&f.weather!=='风雨';
export function voyageSolved(c,board){return Array.isArray(board)&&board.length===7&&Number.isInteger(board[0])&&board[0]>=0&&board[0]<4&&suitableDeparture(c.forecast[board[0]])&&board.slice(1).every(validPlacement)&&!!packingOccupancy(c,board.slice(1));}

export function lineRuns(row){const runs=[];let length=0;for(const value of [...row,0]){if(value===1)length++;else if(length){runs.push(length);length=0;}}return runs.length?runs:[0];}
const leafPatterns=[['001000','011100','111110','011100','001000','001000'],['001000','001100','011110','001100','001000','001000'],['010100','111110','001000','111110','010100','001000'],['001100','011110','011110','001100','000100','000100']];
const same=(a,b)=>a.length===b.length&&a.every((n,i)=>n===b[i]);
export function leafChallenge(day){
 dayOK(day);const random=rng(day*8017+196),pattern=leafPatterns[Math.floor(random()*leafPatterns.length)],turns=Math.floor(random()*4),mirror=random()<.5;
 let solution=pattern.flatMap(row=>[...row].map(Number));if(mirror)solution=Array.from({length:36},(_,i)=>solution[Math.floor(i/6)*6+5-i%6]);
 for(let r=0;r<turns;r++){const old=solution;solution=Array.from({length:36},(_,i)=>old[(5-i%6)*6+Math.floor(i/6)]);}
 const rows=Array.from({length:6},(_,y)=>lineRuns(solution.slice(y*6,y*6+6))),columns=Array.from({length:6},(_,x)=>lineRuns(Array.from({length:6},(_,y)=>solution[y*6+x])));
 return {kind:'leafprint',day,rows,columns,solution:solution.map(v=>v?1:2),board:Array(36).fill(0),specimen:['herb','mint','lavender','leaves'][Math.floor(random()*4)]};
}
export function leafLineStatus(c,board){return {rows:c.rows.map((clue,y)=>{const row=board.slice(y*6,y*6+6);return !row.includes(0)&&same(lineRuns(row),clue);}),columns:c.columns.map((clue,x)=>{const col=Array.from({length:6},(_,y)=>board[y*6+x]);return !col.includes(0)&&same(lineRuns(col),clue);})};}
export function leafSolved(c,board){if(!Array.isArray(board)||board.length!==36||!board.every(v=>v===1||v===2))return false;const s=leafLineStatus(c,board);return s.rows.every(Boolean)&&s.columns.every(Boolean);}
export function solveLeaf(c,limit=2){
 const lines=Array.from({length:64},(_,n)=>Array.from({length:6},(_,i)=>(n>>i)&1)),choices=c.rows.map(clue=>lines.filter(row=>same(lineRuns(row),clue))),columns=c.columns.map(clue=>lines.filter(row=>same(lineRuns(row),clue))),results=[];
 const visit=rows=>{if(results.length>=limit)return;if(rows.length===6){results.push(rows.flat().map(v=>v?1:2));return;}for(const row of choices[rows.length]){const next=[...rows,row];if(columns.every((options,x)=>options.some(col=>next.every((r,y)=>r[x]===col[y]))))visit(next);}};visit([]);return results;
}
export const homeNatureChallenge=(id,day)=>id===8?voyageChallenge(day):id===9?leafChallenge(day):null;
export const homeNatureSolved=(c,board)=>c.kind==='voyage'?voyageSolved(c,board):c.kind==='leafprint'?leafSolved(c,board):false;
export function evaluateNatureActivity(input,day){const c=homeNatureChallenge(input.homeId,day);if(!c||!homeNatureSolved(c,input.board))return null;return {homeId:input.homeId,kind:c.kind,day,board:structuredClone(input.board),title:c.kind==='voyage'?'潮汐行囊演练':'一页叶影标本'};}
