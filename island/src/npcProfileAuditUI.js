import {NPC_PROFILE_FIELDS,NPC_AUDIT_LIMIT,npcAuditEntries,hydrateNpcProfileAudit} from './npcProfileAudit.js';
import {RESIDENTS} from './world.js';
import {esc} from './journeyUI.js';
export function createNpcProfileAuditUI({state,openModal,edit,back}){
 const $=id=>document.getElementById(id);
 const time=at=>new Date(at).toLocaleString('zh-CN',{hour12:false});
 function open(npcId=null){
  const audit=hydrateNpcProfileAudit(state()),entries=npcAuditEntries(state(),npcId);
  const person=id=>({...RESIDENTS[id],...(state().npcProfiles?.[id]||{})});
  const title=npcId===null?'居民档案 · 修改记录':person(npcId).name+' · 修改记录';
  const options='<option value="all">全部居民与管家</option>'+RESIDENTS.map((r,i)=>'<option value="'+i+'" '+(npcId===i?'selected':'')+'>'+esc(person(i).name)+(i===15?' · 管家':'')+'</option>').join('');
  const rows=entries.map(e=>'<button class="npc-audit-row" data-audit-entry="'+e.id+'"><span class="npc-audit-seal">v'+e.version+'</span><span><b>'+esc(person(e.npcId).name)+'<small>'+esc(time(e.at))+' · 第 '+e.day+' 天</small></b><p>'+e.changed.map(k=>esc(NPC_PROFILE_FIELDS.find(f=>f.key===k).label)).join('、')+' · '+(e.source==='restore'?'采用历史内容':'岛主修改')+'</p></span><span aria-hidden="true">查看 ›</span></button>').join('');
  openModal(title,'每一次改动，都有来处。','<section class="npc-audit-summary"><span>累计记录 <b>'+audit.totalCount+'</b> 次</span><span>当前保留 <b>'+audit.entries.length+'</b> 条</span></section><p class="npc-audit-note">保留最近 '+NPC_AUDIT_LIMIT+' 条修改前后内容，与当前小岛的本地服务端存档一起保存。启用记录前的修改不追补；恢复旧存档也会恢复当时的记录。</p><label class="npc-audit-filter">查看谁的档案<select id="npcAuditFilter">'+options+'</select></label><div class="npc-audit-list">'+(rows||'<div class="npc-audit-empty"><b>还没有修改记录</b><p>保存有内容变化的档案后，第一条记录会出现在这里。</p></div>')+'</div>',
   '<button class="secondary" id="auditBack">返回后台</button>');
  document.querySelector('#modalRoot .modal').classList.add('npc-audit-modal');
  $('auditBack').onclick=back;$('npcAuditFilter').onchange=e=>open(e.target.value==='all'?null:Number(e.target.value));
  document.querySelectorAll('[data-audit-entry]').forEach(b=>b.onclick=()=>detail(b.dataset.auditEntry,npcId));
 }
 function detail(id,filter){
  const e=npcAuditEntries(state()).find(v=>v.id===id);if(!e){open(filter);return;}
  const body='<div class="npc-audit-detail"><div class="npc-audit-record-head"><span class="npc-audit-seal">v'+e.version+'</span><div><h3>'+esc(e.after.name)+'</h3><p>'+esc(time(e.at))+' · 第 '+e.day+' 天</p><p>版本 '+e.beforeVersion+' → '+e.version+' · '+(e.source==='restore'?'采用记录 '+esc(e.restoreFrom)+' 的内容':'岛主修改')+'</p></div></div>'+
   NPC_PROFILE_FIELDS.map(f=>'<section class="npc-audit-diff '+(e.changed.includes(f.key)?'is-changed':'')+'"><h4>'+esc(f.label)+(e.changed.includes(f.key)?'<span>已修改</span>':'')+'</h4><div><article><small>修改前 · v'+e.beforeVersion+'</small><p>'+esc(e.before[f.key]||'未填写')+'</p></article><article><small>修改后 · v'+e.version+'</small><p>'+esc(e.after[f.key]||'未填写')+'</p></article></div></section>').join('')+
   '<p class="npc-audit-note">采用历史内容会先填入编辑表单，需再次保存。当前版本不会倒退，保存后生成一条新的修改记录。</p></div>';
  openModal('档案修改详情','只读记录 · '+esc(id),body,'<button class="secondary" id="auditDetailBack">返回记录</button><button class="secondary" id="auditUseBefore">填回修改前内容</button><button class="primary" id="auditUseAfter">采用修改后内容</button>');
  document.querySelector('#modalRoot .modal').classList.add('npc-audit-modal');
  $('auditDetailBack').onclick=()=>open(filter);
  $('auditUseBefore').onclick=()=>edit(e.npcId,{fields:e.before,restoreFrom:e.id});
  $('auditUseAfter').onclick=()=>edit(e.npcId,{fields:e.after,restoreFrom:e.id});
 }
 return {open};
}
