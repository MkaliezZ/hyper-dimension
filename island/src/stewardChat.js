import {artifactCard} from './workbenchUI.js';
import {esc} from './journeyUI.js';
import {journeyBrief} from './journey.js';
export function hydrateChat(s){
 s.stewardChat??={messages:[],draft:'',sequence:0};
 const c=s.stewardChat;c.messages??=[];c.draft??='';c.sequence??=0;return c;
}
export function chatHistory(s){return hydrateChat(s).messages.filter(m=>m.status==='sent'&&m.role==='user'||m.status==='done'&&m.role==='assistant').slice(-12).map(m=>({role:m.role,content:((m.source==='local'?'[本地手账，未连接模型] ':'')+m.text).trim().slice(0,1400)}));}
export function createStewardChat({state,profile,portrait,openModal,persist,checkpoint,request,recover,edit,appearance,guide,health,manageTask,projects,recruit,party,workbench,previewArtifact}){
 let pending=null,followTail=true,resizeObserver=null;const taskBusy=new Set();let taskMessage='';
 const $=id=>document.getElementById(id);
 function init(){const c=hydrateChat(state());if(!pending)for(const m of c.messages)if(m.status==='pending'&&(!recover||!/^[-A-Za-z0-9]{8,100}$/.test(m.requestId||''))){m.status='error';m.text='这条旧对话没有可核对的委托编号，请先查看文档成果再决定是否重试。'}return c}
 function open(){
  resizeObserver?.disconnect();
  const c=init(),r=profile(),brief=journeyBrief(state());
  const body='<div class="steward-chat-layout"><aside class="steward-companion">'+portrait()+'<div class="steward-guide"><small>手账里的下一步</small><b>'+esc(brief.step)+'</b><p>'+esc(brief.guidance)+'</p><button class="secondary" id="stewardGuide">打开手账 →</button></div><details class="steward-task-panel" open><summary>正在替你做的事</summary><div id="stewardTasks"></div></details></aside><section class="steward-thread"><div class="steward-thread-top"><span><i></i> 与 '+esc(r.name)+' 的对话</span><small id="hermesHealth">'+esc(health().hermes)+'</small><button class="secondary" id="stewardWorkbench" type="button">文档成果与工作项目 ↗</button></div><div id="stewardMessages" class="steward-messages" role="log" aria-label="与管家的对话记录" aria-live="polite"></div><div class="steward-suggestions"><button data-steward-prompt="我现在最适合做什么？请结合手账告诉我下一步。">下一步做什么</button><button data-steward-prompt="帮我办一场星灯夜集，请观察当前夜集手账，建立活动和实际物资筹备清单，关键邀请由我亲自完成。">一起准备夜集</button><button data-steward-prompt="帮我办一场花园海风主题的钓鱼小聚，请观察当前手账，推荐一位适合的主题嘉宾，并建立活动与物资筹备。关键邀请由我亲自完成。">一起办钓鱼小聚</button><button data-steward-prompt="帮我办一场手作与星空主题的海岛集市，请观察当前集市手账，保留三位必要摊主，推荐合适嘉宾并建立活动和实际物资清单。邀请由我亲自完成。">一起办手作集市</button><button data-steward-prompt="刚才安排的任务进展如何？哪些还没完成？">问问任务进展</button></div><form id="stewardForm" class="steward-composer"><div class="steward-compose-fields"><label for="hermesInput">写给 '+esc(r.name)+'</label><textarea id="hermesInput" rows="2" maxlength="1000" placeholder="聊小岛事务，或写下本机文件路径和需要完成的修改…">'+esc(c.draft)+'</textarea><div id="stewardResumeContext"></div><label class="steward-project-consent"><input id="stewardProjectConsent" type="checkbox" '+(c.includeWorkProject?'checked':'')+'> 手动委托使用当前项目资料<small>将目标、纪要和最近六份文件路径经 Hermes 发送给 DeepSeek Flash。</small></label></div><div class="steward-compose-actions"><small>Enter 寄出 · Shift + Enter 换行</small><button class="primary" id="hermesSend" type="submit">寄出 →</button></div></form></section></div>';
  openModal(esc(r.name)+' · 你的随行管家','小岛筹备与本机文档，都可以直接交给我。',body,(window.hdPersonalSteward?.bridge?'<button class="secondary" id="stewardDevice">连接原机</button>':'')+'<button class="primary" id="stewardProjects">协作筹备</button><button class="secondary" id="stewardRecruit">招聘伙伴</button><button class="secondary" id="stewardParty">活动手账</button><button class="secondary" id="stewardProfile">管家档案</button><button class="secondary" id="stewardAppearance">更换形象</button><button class="secondary" id="stewardClear">清空对话</button><span class="steward-storage">对话跟随这座小岛保存 · 切换画风保留记录</span>');
  document.querySelector('#modalRoot .modal').classList.add('steward-conversation-modal');
  if(window.hdPersonalSteward){const link=document.createElement('button');link.className='secondary';link.id='stewardTravelHistory';link.textContent='随行对话与成果 ↗';link.onclick=()=>window.hdPersonalSteward.open();document.querySelector('.steward-thread-top').append(link);}
  if($('stewardDevice'))$('stewardDevice').onclick=()=>window.hdPersonalSteward.bridge.open();
  $('stewardWorkbench').onclick=workbench;$('stewardProjects').onclick=projects;$('stewardParty').onclick=()=>party();$('stewardRecruit').onclick=recruit;$('stewardProfile').onclick=edit;$('stewardAppearance').onclick=appearance;$('stewardGuide').onclick=guide;
  $('stewardClear').onclick=()=>{if(pending)return;const c=hydrateChat(state());if(c.messages.length){c.messages=[];delete c.resumeSessionId;delete c.resumeTitle;persist();paint(true)}};
  $('stewardProjectConsent').onchange=e=>{hydrateChat(state()).includeWorkProject=e.target.checked;persist()};
  $('stewardForm').onsubmit=e=>{e.preventDefault();send()};
  $('hermesInput').oninput=e=>{hydrateChat(state()).draft=e.target.value;persist()};
  $('hermesInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!pending)send()}};
  document.querySelectorAll('[data-steward-prompt]').forEach(b=>b.onclick=()=>{const text=b.dataset.stewardPrompt;hydrateChat(state()).draft=text;$('hermesInput').value=text;$('hermesInput').focus();persist()});
  $('stewardMessages').onscroll=()=>{const el=$('stewardMessages');followTail=el.scrollHeight-el.scrollTop-el.clientHeight<70};
  followTail=true;paint(true);resizeObserver=new ResizeObserver(()=>{if(followTail&&$('stewardMessages'))$('stewardMessages').scrollTop=$('stewardMessages').scrollHeight});resizeObserver.observe($('stewardMessages'));
 }
 function taskHTML(ids=null){
  const all=(state().agentTaskLedger||[]).filter(t=>!t.projectId&&(!ids||ids.includes(t.id)));
  const rows=ids?all:[...all.filter(t=>['queued','running','waiting','paused'].includes(t.status)),...all.filter(t=>!['queued','running','waiting','paused'].includes(t.status)).slice(-5).reverse()];
  return rows.length?rows.map(t=>{
   const active=['queued','running','waiting'].includes(t.status),resumable=['paused','interrupted','failed'].includes(t.status)&&t.command;
   const button=(action,label)=>'<button type="button" class="secondary" data-task-id="'+esc(t.id)+'" data-task-action="'+action+'">'+label+'</button>';
   return '<div class="steward-task" data-task-status="'+esc(t.status)+'"><span class="task-dot"></span><div><b>'+esc(t.name)+' · '+esc(({queued:'已排队',running:'执行中',waiting:'等候前置',paused:'已暂停',done:'已完成',cancelled:'已取消',interrupted:'已中断',replaced:'已改派'})[t.status]||'进行中')+'</b><p>'+esc(t.intent)+'</p>'+(t.quantity?'<small>实际完成 '+(t.completed||0)+' / '+t.quantity+' · '+(t.evidence?.length||0)+' 条动作回执</small>':'')+'<p>'+esc(t.result||'抵达目标并完成动作后记录产出')+'</p>'+(t.command?'<div class="task-controls">'+(t.projectId?'<button type="button" class="secondary" data-task-project="'+esc(t.projectId)+'">查看筹备手账</button>':(active?button('pause','暂停'):'')+(resumable?button('resume','继续'):'')+(active||t.status==='paused'?button('cancel','取消分工'):''))+'</div>':'')+'</div></div>';
  }).join(''):'<p class="steward-quiet">还没有委托。可以先聊聊你的计划。</p>';
 }
 function hostReceipts(message){
  const operations=message.operations;
  const labels={host_info:'查看本机目录',document_read:'读取文档',document_list:'查找文档',document_write:'保存文档',document_edit:'修改文档'};
  return '<details class="steward-host-receipts" data-host-receipt="'+message.id+'"'+(message.operationsOpen?' open=""':'')+'><summary>本机执行记录 · '+operations.length+' 步</summary>'+operations.map(op=>'<div><b>'+esc(labels[op.tool]||op.tool)+' · '+esc(({done:'已执行',failed:'未成功',unconfirmed:'未确认'})[op.status]||'未确认')+'</b>'+(op.path?'<p>'+esc(op.path)+'</p>':'')+'</div>').join('')+'</details>';
 }
 function paint(force=false){
  if(!$('stewardMessages'))return;const c=hydrateChat(state()),root=$('stewardMessages'),bottom=followTail;
  const html=c.messages.length?c.messages.map(m=>'<article class="steward-message '+m.role+' '+m.status+'" data-message-id="'+m.id+'"><small>'+esc(m.role==='user'?state().playerProfile.name:profile().name)+' · '+(m.status==='pending'?(m.receiptRecovery?'正在核对上次委托':'正在阅读与安排'):m.status==='error'?'未收到回复':m.source==='local'?'本地手账':m.role==='assistant'?'Hermes':'第 '+m.day+' 天')+'</small><div class="steward-message-text">'+(m.status==='pending'?'<span class="steward-thinking"><i></i><i></i><i></i></span><span>'+ (m.receiptRecovery?'正在读取原委托回执，不会重新调用模型或再次操作文档。':'正在处理你的委托；文档操作与岛内分工会显示实际执行结果。')+'</span>':esc(m.text))+'</div>'+(m.planResults?.length?'<div class="steward-receipts">'+m.planResults.map(p=>'<p>'+esc(p.title)+' · '+(p.ok?'计划已登记，请在「协作筹备」查看进度':esc(p.reason||'未能登记计划'))+'</p>').join('')+'</div>':'')+(m.partyResults?.length?'<div class="steward-receipts">'+m.partyResults.map(p=>'<p>'+esc(p.title||'活动方案')+' · '+(p.ok?'第 '+p.version+' 版已登记；'+esc(p.waiting)+(p.projectId?'。物资清单已展开':'。筹备清单：'+esc(p.preparation)):esc(p.reason||'未登记'))+'</p>'+(p.ok?'<button class="secondary" data-steward-party="'+esc(p.template||'fishing')+'">打开活动手账 →</button>':'')).join('')+'</div>':'')+(m.artifacts?.length?'<div class="steward-document-cards">'+m.artifacts.map(v=>artifactCard(v,true)).join('')+'</div>':'')+(m.artifactWarning?'<p class="document-warning">'+esc(m.artifactWarning)+'</p>':'')+(m.operations?.length?hostReceipts(m):'')+(m.status==='done'&&m.source==='hermes'&&m.nativeSession?.canResume?'<button type="button" class="secondary" data-steward-resume="'+m.id+'">继续这项工作 →</button>':'')+(m.commands?.length?'<div class="steward-receipts">'+taskHTML(m.commands.map(x=>x.id))+'</div>':'')+(m.status==='error'||m.source==='local'?'<button class="steward-retry" data-retry="'+m.id+'" '+(pending?'disabled':'')+'>重试这一条 →</button>':'')+'</article>').join(''):'<article class="steward-welcome"><small>一封写给你的便笺</small><h3>今天想让小岛发生什么？</h3><p>可以聊一件小事，也可以一起准备一场热闹的夜集。也可以给我本机文件路径，让我读取、整理和修改文档。我会记住这段对话，并告诉你实际执行结果。</p><p class="steward-quiet">从下方选一句话，或直接写给我。</p></article>';
  if(root.innerHTML!==html){root.innerHTML=html;if(bottom||force)root.scrollTop=root.scrollHeight}
  root.querySelectorAll('[data-host-receipt]').forEach(details=>{details.ontoggle=()=>{const message=hydrateChat(state()).messages.find(m=>m.id===Number(details.dataset.hostReceipt));if(message&&message.operationsOpen!==details.open){message.operationsOpen=details.open;persist();if(details.open&&followTail)root.scrollTop=root.scrollHeight}}});
  root.querySelectorAll('[data-steward-party]').forEach(b=>b.onclick=()=>party(b.dataset.stewardParty));
  root.querySelectorAll('[data-steward-resume]').forEach(b=>{b.disabled=!!pending;b.onclick=()=>{const current=hydrateChat(state()),m=current.messages.find(m=>m.id===Number(b.dataset.stewardResume));if(pending||!m?.nativeSession?.canResume)return;current.resumeSessionId=m.nativeSession.id;current.resumeTitle=m.request||m.text;persist();paint();$('hermesInput')?.focus();};});
  const resumeRoot=$('stewardResumeContext'),resumeHTML=c.resumeSessionId?'<div class="steward-resume-note"><b>接着这项工作继续</b><p>'+esc(String(c.resumeTitle||'此前的委托').slice(0,80))+'</p><small>会带入此前读取的内容和工具结果；下一步仍按当前文件核对。</small><button class="secondary" type="button" id="stewardResumeCancel">仅用普通对话</button></div>':'';if(resumeRoot&&resumeRoot.innerHTML!==resumeHTML)resumeRoot.innerHTML=resumeHTML;if($('stewardResumeCancel')){$('stewardResumeCancel').disabled=!!pending;$('stewardResumeCancel').onclick=()=>{if(pending)return;const current=hydrateChat(state());delete current.resumeSessionId;delete current.resumeTitle;persist();paint();};}
  root.querySelectorAll('[data-document-preview]').forEach(b=>b.onclick=()=>previewArtifact?.(b.dataset.documentPreview));
  document.querySelectorAll('[data-retry]').forEach(b=>b.onclick=()=>send(Number(b.dataset.retry)));
  const tasks=taskHTML();if($('stewardTasks').innerHTML!==tasks)$('stewardTasks').innerHTML=tasks;
  document.querySelectorAll('[data-task-project]').forEach(button=>button.onclick=projects);document.querySelectorAll('[data-task-action]').forEach(button=>{button.disabled=taskBusy.has(button.dataset.taskId);button.onclick=async()=>{const id=button.dataset.taskId;if(taskBusy.has(id))return;taskBusy.add(id);taskMessage='正在保存分工状态…';paint();try{const result=await manageTask?.(id,button.dataset.taskAction);taskMessage=result?.ok?'分工状态已保存。':result?.reason||'分工未改变';persist();}catch(e){taskMessage=e.message;}finally{taskBusy.delete(id);paint();}}});let taskStatus=$('stewardTaskStatus');if(!taskStatus&&$('stewardTasks')){taskStatus=document.createElement('p');taskStatus.id='stewardTaskStatus';taskStatus.className='plan-help';taskStatus.setAttribute('role','status');$('stewardTasks').after(taskStatus);}if(taskStatus)taskStatus.textContent=taskMessage;
  $('hermesSend').disabled=!!pending;$('hermesSend').textContent=pending?'等候回复…':'寄出 →';
  $('stewardClear').disabled=!!pending;
  if($('hermesHealth'))$('hermesHealth').textContent=health().hermes;
  if(!pending&&recover&&c.messages.some(m=>m.status==='pending'&&/^[-A-Za-z0-9]{8,100}$/.test(m.requestId||'')))queueMicrotask(recoverPending);
 }
 function applyReply(current,data){Object.assign(current,{text:String(data.answer||'本轮没有返回文本，请重试。'),status:data.answer?'done':'error',source:data.source||'local',commands:data.commands||[],planResults:data.planResults||[],partyResults:data.partyResults||[],operations:data.operations||[],artifacts:data.artifacts||[],artifactWarning:data.artifactWarning||null,ledgerRunId:data.ledgerRunId||null,nativeSession:data.session||null});delete current.receiptRecovery;const c=hydrateChat(state());if(current.resumeSessionId&&c.resumeSessionId===current.resumeSessionId&&data.session?.canResume)c.resumeSessionId=data.session.id;}
 async function recoverPending(){
  if(pending||!recover)return;const s=state(),m=hydrateChat(s).messages.find(m=>m.status==='pending'&&/^[-A-Za-z0-9]{8,100}$/.test(m.requestId||''));if(!m)return;
  const owner={state:s,id:m.id,recovery:true};pending=owner;m.receiptRecovery=true;persist();paint();
  const owns=()=>pending===owner&&state().saveSlot===s.saveSlot;
  const current=()=>hydrateChat(state()).messages.find(x=>x.id===m.id&&x.userId===m.userId&&x.requestId===m.requestId);
  try{const until=Date.now()+270000;while(owns()){
   const receipt=await recover(m.requestId);if(!owns())return;const next=current();if(!next)return;
   if(receipt?.status==='completed'&&receipt.result){applyReply(next,receipt.result);return;}
   if(!receipt||receipt.status!=='running')throw Error(receipt?.error||'没有找到这条委托的确认结果。请先检查文档成果，再决定是否发起新的工作。');
   if(Date.now()>=until)throw Error('原委托仍未确认，请先检查文档成果；恢复没有再次执行工具。');
   await new Promise(resolve=>setTimeout(resolve,1500));
  }}catch(e){if(owns()){const next=current();if(next){next.status='error';next.text=e.message;delete next.receiptRecovery;}}}
  finally{if(owns()){pending=null;persist();paint();}}
 }
 async function send(retryId=null){
  if(pending)return;
  const s=state(),c=hydrateChat(s),failed=retryId?c.messages.find(m=>m.id===retryId):null;
  const text=(failed?.request||$('hermesInput')?.value||'').trim();if(!text)return;
  const history=failed?chatHistory({...s,stewardChat:{...c,messages:c.messages.filter(m=>m.id<failed.userId)}}):chatHistory(s);
  let userId=failed?.userId;
  if(!failed){userId=++c.sequence;c.messages.push({id:userId,role:'user',text,status:'sent',day:s.day});c.draft='';if($('hermesInput'))$('hermesInput').value=''}
  if(failed){failed.status='superseded'}
  const freshLocal=failed?.source==='local'&&!(failed.operations||[]).some(o=>o.status!=='failed');
  const reply={includeWorkProject:failed&&!freshLocal?failed.includeWorkProject===true:c.includeWorkProject===true,resumeSessionId:failed?.resumeSessionId||(!failed?c.resumeSessionId:undefined),requestId:freshLocal?crypto.randomUUID():failed?.requestId||crypto.randomUUID(),id:++c.sequence,role:'assistant',text:'',request:text,userId,status:'pending',day:s.day};c.messages.push(reply);c.messages=c.messages.filter(m=>m.status!=='superseded').slice(-60);
  pending={state:s,id:reply.id};persist();paint(true);
  const ownsReply=()=>pending?.state===s&&pending?.id===reply.id&&state().saveSlot===s.saveSlot;
  const currentReply=()=>hydrateChat(state()).messages.find(m=>m.id===reply.id&&m.userId===userId&&m.request===text);
  let submitted=false;
  try{
   if(checkpoint)await checkpoint();
   if(!ownsReply())return;
   submitted=true;
   const data=await request(text,!!failed,history,{includeWorkProject:reply.includeWorkProject,requestId:reply.requestId,resumeSessionId:reply.resumeSessionId});
   if(!ownsReply())return;const current=currentReply();if(!current)return;
   applyReply(current,data);
  }catch(e){if(!ownsReply())return;const current=currentReply();if(!current)return;current.status='error';current.text=(submitted?'这一条还没有收到确认：':'进度尚未保存，委托没有寄出：')+e.message+'。已保留你的话。'}
  finally{if(ownsReply()){pending=null;persist();paint();}}
 }
 return {open,paint,reset:()=>{pending=null},busy:()=>!!pending};
}

