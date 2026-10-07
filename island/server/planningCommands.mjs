import {enablePlanningState} from './planningAuthority.mjs';
import {createProject,controlProject,assignProjectStep,syncProjects} from '../src/projectPlans.js';
import {queueTask,controlTask} from '../src/taskBoard.js';
import {BUILDINGS,RESIDENTS} from '../src/world.js';
import {ITEM_BY_ID,RECIPE_BY_ID,recipeGate} from '../src/contentCatalog.js';
import {RECIPES} from '../src/townSimulation.js';

export const PLANNING_OPERATIONS=['plan_enable','plan_create','plan_control','plan_assign','task_control','plan_batch'];
const fail=(text,code='planning_invalid')=>Object.assign(Error(text),{status:409,code});
const own=(o,k)=>o&&Object.hasOwn(o,k),object=o=>o&&typeof o==='object'&&!Array.isArray(o);
const goals=new Set(['farm','mine','forest','dock','plaza','workshop','tea','gallery']);
export const planningSignature=i=>PLANNING_OPERATIONS.includes(i.operation)?[i.project??null,i.projectId??null,i.taskId??null,i.control??null,i.assignee??null,i.plans??null,i.commands??null,i.runId??null]:[];
function checked(r){if(!r.ok)throw fail(r.reason||'当前计划不能进行此操作','planning_transition');return r;}
function dispatch(s,input){
 if(!object(input)||Object.keys(input).some(k=>!['id','npcId','goal','intent','quantity','resource','recipeId','buildingId','source','dependsOn','parentId'].includes(k)))return {ok:false,reason:'分工字段无效'};
 const {id,npcId,goal}=input,quantity=input.quantity??1,bid=input.buildingId??({workshop:0,tea:1,gallery:11})[goal]??null,resource=input.resource??null,recipeId=input.recipeId??null;
 if(typeof id!=='string'||!/^[-\w:.]{1,110}$/.test(id)||!Number.isInteger(npcId)||npcId<0||npcId>15||!goals.has(goal)||typeof input.intent!=='string'||!input.intent.trim()||input.intent.length>160||!Number.isInteger(quantity)||quantity<1||quantity>50)return {ok:false,reason:'负责人、数量或目标无效'};
 if(bid!==null&&(!Number.isInteger(bid)||bid<0||bid>24||BUILDINGS[bid].kind!==goal||s.buildings[bid]===undefined))return {ok:false,reason:'建筑与工作目标不匹配'};
 if(resource!==null){
  const item=own(ITEM_BY_ID,resource)?ITEM_BY_ID[resource]:null,expected=item&&(['shore','fishing'].includes(item.source)?'dock':item.source==='greenhouse'?'workshop':item.source);
  if(!item||item.category!=='material'||expected!==goal||item.source==='greenhouse'&&bid!==14)return {ok:false,reason:'采集目标与地点不匹配'};
 }
 if(recipeId!==null){const r=own(RECIPE_BY_ID,recipeId)?RECIPE_BY_ID[recipeId]:null;if(!r||r.building!==bid||!recipeGate(r,s).ready||resource!==null)return {ok:false,reason:'配方未解锁、工作台错误或同时指定采集'};}
 const c={id,npcId,goal,intent:input.intent.trim(),quantity,resource,recipeId,buildingId:bid,source:'hermes'};
 if(input.dependsOn!==undefined){if(!Array.isArray(input.dependsOn)||input.dependsOn.length>20||input.dependsOn.some(x=>typeof x!=='string'))return {ok:false,reason:'前置分工无效'};c.dependsOn=[...new Set(input.dependsOn)];}
 if(input.parentId!==undefined){if(input.parentId!==null&&(typeof input.parentId!=='string'||!s.agentTaskLedger?.some(t=>t.id===input.parentId)))return {ok:false,reason:'上级分工不存在'};c.parentId=input.parentId;}
 const existing=s.agentTaskLedger?.find(t=>t.id===id);
 if(!existing&&(s.agentTaskLedger||[]).some(t=>t.npcId===npcId&&['queued','running','waiting','paused'].includes(t.status)))return {ok:false,reason:'这位伙伴已有未完成分工'};
 const targetItem=recipeId?RECIPE_BY_ID[recipeId].item:resource||({forest:'wood',mine:'ore',farm:'wheat',dock:'fish'})[goal]||RECIPES[bid]?.item||null;
 const name=s.npcProfiles?.[npcId]?.name||RESIDENTS[npcId]?.name||'伙伴',r=queueTask(s,c,{name,targetItem});
 return {id,ok:r.ok,replayed:!!r.replayed,reason:r.reason||null,...r.ok?{task:r.task}:{}};
}
export function applyPlanningManagement(s,i,b){
 if(i.operation==='plan_enable')return enablePlanningState(s,b);
 syncProjects(s,{server:true});
 if(i.operation==='plan_create'){if(!object(i.project))throw fail('筹备清单无效');const r=checked(createProject(s,{id:i.project.id,title:i.project.title,targets:i.project.targets,source:'player'}));return {ok:true,project:r.project,replayed:!!r.replayed,text:r.replayed?'已有同一份筹备清单，继续现有计划。':'筹备清单已保存，缺口已按职业排队。'};}
 if(i.operation==='plan_control'){if(typeof i.projectId!=='string'||!['pause','resume','cancel','finish'].includes(i.control))throw fail('筹备操作无效');return {...checked(controlProject(s,i.projectId,i.control)),text:'筹备状态已保存。'};}
 if(i.operation==='plan_assign'){if(typeof i.taskId!=='string'||!Number.isInteger(i.assignee))throw fail('改派负责人无效');return {...checked(assignProjectStep(s,i.taskId,i.assignee)),text:'负责人已保存，已完成产出保留。'};}
 if(i.operation==='task_control'){if(typeof i.taskId!=='string'||!['pause','resume','cancel'].includes(i.control))throw fail('分工操作无效');const task=s.agentTaskLedger?.find(t=>t.id===i.taskId);if(task?.projectId)throw fail('筹备步骤请在筹备手账中控制整份计划','planning_transition');return {...checked(controlTask(s,i.taskId,i.control)),text:'分工状态已保存。'};}
 if(i.operation==='plan_batch'){
  const plans=i.plans??[],commands=i.commands??[];
  if(!Array.isArray(plans)||plans.length>3||!Array.isArray(commands)||commands.length>4||!plans.length&&!commands.length||i.runId!==undefined&&i.runId!==null&&(typeof i.runId!=='string'||i.runId.length>120))throw fail('管家分工批次无效');
  const planResults=plans.map(plan=>{if(!object(plan))return {ok:false,reason:'筹备清单无效'};const r=createProject(s,{id:plan.id,title:plan.title,targets:plan.targets,source:'hermes',runId:i.runId});return {id:r.project?.id||plan.id||null,title:plan.title,ok:r.ok,replayed:!!r.replayed,reason:r.reason||null};});
  const outcomes=commands.map(c=>dispatch(s,c));syncProjects(s,{server:true});
  return {ok:true,planResults,commands:outcomes,text:'管家提议已逐项核对并保存；排队不表示已交付。'};
 }
 throw fail('不支持的筹备操作');
}
