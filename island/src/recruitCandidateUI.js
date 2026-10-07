import {RECRUIT_CANDIDATES} from './recruitmentCatalog.js';
import {AVATARS} from './avatarCatalog.js';
import {avatarPortrait} from './avatars.js';
import {esc} from './journeyUI.js';
export const candidateSkills=c=>(c.specialties||[]).map(x=>({forest:'林地采集',farm:'耕种',mine:'采矿',workshop:'手作'})[x]||x);
const draftKey=(theme,world)=>'hd-recruit-candidate-draft:'+theme+':'+world;
function readDraft(theme,world){try{return JSON.parse(localStorage.getItem(draftKey(theme,world)))||{};}catch{return{};}}
export function candidateBoard(candidates,selected,theme,world){
 const draft=readDraft(theme,world),d=draft.input||{},customs=candidates.filter(c=>c.custom).length;
 return '<section class="recruit-board"><div class="recruit-board-heading"><div><small>ISLAND RECRUITMENT</small><h4>来岛协作的朋友</h4></div><span>选择职业，再约定分工</span></div><div class="recruit-candidates">'+candidates.map(c=>'<button type="button" class="recruit-candidate" data-candidate="'+esc(c.id)+'" aria-pressed="'+(selected===c.id)+'">'+avatarPortrait(c.appearance,theme,'recruit-candidate-art')+'<span><b>'+esc(c.name)+(c.custom?' · 自建':'')+'</b><small>'+esc(c.job)+'</small><em>'+esc(candidateSkills(c).join(' · '))+'</em></span><i aria-hidden="true">'+(selected===c.id?'✓':'＋')+'</i></button>').join('')+'</div>'+
 '<details class="recruit-custom" data-history="custom"><summary>创建自己的伙伴 · '+customs+' / 3</summary><p>选择现有职业与形象，写下名字、性格和来历。创建档案不占人口席位；正式招聘后才会乘船到岛。</p><form id="recruitCustomForm"><div class="recruit-custom-grid"><label>姓名<input name="name" maxlength="16" required value="'+esc(d.name||'')+'"></label><label>职业<select name="roleId">'+RECRUIT_CANDIDATES.map(c=>'<option value="'+c.id+'" '+(d.roleId===c.id?'selected':'')+'>'+esc(c.job)+'</option>').join('')+'</select></label><label>角色形象<select name="appearance">'+AVATARS.map(a=>'<option value="'+a.id+'" '+(d.appearance===a.id?'selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select></label><div id="recruitCustomPortrait">'+avatarPortrait(d.appearance||'male_0',theme,'recruit-custom-art')+'</div><label class="wide">性格<textarea name="personality" maxlength="160" rows="2" required>'+esc(d.personality||'')+'</textarea></label><label class="wide">来历<textarea name="backstory" maxlength="200" rows="3" required>'+esc(d.backstory||'')+'</textarea></label></div><p class="recruit-custom-status" role="status"></p><button class="secondary" type="submit" '+(customs>=3?'disabled':'')+'>保存为候选伙伴</button></form></details></section>';
}
export function bindCandidateBoard(root,{theme,world,select,create}){
 root.querySelectorAll('[data-candidate]').forEach(b=>b.onclick=()=>select(b.dataset.candidate));
 const form=root.querySelector('#recruitCustomForm');if(!form)return;
 const input=()=>Object.fromEntries(new FormData(form)),keep=(renew=true)=>{const old=readDraft(theme,world);const draft={input:input(),requestId:!renew&&old.requestId?old.requestId:crypto.randomUUID()};localStorage.setItem(draftKey(theme,world),JSON.stringify(draft));return draft;};
 form.oninput=()=>{keep();root.querySelector('#recruitCustomPortrait').innerHTML=avatarPortrait(form.elements.appearance.value,theme,'recruit-custom-art');};
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;try{const d=keep(false);if(await create(d.input,d.requestId))localStorage.removeItem(draftKey(theme,world));}catch(e){form.querySelector('[role=status]').textContent=e.message;}finally{if(button.isConnected)button.disabled=false;}};
}
