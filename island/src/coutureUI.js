import {wonderRewardMarkup} from './wonderRewardUI.js';
import {cooperationMarkup} from './cooperationUI.js';
import {modalNavigationToken} from './modalNavigation.js';
import {hydrateCouture,coutureNeeds,coutureReadiness} from './coutureParty.js';
import {eventRequests,eventCost,partyDraftStamp} from './partyPlanning.js';
import {mountPartyDesigner} from './partyDesigner.js';
import {COUTURE_EQUIPMENT} from './coutureRules.js';
import {itemMarkup,artReady} from './artStore.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {availableQuantity} from './resourceLedger.js';
import {relationshipInvitation} from './residentStories.js';
import {esc} from './journeyUI.js';
export function createCoutureUI({state,theme,profile,portrait,openModal,toast,persist,command,back,start,play,collections}){
 let busy=false,signature='';const q=id=>document.getElementById(id),capture=()=>({theme:theme(),slot:state().saveSlot}),live=c=>theme()===c.theme&&state().saveSlot===c.slot;
 const args=()=>{const d=hydrateCouture(state()).draft;return{eventId:d?.id||null,eventVersion:d?.version||null,eventStamp:partyDraftStamp(d)};};
 async function ensure(){await command('couture_enable');}
 async function call(op,extra={}){if(busy)throw Error('先等当前穿搭大会操作确认');busy=true;try{return(await command(op,{...args(),...extra})).receipt?.details;}finally{busy=false;}}
 const icon=id=>itemMarkup(id,theme(),'fishing-item'),costs=items=>Object.entries(items).map(([id,n])=>'<span>'+(id==='coins'?'组织费 '+n+' 岛币':icon(id)+esc(ITEM_BY_ID[id].name)+' ×'+n)+'</span>').join('');
 async function open(){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;const f=hydrateCouture(state());if(f.session?.phase==='running'){play.resume();return;}
   signature='';openModal(f.draft?.name||'海岛穿搭大会手账','让真实服装、岛民故事与自信的姿态共同登台。','<div id="coutureBoard"></div>','<button class="secondary" id="coutureBookBack">返回派对</button>');q('coutureBookBack').onclick=back;paint();
  }catch(e){toast(e.message);}
 }
 function paint(){
  if(busy)return;const root=q('coutureBoard');if(!root)return;
  const s=state(),f=hydrateCouture(s),d=f.draft,g=f.session,need=d?coutureNeeds(s):null,readiness=d?coutureReadiness(s):null,next=JSON.stringify([theme(),f,need,readiness,s.coins]);if(next===signature)return;signature=next;
  const scroll=root.closest('.modal-body')?.scrollTop||0;
  const hero='<section class="fishing-hero couture-book-hero"><div><small>ISLAND ATELIER</small><h3>让每位居民，<br>穿出自己的闪光时刻</h3><p>备好实际服装，邀请评审与三位模特。三轮不同场合，兼顾主题与舒适；登台后用四拍姿态展示自己的作品。</p><span>三位真实模特 · 三轮随机要求 · 品质收益0–54岛币</span></div><img src="/assets/couture-ribbon-'+theme()+'-v89.png" alt="R 星织展示台"/></section>';
  root.innerHTML=(g?'':hero)+
  (g?'<section class="fishing-prep"><h4>'+esc(g.name)+' · '+(g.phase==='claimed'?'本场已完成':'本场已提前结束')+'</h4><p>'+(g.result?'完成 '+g.result.completed+'/3 · 平均品质 '+g.result.quality+'/100 · 亮拍 '+g.result.poseHits+'/12 · 收益 '+g.paid+' 岛币':'服装已解除预留；已投入的场地费、纤维和茶叶保留消耗，本场不发收益。')+'</p><p>'+(g.result?.passed?'本场达到纪念条件，可到收藏查看星织展示台。':'未达到纪念条件。服装不会被消耗，可为下一场重新准备。')+'</p>'+wonderRewardMarkup(s,g,theme())+cooperationMarkup(s,g,theme())+'<button class="primary" id="coutureArchive">收起结果 · 准备下一场</button><button class="secondary" id="coutureCollections">查看奇观收藏</button></section>':
  !d?'<section class="fishing-create"><h4>筹备海岛穿搭大会</h4><p>先在服装店完成至少5次制作、提升品质到60分并备齐六件基础服装，再发布活动。评审和模特共六位，必须亲自对话确认参加；主题嘉宾可额外邀请一位。</p><button class="primary" id="coutureBasic">发布基础穿搭大会</button><button class="secondary" id="coutureDesign">设计主题与嘉宾</button></section>':
  '<section class="fishing-prep"><h4>'+esc(d.name)+' · 第 '+d.version+' 版</h4><p>'+esc(d.description||'让每位居民穿出自己的海岛故事。')+'</p><div class="party-preview-people">'+eventRequests(d).map(p=>'<article><div class="party-preview-portrait">'+portrait(p.id)+'</div><div><b>'+esc(profile(p.id).name)+'</b><small>'+esc(p.role)+'</small><span>'+icon(p.item)+esc(ITEM_BY_ID[p.item].name)+' ×'+p.quantity+(d.inviteGifts[p.id]?.delivered?.[p.item]?' · 已送达':' · 待送达')+'</span><button class="secondary" data-couture-invite="'+p.id+'">'+(d.invites[p.id]?.version===d.version?'本版已确认 · 查看约定':'对话并邀请')+'</button></div></article>').join('')+'</div><h5>01 / 本场消耗</h5><div class="material-costs">'+costs(eventCost(d))+'</div><h5>02 / 六件实际服装与活动旗</h5><div class="material-costs">'+costs(COUTURE_EQUIPMENT)+'</div><p>服装与活动旗仅预留，不会消耗。背包中其他未穿戴的可用服装也可入场，结束或取消后归还。虚拟造型额度只用于评审搭配，不扣岛币。</p><p class="hint">'+esc(readiness.reason||'物资和本版同意已齐，可以沿道路去广场开场。')+'</p>'+(Object.keys(need.missing).length?'<div class="material-costs">'+costs(need.missing)+'</div>':'')+'<div class="night-party-actions"><button class="primary" id="coutureHost" '+(!readiness.ready?'disabled':'')+'>赴约 · 开办三轮穿搭大会</button><button class="secondary" id="couturePlan">请管家筹备物资</button><button class="secondary" id="coutureDesign">修改主题方案</button><button class="secondary" id="coutureCancelDraft">取消筹备</button></div><p class="mini-explain">每轮主服、头饰、外搭必选；其他服装可选。要求会在可行范围内随机生成。三位完成展示、平均品质65分、亮拍至少6次，可获首场R星织展示台，后续合格活动增加纪念印记；品质85分且亮拍至少10次，还可收藏SR缪斯衣架。</p></section>')+
  (g?hero:'')+'<section class="fishing-prep"><h4>秀场约定</h4><p>评审、模特与岛主沿真实道路去独立席位；当前模特穿上本轮服装，再走到展示位。等待与走路不消耗姿态时间。观察亮拍，用挥手、转身、致意三种动作响应四拍提示。</p><p>每天与星灯夜集、钓鱼大会、手作集市共用一次承办机会。12岛币场地费、纤维×2、茶叶×1和已送赠物不退回。提前结束不发收益、不发纪念品。</p></section>';
  if(q('coutureBasic'))q('coutureBasic').onclick=async()=>{try{await call('couture_create',{proposal:{template:'couture',name:'海岛穿搭大会',description:'让三位居民穿出自己的海岛故事。',tags:['craft','stars'],difficulty:'normal',guestId:null}});open();}catch(e){toast(e.message);}};
  if(q('coutureDesign'))q('coutureDesign').onclick=design;
  if(g){q('coutureArchive').onclick=async()=>{try{await call('couture_archive',{eventId:g.id});open();}catch(e){toast(e.message);}};q('coutureCollections').onclick=collections;}
  if(d){
   root.querySelectorAll('[data-couture-invite]').forEach(b=>b.onclick=()=>invite(Number(b.dataset.coutureInvite)));
   q('coutureHost').onclick=()=>start(d);q('couturePlan').onclick=async()=>{try{await call('couture_plan');toast('穿搭大会物资筹备已登记，按实际配方安排分工。');open();}catch(e){toast(e.message);}};
   q('coutureCancelDraft').onclick=async()=>{try{await call('couture_cancel');toast('筹备已取消，未用服装保留。');open();}catch(e){toast(e.message);}};
  }
  if(root.closest('.modal-body'))root.closest('.modal-body').scrollTop=scroll;
 }
 async function design(){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;openModal('为穿搭大会写一封邀请','选择主题、预览实际评审与模特，再发布到手账。','<div id="coutureDesigner"></div>');
   mountPartyDesigner(q('coutureDesigner'),{state,theme,profile,portrait,persist,toast,template:'couture',getPartyState:hydrateCouture,onPublished:open,publish:async(p,expected)=>call(expected.expectedId?'couture_update':'couture_create',{proposal:p,eventId:expected.expectedId,eventVersion:expected.expectedVersion,eventStamp:expected.expectedStamp}),request:async(input,expected)=>{persist();const r=await fetch('/api/parties/'+theme()+'/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),worldKey:state().saveSlot,input,...expected}),signal:AbortSignal.timeout(60000)}),data=await r.json();if(!r.ok)throw Error(data.error||'主题建议暂时不可用');return data;}});
  }catch(e){toast(e.message);}
 }
 async function invite(id){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;const d=hydrateCouture(state()).draft,p=d&&eventRequests(d).find(p=>p.id===id);if(!p){toast('这位居民不在当前穿搭大会邀请名单');return;}
   const inviteProject=state().workProjects?.find(p=>p.id===d.projectId),planWaiting=!!(inviteProject&&['preparing','paused'].includes(inviteProject.status)),inviteOwner=inviteProject?.status==='ready'?'project:'+d.projectId:null;
   const gift=!!d.inviteGifts[id]?.delivered?.[p.item],confirmed=d.invites[id]?.version===d.version,willing=relationshipInvitation(state(),id,eventRequests(d).map(r=>r.id)),expected={eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)};
   openModal(profile(id).name+' · 穿搭大会之约',d.name+' · 第 '+d.version+' 版','<div class="conversation-stage"><aside class="character-stage">'+portrait(id)+'</aside><article class="conversation-body"><blockquote class="dialogue-bubble">'+esc(confirmed?'我已经答应这版穿搭大会。收好手边的工作，就去广场自己的席位。':p.request)+'</blockquote><p>'+icon(p.item)+esc(ITEM_BY_ID[p.item].name)+' ×'+p.quantity+' · '+(gift?'已送达，重新确认不再扣除':'实际送达后确认本版参加')+'</p><p>'+esc(willing.ready?(!gift&&(planWaiting||availableQuantity(state(),p.item,inviteOwner)<p.quantity)?'赠物尚未可用；筹备计划先备齐衣架、后台用品和赠物，再逐位邀请。':'约定确认后，开场时会沿道路赴约。'):willing.reason)+'</p></article></div>','<button class="secondary" id="coutureInviteBack">返回手账</button><button class="primary" id="coutureInviteConfirm" '+(confirmed||!willing.ready||!gift&&(planWaiting||availableQuantity(state(),p.item,inviteOwner)<p.quantity)?'disabled':'')+'>'+(confirmed?'本版已确认':gift?'重新确认参加':'送达物品并邀请')+'</button>');
   q('coutureInviteBack').onclick=open;const inviteButton=q('coutureInviteConfirm');inviteButton.onclick=async()=>{try{if(!live(c)||!inviteButton.isConnected)return;inviteButton.disabled=true;await call('couture_invite',{...expected,npcId:id});if(live(c)&&inviteButton.isConnected){toast(profile(id).name+'同意参加当前版本');open();}}catch(e){if(live(c)&&inviteButton.isConnected){toast(e.message);invite(id);}}};
  }catch(e){toast(e.message);}
 }
 artReady.then(paint).catch(()=>{});return{open,paint,design,invite,inspect:()=>({busy,draft:hydrateCouture(state()).draft})};
}
