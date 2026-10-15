const rng=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const dayOK=day=>{if(!Number.isSafeInteger(day)||day<1||day>9999999)throw Error('invalid_home_challenge');};
export const BAKING_STATIONS=['揉面台','醒发架','小烤炉','冷却架'];
const stages=['揉面','醒发','烘烤','冷却'];
export function bakingChallenge(day){
 dayOK(day);const random=rng(day*6089+195),orders=[{name:'蜂蜜软包',item:'honey'},{name:'麦香餐包',item:'wheat'}];
 const tasks=orders.flatMap((order,k)=>stages.map((stage,station)=>({id:k*4+station,order:k,station,name:stage,duration:station===2?2+Math.floor(random()*2):1+Math.floor(random()*2),previous:station?k*4+station-1:null})));
 const solution=Array(8).fill(null),occupied=BAKING_STATIONS.map(()=>[]);
 for(const task of tasks){let at=task.previous===null?0:solution[task.previous]+tasks[task.previous].duration;while(occupied[task.station].some(([a,b])=>at<b&&at+task.duration>a))at++;solution[task.id]=at;occupied[task.station].push([at,at+task.duration]);}
 const deadline=Math.max(...tasks.map(t=>solution[t.id]+t.duration));
 return {kind:'baking',day,orders,tasks,deadline,slots:deadline,solution,board:Array(8).fill(null)};
}
export function bakingIssues(c,board){
 if(!Array.isArray(board)||board.length!==8)return ['invalid'];
 const issues=[];
 for(const task of c.tasks){const at=board[task.id];if(at===null)continue;
  if(!Number.isInteger(at)||at<0||at+task.duration>c.deadline){issues.push('time:'+task.id);continue;}
  if(task.previous!==null&&(board[task.previous]===null||at<board[task.previous]+c.tasks[task.previous].duration))issues.push('order:'+task.id);
  if(c.tasks.some(other=>other.id<task.id&&other.station===task.station&&board[other.id]!==null&&at<board[other.id]+other.duration&&at+task.duration>board[other.id]))issues.push('overlap:'+task.id);
 }
 return issues;
}
export const bakingSolved=(c,board)=>Array.isArray(board)&&board.length===8&&board.every(Number.isInteger)&&!bakingIssues(c,board).length;

// Framing uses the same normalized 1000x660 home composition in both art styles.
// Subjects and their full silhouettes are calibrated against the original paintings.
const photoSubjects=[
 {id:'light',name:'晴天从窗边开始',subject:[490,108],bounds:[420,52,145,98],width:[300,370],gy:1/3,tip:'窗外风景放在上三分之一，保留完整窗框。'},
 {id:'camera',name:'把观察准备好',subject:[505,176],bounds:[485,157,45,37],width:[190,250],gy:.5,tip:'相机放在竖向三分线上，留下周围的联系表。'},
 {id:'darkroom',name:'三只盘的等待',subject:[770,198],bounds:[690,169,167,52],width:[300,360],gx:.5,gy:2/3,tip:'三只显影盘完整入镜，靠画面下三分之一。'},
 {id:'gallery',name:'让风景被看见',subject:[278,174],bounds:[250,110,64,135],width:[250,320],gy:.5,tip:'把展墙中这张山景放在竖向三分线上，留住完整相框。'}
];
export function photographyChallenge(day){dayOK(day);const random=rng(day*9029+195);return {kind:'photography',day,shots:photoSubjects.map(s=>({...s,gx:s.gx??(random()<.5?1/3:2/3)})),board:Array(4).fill(null)};}
export function clampPhotoFrame(frame){const w=Math.max(160,Math.min(880,Math.round(frame.w||650))),h=w*.75;return {x:Math.max(0,Math.min(1000-w,Math.round(frame.x||0))),y:Math.max(0,Math.min(660-h,Math.round(frame.y||0))),w};}
export function photoFrameValid(shot,frame){
 if(!frame||typeof frame!=='object'||Array.isArray(frame)||Object.keys(frame).length!==3||!['x','y','w'].every(k=>Number.isFinite(frame[k])))return false;
 const {x,y,w}=frame,h=w*.75,[sx,sy]=shot.subject,[bx,by,bw,bh]=shot.bounds;
 return w>=shot.width[0]&&w<=shot.width[1]&&x>=0&&y>=0&&x+w<=1000&&y+h<=660&&bx>=x+3&&by>=y+3&&bx+bw<=x+w-3&&by+bh<=y+h-3&&Math.abs((sx-x)/w-shot.gx)<=.075&&Math.abs((sy-y)/h-shot.gy)<=.075;
}
export function solvePhotoFrame(shot){
 for(let w=Math.round((shot.width[0]+shot.width[1])/2);w<=shot.width[1];w++){
  const f=clampPhotoFrame({x:shot.subject[0]-w*shot.gx,y:shot.subject[1]-w*.75*shot.gy,w});if(photoFrameValid(shot,f))return f;
 }
 throw Error('unframeable_photo_subject');
}
export const photographySolved=(c,board)=>Array.isArray(board)&&board.length===4&&c.shots.every((shot,i)=>photoFrameValid(shot,board[i]));
export function homeEverydayChallenge(id,day){return id===6?bakingChallenge(day):id===7?photographyChallenge(day):null;}
export function homeEverydaySolved(c,board){return c.kind==='baking'?bakingSolved(c,board):c.kind==='photography'?photographySolved(c,board):false;}
export function evaluateEverydayActivity(input,day){
 if(![6,7].includes(input.homeId))return null;
 const c=homeEverydayChallenge(input.homeId,day);if(!homeEverydaySolved(c,input.board))return null;
 return {homeId:input.homeId,kind:c.kind,day,board:structuredClone(input.board),title:c.kind==='baking'?'早餐出炉计划':'光影四帧'};
}
