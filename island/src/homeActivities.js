import {evaluateCreativeActivity} from './homeCreativeActivities.js';
import {evaluateResearchActivity} from './homeResearchActivities.js';
import {evaluateEverydayActivity} from './homeEverydayActivities.js';
import {evaluateNatureActivity} from './homeNatureActivities.js';
import {CROPS} from './farming.js';
import {canPlantCrop} from './cropSeasons.js';
import {SEASONS} from './environmentClock.js';
import {evaluateSocialActivity} from './homeSocialActivities.js';
import {evaluateCraftActivity} from './homeCraftActivities.js';

const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function shuffle(rows,random){const out=[...rows];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function validDay(day){return Number.isSafeInteger(day)&&day>0&&day<10000000;}
export function nurseryChallenge(day,season){
  if(!validDay(day)||!SEASONS.includes(season))throw Error('invalid_home_challenge');
  const random=rng(day*7919+SEASONS.indexOf(season)*139+191),symbols=shuffle([0,1,2,3],random);
  const bands=shuffle([0,1],random),rows=bands.flatMap(b=>shuffle([b*2,b*2+1],random));
  const stacks=shuffle([0,1],random),cols=stacks.flatMap(b=>shuffle([b*2,b*2+1],random));
  const solution=rows.flatMap(y=>cols.map(x=>symbols[(y*2+Math.floor(y/2)+x)%4]));
  const clues=new Set(shuffle(Array.from({length:16},(_,i)=>i),random).slice(0,6+day%3));
  const crops=shuffle(Object.keys(CROPS).filter(id=>canPlantCrop(id,season)),random).slice(0,4);
  return {kind:'nursery',day,season,crops,givens:solution.map((v,i)=>clues.has(i)?v:null),solution};
}
export function nurseryErrors(challenge,board){
  if(!Array.isArray(board)||board.length!==16)return Array.from({length:16},(_,i)=>i);
  const errors=new Set();
  board.forEach((v,i)=>{if(v!==null&&(!Number.isInteger(v)||v<0||v>3)||challenge.givens[i]!==null&&v!==challenge.givens[i])errors.add(i);});
  const groups=[];
  for(let i=0;i<4;i++){groups.push([0,1,2,3].map(x=>i*4+x));groups.push([0,1,2,3].map(y=>y*4+i));}
  for(const y of [0,2])for(const x of [0,2])groups.push([y*4+x,y*4+x+1,(y+1)*4+x,(y+1)*4+x+1]);
  for(const group of groups)for(const i of group)if(board[i]!==null&&group.some(j=>i!==j&&board[j]===board[i]))errors.add(i);
  return [...errors];
}
export const nurserySolved=(challenge,board)=>Array.isArray(board)&&board.length===16&&board.every(v=>Number.isInteger(v)&&v>=0&&v<4)&&nurseryErrors(challenge,board).length===0;
export function solveNursery(challenge,board=challenge.givens){
  const next=[...board];if(nurseryErrors(challenge,next).length)return null;
  function visit(){const index=next.indexOf(null);if(index<0)return [...next];for(let v=0;v<4;v++){next[index]=v;if(!nurseryErrors(challenge,next).length){const result=visit();if(result)return result;}}next[index]=null;return null;}
  return visit();
}

export const JOINERY_GOAL=Object.freeze([0,1,2,3,4,5,6,7,8]);
export function slideWood(board,tile){
  const from=board.indexOf(tile),empty=board.indexOf(8);
  if(!Number.isInteger(tile)||tile<0||tile>7||from<0||Math.abs(from%3-empty%3)+Math.abs(Math.floor(from/3)-Math.floor(empty/3))!==1)return null;
  const next=[...board];[next[from],next[empty]]=[next[empty],next[from]];return next;
}
export const joinerySolved=board=>Array.isArray(board)&&board.length===9&&board.every((v,i)=>v===i);
export function joineryChallenge(day){
  if(!validDay(day))throw Error('invalid_home_challenge');
  const random=rng(day*3571+191);let board=[...JOINERY_GOAL],previous=-1;const scramble=[];
  for(let step=0;step<22+day%9;step++){
    const choices=[0,1,2,3,4,5,6,7].filter(tile=>tile!==previous&&slideWood(board,tile));
    const tile=choices[Math.floor(random()*choices.length)];board=slideWood(board,tile);scramble.push(tile);previous=tile;
  }
  if(joinerySolved(board)){const tile=[0,1,2,3,4,5,6,7].find(t=>slideWood(board,t));board=slideWood(board,tile);scramble.push(tile);}
  return {kind:'joinery',day,board,scramble};
}
export function replayJoinery(challenge,moves){
  if(typeof moves!=='string'||moves.length>2000||!/^[0-7]*$/.test(moves))return null;
  let board=[...challenge.board];for(const move of moves){board=slideWood(board,Number(move));if(!board)return null;}return board;
}

// These home hobbies award a journal entry, never currency, materials or production credit.
export function evaluateHomeActivity(input,day){
  if(input.homeId===0){
    if(!SEASONS.includes(input.season))return null;
    const challenge=nurseryChallenge(day,input.season);
    if(!nurserySolved(challenge,input.board))return null;
    return {homeId:0,kind:'nursery',day,season:input.season,crops:challenge.crops,board:[...input.board],title:'育苗排列'};
  }
  if(input.homeId===1){
    const board=replayJoinery(joineryChallenge(day),input.moves);
    if(!joinerySolved(board))return null;
    return {homeId:1,kind:'joinery',day,moves:input.moves.length,title:'木片拼画'};
  }
  return evaluateSocialActivity(input,day)||evaluateCraftActivity(input,day)||evaluateEverydayActivity(input,day)||evaluateNatureActivity(input,day)||evaluateResearchActivity(input,day)||evaluateCreativeActivity(input,day);
}
