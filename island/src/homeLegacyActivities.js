import {WONDER_DEFINITIONS} from './eventWonders.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const dayOK=day=>{if(!Number.isSafeInteger(day)||day<1||day>9999999)throw Error('invalid_home_challenge');};
const shuffle=(values,r)=>{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
const practice=[
 {id:'map',name:'折叠航线图',hint:'纸角有三角印记，细线穿过许多海湾。',origin:'测绘练习留下的纸页，纸角印着三角记号，记录海湾之间的路线。',frame:{x:78,y:185,w:155}},
 {id:'boat',name:'旧帆船模型',hint:'缩小的船身，桅杆旁留着一段缠线。',origin:'修船练习的木制纪念，缠线固定住小帆，安静地留在岸上。',frame:{x:230,y:70,w:110}},
 {id:'crystal',name:'彩晶标本',hint:'几片棱面聚在一起，光照时有冷暖的颜色。',origin:'矿物观察练习的标本，晶面保留不同角度，包裹在软垫里带回。',frame:{x:345,y:65,w:100}},
 {id:'vase',name:'蓝纹小陶瓶',hint:'浅色陶身，瓶面有一枝蓝色叶纹。',origin:'窑火练习的纪念，釉面上留下蓝叶纹，瓶口比瓶腹窄。',frame:{x:450,y:55,w:95}},
 {id:'shell',name:'玻罩里的贝壳',hint:'扇形纹理，被透明的小罩认真护住。',origin:'海岸观察练习留下的纪念，扇纹不怕遗忘，被罩在透明的小世界里。',frame:{x:420,y:180,w:90}},
 {id:'trunk',name:'旧旅行箱',hint:'皮带扣在箱面，旁边还搭着一件外套。',origin:'旅行收纳练习的物件，皮带与锁扣已经收好，陪外套等下一次出发。',frame:{x:610,y:375,w:240}}
];
export function ownedOriginFacts(state={}){
 return Object.entries(state.eventWonders?.owned||{}).filter(([id,a])=>WONDER_DEFINITIONS[id]&&a&&Number.isSafeInteger(a.day)&&a.day>0&&typeof a.eventId==='string'&&a.eventId&&typeof a.eventName==='string').map(([id,a])=>({key:'owned:'+id,name:WONDER_DEFINITIONS[id].name,hint:WONDER_DEFINITIONS[id].condition,origin:WONDER_DEFINITIONS[id].condition,day:a.day,eventId:a.eventId,eventName:a.eventName,mode:'owned',art:{kind:'wonder',id,color:WONDER_DEFINITIONS[id].colors.find(c=>c.index===a.color)?.id||'sea'}}));
}
export function practiceOriginFacts(day){dayOK(day);const r=rng(day*5209+199),days=shuffle([1,2,3,4,5,6],r);return practice.map((p,i)=>({key:'practice:'+p.id,name:p.name,hint:p.hint,origin:p.origin,day:days[i],eventId:null,eventName:'知夏的虚构来历练习',mode:'practice',art:{kind:'room',frame:p.frame}}));}
export function originChallenge(day,state={},mode){
 dayOK(day);const random=rng(day*7319+199),owned=ownedOriginFacts(state),chosen=['owned','practice'].includes(mode)?mode:(owned.length?'owned':'practice'),pool=chosen==='owned'?owned:practiceOriginFacts(day),items=shuffle(pool,random).slice(0,4);
 if(!items.length)return originChallenge(day,state,'practice');
 const cards=shuffle([...items,...shuffle(pool.filter(p=>!items.some(x=>x.key===p.key)),random).slice(0,2)],random),solution=[...items].sort((a,b)=>a.day-b.day).map(p=>({itemId:p.key,sourceId:p.key+':source'}));
 return {kind:'origins',day,mode:chosen,items,cards,ownedCount:owned.length,board:Array(items.length).fill(null),solution};
}
export function originsSolved(c,board){
 if(!Array.isArray(board)||board.length!==c.items.length||board.some(p=>!p||typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==2||typeof p.itemId!=='string'||typeof p.sourceId!=='string'))return false;
 const facts=new Map(c.items.map(p=>[p.key,p]));return new Set(board.map(p=>p.itemId)).size===board.length&&board.every((p,i)=>facts.has(p.itemId)&&p.sourceId===p.itemId+':source'&&(i===0||facts.get(board[i-1].itemId).day<=facts.get(p.itemId).day));
}
export function placeOrigin(board,itemId,slot){if(!Array.isArray(board)||!Number.isInteger(slot)||slot<0||slot>=board.length||typeof itemId!=='string')return null;const next=board.map(p=>p?{...p}:null),old=next.findIndex(p=>p?.itemId===itemId),prior=next[slot];next[slot]=old>=0?next[old]:{itemId,sourceId:null};if(old>=0&&old!==slot)next[old]=prior;return next;}
function evaluateOrigins(input,day,state){
 const board=input.board;if(!Array.isArray(board)||board.length<1||board.length>4||board.some(p=>!p||typeof p.itemId!=='string'))return null;
 const mode=board.every(p=>p.itemId.startsWith('owned:'))?'owned':board.every(p=>p.itemId.startsWith('practice:'))?'practice':null;if(!mode||mode==='practice'&&board.length!==4)return null;
 const pool=mode==='owned'?ownedOriginFacts(state):practiceOriginFacts(day),items=board.map(p=>pool.find(x=>x.key===p.itemId));if(mode==='owned'&&board.length!==Math.min(4,pool.length)||items.some(p=>!p)||!originsSolved({items},board))return null;
 return {homeId:14,kind:'origins',day,mode,board:structuredClone(board),sources:items.map(p=>({id:p.key,name:p.name,day:p.day,eventId:p.eventId,eventName:p.eventName})),title:mode==='owned'?'收藏来历手记':'来历连线练习'};
}

export const POST_DIRS={U:[0,-1],D:[0,1],L:[-1,0],R:[1,0]},opposite={U:'D',D:'U',L:'R',R:'L'};
const nextCell=(cell,d)=>{const[dx,dy]=POST_DIRS[d];return cell+dx+dy*7;};
export function postStep(c,state,d){
 if(!Object.hasOwn(POST_DIRS,d))return null;const target=nextCell(state.player,d);if(c.walls.includes(target)||target<0||target>=49)return null;const boxes=[...state.boxes],index=boxes.indexOf(target);
 if(index>=0){const beyond=nextCell(target,d);if(c.walls.includes(beyond)||boxes.includes(beyond)||beyond<0||beyond>=49)return null;boxes[index]=beyond;}
 return {player:target,boxes};
}
export function replayPost(c,moves){if(typeof moves!=='string'||moves.length>2000||!/^[UDLR]*$/.test(moves))return null;let state=structuredClone(c.initial);for(const d of moves){state=postStep(c,state,d);if(!state)return null;}return state;}
export const postAtGoals=(c,state)=>!!state&&state.boxes.length===3&&state.boxes.every(p=>c.goals.includes(p));
export function postChallenge(day){
 dayOK(day);const border=Array.from({length:49},(_,i)=>i).filter(i=>i%7===0||i%7===6||i<7||i>=42),goals=[23,25,31];
 for(let trial=0;trial<40;trial++){
  const random=rng(day*8111+trial*941+199),walls=[...border,...(day%2?[16,18]:[8,12,36,40])];let state={player:24,boxes:[...goals]},reverse='',pulls=0,best=null;
  const seen=new Map();
  for(let step=0;step<180;step++){
   const choices=[];
   for(const d of shuffle(Object.keys(POST_DIRS),random)){
    const target=nextCell(state.player,d);if(walls.includes(target)||state.boxes.includes(target))continue;
    const behind=nextCell(state.player,opposite[d]),index=state.boxes.indexOf(behind);
    for(const pull of index>=0?[true,false]:[false]){const boxes=[...state.boxes];if(pull)boxes[index]=state.player;boxes.sort((a,b)=>a-b);const next={player:target,boxes},key=target+':'+boxes.join(',');choices.push({d,next,key,pull,score:(seen.get(key)||0)*5+random()-(pull?.7:0)});}
   }
   if(!choices.length)break;choices.sort((a,b)=>a.score-b.score);const choice=choices[0];seen.set(choice.key,(seen.get(choice.key)||0)+1);state=choice.next;reverse+=choice.d;if(choice.pull)pulls++;
   const displaced=state.boxes.filter(p=>!goals.includes(p)).length;
   if(pulls>=3&&displaced>=2){const score=displaced*20+state.boxes.reduce((sum,p)=>sum+Math.min(...goals.map(g=>Math.abs(p%7-g%7)+Math.abs(Math.floor(p/7)-Math.floor(g/7)))),0);if(!best||score>best.score)best={state:structuredClone(state),reverse,score};}
  }
  if(!best)continue;
  const solution=[...best.reverse].reverse().map(d=>opposite[d]).join('');return {kind:'postroute',day,walls,goals,initial:best.state,solution,board:['']};
 }
 throw Error('postal_challenge_generation_failed');
}
export const postSolved=(c,board)=>Array.isArray(board)&&board.length===1&&postAtGoals(c,replayPost(c,board[0]));
export function postWalk(c,state,target){
 if(!Number.isInteger(target)||c.walls.includes(target)||state.boxes.includes(target))return null;const queue=[{cell:state.player,moves:''}],seen=new Set([state.player]);for(const row of queue){if(row.cell===target)return row.moves;for(const d of Object.keys(POST_DIRS)){const n=nextCell(row.cell,d);if(n<0||n>=49||c.walls.includes(n)||state.boxes.includes(n)||seen.has(n))continue;seen.add(n);queue.push({cell:n,moves:row.moves+d});}}return null;
}
export const homeLegacyChallenge=(id,day,state)=>id===14?originChallenge(day,state):id===15?postChallenge(day):null;
export const homeLegacySolved=(c,board)=>c.kind==='origins'?originsSolved(c,board):c.kind==='postroute'?postSolved(c,board):false;
export function evaluateLegacyActivity(input,day,state={}){if(input.homeId===14)return evaluateOrigins(input,day,state);if(input.homeId!==15)return null;const c=postChallenge(day);if(!postSolved(c,input.board))return null;return {homeId:15,kind:'postroute',day,board:[input.board[0]],title:'桌上星邮路线'};}
