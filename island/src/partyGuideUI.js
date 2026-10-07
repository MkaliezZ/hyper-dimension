import {hostingView} from './partyHosting.js';
import {partyGuideSummary,partyGuide,PARTY_GUIDES} from './partyGuide.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {itemMarkup} from './artStore.js';
import {esc} from './journeyUI.js';
export function createPartyGuideUI({state,theme,profile,openModal,openTemplate,invite,projects,detail,stories,collections,legacy,hosting=null,toast=()=>{}}){
 let signature='',legacyFireworks=false;
 function hostCard(c){if(!hosting||!state()[c.field]?.draft)return '';const h=hostingView(state(),c.template);return '<section class="party-hosting" data-host-state="'+(h?.phase||'none')+'"><h5>'+(h?'管家主持 · '+esc(h.label):'请管家召集这一场')+'</h5><p>'+esc(h?h.message:'你亲自取得本版同意，伙伴按真实配方筹备。回到小岛后，由管家核对用品与当天额度、召集并带你入场。')+'</p><small>单次委托 · 按实际费用开场 · 小游戏由你操作</small><button class="secondary" data-party-host="'+c.template+'" '+(h?.phase==='started'?'disabled':'')+'>'+(h?'收回主持委托':'交给管家 · 就绪后召集')+'</button></section>';}
 const icon=id=>itemMarkup(id,theme(),'party-guide-icon');
 function open(){
  signature='';openModal('小岛相聚手账','从一份主题，走到大家真正到场的一次相聚。','<div id="partyGuideRoot"></div>','<button class="secondary" id="partyGuideCollections">查看奇观与相聚纪念</button>');
  document.querySelector('#modalRoot .modal')?.classList.add('party-guide-modal');
  document.getElementById('partyGuideCollections').onclick=collections;paint();
 }
 function act(template){
  const next=partyGuide(state(),template)?.next;if(!next)return;
  if(next.kind==='invite')return invite(template,next.npcId);
  if(next.kind==='story')return stories(next.npcId);
  if(next.kind==='project')return projects();
  if(next.kind==='item')return detail(next.item);
  return openTemplate(next.kind==='active'?next.template:template);
 }
 function paint(){
  const summary=partyGuideSummary(state()),button=document.getElementById('partyBtn');
  if(button){let badge=document.getElementById('partyGuideBadge');if(!badge){badge=document.createElement('span');badge.id='partyGuideBadge';badge.className='party-guide-badge';badge.setAttribute('aria-hidden','true');button.append(badge);}
   badge.hidden=!summary.due;badge.textContent=String(summary.due);button.title=summary.due?'相聚手账 · '+summary.due+'场有待办邀请或可开场':'相聚手账 · 查看五种活动的实际筹备';}
  const root=document.getElementById('partyGuideRoot');if(!root)return;
  const l=legacy(),next=JSON.stringify([theme(),summary,state().partyHosting,l.ready,l.relationship?.reason,l.fireworksAvailable,legacyFireworks]);if(next===signature)return;signature=next;
  const body=root.closest('.modal-body'),scroll=body?.scrollTop||0,focus=document.activeElement?.id;
  root.innerHTML='<header class="party-guide-intro"><div>'+icon('lantern')+'</div><section><small>ISLAND GATHERINGS / 第 '+summary.day+' 天</small><h3>一起认真准备，<br>让相聚值得被记住。</h3><p>方案 → 物资 → 亲自邀请 → 沿路到场 → 举办与纪念</p><span class="party-guide-daily">'+(summary.active?'有一场活动正在举办':summary.used?'今日承办已用 · 可继续准备明天':'今日承办可用 · 五种活动共用一次')+'</span></section></header><div class="party-guide-grid">'+summary.cards.map(c=>'<article class="party-guide-card" data-party-template="'+c.template+'" data-phase="'+c.phase+'"><header><span class="party-guide-cover">'+icon(c.item)+'</span><div><small>'+esc(c.venue)+'</small><h4>'+esc(c.name)+'</h4>'+(c.version?'<span class="party-guide-version">第 '+c.version+' 版</span>':'')+'</div><span class="party-guide-status">'+esc(c.label)+'</span></header><p class="party-guide-description">'+esc(c.description)+'</p><ol class="party-guide-steps">'+['方案','物资','邀请','到场','承办'].map((name,i)=>'<li class="'+(c.steps[i]?'done':'')+'"><span>'+(c.steps[i]?'✓':i+1)+'</span>'+name+'</li>').join('')+'</ol>'+(c.people.length?'<div class="party-guide-people">'+c.people.map(p=>'<button class="party-guide-person '+(p.confirmed?'confirmed':'')+'" data-party-invite="'+c.template+':'+p.id+'" title="'+esc(p.role+' · '+(p.confirmed?'已同意本版':p.gift?'赠物已送达，待重新确认':'赠物尚待交付'))+'"><b>'+esc(p.name)+'</b><small>'+esc(p.confirmed?'已同意':p.gift?'待重邀':'待邀请')+'</small></button>').join('')+'</div>':'')+(c.missing.length?'<div class="party-guide-missing">'+c.missing.slice(0,4).map(m=>'<button data-party-item="'+m.item+'">'+(m.item==='coins'?'<span class="party-guide-coin">币</span>':icon(m.item))+'<span>'+esc(m.item==='coins'?'岛币':ITEM_BY_ID[m.item]?.name||m.item)+'<b>还缺 '+m.missing+'</b></span></button>').join('')+(c.missing.length>4?'<small>另有 '+(c.missing.length-4)+' 类，在手账查看</small>':'')+'</div>':'')+'<div class="party-guide-next"><p>'+esc(c.message)+'</p><button class="primary" data-party-next="'+c.template+'">'+esc(c.next.label)+'</button></div><button class="secondary party-guide-book" id="'+c.openId+'">打开'+esc(PARTY_GUIDES.find(x=>x.template===c.template).name.replace(/海岛|海风|星海/,'').replace('大会',''))+'手账</button>'+hostCard(c)+'</article>').join('')+'</div>'+(state().partyHosting?.history?.length?'<details class="party-hosting-history"><summary>主持手账 · 最近的委托</summary><ul>'+state().partyHosting.history.slice(0,8).map(h=>'<li><b>'+esc(h.name)+' · '+esc(({finished:'已完成',cancelled:'已收回',stale:'方案已改变'})[h.phase])+'</b>'+esc(h.reason)+'</li>').join('')+'</ul></details>':'')+'<details class="party-guide-legacy" '+(l.ready?'open':'')+'><summary>已有旧版夜集邀请 · 继续原约定</summary><p>保留原存档阿岚与露露的邀请，开场仍核对灯笼、小麦、8岛币和今日次数。新主题与嘉宾请使用上方夜集手账。</p>'+(l.relationship?'<p>'+esc(l.relationship.reason)+'</p><button class="secondary" id="partyStory">听听居民的顾虑</button>':'')+'<label><input type="checkbox" id="partyFireworks" '+(legacyFireworks?'checked ':'')+(!l.fireworksAvailable?'disabled':'')+'> '+icon('firework')+' 烟花助兴 · 实际消耗一枚</label><button class="primary" id="hostParty" '+(l.ready?'':'disabled')+'>开场 · 点亮四盏星灯</button></details>';
  root.querySelectorAll('[data-party-host]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{const t=b.dataset.partyHost,h=hostingView(state(),t);await (h?hosting.cancel(t):hosting.arm(t));signature='';paint();}catch(e){toast(e.message);}finally{if(b.isConnected)b.disabled=false;}});
  root.querySelectorAll('[data-party-next]').forEach(b=>b.onclick=()=>act(b.dataset.partyNext));
  for(const c of PARTY_GUIDES)document.getElementById(c.openId).onclick=()=>openTemplate(c.template);
  root.querySelectorAll('[data-party-invite]').forEach(b=>b.onclick=()=>{const [template,n]=b.dataset.partyInvite.split(':'),c=partyGuide(state(),template),p=c?.people.find(p=>p.id===Number(n));if(!p)return;if(!p.willing)return stories(p.id);return invite(template,p.id);});
  root.querySelectorAll('[data-party-item]').forEach(b=>b.onclick=()=>b.dataset.partyItem==='coins'?openTemplate(b.closest('[data-party-template]').dataset.partyTemplate):detail(b.dataset.partyItem));
  document.getElementById('hostParty').onclick=()=>legacy().start();document.getElementById('partyFireworks').onchange=e=>{legacyFireworks=e.target.checked;};
  if(document.getElementById('partyStory'))document.getElementById('partyStory').onclick=()=>{const r=legacy().relationship;if(r)stories(r.id);};
  if(body)body.scrollTop=scroll;if(focus)document.getElementById(focus)?.focus({preventScroll:true});
 }
 return {open,paint,inspect:()=>partyGuideSummary(state())};
}
