import {seededRandom} from './gameLevels.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const FISHING_SKILLS=[{id:8,skill:.86,title:'熟悉潮汐'}, {id:2,skill:.68,title:'稳稳收线'}];
export function createFishingMatch(seed,difficulty='normal'){
 const random=seededRandom(seed),rounds=Array.from({length:6},(_,i)=>{
  const grade=[1,1,2,2,3,3][Math.floor(random()*6)];
  return {grade,name:['','银鳞小鱼','琥珀鳍鱼','星纹海鲈'][grade],spot:{x:420+random()*310,y:235+random()*105,phase:random()*6.28},
   wind:(random()-.5)*(difficulty==='easy'?20:42),wait:2.6+random()*2.4,
   rivals:FISHING_SKILLS.map(n=>({id:n.id,caught:random()<n.skill,perfect:random()<(n.id===8?.4:.24),at:9+random()*10}))};
 });
 return {version:1,seed:seed>>>0,difficulty,phase:'ready',index:0,elapsed:0,rounds,results:[],standing:[{id:-1,score:0,streak:0,combo:false},...FISHING_SKILLS.map(n=>({id:n.id,score:0,streak:0,combo:false}))],current:null};
}
export function startFishingRound(m){
 if(!['ready','round_result'].includes(m.phase)||m.index>=6)return false;
 m.phase='playing';m.current={mode:'aim',t:0,modeT:0,holding:false,pointer:{x:570,y:285},castTarget:null,castGood:false,perfect:false,tension:.28,progress:0,slack:0,fightAge:0,surge:false,fish:{...m.rounds[m.index].spot},message:'瞄准鱼影，点击水面抛竿。'};
 return true;
}
export function fishingAction(m,{type,x,y}){
 const c=m.current;if(!c||m.phase!=='playing')return false;const level=m.rounds[m.index];
 if(type==='point'){if(Number.isFinite(x)&&Number.isFinite(y))c.pointer={x:clamp(x,0,960),y:clamp(y,0,540)};return true}
 if(type==='up'){c.holding=false;return true}
 if(type!=='down')return false;
 if(Number.isFinite(x)&&Number.isFinite(y))c.pointer={x:clamp(x,0,960),y:clamp(y,0,540)};
 if(c.mode==='aim'){
  c.castTarget={x:c.pointer.x+level.wind,y:c.pointer.y};c.castGood=Math.hypot(c.castTarget.x-level.spot.x,c.castTarget.y-level.spot.y)<(m.difficulty==='easy'?100:78);
  c.mode='casting';c.modeT=0;c.message='抛竿入水…';return true;
 }
 if(c.mode==='waiting'){endCast(m,false,'提竿太早，鱼还在试探。');return true}
 if(c.mode==='bite'){
  const window=m.difficulty==='easy'?2:1.2;c.perfect=Math.abs(c.modeT-window/2)<(m.difficulty==='easy'?.36:.2);c.mode='fight';c.modeT=0;c.holding=false;c.message=c.perfect?'精准提竿！观察鱼的挣扎，再按住收线。':'钩住了！平静时收线，挣扎时松开。';return true;
 }
 if(c.mode==='fight'){c.holding=true;return true}
 return false;
}
function scoreCatch(row,caught,grade,perfect){
 let points=0,combo=false;
 if(caught){points=grade+(perfect?1:0);row.streak++;if(row.streak>=3&&!row.combo){row.combo=true;combo=true;points+=2}}
 else row.streak=0;row.score+=points;return {points,combo};
}
function endCast(m,caught,reason){
 const c=m.current;if(['landed','lost'].includes(c.mode))return;
 c.mode=caught?'landed':'lost';c.modeT=0;c.holding=false;c.message=reason;
 const level=m.rounds[m.index],player=scoreCatch(m.standing[0],caught,level.grade,c.perfect);
 const rivals=level.rivals.map(r=>({...r,...scoreCatch(m.standing.find(n=>n.id===r.id),r.caught,level.grade,r.perfect)}));
 m.results.push({round:m.index+1,grade:level.grade,name:level.name,caught,perfect:caught&&c.perfect,reason,...player,rivals});
}
export function tickFishing(m,seconds){
 if(m.phase!=='playing'||!Number.isFinite(seconds)||seconds<=0)return;
 // Stable integration and no hidden wall-clock/offline progression.
 let left=Math.min(seconds,.25);
 while(left>1e-8&&m.phase==='playing'){
  const dt=Math.min(left,1/60);left-=dt;const c=m.current,l=m.rounds[m.index];c.t+=dt;c.modeT+=dt;m.elapsed+=dt;
  if(['landed','lost'].includes(c.mode)){if(c.modeT>=1.65){m.index++;m.phase=m.index===6?'results':'round_result'}continue}
  if(c.t>=25){endCast(m,false,'本轮时间到了，留待下一次潮汐。');continue}
  if(c.mode==='casting'&&c.modeT>=.8){if(!c.castGood)endCast(m,false,'落点偏离鱼影，下一竿记得补偿风向。');else{c.mode='waiting';c.modeT=0;c.message='看浮漂：轻晃是在试探，亮起金环再提竿。'}}
  else if(c.mode==='waiting'&&c.modeT>=l.wait){c.mode='bite';c.modeT=0;c.message='咬钩！现在提竿！'}
  else if(c.mode==='bite'&&c.modeT>(m.difficulty==='easy'?2:1.2))endCast(m,false,'错过咬钩窗口，鱼松口了。');
  else if(c.mode==='fight'){
   c.fightAge+=dt;const a=c.fightAge,counter=m.difficulty==='easy'?.8:1;
   c.surge=Math.sin(a*(1.25+l.grade*.08)+l.spot.phase)>.48;
   c.fish={x:l.spot.x+Math.sin(a*1.13+l.spot.phase)*(65+l.grade*12),y:l.spot.y+Math.cos(a*.86)*23};
   const tracking=Math.abs(c.pointer.x-c.fish.x)<(m.difficulty==='easy'?210:150);
   if(c.holding){c.progress+=dt*(c.surge?.025:tracking?.2:.1);c.tension+=dt*(c.surge?.44*counter:.055)+(tracking?0:dt*.06);c.slack=0;}
   else{c.tension-=dt*.34;c.progress=Math.max(0,c.progress-dt*.012);if(c.tension<=.015)c.slack+=dt;}
   c.tension=clamp(c.tension,0,1);
   if(c.progress>=1){c.progress=1;endCast(m,true,c.perfect?'精准钓获！':'稳稳钓获！')}
   else if(c.tension>=1)endCast(m,false,'鱼线拉断了，猛烈挣扎时需要松开。');
   else if(c.slack>2.4)endCast(m,false,'鱼线松弛太久，鱼挣脱了。');
  }
 }
}
export function fishingScore(m){
 const rows=m.standing.map(r=>({...r,normalized:Math.round(r.score/26*100)})).sort((a,b)=>b.score-a.score);
 return {raw:m.standing[0].score,normalized:Math.round(m.standing[0].score/26*100),rank:1+rows.filter(r=>r.score>m.standing[0].score).length,rows,won:rows[0].score===m.standing[0].score};
}
export function validFishingMatch(m){
 if(!m||m.version!==1||!Number.isInteger(m.seed)||m.seed<0||m.seed>0xffffffff||!['easy','normal'].includes(m.difficulty)||!['ready','playing','round_result','results'].includes(m.phase)||!Number.isInteger(m.index)||m.index<0||m.index>6||!Number.isFinite(m.elapsed)||m.elapsed<0||m.elapsed>180||!Array.isArray(m.rounds)||!Array.isArray(m.results)||m.results.length>6)return false;
 const expected=createFishingMatch(m.seed,m.difficulty);
 if(JSON.stringify(m.rounds)!==JSON.stringify(expected.rounds))return false;
 const rows=expected.standing;
 for(const [i,r] of m.results.entries()){
  const l=m.rounds[i];if(!r||r.round!==i+1||r.grade!==l.grade||r.name!==l.name||typeof r.caught!=='boolean'||typeof r.perfect!=='boolean'||!r.caught&&r.perfect||typeof r.reason!=='string'||r.reason.length>200)return false;
  const p=scoreCatch(rows[0],r.caught,l.grade,r.perfect);
  if(r.points!==p.points||r.combo!==p.combo)return false;
  const rivals=l.rivals.map(v=>({...v,...scoreCatch(rows.find(row=>row.id===v.id),v.caught,l.grade,v.perfect)}));
  if(JSON.stringify(r.rivals)!==JSON.stringify(rivals))return false;
 }
 if(!Array.isArray(m.standing)||JSON.stringify(m.standing)!==JSON.stringify(rows))return false;
 const c=m.current,settled=c&&['landed','lost'].includes(c.mode);
 if(c){
  if(!['aim','casting','waiting','bite','fight','landed','lost'].includes(c.mode)||['t','modeT','tension','progress','fightAge','slack'].some(k=>!Number.isFinite(c[k])||c[k]<0)||c.t>27||c.tension>1||c.progress>1||['holding','castGood','perfect','surge'].some(k=>typeof c[k]!=='boolean'))return false;
  for(const p of [c.pointer,c.fish,...(c.castTarget?[c.castTarget]:[])])if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
 }
 if(m.phase==='ready')return m.index===0&&m.results.length===0&&c===null&&m.elapsed===0;
 if(!c)return false;
 if(m.phase==='playing')return m.index<6&&m.results.length===m.index+(settled?1:0);
 if(m.phase==='round_result')return m.index>0&&m.index<6&&m.results.length===m.index&&settled;
 return m.index===6&&m.results.length===6&&settled;
}
