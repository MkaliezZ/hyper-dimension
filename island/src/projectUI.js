import {createProject,hydrateProjects,projectSteps,playerProjectTask} from './projectPlans.js';
import {RAW_MATERIALS,ALL_RECIPES,ITEM_BY_ID,RECIPE_BY_ID,recipeGate} from './contentCatalog.js';
import {itemMarkup,artReady} from './artStore.js';
import {RESIDENTS} from './world.js';
import {esc} from './journeyUI.js';
const status={preparing:'筹备中',ready:'物资齐备',paused:'已暂停',completed:'已入库',cancelled:'已取消',queued:'待出发',running:'执行中',waiting:'等候前置',done:'需求已满足'};
export function createProjectUI({state,theme,openModal,persist,create,manage,refresh,toast,craft,gather,back}){
 const $=id=>document.getElementById(id);let managing=false,lastSignature='',draft={lantern:1,wheat:2};
 const name=id=>id===16?state().recruitment?.active?.profile?.name||'临时伙伴':state().npcProfiles?.[id]?.name||RESIDENTS[id]?.name||'伙伴';
 const icon=id=>itemMarkup(id,theme(),'plan-item-art');
 function draftPaint(){
  $('planDraft').innerHTML=Object.entries(draft).map(([id,n])=>'<span>'+icon(id)+esc(ITEM_BY_ID[id].name)+' ×'+n+'<button type="button" class="secondary" data-remove-target="'+id+'" aria-label="移除'+esc(ITEM_BY_ID[id].name)+'">×</button></span>').join('');
  document.querySelectorAll('[data-remove-target]').forEach(b=>b.onclick=()=>{delete draft[b.dataset.removeTarget];draftPaint()});
 }
 function open(){
  refresh();
  const choices=[...RAW_MATERIALS,...ALL_RECIPES.filter(r=>recipeGate(r,state()).ready).map(r=>ITEM_BY_ID[r.item])];
  openModal('一起，把计划变成现实','筹备手账 · 先备齐物资，再迎接热闹的一天',
   '<section class="plan-intro"><small>ISLAND / TOGETHER</small><h3>你动手，伙伴也在路上。</h3><p>库存先计入，缺口按职业分工。亲手补齐后，伙伴会停止多余工作。已备物资为这份计划留用。</p></section><details class="plan-builder"'+(hydrateProjects(state()).some(p=>['preparing','ready','paused'].includes(p.status))?'':' open')+'><summary>写一份筹备清单</summary><label>计划名称<input id="planTitle" maxlength="50" value="星灯夜集物资"></label><div class="plan-add-row"><label>物品<select id="planItem">'+choices.map(i=>'<option value="'+i.id+'">'+esc(i.name)+'</option>').join('')+'</select></label><label>数量<input id="planQuantity" type="number" min="1" max="50" value="1"></label><button type="button" class="secondary" id="planAdd">加入清单</button></div><div id="planDraft"></div><p class="plan-help">最多同时筹备 3 份。夜集的邀请与开场费仍需在派对看板确认。</p><button class="primary" id="planCreate">开始共同筹备</button><p id="planError" role="status"></p></details><div id="projectList"></div>',
   '<button class="secondary" id="plansBack">返回管家</button>');
  document.querySelector('#modalRoot .modal').classList.add('project-modal');
  $('plansBack').onclick=back;draftPaint();
  $('planAdd').onclick=()=>{const id=$('planItem').value,n=Number($('planQuantity').value);if(!Number.isInteger(n)||n<1||n>50){$('planError').textContent='每种物品数量为 1–50';return}if(!draft[id]&&Object.keys(draft).length>=8){$('planError').textContent='每份清单最多 8 种物品';return}draft[id]=n;$('planError').textContent='';draftPaint()};
  $('planCreate').onclick=async()=>{if(managing)return;const input={id:crypto.randomUUID(),title:$('planTitle').value,targets:structuredClone(draft)};managing=true;$('planCreate').disabled=true;$('planError').textContent='正在登记筹备清单…';try{const result=create?await create(input):createProject(state(),input);if(!result.ok){if($('planError'))$('planError').textContent=result.reason;return}refresh();persist();if($('planError'))$('planError').textContent='计划已登记，伙伴会按顺序完成工作。';const builder=document.querySelector('.plan-builder');if(builder)builder.open=false;}catch(e){if($('planError'))$('planError').textContent=e.message;toast(e.message)}finally{managing=false;if($('planCreate'))$('planCreate').disabled=false;paint(true)}};
  paint(true);void artReady.then(()=>{if($('projectList')){paint(true);if($('planDraft'))draftPaint()}});
 }
 function paint(force=false){
  const root=$('projectList');if(!root)return;
  if(!force&&root.contains(document.activeElement)&&document.activeElement.tagName==='SELECT')return;
  const rows=hydrateProjects(state());document.querySelector('.project-modal')?.classList.toggle('has-projects',rows.length>0);const signature=JSON.stringify([theme(),rows,rows.flatMap(p=>projectSteps(state(),p.id)),state().npcProfiles]);if(!force&&signature===lastSignature)return;lastSignature=signature;const live=rows.filter(p=>['preparing','ready','paused'].includes(p.status)),recent=rows.filter(p=>!['preparing','ready','paused'].includes(p.status)).slice(-5).reverse();
  const html=[...live,...recent].map(p=>{
   const active=['preparing','ready','paused'].includes(p.status),steps=projectSteps(state(),p.id);
   const button=(action,label,cls='secondary')=>'<button class="'+cls+'" data-plan="'+p.id+'" data-plan-action="'+action+'">'+label+'</button>';
   return '<article class="project-card" data-project="'+p.id+'" data-status="'+p.status+'"><header><div><small>第 '+p.createdDay+' 天 · '+(p.source==='hermes'?'管家规划':'岛主发起')+'</small><h3>'+esc(p.title)+'</h3></div><span class="plan-status">'+status[p.status]+'</span></header><div class="plan-targets">'+Object.entries(p.targets).map(([id,n])=>'<div>'+icon(id)+'<span><b>'+esc(ITEM_BY_ID[id].name)+'</b><small>'+(active?'留用 '+Math.min(n,p.held?.[id]||0)+' / '+n:'目标 '+n+' 份')+'</small></span></div>').join('')+'</div>'+
   (steps.length?'<ol class="plan-steps">'+steps.map(t=>{
    const missing=t.remaining>0,canAct=active&&p.status!=='paused'&&missing;
    return '<li data-plan-step="'+t.id+'"><div class="plan-step-main">'+icon(t.targetItem)+'<div><b>'+esc(ITEM_BY_ID[t.targetItem].name)+' <em>'+status[t.status]+'</em></b><p>'+(missing?'还需 '+t.remaining+' 份':'当前库存需求已满足')+' · 步骤实际产出 '+(t.completed||0)+' 份</p><small>'+esc(t.blocked|| (t.dependsOn.length?'先备好：'+t.dependsOn.map(id=>ITEM_BY_ID[steps.find(x=>x.id===id)?.targetItem]?.name||'前置材料').join('、'):t.npcId===-1?'岛主完成真实采集或制作后，物资自动计入':t.result||'按职业安排下一步'))+'</small></div></div>'+
    (canAct?'<div class="plan-step-controls"><label>负责人<select data-plan-assignee="'+t.id+'"><option value="-1" '+(t.npcId===-1?'selected':'')+'>我来接管</option>'+RESIDENTS.map((r,i)=>'<option value="'+i+'" '+(t.npcId===i?'selected':'')+'>'+esc(name(i))+' · '+esc(r.job)+'</option>').join('')+(state().recruitment?.active?.steps?.some(step=>step.id===t.id)?'<option value="16" '+(t.npcId===16?'selected':'')+'>'+esc(name(16))+' · 临时伙伴</option>':'')+'</select></label>'+(t.npcId===-1?'<button class="primary" data-plan-do="'+t.id+'" '+(t.status!=='queued'?'disabled':'')+'>去'+(RECIPE_BY_ID[ITEM_BY_ID[t.targetItem].recipeId]?'制作':'采集')+'</button>':'')+'</div>':'')+'</li>';
   }).join('')+'</ol>':'<p class="plan-help">现有库存已满足清单，无需派出额外任务。</p>')+
   '<div class="plan-controls">'+(p.status==='ready'?button('finish','完成筹备 · 物资入库','primary'):'')+(active?(p.status==='paused'?button('resume','继续筹备'):button('pause','暂停'))+button('cancel','取消计划'):'')+'</div><details class="plan-history" data-project-history="'+p.id+'"><summary>筹备记录 · '+p.history.length+' 条'+(p.runId?' · 已绑定 Hermes 运行':'')+'</summary>'+p.history.slice(-8).reverse().map(h=>'<p>第 '+h.day+' 天 · '+esc(h.text)+'</p>').join('')+'</details></article>';
  }).join('')||'<div class="plan-empty">清单还空着。写下需要准备的物资，和伙伴一起开始。</div>';
  const expanded=new Set([...root.querySelectorAll('[data-project-history][open]')].map(el=>el.dataset.projectHistory)),body=root.closest('.modal-body'),top=body.scrollTop;root.innerHTML=html;for(const el of root.querySelectorAll('[data-project-history]'))if(expanded.has(el.dataset.projectHistory))el.open=true;body.scrollTop=top;
  root.querySelectorAll('[data-plan-action]').forEach(b=>{b.disabled=managing;b.onclick=()=>manageControl(b.dataset.plan,b.dataset.planAction)});
  root.querySelectorAll('[data-plan-assignee]').forEach(el=>{el.disabled=managing;el.onchange=()=>manageControl(el.dataset.planAssignee,'assign',Number(el.value))});
  root.querySelectorAll('[data-plan-do]').forEach(b=>b.onclick=()=>{const step=state().agentTaskLedger.find(t=>t.id===b.dataset.planDo),t=step&&playerProjectTask(state(),step.targetItem,step.id);if(!t||t.id!==step.id){toast('前置物资尚未齐备，请查看最新进度');paint(true);return}const item=ITEM_BY_ID[t.targetItem],recipe=RECIPE_BY_ID[item.recipeId];recipe?craft(recipe,t.id):gather(item)});
 }
 async function manageControl(id,action,npcId){if(managing)return;managing=true;paint(true);try{const r=await manage(id,action,npcId);if(!r.ok)toast(r.reason);persist();}catch(e){toast(e.message)}finally{managing=false;paint(true)}}
 return {open,paint};
}
