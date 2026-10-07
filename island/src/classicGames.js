import {restoreMatchState} from './craftGameReplay.js';
import {itemMarkup} from './artStore.js';
import {DEFAULT_RECIPES} from './contentCatalog.js';
import {createGamePerformance} from './gamePerformance.js';
import {gameLevelOptions,nextGameOptions,seededRandom,itemName} from './gameLevels.js';
import {addGameChrome} from './gameChrome.js';
import {makeLinkBoard,linkPath,findLinkMove,shuffleLinks,createMatchState,matchMoves,suggestMatchMove,matchSnapshot,shuffleMatch,swapMatch} from './classicRules.js';

// Logic resolves synchronously; the presentation queue locks input through swap,
// collection and gravity. Timers advance only while this game is visible/active.
export function mountClassicGame(root,id,onFinish,rawOptions,config){
 const options=gameLevelOptions(id,rawOptions),level=options.level,g=config,theme=options.theme||document.body.dataset.theme||'pixel',recipe=options.recipe||DEFAULT_RECIPES[id];
 const art=k=>itemMarkup(k,theme),isLink=g.kind==='link',reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const resumed=options.resumeGame;let transportPaused=false;
 let alive=true,done=false,busy=false,paused=false,activeWindow=true,started=resumed?.started??!isLink,frame=0,last=performance.now(),time=resumed?.time||0,selected=null,queue=[],pending=null,replacement=null,detail={},hinted=[],hintUntil=0;
 root.innerHTML='<section class="room-game classic-game" data-game-id="'+id+'" data-kind="'+g.kind+'"><div class="game-brief">'+art(recipe.item)+'<div><b>'+g.title+'</b><p>'+g.instructions+'</p></div></div><div class="classic-objectives"></div><p class="activity-status" role="status"></p><div class="activity-board classic-board"><div class="classic-grid"></div><svg class="link-lines" aria-hidden="true"></svg><span class="classic-combo" aria-live="polite"></span></div><div class="activity-controls"></div><div class="activity-session-controls"></div></section>';
 const board=root.querySelector('.activity-board'),grid=root.querySelector('.classic-grid'),status=root.querySelector('.activity-status'),objectives=root.querySelector('.classic-objectives'),controls=root.querySelector('.activity-controls'),session=root.querySelector('.activity-session-controls'),line=board.querySelector('.link-lines'),combo=board.querySelector('.classic-combo');
 const stage=createGamePerformance(board,theme,recipe.item);
 const canPlay=()=>alive&&!done&&!busy&&!transportPaused&&!paused&&activeWindow&&!document.hidden;
 function text(s){status.textContent=s}
 function button(label,fn,parent=controls){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.onclick=()=>{if(canPlay())fn()};parent.append(b);return b}
 function restart(mode=options.mode){if(!alive)return;if(options.onRestart){options.onRestart(mode);return}destroy();replacement=mountClassicGame(root,id,onFinish,nextGameOptions(options,mode),g)}
 addGameChrome(root,options,restart);
 const restartButton=button('换一局',()=>{},session);restartButton.onclick=()=>restart();
 const pauseButton=button(isLink?'开始计时':'暂停',()=>{},session);
 pauseButton.dataset.session='pause';pauseButton.onclick=()=>{if(!alive||done)return;if(!started){started=true;options.onGameEvent?.({action:{type:'start'}});last=performance.now()}else paused=!paused;if(paused)stage.pause();pauseButton.textContent=paused?'继续':'暂停';};
 function finish(pass,quality){
  if(done||!alive)return;done=true;busy=false;quality=Math.max(55,Math.min(100,Math.round(quality||55)));
  const receipt={passed:pass,score:pass?1:0,total:1,quality};options.onOutcome?.(receipt);
  text(pass?'目标达成 · 品质 '+quality:'本局未达成目标 · 材料未消耗');controls.replaceChildren();pauseButton.disabled=true;
  const claim=button(pass?'领取制作成果':'再来一局',()=>{});claim.className='primary activity-finish';claim.disabled=true;
  stage.present(pass,()=>{if(alive)claim.disabled=false});
  claim.onclick=()=>{if(!alive||claim.disabled||transportPaused)return;claim.disabled=true;if(pass){destroy();onFinish(receipt)}else restart()};
 }
 function enqueue(steps,callback){busy=true;queue=steps;pending=callback;advance()}
 function advance(){const step=queue.shift();if(!step){busy=false;const cb=pending;pending=null;cb?.();return}step.run();queue.unshift({wait:reduced?.035:step.duration});}
 function runQueue(dt){if(!queue.length)return;const step=queue[0];if(step.wait==null)return;step.wait-=dt;if(step.wait<=0){queue.shift();advance()}}
 function celebrate(n,label){combo.textContent=label||n+' 连锁';combo.classList.remove('is-showing');void combo.offsetWidth;combo.classList.add('is-showing')}
 function particles(index,cols,rows,item){stage.emit('collect',(index%cols+.5)/cols*600,(Math.floor(index/cols)+.5)/rows*340,item)}
 function makeCells(columns,rows){
  grid.style.setProperty('--columns',columns);grid.style.setProperty('--rows',rows);
  return Array.from({length:columns*rows},(_,i)=>{const b=document.createElement('button');b.type='button';b.className='classic-cell';b.dataset.cell=i;grid.append(b);return b});
 }
 let update=()=>{},inspectState=()=>detail;
 if(isLink){
  const l=level.link,{columns,rows}=l,ids=l.ids,random=seededRandom(resumed?.randomSeed??(level.seed^0xCCA)),cells=makeCells(columns,rows);
  let values=resumed?.values?[...resumed.values]:makeLinkBoard(level).values,found=resumed?.found||0,hints=resumed?.hints??level.hints,shuffles=resumed?.shuffles??l.shuffles,combos=resumed?.combos||0,bestCombo=resumed?.bestCombo||0,lastPair=resumed?.lastPair??-99,hintsUsed=resumed?.hintsUsed||0;
  board.classList.add('link-board');
  function paint(message){
   cells.forEach((b,i)=>{b.innerHTML=values[i]==null?'':art(ids[values[i]]);b.classList.toggle('empty',values[i]==null);b.classList.toggle('selected',selected===i);b.classList.toggle('hinted',hinted.includes(i));b.disabled=values[i]==null;b.setAttribute('aria-label',values[i]==null?'已整理':itemName(ids[values[i]])+' · 第 '+(i+1)+' 格');});
   objectives.innerHTML='<span><small>已整理</small><b>'+found+' / '+columns*rows/2+' 对</b></span><span><small>剩余时间</small><b data-link-time>'+Math.max(0,Math.ceil(l.seconds-time))+' 秒</b></span><span><small>最佳连击</small><b>'+bestCombo+'</b></span>';
   if(message)text(message);hintButton.textContent='提示 ×'+hints;shuffleButton.textContent='重排 ×'+shuffles;hintButton.disabled=hints<=0;shuffleButton.disabled=shuffles<=0;
  }
  function drawPath(path){
   const r=board.getBoundingClientRect(),rects=cells.map(c=>c.getBoundingClientRect());
   const p=path.map(({x,y})=>{
    const xx=x<0?8:x>=columns?r.width-8:rects[x].left-r.left+rects[x].width/2;
    const yy=y<0?8:y>=rows?r.height-8:rects[y*columns].top-r.top+rects[y*columns].height/2;return xx+','+yy;
   });
   line.setAttribute('viewBox','0 0 '+r.width+' '+r.height);line.innerHTML='<polyline points="'+p.join(' ')+'" pathLength="1"/>';
  }
  function choose(i){
   if(!canPlay()||values[i]==null)return;if(!started){started=true;options.onGameEvent?.({action:{type:'start'}});pauseButton.textContent='暂停';}
   if(selected==null||selected===i){selected=selected===i?null:i;paint();return}
   const a=selected;selected=null;hinted=[];
   const path=linkPath(values,columns,rows,a,i);
   if(!path){selected=i;paint('连线最多转两次弯，且不能穿过其他图块。试试外侧通路。');cells[a].classList.add('invalid');return}
   paint();drawPath(path);cells[a].classList.add('link-removing');cells[i].classList.add('link-removing');
   particles(a,columns,rows,ids[values[a]]);particles(i,columns,rows,ids[values[i]]);
   enqueue([{duration:.3,run:()=>{}},{duration:.12,run:()=>{
    options.onGameEvent?.({action:{type:'pair',a,b:i}});values[a]=values[i]=null;found++;combos=time-lastPair<6?combos+1:1;bestCombo=Math.max(bestCombo,combos);lastPair=time;
    cells.forEach(c=>c.classList.remove('link-removing','invalid'));line.replaceChildren();paint('连通成功 · 清空后会打开新的路线');if(combos>1)celebrate(combos,combos+' 连击');
   }}],()=>{
    if(found===columns*rows/2){finish(true,75+20*Math.max(0,1-time/l.seconds)+Math.min(5,bestCombo)-hintsUsed*2);return}
    if(!findLinkMove(values,columns,rows)){values=shuffleLinks(values,columns,rows,random).values;paint('没有可连的图块，已免费重排剩余图块');celebrate(0,'通路已重整');}
   });
  }
  cells.forEach((b,i)=>b.onclick=()=>choose(i));
  const hintButton=button('提示',()=>{const move=findLinkMove(values,columns,rows);if(!move||hints<=0)return;options.onGameEvent?.({action:{type:'hint'}});hints--;hintsUsed++;hinted=[move.a,move.b];hintUntil=time+4;paint('这两张可以连通。沿空位或棋盘外侧观察路线。')});
  const shuffleButton=button('重排',()=>{if(shuffles<=0)return;options.onGameEvent?.({action:{type:'shuffle'}});shuffles--;selected=null;hinted=[];values=shuffleLinks(values,columns,rows,random).values;paint('重新整理了剩余图块，进度保留。');celebrate(0,'图块重排');});
  paint('点击第一张图块开始计时 · 相同图块最多两次转弯即可连通');
  update=()=>{const clock=objectives.querySelector('[data-link-time]');if(clock)clock.textContent=Math.max(0,Math.ceil(l.seconds-time))+' 秒';if(hinted.length&&time>hintUntil){hinted=[];paint()}if(time>=l.seconds&&!busy)finish(false);};
  inspectState=()=>({values:[...values],columns,rows,found,hints,shuffles,seconds:l.seconds,remaining:l.seconds-time,bestCombo,legalMove:findLinkMove(values,columns,rows)});
 }else{
  const ids=id===3?['rose','lavender','sunflower','mint','herb']:['tomato','wheat','corn','fish','strawberry'],cells=makeCells(6,6),state=resumed?.match?restoreMatchState(resumed.match):createMatchState(level);
  let hintsUsed=resumed?.hintsUsed||0,view=matchSnapshot(state),dragStart=null,ignoreClick=false;
  const powers={row:'↔',column:'↕',burst:'✦',rainbow:'✧'},powerNames={row:'整行消除',column:'整列消除',burst:'周围爆破',rainbow:'同色全消'};
  board.classList.add('match-board');
  function paint(snapshot=matchSnapshot(state),message){
   view=snapshot;
   cells.forEach((b,i)=>{
    const power=view.specials[i];b.className='classic-cell'+(view.seals[i]?' sealed':'')+(selected===i?' selected':'')+(hinted.includes(i)?' hinted':'');
    b.innerHTML=art(ids[view.values[i]])+(power?'<span class="match-power power-'+power+'">'+powers[power]+'</span>':'')+(view.seals[i]?'<i class="match-seal" aria-hidden="true"></i>':'');
    b.setAttribute('aria-label',itemName(ids[view.values[i]])+(power?' · '+powerNames[power]:'')+(view.seals[i]?' · 有封条':'')+' · 第 '+(i+1)+' 格');
   });
   objectives.innerHTML=view.targets.map(t=>'<span class="goal-chip '+(t.got>=t.need?'complete':'')+'">'+art(ids[t.color])+'<b>'+t.got+' / '+t.need+'</b></span>').join('')+(view.sealGoal?'<span class="goal-chip '+(view.sealsCleared>=view.sealGoal?'complete':'')+'"><i class="seal-token">◇</i><b>封条 '+view.sealsCleared+' / '+view.sealGoal+'</b></span>':'')+'<span class="moves-chip"><small>剩余步数</small><b>'+view.moves+'</b></span>';
   hintButton.textContent='提示 ×'+state.hints;shuffleButton.textContent='重排 ×'+state.shuffles;hintButton.disabled=state.hints<=0;shuffleButton.disabled=state.shuffles<=0;
   if(message)text(message);
  }
  function animateStep(step){
   paint(step.snapshot);
   if(step.kind==='swap'){
    const [a,b]=step.swap,ar=cells[a].getBoundingClientRect(),br=cells[b].getBoundingClientRect();
    for(const [i,dx,dy] of [[a,br.left-ar.left,br.top-ar.top],[b,ar.left-br.left,ar.top-br.top]]){cells[i].style.setProperty('--swap-x',dx+'px');cells[i].style.setProperty('--swap-y',dy+'px');cells[i].classList.add('tile-swapping');}
   }
   if(step.kind==='clear'){
    for(const i of step.cleared){cells[i].classList.add('tile-clearing');particles(i,6,6,ids[step.snapshot.values[i]])}
    for(const [i] of step.created)cells[i].classList.add('power-created');
    for(const i of step.activated)cells[i].classList.add('power-activated');
    text(step.combo>1?'连锁 '+step.combo+' · 落下的物品继续消除':'收集 '+step.cleared.length+' 件'+(step.created.length?' · 生成特殊物品':''));
    if(step.combo>1)celebrate(step.combo);
   }
   if(step.kind==='fall')for(let i=0;i<36;i++)if(step.drops[i]){cells[i].style.setProperty('--drop',-Math.min(6,step.drops[i])*(cells[i].offsetHeight+4)+'px');cells[i].classList.add('tile-falling');}
   if(step.kind==='shuffle')celebrate(0,'自动重排');
  }
  function exchange(a,b){
   if(!canPlay())return;selected=null;hinted=[];const result=swapMatch(state,a,b);
   if(!result.valid){paint(undefined,'需交换相邻物品形成三消；特殊物品可直接交换触发。本次不扣步数。');cells[a]?.classList.add('invalid');return}
   options.onGameEvent?.({action:{type:'swap',a,b}});enqueue(result.frames.map(step=>({duration:step.kind==='clear'?.32:step.kind==='fall'?.24:.18,run:()=>animateStep(step)})),()=>{
    paint();if(result.won)finish(true,75+Math.min(17,state.moves/state.initialMoves*24)+Math.min(8,state.bestCombo*2)-hintsUsed*2);
    else if(result.lost)finish(false);else text('先完成指定收集目标'+(state.sealGoal?'与封条清理':'')+' · 四连可造整行 / 整列消除，五连造同色全消。');
   });
  }
  function choose(i){if(!canPlay())return;if(selected==null){selected=i;paint();return}if(i===selected){selected=null;paint();return}const a=selected;if(Math.abs(a%6-i%6)+Math.abs(Math.floor(a/6)-Math.floor(i/6))!==1){selected=i;paint();return}exchange(a,i);}
  cells.forEach((b,i)=>{
   b.onclick=()=>{if(ignoreClick){ignoreClick=false;return}choose(i)};
   b.onpointerdown=e=>{if(canPlay()){dragStart={i,x:e.clientX,y:e.clientY};b.setPointerCapture(e.pointerId)}};
   b.onpointercancel=()=>{dragStart=null;ignoreClick=false};
   b.onpointerup=e=>{
    if(!dragStart)return;const d=dragStart;dragStart=null;const dx=e.clientX-d.x,dy=e.clientY-d.y;
    if(Math.hypot(dx,dy)<18)return;const next=d.i+(Math.abs(dx)>Math.abs(dy)?Math.sign(dx):6*Math.sign(dy));
    ignoreClick=true;if(next>=0&&next<36&&Math.abs(d.i%6-next%6)+Math.abs(Math.floor(d.i/6)-Math.floor(next/6))===1)exchange(d.i,next);
   };
  });
  const hintButton=button('提示',()=>{if(state.hints<=0)return;const move=suggestMatchMove(state);if(!move)return;options.onGameEvent?.({action:{type:'hint'}});state.hints--;hintsUsed++;hinted=move;hintUntil=time+4;paint(undefined,'这两格交换可消除，也可以寻找四连、五连或特殊组合。')});
  const shuffleButton=button('重排',()=>{if(!shuffleMatch(state,true))return;options.onGameEvent?.({action:{type:'shuffle'}});selected=null;hinted=[];paint(undefined,'物品已重排 · 目标与步数保持不变');celebrate(0,'货架重排');});
  paint(undefined,'四连生成直线消除 · 五连生成同色全消 · T / L 形生成范围爆破');
  update=()=>{if(hinted.length&&time>hintUntil){hinted=[];paint()}};
  inspectState=()=>({...matchSnapshot(state),legalMoves:matchMoves(state),view,selected});
 }
 function blur(){activeWindow=false;stage.pause()}function focus(){activeWindow=true;last=performance.now()}
 const soundSettings=()=>{if(!alive||done)return;paused=true;stage.pause();pauseButton.textContent='继续';};
 window.addEventListener('hd-sound-settings',soundSettings);
 window.addEventListener('blur',blur);window.addEventListener('focus',focus);
 function tick(now){
  if(!alive)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;const active=!transportPaused&&!paused&&activeWindow&&!document.hidden;
  root.querySelector('.room-game').dataset.paused=String(!active);
  if(active){stage.tick(dt);if(!done){if(started){options.onGameEvent?.({dt});time+=dt;}runQueue(dt);update();}}
  frame=requestAnimationFrame(tick);
 }
 frame=requestAnimationFrame(tick);
 if(resumed?.result)queueMicrotask(()=>finish(resumed.result.passed,resumed.result.quality));
 function destroy(){replacement?.destroy();alive=false;queue=[];pending=null;cancelAnimationFrame(frame);stage.destroy();window.removeEventListener('hd-sound-settings',soundSettings);window.removeEventListener('blur',blur);window.removeEventListener('focus',focus)}
 return {config:g,destroy,setTransportPaused(value){transportPaused=value;last=performance.now()},inspect:()=>replacement?replacement.inspect():({id,kind:g.kind,level,t:time,done,busy,started,paused,performance:stage.inspect(),...inspectState()})};
}
