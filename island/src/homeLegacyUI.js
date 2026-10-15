import {ownedOriginFacts,placeOrigin,originsSolved,POST_DIRS,postStep,replayPost,postWalk,postAtGoals} from './homeLegacyActivities.js';
import {wonderAsset} from './eventWonders.js';
import {photoCropMarkup} from './homeEverydayUI.js';
import {drawAnimatedCharacter} from './characters.js';
import {esc} from './journeyUI.js';

export function originArt(fact,style,url){return fact.art.kind==='wonder'?'<img class="home-origin-wonder" alt="'+esc(fact.name)+'" src="'+wonderAsset(fact.art.id,style,fact.art.color)+'">':photoCropMarkup(fact.art.frame,url);}
export function collectionMarkup(state,style,url){const facts=ownedOriginFacts(state);return '<div class="home-owned-title"><small>来自小岛存档</small><b>'+facts.length+' 件已收藏奇观</b></div>'+(facts.length?'<div class="home-owned-list">'+facts.map(f=>'<article>'+originArt(f,style,url)+'<div><b>'+esc(f.name)+'</b><p>第 '+f.day+' 天 · '+esc(f.eventName)+'</p><small>活动编号 '+esc(f.eventId)+'</small></div></article>').join('')+'</div>':'<p>展柜等着岛上的第一次纪念。参与活动取得奇观后，这里会展示它的名称、获得日和活动来历。</p>')+'<button class="primary" data-home-collection>打开奇观陈列册</button>';}
export function resetLegacyGame(g){if(g.kind==='origins'){g.selected=g.items[0].key;g.focus=0;}if(g.kind==='postroute'){g.cancelMotion?.();g.history=[];g.postState=replayPost(g,'');}}
export function mountLegacyGame({g,board,controls,style,url,refresh,feedback,setMode,avatar=()=>null}){
 if(g.kind==='origins'){
  if(!g.items.some(f=>f.key===g.selected))g.selected=g.items[0].key;g.focus??=0;board.classList.add('home-origins');
  board.innerHTML='<div class="home-origin-heading"><small>'+(g.mode==='owned'?'小岛已收藏 · 存档来历':'虚构展品 · 来历练习')+'</small><b>把记忆放回时间里</b></div><ol class="home-origin-order">'+g.items.map((_,i)=>'<li><span>'+(i+1)+'</span><button data-home-origin-slot="'+i+'"></button></li>').join('')+'</ol>';
  controls.innerHTML='<div class="home-game-tools home-origin-modes"><button class="secondary" data-origin-mode="owned" '+(!g.ownedCount?'disabled':'')+'>已收藏 '+g.ownedCount+'</button><button class="secondary" data-origin-mode="practice">虚构来历练习</button></div><div class="home-origin-items">'+g.items.map(f=>'<button data-home-origin-item="'+f.key+'">'+originArt(f,style,url)+'<b>'+esc(f.name)+'</b><small>'+esc(f.hint)+'</small></button>').join('')+'</div><h4>为第 <span data-origin-focus>1</span> 位选择来历</h4><div class="home-origin-sources">'+g.cards.map(f=>'<button data-home-origin-source="'+f.key+':source"><b>第 '+f.day+' 天 · '+esc(f.eventName)+'</b><span>'+esc(f.origin)+'</span></button>').join('')+'</div><p class="home-soft">先选展品，再放入时间位；选对应来历，从早到晚整理。同日先后不限。'+(g.mode==='owned'?'来源读取当前小岛存档；此处不会发放新的奇观。':'这些日期和故事仅供桌上练习，不会变成真正的收藏。')+'</p><button class="secondary" data-home-reset>重新整理</button>';
  controls.querySelectorAll('[data-home-origin-item]').forEach(el=>el.onclick=()=>{g.selected=el.dataset.homeOriginItem;refresh();});
  board.querySelectorAll('[data-home-origin-slot]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;g.focus=Number(el.dataset.homeOriginSlot);g.values=placeOrigin(g.values,g.selected,g.focus);refresh();});
  controls.querySelectorAll('[data-home-origin-source]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;if(!g.values[g.focus]){feedback('先在选中的时间位放入一件展品。');return;}g.values[g.focus]={...g.values[g.focus],sourceId:el.dataset.homeOriginSource};refresh();});
  controls.querySelectorAll('[data-origin-mode]').forEach(el=>el.onclick=()=>{if(g.submitting)return;setMode(el.dataset.originMode);});return true;
 }
 if(g.kind!=='postroute')return false;
 board.classList.add('home-postroute');g.postState=replayPost(g,g.values[0]);g.history??=[];
 board.innerHTML='<div class="home-post-heading"><small>管家的桌上路线演练</small><b>让三封星邮各归其位</b></div><div class="home-post-stage" tabindex="0" aria-label="星邮路线，方向键或WASD移动；也可点地面自动行走">'+Array.from({length:49},(_,i)=>'<button class="home-post-cell '+(g.walls.includes(i)?'post-wall':'')+' '+(g.goals.includes(i)?'post-goal':'')+'" data-home-post-cell="'+i+'" aria-label="'+(g.walls.includes(i)?'隔板':g.goals.includes(i)?'投递位':'走道')+'" '+(g.walls.includes(i)?'disabled':'')+'>'+(g.goals.includes(i)?'<i aria-hidden="true">✦</i>':'')+'</button>').join('')+'<div class="home-post-parcels">'+Array.from({length:3},(_,i)=>'<i data-home-post-box="'+i+'" aria-hidden="true"><span>✦</span></i>').join('')+'</div><canvas class="home-post-actor" width="420" height="420" aria-hidden="true"></canvas></div><div class="home-post-progress" role="status"></div>';
 controls.innerHTML='<p class="home-soft">只能推信匣，不能拉。沿过道绕到另一侧，把三个信匣推到星形投递位。点空地会自动绕行；方向键或 WASD 控制一步。角落可能卡住，随时撤回。</p><div class="home-post-pad">'+[['U','↑','上'],['L','←','左'],['D','↓','下'],['R','→','右']].map(([d,a,label])=>'<button class="secondary" data-home-post-dir="'+d+'" aria-label="向'+label+'移动">'+a+'</button>').join('')+'</div><div class="home-game-tools"><button class="secondary" data-home-post-undo>撤回一步</button><button class="secondary" data-home-reset>重新投递</button></div><p class="home-soft">这只是桌面路线谜题。现实文档与 Agent 委托，请到工作桌查看真实执行和回执。</p>';
  let alive=true,timer=null,queue=[],raf=0,last=0;const stage=board.querySelector('.home-post-stage'),ctx=board.querySelector('canvas').getContext('2d'),actor={npcId:15,x:g.postState.player%7*60+30,y:Math.floor(g.postState.player/7)*60+52,path:[],phase:0,direction:Math.PI/2,walkMix:0};
  const stop=()=>{clearTimeout(timer);timer=null;queue=[];};g.cancelMotion=stop;
  const move=d=>{if(!alive||g.saved||g.submitting||g.values[0].length>=2000)return false;const next=postStep(g,g.postState,d);if(!next)return false;g.history.push(g.values[0]);g.values=[g.values[0]+d];g.postState=next;actor.direction=Math.atan2(POST_DIRS[d][1],POST_DIRS[d][0]);refresh();return true;};
  const tick=()=>{if(!alive||document.hidden){stop();return;}if(!queue.length){timer=null;return;}move(queue.shift());timer=setTimeout(tick,135);};
  const input=d=>{stop();move(d);};
  controls.querySelectorAll('[data-home-post-dir]').forEach(el=>el.onclick=()=>input(el.dataset.homePostDir));
  board.querySelectorAll('[data-home-post-cell]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;stop();const target=Number(el.dataset.homePostCell),delta=target-g.postState.player,d=Object.keys(POST_DIRS).find(k=>POST_DIRS[k][0]+POST_DIRS[k][1]*7===delta);if(g.postState.boxes.includes(target)){if(!d||!move(d))feedback('先绕到信匣旁边，留出它前方的空位。');}else{const route=postWalk(g,g.postState,target);if(route===null){feedback('这条过道被挡住了，先调整信匣。');return;}queue=[...route];tick();}stage.focus({preventScroll:true});});
  stage.onkeydown=e=>{const d={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',w:'U',s:'D',a:'L',d:'R'}[e.key.length===1?e.key.toLowerCase():e.key];if(!d||e.ctrlKey||e.altKey||e.metaKey)return;e.preventDefault();e.stopPropagation();input(d);};
  controls.querySelector('[data-home-post-undo]').onclick=()=>{if(g.saved||g.submitting)return;stop();if(!g.history.length)return;g.values=[g.history.pop()];g.postState=replayPost(g,g.values[0]);refresh();};
  const blur=()=>stop();window.addEventListener('blur',blur);document.addEventListener('visibilitychange',blur);
  const frame=t=>{if(!alive)return;const dt=last?Math.min(.05,(t-last)/1000):0;last=t;if(!document.hidden){const x=g.postState.player%7*60+30,y=Math.floor(g.postState.player/7)*60+52,dist=Math.hypot(x-actor.x,y-actor.y),mix=Math.min(1,dt*25);actor.x+=(x-actor.x)*mix;actor.y+=(y-actor.y)*mix;actor.walkMix=dist>1?1:0;actor.phase+=dt*15;actor.appearance=avatar();ctx.clearRect(0,0,420,420);drawAnimatedCharacter(ctx,actor,style,'#c39368',true,t/1000,.45);}raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);
  g.dispose=()=>{if(!alive)return;alive=false;stop();cancelAnimationFrame(raf);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',blur);};return true;
}
export function refreshLegacyGame({g,body,done,keepMessage,feedback,url,style}){
 if(g.kind==='origins'){
  body.querySelectorAll('[data-home-origin-item]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.homeOriginItem===g.selected));el.disabled=g.saved||g.submitting;});
  body.querySelectorAll('[data-origin-mode]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.originMode===g.mode));el.disabled=g.submitting||el.dataset.originMode==='owned'&&!g.ownedCount;});
  body.querySelector('[data-origin-focus]').textContent=g.focus+1;
  body.querySelectorAll('[data-home-origin-slot]').forEach(el=>{const i=Number(el.dataset.homeOriginSlot),pair=g.values[i],fact=g.items.find(f=>f.key===pair?.itemId),source=g.cards.find(f=>f.key+':source'===pair?.sourceId);el.disabled=g.saved||g.submitting;el.classList.toggle('selected',g.focus===i);el.innerHTML=fact?originArt(fact,style,url)+'<div><b>'+esc(fact.name)+'</b><small>'+(source?'第 '+source.day+' 天 · '+esc(source.eventName):'选择一张来历卡')+'</small></div>':'<span>放入选中的展品</span>';});
  body.querySelectorAll('[data-home-origin-source]').forEach(el=>{el.disabled=g.saved||g.submitting;el.setAttribute('aria-pressed',String(el.dataset.homeOriginSource===g.values[g.focus]?.sourceId));});
  if(!keepMessage)feedback(g.saved?'今天的来历手记已经保存。':done?'展品、来历与先后都整理好了。':'把展品与来历配成一对，再按获得日从早到晚整理。');return true;
 }
 if(g.kind!=='postroute')return false;
 const state=g.postState||replayPost(g,g.values[0]);body.querySelectorAll('[data-home-post-box]').forEach((el,i)=>{const p=state.boxes[i];el.style.transform='translate('+(p%7*100)+'%,'+(Math.floor(p/7)*100)+'%)';el.classList.toggle('delivered',g.goals.includes(p));});
 body.querySelector('.home-post-progress').textContent=state.boxes.filter(p=>g.goals.includes(p)).length+' / 3 封已投递 · '+g.values[0].length+' 步';
 body.querySelectorAll('[data-home-post-dir],[data-home-post-cell]').forEach(el=>el.disabled=g.saved||g.submitting||el.classList.contains('post-wall'));body.querySelector('[data-home-post-undo]').disabled=g.saved||g.submitting||!g.history?.length;
 if(!keepMessage)feedback(g.saved?'今天的桌上星邮路线已经保存。':done?'三封星邮都抵达了，记下这条路线。':'先观察角落与过道，别把信匣推入无法绕行的位置。');return true;
}
