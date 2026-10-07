import {queueTask} from '../src/taskBoard.js';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=text=>Object.assign(Error(text),{status:409,code:'cross_task_conflict'});
// These records are created by the social service, never by autosave or a model reply.
export function assertCrossTasks(next,old){
 if(!same(next.crossIslandTasks,old?.crossIslandTasks))throw fail('跨岛合作证明由服务器保存，请先核对进度');
 for(const [id,row] of Object.entries(old?.crossIslandTasks||{})){
  const task=next.agentTaskLedger?.find(t=>t.id===id);
  if(!task||!same(task.command,row.command)||task.npcId!==row.command.npcId||task.targetItem!==row.item||task.quantity!==1)throw fail('跨岛合作分工不能通过存档改写');
 }
}
export function queueCrossTask(state,plan){
 state.crossIslandTasks??={};
 const old=state.crossIslandTasks[plan.command.id];
 if(old){if(!same(old.command,plan.command)||old.item!==plan.item)throw fail('合作内容已变化');return false;}
 if(Object.keys(state.crossIslandTasks).length>=64){for(const id of plan.retiredIds||[]){if(id!==plan.command.id)delete state.crossIslandTasks[id];if(Object.keys(state.crossIslandTasks).length<48)break;}const completed=Object.entries(state.crossIslandTasks).filter(([,r])=>r.proof).sort((a,b)=>a[1].proof.at-b[1].proof.at);for(const [id]of completed){delete state.crossIslandTasks[id];if(Object.keys(state.crossIslandTasks).length<48)break;}}
 if(Object.keys(state.crossIslandTasks).length>=64)throw fail('尚未完成的合作过多，请先完成或搁置已有任务');
 const result=queueTask(state,plan.command,{name:plan.name,targetItem:plan.item});
 if(!result.ok||result.replayed)throw fail('合作分工与已有任务冲突');
 state.crossIslandTasks[plan.command.id]={eventId:plan.eventId,command:structuredClone(plan.command),item:plan.item,proof:null};
 return true;
}
export function recordCrossTaskReceipt(state,receipt){
 const t=receipt?.ticket,row=t?.assignmentId&&state.crossIslandTasks?.[t.assignmentId];
 if(!row||row.proof||receipt.outcome!=='finished'||t.actorId!==row.command.npcId||t.kind!=='resident'||t.mode!=='craft'||t.intent.recipeId!==row.command.recipeId||(receipt.gain?.[row.item]||0)<1)return;
 row.proof={requestId:t.requestId,operationId:t.operationId,epoch:t.epoch,sequence:t.sequence,item:row.item,quantity:1,at:receipt.at,day:receipt.day};
}
