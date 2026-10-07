// V40: spatial rules, solvable room requests, and an actual walkable acceptance route.
export const INTERIOR_ROLES={seat:'坐具',shelf:'收纳架',light:'夜灯',rug:'地毯',mirror:'镜台',table:'会客桌'};
const directions=[[0,-1],[1,0],[0,1],[-1,0]];
export function interiorCells(p,l){return Array.from({length:p.w*p.h},(_,i)=>(p.y+(i/p.w|0))*l.w+p.x+i%p.w);}
function adjacent(i,l){const x=i%l.w,y=i/l.w|0;return directions.map(([dx,dy])=>({x:x+dx,y:y+dy})).filter(p=>p.x>=0&&p.x<l.w&&p.y>=0&&p.y<l.h).map(p=>p.y*l.w+p.x);}
export function interiorPath(l,start,end,blocked=[]){
 const walls=new Set(blocked);if(walls.has(start)||walls.has(end))return [];
 const parents=new Map([[start,null]]),queue=[start];
 for(let j=0;j<queue.length;j++){const i=queue[j];if(i===end){const out=[];for(let n=end;n!==null;n=parents.get(n))out.push(n);return out.reverse();}
  for(const n of adjacent(i,l))if(!walls.has(n)&&!parents.has(n)){parents.set(n,i);queue.push(n);}
 }return [];
}
function reachable(l,blocked){const walls=new Set(blocked),seen=new Set();if(walls.has(l.door))return seen;const q=[l.door];seen.add(l.door);for(let j=0;j<q.length;j++)for(const n of adjacent(q[j],l))if(!walls.has(n)&&!seen.has(n)){seen.add(n);q.push(n);}return seen;}
function distance(a,b){if(!a||!b)return Infinity;const dx=Math.max(a.x-b.x-b.w+1,b.x-a.x-a.w+1,0),dy=Math.max(a.y-b.y-b.h+1,b.y-a.y-a.h+1,0);return dx+dy;}
function overlaps(a,b){return a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;}
function edges(p,l){return [...new Set(interiorCells(p,l).flatMap(i=>adjacent(i,l)))].filter(i=>!interiorCells(p,l).includes(i));}
function blockers(l,placed){return [...(l.walls||[]),...placed.filter(p=>!p.floor).flatMap(p=>interiorCells(p,l))];}
export function checkInteriorPlacement(s,item,x,y,rotation=0){
 const l=s.level;if(!item||![x,y,rotation].every(Number.isInteger)||rotation<0||rotation>3)return {ok:false,text:'选择家具并在室内安放'};
 const pose={...item,x,y,w:rotation%2?item.h:item.w,h:rotation%2?item.w:item.h,rotation,at:s.t||0};
 if(x<0||y<0||x+pose.w>l.w||y+pose.h>l.h)return {ok:false,text:'家具必须完整放在室内'};
 const cells=interiorCells(pose,l);
 if(cells.includes(l.door)||cells.includes(l.window)||cells.some(i=>l.walls?.includes(i)))return {ok:false,text:'门、窗和壁柱前需要留空'};
 if(s.furniture.some(p=>p.id!==item.id&&p.floor===pose.floor&&overlaps(p,pose)))return {ok:false,text:pose.floor?'地毯不能彼此重叠':'家具占地重叠，换个位置'};
 return {ok:true,pose};
}
function validLayout(s){
 const l=s.level,ids=new Set();
 for(const p of s.furniture){const item=l.items.find(i=>i.id===p.id);if(!item||ids.has(p.id))return false;ids.add(p.id);
  const check=checkInteriorPlacement({...s,furniture:s.furniture.filter(v=>v!==p)},item,p.x,p.y,p.rotation||0);
  if(!check.ok||check.pose.w!==p.w||check.pose.h!==p.h||!!p.floor!==!!item.floor)return false;
 }return true;
}
export function reviewInterior(s){
 const l=s.level,placed=s.furniture,valid=validLayout(s),blocked=blockers(l,placed),route=interiorPath(l,l.door,l.window,blocked),network=reachable(l,blocked);
 const seat=placed.find(p=>p.role==='seat'),shelf=placed.find(p=>p.role==='shelf'),light=placed.find(p=>p.role==='light'),rug=placed.find(p=>p.role==='rug'),mirror=placed.find(p=>p.role==='mirror'),table=placed.find(p=>p.role==='table');
 const win={x:l.window%l.w,y:l.window/l.w|0,w:1,h:1},limits=l.limits||{window:2,shelf:2,light:2,detour:Infinity};
 const furnished=placed.length===l.items.length,maxRoute=Number.isFinite(limits.detour)?l.baseRouteLength+limits.detour:Infinity,access=route.length>0&&route.length-1<=maxRoute;
 const accessible=placed.filter(p=>!p.floor).every(p=>edges(p,l).some(i=>network.has(i)));
 const window=!!seat&&distance(seat,win)<=limits.window,nearby=distance(seat,shelf)<=limits.shelf,lit=distance(seat,light)<=limits.light;
 const cozy=!!rug&&!!seat&&overlaps(rug,seat),edge=!l.items.some(i=>i.role==='mirror')||!!mirror&&(mirror.x===0||mirror.x+mirror.w===l.w||mirror.y+mirror.h===l.h);
 const hospitality=!l.items.some(i=>i.role==='table')||distance(seat,table)<=3;
 const checks=[
  {id:'furnished',text:'家具齐备',ok:furnished,weight:20},
  {id:'access',text:'门到窗畅通'+(Number.isFinite(limits.detour)?'，绕路不超过 '+limits.detour+' 格':''),ok:access,weight:20},
  {id:'accessible',text:'每件家具至少一侧可以走到',ok:accessible,weight:15},
  {id:'window',text:'坐具距窗不超过 '+limits.window+' 格',ok:window,weight:15},
  {id:'nearby',text:'收纳架距坐具不超过 '+limits.shelf+' 格',ok:nearby,weight:10},
  {id:'lit',text:'夜灯距坐具不超过 '+limits.light+' 格',ok:lit,weight:10},
  {id:'cozy',text:'地毯铺到坐具下方',ok:cozy,weight:5},
  {id:'extras',text:table?'镜台临边，会客桌距坐具不超过 3 格':mirror?'镜台靠房间边缘':'舒适与采光协调',ok:edge&&hospitality,weight:5}
 ];
 const score=valid?checks.reduce((n,c)=>n+(c.ok?c.weight:0),0):0,complete=valid&&checks.every(c=>c.ok);
 const quality=complete?100-Math.min(12,Math.max(0,route.length-1-l.baseRouteLength)*3):0;
 return {score,quality,valid,furnished,access,accessible,nearby,window,lit,cozy,edge,hospitality,complete,route,blocked,checks,unmet:valid?checks.filter(c=>!c.ok).map(c=>c.text):['布局存在重叠、越界或非法家具']};
}
function shuffle(a,r){const out=[...a];for(let i=out.length-1;i>0;i--){const j=r()*(i+1)|0;[out[i],out[j]]=[out[j],out[i]]}return out;}
function solveInterior(l,r){
 const corridor=interiorPath(l,l.door,l.window,l.walls),saved=new Set(corridor),placed=[];
 for(const item of l.items){
  const candidates=[];
  for(const rotation of [0,1])for(let y=0;y<l.h;y++)for(let x=0;x<l.w;x++){
   const s={level:l,furniture:placed,t:0},v=checkInteriorPlacement(s,item,x,y,rotation);if(!v.ok)continue;const p=v.pose;
   if(!p.floor&&interiorCells(p,l).some(i=>saved.has(i)))continue;
   const seat=placed.find(p=>p.role==='seat'),win={x:l.window%l.w,y:0,w:1,h:1};
   if(item.role==='seat'&&distance(p,win)>l.limits.window||item.role==='shelf'&&distance(p,seat)>l.limits.shelf||item.role==='light'&&distance(p,seat)>l.limits.light||item.role==='rug'&&!overlaps(p,seat)||item.role==='mirror'&&!(x===0||x+p.w===l.w||y+p.h===l.h)||item.role==='table'&&distance(p,seat)>3)continue;
   const trial=[...placed,p],blocked=blockers(l,trial),network=reachable(l,blocked);
   if(trial.filter(p=>!p.floor).some(p=>!edges(p,l).some(i=>network.has(i))))continue;
   candidates.push(p);
  }
  if(!candidates.length)return null;placed.push(candidates[r()*candidates.length|0]);
 }
 return reviewInterior({level:l,furniture:placed}).complete?placed:null;
}
export function makeInteriorLevel(r,d){
 const w=d===3?8:7,h=d===1?5:6,theme=r()*3|0,request=r()*3|0;
 const l={schemaVersion:40,w,h,theme,themeName:['海风阅读角','花园会客室','星夜休憩角'][theme],
  requestName:['窗边慢生活','夜读与收纳','来客与休憩'][request],
  quote:['想在窗边坐一会儿，也能顺手取用东西。','夜灯要照到坐具，收纳架别隔得太远。','来客要走得顺畅，镜台与桌子也要方便使用。'][request],
  items:[{id:'c19_9',w:2,h:1,role:'seat',floor:false},{id:'c19_7',w:1,h:2,role:'shelf',floor:false},{id:'c19_8',w:1,h:1,role:'light',floor:false},{id:'c19_5',w:2,h:2,role:'rug',floor:true},{id:'c19_10',w:1,h:1,role:'mirror',floor:false},{id:'c19_11',w:2,h:1,role:'table',floor:false}].slice(0,3+d),
  door:(h-1)*w+1+(r()*(w-2)|0),window:1+(r()*(w-2)|0),requiredScore:100,time:[300,360,420][d-1],
  limits:{window:d===3?1:2,shelf:d===3?1:2,light:request===1||d===3?1:2,detour:d===1?null:d===2?5:2},walls:[],layoutName:['通透小屋','双柱小屋','四柱小屋'][d-1]};
 for(let layoutAttempt=0;layoutAttempt<32;layoutAttempt++){
  l.walls=[];const positions=shuffle(Array.from({length:w*h},(_,i)=>i).filter(i=>i%w>1&&i%w<w-2&&(i/w|0)>0&&(i/w|0)<h-2),r);
  for(const i of positions){if(l.walls.length>=2*(d-1))break;const walls=[...l.walls,i];if(interiorPath(l,l.door,l.window,walls).length)l.walls=walls;}
  l.baseRouteLength=interiorPath(l,l.door,l.window,l.walls).length-1;
  for(let attempt=0;attempt<40;attempt++){const poses=solveInterior(l,r);if(poses){l.solution=poses.map(p=>({x:p.x,y:p.y,rotation:p.rotation}));return l;}}
  l.window=1+(r()*(w-2)|0);l.door=(h-1)*w+1+(r()*(w-2)|0);
 }
 throw new Error('Interior request has no verified layout');
}

function rememberInterior(s){s.furnitureHistory??=[];s.furnitureHistory.push({furniture:s.furniture.map(p=>({...p})),selected:s.selected,rotation:s.rotation});s.furnitureHistory=s.furnitureHistory.slice(-60);}
function changedInterior(s){s.lastReview=null;s.walkthrough=null;s.interiorRevision=(s.interiorRevision||0)+1;}
export function placeInteriorFurniture(s,index){
 const l=s.level,item=l.items[s.selected];if(!item)return {ok:false,text:'先选择家具'};
 if(s.furniture.some(p=>p.id===item.id))return {ok:false,text:'这件家具已安放，点它的「移位」可以重新布置'};
 if(!Number.isInteger(index)||index<0||index>=l.w*l.h)return {ok:false,text:'在房间地板上安放'};
 const result=checkInteriorPlacement(s,item,index%l.w,index/l.w|0,s.rotation);if(!result.ok)return result;
 rememberInterior(s);s.furniture.push(result.pose);s.selected=l.items.findIndex(i=>!s.furniture.some(p=>p.id===i.id));if(s.selected<0)s.selected=0;s.rotation=0;s.moves++;changedInterior(s);return result;
}
export function pickupInteriorFurniture(s,value){
 const item=s.level.items[value],p=item&&s.furniture.find(p=>p.id===item.id);if(!p)return false;
 rememberInterior(s);s.furniture=s.furniture.filter(f=>f.id!==p.id);s.selected=value;s.rotation=p.rotation||0;s.moves++;changedInterior(s);s.status='已提起'+INTERIOR_ROLES[p.role]+'，选择新位置';return true;
}
export function undoInteriorFurniture(s){
 const prev=s.furnitureHistory?.pop();if(!prev)return false;s.furniture=prev.furniture.map(p=>({...p}));s.selected=prev.selected;s.rotation=prev.rotation;s.moves++;changedInterior(s);s.status='上一步布置已撤回';return true;
}

export function makeInteriorWalkthrough(s){
 const l=s.level,r=reviewInterior(s);if(!r.complete)return null;
 const targets=s.furniture.filter(p=>!p.floor),route=[l.door],stops=[],names={seat:'坐具旁可达',shelf:'收纳动线可达',light:'照明位置可达',mirror:'镜台可达',table:'会客桌可达'};
 for(const p of targets){const paths=edges(p,l).map(i=>interiorPath(l,route.at(-1),i,r.blocked)).filter(p=>p.length).sort((a,b)=>a.length-b.length),path=paths[0];if(!path)return null;
  route.push(...path.slice(1));stops.push({index:route.length-1,label:names[p.role]});
 }
 for(const [to,label] of [[l.window,'窗前通道畅通'],[l.door,'全屋动线验收完成']]){const path=interiorPath(l,route.at(-1),to,r.blocked);if(!path.length)return null;route.push(...path.slice(1));stops.push({index:route.length-1,label});}
 return {route,stops,step:0,progress:0,dwell:0,stopIndex:0,elapsed:0,done:false,review:r};
}
export function advanceInteriorWalkthrough(s,dt){
 const v=s.walkthrough;if(!v||v.done)return false;v.elapsed+=dt;
 if(v.stopIndex<v.stops.length&&v.stops[v.stopIndex].index===v.step){v.dwell+=dt;s.status=v.stops[v.stopIndex].label;if(v.dwell<.6)return false;v.stopIndex++;v.dwell=0;return false;}
 if(v.step>=v.route.length-1){v.done=true;return true;}
 v.progress+=dt/.3;if(v.progress>=1){v.progress-=1;v.step++;}return false;
}
export function interiorWalker(s){
 const v=s.walkthrough;if(!v)return null;const l=s.level,a=v.route[v.step],b=v.route[Math.min(v.step+1,v.route.length-1)],stopped=v.done||v.stopIndex<v.stops.length&&v.stops[v.stopIndex].index===v.step,u=stopped?0:Math.min(1,v.progress);
 return {x:a%l.w+(b%l.w-a%l.w)*u,y:(a/l.w|0)+((b/l.w|0)-(a/l.w|0))*u,heading:b-a===1?2:b-a===-1?6:b>a?4:0,walking:!stopped,done:v.done};
}
