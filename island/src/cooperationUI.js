import {validCooperationRows} from './cooperationEvidence.js';
import {itemMarkup} from './artStore.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {esc} from './journeyUI.js';
import {wonderAsset} from './eventWonders.js';
export function cooperationMarkup(s,g,theme){
 const key=g?.eventId||g?.id,rows=s.eventWonders?.sources?.[key]?.proof||g?.cooperation;
 if(!validCooperationRows(rows))return '';
 const contracts=[s.recruitment?.active,...(s.recruitment?.history||[])].filter(Boolean),groups=new Map();
 for(const e of rows){let row=groups.get(e.contractId);if(!row){row={...e,goods:{},actions:0};groups.set(e.contractId,row);}row.goods[e.item]=(row.goods[e.item]||0)+e.amount;row.actions++;}
 const monument=s.eventWonders?.owned?.cooperation_monument,awarded=monument?.eventId===key;
 return '<section class="party-cooperation"><header><span class="party-cooperation-mark">'+itemMarkup('c23_0',theme,'party-cooperation-icon')+'</span><div><small>一起做成的事</small><h4>这场筹备，<span>有伙伴的手艺</span></h4><p>'+rows.length+' 次实际物资入库 · '+groups.size+' 份协作聘约</p></div></header><p class="party-cooperation-note">记录实际作业取得的物资，也包含多采的余量。接受任务本身不计入交付；未完成活动不计入协作成就。</p>'+[...groups.values()].map(e=>'<article class="party-cooperation-person"><b>'+esc(contracts.find(c=>c.id===e.contractId)?.profile?.name||'协作伙伴')+' <span>· '+e.actions+' 次交付</span></b><div class="party-cooperation-goods">'+Object.entries(e.goods).map(([id,n])=>'<span>'+itemMarkup(id,theme,'party-cooperation-icon')+esc(ITEM_BY_ID[id]?.name||id)+' <b>×'+n+'</b></span>').join('')+'</div><details class="party-cooperation-source"><summary>查看协作来历</summary><dl><dt>聘约</dt><dd>'+esc(e.contractId)+'</dd><dt>管家主运行</dt><dd>'+esc(e.parentRunId)+'</dd><dt>伙伴子运行</dt><dd>'+esc(e.childRunId)+'</dd></dl></details></article>').join('')+(awarded?'<aside class="party-cooperation-award"><img src="'+wonderAsset('cooperation_monument',theme)+'" alt="同心启航纪念碑"><div><small>R / 首次真实分工纪念</small><b>同心启航纪念碑已收藏</b><p>可到奇观藏册，把大家的协作陈列在派对广场。</p></div></aside>':'')+'</section>';
}
