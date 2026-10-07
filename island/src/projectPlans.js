import {availableQuantity,reserveResources,releaseResources,nextOperationId} from './resourceLedger.js';
import {ITEM_BY_ID,RECIPE_BY_ID,recipeGate} from './contentCatalog.js';
import {BUILDINGS} from './world.js';
import {hydrateTaskBoard,queueTask} from './taskBoard.js';
const LIVE=new Set(['preparing','ready','paused']);
const recruitCanTake=(s,t)=>{const a=s.recruitment?.active;return a&&['awaiting_ferry','inbound','landing','working'].includes(a.phase)&&!a.leaveRequested&&a.projectId===t.projectId&&a.steps.some(step=>step.id===t.id)};
const workerByBuilding=[1,9,6,4,13,3,14,10,5,2,9,10,12,7,4,1,8,6,14,15,2,12,5,5,13];
export const projectOwner=id=>'project:'+id;
export function hydrateProjects(s){s.workProjects??=[];return s.workProjects}
const note=(p,s,text)=>{p.history.push({day:s.day,text});p.history=p.history.slice(-60)};
const signature=(title,targets)=>JSON.stringify([title,Object.entries(targets).sort(([a],[b])=>a.localeCompare(b))]);
export function projectSteps(s,id){return (s.agentTaskLedger||[]).filter(t=>t.projectId===id)}
function commandFor(item){
 const r=RECIPE_BY_ID[item.recipeId],source=item.id==='seed'?'greenhouse':item.source;
 return r?{goal:BUILDINGS[r.building].kind,buildingId:r.building,recipeId:r.id,npcId:workerByBuilding[r.building]}:
 {goal:source==='greenhouse'?BUILDINGS[14].kind:['shore','fishing'].includes(source)?'dock':source,buildingId:source==='greenhouse'?14:null,resource:item.id,npcId:({farm:0,mine:11,forest:5,shore:8,fishing:8,greenhouse:4})[source]};
}
export function preparationNeeds(s,p){
 const owner=projectOwner(p.id),shadow={},held={},nodes=new Map();let total=0;
 function need(id,quantity,path=[]){
  if(path.includes(id)||path.length>8)throw Error('配方依赖循环');
  const item=ITEM_BY_ID[id];if(!item)throw Error('未知物品');
  shadow[id]??=availableQuantity(s,id,owner);
  const used=Math.min(shadow[id],quantity);shadow[id]-=used;if(used)held[id]=(held[id]||0)+used;
  const missing=quantity-used;if(!missing)return null;
  total+=missing;if(total>2000)throw Error('计划规模过大，请拆成两份筹备');
  let n=nodes.get(id);if(!n){n={item:id,remaining:0,depends:new Set(),command:commandFor(item),blocked:''};nodes.set(id,n)}
  n.remaining+=missing;
  const r=RECIPE_BY_ID[item.recipeId];
  if(r){
   if(!recipeGate(r,s).ready)n.blocked=recipeGate(r,s).text;
   const running=(s.agentTaskLedger||[]).find(t=>t.projectId===p.id&&t.targetItem===id&&t.status==='running');
   const inFlight=running&&Object.entries(s.resourceLedger?.reservations||{}).some(([key,row])=>(key.startsWith('server-craft:')&&running.npcId===-1||key.startsWith('server-resident:')&&row.productionItem===id)&&row.projectTaskId===running.id&&row.taskOperation===running.operationId)?1:0;
   for(const [ingredient,q] of Object.entries(r.cost)){const count=q*Math.max(0,missing-inFlight);if(!count)continue;const dependency=need(ingredient,count,[...path,id]);if(dependency)n.depends.add(dependency)}
  }else if(item.source==='farm'&&id!=='seed'&&!nodes.has('seed')&&!(held.seed>0)){
   const dependency=need('seed',1,[...path,id]);if(dependency)n.depends.add(dependency);
  }else if(item.source==='farm'&&id!=='seed'&&nodes.has('seed'))n.depends.add('seed');
  return id;
 }
 // Allocate explicit targets before their ingredients so they cannot be double-counted.
 const missingTargets=[];
 for(const [id,q] of Object.entries(p.targets)){const have=availableQuantity(s,id,owner),take=Math.min(q,have);shadow[id]=have-take;if(take)held[id]=take;if(q>take)missingTargets.push([id,q-take])}
 for(const [id,q] of missingTargets){const spare=shadow[id];shadow[id]=0;need(id,q);shadow[id]=spare}
 return {held,nodes:[...nodes.values()].map(n=>({...n,depends:[...n.depends]})),ready:missingTargets.length===0};
}
export function createProject(s,{id,title,targets,source='player',runId=null}={}, {targetLimit=8}={}){
 title=String(title||'岛屿筹备').trim().slice(0,50);
 if(!targets||Array.isArray(targets)||typeof targets!=='object'||Object.keys(targets).length<1||Object.keys(targets).length>targetLimit||![8,16].includes(targetLimit)||Object.entries(targets).some(([k,n])=>!Object.hasOwn(ITEM_BY_ID,k)||!Number.isInteger(n)||n<1||n>50))return {ok:false,reason:'请选择 1–'+targetLimit+' 种物品，每种 1–50 份'};
 targets=Object.fromEntries(Object.entries(targets).sort(([a],[b])=>a.localeCompare(b)));
 const rows=hydrateProjects(s),existing=id&&rows.find(p=>p.id===id),sig=signature(title,targets);
 if(existing)return existing.signature===sig?{ok:true,replayed:true,project:existing}:{ok:false,reason:'计划编号已被其他内容使用'};
 const same=rows.find(p=>LIVE.has(p.status)&&p.signature===sig);if(same)return {ok:true,replayed:true,project:same};
 if(id&&!/^[\w-]{1,60}$/.test(id))return {ok:false,reason:'计划编号无效'};
 if(rows.filter(p=>LIVE.has(p.status)).length>=3)return {ok:false,reason:'最多同时筹备三份计划，请先完成或取消已有计划'};
 const p={id:id||nextOperationId(s,'plan').replace(':','-'),title,targets,signature:sig,source,runId:typeof runId==='string'?runId.slice(0,120):null,status:'preparing',createdDay:s.day,history:[],revision:1};
 let needs;try{needs=preparationNeeds(s,p)}catch(e){return {ok:false,reason:e.message}}
 if(needs.nodes.some(n=>n.blocked))return {ok:false,reason:'先解锁计划涉及的图纸：'+needs.nodes.find(n=>n.blocked).blocked};
 rows.push(p);note(p,s,'建立筹备计划；现有物资计入，缺口按职业分工');syncProjects(s);return {ok:true,project:p};
}
export function syncProjects(s,{server=false}={}){
 if(s.planningControl?.enabled&&!server)return hydrateProjects(s);
 const rows=hydrateProjects(s);hydrateTaskBoard(s);
 for(const p of rows){
  if(!LIVE.has(p.status))continue;
  const need=preparationNeeds(s,p),owner=projectOwner(p.id),before=p.status;
  reserveResources(s,owner,need.held,{purpose:p.title});
  p.held=need.held;
  if(p.status!=='paused')p.status=need.ready?'ready':'preparing';
  if(before!==p.status){p.revision++;note(p,s,p.status==='ready'?'全部目标物资已经备齐，等待领取入库':'库存变化，继续准备缺口')}
  const required=new Map(need.nodes.map(n=>[n.item,n]));
  for(const n of need.nodes){
   const taskId=p.id+':'+n.item;let t=s.agentTaskLedger.find(t=>t.id===taskId);
   if(!t){
    const c={...n.command,id:taskId,quantity:n.remaining,intent:p.title+' · '+ITEM_BY_ID[n.item].name};
    const outcome=queueTask(s,c,{targetItem:n.item,projectId:p.id,resourceOwner:owner});if(!outcome.ok)throw Error('无法建立筹备步骤：'+outcome.reason);t=outcome.task;
   }
   t.remaining=n.remaining;t.quantity=(t.completed||0)+n.remaining;t.blocked=n.blocked;
   t.dependsOn=n.depends.map(id=>p.id+':'+id);t.initialDependsOn??=[...t.dependsOn];
   const waiting=!!t.blocked||n.depends.length>0;
   if(p.status==='paused')t.status='paused';
   else if(waiting&&!s.farmControl?.leases?.some(x=>x.assignmentId===t.id&&x.operationId===t.operationId)&&!s.mineControl?.leases?.some(x=>x.assignmentId===t.id&&x.operationId===t.operationId)&&!s.residentControl?.leases?.some(x=>x.assignmentId===t.id&&x.operationId===t.operationId)&&!Object.entries(s.resourceLedger?.reservations||{}).some(([key,row])=>key.startsWith('server-craft:')&&row.projectTaskId===t.id&&row.taskOperation===t.operationId&&t.npcId===-1&&t.status==='running'))t.status='waiting';
   else if(!['queued','running'].includes(t.status))t.status='queued';
   t.result=t.blocked|| (waiting?'等候前置物资':t.npcId===-1?'由岛主接管，完成实际采集或制作后自动计入':t.result||'等待负责人到场');
  }
  for(const t of projectSteps(s,p.id))if(!required.has(t.targetItem)){
   if(t.status!=='done'){t.status='done';t.result='共享库存已满足当前步骤，无需继续采集或制作';delete t.operationId}
   t.remaining=0;t.dependsOn=[];
  }
 }
 return rows;
}
export function controlProject(s,id,action){
 const p=hydrateProjects(s).find(p=>p.id===id);if(!p||!LIVE.has(p.status))return {ok:false,reason:'计划已经结束'};
 syncProjects(s);
 if(action==='finish'&&p.status==='ready'){p.status='completed';p.completedDay=s.day;releaseResources(s,projectOwner(id));note(p,s,'筹备完成；物资已解除预留，可用于活动或其他用途')}
 else if(action==='cancel'){p.status='cancelled';releaseResources(s,projectOwner(id));note(p,s,'计划取消；已取得物资保留，剩余预留已释放')}
 else if(action==='pause'&&p.status!=='paused'){p.status='paused';note(p,s,'计划暂停，保留已备物资')}
 else if(action==='resume'&&p.status==='paused'){p.status='preparing';note(p,s,'继续准备剩余物资')}
 else return {ok:false,reason:'当前状态不能执行此操作'};
 p.revision++;
 for(const t of projectSteps(s,id)){if(action==='cancel'){t.status=t.status==='done'?'done':'cancelled';delete t.operationId}else if(action==='pause'&&t.remaining>0){t.status='paused';delete t.operationId}}
 syncProjects(s);return {ok:true,project:p};
}
export function assignProjectStep(s,id,npcId){
 const t=hydrateTaskBoard(s).find(t=>t.id===id),p=hydrateProjects(s).find(p=>p.id===t?.projectId);
 if(!p||!LIVE.has(p.status)||!Number.isInteger(npcId)||npcId< -1||npcId>16||npcId===16&&!recruitCanTake(s,t))return {ok:false,reason:'无法改派该步骤'};
 const from=t.npcId;t.npcId=npcId;t.assignmentVersion=(t.assignmentVersion||0)+1;delete t.operationId;
 if(t.status==='running')t.status='queued';
 t.history.push({day:s.day,status:'reassigned',text:npcId===-1?'岛主接管':'改派给居民 '+npcId,from,to:npcId});
 note(p,s,ITEM_BY_ID[t.targetItem].name+'：'+(npcId===-1?'岛主接管':'改派负责人'));p.revision++;syncProjects(s);
 return {ok:true,task:t,previousNpcId:from};
}
export function playerProjectTask(s,item,taskId=null){
 syncProjects(s);return (s.agentTaskLedger||[]).find(t=>t.projectId&&(!taskId||t.id===taskId)&&t.targetItem===item&&t.npcId===-1&&t.remaining>0&&t.status==='queued'&&!t.blocked&&t.dependsOn.every(id=>s.agentTaskLedger.find(x=>x.id===id)?.status==='done'))||null;
}
export function validProjects(s){
 if(s.workProjects===undefined)return true;if(!Array.isArray(s.workProjects)||!Array.isArray(s.agentTaskLedger))return false;
 const ids=new Set();
 for(const p of s.workProjects){
  if(!p||typeof p.id!=='string'||!/^[\w-]{1,60}$/.test(p.id)||ids.has(p.id)||!['preparing','ready','paused','completed','cancelled'].includes(p.status)||!p.targets||Array.isArray(p.targets)||!Array.isArray(p.history)||Object.entries(p.targets).some(([id,n])=>!Object.hasOwn(ITEM_BY_ID,id)||!Number.isInteger(n)||n<1||n>50))return false;
  ids.add(p.id);
 }
 return s.agentTaskLedger.every(t=>!t.projectId||ids.has(t.projectId)&&Number.isInteger(t.npcId)&&t.npcId>=-1&&(t.npcId<=15||t.npcId===16&&s.recruitment?.active?.steps?.some(step=>step.id===t.id))&&t.resourceOwner===projectOwner(t.projectId));
}
