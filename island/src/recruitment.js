import {reserveResources,releaseResources} from './resourceLedger.js';
import {syncProjects,assignProjectStep} from './projectPlans.js';
import {transact} from './economy.js';
import {RECRUITMENT_RULES,RECRUIT_CANDIDATE,RECRUIT_STAGES,recruitmentWorldKey} from './recruitmentCatalog.js';
export const hireOwner=id=>'hire:'+id;
export function hydrateRecruitment(s){s.recruitment??={version:1,pending:null,active:null,history:[],departedId:null};return s.recruitment}
export function prepareRecruitment(s,id,projectId,candidateId='mai'){
 const r=hydrateRecruitment(s);if(r.active||r.pending&&r.pending.id!==id)return {ok:false,reason:'已有招聘或临时伙伴，请先结束当前聘约'};
 const hold=reserveResources(s,hireOwner(id),{coins:RECRUITMENT_RULES.wage},{purpose:'临时伙伴的协作报酬'});
 if(!hold.ok)return {ok:false,reason:'先准备 8 岛币协作报酬。到岛不扣款，实际交付后结算。'};
 r.pending={id,projectId,candidateId};return {ok:true};
}
export function releaseRecruitmentRequest(s,id){const r=hydrateRecruitment(s);if(r.active?.id===id)return;if(r.pending?.id===id)r.pending=null;releaseResources(s,hireOwner(id))}
export function bindRecruitment(s,c,theme='pixel'){
 const r=hydrateRecruitment(s);if(r.active?.id===c.id)return {ok:true,replayed:true,active:r.active};
 if(r.active)return {ok:false,reason:'当前伙伴尚未完成离岛'};
 if(c.phase!=='active'||c.world!==recruitmentWorldKey(s,theme))return {ok:false,reason:'聘约不属于当前小岛或尚未确认'};
 const run=c.runs?.at(-1);if(!run?.child?.acceptedSteps?.length)return {ok:false,reason:'缺少子伙伴实际接受的工作'};
 syncProjects(s);
 const steps=(c.agreedSteps||(c.steps||[]).map(id=>s.agentTaskLedger.find(t=>t.id===id)).filter(Boolean).map(t=>({id:t.id,item:t.targetItem,quantity:t.remaining,originalNpc:t.npcId}))).filter(t=>t.quantity>0);
 const hold=reserveResources(s,hireOwner(c.id),{coins:c.wage},{purpose:(c.profile?.name||'临时伙伴')+'的协作报酬'});if(!hold.ok)return {ok:false,reason:'协作报酬不足，请补足后继续到岛'};
 const active={id:c.id,world:c.world,projectId:c.projectId,title:c.context.project.title,profile:{...RECRUIT_CANDIDATE,...c.profile},phase:'awaiting_ferry',
  source:c.source||'user',autonomousDecision:c.autonomousDecision?structuredClone(c.autonomousDecision):null,steps:structuredClone(steps),wage:c.wage,startedDay:c.startedDay,expiresDay:c.expiresDay,
  parentRunId:run.parent.id,childRunId:run.child.id,usage:{parent:run.parent.usage,child:run.child.usage},position:null,transport:null,
  feePaid:null,leaveRequested:steps.length?null:'筹备物资已由大家提前备齐',history:[]};
 r.active=active;r.pending=null;
 for(const step of steps){const t=s.agentTaskLedger.find(t=>t.id===step.id);if(t?.npcId!==-1&&t?.remaining>0)assignProjectStep(s,step.id,16)}
 active.history.push({day:s.day,text:'聘约确认，等待乘船到岛；报酬暂时预留'});
 return {ok:true,active};
}
export function recruitmentProgress(s){
 const a=hydrateRecruitment(s).active;if(!a)return null;
 const steps=a.steps.map(step=>{
  const t=s.agentTaskLedger?.find(t=>t.id===step.id);
  const delivered=(t?.evidence||[]).filter(e=>e.npcId===16&&e.contractId===a.id).reduce((n,e)=>n+Math.max(0,e.amount||0),0);
  return {...step,delivered:Math.min(step.quantity,delivered),remaining:t?.remaining||0,owner:t?.npcId,status:t?.status||'cancelled'};
 });
 const delivered=steps.reduce((n,t)=>n+t.delivered,0),quantity=steps.reduce((n,t)=>n+t.quantity,0);
 return {steps,delivered,quantity,fee:quantity?Math.min(a.wage,Math.ceil(a.wage*delivered/quantity)):0,
  done:steps.every(t=>t.remaining<=0||t.owner!==16||['cancelled','failed'].includes(t.status))};
}
export function requestRecruitmentLeave(s,reason='约定工作结束，继续群岛采风'){
 const a=hydrateRecruitment(s).active;if(!a||a.phase==='departed')return {ok:false};
 a.leaveRequested??=reason;return {ok:true};
}
export function handoverRecruitment(s,{progress:verifiedProgress=null}={}){
 const a=hydrateRecruitment(s).active;if(!a)return {ok:false};
 if(a.feePaid!==null)return {ok:true,replayed:true};
 const progress=verifiedProgress||recruitmentProgress(s),fee=progress.fee;
 if(fee&&!transact(s,{cost:fee,category:'recruitment',note:a.profile.name+'协作报酬 · 实际交付 '+progress.delivered+'/'+progress.quantity,receipt:'hire-'+a.id,owner:hireOwner(a.id)}))return {ok:false,reason:'报酬结算未成功，请检查存档与预留'};
 a.feePaid=fee;a.delivered=progress.delivered;a.agreedQuantity=progress.quantity;
 releaseResources(s,hireOwner(a.id));
 for(const step of a.steps){const t=s.agentTaskLedger.find(t=>t.id===step.id);if(t?.npcId===16){const next=step.originalNpc>=0&&step.originalNpc<=15?step.originalNpc:15;const result=assignProjectStep(s,t.id,next);if(!result.ok){t.npcId=next;delete t.operationId;if(t.status==='running')t.status='queued';}}}
 a.history.push({day:s.day,text:'已交回未完成工作；实际交付 '+progress.delivered+' 份，结算 '+fee+' 岛币，剩余预留释放'});
 return {ok:true,fee};
}
export function finishRecruitmentDeparture(s){
 const r=hydrateRecruitment(s),a=r.active;if(!a||a.feePaid===null)return false;
 if(a.phase==='departed')return true;a.phase='departed';r.departedId=a.id;a.history.push({day:s.day,text:a.hasArrived?'已从栈桥登船，渡船离港':'本次到岛已取消，未在岛上工作'});return true;
}
export function archiveRecruitment(s,id){
 const r=hydrateRecruitment(s),a=r.active;if(!a||a.id!==id||a.phase!=='departed')return false;
 if(!r.history.some(h=>h.id===id))r.history.push(structuredClone(a));r.history=r.history.slice(-20);r.active=null;r.pending=null;return true;
}
export function validRecruitment(s){
 const r=s.recruitment;if(r===undefined)return true;
 if(!r||r.version!==1||!Array.isArray(r.history)||r.history.length>20)return false;
 if(r.pending&&(!/^[a-zA-Z0-9-]{8,80}$/.test(r.pending.id||'')||typeof r.pending.projectId!=='string'))return false;
 if(r.renewal&&(!/^[a-zA-Z0-9-]{8,80}$/.test(r.renewal.id||'')||!/^[a-zA-Z0-9-]{8,80}$/.test(r.renewal.oldId||'')||typeof r.renewal.projectId!=='string'))return false;
 const a=r.active;if(!a)return true;
 if(!/^[a-zA-Z0-9-]{8,80}$/.test(a.id||'')||(s.saveSlot?a.world!==s.saveSlot:!/^legacy-(pixel|origami)$/.test(a.world))||!RECRUIT_STAGES.includes(a.phase)||!Array.isArray(a.steps)||a.steps.length>6||!Number.isInteger(a.wage)||a.wage<0||a.wage>8)return false;
 if(!Number.isInteger(a.startedDay)||!Number.isInteger(a.expiresDay)||a.expiresDay<a.startedDay||a.feePaid!==null&&(!Number.isInteger(a.feePaid)||a.feePaid<0||a.feePaid>a.wage))return false;
 if(a.steps.some(t=>!t||typeof t.id!=='string'||!Number.isInteger(t.quantity)||t.quantity<=0||t.quantity>2000||!Number.isInteger(t.originalNpc)||t.originalNpc<0||t.originalNpc>15))return false;
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<10000&&Math.abs(p.y)<10000;
 if(a.position&&(!point(a.position)||a.position.inside!=null&&(!Number.isInteger(a.position.inside)||a.position.inside<0||a.position.inside>24)))return false;
 if(a.transport){const t=a.transport,b=t.boat;if(!Array.isArray(t.path)||t.path.length>4000||t.path.some(p=>!point(p))||t.queue!=null&&(!Number.isInteger(t.queue)||t.queue<0||t.queue>=6))return false;
  if(b&&(!point(b)||!['approaching','moored','leaving'].includes(b.phase)||!Number.isFinite(b.t)||b.t<0))return false;
 }
 return !!a.profile&&typeof a.profile.name==='string'&&typeof a.profile.personality==='string'&&Array.isArray(a.history);
}
