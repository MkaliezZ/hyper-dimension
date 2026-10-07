import {RAW_IDS_V1,RECIPE_IDS_V1} from './achievementUniverse.js';
const items=new Set([...RAW_IDS_V1,...RECIPE_IDS_V1]);
export function validCooperationRows(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>4000||new Set(rows.map(e=>e?.operationId)).size!==rows.length)return false;
 return rows.every(e=>e&&/^[-\w:.]{1,180}$/.test(e.stepId||'')&&/^[-\w:.]{1,180}$/.test(e.operationId||'')&&/^[a-zA-Z0-9-]{8,80}$/.test(e.contractId||'')&&/^hd-parent-[a-f0-9]{32}$/.test(e.parentRunId||'')&&/^hd-child-[a-f0-9]{32}$/.test(e.childRunId||'')&&items.has(e.item)&&Number.isSafeInteger(e.amount)&&e.amount>0);
}
export const validCooperationSnapshot=rows=>rows===undefined||Array.isArray(rows)&&(rows.length===0||validCooperationRows(rows));
const projectsOf=g=>new Set([...(g?.projectIds||[]),g?.projectId].filter(Boolean));
export function verifiedCooperation(s,g){
 const contracts=[s.recruitment?.active,...(s.recruitment?.history||[])].filter(Boolean),projects=projectsOf(g),seen=new Set(),proof=[];
 for(const e of g?.cooperation||[]){
  if(!validCooperationRows([e])||seen.has(e.operationId))continue;
  const c=contracts.find(c=>c.id===e.contractId),t=s.agentTaskLedger?.find(t=>t.id===e.stepId),a=s.taskActionReceipts?.[e.operationId],row=t?.evidence?.find(r=>r.id===e.operationId&&r.npcId===16&&r.contractId===e.contractId);
  if(!c||c.parentRunId!==e.parentRunId||c.childRunId!==e.childRunId||!projects.has(t?.projectId)||c.projectId!==t.projectId||t.targetItem!==e.item||!row||row.amount!==e.amount||row.delta?.[e.item]!==e.amount||a?.delta?.[e.item]!==e.amount)continue;
  if(s.hireControl||s.planningControl?.enabled){
   const r=s.hireControl?.deliveries?.[e.operationId];
   if(!r||r.projectId!==t.projectId||['stepId','operationId','contractId','parentRunId','childRunId','item','amount'].some(k=>r[k]!==e[k]))continue;
  }
  seen.add(e.operationId);proof.push(structuredClone(e));
 }
 return proof;
}
export function captureCooperation(s,g){
 const projects=projectsOf(g),contracts=[s.recruitment?.active,...(s.recruitment?.history||[])].filter(Boolean),rows=[];
 for(const t of s.agentTaskLedger||[])if(projects.has(t.projectId))for(const e of t.evidence||[]){
  if(e.npcId!==16||!e.contractId||!Number.isSafeInteger(e.amount)||e.amount<=0)continue;
  const c=contracts.find(c=>c.id===e.contractId);
  if(c)rows.push({stepId:t.id,operationId:e.id,contractId:c.id,parentRunId:c.parentRunId,childRunId:c.childRunId,item:t.targetItem,amount:e.amount});
 }
 return verifiedCooperation(s,{...g,cooperation:rows});
}
