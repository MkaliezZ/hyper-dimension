import {availableQuantity} from '../src/resourceLedger.js';
const fail=(message,code='recruitment_autonomy',status=409)=>Object.assign(Error(message),{code,status});
export function autonomyPolicy(db,world){
 if(db.autonomy?.world!==world){for(const g of db.autonomyGrants||[])if(g.phase==='issued')g.phase='revoked';db.autonomy={world,version:1,enabled:false,dailyBudget:8,maxContractsPerDay:1,coinFloor:20,candidateIds:['mai','yan','he','tang'],edits:[]};}
 db.autonomyGrants??=[];return db.autonomy;
}
export function autonomyStats(db,doc,now){
 const world=doc.state.saveSlot,day=doc.state.day,grants=(db.autonomyGrants||[]).filter(g=>g.world===world&&g.day===day);
 const contracts=db.contracts.filter(c=>c.world===world&&c.createdDay===day&&c.source==='primary');
 const committed=contracts.reduce((n,c)=>n+(['failed','interrupted','cancelled'].includes(c.phase)?0:c.phase==='departed'?c.delivery?.fee||0:c.wage),0);
 const pending=grants.filter(g=>g.phase==='issued'&&g.expiresAt>now).length*8;
 return {day,attempts:grants.length,committed,pending,allocated:committed+pending};
}
export function autonomyView(db,doc,now,candidates,context){
 const p=autonomyPolicy(db,doc.state.saveSlot),stats=autonomyStats(db,doc,now);
 const active=!!(db.activeId||db.renewalId||doc.state.recruitment?.active||doc.state.recruitment?.pending),availableCoins=availableQuantity(doc.state,'coins');
 let reason=!p.enabled?'岛主尚未开启自主招聘':active?'临时席位或申请已占用':stats.attempts>=p.maxContractsPerDay?'今日自主招聘次数已用完':stats.allocated+8>p.dailyBudget?'今日自主招聘预算不足':availableCoins-8<p.coinFloor?'保留日常经营底金后不足以预留报酬':'';
 const opportunities=[];
 if(!reason)for(const project of doc.state.workProjects||[]){if(project.status!=='preparing')continue;for(const c of candidates){if(!p.candidateIds.includes(c.id))continue;try{const x=context(doc,project.id,c);opportunities.push({projectId:project.id,title:project.title,candidateId:c.id,name:c.name,job:c.job,steps:x.steps.map(t=>({id:t.id,item:t.item,quantity:t.quantity,npcId:t.npcId})),wage:8,termDays:2});}catch(e){if(!['recruitment_no_work','recruitment_invalid'].includes(e.code))throw e;}}}
 if(!reason&&!opportunities.length)reason='没有职业匹配的待筹备工作';
 return {policy:p,stats,eligible:!reason,reason,availableCoins,seatLimit:1,opportunities};
}
export function validateAutonomyPolicy(input,candidates){
 if(!input||typeof input.enabled!=='boolean'||!Number.isInteger(input.dailyBudget)||input.dailyBudget<8||input.dailyBudget>32||input.dailyBudget%8||!Number.isInteger(input.maxContractsPerDay)||input.maxContractsPerDay<1||input.maxContractsPerDay>3||!Number.isInteger(input.coinFloor)||input.coinFloor<0||input.coinFloor>1000||!Array.isArray(input.candidateIds)||input.candidateIds.length>7||new Set(input.candidateIds).size!==input.candidateIds.length||input.candidateIds.some(id=>!candidates.some(c=>c.id===id))||input.enabled&&!input.candidateIds.length)throw fail('请填写有效预算、次数、经营底金和候选范围','recruitment_autonomy_policy',400);
 return {enabled:input.enabled,dailyBudget:input.dailyBudget,maxContractsPerDay:input.maxContractsPerDay,coinFloor:input.coinFloor,candidateIds:input.candidateIds};
}
export function assertAutonomyGrant(db,doc,input,context,now){
 const p=autonomyPolicy(db,doc.state.saveSlot),g=db.autonomyGrants.find(g=>g.id===input.requestId);
 if(!g||g.world!==doc.state.saveSlot||g.candidateId!==input.candidateId||g.projectId!==input.projectId||g.phase!=='issued'||g.expiresAt<=now||g.day!==doc.state.day||g.policyVersion!==p.version||!p.enabled||!p.candidateIds.includes(g.candidateId))throw fail('自主招聘决定已失效，请等待下一轮管家巡查','recruitment_autonomy_stale');
 if(doc.state.recruitment?.pending?.id!==g.id||availableQuantity(doc.state,'coins','hire:'+g.id)-8<p.coinFloor)throw fail('自主招聘的报酬预留或经营底金未核对','recruitment_autonomy_funds');
 if(JSON.stringify(g.steps)!==JSON.stringify(context.steps.map(t=>({id:t.id,item:t.item,quantity:t.quantity,npcId:t.npcId}))))throw fail('筹备分工已改变，本次自主招聘不再执行','recruitment_autonomy_stale');
 return g;
}
