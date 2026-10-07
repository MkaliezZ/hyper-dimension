import {wonderAsset,WONDER_DEFINITIONS} from './eventWonders.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function lanWonderMarkup(e,{button=false}={}){
 if(!e?.wonder?.milestone)return '';
 const d=WONDER_DEFINITIONS.archipelago_lighthouse,first=e.wonder.newIds?.includes(d.id);
 return '<section class="lan-wonder-result" data-lan-wonder="'+d.id+'" data-wonder-event="'+esc(e.id)+'"><div class="lan-wonder-art"><img src="'+wonderAsset(d.id,e.theme)+'" alt="'+d.name+'"></div><div class="lan-wonder-copy"><small>UR · 传奇 / '+(first?'本场新收藏':'纪念印记 +1')+'</small><h3>'+d.name+'</h3><p>五场相聚，五位新的朋友。每个人都带着自己的管家走过码头，留下合格的手作成绩。</p><b>'+(first?'岛上的第一盏群岛之光':'又五位新的朋友，让这盏灯更明亮')+'</b><p class="lan-wonder-location">已保存到主办小岛。结束会客、返回原岛后，可在收藏册陈列到'+d.location+'。</p>'+(button?'<button class="primary" data-event-wonder="'+esc(e.id)+'">看看这份群岛纪念</button>':'')+'</div></section>';
}
