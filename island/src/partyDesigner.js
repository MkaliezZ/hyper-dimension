import {FIREWORKS_EQUIPMENT} from './fireworksRules.js';
import {COUTURE_EQUIPMENT} from './coutureRules.js';
import {MARKET_EQUIPMENT} from './marketRules.js';
import {PARTY_TAGS,eventRequests,eventCost,validatePartyProposal,partyInputSignature,partyDraftStamp} from './partyPlanning.js';
import {hydrateFishing,createFishingEvent,updateFishingEvent,FISHING_EQUIPMENT} from './fishingParty.js';
import {freshSeed} from './gameLevels.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {itemMarkup} from './artStore.js';
import {esc} from './journeyUI.js';
export function mountPartyDesigner(root,{state,theme,profile,portrait,request,persist,toast,onPublished,publish=null,template='fishing',getPartyState=hydrateFishing}){
 const s=state(),f=getPartyState(s),d=f.draft,expectedId=d?.id||null,expectedVersion=d?.version||null,expectedStamp=partyDraftStamp(d);
 const saved=f.composer?.expectedId===expectedId&&f.composer?.expectedVersion===expectedVersion&&f.composer?.expectedStamp===expectedStamp?f.composer:null;
 const initial=saved||d||{name:template==='fireworks'?'星海烟花大会':template==='couture'?'海岛穿搭大会':template==='market'?'海岛手作集市':template==='night'?'星灯夜集':'海风钓鱼大会',description:'',tags:[template==='fireworks'?'stars':template==='couture'?'craft':template==='market'?'craft':template==='night'?'stars':'sea'],difficulty:'normal',fireworks:false};
 let preview=null,busy=false,sequence=0;const capturedTheme=theme();
 const $=id=>root.querySelector('#'+id),live=()=>root.isConnected&&state().saveSlot===s.saveSlot&&theme()===capturedTheme;
 root.innerHTML='<div class="party-designer"><section class="party-letter"><small>给这次相聚写一封邀请</small><h3>这一阵海风，<br>你想和谁一起收藏？</h3><p>选两种以内的主题。管家会从岛民的性格与工作里，推荐一位适合陪伴这场相聚的嘉宾。</p><label>相聚的名字<input id="partyDesignName" maxlength="24" value="'+esc(initial.name)+'"/></label><label>你想营造的氛围<textarea id="partyDesignDescription" maxlength="200" rows="4" placeholder="例如：带一点花园气息，比赛以后大家坐下来听听海岛故事。">'+esc(initial.description||'')+'</textarea></label><fieldset><legend>主题 · 最多两种</legend><div class="party-theme-tags">'+PARTY_TAGS.map(t=>'<label><input type="checkbox" value="'+t.id+'" '+((initial.tags||[]).includes(t.id)?'checked':'')+'/><span>'+t.name+'</span></label>').join('')+'</div></fieldset>'+(template==='night'?'<label class="party-fireworks-option"><input id="partyDesignFireworks" type="checkbox" '+(initial.fireworks?'checked':'')+'> 烟花助兴 · 本场额外消耗烟花 ×1</label>':'')+'<label>比赛手感<select id="partyDesignDifficulty"><option value="normal" '+(initial.difficulty==='normal'?'selected':'')+'>'+(template==='fireworks'?'标准 · 星圈0.058与0.76秒亮拍':template==='couture'?'标准 · 90秒造型与0.84秒亮拍':template==='market'?'标准 · 顾客耐心11–14秒':template==='night'?'标准 · 观察侧风与云层':'标准 · 1.2 秒提竿窗口')+'</option><option value="easy" '+(initial.difficulty==='easy'?'selected':'')+'>'+(template==='fireworks'?'轻松 · 更宽星圈与1.4秒亮拍':template==='couture'?'轻松 · 120秒造型与1.4秒亮拍':template==='market'?'轻松 · 顾客耐心17–20秒':template==='night'?'轻松 · 更宽星点与柔和侧风':'轻松 · 2 秒提竿窗口')+'</option></select></label><div class="party-design-actions"><button class="primary" id="partySuggest">请 AI 推荐主题嘉宾</button><button class="secondary" id="partyBase">采用基础方案</button></div><p class="party-design-status" id="partyDesignStatus" role="status"></p></section><aside class="party-preview"><small>邀请之前，先看清这场相聚</small><div id="partyPreview"></div></aside></div>';
 function input(){return {template,name:$('partyDesignName').value,description:$('partyDesignDescription').value,tags:[...root.querySelectorAll('.party-theme-tags input:checked')].map(e=>e.value).sort(),difficulty:$('partyDesignDifficulty').value,...(template==='night'?{fireworks:!!$('partyDesignFireworks').checked}:{})};}
 function unchanged(){const current=getPartyState(state()).draft;return (current?.id||null)===expectedId&&(current?.version||null)===expectedVersion&&partyDraftStamp(current)===expectedStamp&&!(template==='night'?state().partySession:getPartyState(state()).session);}
 function saveDraft(){getPartyState(state()).composer={...input(),expectedId,expectedVersion,expectedStamp};persist();}
 function basic(){const r=validatePartyProposal(s,{...input(),guestId:null});if(!r.ok){$('partyDesignStatus').textContent=r.reason;return}preview={...r.proposal,source:'rules'};paintPreview();}
 function changed(){sequence++;const previous=preview,r=previous?validatePartyProposal(s,{...input(),guestId:previous.guestId,guestReason:previous.guestReason}):null;const nameOnly=r?.ok&&partyInputSignature(previous)===partyInputSignature(r.proposal);preview=nameOnly?{...previous,...r.proposal}:null;saveDraft();$('partyDesignStatus').textContent=nameOnly?'只调整了名字，嘉宾建议与邀请约定保留。':'主题已更新，请重新推荐嘉宾或采用基础方案。';paintPreview();}
 function paintPreview(){
  const p=preview||{...input(),guestId:null};
  const invited=eventRequests(p);
  $('partyPreview').innerHTML='<span class="party-proposal-source">'+(preview?.source==='deepseek'?'DeepSeek Flash · 建议已通过规则检查':preview?'基础规则方案':'等待确认方案')+'</span><h4>'+esc(p.name||'等待写下名字')+'</h4><p>'+esc(p.description||(template==='fireworks'?'三位伙伴协作、六枚有限烟花，用风向瞄准与节拍绽放留下相聚记忆。':template==='couture'?'三位居民、三种场合，用真实服装和四拍姿态留下相聚记忆。':template==='market'?'挑选海岛手艺，三波经营，留下真实的集市记忆。':template==='night'?'收好手边的工作，到广场分享故事与四盏共同的星灯。':'一场认真钓鱼、分享茶点的海边小聚。'))+'</p><div class="party-preview-people">'+invited.map(r=>'<article><div class="party-preview-portrait">'+portrait(r.id)+'</div><div><b>'+esc(profile(r.id).name)+'</b><small>'+esc(r.role)+(r.themeGuest?' · 主题嘉宾':' · 必须邀请')+'</small><span>'+itemMarkup(r.item,theme(),'fishing-item')+esc(ITEM_BY_ID[r.item].name)+' ×'+r.quantity+(d?.inviteGifts?.[r.id]?.delivered?.[r.item]?' · 已送出，重新确认即可':'')+'</span></div></article>').join('')+'</div>'+(p.guestReason?'<blockquote>'+esc(p.guestReason)+'</blockquote>':'')+'<h5>本场投入</h5><div class="party-preview-cost">'+Object.entries({...eventCost(p),...(template==='fireworks'?FIREWORKS_EQUIPMENT:template==='couture'?COUTURE_EQUIPMENT:template==='market'?MARKET_EQUIPMENT:template==='night'?{}:FISHING_EQUIPMENT)}).map(([id,n])=>'<span>'+(id==='coins'?'组织费 '+eventCost(p).coins+' 岛币':esc(ITEM_BY_ID[id].name)+' ×'+n+(Object.hasOwn(template==='fireworks'?FIREWORKS_EQUIPMENT:template==='couture'?COUTURE_EQUIPMENT:template==='market'?MARKET_EQUIPMENT:FISHING_EQUIPMENT,id)?(template==='fireworks'&&id==='firework'?' · 实际发射者消耗':' · 保留'):''))+'</span>').join('')+'</div><p class="party-preview-note">'+(template==='fireworks'?'三位协作居民与嘉宾独立赴约；三幕六枚有限烟花，只消耗实际发射者，品质收益0–78币，合格可获SR星潮留影灯。':template==='couture'?'三位评审与三位模特分别赴约；服装只预留不消耗，三轮品质收益0–54岛币，合格可获R星织展示台。':template==='market'?'三位摊主与嘉宾走到独立岗位；三波12位顾客，品质收益0–80岛币，未售商品退回。':template==='night'?'嘉宾沿道路到广场独立站位；夜集基础奖励 20–28 岛币，主题穿着 +2、烟花 +3。':'嘉宾到码头观赛；三位选手的比赛与 30–42 岛币奖励保持公开规则。')+'所有关键居民仍需你亲自对话邀请。</p>'+(d?'<p class="party-preview-note">'+(partyInputSignature(d)===partyInputSignature(p)?'本次只修改名称时，同意保留。':'保存关键条件将产生新版本，原同意需要重新确认；同一赠物不会再次收取。')+'</p>':'')+'<button class="primary" id="partyPublish" '+(!preview?'disabled':'')+'>'+(d?'保存这份活动方案':'发布到派对手账')+'</button>';
  $('partyPublish').onclick=async()=>{
   if(!preview||!live())return;if(!unchanged()){toast('活动已经变化，请重新打开手账');return}
   let r;try{r=publish?await publish(preview,{expectedId,expectedVersion,expectedStamp}):d?updateFishingEvent(s,preview,{expectedId,expectedVersion,source:preview.source}):createFishingEvent(s,{...preview,seed:freshSeed()});}catch(e){$('partyDesignStatus').textContent=e.message;return;}
   if(!r.ok){$('partyDesignStatus').textContent=r.reason;return}
   delete getPartyState(state()).composer;persist();toast(r.reinvite?'新版本已保存，请重新确认关键居民的邀请':'活动方案已写进派对手账');onPublished();
  };
 }
 $('partySuggest').onclick=async()=>{
  if(busy||!live())return;if(!unchanged()){toast('活动已经变化，请重新打开手账');return}
  const r=validatePartyProposal(s,{...input(),guestId:null});if(!r.ok){$('partyDesignStatus').textContent=r.reason;return}
  saveDraft();const captured=++sequence;busy=true;$('partySuggest').disabled=true;$('partyDesignStatus').textContent='正在读岛民的性格与工作，准备一份可实现的邀请建议…';
  try{
   const p=await request(r.proposal,{expectedId,expectedVersion,expectedStamp});
   if(!live()||captured!==sequence)return;
   if(!unchanged()){$('partyDesignStatus').textContent='活动已经变化，本轮建议未应用。';return}
   const checked=validatePartyProposal(s,p);if(!checked.ok)throw Error(checked.reason);
   preview={...checked.proposal,source:'deepseek',proposalId:p.proposalId,model:p.model};paintPreview();
   $('partyDesignStatus').textContent='建议已准备好。看过角色和投入后，点击发布。';
  }catch(e){if(live()&&captured===sequence)$('partyDesignStatus').textContent=e.message+'。可以采用基础方案，或稍后再请求建议。';}
  finally{busy=false;if(live())$('partySuggest').disabled=false;}
 };
 $('partyBase').onclick=()=>{sequence++;basic();$('partyDesignStatus').textContent=''+(template==='fireworks'?'基础方案保留小墨、星野、黎音三位协作居民。':template==='couture'?'基础方案保留三位评审与三位模特，六位都需亲自对话邀请。':template==='market'?'基础方案保留桃子、小墨、露露三位摊主。':template==='night'?'基础方案保留阿岚与露露两位关键居民。':'基础方案保留小满与露露两位关键居民。')+'';};
 root.querySelectorAll('input,textarea,select').forEach(e=>e.addEventListener('input',()=>{
  if(e.type==='checkbox'&&root.querySelectorAll('.party-theme-tags input:checked').length>2){e.checked=false;toast('主题最多选择两种');return}changed();
 }));
 if(d&&!saved){preview={...d};paintPreview();}else basic();
 return {input,inspect:()=>({expectedId,expectedVersion,busy,preview})};
}
