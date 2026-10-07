import {createHash}from'node:crypto';
import {hydrateProjects,syncProjects}from'../src/projectPlans.js';
import {hydrateTaskBoard,restoreTasks,nextTask,beginTaskStep,taskOwner}from'../src/taskBoard.js';
import {planAssignedTask}from'../src/craftPlanning.js';
import {ITEM_BY_ID,RECIPE_BY_ID}from'../src/contentCatalog.js';import{CROPS}from'../src/farming.js';
const fail=(text,code='planning_assignment')=>Object.assign(Error(text),{status:409,code});
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
const mirror=()=>({version:1,enabled:true});
function fingerprint(s){const reservations=Object.fromEntries(Object.entries(s.resourceLedger?.reservations||{}).filter(([key])=>key.startsWith('project:')||key.startsWith('task:')));return createHash('sha256').update(JSON.stringify(canonical({projects:s.workProjects||[],tasks:s.agentTaskLedger||[],taskReceipts:s.taskActionReceipts||{},reservations}))).digest('hex');}
export const validPlanningBook=p=>p===undefined||p?.version===1&&/^[a-f0-9]{64}$/.test(p.fingerprint);
export function assertPlanningState(s,b){if(b?.planning&&(JSON.stringify(canonical(s.planningControl))!==JSON.stringify(canonical(mirror()))||fingerprint(s)!==b.planning.fingerprint))throw fail('筹备、负责人、任务交付与留用物资由服务端确认，请读取已保存进度','planning_state_conflict');}
export function clearPlanningState(s){delete s.planningControl;}
const tickets=b=>[b.active,...Object.values(b.farm?.leases||{}),...Object.values(b.field?.leases||{}),...Object.values(b.resident?.leases||{})].filter(Boolean);
export function taskDecision(s,t,{reserve=true}={}){return planAssignedTask(s,t,{server:reserve});}

export function syncPlanningState(s,b){if(!b?.planning)return;hydrateTaskBoard(s);hydrateProjects(s);s.planningControl=mirror();syncProjects(s,{server:true});for(let npc=0;npc<=16;npc++)nextTask(s,npc,{server:true});for(const t of s.agentTaskLedger)if(!t.projectId&&['queued','running','waiting'].includes(t.status)&&t.command?.recipeId&&!tickets(b).some(lease=>lease.assignmentId===t.id))taskDecision(s,t);b.planning.fingerprint=fingerprint(s);}
export function enablePlanningState(s,b){if(!b.planning){hydrateTaskBoard(s);hydrateProjects(s);restoreTasks(s);for(const t of Object.values(b.resident?.leases||{})){const row=s.resourceLedger?.reservations?.[t.owner];if(t.mode==='craft'&&row&&s.agentTaskLedger.some(a=>a.projectId&&a.id===t.assignmentId&&a.operationId===t.operationId)){t.projectReservation=true;Object.assign(row,{projectTaskId:t.assignmentId,taskOperation:t.operationId,productionItem:t.item});}}b.planning={version:1,fingerprint:'0'.repeat(64)};syncPlanningState(s,b);}return {ticket:null,receipt:null};}
export function beginAssignedStep(s,b,{assignmentId,actorId,kind,intent=null,field=null,itemId=null,crop=null,step=null}){
 if(!b?.planning||!assignmentId)return null;
 const t=s.agentTaskLedger?.find(t=>t.id===assignmentId);
 if(!t?.command||t.npcId!==actorId||t.blocked||!['queued','running','waiting'].includes(t.status))throw fail('任务已暂停、取消或改派');
 if((t.dependsOn||[]).some(id=>s.agentTaskLedger.find(x=>x.id===id)?.status!=='done'))throw fail('任务前置步骤尚未完成');
 if(t.projectId&&!['preparing','ready'].includes(s.workProjects?.find(p=>p.id===t.projectId)?.status))throw fail('筹备计划已暂停或结束');
 if(tickets(b).some(lease=>lease.assignmentId===t.id||lease.actor==='npc'&&lease.actorId===actorId))throw fail('负责人或这一步仍在另一项作业','npc_action_active');
 if(actorId===16&&(!s.recruitment?.active||!b.hire?.contracts?.[s.recruitment.active.id]?.steps.some(x=>x.id===t.id)))throw fail('这一步没有已核对的临时伙伴聘约');
 const d=taskDecision(s,t),expectedKind=d.goal==='farm'?'farm':d.goal==='mine'?'field':'resident';
 if(expectedKind!==kind)throw fail('提交的作业地点与原分工不一致','planning_assignment_mismatch');
 if(kind==='field'&&(field!==d.goal||itemId!==(d.resource||t.targetItem||'ore')))throw fail('矿洞目标与原分工不一致','planning_assignment_mismatch');
 if(kind==='farm'&&(step!=='hoe'&&Object.hasOwn(CROPS,d.resource)&&crop!==d.resource))throw fail('作物与原分工不一致','planning_assignment_mismatch');
 if(kind==='resident'){
  if(intent?.action!=='work'||intent?.goal!==d.goal||(intent?.buildingId??null)!==d.buildingId||(intent?.resource??null)!==(d.resource??null)||(intent?.recipeId??null)!==(d.recipeId??null)||intent?.storyId)throw fail('居民作业与原分工不一致','planning_assignment_mismatch');
 }
 const operationId=beginTaskStep(s,t.id);if(!operationId)throw fail('任务步骤当前不能开始');
 return {task:t,decision:d,operationId};
}
