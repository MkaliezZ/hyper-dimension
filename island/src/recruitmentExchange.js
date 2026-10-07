import {esc} from './journeyUI.js';
import {avatarPortrait} from './avatars.js';
import {residentPortraitMarkup} from './residentPortraits.js';

// Only completed, tool-backed exchanges may be presented as agreed delegation.
export function recruitmentExchange(contract,state,theme){
 const run=contract?.runs?.findLast(r=>r.source==='hermes'&&r.parent?.status==='completed'&&r.child?.status==='completed'&&r.child?.parentId===r.parent?.id&&r.parent?.tools?.includes('recruitment_delegate')&&r.child?.tools?.includes('recruitment_take_step'));
 if(!run?.parent?.answer||!run?.child?.answer)return '';
 const name=state.npcProfiles?.[15]?.name||'赫尔墨斯',candidate=contract.profile||{};
 const portrait=key=>avatarPortrait(key,theme,'half-portrait recruit-exchange-portrait');
 const prose=text=>esc(String(text).trim().replace(/\n{2,}/g,'\n')).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>');
 const parentArt=state.butlerAvatar&&state.butlerAvatar!=='default'?portrait(state.butlerAvatar):residentPortraitMarkup(15,theme,name);
 const row=(role,person,art,answer)=>'<article class="recruit-exchange-row"><div class="recruit-exchange-art">'+art+'</div><div class="recruit-exchange-copy"><small>'+role+'</small><h5>'+esc(person)+'</h5><p>'+prose(answer)+'</p><details><summary>完整回应</summary><blockquote>'+prose(answer)+'</blockquote></details></div></article>';
 return '<section class="recruit-exchange" aria-label="管家与伙伴的真实协商"><header><small>TOGETHER / AGENT CONVERSATION</small><h4>先商量，再一起动手</h4><p>真实委派与接单回应 · 分工已接受，交付以实际筹备进度为准。</p></header>'+row('管家 · 发出委托',name,parentArt,run.parent.answer)+row('伙伴 · 接受分工',candidate.name||'协作伙伴',portrait(candidate.appearance||'male_0'),run.child.answer)+'</section>';
}
