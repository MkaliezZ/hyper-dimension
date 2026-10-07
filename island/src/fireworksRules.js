import {seededRandom,shuffle} from './gameLevels.js';
import {validCraftEvent} from './craftGameReplay.js';
export const FIREWORKS_EQUIPMENT=Object.freeze({firework:6,c8_2:1});
export const FIREWORKS_COLORS=Object.freeze([{id:'coral',name:'珊瑚红',color:'#ff9b83'},{id:'jade',name:'海风青',color:'#8be2d5'},{id:'gold',name:'星光金',color:'#ffe6a5'}]);
export const FIREWORKS_SHAPES=Object.freeze([{id:'bloom',name:'绽放'},{id:'star',name:'星芒'},{id:'willow',name:'垂柳'}]);
export const FIREWORKS_LANES=Object.freeze([.20,.50,.80]);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),record=v=>!!v&&typeof v==='object'&&!Array.isArray(v),int=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max,finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
const colors=FIREWORKS_COLORS.map(c=>c.id),shapes=FIREWORKS_SHAPES.map(c=>c.id),emit=(g,type,data={})=>g.effect={id:++g.effectSerial,type,...data};
function level(seed,difficulty,tags){
 const r=seededRandom(seed),rounds=[];const order=tags.includes('nature')?[2,0,1]:tags.includes('sea')?[0,1,2]:tags.includes('music')?[1,2,0]:[0,2,1];
 for(let i=0;i<3;i++){
  const lanes=shuffle([0,1,2],r).slice(0,2),theme=order[i],targets=lanes.map((lane,j)=>({index:j,lane,color:colors[(theme+j+Math.floor(r()*2))%3],shape:shapes[(theme+j+Math.floor(r()*2))%3],x:FIREWORKS_LANES[lane]+(r()-.5)*.04,y:.24+r()*.18,at:4.1+j*3.4+(r()-.5)*.5,flight:1.8+r()*.45}));
  rounds.push({index:i,name:['海风启航','星影对话','花园终曲'][theme],wind:(r()-.5)*(difficulty==='easy'?.035:.065),gust:Math.PI*2*r(),window:difficulty==='easy'?.7:.38,radius:difficulty==='easy'?.085:.058,seconds:12,targets});
 }return{rounds};
}
export function createFireworksGame(seed,difficulty='normal',tags=[]){
 if(!int(seed,0,0xffffffff)||!['easy','normal'].includes(difficulty)||!Array.isArray(tags)||tags.length>2||new Set(tags).size!==tags.length||tags.some(t=>!['sea','nature','cuisine','craft','stars','music'].includes(t)))throw Error('Invalid fireworks setup');
 return{engine:'fireworks-party',version:1,seed,difficulty,tags:[...tags],level:level(seed,difficulty,tags),phase:'checkin',round:0,clock:0,elapsed:0,configs:[null,null],shots:[],reports:[],effectSerial:0,effect:null,status:'等三位协作居民、嘉宾与岛主实际到齐'};
}
export const currentFireworksAct=g=>g.level.rounds[g.round];
export function fireworksWind(g,at=g.clock){const a=currentFireworksAct(g);return a.wind+Math.sin(at*.8+a.gust)*(g.difficulty==='easy'?.008:.016);}
export function fireworksBurst(g,c,at){const t=currentFireworksAct(g).targets[c.index];return{x:c.x+fireworksWind(g,at)*t.flight*.55,y:c.y};}
const configOK=c=>record(c)&&int(c.index,0,1)&&int(c.lane,0,2)&&colors.includes(c.color)&&shapes.includes(c.shape)&&finite(c.x,.08,.92)&&finite(c.y,.16,.56);
function shotGrade(g,c,at){
 const a=currentFireworksAct(g),t=a.targets[c.index],point=fireworksBurst(g,c,at),burstAt=at+t.flight,distance=Math.hypot(point.x-t.x,point.y-t.y),timing=Math.abs(burstAt-t.at);
 const style=(c.color===t.color?15:0)+(c.shape===t.shape?15:0),location=Math.max(0,Math.round(35*(1-distance/(a.radius*2)))),rhythm=Math.max(0,Math.round(35*(1-timing/(a.window*2)))),quality=style+location+rhythm;
 return{round:g.round,index:c.index,config:structuredClone(c),at,burstAt,point,style,location,rhythm,quality,hit:c.lane===t.lane&&style===30&&distance<=a.radius&&timing<=a.window};
}
const actReport=(g,index=g.round)=>{const shots=g.shots.filter(s=>s.round===index);return{index,quality:Math.round(shots.reduce((v,s)=>v+s.quality,0)/2),hits:shots.filter(s=>s.hit).length,fired:shots.length};};
function conclude(g){g.reports.push(actReport(g));g.phase='review';g.clock=0;g.status='把这一幕留在海风里，听听伙伴的喝彩';emit(g,'review',{quality:g.reports.at(-1).quality});}
export function fireworksSummary(g){const quality=Math.round(g.reports.reduce((v,r)=>v+r.quality,0)/3),hits=g.shots.filter(s=>s.hit).length,fired=g.shots.length;return{quality,hits,fired,completed:g.reports.length,passed:g.reports.length===3&&fired===6&&hits>=5&&quality>=75,reward:Math.floor(quality*.78)};}
export function applyFireworksEvent(g,e){
 if(!validCraftEvent(e))throw Error('Invalid fireworks input');if(e.neutral)return g;
 if(Object.hasOwn(e,'dt')){
  if(!['arming','performing','review'].includes(g.phase))return g;g.elapsed+=e.dt;g.clock+=e.dt;
  if(g.phase==='arming'&&g.clock>=60){g.status='本幕没有完成编排，保留未发射的烟花';conclude(g);}
  else if(g.phase==='performing'&&g.clock>=currentFireworksAct(g).seconds)conclude(g);
  else if(g.phase==='review'&&g.clock>=3.2){g.phase=g.round===2?'results':'intermission';g.clock=0;g.status=g.phase==='results'?'三幕收官，核对发射数量与本场成绩':'这一幕结束，编排下一幕';emit(g,g.phase==='results'?'result':'round');}return g;
 }
 const a=e.action;
 if(a.type==='start'){
  if(!['checkin','intermission'].includes(g.phase))throw Error('Act not ready');if(g.phase==='intermission')g.round++;g.configs=[null,null];g.phase='arming';g.clock=0;g.status='先安排两枚烟花的颜色、形状和发射位，再观察风向';emit(g,'start');return g;
 }
 if(a.type==='configure'){
  if(g.phase!=='arming'||!int(a.index,0,1)||typeof a.item!=='string')throw Error('Invalid shell configuration');const [field,value]=a.item.split(':'),c=g.configs[a.index]||{index:a.index,lane:a.index,color:'coral',shape:'bloom',x:currentFireworksAct(g).targets[a.index].x,y:currentFireworksAct(g).targets[a.index].y};
  if(field==='color'&&colors.includes(value))c.color=value;else if(field==='shape'&&shapes.includes(value))c.shape=value;else if(field==='lane'&&int(Number(value),0,2))c.lane=Number(value);else throw Error('Invalid shell choice');
  g.configs[a.index]=c;emit(g,'configure',{index:a.index});return g;
 }
 if(a.type==='aim'){
  if(!['arming','performing'].includes(g.phase)||!int(a.index,0,1)||!g.configs[a.index]||g.shots.some(s=>s.round===g.round&&s.index===a.index)||!finite(a.x,.08,.92)||!finite(a.y,.16,.56))throw Error('Invalid fireworks aim');
  g.configs[a.index].x=a.x;g.configs[a.index].y=a.y;return g;
 }
 if(a.type==='submit'){
  if(g.phase!=='arming'||!g.configs.every(configOK)||g.configs[0].lane===g.configs[1].lane)throw Error('Two distinct launchers required');
  g.phase='performing';g.clock=0;g.status='根据风向修正瞄准，让绽放落在亮拍与星圈中';emit(g,'perform');return g;
 }
 if(a.type==='launch'){
  if(g.phase!=='performing'||!int(a.index,0,1)||!configOK(g.configs[a.index]))throw Error('Shell not ready');
  if(g.shots.some(s=>s.round===g.round&&s.index===a.index))return g;
  if(g.clock>9.5){g.status='本幕发射时段已经结束，这枚烟花保留';emit(g,'late');return g;}
  const c=g.configs[a.index],t=currentFireworksAct(g).targets[a.index];if(c.lane!==t.lane){g.status='发射位与本幕编排不符，请在下一幕检查';}
  const shot=shotGrade(g,c,g.clock);if(c.lane!==t.lane){shot.quality=Math.max(0,shot.quality-20);shot.hit=false;}
  g.shots.push(shot);g.status='第'+(a.index+1)+'枚已发射 · 等待'+t.flight.toFixed(1)+'秒后绽放';emit(g,'launch',{index:a.index});return g;
 }
 throw Error('Unsupported fireworks event');
}
export function validFireworksGame(g){
 try{
  if(!record(g)||g.engine!=='fireworks-party'||g.version!==1||!int(g.round,0,2)||!finite(g.elapsed,0,226)||!finite(g.clock,0,60.051)||!int(g.effectSerial,0,100000)||typeof g.status!=='string'||g.status.length>300||!['checkin','arming','performing','review','intermission','results'].includes(g.phase))return false;
  const expected=createFireworksGame(g.seed,g.difficulty,g.tags);if(!same(g.level,expected.level)||!Array.isArray(g.configs)||g.configs.length!==2||g.configs.some((c,i)=>c!==null&&(!configOK(c)||c.index!==i))||!Array.isArray(g.shots)||g.shots.length>6||!Array.isArray(g.reports)||g.reports.length>3)return false;
  const seen=new Set();for(const s of g.shots){if(!record(s)||!int(s.round,0,g.round)||!int(s.index,0,1)||seen.has(s.round+':'+s.index)||!configOK(s.config)||s.config.index!==s.index||!finite(s.at,0,9.5))return false;seen.add(s.round+':'+s.index);
   const grade=shotGrade({...g,round:s.round},s.config,s.at),target=g.level.rounds[s.round].targets[s.index];if(s.config.lane!==target.lane){grade.quality=Math.max(0,grade.quality-20);grade.hit=false;}if(!same(s,grade))return false;
  }
  if(g.reports.some((r,i)=>!same(r,actReport(g,i))))return false;
  if(g.phase==='checkin')return g.round===0&&g.elapsed===0&&g.clock===0&&g.shots.length===0&&g.reports.length===0&&g.configs.every(c=>c===null);
  if(g.phase==='results')return g.round===2&&g.reports.length===3;
  if(['review','intermission'].includes(g.phase))return g.reports.length===g.round+1&&(g.phase!=='intermission'||g.round<2);
  if(g.reports.length!==g.round)return false;return g.phase!=='performing'||g.configs.every(configOK)&&g.configs[0].lane!==g.configs[1].lane;
 }catch{return false;}
}
