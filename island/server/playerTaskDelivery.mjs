import {playerProjectTask} from '../src/projectPlans.js';
import {recordTaskStep} from '../src/taskBoard.js';

const fail=()=>Object.assign(Error('接管的筹备步骤、目标或负责人已变化，请重新打开筹备手账'),{status:409,code:'planning_player_task'});
const key=(v,n)=>typeof v==='string'&&v.length<=n&&/^[-\w:.]+$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
// Bind the accepted action, not whichever same-item plan happens to exist when
// its acknowledgement returns. Legacy unbound tickets keep their old path.
export function bindPlayerTaskDelivery(state,book,input,item){
 if(!book.planning){if(input.taskId!=null)throw fail();return undefined;}
 if(input.taskId!=null&&!key(input.taskId,110))throw fail();
 const task=playerProjectTask(state,item,input.taskId??null);
 if(input.taskId!=null&&task?.id!==input.taskId)throw fail();
 if(!task)return undefined;
 return {taskId:task.id,projectId:task.projectId,item,assignmentVersion:task.assignmentVersion||0,operationId:'player-task:'+input.requestId,requestedTaskId:input.taskId??null};
}
export function validPlayerTaskTicket(ticket){
 const b=ticket?.playerTask;if(b===undefined)return true;
 return !!b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).length===6&&key(b.taskId,110)&&key(b.projectId,60)&&b.item===ticket.item&&Number.isSafeInteger(b.assignmentVersion)&&b.assignmentVersion>=0&&b.operationId==='player-task:'+ticket.requestId&&(b.requestedTaskId===null||b.requestedTaskId===b.taskId);
}
// Real raw materials still enter the owner's inventory if a plan is paused or
// reassigned mid-action. They never become a late delivery to that old task.
export function creditPlayerTaskDelivery(state,ticket,gain){
 const b=ticket.playerTask;if(!b||!validPlayerTaskTicket(ticket))return false;
 const task=state.agentTaskLedger?.find(t=>t.id===b.taskId),project=state.workProjects?.find(p=>p.id===b.projectId),amount=gain[b.item]||0;
 if(!Number.isSafeInteger(amount)||amount<=0||!task||task.projectId!==b.projectId||task.targetItem!==b.item||task.npcId!==-1||(task.assignmentVersion||0)!==b.assignmentVersion||task.blocked||!['queued','running'].includes(task.status)||!['preparing','ready'].includes(project?.status)||(task.dependsOn||[]).some(id=>state.agentTaskLedger.find(t=>t.id===id)?.status!=='done')||task.operationId&&task.operationId!==b.operationId||task.evidence?.some(e=>e.id===b.operationId))return false;
 task.status='running';task.operationId=b.operationId;task.step=(task.step||0)+1;
 return recordTaskStep(state,task.id,{operationId:b.operationId,result:'岛主亲手取得'+ticket.name+' ×'+amount,delta:{[b.item]:amount}}).ok;
}
