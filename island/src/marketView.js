import {applyMarketEvent,marketSummary,MARKET_GOODS} from './marketRules.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {itemMarkup} from './artStore.js';
import {esc} from './journeyUI.js';
export function mountMarket(root,ticket,controls,{theme,profile,portrait,ready,arrived,sound=()=>{},burst=()=>{}}){
 const game=structuredClone(ticket.game);let ended=false,transport=false,paused=false,last=0,frame=0,queueKey=null,layoutKey='',parcelKey='',lastEffect=0,quitting=false;
 const icon=id=>itemMarkup(id,theme,'market-item-art'),name=id=>ITEM_BY_ID[id].name;
 root.innerHTML='<section class="market-play" data-theme="'+theme+'"><header class="market-scoreboard"><div><small>THE ISLAND MARKET</small><h3>把海岛手艺，送到喜欢它的人手里</h3><p id="marketStatus" role="status"></p></div><div class="market-score-badges"><span>第 <b id="marketWave"></b> 波 / 3</span><span>服务 <b id="marketServed"></b> / 12</span><span>连续 <b id="marketCombo"></b></span></div></header>'+
 '<section class="market-stalls" aria-label="本波摊位陈列">'+[0,1,2].map(i=>'<article class="market-stall"><img class="market-stall-sprite" src="/assets/market-stall-'+theme+'-v87.png" alt="空木摊架"/><div class="market-stall-display" id="marketDisplay'+i+'"></div><label>陈列 '+(i+1)+'<select data-market-station="'+i+'">'+MARKET_GOODS.map(id=>'<option value="'+id+'">'+esc(name(id))+'</option>').join('')+'</select></label></article>').join('')+'</section>'+
 '<div class="market-round-note"><p id="marketRoundNote"></p><button class="primary" id="marketStart"></button></div>'+
 '<section class="market-customers" id="marketQueue" aria-label="真实居民顾客"></section>'+
 '<section class="market-counter"><div class="market-stock"><h4>寄售商品 <small>每件只卖一次，未售可退回</small></h4><div class="market-stock-grid">'+MARKET_GOODS.map(id=>'<button class="market-stock-item" data-market-item="'+id+'">'+icon(id)+'<span>'+esc(name(id))+'</span><b data-market-stock="'+id+'"></b></button>').join('')+'</div></div>'+
 '<div class="market-parcel"><h4>交付篮</h4><div id="marketParcel" aria-label="已选商品"></div><div class="market-pack-progress"><i id="marketPacking"></i></div><p id="marketPackingText">看清订单，再装入商品。</p><button class="secondary" id="marketClear">清空交付篮</button></div></section>'+
 '<section class="market-results hidden" id="marketResults"></section><p class="market-feedback" id="marketFeedback" role="status">陈列商品取货更快；连续正确交付与保留耐心会提升品质。</p>'+
 '<footer class="market-controls"><button class="primary hidden" id="marketClaim">收好摊位 · 确认收益与退货</button><button class="secondary" id="marketPause">暂停营业</button><button class="secondary" id="marketCancel">结束本场 · 退回未售商品</button></footer></section>';
 const q=id=>root.querySelector('#'+id),text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
 const emit=e=>{applyMarketEvent(game,e);controls.trace(e);};
 function disabled(){return transport||paused;}
 function queue(){
  const key=game.queue.map(o=>o.id).join('|');if(key===queueKey)return;queueKey=key;
  q('marketQueue').innerHTML=game.queue.length?game.queue.map(o=>'<article class="market-order" data-market-order="'+o.id+'"><div class="market-customer-portrait">'+portrait(o.npcId)+'</div><div class="market-order-body"><h4>'+esc(profile(o.npcId).name)+'</h4><p>'+esc(o.phrase)+'</p><div class="market-order-goods">'+o.goods.map(id=>'<span>'+icon(id)+esc(name(id))+'</span>').join('')+'</div><div class="market-patience"><i></i></div><small class="market-arrival"></small><button class="primary" data-market-pack="'+o.id+'">打包交付</button></div></article>').join(''):'<div class="market-empty-queue">'+(game.phase==='running'?'下一位顾客正在过来。':'顾客会沿道路走到四个不同的选购位置。')+'</div>';
  root.querySelectorAll('[data-market-pack]').forEach(b=>b.onclick=()=>{if(disabled()||game.packing)return;emit({action:{type:'pack',index:Number(b.dataset.marketPack)}});paint();});
 }
 function effects(){
  if(!game.effect||game.effect.id===lastEffect)return;lastEffect=game.effect.id;
  const e=game.effect;root.dataset.effect=e.type;
  if(e.type==='served'){sound('star');burst();text(q('marketFeedback'),'交付完成！'+(e.streak>1?'连续 '+e.streak+' 单 · 手艺被认真带走。':'第一份海岛手艺，送到了喜欢它的人手里。'));}
  if(e.type==='wrong'){sound('error');text(q('marketFeedback'),'这份商品与订单不符，顾客耐心减少。清空交付篮，再核对数量。');}
  if(e.type==='missed')text(q('marketFeedback'),'顾客等候后离开。未售商品保留到收摊退回。');
  if(e.type==='pack'){sound('craft');text(q('marketFeedback'),e.display?'陈列齐全，正在快速包装。':'从备货架取货，包装需要更久。');}
  if(e.type==='blocked')text(q('marketFeedback'),'篮子最多放两件，也不能装入已售完的商品。');
  if(e.type==='wave')text(q('marketFeedback'),'这一波营业结束。先调整下一波陈列，再继续开市。');
  if(e.type==='result')text(q('marketFeedback'),'三波营业已完成。确认结算后，收益入账、未售商品退回。');
 }
 function paint(){
  if(ended)return;const result=marketSummary(game),atStart=['setup','intermission'].includes(game.phase),finished=game.phase==='results';
  text(q('marketWave'),String(game.wave+1));text(q('marketServed'),String(result.served));text(q('marketCombo'),String(game.streak));
  text(q('marketStatus'),transport?'正在确认本场进度…':finished?'三波营业已完成 · 收好摊位后确认结算。':paused?'营业已暂停，顾客耐心也暂停。':ready()?'摊主与岛主已站定 · 顾客到摊后才计算耐心。':'摊主正在收尾工作、沿道路赴约，岛主也需走到交付位。');
  q('marketStart').classList.toggle('hidden',!atStart);text(q('marketStart'),game.phase==='setup'?'准备好了 · 第一波开市':'调整陈列 · 下一波开市');q('marketStart').disabled=disabled()||!ready();
  text(q('marketRoundNote'),atStart?'预告订单：'+game.deck.slice(game.wave*4+(game.phase==='intermission'?4:0),game.wave*4+(game.phase==='intermission'?8:4)).map(o=>profile(o.npcId).name+' · '+o.goods.map(name).join('＋')).join(' / '):finished?'三波顾客已结束，收好摊位后确认实际收益与退货。':'每波四位顾客。先看商品与数量，装篮，再选择对应顾客交付。');
  const nextLayout=game.layout.join('|');if(nextLayout!==layoutKey){layoutKey=nextLayout;game.layout.forEach((id,i)=>{q('marketDisplay'+i).innerHTML=icon(id);root.querySelector('[data-market-station="'+i+'"]').value=id;});}
  root.querySelectorAll('[data-market-station]').forEach(e=>e.disabled=disabled()||!atStart);
  queue();for(const o of game.queue){const card=root.querySelector('[data-market-order="'+o.id+'"]');card.classList.toggle('market-order-ready',o.ready);card.classList.toggle('market-order-packing',game.packing?.orderId===o.id);card.querySelector('.market-patience i').style.transform='scaleX('+(o.remaining/o.patience)+')';text(card.querySelector('.market-arrival'),o.ready?'已到摊 · 耐心 '+o.remaining.toFixed(1)+' 秒':'沿道路赴约 · 尚未计算耐心');card.querySelector('button').disabled=disabled()||!o.ready||!!game.packing||!game.parcel.length;}
  for(const id of MARKET_GOODS){text(root.querySelector('[data-market-stock="'+id+'"]'),'×'+game.stock[id]);root.querySelector('[data-market-item="'+id+'"]').disabled=disabled()||game.phase!=='running'||!!game.packing||game.parcel.length>=2||game.stock[id]<=game.parcel.filter(x=>x===id).length;}
  const nextParcel=game.parcel.join('|');if(nextParcel!==parcelKey){parcelKey=nextParcel;q('marketParcel').innerHTML=game.parcel.map(id=>'<span class="market-parcel-item">'+icon(id)+'</span>').join('');}
  q('marketPacking').style.transform='scaleX('+(game.packing?Math.min(1,game.packing.elapsed/game.packing.duration):0)+')';q('marketParcel').classList.toggle('is-packing',!!game.packing);text(q('marketPackingText'),game.packing?'正在折纸包装 · '+Math.max(0,game.packing.duration-game.packing.elapsed).toFixed(1)+' 秒':'看清订单，再装入商品。');q('marketClear').disabled=disabled()||game.phase!=='running'||!!game.packing||!game.parcel.length;
  q('marketResults').classList.toggle('hidden',!finished);
  if(finished&&!q('marketResults').childElementCount)q('marketResults').innerHTML='<h3>'+ (result.passed?'手艺与笑容，留在了集市里':'这一场，也是经营经验')+'</h3><div class="market-result-metrics"><span>服务 <b>'+result.served+'/12</b></span><span>品质 <b>'+result.quality+'/100</b></span><span>经营收益 <b>'+result.reward+' 岛币</b></span></div><p>'+ (result.passed?'本场达到纪念条件：至少服务6人、品质45分。首次合格集市将获得 R 集市灯牌。':'未达到纪念条件，本场仍按实际品质结算；不会获得奇观或摊主好感奖励。')+'</p><p>未售退回：'+MARKET_GOODS.filter(id=>result.unsold[id]).map(id=>name(id)+' ×'+result.unsold[id]).join(' · ')+(Object.values(result.unsold).every(n=>n===0)?'商品全部售出':'')+'</p>';
  q('marketClaim').classList.toggle('hidden',!finished);q('marketClaim').disabled=transport;q('marketPause').classList.toggle('hidden',finished);text(q('marketPause'),paused?'继续营业':'暂停营业');effects();
 }
 q('marketStart').onclick=()=>{if(disabled()||!ready())return;emit({action:{type:'start'}});controls.saveOutcome();paint();};
 root.querySelectorAll('[data-market-station]').forEach(e=>e.onchange=()=>{if(disabled()||!['setup','intermission'].includes(game.phase))return;emit({action:{type:'display',station:Number(e.dataset.marketStation),item:e.value}});paint();});
 root.querySelectorAll('[data-market-item]').forEach(b=>b.onclick=()=>{if(disabled()||game.phase!=='running')return;emit({action:{type:'add',item:b.dataset.marketItem}});sound('collect');paint();});
 q('marketClear').onclick=()=>{if(!disabled()){emit({action:{type:'clear'}});paint();}};
 q('marketPause').onclick=()=>{paused=!paused;last=0;controls.saveOutcome();paint();};
 q('marketClaim').onclick=()=>{if(!transport&&game.phase==='results')controls.claim();};
 q('marketCancel').onclick=()=>{if(transport)return;if(!quitting){quitting=true;paused=true;text(q('marketCancel'),'确认收摊 · 场地费不退');paint();return;}controls.exit();};
 function pause(){paused=true;last=0;controls.saveOutcome();paint();}
 const visibility=()=>{if(document.hidden)pause();};window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);
 function tick(ts){
  if(ended)return;const dt=last?Math.min(.05,Math.max(0,(ts-last)/1000)):0;last=ts;
  if(!paused&&!transport&&game.phase==='running'){
   const customer=game.queue.find(o=>!o.ready&&arrived(o));
   if(customer){emit({action:{type:'arrive',index:customer.id}});controls.saveOutcome();}
   if(!transport&&dt)emit({dt});
  }
  paint();frame=requestAnimationFrame(tick);
 }
 paint();frame=requestAnimationFrame(tick);
 return{inspect:()=>({kind:'market-party',game,paused,transport}),setTransportPaused(v){transport=v;last=0;paint();},destroy(){if(ended)return;ended=true;cancelAnimationFrame(frame);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);controls.saveOutcome();}};
}
