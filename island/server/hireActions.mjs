import {validCooperationRows} from '../src/cooperationEvidence.js';

import {prepareRecruitmentRenewal,releaseRecruitmentRenewal,renewalReadiness,bindRecruitmentRenewal} from '../src/recruitmentRenewal.js';
import {hydrateRecruitment,prepareRecruitment,releaseRecruitmentRequest,hireOwner,handoverRecruitment,bindRecruitment} from '../src/recruitment.js';
import {validateRecruitmentRun} from './recruitmentStore.mjs';
const fail=(message,code='hire_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const deliveries=b=>Object.assign({},...Object.values(b.hire.contracts).map(c=>c.operations||{}));
const mirror=b=>({version:1,paid:Object.fromEntries(Object.entries(b.hire.contracts).map(([id,c])=>[id,c.paid])),...(Object.keys(deliveries(b)).length?{deliveries:deliveries(b)}:{})});
function createEntry(a,legacy=false,s=null){return {id:a.id,world:a.world,projectId:a.projectId,operations:{},wage:a.wage,parentRunId:a.parentRunId,childRunId:a.childRunId,steps:structuredClone(a.steps),delivered:Object.fromEntries(a.steps.map(t=>[t.id,legacy?Math.min(t.quantity,(s.agentTaskLedger?.find(x=>x.id===t.id)?.evidence||[]).filter(e=>e.npcId===16&&e.contractId===a.id).reduce((n,e)=>n+Math.max(0,e.amount||0),0)):0])),paid:a.feePaid??null,legacyBaseline:legacy};}
export function enableHire(s,b){if(!b.hire){b.hire={version:1,contracts:{}};const a=s.recruitment?.active;if(a)b.hire.contracts[a.id]=createEntry(a,true,s);}s.hireControl=mirror(b);}
export function validHireBook(h){return h===undefined||h&&h.version===1&&h.contracts&&typeof h.contracts==='object'&&Object.keys(h.contracts).length<=64&&Object.entries(h.contracts).every(([id,c])=>id===c.id&&Number.isInteger(c.wage)&&c.wage>=0&&c.wage<=8&&Array.isArray(c.steps)&&c.steps.length<=6&&c.delivered&&typeof c.legacyBaseline==='boolean'&&(c.paid===null||Number.isInteger(c.paid)&&c.paid>=0&&c.paid<=c.wage)&&(c.operations===undefined||c.operations&&typeof c.operations==='object'&&!Array.isArray(c.operations)&&Object.keys(c.operations).length<=4000&&Object.entries(c.operations).every(([operationId,r])=>operationId===r.operationId&&r.contractId===id&&r.projectId===c.projectId&&r.parentRunId===c.parentRunId&&r.childRunId===c.childRunId&&c.steps.some(t=>t.id===r.stepId&&t.item===r.item)&&validCooperationRows([r])))&&c.steps.every(t=>typeof t.id==='string'&&Number.isInteger(t.quantity)&&t.quantity>0&&Number.isInteger(c.delivered[t.id])&&c.delivered[t.id]>=0&&c.delivered[t.id]<=t.quantity));}
export function assertHireState(s,b){if(!b?.hire)return;if(!same(s.hireControl,mirror(b)))throw fail('聘约计酬记录由服务端确认','hire_state_conflict');const a=s.recruitment?.active,c=a&&b.hire.contracts[a.id];if(c&&(a.feePaid??null)!==c.paid)throw fail('协作工资结算尚未核对，请读取已确认进度','hire_state_conflict');}
export function clearHireState(s){delete s.hireControl;}
export function recordHireDelivery(s,b,receipt){
 if(!b.hire||receipt?.outcome!=='finished'||receipt.ticket.actorId!==16||!receipt.ticket.assignmentId)return;
 const a=s.recruitment?.active;if(!a||a.feePaid!==null)return;
 const step=a.steps.find(t=>t.id===receipt.ticket.assignmentId),amount=step&&(receipt.gain?.[step.item]||0);if(!step||!Number.isInteger(amount)||amount<=0)return;
 const c=b.hire.contracts[a.id]??=createEntry(a);const known=c.steps.find(t=>t.id===step.id);if(!known||known.item!==step.item||c.paid!==null)throw fail('工作交付与原聘约不一致','hire_contract_changed');
 const operationId=receipt.ticket.operationId,task=s.agentTaskLedger?.find(t=>t.id===known.id),row=task?.evidence?.find(e=>e.id===operationId&&e.npcId===16&&e.contractId===a.id);
 if(!row||row.amount!==amount||row.delta?.[known.item]!==amount||s.taskActionReceipts?.[operationId]?.delta?.[known.item]!==amount||task.projectId!==a.projectId)throw fail('实际交付回执与分工不一致','hire_delivery');
 c.projectId??=a.projectId;c.operations??={};
 const evidence={stepId:known.id,operationId,contractId:c.id,parentRunId:c.parentRunId,childRunId:c.childRunId,item:known.item,amount,projectId:c.projectId};
 const canonical=validCooperationRows([evidence]);
 const prior=c.operations[operationId];if(prior&&!same(prior,evidence))throw fail('交付编号已用于其他物资','hire_delivery');
 if(!prior){if(Object.keys(c.operations).length>=4000)throw fail('本聘约交付记录已满，请交接后续约','hire_delivery');if(canonical)c.operations[operationId]=evidence;c.delivered[known.id]=Math.min(known.quantity,c.delivered[known.id]+amount);}
 for(const id of Object.keys(b.hire.contracts))if(Object.keys(b.hire.contracts).length>64&&id!==a.id&&b.hire.contracts[id].paid!==null)delete b.hire.contracts[id];
 s.hireControl=mirror(b);
}
export function bindHire(s,b,id,verified,theme){if(!b.hire)throw fail('聘约账本尚未启用','hire_not_enabled');if(!verified||verified.id!==id||verified.phase!=='active'||verified.world!==(s.saveSlot||'legacy-'+theme))throw fail('没有属于本岛的有效聘约','hire_contract_changed');validateRecruitmentRun(verified.runs?.at(-1),verified.context);const r=bindRecruitment(s,verified,theme);if(!r.ok)throw fail(r.reason,'hire_contract_changed');b.hire.contracts[id]??=createEntry(r.active);for(const key of Object.keys(b.hire.contracts))if(Object.keys(b.hire.contracts).length>64&&key!==id&&b.hire.contracts[key].paid!==null)delete b.hire.contracts[key];s.hireControl=mirror(b);return {ok:true,active:r.active,replayed:!!r.replayed};}
export function settleHire(s,b,id,verified){
 const a=s.recruitment?.active;if(!a||a.id!==id)throw fail('当前聘约已改变','hire_contract_changed');
 if(!verified||verified.id!==id||!['active','leaving'].includes(verified.phase)||verified.world!==a.world)throw fail('没有服务端确认的有效聘约','hire_contract_changed');validateRecruitmentRun(verified.runs?.at(-1),verified.context);
 const run=verified.runs.at(-1),agreed=verified.agreedSteps||[];if(a.wage!==verified.wage||a.parentRunId!==run.parent.id||a.childRunId!==run.child.id||!same(a.steps,agreed))throw fail('游戏中的聘约与真实主子确认内容不一致','hire_contract_changed');
 if([b.active,...Object.values(b.resident?.leases||{}),...Object.values(b.farm?.leases||{}),...Object.values(b.field?.leases||{})].some(t=>t?.actorId===16))throw fail('伙伴仍有未完成作业，请先收好工具','hire_busy');
 const c=b.hire.contracts[id]??=createEntry(a);if(!same(c.steps,agreed)||c.wage!==verified.wage||c.parentRunId!==run.parent.id||c.childRunId!==run.child.id)throw fail('计酬记录与聘约不一致','hire_contract_changed');
 if(c.paid!==null)throw fail('协作工资已经结算','hire_already_paid');
 const quantity=c.steps.reduce((n,t)=>n+t.quantity,0),delivered=c.steps.reduce((n,t)=>n+c.delivered[t.id],0),fee=quantity?Math.min(c.wage,Math.ceil(c.wage*delivered/quantity)):0;
 const result=handoverRecruitment(s,{progress:{quantity,delivered,fee}});if(!result.ok)throw fail(result.reason,'hire_funds');c.paid=fee;s.hireControl=mirror(b);return {...result,delivered,quantity,legacyBaseline:c.legacyBaseline};
}

export function renewHire(s,b,id,verifiedOld,verifiedNew,theme){
 if(!verifiedNew||verifiedNew.id!==id||verifiedNew.phase!=='available'||verifiedNew.renewalOf!==verifiedOld?.id||verifiedNew.world!==s.saveSlot)throw fail('没有已确认的续约分工','hire_contract_changed');
 validateRecruitmentRun(verifiedNew.runs.at(-1),verifiedNew.context);
 const ready=renewalReadiness(s,verifiedOld,{allowExpired:verifiedNew.createdDay<verifiedOld.expiresDay});if(!ready.ok)throw fail(ready.reason,'hire_renewal');
 if(verifiedOld.profile.version!==verifiedNew.profile.version)throw fail('伙伴档案已变化，请重新商量续约','hire_renewal');
 const pending=s.recruitment.renewal;if(pending?.id!==id||pending.oldId!==verifiedOld.id)throw fail('续约草稿已改变','hire_renewal');
 const held=s.resourceLedger?.reservations?.[hireOwner(id)]?.items?.coins;if(held!==8)throw fail('续约报酬尚未完整预留','hire_funds');
 const agreed=verifiedNew.agreedSteps||[];if(!agreed.length||agreed.some(step=>{const t=s.agentTaskLedger.find(t=>t.id===step.id);return !t||t.remaining!==step.quantity||t.npcId===-1||t.blocked||['done','cancelled','failed'].includes(t.status);}))throw fail('筹备数量或负责人已改变，请重新商量续约','hire_renewal');
 const project=s.workProjects.find(p=>p.id===verifiedNew.projectId);if(!project||!['paused','preparing'].includes(project.status))throw fail('筹备计划已结束','hire_renewal');
 const oldSettlement=settleHire(s,b,verifiedOld.id,verifiedOld),next={...verifiedNew,phase:'active',theme,startedDay:s.day,expiresDay:s.day+verifiedNew.termDays};
 const a=bindRecruitmentRenewal(s,next);b.hire.contracts[id]=createEntry(a);for(const key of Object.keys(b.hire.contracts))if(Object.keys(b.hire.contracts).length>64&&key!==id&&b.hire.contracts[key].paid!==null)delete b.hire.contracts[key];s.hireControl=mirror(b);
 return {oldId:verifiedOld.id,renewalId:id,oldSettlement,startedDay:a.startedDay,expiresDay:a.expiresDay,visitId:a.visitId};
}

export function assertHireReplacement(source,current){
 const a=source.recruitment?.active,now=current?.state?.recruitment?.active;
 if(!a||source.saveSlot!==current?.state?.saveSlot)return;
 const paid=current.actions?.hire?.contracts?.[a.id]?.paid;
 if(paid!==undefined&&paid!==null&&a.feePaid!==paid||now?.priorContractIds?.includes(a.id))throw fail('这份备份属于已结清的旧聘约，请选择续约后的备份；旧记录仍可导出查看','hire_restore_completed');
}

export const HIRE_DRAFT_OPERATIONS=['hire_prepare','hire_release','hire_renew_prepare','hire_renew_release'];
const requestIdOK=id=>typeof id==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(id);
function draftProject(s,id,{renewal=false}={}){const p=s.workProjects?.find(p=>p.id===id);if(!p||!(renewal?['preparing','paused']:['preparing']).includes(p.status)||!s.agentTaskLedger?.some(t=>t.projectId===id&&t.remaining>0&&t.npcId!==-1&&!t.blocked&&!['done','cancelled','failed'].includes(t.status)))throw fail('请先选择仍有待办的筹备清单','hire_no_work');}
export function applyHireDraft(s,b,i){
 if(!b.hire)throw fail('聘约账本尚未启用','hire_not_enabled');
 const r=hydrateRecruitment(s),id=i.operation.startsWith('hire_renew_')?i.renewalId:i.contractId;if(!requestIdOK(id))throw fail('聘约申请编号无效');
 if(i.operation==='hire_prepare'){
  const mode=i.mode||'hire',source=i.source||'user';if(!['hire','retry','recall'].includes(mode)||!['user','primary'].includes(source)||typeof i.candidateId!=='string'||i.candidateId.length>80||mode==='recall'&&!requestIdOK(i.recallId))throw fail('邀请信息无效');
  draftProject(s,i.projectId);const fields={projectId:i.projectId,candidateId:i.candidateId,mode,recallId:i.recallId||null,source};
  if(r.pending?.id===id&&Object.entries(fields).some(([key,value])=>(r.pending[key]??(key==='mode'?'hire':key==='source'?'user':null))!==value))throw fail('同一申请不能修改筹备清单或伙伴','hire_request_changed');
  const result=prepareRecruitment(s,id,i.projectId,i.candidateId);if(!result.ok)throw fail(result.reason,'hire_funds');Object.assign(r.pending,fields);return {ok:true,pending:structuredClone(r.pending),text:'协作报酬已由本机服务预留，正在发送邀请。'};
 }
 if(i.operation==='hire_release'){
  if(r.active?.id===id)throw fail('已到岛的伙伴需要先交接结算','hire_busy');if(r.pending?.id!==id)return {ok:true,replayed:true,text:'这份申请已结束。'};
  releaseRecruitmentRequest(s,id);return {ok:true,text:'本次申请已结束，未交付报酬已释放。'};
 }
 if(i.operation==='hire_renew_prepare'){
  const ready=renewalReadiness(s,i.verifiedContract);if(!ready.ok)throw fail(ready.reason,'hire_renewal');draftProject(s,i.projectId,{renewal:true});
  if(r.renewal?.id===id&&(r.renewal.oldId!==i.contractId||r.renewal.projectId!==i.projectId))throw fail('同一续约不能修改筹备清单','hire_request_changed');
  const result=prepareRecruitmentRenewal(s,{id,oldId:i.contractId,projectId:i.projectId});if(!result.ok)throw fail(result.reason,'hire_funds');return {ok:true,renewal:structuredClone(r.renewal),text:'续约报酬已预留，旧聘约按实际交付另行结算。'};
 }
 if(i.operation==='hire_renew_release'){
  if(r.active?.id===id)throw fail('已开始的续约需要先交接结算','hire_busy');if(r.renewal?.id!==id)return {ok:true,replayed:true,text:'这份续约申请已结束。'};
  if(r.renewal.oldId!==i.contractId)throw fail('续约对应的旧聘约已改变','hire_request_changed');releaseRecruitmentRenewal(s,id);return {ok:true,text:'续约申请已结束，新聘约的未用报酬已释放。'};
 }
 throw fail('邀请操作无效');
}
