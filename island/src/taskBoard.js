import {releaseResources} from './resourceLedger.js';
const ACTIVE=new Set(['queued','running','waiting','paused']);
export const taskOwner=id=>'task:'+id;
export function hydrateTaskBoard(s){s.taskBoardVersion=1;s.agentTaskLedger??=[];s.taskActionReceipts??={};return s.agentTaskLedger}
export function queueTask(s,command,{name='',targetItem=null,projectId=null,resourceOwner=null}={}){
 const rows=hydrateTaskBoard(s),existing=rows.find(t=>t.id===command?.id);
 if(existing)return JSON.stringify(existing.command)===JSON.stringify(command)?{ok:true,replayed:true,task:existing}:{ok:false,reason:'command_conflict'};
 if(!command||typeof command.id!=='string'||!/^[-\w:.]{1,110}$/.test(command.id)||!Number.isInteger(command.npcId)||command.npcId<0||command.npcId>16)return {ok:false,reason:'invalid_task'};
 const quantity=command.quantity??1;if(!Number.isInteger(quantity)||quantity<1||quantity>(projectId?2000:50))return {ok:false,reason:'invalid_quantity'};
 const dependsOn=Array.isArray(command.dependsOn)?[...new Set(command.dependsOn)]:[];
 if(dependsOn.some(id=>!rows.some(t=>t.id===id)))return {ok:false,reason:'unknown_dependency'};
 const task={id:command.id,npcId:command.npcId,name,intent:String(command.intent||'岛屿分工').slice(0,160),command:structuredClone(command),status:'queued',day:s.day,quantity,completed:0,targetItem,projectId,resourceOwner,dependsOn,parentId:command.parentId||null,step:0,history:[],evidence:[]};
 rows.push(task);return {ok:true,replayed:false,task};
}
export function nextTask(s,npcId,{server=false}={}){
 const rows=hydrateTaskBoard(s),mutate=!s.planningControl?.enabled||server;
 for(const task of rows){
  if(task.blocked||task.npcId!==npcId||!task.command||!['queued','running','waiting'].includes(task.status))continue;
  const dependencies=(task.dependsOn||[]).map(id=>rows.find(t=>t.id===id));
  if(dependencies.some(t=>!t||['cancelled','failed','interrupted'].includes(t.status))){if(mutate){task.status='waiting';task.result='前置任务未完成，可以取消或安排接管'}continue}
  if(dependencies.some(t=>t.status!=='done')){if(mutate){task.status='waiting';task.result='等候前置任务'}continue}
  if(mutate&&task.status==='waiting')task.status='queued';return task;
 }
 return null;
}
export function beginTaskStep(s,id){
 const t=hydrateTaskBoard(s).find(t=>t.id===id);if(!t||!ACTIVE.has(t.status)||t.status==='paused')return null;
 t.status='running';t.operationId??='task:'+id+':'+(++t.step);return t.operationId;
}
export function recordTaskStep(s,id,{operationId,result,delta={},preparing=false}={}){
 const t=hydrateTaskBoard(s).find(t=>t.id===id);
 if(!t||!ACTIVE.has(t.status)||t.status==='paused'||t.operationId!==operationId||t.evidence.some(x=>x.id===operationId))return {ok:false};
 const amount=t.targetItem?Math.max(0,delta[t.targetItem]||0):preparing?0:1;
 t.evidence.push({id:operationId,day:s.day,result,delta,amount,npcId:t.npcId,contractId:t.npcId===16?s.recruitment?.active?.id||null:null});t.history.push({day:s.day,status:'running',text:result});t.result=result;
 t.completed=t.projectId?t.completed+amount:Math.min(t.quantity,t.completed+amount);delete t.operationId;
 if(t.completed>=t.quantity){t.status='done';t.completedDay=s.day;if(!t.projectId)releaseResources(s,taskOwner(id))}else t.status='queued';
 return {ok:true,done:t.status==='done',task:t};
}
export function controlTask(s,id,action){
 const t=hydrateTaskBoard(s).find(t=>t.id===id);if(!t||!t.command)return {ok:false,reason:'missing_task'};
 if(action==='cancel'&&ACTIVE.has(t.status)){t.status='cancelled';t.result='已取消，已完成产出保留，剩余预留已释放';releaseResources(s,taskOwner(id))}
 else if(action==='pause'&&['queued','running','waiting'].includes(t.status)){t.status='paused';t.result='已暂停，保留任务进度与物资预留'}
 else if(action==='resume'&&['paused','interrupted','failed'].includes(t.status)){t.status='queued';t.result='继续执行剩余工作'}
 else return {ok:false,reason:'invalid_transition'};
 t.history??=[];t.history.push({day:s.day,status:t.status,text:t.result});return {ok:true,task:t};
}
export function restoreTasks(s){
 for(const t of hydrateTaskBoard(s)){
  if(!t.command){if(['queued','running'].includes(t.status)){t.status='interrupted';t.result='旧版分工未保存完整指令，请重新安排'}continue}
  if(t.status==='running'&&!s.farmControl?.leases?.some(x=>x.assignmentId===t.id&&x.operationId===t.operationId)&&!s.mineControl?.leases?.some(x=>x.assignmentId===t.id&&x.operationId===t.operationId)&&!s.residentControl?.leases?.some(x=>x.assignmentId===t.id&&x.operationId===t.operationId)&&!(t.npcId===-1&&Object.entries(s.resourceLedger?.reservations||{}).some(([key,row])=>key.startsWith('server-craft:')&&row.projectTaskId===t.id&&row.taskOperation===t.operationId))){t.status='queued';t.result='已恢复，继续上次未完成的工作'}
 }
}
