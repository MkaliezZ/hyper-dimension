import {shuffle,seededRandom} from './gameLevels.js';
import {playableMatchBoard,matchedCells} from './gameBoards.js';

export function linkPath(values,columns,rows,a,b){
 if(a===b||a<0||b<0||values[a]==null||values[a]!==values[b])return null;
 const start={x:a%columns+1,y:Math.floor(a/columns)+1},end={x:b%columns+1,y:Math.floor(b/columns)+1},dirs=[[1,0],[0,1],[-1,0],[0,-1]],queue=[{...start,dir:-1,turns:0,path:[start]}],best=new Map();
 for(let q=0;q<queue.length;q++){
  const current=queue[q];
  for(let dir=0;dir<4;dir++){
   const turns=current.turns+(current.dir!==-1&&current.dir!==dir?1:0);
   if(turns>2)continue;
   const x=current.x+dirs[dir][0],y=current.y+dirs[dir][1];
   if(x<0||x>columns+1||y<0||y>rows+1)continue;
   if(x===end.x&&y===end.y){
    const raw=[...current.path,{x,y}],path=raw.filter((p,i)=>!i||i===raw.length-1||(p.x-raw[i-1].x)!==(raw[i+1].x-p.x)||(p.y-raw[i-1].y)!==(raw[i+1].y-p.y));
    return path.map(p=>({x:p.x-1,y:p.y-1}));
   }
   if(x>0&&x<=columns&&y>0&&y<=rows&&values[(y-1)*columns+x-1]!=null)continue;
   const key=x+','+y+','+dir;if((best.get(key)??3)<=turns)continue;
   best.set(key,turns);queue.push({x,y,dir,turns,path:[...current.path,{x,y}]});
  }
 }
 return null;
}
export function findLinkMove(values,columns,rows){
 for(let a=0;a<values.length;a++)if(values[a]!=null)for(let b=a+1;b<values.length;b++)if(values[a]===values[b]){const path=linkPath(values,columns,rows,a,b);if(path)return {a,b,path}}
 return null;
}
export function solveLinks(values,columns,rows){
 const copy=[...values],steps=[];while(copy.some(x=>x!=null)){const move=findLinkMove(copy,columns,rows);if(!move)return null;steps.push(move);copy[move.a]=copy[move.b]=null}return steps;
}
export function shuffleLinks(values,columns,rows,random){
 const tokens=values.filter(x=>x!=null),active=values.flatMap((x,i)=>x==null?[]:[i]);
 for(let attempt=0;attempt<50;attempt++){
  const shuffled=shuffle(tokens,random),board=Array(values.length).fill(null);active.forEach((i,k)=>board[i]=shuffled[k]);
  const solution=solveLinks(board,columns,rows);if(solution)return {values:board,solution};
 }
 const pairs=[];for(const value of new Set(tokens)){const count=tokens.filter(x=>x===value).length;if(count%2)throw Error('Unpaired link tile');for(let i=0;i<count;i+=2)pairs.push([value,value])}
 const board=Array(values.length).fill(null);shuffle(pairs,random).flat().forEach((v,i)=>board[i]=v);
 return {values:board,solution:solveLinks(board,columns,rows)};
}
export function makeLinkBoard(level){
 const {columns,rows,types}=level.link,random=seededRandom(level.seed^0xBED7),tokens=Array.from({length:columns*rows/2},(_,i)=>[i%types,i%types]).flat();
 return shuffleLinks(tokens,columns,rows,random);
}
export function matchGroups(values,n=6){
 const groups=[];
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,color=values[i];if(color==null)continue;
  if(x===0||values[i-1]!==color){const indices=[];for(let xx=x;xx<n&&values[y*n+xx]===color;xx++)indices.push(y*n+xx);if(indices.length>=3)groups.push({indices,axis:'row',color});}
  if(y===0||values[i-n]!==color){const indices=[];for(let yy=y;yy<n&&values[yy*n+x]===color;yy++)indices.push(yy*n+x);if(indices.length>=3)groups.push({indices,axis:'column',color});}
 }
 return groups;
}
export function matchMoves(state){
 const moves=[];
 for(let i=0;i<36;i++)for(const j of [i%6<5?i+1:-1,i+6<36?i+6:-1]){
  if(j<0)continue;
  if(state.specials[i]||state.specials[j]){moves.push([i,j]);continue;}
  const copy=[...state.values];[copy[i],copy[j]]=[copy[j],copy[i]];if(matchGroups(copy).length)moves.push([i,j]);
 }
 return moves;
}
export function createMatchState(level){
 const random=seededRandom(level.seed^0xA71E),values=playableMatchBoard(random),seals=Array(36).fill(0);
 shuffle(Array.from({length:36},(_,i)=>i),random).slice(0,level.match.sealCount).forEach(i=>seals[i]=1);
 return {values,specials:Array(36).fill(null),seals,targets:level.match.targets.map(t=>({...t})),sealGoal:level.match.sealCount,sealsCleared:0,moves:level.match.moves,initialMoves:level.match.moves,score:0,combo:0,bestCombo:0,random,shuffles:Math.max(1,4-level.difficulty),hints:Math.max(1,4-level.difficulty)};
}
export function matchWon(s){return s.targets.every(t=>t.got>=t.need)&&s.sealsCleared>=s.sealGoal}
export function matchSnapshot(s){return {values:[...s.values],specials:[...s.specials],seals:[...s.seals],targets:s.targets.map(t=>({...t})),sealsCleared:s.sealsCleared,sealGoal:s.sealGoal,moves:s.moves,score:s.score,combo:s.combo,bestCombo:s.bestCombo,shuffles:s.shuffles,hints:s.hints}}
export function shuffleMatch(s,manual=false){
 if(manual&&s.shuffles<=0)return false;
 if(manual)s.shuffles--;
 const pieces=s.values.map((value,i)=>({value,special:s.specials[i]}));
 for(let tries=0;tries<80;tries++){
  const a=shuffle(pieces,s.random);s.values=a.map(p=>p.value);s.specials=a.map(p=>p.special);
  if(!matchedCells(s.values).length&&matchMoves(s).length)return true;
 }
 s.values=playableMatchBoard(s.random);s.specials=shuffle(pieces.map(p=>p.special),s.random);return true;
}
function burstCells(index,kind,values,rainbowColor){
 const x=index%6,y=Math.floor(index/6),out=[];
 if(kind==='rainbow'){const color=rainbowColor??values[index];return values.flatMap((v,i)=>v===color?[i]:[])}
 for(let i=0;i<36;i++)if(kind==='row'&&Math.floor(i/6)===y||kind==='column'&&i%6===x||kind==='burst'&&Math.abs(i%6-x)<=1&&Math.abs(Math.floor(i/6)-y)<=1)out.push(i);
 return out;
}
export function swapMatch(s,a,b){
 if(s.moves<=0||matchWon(s)||a===b||Math.abs(a%6-b%6)+Math.abs(Math.floor(a/6)-Math.floor(b/6))!==1)return {valid:false,frames:[]};
 [s.values[a],s.values[b]]=[s.values[b],s.values[a]];[s.specials[a],s.specials[b]]=[s.specials[b],s.specials[a]];
 let groups=matchGroups(s.values),forced=s.specials[a]||s.specials[b]?[a,b]:[];
 if(!groups.length&&!forced.length){[s.values[a],s.values[b]]=[s.values[b],s.values[a]];[s.specials[a],s.specials[b]]=[s.specials[b],s.specials[a]];return {valid:false,frames:[]};}
 s.moves--;s.combo=0;const frames=[{kind:'swap',snapshot:matchSnapshot(s),swap:[a,b]}];
 let rainbowColor=s.specials[a]==='rainbow'?s.values[b]:s.specials[b]==='rainbow'?s.values[a]:null;
 const doubleRainbow=s.specials[a]==='rainbow'&&s.specials[b]==='rainbow';
 for(let cascade=0;cascade<40&&(groups.length||forced.length);cascade++){
  s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);
  const clear=new Set([...groups.flatMap(g=>g.indices),...forced]),created=new Map(),activated=new Set();
  if(!forced.length){
   for(const group of groups){
    const crossing=groups.find(other=>other!==group&&other.axis!==group.axis&&other.indices.some(i=>group.indices.includes(i)));
    if(group.indices.length<4&&!crossing)continue;
    const index=crossing?group.indices.find(i=>crossing.indices.includes(i)):group.indices.includes(b)?b:group.indices.includes(a)?a:group.indices[Math.floor(group.indices.length/2)];
    const kind=group.indices.length>=5?'rainbow':crossing?'burst':group.axis;
    if(!created.has(index)||kind==='rainbow')created.set(index,kind);
   }
  }
  if(doubleRainbow&&cascade===0)for(let i=0;i<36;i++)clear.add(i);
  const pending=[...clear];
  for(let i=0;i<pending.length;i++){
   const index=pending[i],special=s.specials[index];
   if(!special||activated.has(index))continue;activated.add(index);
   for(const cell of burstCells(index,special,s.values,rainbowColor))if(!clear.has(cell)){clear.add(cell);pending.push(cell)}
  }
  for(const [index,kind] of created){clear.delete(index);s.specials[index]=kind;}
  for(const index of clear){
   const target=s.targets.find(t=>t.color===s.values[index]);if(target)target.got=Math.min(target.need,target.got+1);
   if(s.seals[index]){s.seals[index]=0;s.sealsCleared++;}
  }
  s.score+=clear.size*s.combo;
  frames.push({kind:'clear',snapshot:matchSnapshot(s),cleared:[...clear],created:[...created],activated:[...activated],combo:s.combo});
  const drops=Array(36).fill(0);
  for(let x=0;x<6;x++){
   const remain=[];for(let y=5;y>=0;y--){const index=y*6+x;if(!clear.has(index))remain.push({value:s.values[index],special:s.specials[index],y})}
   for(let y=5;y>=0;y--){const index=y*6+x,p=remain[5-y];s.values[index]=p?.value??Math.floor(s.random()*5);s.specials[index]=p?.special??null;drops[index]=p?y-p.y:6-remain.length;}
  }
  frames.push({kind:'fall',snapshot:matchSnapshot(s),drops});
  groups=matchGroups(s.values);forced=[];rainbowColor=null;
 }
 if(matchGroups(s.values).length||!matchWon(s)&&!matchMoves(s).length){shuffleMatch(s);frames.push({kind:'shuffle',snapshot:matchSnapshot(s)});}
 return {valid:true,frames,won:matchWon(s),lost:!matchWon(s)&&s.moves===0};
}

// A hint favors unfinished orders and covered cells instead of a random swap.
export function suggestMatchMove(s){
 let best=null,weight=-1;
 for(const [a,b] of matchMoves(s)){
  const v=[...s.values];[v[a],v[b]]=[v[b],v[a]];const groups=matchGroups(v);const indices=new Set(groups.flatMap(g=>g.indices));let bonus=groups.reduce((n,g)=>n+(g.indices.length>=4?4:0),0);
  for(const [i,j] of [[a,b],[b,a]])if(s.specials[i]){
   if(s.specials[i]==='rainbow')v.forEach((x,k)=>{if(x===s.values[j])indices.add(k)});
   if(s.specials[i]==='row')v.forEach((x,k)=>{if(Math.floor(k/6)===Math.floor(j/6))indices.add(k)});
   if(s.specials[i]==='column')v.forEach((x,k)=>{if(k%6===j%6)indices.add(k)});
   if(s.specials[i]==='burst')v.forEach((x,k)=>{if(Math.abs(k%6-j%6)<=1&&Math.abs(Math.floor(k/6)-Math.floor(j/6))<=1)indices.add(k)});
  }
  for(const i of indices){bonus+=1+s.seals[i]*8+(s.targets.find(t=>t.color===v[i]&&t.got<t.need)?3:0)}
  if(bonus>weight){weight=bonus;best=[a,b]}
 }
 return best;
}
