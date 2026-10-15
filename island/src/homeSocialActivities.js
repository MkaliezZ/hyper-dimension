const randomFor=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function shuffle(list,random){const rows=[...list];for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}return rows;}
function validDay(day){if(!Number.isSafeInteger(day)||day<1||day>9999999)throw Error('invalid_home_challenge');}
export const HOME_SEATS=['靠窗侧','纪念墙侧','花屏风侧','入口侧'];
export const SKY_DIRECTIONS=['北','东北','东','东南','南','西南','西','西北'];
export const SKY_COLORS=[{name:'暖金',color:'#ffdb8b'},{name:'青白',color:'#a8e3f2'}];

// Invitation cards are a tabletop exercise, never fabricated attendance or relationships.
export function gatheringChallenge(day){
  validDay(day);const random=randomFor(day*6151+192),anchor=shuffle([0,3,12],random)[0];
  const guests=[anchor,...shuffle([0,1,3,4,6,7,12,13].filter(id=>id!==anchor),random).slice(0,3)];
  const solution=[anchor,...shuffle(guests.slice(1),random)];
  const next=day%2?1:3;
  const rules=[{kind:'seat',guest:anchor,seat:0},{kind:'beside',guest:solution[next],other:anchor,step:next===1?1:-1},{kind:'opposite',guest:solution[2],other:anchor}];
  return {kind:'gathering',day,guests:shuffle(guests,random),rules,board:[null,null,null,null]};
}
export function gatheringRule(rule,board){
  const a=board.indexOf(rule.guest),b=board.indexOf(rule.other);
  if(a<0||rule.kind!=='seat'&&b<0)return null;
  return rule.kind==='seat'?a===rule.seat:rule.kind==='opposite'?(a-b+4)%4===2:(a-b+4)%4===(rule.step+4)%4;
}
export function gatheringSolved(challenge,board){
  return Array.isArray(board)&&board.length===4&&new Set(board).size===4&&board.every(id=>challenge.guests.includes(id))&&challenge.rules.every(rule=>gatheringRule(rule,board)===true);
}
export function solveGathering(challenge){
  const visit=rows=>{if(rows.length===4)return gatheringSolved(challenge,rows)?rows:null;for(const id of challenge.guests)if(!rows.includes(id)){const found=visit([...rows,id]);if(found)return found;}return null;};return visit([]);
}
export function seatGuest(challenge,board,guest,seat){
  if(!challenge.guests.includes(guest)||!Number.isInteger(seat)||seat<0||seat>3||!Array.isArray(board)||board.length!==4)return null;
  const next=[...board],old=next.indexOf(guest),displaced=next[seat];if(old>=0)next[old]=displaced;next[seat]=guest;return next;
}

// A fictional sky exercise: an observation log identifies stars by bearing, colour and brightness.
export function starChartChallenge(day){
  validDay(day);const random=randomFor(day*9283+192),stars=[];
  for(let sector=0;sector<8;sector++)for(let band=0;band<2;band++){
    const angle=(sector*45-90+(band===0?-8:8))*Math.PI/180,radius=band?88:122,color=Math.floor(random()*2),bright=band===0;
    stars.push({id:stars.length,sector,color,bright,x:150+Math.cos(angle)*radius,y:150+Math.sin(angle)*radius});
  }
  const targets=shuffle(stars,random).slice(0,6).map((star,i)=>({starId:star.id,time:'21:'+String(5+i*9).padStart(2,'0'),sector:star.sector,color:star.color,bright:star.bright}));
  return {kind:'starchart',day,stars,targets,board:[]};
}
export function starChartSolved(challenge,board){return Array.isArray(board)&&board.length===challenge.targets.length&&board.every((id,i)=>id===challenge.targets[i].starId);}
export function homeSocialChallenge(homeId,day){return homeId===2?gatheringChallenge(day):homeId===3?starChartChallenge(day):null;}
export const homeSocialSolved=(challenge,board)=>challenge.kind==='gathering'?gatheringSolved(challenge,board):challenge.kind==='starchart'?starChartSolved(challenge,board):false;
export function evaluateSocialActivity(input,day){
  const challenge=homeSocialChallenge(input.homeId,day);if(!challenge||!homeSocialSolved(challenge,input.board))return null;
  return {homeId:input.homeId,kind:challenge.kind,day,board:[...input.board],title:challenge.kind==='gathering'?'小聚座位手记':'星迹观测手记'};
}
