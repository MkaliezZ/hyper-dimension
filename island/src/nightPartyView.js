
import {applyNightPartyEvent,nightLight} from './nightPartyReplay.js';
import {itemMarkup} from './artStore.js';
export function mountNightParty(root,ticket,controls,{theme,sound=()=>{},effect=()=>{},arrived=()=>true}){
 const game=structuredClone(ticket.game);let ended=false,transport=false,paused=false,last=0,frame=0;
 root.innerHTML='<div class="party-sky" aria-label="星灯放飞演出">'+Array.from({length:4},(_,i)=>'<span class="party-lantern" style="--lantern-index:'+i+'">'+itemMarkup('lantern',theme,'inline-icon')+'</span>').join('')+'</div><p class="hint">光点进入中央亮区时放飞。放飞四盏星灯后，一起庆祝并领取本场奖励。</p><div class="night-party-track" style="--light-start:'+(game.difficulty==='easy'?'25%':'35%')+';--light-end:'+(game.difficulty==='easy'?'75%':'65%')+'"><i id="partyMarker"></i></div><p class="night-party-score" role="status"></p><div class="night-party-actions"><button class="primary" id="launchLantern">放飞星灯</button><button class="primary hidden" id="nightClaim">一起庆祝 · 领取奖励</button><button class="secondary" id="nightPause">暂停</button><button class="secondary" id="nightCancel">结束本场</button></div>';
 const q=s=>root.querySelector(s);function paint(){q('#partyMarker').style.left='calc((100% - 15px) * '+nightLight(game)+')';q('.night-party-score').textContent=(arrived()?'精准放飞 ':'居民正在收尾、沿道路赴约 · ')+game.score+' / '+game.round+' · 第 '+Math.min(4,game.round+1)+' / 4 盏';root.querySelectorAll('.party-lantern').forEach((el,i)=>el.classList.toggle('released',i<game.round));q('#launchLantern').disabled=transport||paused||!arrived()||game.round>=4;q('#launchLantern').classList.toggle('hidden',game.round===4);q('#nightClaim').classList.toggle('hidden',game.round<4);q('#nightClaim').disabled=transport;q('#nightPause').textContent=paused?'继续相聚':'暂停';}
 function emit(e){applyNightPartyEvent(game,e);controls.trace(e);}
 q('#launchLantern').onclick=()=>{if(transport||paused||!arrived()||game.round>=4)return;emit({action:{type:'tap'}});sound('star');effect(game.taps.at(-1).precise);paint();};
 q('#nightClaim').onclick=()=>{if(!transport&&game.round===4)controls.claim();};
 q('#nightPause').onclick=()=>{paused=!paused;last=0;controls.saveOutcome();paint();};
 let quitting=false;q('#nightCancel').onclick=()=>{if(!quitting){quitting=true;paused=true;q('#nightCancel').textContent='确认结束 · 不发完成奖';paint();return;}controls.exit();};
 function pause(){paused=true;last=0;controls.saveOutcome();paint();}
 function visibility(){if(document.hidden)pause();}
 window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);
 function tick(ts){if(ended)return;const dt=last?Math.min(.05,Math.max(0,(ts-last)/1000)):0;last=ts;if(!paused&&!transport&&game.round<4&&dt)emit({dt});paint();frame=requestAnimationFrame(tick);}
 paint();frame=requestAnimationFrame(tick);
 return {inspect:()=>({loaded:true,kind:'night-party',game,paused,transport}),setTransportPaused:v=>{transport=v;last=0;paint();},destroy(){if(ended)return;ended=true;cancelAnimationFrame(frame);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);controls.saveOutcome();}};
}
