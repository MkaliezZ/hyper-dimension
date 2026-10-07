import {autonomyPolicy,autonomyView,validateAutonomyPolicy,assertAutonomyGrant} from './recruitAutonomy.mjs';
import {mkdir,open,readFile,rename,unlink,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {renewalReadiness} from '../src/recruitmentRenewal.js';
import {availableQuantity} from '../src/resourceLedger.js';
import {syncProjects,projectSteps} from '../src/projectPlans.js';
import {RECRUITMENT_RULES,RECRUIT_CANDIDATE,RECRUIT_CANDIDATES,RECRUIT_CANDIDATE_BY_ID,candidateStepAllowed,customRecruitCandidate,recruitmentWorldKey} from '../src/recruitmentCatalog.js';
export {RECRUITMENT_RULES,RECRUIT_CANDIDATE};
const error=(message,code='recruitment_invalid',status=400)=>Object.assign(Error(message),{code,status});
const alive=pid=>{if(!Number.isInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true}catch(e){return e.code==='EPERM'}};
export const recruitmentWorld=doc=>recruitmentWorldKey(doc?.state,doc?.theme);
export function recruitmentContext(doc,projectId,candidate=RECRUIT_CANDIDATE){
 if(!doc?.state)throw error('请先保存小岛进度');
 const s=structuredClone(doc.state);syncProjects(s);
 const project=s.workProjects.find(p=>p.id===projectId);
 if(!project||['ready','completed','cancelled'].includes(project.status))throw error('计划已结束或物资已经备齐','recruitment_no_work');
 if(project.status!=='preparing')throw error('请先恢复筹备计划再招聘伙伴');
 const steps=projectSteps(s,projectId).filter(t=>t.remaining>0&&t.npcId!==-1&&!t.blocked&&candidateStepAllowed(candidate,t)).map(t=>({id:t.id,item:t.targetItem,quantity:t.remaining,npcId:t.npcId,goal:t.command.goal,buildingId:t.command.buildingId??null,recipeId:t.command.recipeId||null,resource:t.command.resource||null,dependsOn:t.dependsOn}));
 if(!steps.length)throw error('当前没有适合这位伙伴的工作；请更换职业或筹备清单，由岛主接管的步骤不会被抢走','recruitment_no_work');
 return {world:recruitmentWorld(doc),day:s.day,project:{id:project.id,title:project.title,targets:project.targets},steps,candidate:structuredClone(candidate),limits:RECRUITMENT_RULES};
}
export function validateRecruitmentRun(run,context){
 const allowed=new Set(context.steps.map(t=>t.id)),parent=run?.parent,child=run?.child;
 if(run?.source!=='hermes'||run.model!=='deepseek-flash'||!parent?.id?.startsWith('hd-parent-')||!child?.id?.startsWith('hd-child-')||parent.id===child.id||child.parentId!==parent.id||parent.status!=='completed'||child.status!=='completed')throw error('未取得真实主子运行的完整结果','recruitment_evidence');
 if(!Array.isArray(child.acceptedSteps)||!child.acceptedSteps.length||child.acceptedSteps.length>6||new Set(child.acceptedSteps).size!==child.acceptedSteps.length||child.acceptedSteps.some(id=>!allowed.has(id)))throw error('伙伴接受了清单以外的步骤','recruitment_evidence');
 if(!parent.tools?.includes('recruitment_delegate')||!child.tools?.includes('recruitment_take_step'))throw error('缺少真实委派工具回执','recruitment_evidence');
 if(!Array.isArray(run.events)||!run.events.some(e=>e.actor==='parent'&&e.tool==='recruitment_delegate'&&e.status==='done')||!run.events.some(e=>e.actor==='child'&&e.tool==='recruitment_take_step'&&e.status==='done'))throw error('缺少主子工具执行事件','recruitment_evidence');
 return run;
}
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createRecruitmentStore({directory,now=Date.now,isAlive=alive}){
 const root=resolve(directory);
 function paths(theme){if(!['pixel','origami'].includes(theme))throw error('未知画风');const dir=join(root,theme);return {dir,file:join(dir,'recruitment.json'),previous:join(dir,'recruitment.previous.json'),lock:join(dir,'recruitment.lock')}}
 async function atomic(path,record){const tmp=path+'.'+randomUUID()+'.tmp',f=await open(tmp,'wx',0o600);try{await f.writeFile(JSON.stringify(record));await f.sync()}finally{await f.close()}try{await rename(tmp,path)}finally{await unlink(tmp).catch(()=>{})}}
 async function locked(theme,fn){
  const p=paths(theme);await mkdir(p.dir,{recursive:true});const token=randomUUID(),start=Date.now();let acquired=false;
  while(!acquired){
   try{const f=await open(p.lock,'wx',0o600);await f.writeFile(JSON.stringify({pid:process.pid,token}));await f.close();acquired=true}
   catch(e){if(e.code!=='EEXIST')throw e;
    try{const owner=JSON.parse(await readFile(p.lock,'utf8'));if(!isAlive(owner.pid)){await unlink(p.lock);continue}}
    catch{try{if(Date.now()-(await stat(p.lock)).mtimeMs>30000){await unlink(p.lock);continue}}catch{}}
    if(Date.now()-start>5000)throw error('招聘名册正在写入，请稍后重试','recruitment_busy',503);await new Promise(r=>setTimeout(r,35));
   }
  }
  try{
   let value=null;
   const decode=raw=>{const e=JSON.parse(raw);if(e.schema!==1||e.theme!==theme||e.checksum!==digest(e.record))throw error('招聘名册校验失败','recruitment_corrupt',503);return e.record};
   try{value=decode(await readFile(p.file,'utf8'))}catch(e){if(e.code!=='ENOENT'){try{value=decode(await readFile(p.previous,'utf8'))}catch{throw error('招聘名册无法恢复，已保留原文件','recruitment_corrupt',503)}}}
   value??={world:null,activeId:null,contracts:[],revision:0};
   const before=JSON.stringify(value),result=await fn(value);
   if(before!==JSON.stringify(value)){value.revision++;const envelope={schema:1,theme,record:value,checksum:digest(value)};
    if(before)await atomic(p.previous,{schema:1,theme,record:JSON.parse(before),checksum:digest(JSON.parse(before))});
    await atomic(p.file,envelope)}
   return structuredClone(result);
  }finally{try{if(JSON.parse(await readFile(p.lock,'utf8')).token===token)await unlink(p.lock)}catch{}}
 }
 const event=(c,kind,text)=>{c.events.push({at:new Date(now()).toISOString(),kind,text})};
 const close=(db,c,phase,reason)=>{c.phase=phase;c.closedAt=new Date(now()).toISOString();event(c,phase,reason);if(db.activeId===c.id)db.activeId=null;if(db.renewalId===c.id)db.renewalId=null};
 function reconcile(db,doc){
  const world=recruitmentWorld(doc);
  for(const c of db.contracts){
   if(c.id!==db.activeId&&c.id!==db.renewalId)continue;
   if(c.world!==world){
    if(['planning','cancelling'].includes(c.phase)&&isAlive(c.ownerPid)){if(c.phase!=='cancelling'){c.phase='cancelling';event(c,'cancelling','小岛存档批次已改变，等待原运行实际停止')}}
    else close(db,c,'cancelled','小岛存档批次已改变，旧聘约结束');
    continue;
   }
   if(['planning','cancelling'].includes(c.phase)&&!isAlive(c.ownerPid))close(db,c,c.phase==='cancelling'?'cancelled':'interrupted','处理招聘的服务进程已结束；可以重试或取消');
  }
  db.world=world;
 }
 function find(db,id){const c=db.contracts.find(c=>c.id===id);if(!c)throw error('找不到这份聘约','recruitment_missing',404);return c}
 function ensureFee(doc,id){if(availableQuantity(doc.state,'coins','hire:'+id)<RECRUITMENT_RULES.wage)throw error('需要预留 8 岛币协作报酬，实际交付后结算；子运行失败不收费','recruitment_funds')}

 function renewalContext(doc,old,projectId){
  const ready=renewalReadiness(doc.state,old);if(!ready.ok)throw error(ready.reason,'recruitment_renewal',409);
  const d=structuredClone(doc),p=d.state.workProjects.find(p=>p.id===projectId);if(p?.status==='paused')p.status='preparing';
  const context=recruitmentContext(d,projectId,old.profile);
  for(const t of context.steps)if(t.npcId===16)t.npcId=old.agreedSteps.find(a=>a.id===t.id)?.originalNpc??15;
  const book=doc.actions?.hire?.contracts?.[old.id],quantity=(old.agreedSteps||[]).reduce((n,t)=>n+t.quantity,0),delivered=book?Object.values(book.delivered).reduce((n,v)=>n+v,0):0;
  context.continuingVisit={contractId:old.id,startedDay:old.startedDay,expiresDay:old.expiresDay,delivered,quantity,renewalDepth:old.renewalDepth||0};
  return context;
 }
 const candidates=(db,doc)=>[...RECRUIT_CANDIDATES,...(db.customCandidates||[]).filter(c=>c.world===recruitmentWorld(doc)&&!c.archived).map(c=>c.profile)];
 return {

  async autonomy_observe(theme,doc){return locked(theme,db=>{reconcile(db,doc);return autonomyView(db,doc,now(),candidates(db,doc),recruitmentContext);});},
  async policy(theme,doc,{requestId,expectedVersion,input}={}){
   if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId||''))throw error('招聘政策编号无效');
   return locked(theme,db=>{reconcile(db,doc);const p=autonomyPolicy(db,recruitmentWorld(doc)),signature=digest({expectedVersion,input}),prior=p.edits.find(e=>e.id===requestId);
    if(prior){if(prior.signature!==signature)throw error('政策编号已用于其他内容','recruitment_conflict',409);return{autonomy:autonomyView(db,doc,now(),candidates(db,doc),recruitmentContext),replayed:true};}
    if(expectedVersion!==p.version)throw error('自主招聘政策已更新，请重新读取','recruitment_conflict',409);
    if(p.edits.length>=100)throw error('政策历史已达容量','recruitment_full',409);
    const patch=validateAutonomyPolicy(input,candidates(db,doc));Object.assign(p,patch);p.version++;p.edits.push({id:requestId,signature,at:new Date(now()).toISOString(),day:doc.state.day,version:p.version,policy:patch});
    for(const g of db.autonomyGrants)if(g.world===p.world&&g.phase==='issued')g.phase='revoked';
    return{autonomy:autonomyView(db,doc,now(),candidates(db,doc),recruitmentContext)};
   });
  },
  async autonomy_decide(theme,doc,result){return locked(theme,db=>{
   reconcile(db,doc);const requests=result?.recruitments||[];
   if(!requests.length)return{offers:[]};
   if(result.source!=='hermes'||result.model!=='deepseek-flash'||!/^hd-island-[a-f0-9]+$/.test(result.runId||'')||!result.ledgerRunId||requests.length!==1)throw error('自主招聘缺少实际管家工具来源','recruitment_autonomy_evidence',409);
   const x=requests[0];if(!/^[a-zA-Z0-9-]{8,80}$/.test(x.id||'')||typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>180)throw error('管家招聘决定无效');
   const old=db.autonomyGrants?.find(g=>g.id===x.id);
   if(old){if(old.world!==recruitmentWorld(doc)||old.projectId!==x.projectId||old.candidateId!==x.candidateId||old.runId!==result.runId||old.ledgerRunId!==result.ledgerRunId||old.reason!==x.reason.trim())throw error('管家决定编号已用于其他内容','recruitment_conflict',409);return{offers:old.phase==='issued'&&old.expiresAt>now()?[old]:[],replayed:true};}
   const view=autonomyView(db,doc,now(),candidates(db,doc),recruitmentContext),option=view.opportunities.find(o=>o.projectId===x.projectId&&o.candidateId===x.candidateId);
   if(!view.eligible||!option)return{offers:[],reason:view.reason||'管家选择的职业与任务不匹配'};
   if(db.autonomyGrants.length>=180)throw error('自主招聘记录已达容量','recruitment_full',409);
   const g={id:x.id,world:recruitmentWorld(doc),day:doc.state.day,projectId:x.projectId,candidateId:x.candidateId,reason:x.reason.trim(),runId:result.runId,ledgerRunId:result.ledgerRunId,policyVersion:view.policy.version,phase:'issued',createdAt:now(),expiresAt:now()+600000,steps:option.steps};
   db.autonomyGrants.push(g);return{offers:[g]};
  })},

  async renew(theme,doc,{id,requestId,projectId}={}){
   if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId||'')||typeof projectId!=='string')throw error('续约请求无效');
   return locked(theme,db=>{
    reconcile(db,doc);const existing=db.contracts.find(c=>c.id===requestId);
    if(existing){if(existing.world!==recruitmentWorld(doc)||existing.renewalOf!==id||existing.projectId!==projectId)throw error('续约编号与原请求不一致','recruitment_conflict',409);return{contract:existing,replayed:true};}
    const old=find(db,id);if(db.activeId!==id||old.world!==recruitmentWorld(doc))throw error('只能为当前小岛伙伴原地续约','recruitment_renewal',409);
    if(db.renewalId)throw error('已有一份续约等待确认','recruitment_full',409);
    if(db.contracts.length>=180)throw error('聘约记录已达容量','recruitment_full',409);
    const pending=doc.state.recruitment?.renewal;if(pending?.id!==requestId||pending.oldId!==id||pending.projectId!==projectId)throw error('请先保存续约报酬与草稿','recruitment_renewal',409);
    ensureFee(doc,requestId);const context=renewalContext(doc,old,projectId);
    const c={id:requestId,world:old.world,candidateId:old.candidateId,projectId,source:'user',renewalOf:id,visitId:old.visitId||old.id,renewalDepth:(old.renewalDepth||0)+1,profile:structuredClone(old.profile),profileEdits:[],phase:'planning',ownerPid:process.pid,createdDay:doc.state.day,createdAt:new Date(now()).toISOString(),wage:8,termDays:2,attempt:1,context,runs:[],events:[]};
    db.contracts.push(c);db.renewalId=c.id;event(c,'reserved','已预留新聘约报酬，伙伴留岛等待重新确认分工');return{contract:c,replayed:false};
   });
  },
  async renewal_commit(theme,doc,id){return locked(theme,db=>{
   reconcile(db,doc);const c=find(db,id);if(c.renewalOf&&['active','leaving','departed','renewed'].includes(c.phase)&&Number.isInteger(c.startedDay))return{contract:c,replayed:true};
   if(!c.renewalOf||c.phase!=='available'||db.renewalId!==id)throw error('续约尚未确认','recruitment_renewal',409);
   const old=find(db,c.renewalOf),a=doc.state.recruitment?.active,run=c.runs.at(-1),receipt=doc.actions?.receipts?.find(r=>r.ticket.command==='hire_renew'&&r.details?.renewalId===id);
   if(a?.id!==id||a.world!==c.world||a.parentRunId!==run.parent.id||a.childRunId!==run.child.id||!receipt||receipt.details.oldId!==old.id)throw error('尚未取得续约原子交接回执','recruitment_renewal',409);
   old.delivery={...receipt.details.oldSettlement,renewedDay:doc.state.day,hasArrived:true,reason:'原地续约'};old.renewedTo=id;close(db,old,'renewed','旧聘约按实际交付结算，伙伴留岛继续协作');
   c.startedDay=a.startedDay;c.expiresDay=a.expiresDay;c.phase='active';db.activeId=id;db.renewalId=null;event(c,'active','已收到原子交接回执，开始新的两日聘期');return{contract:c};
  })},
  async list(theme,doc){return locked(theme,db=>{reconcile(db,doc);return {rules:RECRUITMENT_RULES,candidate:RECRUIT_CANDIDATE,candidates:[...RECRUIT_CANDIDATES,...(db.customCandidates||[]).filter(c=>c.world===recruitmentWorld(doc)&&!c.archived).map(c=>c.profile)],customLimit:3,autonomy:autonomyView(db,doc,now(),candidates(db,doc),recruitmentContext),offers:(db.autonomyGrants||[]).filter(g=>g.world===recruitmentWorld(doc)&&g.phase==='issued'&&g.expiresAt>now()),candidateRecords:(db.customCandidates||[]).filter(c=>c.world===recruitmentWorld(doc)).map(c=>({profile:c.profile,version:c.version||1,archived:!!c.archived,edits:(c.edits||[]).slice(-20)})),active:db.contracts.find(c=>c.id===db.activeId)||null,renewal:db.contracts.find(c=>c.id===db.renewalId)||null,history:db.contracts.filter(c=>c.id!==db.activeId&&c.id!==db.renewalId).slice(-20).reverse()}})},
  async candidate(theme,doc,{requestId,input}={}){if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId||''))throw error('候选档案编号无效');let profile;try{profile=customRecruitCandidate(input,'custom-'+requestId)}catch(e){throw error(e.message)}return locked(theme,db=>{reconcile(db,doc);db.customCandidates??=[];const world=recruitmentWorld(doc),old=db.customCandidates.find(c=>c.id===requestId);if(old){if(old.world!==world||JSON.stringify(old.creationProfile||old.profile)!==JSON.stringify(profile))throw error('候选编号已用于其他档案','recruitment_conflict',409);return{candidate:old.profile,replayed:true};}if(db.customCandidates.filter(c=>c.world===world&&!c.archived).length>=3)throw error('当前小岛最多保存三位自建候选伙伴','recruitment_candidate_limit',409);if(db.customCandidates.length>=90)throw error('候选档案已达容量，请先整理历史','recruitment_candidate_limit',409);db.customCandidates.push({id:requestId,world,profile,creationProfile:structuredClone(profile),version:1,archived:false,edits:[],createdAt:new Date(now()).toISOString()});return{candidate:profile,replayed:false};});},
  async candidate_manage(theme,doc,{id,requestId,expectedVersion,action,input}={}){if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId||'')||!['edit','archive','restore'].includes(action))throw error('候选管理请求无效');return locked(theme,db=>{reconcile(db,doc);const c=(db.customCandidates||[]).find(c=>c.profile.id===id&&c.world===recruitmentWorld(doc));if(!c)throw error('找不到当前小岛的自建候选','recruitment_candidate',404);const signature=digest({id,expectedVersion,action,input:input||null}),old=(c.edits||[]).find(e=>e.id===requestId);if(old){if(old.signature!==signature)throw error('管理编号已用于其他内容','recruitment_conflict',409);return{candidate:c.profile,version:c.version||1,archived:!!c.archived,replayed:true};}if(expectedVersion!==(c.version||1))throw error('候选档案已更新，请重新读取后修改','recruitment_conflict',409);if(db.contracts.some(x=>x.id===db.activeId&&x.candidateId===id))throw error('这位伙伴的聘约仍在进行，请交接离岛后再管理候选档案','recruitment_candidate_busy',409);if((c.edits||[]).length>=100)throw error('此候选的管理记录已达容量，请建立新档案','recruitment_candidate_limit',409);let profile=c.profile;if(action==='edit'){try{profile=customRecruitCandidate(input,id)}catch(e){throw error(e.message)}profile.version=c.profile.version+1;}if(action==='restore'&&c.archived&&(db.customCandidates||[]).filter(x=>x.world===c.world&&!x.archived).length>=3)throw error('待选名额已满，请先归档一位候选','recruitment_candidate_limit',409);c.creationProfile??=structuredClone(c.profile);const before={profile:structuredClone(c.profile),archived:!!c.archived};c.profile=profile;c.archived=action==='archive'?true:action==='restore'?false:!!c.archived;c.version=(c.version||1)+1;(c.edits??=[]).push({id:requestId,signature,action,version:c.version,at:new Date(now()).toISOString(),day:doc.state.day,before,after:{profile:structuredClone(c.profile),archived:c.archived}});return{candidate:c.profile,version:c.version,archived:c.archived,replayed:false};});},
  async start(theme,doc,{requestId,projectId,candidateId='mai',source='user',recallId=null}={}){
   if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId||'')||typeof candidateId!=='string'||!['user','primary'].includes(source)||recallId!==null&&!/^[a-zA-Z0-9-]{8,80}$/.test(recallId))throw error('招聘请求无效');
   return locked(theme,db=>{
    reconcile(db,doc);const existing=db.contracts.find(c=>c.id===requestId);
    if(existing){if(existing.world!==recruitmentWorld(doc)||!existing.cancelBeforeStart&&(existing.projectId!==projectId||existing.source!==source||(existing.candidateId||'mai')!==candidateId||(existing.previousContractId||null)!==recallId))throw error('聘约编号与原请求不一致','recruitment_conflict',409);return {contract:existing,replayed:true}}
    if(db.activeId||db.renewalId)throw error('临时席位已占用，请先结束当前聘约','recruitment_full',409);
    const previous=recallId?find(db,recallId):null;if(previous&&(previous.world!==recruitmentWorld(doc)||previous.phase!=='departed'||!previous.delivery||previous.candidateId!==candidateId))throw error('仅可再次邀请当前小岛已经完成离岛的伙伴','recruitment_recall',409);
    const available=RECRUIT_CANDIDATE_BY_ID[candidateId]||(db.customCandidates||[]).find(c=>c.profile.id===candidateId&&c.world===recruitmentWorld(doc)&&!c.archived)?.profile;if(!available)throw error('候选人不属于当前小岛','recruitment_candidate');
    const candidate=previous?.profile||available,context=recruitmentContext(doc,projectId,candidate);if(previous)context.previousVisit={contractId:previous.id,endedDay:previous.delivery.departedDay,delivered:previous.delivery.delivered,quantity:previous.delivery.quantity,fee:previous.delivery.fee,reason:previous.delivery.reason};ensureFee(doc,requestId);
    const grant=source==='primary'?assertAutonomyGrant(db,doc,{requestId,projectId,candidateId},context,now()):null;
    const c={id:requestId,world:context.world,candidateId,projectId,source,previousContractId:recallId,profile:structuredClone(candidate),profileEdits:[],phase:'planning',ownerPid:process.pid,createdDay:doc.state.day,createdAt:new Date(now()).toISOString(),wage:8,termDays:2,attempt:1,context,runs:[],events:[]};
    if(!grant)for(const g of db.autonomyGrants||[])if(g.world===c.world&&g.phase==='issued')g.phase='superseded';
    if(grant){grant.phase='claimed';c.autonomousDecision={id:grant.id,runId:grant.runId,ledgerRunId:grant.ledgerRunId,reason:grant.reason,policyVersion:grant.policyVersion};c.context.autonomousDecision=structuredClone(c.autonomousDecision);event(c,'autonomous',grant.reason);}
    event(c,'reserved','已登记候选人与任务，临时席位 1/1');db.contracts.push(c);db.activeId=c.id;return {contract:c,replayed:false};
   });
  },
  async retry(theme,doc,id){return locked(theme,db=>{reconcile(db,doc);const c=find(db,id);if(!['failed','interrupted'].includes(c.phase)||c.world!==recruitmentWorld(doc))throw error('当前聘约不能重试');if(db.activeId)throw error('临时席位已占用','recruitment_full',409);ensureFee(doc,id);const priorVisit=c.context?.previousVisit;c.context=recruitmentContext(doc,c.projectId,c.context?.candidate||c.profile||RECRUIT_CANDIDATE);if(priorVisit)c.context.previousVisit=priorVisit;c.phase='planning';c.ownerPid=process.pid;c.attempt++;delete c.closedAt;db.activeId=id;event(c,'retry','重新启动真实主子协作');return {contract:c}})},
  async complete(theme,id,attempt,run,failure=null){return locked(theme,db=>{
   const c=find(db,id);if(c.attempt!==attempt||!['planning','cancelling'].includes(c.phase))return {contract:c,ignored:true};
   if(c.phase==='cancelling'){close(db,c,'cancelled','子运行已终止，临时席位释放');return {contract:c}}
   if(failure){c.runs.push({attempt,status:'failed',error:String(failure).slice(0,180)});close(db,c,'failed','主子运行未完成，可重试；未收取游戏聘金');return {contract:c}}
   validateRecruitmentRun(run,c.context);if(c.renewalOf)c.agreedSteps=c.context.steps.filter(t=>run.child.acceptedSteps.includes(t.id)).map(t=>({id:t.id,item:t.item,quantity:t.quantity,originalNpc:t.npcId}));c.runs.push({attempt,...run});c.phase='available';event(c,'accepted','伙伴通过真实子运行接受了筹备工作，等待确认到岛');return {contract:c};
  })},
  async cancel(theme,doc,id){if(!/^[a-zA-Z0-9-]{8,80}$/.test(id||''))throw error('聘约编号无效');return locked(theme,db=>{reconcile(db,doc);let c=db.contracts.find(c=>c.id===id);
   if(!c){c={id,world:recruitmentWorld(doc),phase:'cancelled',cancelBeforeStart:true,source:'user',candidateId:'mai',attempt:0,createdDay:doc.state.day,events:[],runs:[]};db.contracts.push(c);close(db,c,'cancelled','到岛请求在启动前取消');return {contract:c}}
   if(c.world!==recruitmentWorld(doc))return {contract:c};
   if(c.id===db.activeId&&db.renewalId)throw error('先取消待确认的续约，再结束原聘约','recruitment_renewal',409);
   if(c.phase==='planning'){c.phase='cancelling';event(c,'cancelling','正在停止主子运行，结束后释放席位')}
   else if(c.phase==='active'){c.phase='leaving';event(c,'leaving','聘约结束，交回未完成任务并准备离岛')}
   else if(c.phase==='available')close(db,c,'cancelled','取消到岛，临时席位释放');
   return {contract:c};
  })},
  async activate(theme,doc,id){return locked(theme,db=>{reconcile(db,doc);const c=find(db,id);
   if(c.phase==='active')return {contract:c,replayed:true};
   if(c.phase!=='available'||c.id!==db.activeId)throw error('伙伴尚未准备好到岛');
   let context;try{context=recruitmentContext(doc,c.projectId,c.context?.candidate||c.profile||RECRUIT_CANDIDATE)}catch(e){if(e.code!=='recruitment_no_work')throw e;close(db,c,'cancelled','原筹备缺口已经完成，无需追加聘请');return {contract:c}}
   ensureFee(doc,id);const allowed=new Set(context.steps.map(t=>t.id)),steps=c.runs.at(-1).child.acceptedSteps.filter(id=>allowed.has(id));
   if(!steps.length){close(db,c,'cancelled','原筹备缺口已经完成，无需追加聘请');return {contract:c}}
   c.steps=steps;c.agreedSteps=context.steps.filter(t=>steps.includes(t.id)).map(t=>({id:t.id,item:t.item,quantity:t.quantity,originalNpc:t.npcId}));c.phase='active';c.startedDay=doc.state.day;c.expiresDay=doc.state.day+c.termDays;event(c,'active','聘约开始，伙伴将前往小岛协作');return {contract:c};
  })},
  async departed(theme,doc,id){return locked(theme,db=>{reconcile(db,doc);const c=find(db,id);if(c.phase==='departed')return {contract:c,replayed:true};if(c.phase!=='leaving')throw error('还未开始离岛');if(doc.state.recruitment?.departedId!==id)throw error('尚未收到游戏中实际离岛回执');
   const a=doc.state.recruitment.active,run=c.runs.at(-1);
   if(a?.id!==id||a.phase!=='departed'||a.parentRunId!==run.parent.id||a.childRunId!==run.child.id)throw error('离岛记录与实际聘约运行不一致');
   const agreed=c.agreedSteps||[],quantity=agreed.reduce((n,t)=>n+t.quantity,0),evidence=agreed.map(step=>{
    const rows=(doc.state.agentTaskLedger.find(t=>t.id===step.id)?.evidence||[]).filter(e=>e.npcId===16&&e.contractId===id);
    return {stepId:step.id,item:step.item,quantity:step.quantity,delivered:Math.min(step.quantity,rows.reduce((n,e)=>n+Math.max(0,e.amount||0),0)),operations:rows.map(e=>e.id)};
   }),delivered=evidence.reduce((n,t)=>n+t.delivered,0),fee=quantity?Math.min(c.wage,Math.ceil(c.wage*delivered/quantity)):0;
   if(a.feePaid!==fee||fee&&doc.state.resourceLedger?.receipts?.['cash:hire-'+id]?.delta?.coins!==-fee)throw error('协作报酬尚未按实际交付正确结算');
   c.delivery={departedDay:doc.state.day,hasArrived:!!a.hasArrived,reason:a.leaveRequested,fee,delivered,quantity,evidence};
   close(db,c,'departed','已收到游戏离岛回执；交付 '+delivered+' 份，结算 '+fee+' 岛币，临时席位释放');return {contract:c}})},
  async profile(theme,doc,{id,expectedVersion,requestId,fields}={}){return locked(theme,db=>{
   reconcile(db,doc);const c=find(db,id);
   if(c.world!==recruitmentWorld(doc)||!['active','leaving'].includes(c.phase))throw error('只能编辑当前聘约中的伙伴');
   if(!/^[a-zA-Z0-9-]{8,80}$/.test(requestId||''))throw error('档案修改编号无效');
   c.profileEdits??=[];
   const keys={name:16,personality:160,lifeGoal:120,speechStyle:100},patch={};
   if(!fields||Object.keys(fields).some(k=>!Object.hasOwn(keys,k)))throw error('仅支持姓名、性格、生活目标和说话风格');
   for(const [key,max] of Object.entries(keys)){const value=fields[key];if(typeof value!=='string'||value.length>max||!value.trim())throw error('请填写完整档案，并保持在字数限制内');patch[key]=value.trim()}
   const previous=c.profileEdits.find(e=>e.id===requestId);
   if(previous){if(JSON.stringify(previous.fields)!==JSON.stringify(patch))throw error('修改编号已用于另一份内容','recruitment_conflict',409);return {contract:c,replayed:true}}
   const profile=c.profile||{...RECRUIT_CANDIDATE};
   if(expectedVersion!==profile.version)throw error('伙伴档案已经更新，请重新读取后修改','recruitment_conflict',409);
   c.profile={...profile,...patch,version:profile.version+1};
   c.profileEdits.push({id:requestId,at:new Date(now()).toISOString(),day:doc.state.day,version:c.profile.version,before:Object.fromEntries(Object.keys(keys).map(k=>[k,profile[k]])),fields:patch});
   event(c,'profile','岛主更新了伙伴档案 · 第 '+c.profile.version+' 版');return {contract:c};
  })},
  async peek(theme,id){return locked(theme,db=>find(db,id))}
 };
}
