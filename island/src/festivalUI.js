import {cooperationMarkup} from './cooperationUI.js';
import {modalNavigationToken} from './modalNavigation.js';
import {hydrateFestival,festivalNeeds,festivalReadiness} from './festivalParty.js';
import {eventRequests,eventCost,partyDraftStamp} from './partyPlanning.js';
import {mountPartyDesigner} from './partyDesigner.js';
import {MARKET_EQUIPMENT} from './marketRules.js';
import {itemMarkup,artReady} from './artStore.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {availableQuantity} from './resourceLedger.js';
import {relationshipInvitation} from './residentStories.js';
import {esc} from './journeyUI.js';
export function createFestivalUI({state,theme,profile,portrait,openModal,toast,persist,command,back,start,play,collections}){
 let busy=false,signature='';const q=id=>document.getElementById(id),capture=()=>({theme:theme(),slot:state().saveSlot}),live=c=>theme()===c.theme&&state().saveSlot===c.slot;
 const args=()=>{const d=hydrateFestival(state()).draft;return{eventId:d?.id||null,eventVersion:d?.version||null,eventStamp:partyDraftStamp(d)};};
 async function ensure(){await command('festival_enable');}
 async function call(op,extra={}){if(busy)throw Error('先等当前集市操作确认');busy=true;try{return(await command(op,{...args(),...extra})).receipt?.details;}finally{busy=false;}}
 const icon=id=>itemMarkup(id,theme(),'fishing-item'),costs=items=>Object.entries(items).map(([id,n])=>'<span>'+(id==='coins'?'组织费 '+n+' 岛币':icon(id)+esc(ITEM_BY_ID[id].name)+' ×'+n)+'</span>').join('');
 async function open(){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;const f=hydrateFestival(state());if(f.session?.phase==='running'){play.resume();return;}
   signature='';openModal(f.draft?.name||'海岛集市手账','让认真制作的商品，被喜欢它的居民带走。','<div id="marketBoard"></div>','<button class="secondary" id="marketBookBack">返回派对</button>');q('marketBookBack').onclick=back;paint();
  }catch(e){toast(e.message);}
 }
 function paint(){
  if(busy)return;const root=q('marketBoard');if(!root)return;
  const s=state(),f=hydrateFestival(s),d=f.draft,g=f.session,need=d?festivalNeeds(s):null,readiness=d?festivalReadiness(s):null,next=JSON.stringify([theme(),f,need,readiness,s.coins]);if(next===signature)return;signature=next;
  const scroll=root.closest('.modal-body')?.scrollTop||0;
  root.innerHTML='<section class="fishing-hero market-book-hero"><div><small>THE ISLAND MARKET</small><h3>三间小摊，<br>一岛有温度的手艺</h3><p>邀请摊主，备好商品；看看居民喜欢什么，安排陈列、装篮、打包交付。每一笔收入，都来自一次实际经营。</p><span>三波12位居民 · 16件实际商品 · 品质收益0–80岛币</span></div><img src="/assets/market-lantern-'+theme()+'-v87.png" alt="R 集市灯牌"/></section>'+
  (g?'<section class="fishing-prep market-memory"><h4>'+esc(g.name)+' · '+(g.phase==='claimed'?'集市已收摊':'本场已提前结束')+'</h4><p>'+(g.result?'服务 '+g.result.served+'/12 · 品质 '+g.result.quality+'/100 · 收入 '+g.paid+' 岛币':'未发完成收益，场地费与已售商品保留实际消耗。')+'</p><div class="material-costs">'+costs(g.returned||{})+'</div><p>'+ (g.result?.passed?'这次经营达到纪念条件，可到收藏中查看集市灯牌。':'未售商品已退回，摊位器具已解除预留。')+'</p>'+cooperationMarkup(s,g,theme())+'<button class="primary" id="marketArchive">收起结果 · 准备下一场</button><button class="secondary" id="marketCollections">查看奇观收藏</button></section>':
  !d?'<section class="fishing-create"><h4>准备一场海岛集市</h4><p>桃子照看茶点，小墨负责手作，露露负责主持与交付。主题嘉宾可以再邀请一位；关键居民都需要亲自对话确认。</p><button class="primary" id="marketBasic">发布基础集市</button><button class="secondary" id="marketDesign">设计主题与嘉宾</button></section>':
  '<section class="fishing-prep"><h4>'+esc(d.name)+' · 第 '+d.version+' 版</h4><p>'+esc(d.description||'每一件海岛手艺，都有愿意认真挑选的人。')+'</p><div class="party-preview-people">'+eventRequests(d).map(p=>'<article><div class="party-preview-portrait">'+portrait(p.id)+'</div><div><b>'+esc(profile(p.id).name)+'</b><small>'+esc(p.role)+'</small><span>'+icon(p.item)+esc(ITEM_BY_ID[p.item].name)+' ×'+p.quantity+(d.inviteGifts[p.id]?.delivered?.[p.item]?' · 已送达':' · 待送达')+'</span><button class="secondary" data-market-invite="'+p.id+'">'+(d.invites[p.id]?.version===d.version?'本版已确认 · 查看约定':'对话并邀请')+'</button></div></article>').join('')+'</div><h5>01 / 实际寄售商品与场地费</h5><div class="material-costs">'+costs(eventCost(d))+'</div><h5>02 / 器具留用</h5><div class="material-costs">'+costs(MARKET_EQUIPMENT)+'</div><p>商品开场时寄存；实际售出才消耗，未售商品结束或取消时退回。器具不会消耗，活动期间不可被其他作业占用。</p><p class="hint">'+esc(readiness.reason||'物资和本版同意已齐，可以沿道路到广场开市。')+'</p>'+(Object.keys(need.missing).length?'<div class="material-costs">'+costs(need.missing)+'</div>':'')+'<div class="night-party-actions"><button class="primary" id="marketHost" '+(!readiness.ready?'disabled':'')+'>赴约 · 开办三波集市</button><button class="secondary" id="marketPlan">请管家筹备物资</button><button class="secondary" id="marketDesign">修改主题方案</button><button class="secondary" id="marketCancelDraft">取消筹备</button></div><p class="mini-explain">三种陈列品可在每波开市前调整，陈列订单商品能缩短包装时间。至少服务6人、品质45分，可获首场R集市灯牌；后续合格集市增加纪念印记。</p></section>')+
  '<section class="fishing-prep"><h4>集市经营约定</h4><p>顾客来自岛上的实际居民，根据偏好产生订单，沿路来到四个独立选购位。走路不耗耐心；等到摊位后，才开始等待交付。错配商品会降低耐心和连单，超时顾客离开。</p><p>每天与星灯夜集、钓鱼大会共用一次承办机会。12岛币场地费和已送赠物不退回，取消本场不发完成收益。</p></section>';
  if(q('marketBasic'))q('marketBasic').onclick=async()=>{try{await call('festival_create',{proposal:{template:'market',name:'海岛手作集市',description:'把茶点、陶器与花束送到喜欢它的居民手里。',tags:['craft','cuisine'],difficulty:'normal',guestId:null}});open();}catch(e){toast(e.message);}};
  if(q('marketDesign'))q('marketDesign').onclick=design;
  if(g){q('marketArchive').onclick=async()=>{try{await call('festival_archive',{eventId:g.id});open();}catch(e){toast(e.message);}};q('marketCollections').onclick=collections;}
  if(d){
   root.querySelectorAll('[data-market-invite]').forEach(b=>b.onclick=()=>invite(Number(b.dataset.marketInvite)));
   q('marketHost').onclick=()=>start(d);q('marketPlan').onclick=async()=>{try{await call('festival_plan');toast('集市物资筹备已登记，按实际配方安排分工。');open();}catch(e){toast(e.message);}};
   q('marketCancelDraft').onclick=async()=>{try{await call('festival_cancel');toast('筹备已取消，未用商品保留。');open();}catch(e){toast(e.message);}};
  }
  if(root.closest('.modal-body'))root.closest('.modal-body').scrollTop=scroll;
 }
 async function design(){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;openModal('为集市写一封邀请','选择主题、预览实际岗位和商品，再发布到手账。','<div id="marketDesigner"></div>');
   mountPartyDesigner(q('marketDesigner'),{state,theme,profile,portrait,persist,toast,template:'market',getPartyState:hydrateFestival,onPublished:open,publish:async(p,expected)=>call(expected.expectedId?'festival_update':'festival_create',{proposal:p,eventId:expected.expectedId,eventVersion:expected.expectedVersion,eventStamp:expected.expectedStamp}),request:async(input,expected)=>{persist();const r=await fetch('/api/parties/'+theme()+'/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),worldKey:state().saveSlot,input,...expected}),signal:AbortSignal.timeout(60000)}),data=await r.json();if(!r.ok)throw Error(data.error||'主题建议暂时不可用');return data;}});
  }catch(e){toast(e.message);}
 }
 async function invite(id){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;const d=hydrateFestival(state()).draft,p=d&&eventRequests(d).find(p=>p.id===id);if(!p){toast('这位居民不在当前集市邀请名单');return;}
   const gift=!!d.inviteGifts[id]?.delivered?.[p.item],confirmed=d.invites[id]?.version===d.version,willing=relationshipInvitation(state(),id,eventRequests(d).map(r=>r.id)),expected={eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)};
   openModal(profile(id).name+' · 集市之约',d.name+' · 第 '+d.version+' 版','<div class="conversation-stage"><aside class="character-stage">'+portrait(id)+'</aside><article class="conversation-body"><blockquote class="dialogue-bubble">'+esc(confirmed?'我已经答应这版集市。收好手边的工作，就去广场负责自己的岗位。':p.request)+'</blockquote><p>'+icon(p.item)+esc(ITEM_BY_ID[p.item].name)+' ×'+p.quantity+' · '+(gift?'已送达，重新确认不再扣除':'实际送达后确认本版参加')+'</p><p>'+esc(willing.ready?'约定确认后，开场时会沿道路赴约。':willing.reason)+'</p></article></div>','<button class="secondary" id="marketInviteBack">返回手账</button><button class="primary" id="marketInviteConfirm" '+(confirmed||!willing.ready||!gift&&availableQuantity(state(),p.item,d.projectId?'project:'+d.projectId:null)<p.quantity?'disabled':'')+'>'+(confirmed?'本版已确认':gift?'重新确认参加':'送达物品并邀请')+'</button>');
   q('marketInviteBack').onclick=open;const inviteButton=q('marketInviteConfirm');inviteButton.onclick=async()=>{try{if(!live(c)||!inviteButton.isConnected)return;inviteButton.disabled=true;await call('festival_invite',{...expected,npcId:id});if(live(c)&&inviteButton.isConnected){toast(profile(id).name+'同意参加当前版本');open();}}catch(e){if(live(c)&&inviteButton.isConnected){toast(e.message);invite(id);}}};
  }catch(e){toast(e.message);}
 }
 artReady.then(paint).catch(()=>{});return{open,paint,design,invite,inspect:()=>({busy,draft:hydrateFestival(state()).draft})};
}
