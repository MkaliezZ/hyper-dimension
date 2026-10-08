import {MAX_IMPORT_BYTES} from './saveLimits.js';
import {setRecoveryDialog} from './actionRecoveryUI.js';
import {modalNavigationToken} from './modalNavigation.js';
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const labels={automatic:'自动备份',manual:'手动备份',migration:'浏览器旧档',new:'初次登岛','before-restart':'归零前备份','before-restore':'恢复前备份',recovery:'故障恢复',restore:'恢复存档',restart:'从零重开',import:'导入存档','before-import':'导入前备份'};
const origins={'server-new':'由本机服务创建的新岛','legacy-browser':'经确认导入的浏览器旧档','local-export':'经确认导入的本机签名备份','local-checkpoint':'恢复自本机历史备份','external-state':'经确认导入的普通存档，来源未验证','legacy-export':'经确认导入的旧版备份，来源未验证','foreign-export':'经确认导入的另一安装环境备份'};
export function createSaveUI({saves,theme,openModal,toast}){
 function recoveryModal(...args){openModal(...args);setRecoveryDialog(true);}
 const summary=(s,title)=>'<section class="save-source-card"><h3>'+esc(title)+'</h3><p>'+esc(s?.name||'岛主')+' · '+esc(s?.island||'小岛')+'</p><dl><div><dt>游戏日期</dt><dd>第 '+esc(s?.day??'—')+' 天</dd></div><div><dt>岛币</dt><dd>'+esc(s?.coins??'—')+'</dd></div><div><dt>物品总数</dt><dd>'+esc(s?.goods??'—')+'</dd></div></dl></section>';
 async function previewFile(style,data,label,migrationId,token){
  try{
   const p=await saves.previewImport(style,data,{migrationId});
   if(!token.current()){saves.cancelImportPreview(style);return;}
   recoveryModal('确认导入小岛进度',p.origin.label,
    '<section data-save-import-preview="'+p.id+'"><p>文件：'+esc(label)+'</p><div class="save-source-comparison">'+summary(p.current,'当前服务端进度')+summary(p.summary,'将导入的进度')+'</div>'+
    (p.allowed?'<p class="hint">确认后会先备份当前进度，再替换当前画风的存档。进行中的采集、制作和筹备任务会结束；已持有物品按文件内容恢复。预览有效期为 15 分钟。</p>':'<p class="hint">'+esc(p.blockReason)+'</p>')+'</section>',
    '<button class="secondary" id="cancelImport">返回存档</button>'+(p.allowed?'<button class="primary" id="confirmImport">确认导入并重新进入</button>':''));
   const root=document.querySelector('#modalRoot'),navigation=modalNavigationToken();
   // Closing or navigating away releases the preview pause, including Escape/overlay close.
   const observer=new MutationObserver(()=>{if(!root.querySelector('[data-save-import-preview="'+p.id+'"]')){saves.cancelImportPreview(style);observer.disconnect();}});
   observer.observe(root,{childList:true,subtree:true});
   root.querySelector('#cancelImport').onclick=show;
   const confirm=root.querySelector('#confirmImport');
   if(confirm)confirm.onclick=async()=>{confirm.disabled=true;try{await saves.importSave(style,p);}catch(error){toast(error.message);if(navigation.current())show();}};
  }catch(error){toast(error.message);}
 }
 async function show(){
  const style=theme();saves.cancelImportPreview(style);const s=saves.status(style);
  recoveryModal('小岛存档','本机服务保存 · 浏览器缓存 · 历史可恢复',
   '<section class="journal-opening"><h3>'+esc(s.message)+'</h3><p>游戏运行时，每约 5 秒自动写入本机服务。每 5 分钟保留一份历史备份，重开、恢复和手动备份会单独保留。</p><p>关闭网页不会计算离线天数。换浏览器或清理网页缓存后，会从本机服务继续进度。</p><p>存档来源：'+esc(origins[s.provenance?.origin]||'历史版本存档，未记录来源')+'。</p></section>'+
   (s.migration?'<section class="hint save-migration"><h3>发现保留的浏览器旧档</h3><p>第 '+esc(s.migration.summary.day)+' 天 · '+esc(s.migration.summary.coins)+' 岛币 · '+esc(s.migration.summary.goods)+' 件物品。当前新岛没有自动继承旧档资源。</p><button class="secondary" id="previewMigration">查看旧档导入预览</button><a class="secondary" href="/api/saves/'+style+'/migration-export" download>下载原始旧档</a></section>':'')+
   (s.status==='import_pending'?'<div class="hint"><b>导入结果尚待核对，游戏已暂停。</b><p>已保留这次确认编号。重试会读取同一次导入结果。</p><button class="primary" id="retrySaveImport">核对导入并继续</button></div>':'')+
   (s.status==='blocked'&&s.message.includes('正在会客')?'<div class="hint"><p>本岛生产已暂停，随行身份和已有进度保留。</p><a class="primary" href="/">返回正在进行的会客</a></div>':'')+
   (s.status==='conflict'?'<div class="hint"><b>当前暂存与服务端已确认的记录不一致，游戏已暂停。</b><p>当前窗口的暂存没有覆盖服务端。可以先导出暂存，再读取服务端进度。</p><button class="secondary" id="exportPending">导出当前暂存</button><button class="primary" id="acceptServerSave">读取服务端进度</button></div>':'')+
   '<p><label class="secondary">导入备份文件 <input id="importSaveFile" type="file" accept=".json,application/json" aria-label="选择存档备份文件"></label></p><h3>历史备份</h3><div id="saveHistory"><p>正在读取备份…</p></div>',
   '<button class="primary" id="saveNow">立即保存</button><button class="secondary" id="backupNow">创建备份</button><a class="secondary" href="/api/saves/'+style+'/export" download>导出服务端存档</a>');
  const root=document.querySelector('#modalRoot'),token=modalNavigationToken();
  root.querySelector('#importSaveFile').onchange=async event=>{
   const file=event.target.files?.[0];if(!file)return;
   try{if(file.size>MAX_IMPORT_BYTES)throw Error('备份文件超过 64 MiB 容量上限');const data=JSON.parse(await file.text());if(token.current())await previewFile(style,data,file.name,null,token);}
   catch(error){toast(error.message);}
  };
  const act=(id,fn)=>{const b=root.querySelector('#'+id);if(b)b.onclick=async()=>{b.disabled=true;try{await fn()}catch(error){toast(error.message)}finally{if(b.isConnected)b.disabled=false}}};
  act('previewMigration',()=>previewFile(style,null,'本机保留的浏览器旧档',s.migration.id,token));
  act('retrySaveImport',()=>saves.retryImport(style));
  act('saveNow',async()=>{await saves.flush(style);toast('进度已写入本机服务');if(token.current())show()});
  act('backupNow',async()=>{await saves.backup(style);toast('已创建可恢复的存档备份');if(token.current())show()});
  act('acceptServerSave',()=>saves.acceptServer(style));
  act('exportPending',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(s.state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='hyper-dimension-'+style+'-pending.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  try{
   const rows=await saves.backups(style),list=root.querySelector('#saveHistory');if(!token.current()||!list)return;
   list.innerHTML=rows.length?rows.map(row=>'<div class="budget-card"><b>'+esc(labels[row.reason]||'历史备份')+' · 第 '+row.day+' 天</b><p>'+esc(new Date(row.updatedAt).toLocaleString())+' · '+row.coins+' 岛币</p><button class="secondary" data-restore-save="'+row.id+'">恢复此进度</button></div>').join(''):'<p>尚无历史备份，可点击「创建备份」。';
   for(const button of list.querySelectorAll('[data-restore-save]'))button.onclick=()=>{
    const row=rows.find(x=>x.id===button.dataset.restoreSave);
    recoveryModal('恢复第 '+row.day+' 天的进度','恢复前会自动备份当前服务端存档','<p>将回到 '+esc(new Date(row.updatedAt).toLocaleString())+' 保存的进度，岛币 '+row.coins+'。当前运行中的未保存动作不会写入该历史版本。</p>',
     '<button class="secondary" id="cancelRestore">返回存档</button><button class="primary" id="confirmRestore">恢复并重新进入</button>');
    const navigation=modalNavigationToken();document.querySelector('#cancelRestore').onclick=show;
    document.querySelector('#confirmRestore').onclick=async e=>{e.currentTarget.disabled=true;try{await saves.restore(style,row.id)}catch(error){toast(error.message);if(navigation.current())show()}};
   };
  }catch(error){const list=root.querySelector('#saveHistory');if(token.current()&&list)list.innerHTML='<p>'+esc(error.message)+'</p>';}
 }
 return {show};
}
