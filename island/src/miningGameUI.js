import {createMiningGame,miningValue,replayMining} from './miningGame.js';
import {itemMarkup} from './artStore.js';
export function mountMiningGame(root,ticket,{trace,claim,exit},theme){
 const g=ticket.game?structuredClone(ticket.game):createMiningGame(.12);let alive=true,paused=false,transport=false,last=performance.now(),frame=0,submitted=false;
 const left=Math.round((.5-g.precision)*100),right=Math.round((.5+g.precision)*100);
 root.innerHTML='<section class="minigame field-mining"><div class="field-mining-object">'+itemMarkup(ticket.item,theme)+'<b>'+ticket.name+'</b></div><div class="minigame-title">矿脉剩余 '+ticket.expectedHp+' 点</div><div class="meter" style="background:linear-gradient(90deg,#c58f79 '+left+'%,#8ebb92 '+left+'%,#8ebb92 '+right+'%,#c58f79 '+right+'%)"><div class="meter-marker" id="meterMarker"></div></div><p class="mini-explain">'+(ticket.tool?.name||'公共矿镐')+' · 精准区宽度 '+Math.round(g.precision*200)+'%。绿色区域造成2点伤害，其他区域1点；每次成功挥镐收集1石材，击碎后收取2份指定矿物。</p><div class="field-mining-controls"><button class="primary" id="mineStrike">挥镐 · 空格</button><button class="secondary" id="minePause">暂停</button></div><p id="mineResult" role="status"></p></section>';
 const strike=root.querySelector('#mineStrike'),pause=root.querySelector('#minePause'),marker=root.querySelector('#meterMarker'),result=root.querySelector('#mineResult');
 function paint(){marker.style.left=(miningValue(g)*100)+'%';strike.disabled=transport||paused||!!g.result;pause.disabled=transport||!!g.result;result.textContent=g.result?(g.result.strong?'精准敲击！正在完成挥镐与收集。':'敲击命中，正在确认矿脉。'):paused?'已暂停，敲击进度保留。':'观察指针，在绿色区域挥镐。';}
 function hit(){if(!alive||paused||transport||g.result)return;const e={action:{type:'strike'}};trace(e);replayMining(g,[e]);paint();submitted=true;claim();}
 strike.onclick=hit;pause.onclick=()=>{paused=!paused;last=performance.now();trace({neutral:true});pause.textContent=paused?'继续':'暂停';paint()};
 const key=e=>{if(e.code==='Space'&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();hit()}};
 window.addEventListener('keydown',key,true);
 const hide=()=>{if(document.hidden&&!g.result){paused=true;pause.textContent='继续';trace({neutral:true});paint()}};
 document.addEventListener('visibilitychange',hide);
 function tick(now){if(!alive)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;if(!paused&&!transport&&!g.result&&!document.hidden){const e={dt};trace(e);replayMining(g,[e]);}paint();if(g.result&&!submitted){submitted=true;queueMicrotask(claim)}frame=requestAnimationFrame(tick)}
 paint();frame=requestAnimationFrame(tick);
 return {setTransportPaused:v=>{transport=v;last=performance.now();paint()},destroy:()=>{alive=false;cancelAnimationFrame(frame);window.removeEventListener('keydown',key,true);document.removeEventListener('visibilitychange',hide)},inspect:()=>({...structuredClone(g),value:miningValue(g),paused,loaded:true})};
}
