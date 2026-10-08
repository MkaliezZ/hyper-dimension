import {worldFetch as fetch} from './worldSession.js';
import {recruitmentExchange} from './recruitmentExchange.js';
import {renewalReadiness} from './recruitmentRenewal.js';
import {openResidentTravelHistory} from './lanSocialUI.js';
import {createCandidateLibrary} from './recruitCandidateLibrary.js';
import {candidateBoard,bindCandidateBoard,candidateSkills} from './recruitCandidateUI.js';
import {projectSteps} from './projectPlans.js';
import {hydrateRecruitment,recruitmentProgress,requestRecruitmentLeave,archiveRecruitment} from './recruitment.js';
import {RECRUIT_CANDIDATE,RECRUIT_CANDIDATES,candidateStepAllowed,RECRUIT_STAGE_LABEL,recruitmentWorldKey} from './recruitmentCatalog.js';
import {avatarPortrait} from './avatars.js';
import {itemMarkup} from './artStore.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {esc} from './journeyUI.js';
const profileEditMarkup=c=>(c?.profileEdits||[]).slice(-8).reverse().map(e=>'<div class="recruit-edit-history"><strong>第 '+e.day+' 天 · 档案第 '+e.version+' 版</strong>'+Object.entries(e.fields).filter(([k,v])=>v!==e.before[k]).map(([k,v])=>'<p>'+esc(({name:'姓名',personality:'性格',lifeGoal:'目标',speechStyle:'说话风格'})[k])+': '+esc(e.before[k])+' → '+esc(v)+'</p>').join('')+'</div>').join('');
const labels={planning:'管家与伙伴正在商量分工',cancelling:'正在结束本次运行',available:'伙伴已接受，准备到岛',active:'聘约进行中',leaving:'正在交接并离岛',cancelled:'本次到岛已取消',failed:'本次运行未完成',interrupted:'运行已中断，可重试',departed:'已离岛',renewed:'旧聘约已结算，原地续约'};
function autonomyMarkup(registry,candidates,busy){
 const a=registry?.autonomy;if(!a)return '';const p=a.policy,t=a.stats;
 return '<section class="recruit-autonomy"><div class="recruit-section-title"><h4>管家自主招聘</h4><span>'+esc(p.enabled?'已开启':'未开启')+'</span></div><p>管家在原有低频巡查中评估真实筹备缺口。每次预留 8 岛币，聘期两天，同时只留一位临时伙伴；按实际交付付薪。</p><div class="recruit-totals"><span>今天申请 '+t.attempts+' / '+p.maxContractsPerDay+' 次</span><b>额度占用 '+t.allocated+' / '+p.dailyBudget+' 岛币</b></div><p role="status">'+esc(a.reason||'当前可按职业匹配筹备任务')+'</p><details data-history="autonomy-policy"><summary>设置招聘范围与经营底金</summary><form id="recruitPolicyForm"><label class="recruit-policy-toggle"><input id="recruitPolicyEnabled" type="checkbox" '+(p.enabled?'checked':'')+'> 允许管家按政策自行邀请伙伴</label><div class="recruit-policy-fields"><label>每日预算（岛币）<select id="recruitPolicyBudget">'+[8,16,24,32].map(n=>'<option '+(n===p.dailyBudget?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>每天最多申请<input id="recruitPolicyCount" type="number" min="1" max="3" value="'+p.maxContractsPerDay+'"></label><label>至少保留经营底金<input id="recruitPolicyFloor" type="number" min="0" max="1000" value="'+p.coinFloor+'"></label></div><fieldset><legend>可邀请的伙伴</legend>'+candidates.map(c=>'<label><input type="checkbox" name="recruitPolicyCandidate" value="'+esc(c.id)+'" '+(p.candidateIds.includes(c.id)?'checked':'')+'>'+esc(c.name)+' · '+esc(c.job)+'</label>').join('')+'</fieldset><button class="primary" '+(busy?'disabled':'')+'>保存自主招聘政策</button><p>预算按游戏日计算。关闭只停止新的自主申请；已有聘约继续履行。失败申请仍计次数，未交付不收聘金。</p></form></details></section>';
}

export function createRecruitmentUI({state,theme,saves,persist,openModal,toast,back,projects,refreshActor,command}){
 let selectedCandidate='mai',selectedPlan=null,editPending=null,registry=null,error='',busy=false,polling=false,generation=0,lastSignature='',lastPoll=0;
 const $=id=>document.getElementById(id);
 const here=()=>({theme:theme(),world:recruitmentWorldKey(state(),theme()),generation});
 const same=c=>c.theme===theme()&&c.world===recruitmentWorldKey(state(),theme())&&c.generation===generation;
 async function api(operation,body,capture=here()){
  const response=await fetch('/api/recruitment/'+capture.theme+'/'+operation,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error||'招聘暂不可用'),{code:data.code,status:response.status});return data;
 }
 async function flush(c){persist();await saves.flush(c.theme);if(!same(c))throw Error('小岛画风已切换，请在对应小岛继续')}
 async function applyStatus(c){
  if(!same(c))return;
  const r=hydrateRecruitment(state()),active=registry.active,history=registry.history||[];
  if(r.renewal){const draft=r.renewal,ended=history.find(h=>h.id===draft.id&&['failed','interrupted','cancelled'].includes(h.phase));
   if(ended){await command('hire_renew_release',{contractId:draft.oldId,renewalId:draft.id,day:state().day});if(!same(c))return;}
   else if(registry.renewal?.id===draft.id&&registry.renewal.phase==='available'){
    await flush(c);await command('hire_renew',{contractId:draft.oldId,renewalId:draft.id,day:state().day});if(!same(c))return;
    await api('status',null,c);refreshActor();toast('旧聘约已按实际交付结算，伙伴原地开始新的协作');return;
   }
  }
  if(r.pending&&history.some(h=>h.id===r.pending.id&&['failed','interrupted','cancelled'].includes(h.phase))){await command('hire_release',{contractId:r.pending.id,day:state().day});if(!same(c))return;}
  if(active?.world===c.world&&active.phase==='available'&&!r.active){
   await flush(c);const result=await api('activate',{id:active.id},c);if(!same(c))return;registry.active=result.contract;
   if(result.contract.phase==='cancelled'){await command('hire_release',{contractId:active.id,day:state().day});return}
  }
  const current=registry.active;
  // Restoring an older world snapshot must not resurrect a closed seat or keep producing.
  if(r.active&&!r.active.leaveRequested&&history.some(h=>h.id===r.active.id&&['departed','cancelled'].includes(h.phase))){requestRecruitmentLeave(state(),'这份聘约已结束，恢复进度后交接离岛');persist()}
  if(current?.world===c.world&&current.phase==='active'&&!r.active){
   const response=await command('hire_bind',{contractId:current.id,day:state().day}),result=response.receipt.details;if(!same(c))return;if(!result.ok){error=result.reason;return}
   refreshActor();persist();
  }
  if(r.active&&current?.id===r.active.id&&current.profile?.version>r.active.profile.version){r.active.profile=current.profile;persist()}
  if(r.active&&current?.id===r.active.id&&current.phase==='leaving'){requestRecruitmentLeave(state(),'聘约结束，交接后继续采风');persist()}
  if(r.active?.leaveRequested&&current?.id===r.active.id&&current.phase==='active'){
   await flush(c);await api('cancel',{id:current.id},c);if(!same(c))return;
  }
  if(r.active?.phase==='departed'){
   const id=r.active.id;
   if(history.some(h=>h.id===id&&['departed','cancelled'].includes(h.phase))){archiveRecruitment(state(),id);refreshActor();persist();return}
   await flush(c);const result=await api('departed',{id},c);if(!same(c))return;
   if(result.contract.phase==='departed'){registry.active=null;registry.history=[result.contract,...(registry.history||[]).filter(h=>h.id!==id)];archiveRecruitment(state(),id);refreshActor();persist()}
  }
 }
 async function poll(force=false){
  if(polling||busy||!force&&Date.now()-lastPoll<2000)return;
  const c=here();polling=true;lastPoll=Date.now();
  try{const data=await api('status',null,c);if(!same(c))return;registry=data;error='';await applyStatus(c);if(same(c)&&registry.offers?.length)await autonomous(registry.offers)}
  catch(e){if(same(c))error=e.message}
  finally{polling=false;paint();if(!same(c))void poll(true)}
 }
 async function submit(projectId,existingId=null,mode='hire',candidateId=selectedCandidate,recallId=null,source='user'){
  if(busy)return;const c=here(),id=existingId||crypto.randomUUID();busy=true;error='';paint();
  try{await command('hire_prepare',{contractId:id,projectId,candidateId,mode,recallId,source,day:state().day});if(!same(c))return;await flush(c);await api(mode,mode==='retry'?{id}:mode==='recall'?{id:recallId,requestId:id,projectId}:{requestId:id,projectId,candidateId,source},c)}
  catch(e){if(same(c)){error=e.message;if(source==='primary'&&e.status>=400&&e.status<500){await command('hire_release',{contractId:id,day:state().day});}}}
  finally{busy=false;await poll(true);if(same(c))paint()}
 }


 async function autonomous(offers){
  if(busy||state().recruitment?.active||state().recruitment?.pending)return;
  const c=here(),offer=offers.find(g=>g.world===c.world&&g.phase==='issued'&&g.expiresAt>Date.now());
  if(!offer)return;await submit(offer.projectId,offer.id,'hire',offer.candidateId,null,'primary');
 }
 async function savePolicy(e){
  e.preventDefault();if(busy||!registry?.autonomy)return;const c=here(),p=registry.autonomy.policy;
  const input={enabled:$('recruitPolicyEnabled').checked,dailyBudget:Number($('recruitPolicyBudget').value),maxContractsPerDay:Number($('recruitPolicyCount').value),coinFloor:Number($('recruitPolicyFloor').value),candidateIds:[...document.querySelectorAll('[name="recruitPolicyCandidate"]:checked')].map(el=>el.value)};
  busy=true;error='';try{await flush(c);await api('policy',{requestId:crypto.randomUUID(),expectedVersion:p.version,input},c);toast('自主招聘政策已保存，管家按原巡查频率判断');}catch(e){if(same(c))error=e.message;}finally{busy=false;await poll(true);if(same(c))paint(true);}
 }
 async function renew(projectId){
  if(busy)return;const c=here(),a=state().recruitment?.active;if(!a)return;
  const old=registry?.active,ready=renewalReadiness(state(),old);if(!ready.ok&&!state().recruitment.renewal){toast(ready.reason);return;}
  const draft=state().recruitment.renewal||{id:crypto.randomUUID(),oldId:a.id,projectId};
  busy=true;error='';paint(true);
  try{await command('hire_renew_prepare',{contractId:draft.oldId,renewalId:draft.id,projectId:draft.projectId,day:state().day});if(!same(c))return;await flush(c);await api('renew',{id:draft.oldId,requestId:draft.id,projectId:draft.projectId},c);}
  catch(e){if(same(c))error=e.message;}
  finally{busy=false;await poll(true);if(same(c))paint(true);}
 }
 async function cancelRenewal(){
  if(busy)return;const c=here(),draft=state().recruitment?.renewal;if(!draft)return;busy=true;error='';
  try{await flush(c);await api('cancel',{id:draft.id},c);}catch(e){if(same(c))error=e.message;}
  finally{busy=false;await poll(true);if(same(c))paint(true);}
 }
 async function cancel(id){
  if(busy)return;const c=here();busy=true;const r=hydrateRecruitment(state());if(r.active?.id===id)requestRecruitmentLeave(state(),'岛主结束聘约，交接后继续采风');
  try{await flush(c);const result=await api('cancel',{id},c);if(!same(c))return;if(result.contract.phase==='cancelled'){await command('hire_release',{contractId:id,day:state().day});}}
  catch(e){if(same(c))error=e.message}
  finally{busy=false;await poll(true);if(same(c))paint()}
 }
 async function createCandidate(input,requestId){if(busy)return false;const c=here();let failure='';busy=true;try{await flush(c);const result=await api('candidate',{requestId,input},c);if(!same(c))return false;selectedCandidate=result.candidate.id;localStorage.removeItem('hd-recruit-candidate-draft:'+c.theme+':'+c.world);toast('伙伴档案已保存，可以选择筹备清单邀请到岛');return true;}catch(e){failure=e.message;return false;}finally{busy=false;await poll(true);if(same(c)){if(failure)error=failure;paint(true);}}}

 async function editProfile(){
  if(busy)return;const c=here(),a=hydrateRecruitment(state()).active;if(!a)return;if(state().recruitment.renewal){toast('续约协商期间请先保留当前档案，结束协商后再修改');return;}
  const fields=Object.fromEntries(['name','personality','lifeGoal','speechStyle'].map(key=>[key,$('recruitEdit-'+key).value.trim()]));
  if(Object.values(fields).some(v=>!v)){toast('请填写完整的伙伴档案');return}
  const draft=JSON.stringify({id:a.id,expectedVersion:a.profile.version,fields});
  if(editPending?.draft!==draft)editPending={draft,id:crypto.randomUUID()};
  busy=true;error='';
  try{
   await flush(c);const result=await api('profile',{id:a.id,expectedVersion:a.profile.version,requestId:editPending.id,fields},c);
   if(!same(c))return;registry.active=result.contract;a.profile=result.contract.profile;editPending=null;persist();toast('伙伴档案已保存，修改记录已写入名册');
  }catch(e){if(same(c))error=e.message}
  finally{busy=false;await poll(true);if(same(c))paint(true)}
 }
 const library=createCandidateLibrary({openModal,theme,world:()=>here().world,records:()=>registry?.candidateRecords||[],refresh:()=>poll(true),back:()=>open(),toast,save:async body=>{const c=here();await flush(c);const r=await api('candidate_manage',body,c);if(!same(c))throw Error('当前小岛已变化，请在原小岛核对档案');return r;}});
 function open(){
  openModal('来小岛，一起做点事','招聘手账 · 一位临时伙伴，一段共同完成的故事','<div id="recruitmentPanel"></div>',
   '<button class="secondary" id="recruitBack">返回管家</button><button class="secondary" id="recruitProjects">查看筹备清单</button><button class="secondary" id="recruitLibrary">候选档案库</button>');
  document.querySelector('#modalRoot .modal').classList.add('recruitment-modal');
  $('recruitLibrary').onclick=()=>library.open();$('recruitBack').onclick=back;$('recruitProjects').onclick=projects;paint(true);void poll(true);
 }
 function paint(force=false){
  const root=$('recruitmentPanel');if(!root)return;
  if(!force&&root.contains(document.activeElement)&&['SELECT','INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;
  const r=hydrateRecruitment(state()),a=r.active,pending=r.pending,candidates=registry?.candidates||RECRUIT_CANDIDATES,candidate=a?.profile||registry?.active?.profile||candidates.find(c=>c.id===(pending?.candidateId||selectedCandidate))||RECRUIT_CANDIDATE,progress=recruitmentProgress(state());
  const renewPlans=(state().workProjects||[]).filter(p=>['preparing','paused'].includes(p.status)),renewReady=renewalReadiness(state(),registry?.active);
  const plans=(state().workProjects||[]).filter(p=>p.status==='preparing'),contract=registry?.active;
  selectedPlan=plans.some(p=>p.id===selectedPlan)?selectedPlan:plans[0]?.id;const eligible=selectedPlan?projectSteps(state(),selectedPlan).filter(t=>t.remaining>0&&t.npcId!==-1&&!t.blocked&&candidateStepAllowed(candidate,t)).length:0;
  const signature=JSON.stringify([theme(),selectedCandidate,selectedPlan,candidates,a,progress,pending,plans.map(p=>[p.id,p.status]),contract?.phase,registry?.history,registry?.candidateRecords,registry?.renewal,registry?.autonomy,state().recruitment.renewal,renewReady,renewPlans,error,busy]);
  if(!force&&(lastSignature===signature||document.activeElement?.closest('#recruitPolicyForm')))return;lastSignature=signature;
  const details=[...root.querySelectorAll('details[open]')].map(d=>d.dataset.history),body=root.closest('.modal-body'),scroll=body.scrollTop;
  const status=a?RECRUIT_STAGE_LABEL[a.phase]:contract?labels[contract.phase]:pending?'招聘请求等待确认':'一席空位，等一位新朋友';
  root.innerHTML=(!a&&!contract&&!pending?candidateBoard(candidates,candidate.id,theme(),here().world):'')+'<section class="recruit-hero"><div class="recruit-portrait">'+avatarPortrait(candidate.appearance,theme())+'<span>临时协作伙伴</span></div><article><small>ISLAND / A SHORT STAY</small><h3>'+esc(candidate.name)+'</h3><p class="recruit-role">'+esc(candidate.job)+'</p><p>'+esc(candidate.backstory)+'</p><div class="recruit-tags">'+candidateSkills(candidate).map(t=>'<span>'+esc(t)+'</span>').join('')+'</div><p class="recruit-personality">'+esc(candidate.personality)+'</p></article></section>'+
   '<section class="recruit-contract"><div class="recruit-section-title"><h4>'+esc(status)+'</h4><span>临时席位 '+(contract||a||pending?'1':'0')+' / 1</span></div><p class="recruit-terms">聘期 2 个游戏日 · 最多 8 岛币<br>先预留报酬，按约定数量的实际交付比例结算，向上取整；未交付不收费。聘期到达或工作结束后交接离岛。</p>'+
   (a?'<h4>'+esc(a.title)+'</h4><ul class="recruit-steps">'+progress.steps.map(t=>'<li>'+itemMarkup(t.item,theme(),'recruit-item')+'<span><b>'+esc(ITEM_BY_ID[t.item]?.name||t.item)+'</b><small>伙伴交付 '+t.delivered+' / '+t.quantity+' · '+(t.owner===16?'由伙伴负责':'已满足或交接')+'</small></span></li>').join('')+'</ul><div class="recruit-totals"><span>第 '+a.startedDay+' 天 — 第 '+a.expiresDay+' 天</span><b>'+(a.feePaid===null?'当前应结 '+progress.fee:'已结算 '+a.feePaid)+' 岛币</b></div><button class="secondary" id="recruitCancel" data-id="'+a.id+'" '+(a.leaveRequested||busy?'disabled':'')+'>结束聘约并交接</button>':
   contract||pending?'<div class="recruit-await"><span class="recruit-pulse"></span><p>'+esc(contract?labels[contract.phase]:'请求结果尚未确认，继续查询不会重复招聘。')+'</p></div>'+
    (pending&&!contract?'<button class="primary" id="recruitResume">继续确认同一申请</button>':'')+'<button class="secondary" id="recruitCancel" data-id="'+(contract?.id||pending.id)+'" '+(busy?'disabled':'')+'>取消本次到岛</button>':
   plans.length?'<label class="recruit-plan-label">这次一起准备什么？<select id="recruitPlan">'+plans.map(p=>'<option value="'+p.id+'" '+(p.id===selectedPlan?'selected':'')+'>'+esc(p.title)+'</option>').join('')+'</select></label><button class="primary" id="recruitHire" '+(busy||!eligible?'disabled':'')+'>邀请'+esc(candidate.name)+'协作 · 预留 8 岛币</button><p class="recruit-match" role="status">'+(eligible?'这份清单有 '+eligible+' 项工作符合伙伴职业，由主子 Agent 商定本次分工。':'这份清单没有符合伙伴职业的待办，请更换伙伴或筹备清单。')+'</p>':
   '<div class="recruit-empty"><b>先写一份筹备清单</b><p>确定要准备的物资，管家才能与伙伴商量具体分工。</p><button class="primary" id="recruitCreatePlan">去写清单</button></div>')+
   (error?'<p class="recruit-error" role="status">'+esc(error)+'</p><button class="secondary" id="recruitRefresh">重新查询</button>':'')+'</section>'+

   (here().world===contract?.world?recruitmentExchange(contract,state(),theme()):'')+autonomyMarkup(registry,candidates,busy)+(a?.autonomousDecision?'<section class="recruit-autonomy"><h4>管家自主邀请的伙伴</h4><p>'+esc(a.autonomousDecision.reason)+'</p><details data-history="autonomy-source"><summary>本次决策来源</summary><p>巡查运行 <code>'+esc(a.autonomousDecision.runId)+'</code></p><p>用量记录 <code>'+esc(a.autonomousDecision.ledgerRunId)+'</code></p><p>招聘政策第 '+a.autonomousDecision.policyVersion+' 版</p></details></section>':'')+
   (a?'<section class="recruit-renewal"><h4>继续留岛协作</h4><p>每段续约 2 个游戏日，另预留 8 岛币；旧聘约按实际交付单独结算。最多连续续约三次。</p>'+
    (state().recruitment.renewal?'<p role="status">'+esc(registry?.renewal?labels[registry.renewal.phase]:'续约草稿已保存，等待确认')+'</p><button class="secondary" id="recruitRenewRetry" '+(busy?'disabled':'')+'>确认同一份续约</button><button class="secondary" id="recruitRenewCancel" '+(busy?'disabled':'')+'>取消这份续约</button>':
    '<label class="recruit-plan-label">续约继续准备哪份清单？<select id="recruitRenewPlan">'+renewPlans.map(p=>'<option value="'+p.id+'">'+esc(p.title)+'</option>').join('')+'</select></label><p>'+esc(renewReady.ok?renewPlans.length?'管家将与伙伴重新商量职业匹配的剩余工作。':'还没有可继续的筹备任务，请先建立清单。':renewReady.reason)+'</p><button class="primary" id="recruitRenew" '+(busy||!renewReady.ok||!renewPlans.length?'disabled':'')+'>与'+esc(a.profile.name)+'商量续约</button>')+'</section>':'')+
   (a?'<details class="recruit-record" data-history="active"><summary>共同经历与实际运行记录</summary><p>主运行 <code>'+esc(a.parentRunId)+'</code></p><p>子运行 <code>'+esc(a.childRunId)+'</code></p><p>本次模型用量 '+((a.usage.parent?.total||0)+(a.usage.child?.total||0))+' token · 游戏报酬单独结算</p>'+a.history.slice(-8).map(h=>'<p>第 '+h.day+' 天 · '+esc(h.text)+'</p>').join('')+'</details>':'')+
   (a?'<details class="recruit-record recruit-editor" data-history="edit"><summary>轻度编辑伙伴档案 · 第 '+a.profile.version+' 版</summary><p>调整展示姓名与性格描述；已经接受的分工与报酬保留原约定。</p>'+[['name','姓名',16],['personality','性格',160],['lifeGoal','生活目标',120],['speechStyle','说话风格',100]].map(([key,label,max])=>'<label>'+label+'<textarea id="recruitEdit-'+key+'" rows="'+(key==='name'?1:2)+'" maxlength="'+max+'">'+esc(a.profile[key]||'')+'</textarea></label>').join('')+'<button class="secondary" id="recruitSaveProfile" '+(busy?'disabled':'')+'>保存档案</button>'+profileEditMarkup(contract)+'</details>':'')+
   '<section class="recruit-history"><h4>来过小岛的故事</h4>'+((registry?.history||[]).slice(0,8).map(h=>'<details class="recruit-record" data-history="'+h.id+'"><summary>'+esc(h.profile?.name||'小麦')+' · '+esc(h.context?.project?.title||'一次到岛邀请')+' · '+esc(labels[h.phase]||h.phase)+'</summary>'+h.events.slice(-5).map(e=>'<p>'+esc(e.text)+'</p>').join('')+profileEditMarkup(h)+(h.delivery?'<p>实际交付 '+h.delivery.delivered+' / '+h.delivery.quantity+' 份 · 报酬 '+h.delivery.fee+' 岛币</p>':'')+(h.runs?.at(-1)?.child?'<p>主运行 <code>'+esc(h.runs.at(-1).parent.id)+'</code><br>子运行 <code>'+esc(h.runs.at(-1).child.id)+'</code></p>':'')+(!h.renewalOf&&['failed','interrupted'].includes(h.phase)&&!a&&!contract&&!pending?'<button class="secondary" data-recruit-retry="'+h.id+'" data-project="'+h.projectId+'" data-candidate-id="'+esc(h.candidateId||'mai')+'">重试这份筹备委托</button>':'')+(h.phase==='departed'&&h.world===here().world&&!a&&!contract&&!pending&&plans.length?'<p>再次邀请会沿用上次档案，重新商量上方选中的筹备清单。</p><button class="secondary" data-recruit-recall="'+esc(h.id)+'" data-candidate-id="'+esc(h.candidateId||'mai')+'" '+(!candidates.some(c=>c.id===h.candidateId)?'disabled':'')+'>再次邀请'+esc(h.profile?.name||'伙伴')+' · 新聘约</button>'+(!candidates.some(c=>c.id===h.candidateId)?'<p>请先在候选档案库恢复这位伙伴。</p>':''):'')+'</details>').join('')||'<p>下一位朋友的经历，会从这里开始。</p>')+'</section>';
  if(location.pathname==='/play'){const ids=[...(a?[a.id]:[]),...(registry?.history||[]).filter(h=>h.world===here().world).map(h=>h.id)];for(const id of ids){const record=[...root.querySelectorAll('details')].find(d=>d.dataset.history===(id===a?.id?'active':id));if(record){const b=document.createElement('button');b.className='secondary';b.textContent='翻看这份聘约的跨岛相遇';b.dataset.recruitTravel=id;b.onclick=()=>openResidentTravelHistory({npcId:16,theme:theme(),contractId:id,openModal,back:open});record.append(b);}}}
  root.querySelectorAll('details').forEach(d=>{d.open=details.includes(d.dataset.history)});body.scrollTop=scroll;
  if($('recruitPolicyForm'))$('recruitPolicyForm').onsubmit=savePolicy;
  if($('recruitRenew'))$('recruitRenew').onclick=()=>renew($('recruitRenewPlan').value);
  if($('recruitRenewRetry'))$('recruitRenewRetry').onclick=()=>renew(state().recruitment.renewal.projectId);
  if($('recruitRenewCancel'))$('recruitRenewCancel').onclick=cancelRenewal;
  if($('recruitSaveProfile'))$('recruitSaveProfile').onclick=editProfile;
  bindCandidateBoard(root,{theme:theme(),world:here().world,select:id=>{selectedCandidate=id;paint(true)},create:createCandidate});
  if($('recruitPlan'))$('recruitPlan').onchange=e=>{selectedPlan=e.target.value;paint(true)};
  if($('recruitHire'))$('recruitHire').onclick=()=>submit($('recruitPlan').value);
  if($('recruitCancel'))$('recruitCancel').onclick=e=>cancel(e.currentTarget.dataset.id);
  if($('recruitResume'))$('recruitResume').onclick=()=>submit(pending.projectId,pending.id,pending.mode||'hire',pending.candidateId||'mai',pending.recallId||null,pending.source||'user');
  if($('recruitCreatePlan'))$('recruitCreatePlan').onclick=projects;
  if($('recruitRefresh'))$('recruitRefresh').onclick=()=>poll(true);
  root.querySelectorAll('[data-recruit-recall]').forEach(b=>b.onclick=()=>submit(selectedPlan,null,'recall',b.dataset.candidateId,b.dataset.recruitRecall));
  root.querySelectorAll('[data-recruit-retry]').forEach(b=>b.onclick=()=>submit(b.dataset.project,b.dataset.recruitRetry,'retry',b.dataset.candidateId));
 }
 function reset(){generation++;selectedCandidate='mai';selectedPlan=null;editPending=null;registry=null;error='';lastSignature='';lastPoll=0;void poll(true)}
 setInterval(()=>{const r=hydrateRecruitment(state());if(r.active||r.pending||registry?.autonomy?.policy.enabled||$('recruitmentPanel'))void poll()},2200);
 return {open,paint,reset,poll,submit,cancel,autonomous};
}
