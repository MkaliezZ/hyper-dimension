import {syncWonders,WONDER_DEFINITIONS,RARITIES,wonderAsset,requestWonderDisplay,redeemWonderColor,chooseWonderColor} from './eventWonders.js';
import {ACHIEVEMENTS,achievementMetrics,refreshAchievements,acknowledgeAchievements} from './achievements.js';
import {itemMarkup} from './artStore.js';
import {esc} from './journeyUI.js';
const familyNames={collect:'亲手采集',craft:'亲手制作',unlock:'图纸解锁',host:'实际承办',template:'活动种类',cooperate:'真实协作'};
const rarity=id=>'<span class="collection-rarity" style="--rarity:'+RARITIES[id].color+'">'+id+' · '+RARITIES[id].name+'</span>';
export function createCollectionsUI({state,theme,openModal,persist,toast,recipes,canDisplay=()=>true}){
 let currentTab='wonders',filter='all',lastSnapshot='';
 const signature=()=>JSON.stringify([theme(),state().eventWonders,state().achievementBook,achievementMetrics(state()),currentTab,filter]);
 function paint(){if(!document.querySelector('#modalRoot .collection-modal')||signature()===lastSnapshot||document.activeElement?.tagName==='SELECT')return;const y=document.querySelector('#modalRoot .modal-body').scrollTop;open();document.querySelector('#modalRoot .modal-body').scrollTop=y;}
 function open(tab=currentTab){
  currentTab=tab;const s=state(),w=syncWonders(s),view=refreshAchievements(s),book=view.book,newKeys=new Set(book.unseen);
  const tabs='<nav class="collection-tabs" aria-label="收藏册栏目"><button class="secondary" id="collectionWonders" aria-pressed="'+(tab==='wonders')+'">奇观藏册 · '+Object.keys(w.owned).length+'</button><button class="secondary" id="collectionAchievements" aria-pressed="'+(tab==='achievements')+'">海岛成就 · '+Object.keys(book.awards).length+(book.unseen.length?' / 新 '+book.unseen.length:'')+'</button></nav>';
  const body=tab==='wonders'?wonders(w):achievements(view,newKeys);
  openModal('岛屿收藏册','把做过的事，留下可以看见的记忆。',tabs+body,'<button class="secondary" id="collectionRecipes">继续探索图纸</button>');
  document.querySelector('#modalRoot .modal').classList.add('collection-modal');
  document.getElementById('collectionWonders').onclick=()=>open('wonders');
  document.getElementById('collectionAchievements').onclick=()=>open('achievements');
  document.getElementById('collectionRecipes').onclick=recipes;
  if(tab==='achievements'){acknowledgeAchievements(s);const el=document.getElementById('achievementFilter');el.value=filter;el.onchange=()=>{filter=el.value;open('achievements')};}
  document.querySelectorAll('[data-wonder-display]').forEach(el=>el.onclick=()=>{const id=el.dataset.wonderDisplay,live=state(),current=syncWonders(live),show=!current.displays[id]&&!current.pendingDisplays[id],r=requestWonderDisplay(live,id,show,{canPlace:canDisplay(id)});if(!r.ok){toast(r.reason||'该奇观尚未收藏');return}open();toast(r.pending?'已安排陈列，等居民经过后会自动放好':WONDER_DEFINITIONS[id].name+(syncWonders(state()).displays[id]?'已陈列在'+WONDER_DEFINITIONS[id].location:'已收回收藏册'));});
  document.querySelectorAll('[data-wonder-color]').forEach(el=>el.onclick=()=>{const id=el.dataset.wonder,color=el.dataset.wonderColor,live=state(),current=syncWonders(live),a=current.owned[id];if(!a){toast('该奇观尚未收藏');return}const owned=a.colors.includes(color);const r=owned?{ok:chooseWonderColor(live,id,color)}:redeemWonderColor(live,id,color);if(!r.ok){toast(r.reason||'该配色尚未收藏');return}open();toast(owned?'已经换上新的配色':'用5枚纪念印记收藏了新配色');});
  persist();lastSnapshot=signature();
 }
 function wonders(w){
  return '<div class="collection-intro"><div><small>ISLAND TREASURES</small><h3>每件奇观都有来历</h3><p>完成相聚后，奇观会记入收藏。可以在对应庭院陈列、随时收回；查看来历，核对真实交付、成绩与来访证据。</p></div><div class="collection-legend">'+Object.keys(RARITIES).map(rarity).join('')+'</div></div><div class="wonder-cards">'+Object.values(WONDER_DEFINITIONS).map(d=>{
   const a=w.owned[d.id],color=a?d.colors.find(c=>c.index===a.color)?.id||'sea':'sea';
   const controls=a?'<p class="wonder-counts">纪念印记 <b>'+a.marks+'</b> 枚'+(d.id==='seashell_cup'?' · 获胜 '+a.wins+' 场':'')+'</p><button class="primary" data-wonder-display="'+d.id+'">'+(w.displays[d.id]?'从'+d.location+'收回':w.pendingDisplays[d.id]?'等待陈列 · 点击取消':'陈列到'+d.location)+'</button>':'<p class="wonder-unlock">'+d.condition+'</p>'+(d.id==='cooperation_tree'?'<p class="wonder-counts">已确认协作活动 <b>'+Object.keys(state().wonderControl?.cooperations||{}).length+'</b> / 10 场</p>':d.id==='archipelago_lighthouse'?'<p class="wonder-counts">已确认不同来访岛主 <b>'+Object.keys(state().wonderControl?.visits||{}).length+'</b> / 5 位 · 每场至多新增一位</p>':'');
   const colors=a&&d.colors.length>1?'<div class="wonder-colors"><h4>用重复相聚，收藏新的颜色</h4><p>每个新配色需要5枚印记。已收藏配色可随时切换。</p>'+d.colors.map(c=>'<button class="secondary" data-wonder="'+d.id+'" data-wonder-color="'+c.id+'" aria-pressed="'+(color===c.id)+'" '+(!a.colors.includes(c.id)&&a.marks<5?'disabled':'')+'><img src="'+wonderAsset(d.id,theme(),c.id)+'" alt=""/><span>'+c.name+'<small>'+(color===c.id?'正在展示':a.colors.includes(c.id)?'已收藏 · 切换':'5枚印记 · '+Math.min(5,a.marks)+'/5')+'</small></span></button>').join('')+'</div>':'';
   const source=a?'<details class="wonder-source"><summary>第'+a.day+'天 · '+esc(a.eventName)+' · 查看来历</summary><p>活动 '+esc(a.eventId)+'</p>'+(a.visits?.length?'<p>五场不同活动，五位不同岛主携自己的管家从码头登岛，完成达到主办品质要求的挑战后获得。</p>'+a.visits.map(v=>'<p class="collection-run">活动 '+esc(v.eventId)+'<br>来访岛主 '+esc(v.guestAccountId)+' · 品质 '+v.quality+' / '+v.minQuality+'<br>实际到岛 '+esc(new Date(v.arrival.arrivedAt).toLocaleString('zh-CN'))+'</p>').join(''):a.proof?.length?'<p>'+a.proof.length+'次实际物资交付；接受任务本身不计贡献。</p>'+[...new Map(a.proof.map(e=>[e.contractId,e])).values()].map(e=>'<p class="collection-run">主运行 '+esc(e.parentRunId)+'<br>子运行 '+esc(e.childRunId)+'</p>').join(''):(d.id==='island_pinwheel'||d.id==='starlit_diorama'||d.id==='muse_wardrobe'?'<p>'+d.condition+'后获得；实际结算与独立纪念回执可核对。重复查看或重试不增加印记。</p>':d.id==='fireworks_orbit'?'<p>三幕六枚全部实际发射、至少五枚合拍命中、品质75分获得；烟花扣物与唯一结算回执可核对。</p>':d.id==='couture_ribbon'?'<p>三位完成展示、平均品质65分且亮拍至少6次后获得。实际服装、展示记录与唯一结算回执可核对；重复领奖不增加印记。</p>':d.id==='market_lantern'?'<p>完成三波实际经营且服务至少6人、品质45分后获得；商品和收益已有结算回执，重复领奖不增加印记。</p>':'<p>完成六竿比赛后获得，重复领奖不会增加印记。</p>'))+'</details>':'';
   return '<article class="wonder-card '+(!a?'locked':'')+'" data-wonder-card="'+d.id+'"><div class="wonder-display-art"><img src="'+wonderAsset(d.id,theme(),color)+'" alt="'+d.name+'"/><span>'+ (a?(w.displays[d.id]?d.location+' · 陈列中':'已收藏'):'尚未收藏')+'</span></div><div class="wonder-copy">'+rarity(d.rarity)+'<h3>'+d.name+'</h3><p>'+d.description+'</p><p class="wonder-location">陈列地 · '+d.location+'</p>'+controls+colors+source+'</div></article>';
  }).join('')+'</div>';
 }
 function achievements(view,newKeys){
  const {book,metrics}=view,totals={collect:50,craft:300,unlock:300};
  const overview='<div class="collection-intro"><div><small>YOUR ISLAND JOURNEY</small><h3>一步一步，也值得被记住</h3><p>采集与制作只记你的亲手成果，承办与协作只记已完成的活动。已获得的纪念章永久保留。</p></div></div><div class="achievement-overview">'+['collect','craft','unlock'].map(f=>'<div><span>'+familyNames[f]+'</span><b>'+metrics[f]+' <small>/ '+totals[f]+'</small></b></div>').join('')+'</div><label class="achievement-filter">查看分类<select id="achievementFilter"><option value="all">全部成就</option>'+Object.entries(familyNames).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('')+'</select></label>';
  const defs=ACHIEVEMENTS.filter(d=>filter==='all'||d.family===filter);
  const cards=defs.map(d=>{const key=d.id+'@'+d.version,a=book.awards[key],progress=Math.min(d.goal,metrics[d.family]),pct=Math.round(progress/d.goal*100);
   return '<article class="achievement-card '+(a?'earned':'')+'" data-achievement="'+key+'" style="--rarity:'+RARITIES[d.rarity].color+'"><div class="achievement-emblem">'+itemMarkup(d.icon,theme(),'achievement-icon')+'</div><div>'+rarity(d.rarity)+'<h3>'+d.name+(newKeys.has(key)?'<small class="achievement-new">新</small>':'')+'</h3><p>'+familyNames[d.family]+' '+d.goal+(d.family==='collect'?'种素材':d.family==='craft'||d.family==='unlock'?'种图纸':d.family==='template'?'种活动':'场活动')+'</p><div class="achievement-progress" role="progressbar" aria-label="'+d.name+'" aria-valuemin="0" aria-valuemax="'+d.goal+'" aria-valuenow="'+progress+'"><i style="width:'+pct+'%"></i></div><small>'+(a?'第 '+a.day+' 天获得 · 永久纪念':progress+' / '+d.goal)+'</small></div></article>';
  }).join('');
  const known=new Set(ACHIEVEMENTS.map(d=>d.id+'@'+d.version)),legacy=Object.entries(book.awards).filter(([key])=>!known.has(key));
  return overview+'<div class="achievement-cards">'+cards+'</div>'+(legacy.length?'<section class="achievement-archive"><h3>往期已获得的纪念章</h3>'+legacy.map(([,a])=>'<p>'+rarity(a.rarity)+' '+esc(a.name)+' · 第'+a.day+'天获得</p>').join('')+'</section>':'')+'<details class="collection-definitions"><summary>收藏统计与纪念规则</summary><p>第一版素材统计固定50种、图纸固定300种。未来增加内容会另记新目标，不撤回此前获得的纪念章。成就只用于展示，不凭空发放经营收入。</p></details>';
 }
 return {open,paint};
}
