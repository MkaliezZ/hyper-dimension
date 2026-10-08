export function environmentCalendarMarkup(e){
 const labels={local:'本机共享时令',connecting:'正在连接共享时令',synced:'共享时令已同步',unavailable:'共享时令暂不可用',cached:'使用最近同步的时令'};
 return '<section class="environment-calendar"><div class="environment-time"><b>'+e.clockText+'</b><span>'+e.seasonName+'季 · 第 '+(Math.floor(e.seasonProgress*e.seasonDays)+1)+' / '+e.seasonDays+' 视觉日'+'</span></div><div class="environment-seasons">'+['春','夏','秋','冬'].map((name,i)=>'<span class="'+(['spring','summer','autumn','winter'][i]===e.season?'current':'')+'">'+name+'</span>').join('')+'</div><p>每个视觉日 '+(e.dayLengthMs/e.rate/60000)+' 分钟，每季 '+e.seasonDays+' 个视觉日，四季一轮 '+(e.seasonDays*4)+' 个视觉日。昼夜视觉效果已暂停。画风切换与登岛会客使用同一时令。</p><p>世界时令独立于经营结算；离线轮换不会产生收入或扣除岛务费用。</p><small>'+(labels[e.synchronization]||'共享时令')+'</small></section>';
}
