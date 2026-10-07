import {specializationView,specializationOffer,chooseSpecialization,acceptSpecializationCommission,specializationDelivery,specializationMoment} from './specialization.js';
import {deliverSpecializationOrder} from './economy.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {BUILDINGS} from './world.js';
import {itemMarkup} from './artStore.js';
import {specializationSeal} from './specializationArt.js';
import {esc} from './journeyUI.js';
export function createSpecializationUI({deliver=null,state,theme,openModal,persist,renderUI,toast,detail,farm,party,back,celebrate}){
 const $=id=>document.getElementById(id);
 function open(feedback=''){
  const s=state(),v=specializationView(s),selected=v.paths.find(p=>p.id===v.selected);
  const cards=v.paths.map(p=>{
   const goals=p.goals.filter(g=>g.target>0).map(g=>'<li><div><span>'+esc(g.name)+'</span><b>'+g.value+' / '+g.target+'</b></div><progress max="'+g.target+'" value="'+Math.min(g.value,g.target)+'"></progress></li>').join('');
   return '<article class="specialization-path '+(p.id===v.selected?'selected':'')+'" data-path="'+p.id+'" style="--path-color:'+p.color+'"><header>'+specializationSeal(p.id,p.rank,theme())+'<div><small>'+p.name+' · '+p.rank+' / 5 阶</small><h3>'+p.title+'</h3></div></header><p>'+p.tagline+'</p><div class="specialization-ranks" aria-label="专精阶位">'+p.titles.map((title,i)=>'<i class="'+(i<p.rank?'earned':'')+'" title="'+title+'">'+(i+1)+'</i>').join('')+'</div>'+(p.rank<5?'<ul class="specialization-goals">'+goals+'</ul>':'<div class="specialization-master"><b>五阶称号已留下</b><p>继续接受不同作品的品质委托，丰富你的小岛与收藏。</p></div>')+'<footer><button class="secondary" data-select-path="'+p.id+'" '+(!v.unlocked||p.id===v.selected?'disabled':'')+'>'+(p.id===v.selected?'当前经营方向':'选为经营方向')+'</button>'+(p.ready?'<button class="primary" data-career-moment="'+p.id+'">见证第 '+(p.rank+1)+' 阶 →</button>':'')+'</footer><details><summary>相关场所与下一步</summary><p>'+p.buildings.map(id=>BUILDINGS[id].name).join(' · ')+'</p><div>'+(p.id==='garden'?'<button class="secondary" data-growth-route="farm">种植不同作物</button><button class="secondary" data-growth-item="c14_0">查看温室手作</button>':p.id==='artisan'?'<button class="secondary" data-growth-item="lantern">查看木作图纸</button><button class="secondary" data-growth-item="pottery">查看陶艺图纸</button>':'<button class="secondary" data-growth-route="party">筹备下一场活动</button><button class="secondary" data-growth-item="bread">准备活动点心</button>')+'</div></details></article>';
  }).join('');
  const c=v.commission,offer=c||specializationOffer(s),status=c?.status==='delivered'?'今日委托已交付':c?'接单后亲手制作，品质达标才可交付':'今日专精委托';
  const delivery=c&&specializationDelivery(s);
  const order=offer?'<article class="specialization-commission" data-commission="'+offer.id+'"><header><small>'+status+'</small><b>第 '+offer.day+' 天 · 全岛每天一份</b></header><div class="specialization-order-body"><div class="specialization-item-art">'+itemMarkup(offer.item,theme())+'</div><div><h3>'+ITEM_BY_ID[offer.item].name+' ×1</h3><p>品质 ≥'+offer.quality+' · '+BUILDINGS[ITEM_BY_ID[offer.item].building].name+'</p><p>报价 '+offer.reward+' − 交付费 '+offer.cost+' = 净收入 <b>'+offer.net+' 岛币</b></p><p class="specialization-order-note">'+(c?.status==='delivered'?'作品已经被带走，明天会有新的委托。':c?.production?'已制作达标作品 · 实物仍需保留在可用背包中。':'先接单，再在小游戏中做出达标作品；原有库存和自动生产不计本次品质。')+'</p></div></div><div class="specialization-order-actions">'+(!c?'<button class="primary" id="careerAccept">接受今日委托</button>':c.status==='delivered'?'': '<button class="primary" id="careerDeliver" '+(!delivery.ok?'disabled':'')+'>交付作品 · +'+offer.net+' 岛币</button>')+'<button class="secondary" data-growth-item="'+offer.item+'">查看图纸与材料</button></div>'+(c&&c.status!=='delivered'&&!delivery.ok?'<p class="specialization-reason">'+esc(delivery.reason)+'</p>':'')+'</article>':'<div class="specialization-order-empty"><h3>'+(!v.unlocked?'第一场派对，是第二章的开始。':'先选一个方向，看看今天的品质委托。')+'</h3><p>'+(!v.unlocked?'亲手完成并结算星灯夜集、钓鱼大会、手作集市、穿搭秀或烟花大会中的任意一场，即可选择专精；现在完成的个人作品仍会保留。':'三个方向的成果都能积累。今天选定后，下一游戏日可调整；委托不因切换方向重置。')+'</p></div>';
  const history=s.specialization.history.slice(-6).reverse().map(c=>'<li><span>第 '+c.day+' 天 · '+esc(ITEM_BY_ID[c.item].name)+'</span><b>'+(c.status==='delivered'?'已交付 · 净入 '+c.net:'到期 · 未扣物资')+'</b></li>').join('');
  openModal('经营专精 · 海岛的第二章','把亲手完成的经营，做成这座岛的风格。',
   '<section class="specialization-opening"><div><small>CHAPTER 02 / 生长有声</small><h3>'+esc(selected?selected.name+'，从今天继续。':'一座岛，可以有三种生长方向。')+'</h3><p>采收、手作与实际承办留下个人进度。每阶收下永久称号和地图徽记，委托按真实作品结算。</p></div><span class="specialization-day">第 '+s.day+' 天</span></section>'+(feedback?'<p class="specialization-feedback" role="status">'+esc(feedback)+'</p>':'')+'<div class="specialization-paths">'+cards+'</div>'+order+(history?'<details class="specialization-history"><summary>最近的经营委托</summary><ul>'+history+'</ul></details>':'')+'<p class="specialization-footnote">个人进度跨方向保留；同一游戏日只记一次经营日。委托当天有效，过期不扣款。称号不会额外发放金币或提高挂机产量。</p>',
   '<button class="secondary" id="careerBack">返回岛屿手账</button><button class="primary" id="careerRefresh">查看最新进度</button>');
  $('modalRoot').querySelector('.modal').classList.add('specialization-modal');
  $('careerBack').onclick=back;$('careerRefresh').onclick=()=>open();
  document.querySelectorAll('[data-select-path]').forEach(b=>b.onclick=()=>{const r=chooseSpecialization(s,b.dataset.selectPath);if(r.ok){persist();renderUI();}open(r.ok?'经营方向已记下，其他方向的已有成果也会保留。':r.reason)});
  document.querySelectorAll('[data-career-moment]').forEach(b=>b.onclick=()=>{const m=specializationMoment(s,b.dataset.careerMoment);if(m)celebrate(m)});
  document.querySelectorAll('[data-growth-item]').forEach(b=>b.onclick=()=>detail(b.dataset.growthItem));
  document.querySelectorAll('[data-growth-route]').forEach(b=>b.onclick=()=>b.dataset.growthRoute==='farm'?farm():party());
  if($('careerAccept'))$('careerAccept').onclick=()=>{const r=acceptSpecializationCommission(s,offer.id,offer.item);if(r.ok){persist();renderUI();}open(r.ok?'委托已确定，亲手制作一件符合品质的作品。':r.reason)};
  if($('careerDeliver'))$('careerDeliver').onclick=async()=>{if(deliver){try{const r=await deliver(c.id);toast(r.receipt.text);open('作品已交付，费用与净收入记入经营台账。')}catch(e){toast(e.message);if(!document.querySelector('#serverCommerce:not(.hidden)'))open(e.message)}return;}const r=deliverSpecializationOrder(s);if(r.ok){persist();renderUI();toast('专精委托交付 · +'+r.commission.net+' 岛币')}open(r.ok?'作品已交付，费用与净收入记入经营台账。':r.reason)};
 }
 return {open};
}
