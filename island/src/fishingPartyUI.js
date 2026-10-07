import {cooperationMarkup} from './cooperationUI.js';
import {modalNavigationToken} from './modalNavigation.js';
import {relationshipInvitation} from './residentStories.js';
import {hydrateFishing,createFishingEvent,fishingNeeds,createFishingPlan,inviteFishingNpc,cancelFishingDraft,startFishingParty,finishFishingParty,abandonFishingParty,archiveFishingParty,displayFishingWonder,FISHING_INVITES,FISHING_COST,FISHING_EQUIPMENT} from './fishingParty.js';
import {mountPartyDesigner} from './partyDesigner.js';
import {eventRequests,eventCost,PARTY_TAGS,partyDraftStamp} from './partyPlanning.js';
import {mountFishingMatch} from './fishingPartyView.js';
import {freshSeed} from './gameLevels.js';
import {itemMarkup} from './artStore.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {wonderAsset} from './eventWonders.js';
import {availableQuantity} from './resourceLedger.js';
import {esc} from './journeyUI.js';
export function createFishingPartyUI({state,theme,profile,portrait,openModal,closeModal,persist,toast,projects,detail,walkToVenue,onFinish,back,planParty,collections,stories,canDisplay=()=>true,command=null,play=null}){
 let game=null,lastSignature='';
 function design(){panel('设计一场相聚','主题、朋友与用品，先在手账里约定。','<div id="partyDesigner"></div>','<button class="secondary" id="partyDesignBack">返回派对手账</button>');$('partyDesignBack').onclick=open;mountPartyDesigner($('partyDesigner'),{state,theme,profile,portrait,request:planParty,persist,toast,onPublished:open,publish:command?async(proposal,expected)=>{const response=await command(expected.expectedId?'fish_update':'fish_create',{proposal,eventId:expected.expectedId,eventVersion:expected.expectedVersion,eventStamp:expected.expectedStamp});return response.receipt.details;}:null});}
 const $=id=>document.getElementById(id),icon=id=>itemMarkup(id,theme(),'fishing-item');
 function panel(title,subtitle,body,footer=''){
  openModal(title,subtitle,body,footer);document.querySelector('#modalRoot .modal').classList.add('fishing-modal');lastSignature='';
 }
 function open(){
  const f=hydrateFishing(state()),g=f.session;
  if(g?.phase==='claimed'){result();return}
  if(g?.phase==='abandoned'){if(command){const navigation=modalNavigationToken();command('fish_archive',{eventId:g.id}).then(()=>{if(navigation.current())open();}).catch(e=>toast(e.message));return;}archiveFishingParty(state());persist()}
  if(g&&['checkin','running'].includes(g.phase)&&!state().fishingControl&&command){panel('旧版钓鱼大会仍在进行','旧版操作无法重放；场地与用品已投入的记录保留。','<p>结束旧版比赛会归还渔竿和海风旗，不追加完成奖，也不再收场地费。</p>','<button class="secondary" id="fishingLegacyClose">结束旧版比赛并归还钓具</button>');$('fishingLegacyClose').onclick=async()=>{try{await command('fish_legacy_close');open()}catch(e){toast(e.message)}};return;}
  if(g?.phase==='running'){
   if(play){play.resume();return;}
   panel(g.name,'海风钓鱼大会 · 六次垂钓机会 · 关闭页面保留比赛进度','<div id="fishingGame"></div>');
   game=mountFishingMatch($('fishingGame'),{session:g,theme:theme(),profile,avatar:state().playerProfile.avatar,persist,
    onClaim:()=>{const r=finishFishingParty(state());if(!r.ok){toast(r.reason);return}if(!r.replayed)onFinish(r);persist();result()},
    onAbandon:()=>{abandonFishingParty(state());persist();stopGame();open();toast('本场已结束，开场用品已使用，不发完成奖');}});
   return;
  }
  panel('海风钓鱼大会','备好一份茶点，邀朋友一起等潮汐。','<div id="fishingBoard"></div>','<button class="secondary" id="fishingBack">返回派对</button>');
  $('fishingBack').textContent=g?'收起手账':'返回派对';$('fishingBack').onclick=g?closeModal:back;paint(true);
 }
 function paint(force=false){
  const root=$('fishingBoard');if(!root)return;
  if(!force&&root.contains(document.activeElement)&&['INPUT','SELECT'].includes(document.activeElement.tagName))return;
  const s=state(),f=hydrateFishing(s),d=f.draft,g=f.session,needs=d?fishingNeeds(s):null;
  const signature=JSON.stringify([theme(),d,g?.phase,g?.participants.map(p=>[p.id,p.arrived]),g?.playerArrived,s.fishingAttendance,needs,s.coins,s.eventWonders?.owned.seashell_cup,f.history.map(h=>[h.id,h.phase||h.status,h.paid])]);
  if(!force&&signature===lastSignature)return;lastSignature=signature;
  const body=root.closest('.modal-body'),scroll=body.scrollTop;
  root.innerHTML='<section class="fishing-hero"><div><small>THE SEABREEZE GATHERING</small><h3>把一阵海风<br>变成共同的记忆</h3><p>六竿之间，看浮漂、顺着鱼的力气收线。认真完成就有纪念，谁赢谁输都值得相聚。</p><span>三人同场 · 约 2–3 分钟 · 最多 26 分</span></div><img src="/assets/seashell-cup-'+theme()+'-v30.png" alt="海风贝壳奖杯"/></section>'+
   (g?.phase==='checkin'?'<section class="fishing-prep"><h4>已经开场，等大家沿栈桥到齐</h4><p>钓具与海风旗仍在预留，场地、鱼饵和点心已经投入本场。</p><div class="fishing-arrivals">'+g.participants.map(p=>'<span>'+esc(profile(p.id).name)+' · '+(p.arrived||s.fishingAttendance?.people?.[p.id]?.arrived?'已到钓位':'收尾工作，前往钓位')+'</span>').join('')+'<span>你 · '+(g.playerArrived||s.fishingAttendance?.people?.[-1]?.arrived?'已到钓位':'前往钓位')+'</span></div><button class="primary" id="fishingGo">'+(g.playerArrived?'查看钓位':'沿栈桥前往钓位')+'</button><button class="secondary" id="fishingAbandon">结束本场</button></section>':
   g?.phase==='running'?'<section class="fishing-prep"><h4>大家都到齐了</h4><p>这场比赛已保留，继续同一条潮汐与成绩。</p><button class="primary" id="fishingEnter">进入比赛</button></section>':
   !d?'<section class="fishing-create"><h4>发起一场相聚</h4><label>活动名称<input id="fishingName" maxlength="24" value="海风钓鱼大会"/></label><label>手感<select id="fishingDifficulty"><option value="normal">标准 · 1.2 秒提竿窗口</option><option value="easy">轻松 · 2 秒提竿窗口，鱼线更稳</option></select></label><p>一份海虾鱼饵够六竿。本场完成奖励 30–42 岛币；首次必得 R 级贝壳奖杯，以后获得纪念印记。每天与其他派对共用一次承办机会。</p><button class="primary" id="fishingCreate">写入派对手账</button><button class="secondary" id="fishingDesign">设计主题与邀请嘉宾</button></section>':
   '<section class="fishing-prep"><div class="fishing-section-heading"><h4>'+esc(d.name)+'</h4><span>'+ (d.difficulty==='easy'?'轻松':'标准')+' · 第 '+d.version+' 版</span></div><p class="fishing-theme-line">'+esc(d.description||'一场等潮汐、分享茶点的小聚。')+'</p><p>'+esc((d.tags||[]).map(t=>PARTY_TAGS.find(x=>x.id===t)?.name||t).join(' · '))+'</p>'+(d.guestReason?'<p>'+esc(d.guestReason)+'</p>':'')+'<button class="secondary" id="fishingDesign">修改主题方案</button><h5>01 / 亲自邀请关键居民</h5><div class="fishing-invite-grid">'+eventRequests(d).map(r=>'<article><b>'+esc(profile(r.id).name)+' · '+r.role+'</b><p>'+esc(r.request)+'</p><div>'+icon(r.item)+'<span>'+ITEM_BY_ID[r.item].name+' ×'+r.quantity+'</span></div><button class="secondary" data-fishing-invite="'+r.id+'" '+(d.invites[r.id]?.version===d.version?'disabled':'')+'>'+(d.invites[r.id]?.version===d.version?'已交付 · 同意参加':d.inviteGifts[r.id]?.delivered?.[r.item]?'重新确认邀请 · 不重复收物':'与 TA 对话邀请')+'</button></article>').join('')+'</div><h5>02 / 准备本场用品</h5><div class="fishing-supplies">'+Object.entries({...eventCost(d),...FISHING_EQUIPMENT}).map(([id,n])=>'<button class="fishing-supply '+(availableQuantity(s,id)>=n?'ready':'')+'" data-fishing-item="'+id+'">'+(id==='coins'?'<span class="fishing-coin">币</span>':icon(id))+'<span><b>'+(id==='coins'?'场地与组织':ITEM_BY_ID[id].name)+'</b><small>'+availableQuantity(s,id)+' / '+n+(Object.hasOwn(FISHING_EQUIPMENT,id)?' · 用后保留':' · 开场消耗')+'</small></span></button>').join('')+'</div><p class="fishing-note">邀请赠物与本场用品分别准备。物资由其他清单预留时，先完成该清单。比赛鱼只记分，不额外产出海鱼。</p><div class="fishing-prep-actions"><button class="secondary" id="fishingPlan">'+(d.projectId?'查看协作筹备':'让伙伴协作准备')+'</button><button class="primary" id="fishingStart">检查物资，通知大家开场</button><button class="secondary" id="fishingCancel">取消筹备</button></div><p class="fishing-feedback" id="fishingFeedback" role="status"></p></section>')+
   (s.eventWonders?.owned.seashell_cup?'<section class="fishing-memento"><b>已收藏 · 海风贝壳奖杯</b><p>纪念印记 '+s.eventWonders.owned.seashell_cup.marks+' 枚 · 获胜 '+s.eventWonders.owned.seashell_cup.wins+' 场</p><button class="secondary" id="fishingDisplay">'+(s.eventWonders.displayed?'从博物馆庭院收回':'陈列到博物馆庭院')+'</button></section>':'')+
   '<button class="secondary journal-collection" id="fishingCollections">打开奇观藏册与海岛成就 →</button>'+
   (f.history.length?'<details class="fishing-history"><summary>过去的相聚 · '+f.history.length+' 场</summary>'+f.history.map(h=>'<button class="secondary" data-fishing-history="'+esc(h.id)+'"><span><b>'+esc(h.name)+'</b><small>第 '+h.createdDay+' 天筹备 · 第 '+h.endedDay+' 天归档</small></span><span>'+(h.phase==='claimed'?h.result.raw+' 分 · +'+h.paid+' 币':h.status==='cancelled'?'取消筹备':'中途结束')+'</span></button>').join('')+'</details>':'')+
   '<details class="fishing-rules"><summary>公开规则与评分</summary><p>每竿最多 25 秒，普通／闪亮／稀有鱼分别 1／2／3 分；在提竿窗口中央命中 +1，首次连续钓获三次 +2，总分最多 26。最后成绩换算到 100 分。</p><p>小满的技能为 86%，露露为 68%。两人的六竿结果在开场固定，与你的分数无关；同分并列。暂停与关闭同时暂停比赛计时。主动结束不发完成奖，已投入的用品不退回，渔竿和海风旗解除预留。</p></details>';
  body.scrollTop=scroll;
  $('fishingCollections').onclick=collections;
  if($('fishingDesign'))$('fishingDesign').onclick=design;
  if($('fishingCreate'))$('fishingCreate').onclick=async()=>{try{const proposal={name:$('fishingName').value.trim(),difficulty:$('fishingDifficulty').value},r=command?(await command('fish_create',{proposal,eventId:null,eventVersion:null,eventStamp:null})).receipt.details:createFishingEvent(s,{...proposal,seed:freshSeed()});if(!r.ok)toast(r.reason);else{persist();paint(true)}}catch(e){toast(e.message)}};
  root.querySelectorAll('[data-fishing-invite]').forEach(b=>b.onclick=()=>invite(Number(b.dataset.fishingInvite)));
  root.querySelectorAll('[data-fishing-history]').forEach(b=>b.onclick=()=>history(b.dataset.fishingHistory));
  root.querySelectorAll('[data-fishing-item]').forEach(b=>b.onclick=()=>{if(b.dataset.fishingItem!=='coins')detail(b.dataset.fishingItem)});
  if($('fishingPlan'))$('fishingPlan').onclick=async()=>{try{const r=command?(await command('fish_plan',stamp(d))).receipt.details:createFishingPlan(s);if(!r.ok){toast(r.reason);return}persist();projects()}catch(e){toast(e.message)}};
  if($('fishingStart'))$('fishingStart').onclick=async()=>{try{if(play){await command('fish_enable');await play.begin({eventId:d.id,eventVersion:d.version});if(state().fishingParty?.session?.phase==='checkin')walkToVenue();return;}const r=startFishingParty(s);persist();if(!r.ok){$('fishingFeedback').textContent=r.reason;return}walkToVenue()}catch(e){toast(e.message)}};
  if($('fishingCancel'))$('fishingCancel').onclick=async()=>{try{if(command)await command('fish_cancel',stamp(d));else cancelFishingDraft(s);persist();paint(true);toast('筹备已取消，已赠给居民的邀请物品保留给对方')}catch(e){toast(e.message)}};
  if($('fishingGo'))$('fishingGo').onclick=walkToVenue;
  if($('fishingEnter'))$('fishingEnter').onclick=open;
  if($('fishingAbandon'))$('fishingAbandon').onclick=async()=>{if(play){await play.exit();return;}abandonFishingParty(s);archiveFishingParty(s);persist();open()};
  if($('fishingDisplay'))$('fishingDisplay').onclick=()=>{displayFishingWonder(state(),!state().eventWonders.displayed&&!state().eventWonders.pendingDisplays?.seashell_cup,{canPlace:canDisplay('seashell_cup')});persist();paint(true)};
 }
 function invite(id){
  const d=hydrateFishing(state()).draft,r=eventRequests(d).find(n=>n.id===id);if(!d||!r)return;const version=d.version,n=profile(id),willingness=relationshipInvitation(state(),id,eventRequests(d).map(r=>r.id)),delivered=d.inviteGifts[id]?.delivered?.[r.item]>=r.quantity;
  panel(n.name+' · 一起去海边',d.name,'<div class="fishing-dialogue"><aside>'+portrait(id)+'</aside><article><small>'+r.role+'</small><blockquote>“'+esc(r.request)+'”</blockquote><p>'+esc(n.personality)+'</p><div class="fishing-gift">'+icon(r.item)+'<span>'+ITEM_BY_ID[r.item].name+' ×'+r.quantity+'<small>'+(delivered?'之前已经送过，本次确认新约定，不重复收取':'可用 '+availableQuantity(state(),r.item)+' · 交付后作为邀请赠物')+'</small></span></div><p id="fishingInviteFeedback" role="status">'+esc(willingness.reason||'')+'</p></article></div>',
   '<button class="secondary" id="fishingInviteBack">等准备好再来</button>'+(stories?'<button class="secondary" id="fishingStoryTalk">查看邻里手账</button>':'')+'<button class="primary" id="fishingInviteGive" '+(willingness.ready?'':'disabled')+'>我带来了，邀请你参加</button>');
  $('fishingInviteBack').onclick=open;if($('fishingStoryTalk'))$('fishingStoryTalk').onclick=()=>stories(id);const inviteButton=$('fishingInviteGive');inviteButton.onclick=async()=>{try{const result=command?(await command('fish_invite',{...stamp(d),npcId:id})).receipt.details:inviteFishingNpc(state(),id,{version});if(!inviteButton.isConnected){if(result.ok)persist();return;}if(!result.ok){$('fishingInviteFeedback').textContent=result.reason;return}persist();toast(n.name+(result.reconfirmed?'确认了新的活动约定':'收下邀请物品')+'，同意参加这场活动');open()}catch(e){if($('fishingInviteFeedback'))$('fishingInviteFeedback').textContent=e.message;else toast(e.message)}};
 }
 function cooperationHTML(g){return cooperationMarkup(state(),g,theme());}

 function history(id){
  const g=hydrateFishing(state()).history.find(h=>h.id===id);if(!g)return;
  panel(g.name,'派对记录 · 第 '+g.endedDay+' 天',
   '<section class="fishing-prep"><h4>'+(g.phase==='claimed'?'相聚已完成':g.status==='cancelled'?'筹备已取消':'比赛中途结束')+'</h4><p>'+(g.phase==='claimed'?'成绩 '+g.result.raw+' / 26 · 第 '+g.result.rank+' 名 · 已结算 '+g.paid+' 岛币':g.status==='cancelled'?'未消耗的用品已解除预留；已交给居民的邀请赠物保留给对方。':'已使用的场地与用品不退回，不发完成奖；钓具和海风旗已解除预留。')+'</p>'+(g.result?'<ol class="fishing-final-scores">'+g.result.rows.map(r=>'<li><span>'+esc(profile(r.id).name)+'</span><b>'+r.score+' 分</b></li>').join('')+'</ol>':'')+'</section>'+cooperationHTML(g),'<button class="secondary" id="fishingHistoryBack">返回派对手账</button>');
  $('fishingHistoryBack').onclick=open;
 }
 function result(){
  const s=state(),g=hydrateFishing(s).session;if(!g||g.phase!=='claimed')return;
  const w=s.eventWonders.owned.seashell_cup,r=g.result,monument=s.eventWonders.owned.cooperation_monument;
  const second=monument?.eventId===g.id?'<section class="fishing-second-wonder"><img src="'+wonderAsset('cooperation_monument',theme())+'" alt="同心启航纪念碑"/><div><small>这场分工 · 第二份纪念</small><h3>一起做成的事，留在广场</h3><p>真实主／子伙伴交付了本场用品，同心启航纪念碑已经收藏。可在藏册陈列到派对广场，与奖杯同时展示。</p></div></section>':'';
  panel('海风已写进手账',g.name+' · 第 '+g.endedDay+' 天','<div class="fishing-award"><img src="/assets/seashell-cup-'+theme()+'-v30.png" alt="R 级海风贝壳奖杯"/><article><small>R / 海风贝壳奖杯</small><h3>'+ (r.won?'这一场，你站上了潮头':'谢谢你，让大家相聚')+'</h3><p>你的成绩 <b>'+r.raw+' / 26</b> · 第 '+r.rank+' 名 · 标准化 '+r.normalized+' 分</p><strong class="fishing-prize">+'+g.paid+' 岛币</strong><p>'+ (w.eventId===g.id?'首次纪念已经收藏，可陈列在博物馆庭院。':'这次相聚留下了 1 枚纪念印记，目前共 '+w.marks+' 枚。')+'</p><p>'+esc(g.participants.map(p=>profile(p.id).name).join('、'))+'好感各 +3 · 钓具与海风旗已解除预留。</p></article></div><ol class="fishing-final-scores">'+r.rows.map(row=>'<li><span>'+esc(profile(row.id).name)+'</span><b>'+row.score+' 分</b></li>').join('')+'</ol>'+second+cooperationHTML(g),
   '<button class="secondary" id="fishingAwardClose">收好这段记忆</button><button class="primary" id="fishingAwardDisplay">陈列到博物馆庭院</button><button class="secondary" id="fishingAwardCollections">奇观与成就</button>');
  $('fishingAwardCollections').onclick=collections;
  $('fishingAwardClose').onclick=async()=>{try{if(command)await command('fish_archive',{eventId:g.id});else archiveFishingParty(s);persist();closeModal()}catch(e){toast(e.message)}};
  $('fishingAwardDisplay').onclick=()=>{displayFishingWonder(state(),true,{canPlace:canDisplay('seashell_cup')});persist();toast(state().eventWonders.pendingDisplays?.seashell_cup?'已安排陈列，等居民经过后自动放好':'贝壳奖杯已陈列在博物馆庭院，随时可在收藏册收回')};
 }
 function stamp(d){return {eventId:d?.id||null,eventVersion:d?.version||null,eventStamp:partyDraftStamp(d)};}
 function mount(ticket,controls){const g=state().fishingParty.session;if(g?.phase==='checkin'){open();return {destroy(){},setTransportPaused(){},inspect:()=>({checkin:true})};}panel(g.name,'六次垂钓机会 · 收起页面保留同场进度','<div id="fishingGame"></div>');game=mountFishingMatch($('fishingGame'),{session:{...g,match:ticket.game.match},theme:theme(),profile,avatar:state().playerProfile.avatar,persist,controls,onClaim:controls.claim,onAbandon:controls.exit});return game;}
 function stopGame(){const current=game;game=null;current?.destroy()}
 return {open,paint,invite,design,mount,result,stopGame,inspect:()=>game?.inspect()};
}
