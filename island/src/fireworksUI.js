import {cooperationMarkup} from './cooperationUI.js';
import {modalNavigationToken} from './modalNavigation.js';
import {hydrateFireworks,fireworksNeeds,fireworksReadiness} from './fireworksParty.js';
import {eventRequests,eventCost,partyDraftStamp} from './partyPlanning.js';
import {mountPartyDesigner} from './partyDesigner.js';
import {FIREWORKS_EQUIPMENT} from './fireworksRules.js';
import {itemMarkup,artReady} from './artStore.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {availableQuantity} from './resourceLedger.js';
import {relationshipInvitation} from './residentStories.js';
import {esc} from './journeyUI.js';
export function createFireworksUI({state,theme,profile,portrait,openModal,toast,persist,command,back,start,play,collections}){
 let busy=false,signature='';const q=id=>document.getElementById(id),capture=()=>({theme:theme(),slot:state().saveSlot}),live=c=>theme()===c.theme&&state().saveSlot===c.slot;
 const args=()=>{const d=hydrateFireworks(state()).draft;return{eventId:d?.id||null,eventVersion:d?.version||null,eventStamp:partyDraftStamp(d)};};
 async function ensure(){await command('fireworks_enable');}
 async function call(op,extra={}){if(busy)throw Error('先等当前烟花大会操作确认');busy=true;try{return(await command(op,{...args(),...extra})).receipt?.details;}finally{busy=false;}}
 const icon=id=>itemMarkup(id,theme(),'fishing-item'),costs=items=>Object.entries(items).map(([id,n])=>'<span>'+(id==='coins'?'组织费 '+n+' 岛币':icon(id)+esc(ITEM_BY_ID[id].name)+' ×'+n)+'</span>').join('');
 async function open(){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;const f=hydrateFireworks(state());if(f.session?.phase==='running'){play.resume();return;}
   signature='';openModal(f.draft?.name||'星海烟花大会手账','让有限烟花、海风和伙伴的节拍，织成三幕星空。','<div id="fireworksBoard"></div>','<button class="secondary" id="fireworksBookBack">返回派对</button>');q('fireworksBookBack').onclick=back;paint();
  }catch(e){toast(e.message);}
 }
 function paint(){
  if(busy)return;const root=q('fireworksBoard');if(!root)return;
  const s=state(),f=hydrateFireworks(s),d=f.draft,g=f.session,need=d?fireworksNeeds(s):null,readiness=d?fireworksReadiness(s):null,next=JSON.stringify([theme(),f,need,readiness,s.coins]);if(next===signature)return;signature=next;
  const scroll=root.closest('.modal-body')?.scrollTop||0;
  root.innerHTML='<section class="fishing-hero fireworks-book-hero"><div><small>STAR TIDE / THREE ACTS</small><h3>把海风与星光，<br>写进这一晚的烟花</h3><p>备好六枚烟花，邀请设备、观星和音乐伙伴。三幕不同风向、颜色与形状，亲手瞄准星圈、在节拍里绽放。</p><span>三位协作伙伴 · 三幕随机风向 · 品质收益0–78岛币</span></div><img src="/assets/fireworks-orbit-'+theme()+'-v90.png" alt="SR 星潮留影灯"/></section>'+
  (g?'<section class="fishing-prep"><h4>'+esc(g.name)+' · '+(g.phase==='claimed'?'本场已完成':'本场已提前结束')+'</h4><p>'+(g.result?'完成 '+g.result.completed+'/3 · 平均品质 '+g.result.quality+'/100 · 合拍命中 '+g.result.hits+'/6 · 收益 '+g.paid+' 岛币':'未发射烟花与旗帜已解除预留；实际发射者、场地费与茶叶保留消耗，本场不发收益。')+'</p><p>'+(g.result?.passed?'本场达到纪念条件，可到收藏查看星潮留影灯。':'未达到纪念条件。只消耗实际发射的数量，未发射者可留给下一场。')+'</p>'+cooperationMarkup(s,g,theme())+'<button class="primary" id="fireworksArchive">收起结果 · 准备下一场</button><button class="secondary" id="fireworksCollections">查看奇观收藏</button></section>':
  !d?'<section class="fishing-create"><h4>筹备星海烟花大会</h4><p>先开放烟花与海风旗的图纸，采集、制作六枚烟花，再筹备活动。小墨、星野、黎音三位协作居民需亲自邀请，可额外邀请一位主题嘉宾。</p><button class="primary" id="fireworksBasic">发布基础烟花大会</button><button class="secondary" id="fireworksDesign">设计主题与嘉宾</button></section>':
  '<section class="fishing-prep"><h4>'+esc(d.name)+' · 第 '+d.version+' 版</h4><p>'+esc(d.description||'让海岛伙伴一起完成三幕星海演出。')+'</p><div class="party-preview-people">'+eventRequests(d).map(p=>'<article><div class="party-preview-portrait">'+portrait(p.id)+'</div><div><b>'+esc(profile(p.id).name)+'</b><small>'+esc(p.role)+'</small><span>'+icon(p.item)+esc(ITEM_BY_ID[p.item].name)+' ×'+p.quantity+(d.inviteGifts[p.id]?.delivered?.[p.item]?' · 已送达':' · 待送达')+'</span><button class="secondary" data-fireworks-invite="'+p.id+'">'+(d.invites[p.id]?.version===d.version?'本版已确认 · 查看约定':'对话并邀请')+'</button></div></article>').join('')+'</div><h5>01 / 本场消耗</h5><div class="material-costs">'+costs(eventCost(d))+'</div><h5>02 / 六枚实际烟花与海风旗</h5><div class="material-costs">'+costs(FIREWORKS_EQUIPMENT)+'</div><p>六枚烟花在本场留用，只扣除实际发射者；未发射烟花和海风旗在结束或取消时归还。赠物单独核算。</p><p class="hint">'+esc(readiness.reason||'物资和本版同意已齐，可以沿道路去广场开场。')+'</p>'+(Object.keys(need.missing).length?'<div class="material-costs">'+costs(need.missing)+'</div>':'')+'<div class="night-party-actions"><button class="primary" id="fireworksHost" '+(!readiness.ready?'disabled':'')+'>赴约 · 开办三幕烟花大会</button><button class="secondary" id="fireworksPlan">请管家筹备物资</button><button class="secondary" id="fireworksDesign">修改主题方案</button><button class="secondary" id="fireworksCancelDraft">取消筹备</button></div><p class="mini-explain">三幕各编排两枚烟花，选择颜色、形状和不同发射位，按风向瞄准星圈、配合亮拍绽放。六枚全部发射、至少五枚合拍命中且品质75分，可得SR星潮留影灯。</p></section>')+
  '<section class="fishing-prep"><h4>星空约定</h4><p>协作居民与岛主沿真实道路到独立岗位，全部到齐才开始。每幕60秒编排、12秒烟花演出，观察风向、星圈与时间轴，再亲手发射。</p><p>每天与夜集、钓鱼、集市、穿搭共用一次承办机会。14岛币场地费、茶叶×1、实际发射烟花和已送赠物不退；提前结束不发收益或纪念品。</p></section>';
  if(q('fireworksBasic'))q('fireworksBasic').onclick=async()=>{try{await call('fireworks_create',{proposal:{template:'fireworks',name:'星海烟花大会',description:'和小墨、星野、黎音一起把海风、色彩与节拍写成三幕烟花。',tags:['craft','stars'],difficulty:'normal',guestId:null}});open();}catch(e){toast(e.message);}};
  if(q('fireworksDesign'))q('fireworksDesign').onclick=design;
  if(g){q('fireworksArchive').onclick=async()=>{try{await call('fireworks_archive',{eventId:g.id});open();}catch(e){toast(e.message);}};q('fireworksCollections').onclick=collections;}
  if(d){
   root.querySelectorAll('[data-fireworks-invite]').forEach(b=>b.onclick=()=>invite(Number(b.dataset.fireworksInvite)));
   q('fireworksHost').onclick=()=>start(d);q('fireworksPlan').onclick=async()=>{try{await call('fireworks_plan');toast('烟花大会物资筹备已登记，按实际配方安排分工。');open();}catch(e){toast(e.message);}};
   q('fireworksCancelDraft').onclick=async()=>{try{await call('fireworks_cancel');toast('筹备已取消，未发射烟花与旗帜保留。');open();}catch(e){toast(e.message);}};
  }
  if(root.closest('.modal-body'))root.closest('.modal-body').scrollTop=scroll;
 }
 async function design(){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;openModal('为烟花大会写一封邀请','选择主题、预览实际协作居民，再发布到手账。','<div id="fireworksDesigner"></div>');
   mountPartyDesigner(q('fireworksDesigner'),{state,theme,profile,portrait,persist,toast,template:'fireworks',getPartyState:hydrateFireworks,onPublished:open,publish:async(p,expected)=>call(expected.expectedId?'fireworks_update':'fireworks_create',{proposal:p,eventId:expected.expectedId,eventVersion:expected.expectedVersion,eventStamp:expected.expectedStamp}),request:async(input,expected)=>{persist();const r=await fetch('/api/parties/'+theme()+'/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),worldKey:state().saveSlot,input,...expected}),signal:AbortSignal.timeout(60000)}),data=await r.json();if(!r.ok)throw Error(data.error||'主题建议暂时不可用');return data;}});
  }catch(e){toast(e.message);}
 }
 async function invite(id){
  const c=capture(),navigation=modalNavigationToken();try{await ensure();if(!live(c)||!navigation.current())return;const d=hydrateFireworks(state()).draft,p=d&&eventRequests(d).find(p=>p.id===id);if(!p){toast('这位居民不在当前烟花大会邀请名单');return;}
   const inviteProject=state().workProjects?.find(p=>p.id===d.projectId),planWaiting=!!(inviteProject&&['preparing','paused'].includes(inviteProject.status)),inviteOwner=inviteProject?.status==='ready'?'project:'+d.projectId:null;
   const gift=!!d.inviteGifts[id]?.delivered?.[p.item],confirmed=d.invites[id]?.version===d.version,willing=relationshipInvitation(state(),id,eventRequests(d).map(r=>r.id)),expected={eventId:d.id,eventVersion:d.version,eventStamp:partyDraftStamp(d)};
   openModal(profile(id).name+' · 烟花大会之约',d.name+' · 第 '+d.version+' 版','<div class="conversation-stage"><aside class="character-stage">'+portrait(id)+'</aside><article class="conversation-body"><blockquote class="dialogue-bubble">'+esc(confirmed?'我已经答应这版烟花大会。收好手边的工作，就去广场自己的席位。':p.request)+'</blockquote><p>'+icon(p.item)+esc(ITEM_BY_ID[p.item].name)+' ×'+p.quantity+' · '+(gift?'已送达，重新确认不再扣除':'实际送达后确认本版参加')+'</p><p>'+esc(willing.ready?(!gift&&(planWaiting||availableQuantity(state(),p.item,inviteOwner)<p.quantity)?'赠物尚未可用；筹备计划先备齐六枚烟花、旗帜、后台茶和赠物，再逐位邀请。':'约定确认后，开场时会沿道路赴约。'):willing.reason)+'</p></article></div>','<button class="secondary" id="fireworksInviteBack">返回手账</button><button class="primary" id="fireworksInviteConfirm" '+(confirmed||!willing.ready||!gift&&(planWaiting||availableQuantity(state(),p.item,inviteOwner)<p.quantity)?'disabled':'')+'>'+(confirmed?'本版已确认':gift?'重新确认参加':'送达物品并邀请')+'</button>');
   q('fireworksInviteBack').onclick=open;const inviteButton=q('fireworksInviteConfirm');inviteButton.onclick=async()=>{try{if(!live(c)||!inviteButton.isConnected)return;inviteButton.disabled=true;await call('fireworks_invite',{...expected,npcId:id});if(live(c)&&inviteButton.isConnected){toast(profile(id).name+'同意参加当前版本');open();}}catch(e){if(live(c)&&inviteButton.isConnected){toast(e.message);invite(id);}}};
  }catch(e){toast(e.message);}
 }
 artReady.then(paint).catch(()=>{});return{open,paint,design,invite,inspect:()=>({busy,draft:hydrateFireworks(state()).draft})};
}
