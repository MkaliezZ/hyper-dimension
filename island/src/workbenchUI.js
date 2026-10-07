import {esc} from './journeyUI.js';
const validId=/^capture-[a-f0-9]{32}$/;
const date=v=>new Date(v).toLocaleString('zh-CN',{timeZone:'Asia/Singapore',hour12:false});
const bytes=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';
export function artifactCard(v,compact=false){
 if(!validId.test(v?.id||''))return '';
 return '<article class="document-card'+(compact?' compact':'')+'" data-artifact-id="'+esc(v.id)+'"><span class="document-seal" aria-hidden="true">'+esc(String(v.format||'文件').toUpperCase())+'</span><div><small>已保存并回读 · v'+esc(v.version)+'</small><b>'+esc(v.name)+'</b><p>'+esc(v.path)+'</p><small>'+esc(date(v.capturedAt))+' · '+bytes(v.bytes)+(v.recovered?' · 运行未正常结束后的保存回执':'')+'</small></div><button type="button" class="secondary" data-document-preview="'+esc(v.id)+'">预览与下载 →</button></article>';
}
export function createWorkbenchUI({theme,openModal,back,toast}){
 let data=null,generation=0,busy=false,pending=null,tab='files',scope='project',page=0,mode='list',selected=null,offset=1,offsets=[1],detail=null,previewData=null,previewId=null;
 const $=id=>document.getElementById(id),root=()=>$('documentWorkbench');
 async function api(path='',body){
  const r=await fetch('/api/workbench/'+theme()+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(50000),cache:'no-store'}),d=await r.json();
  if(!r.ok)throw Object.assign(Error(d.error||'文档手账暂不可用'),{code:d.code});return d;
 }
 function shell(title,subtitle,footer){
  generation++;busy=false;openModal(title,subtitle,'<div id="documentWorkbench"><p class="document-note">正在翻开本机手账…</p></div>',footer);
  document.querySelector('#modalRoot .modal').classList.add('document-workbench-modal');
 }
 function open(){
  tab='files';scope='project';page=0;mode='list';selected=null;pending=null;
  shell('管家 · 文档与项目','保存过的文件、每次修改的版本，以及下次继续工作的线索。','<button class="secondary" id="documentBack">返回对话</button><button class="secondary" id="documentRefresh">重新读取</button>');
  $('documentBack').onclick=back;$('documentRefresh').onclick=()=>refresh();void refresh();
 }
 async function refresh(){
  const node=root(),g=generation;if(!node||busy)return;
  try{const d=await api();if(g!==generation||root()!==node)return;data=d;if(!d.activeId)scope='all';if(mode==='editor')selected=d.projects.find(p=>p.id===selected?.id)||null;paint()}
  catch(e){if(g===generation&&root()===node)node.innerHTML='<section class="document-empty"><h3>手账暂时没能打开</h3><p>'+esc(e.message)+'</p><p>原文档和已有快照会保留，点击“重新读取”再试。</p></section>'}
 }
 function projectRows(){
  return data.projects.map(p=>'<article class="document-project '+(p.id===data.activeId?'current':'')+'"><div><small>'+(p.id===data.activeId?'当前工作项目':p.status==='archived'?'已归档':'可继续')+' · v'+p.version+'</small><h3>'+esc(p.name)+'</h3><p>'+esc(p.goal||'还没有填写目标')+'</p><small>修改于 '+esc(date(p.updatedAt))+'</small></div><div class="document-actions"><button class="secondary" data-project-edit="'+esc(p.id)+'">目标与纪要</button>'+(p.status==='active'?(p.id!==data.activeId?'<button class="primary" data-project-action="select" data-project-id="'+esc(p.id)+'">切换到此项目</button>':'')+'<button class="secondary" data-project-action="archive" data-project-id="'+esc(p.id)+'">归档</button>':'<button class="secondary" data-project-action="reopen" data-project-id="'+esc(p.id)+'">重新启用</button>')+'</div></article>').join('');
 }
 function paint(){
  const node=root();if(!node||!data)return;
  const current=data.projects.find(p=>p.id===data.activeId);
  if(mode==='editor'){paintEditor();return}
  node.innerHTML='<div class="document-tabs" role="tablist"><button role="tab" id="documentFilesTab" aria-selected="'+(tab==='files')+'">文档成果</button><button role="tab" id="documentProjectsTab" aria-selected="'+(tab==='projects')+'">工作项目</button></div>'+
   '<section class="document-current"><span class="document-mark" aria-hidden="true">◇</span><div><small>本画风当前项目</small><b>'+esc(current?.name||'尚未选择工作项目')+'</b><p>'+esc(current?.goal||'先建立目标与纪要，下一次手动委托可以接着做。')+'</p></div><button class="secondary" id="documentCurrentEdit">'+(current?'编辑纪要':'建立项目')+'</button></section>'+
   '<p class="document-note">在管家对话中勾选“使用当前项目资料”后，手动委托会把目标、纪要和最近六份文件路径经 Hermes 发送给 DeepSeek Flash。默认关闭，自动巡查不发送这些工作资料。两种画风共享成果与项目，各自保留当前项目选择。</p>'+
   (data.warnings?.length?'<p class="document-warning">有 '+data.warnings.length+' 份快照尚未通过核验，未显示为已确认成果。原文件仍保留。</p>':'')+
   (tab==='projects'?'<div class="document-section-head"><h3>工作项目 · '+data.projects.length+'</h3><button class="primary" id="documentCreate">新建项目</button></div><div class="document-projects">'+(projectRows()||'<section class="document-empty"><h3>把一件事记下来</h3><p>填写目标和阶段纪要，重启后仍能找到。归档保留项目、纪要历史与文件。</p></section>')+'</div>':fileRows())+
   '<p class="document-note">成果以实际文件保存、回读和版本快照为依据。对话中的文件名不会自动成为成果；浏览器记录清空后，手账仍从本机磁盘读取。</p>';
  $('documentFilesTab').onclick=()=>{tab='files';page=0;paint()};$('documentProjectsTab').onclick=()=>{tab='projects';paint()};
  $('documentCurrentEdit').onclick=()=>edit(current||null);
  if($('documentCreate'))$('documentCreate').onclick=()=>edit(null);
  node.querySelectorAll('[data-project-edit]').forEach(b=>b.onclick=()=>edit(data.projects.find(p=>p.id===b.dataset.projectEdit)));
  node.querySelectorAll('[data-project-action]').forEach(b=>b.onclick=()=>mutate({action:b.dataset.projectAction,id:b.dataset.projectId,expectedVersion:data.projects.find(p=>p.id===b.dataset.projectId).version}));
  node.querySelectorAll('[data-document-preview]').forEach(b=>b.onclick=()=>preview(b.dataset.documentPreview));
  if($('documentScope'))$('documentScope').onchange=e=>{scope=e.target.value;page=0;paint()};
  if($('documentPrevious'))$('documentPrevious').onclick=()=>{page--;paint()};
  if($('documentNext'))$('documentNext').onclick=()=>{page++;paint()};
  node.closest('.modal-body').scrollTop=0;
 }
 function fileRows(){
  const rows=scope==='all'?data.artifacts:data.projectArtifacts,pages=Math.max(1,Math.ceil(rows.length/16));page=Math.min(page,pages-1);
  return '<div class="document-section-head"><h3>已确认的成果</h3><select id="documentScope" aria-label="成果范围"><option value="project" '+(scope==='project'?'selected':'')+'>当前项目</option><option value="all" '+(scope==='all'?'selected':'')+'>全部成果</option></select></div>'+
   '<p class="document-note">'+rows.length+' 份文件 · 共 '+data.totalVersions+' 个版本 · 快照 '+bytes(data.snapshotBytes)+'</p>'+
   '<div class="document-cards">'+(rows.slice(page*16,page*16+16).map(v=>artifactCard(v)).join('')||'<section class="document-empty"><div class="document-empty-paper" aria-hidden="true"></div><h3>'+(scope==='project'?'这份项目还没有文档成果':'还没有保存过文档成果')+'</h3><p>给管家文件路径和具体需求。只有保存并回读成功的文档，才会出现在这里。</p></section>')+'</div>'+
   (pages>1?'<div class="document-pagination"><button class="secondary" id="documentPrevious" '+(page===0?'disabled':'')+'>上一页</button><span>'+(page+1)+' / '+pages+'</span><button class="secondary" id="documentNext" '+(page+1>=pages?'disabled':'')+'>下一页</button></div>':'');
 }
 function edit(p){mode='editor';selected=p;pending=null;paintEditor()}
 function paintEditor(){
  const p=selected,archived=p?.status==='archived';
  root().innerHTML='<div class="document-section-head"><h3>'+(p?'项目目标与纪要':'建立工作项目')+'</h3><button class="secondary" id="documentEditorBack">返回项目列表</button></div>'+
   '<form id="documentProjectForm" class="document-project-form"><label>项目名称 <small>最多60字</small><input id="documentProjectName" maxlength="60" required value="'+esc(p?.name||'')+'" '+(archived?'readonly':'')+'></label>'+
   '<label>本次要完成的目标 <small>最多1000字</small><textarea id="documentProjectGoal" maxlength="1000" rows="3" '+(archived?'readonly':'')+'>'+esc(p?.goal||'')+'</textarea></label>'+
   '<label>阶段纪要 <small>最多4000字</small><textarea id="documentProjectNotes" maxlength="4000" rows="8" placeholder="当前进展、已确认决定、下一步和需要继续查看的文件…" '+(archived?'readonly':'')+'>'+esc(p?.notes||'')+'</textarea></label>'+
   '<p class="document-note">纪要由你保存，不会把模型说“完成”自动写成完成。管家继续工作时仍需读取原文件；正文预览对应保存当时的快照。</p>'+
   '<div class="document-actions"><button class="primary" id="documentProjectSave" type="submit" '+(archived?'disabled':'')+'>'+(p?'保存目标与纪要':'创建并选为当前项目')+'</button><span id="documentSaveNote">'+(archived?'已归档，只读；返回列表可重新启用':p?'本机版本 v'+p.version:'还未保存')+'</span></div></form>'+
   (p?.history?.length?'<details class="document-history"><summary>纪要修改记录 · 最近 '+p.history.length+' 次</summary>'+[...p.history].reverse().map(h=>'<article><small>v'+h.version+' · '+esc(date(h.at))+'</small><h4>'+esc(h.name)+'</h4><p>'+esc(h.goal)+'</p><pre>'+esc(h.notes)+'</pre></article>').join('')+'</details>':'');
  root().closest('.modal-body').scrollTop=0;
  $('documentEditorBack').onclick=()=>{mode='list';tab='projects';selected=null;paint()};
  $('documentProjectForm').onsubmit=e=>{e.preventDefault();if(archived)return;const name=$('documentProjectName').value.trim();if(!name){toast('请先填写项目名称');return}void mutate({action:p?'update':'create',...(p?{id:p.id,expectedVersion:p.version}:{}),name,goal:$('documentProjectGoal').value,notes:$('documentProjectNotes').value})};
 }
 async function mutate(input){
  if(busy)return;const node=root(),g=generation;if(!node)return;
  const signature=JSON.stringify(input);if(pending?.signature!==signature)pending={signature,requestId:crypto.randomUUID()};
  const controls=[...node.querySelectorAll('button,input,textarea,select'),$('documentBack'),$('documentRefresh')].filter(Boolean),before=controls.map(b=>b.disabled);
  busy=true;controls.forEach(b=>b.disabled=true);if($('documentSaveNote'))$('documentSaveNote').textContent='正在保存，等待本机确认…';
  try{const d=await api('/project',{...input,requestId:pending.requestId});if(g!==generation||root()!==node)return;data=d;pending=null;mode='list';tab='projects';paint();toast('工作项目已保存到本机')}
  catch(e){if(g===generation&&root()===node){toast(e.message);if($('documentSaveNote'))$('documentSaveNote').textContent='保存尚未确认，可以重试';if(e.code==='project_conflict'){busy=false;pending=null;mode='list';tab='projects';await refresh()}}}
  finally{if(g===generation&&root()===node){busy=false;controls.forEach((b,i)=>{if(b.isConnected)b.disabled=before[i]})}}
 }
 function preview(id){
  if(!validId.test(id||''))return;mode='preview';detail=null;previewData=null;offset=1;offsets=[1];
  shell('管家 · 文档版本预览','保存当时的正文与原文件，随时可以回看。','<button class="secondary" id="documentPreviewBack">返回成果手账</button><button class="secondary" id="documentPreviewRetry">重新读取</button><a class="primary document-download disabled" id="documentDownload" aria-disabled="true">下载此版本原文件</a>');
  $('documentPreviewBack').onclick=open;previewId=id;$('documentPreviewRetry').onclick=()=>loadPreview(previewId,offset);void loadPreview(id,1);
 }
 async function loadPreview(id,line){
  const node=root(),g=generation;if(!node||busy)return;busy=true;previewId=id;offset=line;$('documentPreviewRetry').disabled=true;const download=$('documentDownload');download.classList.add('disabled');download.setAttribute('aria-disabled','true');download.removeAttribute('href');node.querySelectorAll('button,select').forEach(el=>el.disabled=true);
  try{const d=await api('/artifact/'+id+'/preview?offset='+line);if(g!==generation||root()!==node)return;detail=d.metadata;previewData=d.preview;offset=line;paintPreview();const a=$('documentDownload');a.href='/api/workbench/'+theme()+'/artifact/'+id+'/download';a.download=detail.name;a.classList.remove('disabled');a.setAttribute('aria-disabled','false')}
  catch(e){if(g===generation&&root()===node)node.innerHTML='<section class="document-empty"><h3>此版本暂时无法预览</h3><p>'+esc(e.message)+'</p><p>没有用对话文本代替文件内容。快照校验通过后才能下载。</p></section>'}
  finally{if(g===generation&&root()===node){busy=false;$('documentPreviewRetry').disabled=false}}
 }
 function paintPreview(){
  const v=detail,p=previewData;
  root().innerHTML='<div class="document-preview-head"><span class="document-seal" aria-hidden="true">'+esc(v.format.toUpperCase())+'</span><div><h3>'+esc(v.name)+'</h3><p>'+esc(v.path)+'</p><small>v'+v.version+' · '+esc(date(v.capturedAt))+' · '+bytes(v.bytes)+'</small></div></div>'+
   '<label class="document-version-label">选择保存版本<select id="documentVersion">'+v.versions.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===v.id?'selected':'')+'>v'+x.version+' · '+esc(date(x.capturedAt))+'</option>').join('')+'</select></label>'+
   '<p class="document-note">正文预览保留文字、表格单元格和公式；完整排版、图片及原始格式请下载原文件。这里只预览保存当时的版本，外部修改原文档不会改写此快照。</p>'+
   '<pre class="document-preview-content" aria-label="文档正文预览">'+esc(p.content||'（文档暂无可提取正文）')+'</pre>'+
   '<div class="document-pagination"><button class="secondary" id="documentPreviewPrevious" '+(offsets.length===1?'disabled':'')+'>上一段</button><span>'+offset+'–'+Math.min(p.totalLines,offset+119)+' / '+p.totalLines+' 行</span><button class="secondary" id="documentPreviewNext" '+(!p.nextOffset?'disabled':'')+'>下一段</button></div>'+
   (p.charactersTruncated?'<p class="document-warning">本段文字较长，预览已截取；下载原文件可查看完整内容。</p>':'')+
   '<details class="document-proof"><summary>实际保存记录</summary><p>工具 '+esc(v.tool)+' · '+(v.recovered?'已核验中断后的保存回执':'文件已保存并回读')+'</p><p>运行 '+esc(v.runId)+'</p><p>SHA-256 '+esc(v.sha256)+'</p></details>';
  root().closest('.modal-body').scrollTop=0;
  $('documentVersion').onchange=e=>{offsets=[1];void loadPreview(e.target.value,1)};
  $('documentPreviewPrevious').onclick=()=>{offsets.pop();void loadPreview(v.id,offsets.at(-1))};
  $('documentPreviewNext').onclick=()=>{offsets.push(p.nextOffset);void loadPreview(v.id,p.nextOffset)};
 }
 return {open,preview};
}
