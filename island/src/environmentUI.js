export function environmentCalendarMarkup(e){
 const labels={local:'本机共享时令',connecting:'正在连接共享时令',synced:'共享时令已同步',unavailable:'共享时令暂不可用',cached:'使用最近同步的时令'};
 return '<section class="environment-calendar"><div class="environment-time"><b>'+e.clockText+'</b><span>'+e.seasonName+'季 · '+({dawn:'晨光',day:'日间',dusk:'暮色',night:'夜晚'}[e.period])+'</span></div><div class="environment-seasons">'+['春','夏','秋','冬'].map((name,i)=>'<span class="'+(['spring','summer','autumn','winter'][i]===e.season?'current':'')+'">'+name+'</span>').join('')+'</div><p>昼夜每 '+(e.dayLengthMs/e.rate/60000)+' 分钟轮换，四季每 '+e.seasonDays+' 个视觉日换季。画风切换与登岛会客使用同一时令。</p><p>世界时令独立于经营结算；离线轮换不会产生收入或扣除岛务费用。</p><small>'+(labels[e.synchronization]||'共享时令')+'</small></section>';
}
