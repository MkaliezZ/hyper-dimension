
import {reserveResources,releaseResources} from './resourceLedger.js';
import {RECRUITMENT_RULES} from './recruitmentCatalog.js';
import {bindRecruitment,hireOwner} from './recruitment.js';
import {controlProject,syncProjects} from './projectPlans.js';
const fail=(message,code='recruitment_renewal')=>Object.assign(Error(message),{code,status:409});
export function renewalReadiness(s,contract,{allowExpired=false}={}){
 const a=s.recruitment?.active;
 if(!a||a.id!==contract?.id||contract.phase!=='active'||a.world!==contract.world||a.phase!=='working'||!a.hasArrived||a.feePaid!==null||a.leaveRequested)return {ok:false,reason:'伙伴需要已经到岛，且仍在未结算的聘约中。'};
 if(!allowExpired&&s.day>=contract.expiresDay)return {ok:false,reason:'这份聘约已经到期，请交接离岛后再次邀请。'};
 if((contract.renewalDepth||0)>=RECRUITMENT_RULES.renewalLimit)return {ok:false,reason:'已连续续约三次，伙伴需要回到群岛采风；下次可再次邀请。'};
 if((s.agentTaskLedger||[]).some(t=>t.npcId===16&&['queued','running','waiting'].includes(t.status))||[...(s.residentControl?.leases||[]),...(s.farmControl?.leases||[]),...(s.mineControl?.leases||[])].some(t=>t.actorId===16))return {ok:false,reason:'先暂停伙伴的筹备计划，并等手中的作业收尾，再商量续约。'};
 if(a.position?.inside!=null)return {ok:false,reason:'请先让伙伴收好工具回到室外，再商量续约。'};
 const n=s.npcNeeds?.[16]||{};if((n.energy??78)<45||(n.hunger??76)<45)return {ok:false,reason:'伙伴需要先休息或吃饭，再商量新的聘期。'};
 return {ok:true};
}
export function prepareRecruitmentRenewal(s,{id,oldId,projectId}){
 const a=s.recruitment?.active,r=s.recruitment;
 if(!a||a.id!==oldId||a.phase!=='working'||a.leaveRequested||a.feePaid!==null)return {ok:false,reason:'当前伙伴无法原地续约。'};
 if(r.renewal&&r.renewal.id!==id)return {ok:false,reason:'已有一份续约等待确认。'};
 const hold=reserveResources(s,hireOwner(id),{coins:RECRUITMENT_RULES.wage},{purpose:'伙伴续约报酬，旧聘约单独结算'});
 if(!hold.ok)return {ok:false,reason:'还需要 8 岛币可用报酬，旧聘约的预留继续保留。'};
 r.renewal={id,oldId,projectId};return {ok:true};
}
export function releaseRecruitmentRenewal(s,id){
 const r=s.recruitment;if(r?.renewal?.id!==id)return false;releaseResources(s,hireOwner(id));r.renewal=null;return true;
}
export function bindRecruitmentRenewal(s,contract){
 const r=s.recruitment,old=r.active,pose=structuredClone(old.position),transport=structuredClone(old.transport),visitId=old.visitId||old.id,prior=[...(old.priorContractIds||[]),old.id];
 old.phase='renewed';old.renewedTo=contract.id;old.history.push({day:s.day,text:'旧聘约已结算；原地开始下一段协作，继续留在小岛'});
 if(!r.history.some(h=>h.id===old.id))r.history.push(structuredClone(old));r.history=r.history.slice(-20);r.active=null;
 const result=bindRecruitment(s,contract,contract.theme);if(!result.ok)throw fail(result.reason);
 const a=r.active;Object.assign(a,{phase:'working',hasArrived:true,position:pose,transport,visitId,priorContractIds:prior,renewalDepth:contract.renewalDepth});
 a.history.push({day:s.day,text:'管家和伙伴已重新确认分工，原地续约；报酬按本段实际交付另行结算'});
 r.renewal=null;
 if(s.workProjects.find(p=>p.id===a.projectId)?.status==='paused')controlProject(s,a.projectId,'resume');
 syncProjects(s);return a;
}
