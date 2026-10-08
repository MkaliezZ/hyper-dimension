import {worldFetch as fetch} from './worldSession.js';
import {esc} from './journeyUI.js';
const names={resident_chat:'与居民自由聊天',plans:'居民生活规划',conversations:'居民交谈',steward:'管家自动巡查',steward_manual:'管家手动委托',recruitment:'管家与伙伴招聘',party_suggestion:'派对主题建议',legacy_plan:'居民规划'};
const phases={running:'正在运行',completed:'模型运行结束',late_completed:'迟到结果 · 未应用',failed:'运行失败',timed_out:'请求超时',interrupted:'运行中断',local_fallback:'本地备援 · 未调用模型'};
const fmt=v=>v===null||v===undefined?'未知':Number(v).toLocaleString('zh-CN');
const date=v=>new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false});
export function createRunManagementUI({openModal,back,projects,toast,onPolicyChange=()=>{}}){
 let data=null,busy=false,editing=false,generation=0,timer=null,filter='all',style='all',page=0,pending=null,version=null;
 const $=id=>document.getElementById(id),root=()=>$('runtimePanel');
 async function api(path,body){
  const r=await fetch('/api/admin/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000),cache:'no-store'}),d=await r.json();
  if(!r.ok)throw Object.assign(Error(d.error||'运行记录暂不可用'),{code:d.code});return d;
 }
 function open(){
  generation++;data=null;editing=false;busy=false;pending=null;page=0;filter='all';style='all';clearInterval(timer);
  openModal('自动活动与运行手账','真实的调用与回报，留在这台电脑。','<div id="runtimePanel"><p class="runtime-note">正在读取本机运行记录…</p></div>',
   '<button class="secondary" id="runtimeBack">返回后台</button><button class="secondary" id="runtimeRefresh">重新读取</button><button class="secondary" id="runtimeProjects">查看物资任务</button>');
  document.querySelector('#modalRoot .modal').classList.add('runtime-modal');
  $('runtimeBack').onclick=back;$('runtimeRefresh').onclick=()=>refresh(true);$('runtimeProjects').onclick=projects;
  void refresh(true);timer=setInterval(()=>{if(!root()){clearInterval(timer);return}if(!editing&&!busy)void refresh()},15000);
 }
 async function refresh(force=false){
  const captured=generation,node=root();if(!node||busy||editing&&!force)return;
  try{const result=await api('runtime');if(captured!==generation||root()!==node)return;data=result;if(force)editing=false;paint();}
  catch(e){if(captured!==generation||root()!==node)return;node.innerHTML='<div class="runtime-error"><b>运行记录暂时不可用</b><p>'+esc(e.message)+'</p><p>未使用缓存数字冒充实际用量。点击“重新读取”重试。</p></div>';}
 }
 function draft(){return $('runtimePaused')?{paused:$('runtimePaused').checked,dailyRunLimit:$('runtimeRunLimit').value,dailyTokenLimit:$('runtimeTokenLimit').value}:null}
 function runMarkup(r){
  const u=r.usage,known=u?.knownTotal??u?.total,label=r.providerStarted?(u?.total==null?'用量未完整回报':'已回报用量'):'未发给工作进程';
  const child=r.children?.filter(c=>c.parentId)||[];
  return '<details class="runtime-run" data-run-id="'+esc(r.id)+'"><summary><span class="runtime-state '+r.phase+'">'+esc(phases[r.phase]||r.phase)+'</span><span><b>'+esc(names[r.kind]||r.kind)+'</b><small>'+esc(date(r.startedAt))+' · '+(r.theme==='pixel'?'像素岛':r.theme==='origami'?'折纸岛':'通用')+' · '+(r.automatic?'自动':'手动')+'</small></span><span class="runtime-token">'+(u?.total!=null?fmt(u.total)+' token':!r.providerStarted?'未调用模型':known?fmt(known)+' 已知＋未知':'用量未知')+'</span></summary>'+
   '<article><p class="runtime-id">运行编号 '+esc(r.id)+'</p><div class="runtime-run-facts"><span>当前状态<b>'+esc(label)+'</b></span><span>输入 token<b>'+fmt(u?.input)+'</b></span><span>输出 token<b>'+fmt(u?.output)+'</b></span><span>客户端请求次数<b>'+fmt(u?.calls)+'</b></span><span>实际回报下限<b>'+fmt(known)+'</b></span><span>未回报请求<b>'+fmt(u?.unknownCalls)+'</b></span></div>'+
   (r.providerRunId?'<p class="runtime-id">Hermes 运行 '+esc(r.providerRunId)+'</p>':'')+
   (r.endedAt?'<p>结束 '+esc(date(r.endedAt))+'</p>':'')+
   (r.projectIds.length?'<p class="runtime-id">关联筹备 '+r.projectIds.map(esc).join('、')+'</p>':'')+
   (r.participants.length?'<p>参与角色编号 '+r.participants.join('、')+'（15为管家，16为临时伙伴）</p>':'')+
   (child.length?'<div class="runtime-lineage"><b>真实主子运行 · 已在本条汇总，不重复累计</b>'+child.map(c=>'<p class="runtime-id">'+esc(c.parentId)+' → '+esc(c.id)+'</p><p>子运行回报 '+fmt(c.usage?.total)+' token · '+fmt(c.usage?.calls)+' 次客户端请求</p>').join('')+'</div>':'')+
   (r.resultCode?'<p class="runtime-id">结果标记 '+esc(r.resultCode)+'</p>':'')+
   '<p class="runtime-note">本记录表示模型运行和实际回报；物资生产、交付和派对开场以游戏任务的实际进度为准。迟到结果仅记用量，不补应用到游戏。</p></article></details>';
 }
 function paint(preserve=false){
  const node=root();if(!node||!data)return;
  const oldDraft=preserve&&editing?draft():null,oldVersion=version,scroll=node.closest('.modal-body').scrollTop;
  const openIds=[...node.querySelectorAll('details[open]')].map(d=>d.dataset.runId),p=data.policy,t=data.today;
  version=oldDraft?oldVersion:p.version;
  const selected=data.runs.filter(r=>(filter==='all'||(filter==='automatic')===r.automatic)&&(style==='all'||r.theme===style)),pages=Math.max(1,Math.ceil(selected.length/25));page=Math.min(page,pages-1);
  node.innerHTML='<section class="runtime-overview"><span>今日自动启动<b>'+fmt(t.automaticRuns)+'</b></span><span>自动已回报 token<b>'+fmt(t.automaticTokens)+'</b></span><span>未完整回报的自动运行<b>'+fmt(t.automaticUnknownFinished)+'</b></span><span>今日手动启动<b>'+fmt(t.manualRuns)+'</b></span><span>全部已回报 token<b>'+fmt(t.knownTokens)+'</b></span><span>正在运行<b>'+fmt(t.inflight)+'</b></span></section>'+
   '<p class="runtime-note">'+esc(data.budgetDay)+' · UTC+8自然日，按运行启动日归账。两种画风共享限频与自动预算；游戏内一天仍为900秒有效时间。</p>'+
   '<section class="runtime-policy"><div class="runtime-section-head"><h3>自动活动</h3><span class="runtime-state '+(p.paused?'timed_out':'completed')+'">'+(p.paused?'已暂停新的自动调用':'自动活动开启')+'</span></div>'+
   '<p>生活规划间隔300秒 · 居民交谈600秒 · 管家巡查950秒。暂停只阻止新的自动模型调用；正在运行的请求会继续，本地生活和手动管家委托保持可用。</p>'+
   '<label class="runtime-toggle"><input id="runtimePaused" type="checkbox" '+((oldDraft?.paused??p.paused)?'checked':'')+'>暂停自动模型活动</label>'+
   '<div class="runtime-policy-fields"><label>每日自动启动次数上限<input id="runtimeRunLimit" type="number" min="1" max="1000000000" inputmode="numeric" placeholder="留空不限" value="'+esc(oldDraft?.dailyRunLimit??p.dailyRunLimit??'')+'"></label><label>每日自动已回报 token 上限<input id="runtimeTokenLimit" type="number" min="1" max="1000000000" inputmode="numeric" placeholder="留空不限" value="'+esc(oldDraft?.dailyTokenLimit??p.dailyTokenLimit??'')+'"></label></div>'+
   '<p class="runtime-note">达到上限后停止启动新的自动运行，UTC+8午夜更新额度。次数按自动启动尝试计；token只累计实际回报，未知和运行中用量可能使最终总量超过设定值。默认留空保持既有低频。暂停设置会保存，第二天不会自动解除。提高额度或恢复后会按既有间隔重新检查，不补发过去的调用。</p>'+
   '<div class="runtime-policy-actions"><button class="primary" id="runtimeApply" '+(busy?'disabled':'')+'>'+(busy?'正在保存…':'保存自动设置')+'</button><span id="runtimeSaveNote">'+(editing?'设置已改动，尚未保存':'设置 v'+p.version+' · 保存在本机')+'</span></div></section>'+
   '<section class="runtime-records"><div class="runtime-section-head"><h3>运行记录</h3><span>最近 '+data.retainedRuns+' / '+data.runLimit+' 条</span></div>'+
   '<div class="runtime-filters"><select id="runtimeFilter"><option value="all">自动与手动</option><option value="automatic">自动活动</option><option value="manual">手动委托</option></select><select id="runtimeStyle"><option value="all">两种画风与通用</option><option value="pixel">像素岛</option><option value="origami">折纸岛</option></select><button class="secondary" id="runtimeExport">导出运行记录</button></div>'+
   '<div class="runtime-list">'+(selected.slice(page*25,page*25+25).map(runMarkup).join('')||'<p class="runtime-empty">还没有符合条件的运行。正常使用 NPC 和管家后，这里会显示真实记录。</p>')+'</div>'+
   '<div class="runtime-pagination"><button class="secondary" id="runtimePrevious" '+(page===0?'disabled':'')+'>上一页</button><span>'+(page+1)+' / '+pages+'</span><button class="secondary" id="runtimeNext" '+(page+1>=pages?'disabled':'')+'>下一页</button></div>'+
   '<p class="runtime-note">记录不保存对话正文、文档内容或密钥。已回报用量不等同供应商账户账单；没有回报不能按零计算。客户端次数是创建调用次数，供应商内部重试未单独计数。</p></section>'+
   '<details class="runtime-settings-history"><summary>自动设置修改记录 · 最近 '+data.settingsHistory.length+' 次</summary>'+data.settingsHistory.map(h=>'<p>'+esc(date(h.at))+' · v'+h.before.version+' → v'+h.after.version+' · '+(h.after.paused?'暂停':'开启')+' · 次数 '+(h.after.dailyRunLimit??'不限')+' · token '+(h.after.dailyTokenLimit??'不限')+'</p>').join('')+'</details>';
  for(const id of ['runtimePaused','runtimeRunLimit','runtimeTokenLimit'])$(id).oninput=()=>{editing=true;$('runtimeSaveNote').textContent='设置已改动，尚未保存';};
  $('runtimeApply').onclick=apply;
  $('runtimeFilter').value=filter;$('runtimeStyle').value=style;
  $('runtimeFilter').onchange=e=>{filter=e.target.value;page=0;paint(true)};$('runtimeStyle').onchange=e=>{style=e.target.value;page=0;paint(true)};
  $('runtimePrevious').onclick=()=>{page--;paint(true)};$('runtimeNext').onclick=()=>{page++;paint(true)};
  $('runtimeExport').onclick=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='hyper-dimension-runs-'+data.budgetDay+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  node.querySelectorAll('details[data-run-id]').forEach(d=>d.open=openIds.includes(d.dataset.runId));node.closest('.modal-body').scrollTop=scroll;
 }
 async function apply(){
  if(busy||!data)return;
  const values=draft(),limit=v=>v.trim()===''?null:Number(v);
  const policy={paused:values.paused,dailyRunLimit:limit(values.dailyRunLimit),dailyTokenLimit:limit(values.dailyTokenLimit)};
  if(![policy.dailyRunLimit,policy.dailyTokenLimit].every(n=>n===null||Number.isSafeInteger(n)&&n>0&&n<=1000000000)){toast('上限填写正整数，留空为不限');return}
  const signature=JSON.stringify({policy,expectedVersion:version});if(pending?.signature!==signature)pending={signature,id:crypto.randomUUID()};
  const captured=generation,node=root(),button=$('runtimeApply');busy=true;button.disabled=true;button.textContent='正在保存…';$('runtimeSaveNote').textContent='正在写入本机，等待确认…';
  try{const result=await api('policy',{policy,expectedVersion:version,requestId:pending.id});if(captured!==generation||root()!==node)return;data=result;pending=null;editing=false;busy=false;paint();onPolicyChange(policy);toast(policy.paused?'自动活动已暂停，手动管家委托可用':'自动活动设置已保存');}
  catch(e){if(captured===generation&&root()===node){toast(e.message);$('runtimeSaveNote').textContent='保存结果尚未确认，请重试';if(e.code==='policy_conflict'){editing=false;busy=false;await refresh(true)}}}
  finally{busy=false;if(captured===generation&&root()===node&&button.isConnected){button.disabled=false;button.textContent='保存自动设置'}}
 }
 return {open};
}
