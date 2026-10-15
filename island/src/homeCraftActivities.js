import {RAW_ROWS} from './catalog-data.js';
const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const shuffle=(rows,random)=>{const a=[...rows];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const dayOK=day=>{if(!Number.isSafeInteger(day)||day<1||day>9999999)throw Error('invalid_home_challenge');};
const names=Object.fromEntries(RAW_ROWS.map(([id,name])=>[id,name]));
export const BOTANICALS=Object.fromEntries([['rose','flower','warm'],['sunflower','flower','warm'],['wheat','flower','warm'],['lavender','flower','cool'],['bluegrass','flower','cool'],['flax','flower','cool'],['mint','leaf','green'],['leaves','leaf','green'],['mulberry','leaf','green'],['herb','leaf','green']].map(([id,kind,tone])=>[id,{id,name:names[id],kind,tone}]));
export function botanicalChallenge(day){
  dayOK(day);const random=rng(day*2017+193),main=shuffle(['rose','sunflower','lavender','bluegrass'],random)[0],tone=BOTANICALS[main].tone==='warm'?'cool':'warm';
  const flowers=shuffle(Object.keys(BOTANICALS).filter(id=>BOTANICALS[id].tone===tone),random),leaves=shuffle(['mint','leaves','mulberry','herb'],random).slice(0,3);
  return {kind:'botanical',day,main,tone,title:tone==='cool'?'晴日来信':'雨后微光',palette:shuffle([main,...flowers,...leaves],random),board:Array(7).fill(null)};
}
export function botanicalRules(challenge,board){
  if(!Array.isArray(board)||board.length!==7)return [false,false,false,false];
  const ring=board.slice(1),complete=ring.every(v=>challenge.palette.includes(v));
  return [board[0]==null?null:board[0]===challenge.main,
    complete?ring.filter(id=>BOTANICALS[id].kind==='flower').length===3&&ring.filter(id=>BOTANICALS[id].kind==='leaf').length===3:null,
    ring.some((id,i)=>id!=null&&ring[(i+1)%6]!=null&&BOTANICALS[id]?.kind===BOTANICALS[ring[(i+1)%6]]?.kind)?false:complete?true:null,
    complete?new Set(ring).size===6&&ring.every(id=>BOTANICALS[id].kind==='leaf'||BOTANICALS[id].tone===challenge.tone):null];
}
export function botanicalSolved(c,board){return Array.isArray(board)&&board.length===7&&board.every(v=>c.palette.includes(v))&&new Set(board).size===7&&botanicalRules(c,board).every(v=>v===true);}
export function solveBotanical(c){const flowers=c.palette.filter(id=>id!==c.main&&BOTANICALS[id].kind==='flower'),leaves=c.palette.filter(id=>BOTANICALS[id].kind==='leaf');return [c.main,...flowers.flatMap((id,i)=>[id,leaves[i]])];}
export function placeBotanical(c,board,id,slot){
  if(!c.palette.includes(id)||!Array.isArray(board)||board.length!==7||!Number.isInteger(slot)||slot<0||slot>6)return null;
  const next=[...board],old=next.indexOf(id),displaced=next[slot];if(old>=0)next[old]=displaced;next[slot]=id;return next;
}

const routeTemplates=[
  [0,1,5,4,8,12,13,9,10,6,7],
  [4,0,1,5,9,8,12,13,14,10,6,2,3,7,11],
  [8,12,13,9,5,4,0,1,2,6,10,14,15]
];
const direction=(a,b)=>b-a===1?1:b-a===-1?3:b-a===4?2:0;
export function ropeConnections(type,rotation){return(type==='straight'?[0,2]:[0,1]).map(d=>(d+rotation)%4);}
function rotationFor(type,connections){return [0,1,2,3].find(r=>ropeConnections(type,r).every(d=>connections.includes(d)));}
export function traceRope(c,board){
  if(!Array.isArray(board)||board.length!==16||board.some(v=>!Number.isInteger(v)||v<0||v>3)||c.fixed.some(i=>board[i]!==c.solution[i]))return {solved:false,path:[],blocked:c.start,reason:'invalid'};
  let cell=c.start,incoming=3;const path=[];
  while(path.length<17){
    if(path.includes(cell))return {solved:false,path,blocked:cell,reason:'loop'};
    const links=ropeConnections(c.pipes[cell],board[cell]);if(!links.includes(incoming))return {solved:false,path,blocked:cell,reason:'gap'};
    path.push(cell);const outgoing=links.find(d=>d!==incoming),x=cell%4,y=Math.floor(cell/4),nx=x+[0,1,0,-1][outgoing],ny=y+[-1,0,1,0][outgoing];
    if(nx<0||nx>3||ny<0||ny>3)return {solved:cell===c.end&&outgoing===1&&path.length>=7,path,blocked:cell,reason:'edge'};
    cell=ny*4+nx;incoming=(outgoing+2)%4;
  }
  return {solved:false,path,blocked:cell,reason:'loop'};
}
export function riggingChallenge(day){
  dayOK(day);const random=rng(day*4021+193);let route=[...routeTemplates[Math.floor(random()*routeTemplates.length)]];
  if(random()<.5)route=route.map(i=>(3-Math.floor(i/4))*4+i%4);
  if(random()<.5)route=route.map(i=>Math.floor(i/4)*4+3-i%4).reverse();
  const pipes=Array.from({length:16},()=>random()<.5?'bend':'straight'),solution=Array.from({length:16},()=>Math.floor(random()*4));
  route.forEach((cell,i)=>{const links=[i?direction(cell,route[i-1]):3,i<route.length-1?direction(cell,route[i+1]):1];pipes[cell]=(links[0]+2)%4===links[1]?'straight':'bend';solution[cell]=rotationFor(pipes[cell],links);});
  const c={kind:'rigging',day,pipes,solution,start:route[0],end:route.at(-1),fixed:[route[0],route.at(-1)],board:[],route};
  for(let attempt=0;attempt<64;attempt++){c.board=solution.map((v,i)=>c.fixed.includes(i)?v:Math.floor(random()*4));if(!traceRope(c,c.board).solved)return c;}
  throw Error('unable_to_scramble_rope');
}
export const homeCraftChallenge=(id,day)=>id===4?botanicalChallenge(day):id===5?riggingChallenge(day):null;
export const homeCraftSolved=(c,board)=>c.kind==='botanical'?botanicalSolved(c,board):c.kind==='rigging'?traceRope(c,board).solved:false;
export function evaluateCraftActivity(input,day){
  const c=homeCraftChallenge(input.homeId,day);if(!c||!homeCraftSolved(c,input.board))return null;
  return {homeId:input.homeId,kind:c.kind,day,board:[...input.board],title:c.kind==='botanical'?'压花拼贴 · '+c.title:'船模绳路手记'};
}
