import {archiveTime,archiveIssues,placeArchive,swapStrata,turnStrata,strataConnections,strataSVG} from './homeResearchActivities.js';
import {esc} from './journeyUI.js';
export function resetResearchGame(g){if(!['archive','strata'].includes(g.kind))return;g.selected=g.kind==='archive'?g.palette[0]:0;g.history=[];g.reference=false;}
export function mountResearchGame({g,board,controls,style,refresh,feedback}){
 if(g.kind==='archive'){
  board.classList.add('home-archive');
  board.innerHTML='<div class="home-archive-cover"><small>虚构档案演练</small><b>'+esc(g.title)+'</b><span>查证来源，再按实际发生时刻归档</span></div><ol class="home-archive-order">'+Array.from({length:6},(_,i)=>'<li><span class="archive-order-pin">'+(i+1)+'</span><button data-home-archive-slot="'+i+'"></button></li>').join('')+'</ol>';
  controls.innerHTML='<div class="home-archive-events" aria-label="待归档的六件事">'+g.palette.map(i=>'<button data-home-archive-event="'+i+'">'+esc(g.events[i].title)+'</button>').join('')+'</div><section class="home-archive-sources" aria-label="选中事件的三份来源"></section><p class="home-soft">选事件后点击左侧顺序位；已放入的事件可互换。来信和预告的印刷日期，不一定是事情发生的日期。</p><button class="secondary" data-home-reset>重新整理</button>';
  controls.querySelectorAll('[data-home-archive-event]').forEach(el=>el.onclick=()=>{g.selected=Number(el.dataset.homeArchiveEvent);refresh();});
  board.querySelectorAll('[data-home-archive-slot]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;g.values=placeArchive(g.values,g.selected,Number(el.dataset.homeArchiveSlot));refresh();});
  controls.querySelector('.home-archive-sources').onclick=e=>{const el=e.target.closest('[data-home-archive-source]');if(!el||g.saved||g.submitting)return;g.values[6+g.selected]=Number(el.dataset.homeArchiveSource);refresh();};return true;
 }
 if(g.kind==='strata'){
  board.classList.add('home-strata');g.history??=[];g.reference??=false;g.researchArt='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(strataSVG(g,style));
  board.innerHTML='<div class="home-strata-case"><div class="home-strata-top">地表 · 向上</div><div class="home-strata-grid">'+Array.from({length:9},(_,i)=>'<button data-home-strata="'+i+'"><span class="strata-slice"></span><i class="strata-selection" aria-hidden="true"></i></button>').join('')+'</div><div class="home-strata-reference" aria-hidden="true"></div></div>';
  const reference=board.querySelector('.home-strata-reference');reference.style.backgroundImage='url("'+g.researchArt+'")';
  controls.innerHTML='<p class="home-strata-instructions">选两块切片交换；选中后转向，让层线、浅色矿脉和标本纹理连续。</p><div class="home-game-tools"><button class="secondary" data-home-strata-turn="-1">逆时针转 ↶</button><button class="secondary" data-home-strata-turn="1">顺时针转 ↷ · R</button></div><div class="home-game-tools"><button class="secondary" data-home-strata-undo>退一步</button><button class="secondary" data-home-strata-reference aria-pressed="false">对照原剖面</button><button class="secondary" data-home-reset>重新拼合</button></div><div class="home-strata-progress" role="status"></div><p class="home-soft">这是岩岩的桌上标本拼图。上方草根朝向地表，浅色矿脉贯穿地层，九块切片各有自己的包裹体。</p>';
  const commit=next=>{if(!next)return;g.history.push(g.values.map(p=>({...p})));if(g.history.length>120)g.history.shift();g.values=next;g.reference=false;refresh();};
  board.querySelectorAll('[data-home-strata]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;const i=Number(el.dataset.homeStrata);if(g.selected===null||g.selected===i){g.selected=g.selected===i?null:i;refresh();}else{commit(swapStrata(g.values,g.selected,i));g.selected=null;refresh();}});
  controls.querySelectorAll('[data-home-strata-turn]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;if(g.selected===null){feedback('先选中一块切片，再调整它的朝向。');return;}commit(turnStrata(g.values,g.selected,Number(el.dataset.homeStrataTurn)));});
  controls.querySelector('[data-home-strata-undo]').onclick=()=>{if(g.saved||g.submitting||!g.history.length)return;g.values=g.history.pop();g.selected=null;g.reference=false;refresh();};
  controls.querySelector('[data-home-strata-reference]').onclick=()=>{g.reference=!g.reference;refresh();};
  board.onkeydown=e=>{if(e.key.toLowerCase()==='r'){e.preventDefault();controls.querySelector('[data-home-strata-turn="1"]').click();}};return true;
 }
 return false;
}
export function refreshResearchGame({g,body,done,keepMessage,feedback}){
 if(g.kind==='archive'){
  body.querySelectorAll('[data-home-archive-event]').forEach(el=>{const i=Number(el.dataset.homeArchiveEvent);el.setAttribute('aria-pressed',String(i===g.selected));el.classList.toggle('filed',g.values.slice(0,6).includes(i));});
  body.querySelectorAll('[data-home-archive-slot]').forEach(el=>{const slot=Number(el.dataset.homeArchiveSlot),id=g.values[slot],source=id===null?null:g.events[id].options[g.values[6+id]];el.disabled=g.saved||g.submitting;el.classList.toggle('selected',id===g.selected);el.innerHTML=id===null?'<span>放入一件事</span>':'<b>'+esc(g.events[id].title)+'</b><span>'+esc(source?archiveTime(source.time):'尚未选定来源')+'</span>';});
  const e=g.events[g.selected],sources=body.querySelector('.home-archive-sources');
  if(sources.dataset.event!==String(g.selected)){sources.dataset.event=String(g.selected);sources.innerHTML='<h4>'+esc(e.title)+' · 来源夹</h4>'+e.options.map((o,i)=>'<button data-home-archive-source="'+i+'"><small>'+esc(o.label)+' · '+esc(o.author)+'</small><span>'+esc(o.text)+'</span><i aria-hidden="true">收录</i></button>').join('');}
  sources.querySelectorAll('[data-home-archive-source]').forEach(el=>{el.disabled=g.saved||g.submitting;el.setAttribute('aria-pressed',String(g.values[6+g.selected]===Number(el.dataset.homeArchiveSource)));});
  if(!keepMessage){const s=archiveIssues(g,g.values),selected=g.values.slice(6).filter(v=>v!==null).length;feedback(g.saved?'六份记录已装订进青禾的航海录。':done?'来源和发生时刻都已核对，六页故事顺畅地连起来了。':selected===6&&s.sources<6?'有些资料只记录了写信或印刷的时刻，重新核对实际发生的证据。':s.sources===6&&s.complete&&!s.ordered?'来源已核对，时间线仍有前后颠倒的地方。':'先选一件事，为它核对来源，再放进由早到晚的六个位置。');}return true;
 }
 if(g.kind==='strata'){
  const links=strataConnections(g.values),connected=new Set(links.flat());
  body.querySelectorAll('[data-home-strata]').forEach(el=>{const i=Number(el.dataset.homeStrata),p=g.values[i],slice=el.querySelector('.strata-slice'),key=p.tile+':'+p.r;el.disabled=g.saved||g.submitting;el.setAttribute('aria-pressed',String(i===g.selected));el.classList.toggle('connected',connected.has(i));el.setAttribute('aria-label','第'+(Math.floor(i/3)+1)+'行第'+(i%3+1)+'列切片，朝向'+p.r*90+'度');
   if(slice.dataset.piece!==key){const old=slice.dataset.piece?.split(':').map(Number);slice.getAnimations().forEach(a=>a.cancel());slice.style.backgroundImage='url("'+g.researchArt+'")';slice.style.backgroundPosition=p.tile%3*50+'% '+Math.floor(p.tile/3)*50+'%';slice.style.transform='rotate('+p.r*90+'deg)';slice.dataset.piece=key;
    if(old&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const delta=(p.r-old[1]+4)%4,turn=delta>2?delta-4:delta;slice.animate(old[0]===p.tile?[{transform:'rotate('+old[1]*90+'deg)'},{transform:'rotate('+(old[1]+turn)*90+'deg)'}]:[{opacity:.35},{opacity:1}],{duration:200,easing:'ease-out'});}
   }
  });
  body.querySelector('.home-strata-case').classList.toggle('show-reference',g.reference);body.querySelector('.home-strata-reference').setAttribute('aria-hidden',String(!g.reference));body.querySelector('[data-home-strata-reference]').setAttribute('aria-pressed',String(g.reference));body.querySelector('[data-home-strata-undo]').disabled=g.saved||g.submitting||!g.history.length;
  body.querySelectorAll('[data-home-strata-turn]').forEach(el=>el.disabled=g.saved||g.submitting||g.selected===null);body.querySelector('.home-strata-progress').innerHTML='<span>纹理接续</span><b>'+links.length+' / 12</b><i style="--connected:'+links.length/12+'"></i>';
  if(!keepMessage)feedback(g.saved?'这份地层标本已记入岩岩的收藏册。':done?'层线、矿脉和包裹体都回到了原位。':'先沿草根找地表，再顺着浅色矿脉和不同纹理接回剖面。');return true;
 }
 return false;
}
