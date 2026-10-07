import {residentPortraitMarkup} from './residentPortraits.js';
import {avatarPortrait} from './avatars.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function portrait(p,theme){return p.appearance?avatarPortrait(p.appearance,theme,'half-portrait resident-atlas-portrait avatar-half'):residentPortraitMarkup(p.npcId,theme,p.name);}
export function travelPreparationMarkup(v){
 const p=v.travel;if(!p)return '';
 if(!p.available)return '<section class="lan-card lan-travel"><h3>和谁一起出发？</h3><p>先回自己的小岛建立档案。出发时本人管家必定同行，还可以邀请两位居民。</p><a class="lan-button" href="/play">去自己的小岛</a></section>';
 if(v.room)return '';
 return '<section class="lan-card lan-travel" id="lanTravelPanel"><div class="lan-space-between"><div><small>YOUR TRAVEL PARTY</small><h3>带上熟悉的伙伴</h3></div><span>伙伴 '+p.selected.length+' / 2</span></div><div class="lan-travel-mandatory">'+portrait(p.butler,p.homeTheme)+'<div><b>'+esc(p.butler.name)+' · 必带管家</b><p>沿用本人小岛的名字与形象。'+(p.homeTheme==='pixel'?'像素':'折纸')+'岛档案</p><small>'+(p.agentRuntime==='owner-isolated'?'本人委托与文档工作区已接入，可从上方“随行管家”继续对话；可在“客岛协作”中让双方管家核对活动准备；本人电脑执行端仍待接入。':'当前会客服务尚未接入个人 Agent，随行形象不代表已开通委托能力。')+'</small></div></div><details id="lanTravelChoices"><summary>邀请居民同行 · 根据当前状态答复</summary><div class="lan-travel-grid">'+p.residents.map(r=>{const selected=p.selected.includes(r.npcId);return '<article class="lan-travel-candidate">'+portrait(r,p.homeTheme)+'<div><b>'+esc(r.name)+' <small>'+esc(r.job)+(r.kind==='agent_recruited'?' · 临时伙伴':'')+'</small></b><p>'+esc(r.reason)+'</p><small>精力 '+Math.round(r.needs.energy)+' · 饱足 '+Math.round(r.needs.hunger)+'</small><button data-travel-npc="'+r.npcId+'" data-travel-operation="'+(selected?'travel_remove':'travel_invite')+'" '+(!selected&&(!r.accepted||p.selected.length>=2)?'disabled':'')+'>'+(selected?'取消同行':r.accepted?'邀请同行':'暂时不能同行')+'</button></div></article>';}).join('')+'</div></details>'+(p.staleRecruitSelection?'<p role="alert">临时伙伴的聘约已变化，请取消旧邀请后重新选择。</p><button data-travel-npc="16" data-travel-operation="travel_remove">取消旧聘约的随行邀请</button>':'')+'<p class="lan-map-note">临时伙伴与居民共用两席；先暂停未完成的委托再邀请。随行期间原聘期和预留报酬保持不变。登岛时再次确认答复；登岛后名单冻结，本岛生产暂停，活动结算照常核对。回会客厅后再调整同行名单。重复邀请不会改变相同条件下的答复。</p></section>';
}
export function memberCompanionsMarkup(m,theme){
 if(!m.travel)return '';
 return '<div class="lan-travel-members">'+m.travel.members.map(p=>'<div class="lan-travel-person">'+portrait(p,theme)+'<span><b>'+esc(p.name)+'</b><small>'+(p.kind==='hermes'?'本人管家 · 随行':(p.kind==='agent_recruited'?'临时伙伴 · ':'同行居民 · ')+esc(p.job))+'</small></span></div>').join('')+'</div>';
}
