import {applyNightSkyEvent,nightSkyWind,nightSkyLevel} from './nightSkyGame.js';
import {createNightSkyRenderer} from './nightSkyRenderer.js';
import {itemMarkup,artReady} from './artStore.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountNightSky(root,ticket,controls,{theme,sound=()=>{},effect=()=>{},arrived=()=>true,people=[{id:0,name:'阿岚'},{id:2,name:'露露'}]}){
 const game=structuredClone(ticket.game),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let ended=false,transport=false,checkpointing=false,paused=false,last=0,frame=0,quitting=false,signature='',drawTime=0,dragging=false,lastAim=0;
 root.className='night-sky';root.closest('.modal')?.classList.add('night-sky-modal');
 root.innerHTML='<div class="night-sky-top"><div><small>THE STARLIGHT GATHERING</small><h3>与伙伴一起 · 共绘星图</h3></div><span class="night-sky-grade" id="nightSkyGrade">星点 0 / 4</span></div>'+
 '<ol class="night-sky-rounds">'+game.levels.map((l,i)=>'<li style="--star-color:'+l.color+'" data-sky-round="'+i+'">'+itemMarkup('lantern',theme,'night-sky-icon')+'<span>第 '+(i+1)+' 幕</span><b>待放飞</b></li>').join('')+'</ol>'+
 '<div class="night-sky-stage"><canvas id="nightSkyCanvas" tabindex="0" role="img" aria-label="星灯飞行舞台。拖动瞄准，方向键调整角度和升力，空格放飞，A或D使用一次空中修正。"></canvas><span class="night-sky-stage-note" id="nightSkyStageNote">等大家沿道路到场，再一起放飞</span><div class="night-sky-wind"><span>海风</span><b id="nightSkyWind"></b><small>云带会轻轻改变飞行路线</small></div></div>'+
 '<div class="night-sky-roster">'+people.map(p=>'<span>'+esc(p.name)+'<small> · 今夜的放飞伙伴</small></span>').join('')+'</div>'+
 '<aside class="night-sky-console"><div class="night-sky-controls"><label>放飞角度 <output id="nightSkyAngleRead"></output><input id="nightSkyAngle" aria-label="放飞角度" type="range" min="-38" max="38" step="1" value="'+game.aim.angle+'"/></label><label>升力 <output id="nightSkyLiftRead"></output><input id="nightSkyLift" aria-label="升力" type="range" min="0.65" max="1.3" step="0.05" value="'+game.aim.power+'"/></label><button class="primary" id="launchLantern">放飞星灯</button></div>'+
 '<div class="night-sky-correct"><button class="secondary" id="nightSkyLeft">← 向左修正 · A</button><span id="nightSkyRudder">每盏星灯只有一次空中修正</span><button class="secondary" id="nightSkyRight">向右修正 · D →</button></div></aside>'+
 '<div class="night-sky-result" role="status"><strong id="nightSkyStatus"></strong><p id="nightSkyMessage">拖动天空或调整角度与升力，让星灯穿过云带，靠近发亮的星点。</p><button class="primary hidden" id="nightSkyNext">准备下一幕</button><button class="primary hidden" id="nightClaim">一起庆祝 · 领取奖励</button></div>'+
 '<footer class="night-sky-footer"><p>拖动瞄准 · 空格放飞 · A / D 修正<br><span>收起后保留进度；一时偏航也可以完成相聚。</span></p><div><button class="secondary" id="nightPause">暂停</button><button class="secondary" id="nightCancel">结束本场</button></div></footer>';
 const q=s=>root.querySelector(s),canvas=q('#nightSkyCanvas'),renderer=createNightSkyRenderer(canvas,{theme,people,reduced});
 const unavailable=()=>transport||paused||!arrived();
 function emit(e){const phase=game.phase;applyNightSkyEvent(game,e);controls.trace(e);if(phase==='flight'&&game.phase!=='flight'){const hit=game.reports.at(-1).precise;sound(hit?'star':'collect');effect(hit);}paint();}
 function paint(){
  const wind=nightSkyWind(game);q('#nightSkyWind').textContent=(wind<0?'← 左风 ':'右风 → ')+Math.abs(wind).toFixed(1);
  const key=[game.phase,game.round,game.score,game.phaseTime>=1.5,game.flight?.adjusted,game.aim.angle,game.aim.power,unavailable(),checkpointing,quitting].join('|');
  if(key===signature)return;signature=key;
  const completed=game.phase==='complete',aim=game.phase==='aim',flight=game.phase==='flight',between=game.phase==='between',blocked=unavailable();
  q('#nightSkyGrade').textContent='星点 '+game.score+' / 4';
  root.querySelectorAll('[data-sky-round]').forEach((el,i)=>{const r=game.reports[i];el.classList.toggle('is-current',i===game.round&&!completed);el.classList.toggle('is-lit',!!r?.precise);el.classList.toggle('is-finished',!!r);el.querySelector('b').textContent=r?(r.precise?'已点亮':'已放飞'):i===game.round?'这一幕':'待放飞';});
  q('#nightSkyAngle').value=game.aim.angle;q('#nightSkyLift').value=game.aim.power;
  q('#nightSkyAngleRead').textContent=(game.aim.angle<0?'左 ':game.aim.angle>0?'右 ':'正向 ')+Math.abs(game.aim.angle).toFixed(0)+'°';
  q('#nightSkyLiftRead').textContent=game.aim.power.toFixed(2)+' ×';
  q('#nightSkyAngle').disabled=q('#nightSkyLift').disabled=!aim||blocked;
  q('#launchLantern').disabled=!aim||blocked;q('#launchLantern').textContent=flight?'星灯正在飞行':between||completed?'本幕已放飞':'放飞星灯';
  q('#nightSkyLeft').disabled=q('#nightSkyRight').disabled=!flight||blocked||game.flight.adjusted;
  q('#nightSkyRudder').textContent=game.flight?.adjusted?'本盏修正已用完':'每盏星灯只有一次空中修正';
  q('#nightSkyNext').classList.toggle('hidden',!between);q('#nightSkyNext').disabled=blocked||game.phaseTime<1.5;
  q('#nightClaim').classList.toggle('hidden',!completed);q('#nightClaim').disabled=transport||paused||checkpointing;
  q('#nightPause').textContent=paused?'继续相聚':'暂停';
  q('#nightSkyStageNote').textContent=!arrived()?'伙伴正在收尾，沿道路前来':paused?'相聚已暂停 · 星灯与进度保留':transport?'正在确认本场进度':aim?'观察海风，瞄准亮星，再放飞':flight?'观察偏航 · A / D 可修正一次':completed?(game.score===4?'四点相连 · 今夜的星图亮了':'每一盏心愿，都已经送上夜空'):'这一幕已放飞 · 看看伙伴的回应';
  const report=game.reports.at(-1);
  q('#nightSkyStatus').textContent=completed?(game.score===4?'完美星图 · 伙伴一起为你庆祝':'星灯相聚完成 · '+game.score+' 颗星点亮'):between?(report.precise?'星点亮了！':'星灯从星点旁轻轻掠过'):flight?'第 '+(game.round+1)+' 幕 · 乘风而上':'第 '+(game.round+1)+' 幕 · 为这一盏选择路线';
  q('#nightSkyMessage').textContent=completed?'本场消耗与奖励由小岛账本确认，纪念品和协作来源会留在活动手账。':between?(report.precise?'这盏心愿落在星图上。下一幕的星点、横风和云带都会变化。':'下一幕仍可以继续。调整角度，也可以在飞行途中借一次风帆修正。'):flight?'横风会持续改变轨迹，云带也会推开星灯；一次修正可以挽回偏航。':'拖动天空或调整角度与升力。虚线路线只显示飞行的前一段，留意后面的风。';
 }
 function aim(angle,power){if(unavailable()||game.phase!=='aim')return;emit({action:{type:'aim',x:clamp(angle,-38,38),value:clamp(power,.65,1.3)}});}
 function launch(){if(unavailable()||game.phase!=='aim')return;emit({action:{type:'launch'}});sound('star');canvas.focus({preventScroll:true});}
 function correct(dir){if(unavailable()||game.phase!=='flight'||game.flight.adjusted)return;emit({action:{type:'adjust',dir}});sound('star');}
 q('#nightSkyAngle').oninput=e=>aim(Number(e.target.value),game.aim.power);q('#nightSkyLift').oninput=e=>aim(game.aim.angle,Number(e.target.value));
 q('#launchLantern').onclick=launch;q('#nightSkyLeft').onclick=()=>correct(-1);q('#nightSkyRight').onclick=()=>correct(1);
 q('#nightSkyNext').onclick=()=>{if(unavailable()||game.phase!=='between'||game.phaseTime<1.5)return;emit({action:{type:'next'}});canvas.focus({preventScroll:true});};
 q('#nightClaim').onclick=()=>{if(!unavailable()&&!checkpointing&&game.phase==='complete')controls.claim();};
 q('#nightPause').onclick=()=>{paused=!paused;last=0;controls.saveOutcome();paint();};
 q('#nightCancel').onclick=()=>{if(!quitting){quitting=true;paused=true;q('#nightCancel').textContent='确认结束 · 不发完成奖';paint();return;}controls.exit();};
 function pointer(e){if(unavailable()||game.phase!=='aim')return;const r=canvas.getBoundingClientRect(),x=((e.clientX-r.left)/r.width*960-50)/8.6,y=((e.clientY-r.top)/r.height*540-24)/4.9,dx=x-50,dy=Math.max(1,94-y);aim(Math.atan2(dx,dy)*180/Math.PI,Math.hypot(dx,dy)/150+.65);}
 canvas.onpointerdown=e=>{if(unavailable()||game.phase!=='aim')return;dragging=true;canvas.setPointerCapture(e.pointerId);canvas.focus({preventScroll:true});pointer(e);};
 canvas.onpointermove=e=>{if(dragging&&performance.now()-lastAim>50){lastAim=performance.now();pointer(e);}};
 canvas.onpointerup=e=>{if(dragging)pointer(e);dragging=false;};canvas.onpointercancel=()=>dragging=false;
 function keyboard(e){if(e.target instanceof HTMLInputElement||e.target instanceof HTMLButtonElement)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)){e.preventDefault();if(e.key===' ')launch();else if(game.phase==='aim')aim(game.aim.angle+(e.key==='ArrowLeft'?-2:e.key==='ArrowRight'?2:0),game.aim.power+(e.key==='ArrowUp'?.05:e.key==='ArrowDown'?-.05:0));}if(e.key.toLowerCase()==='a')correct(-1);if(e.key.toLowerCase()==='d')correct(1);}
 root.addEventListener('keydown',keyboard);
 function pause(){paused=true;last=0;dragging=false;controls.saveOutcome();paint();}
 function visibility(){if(document.hidden)pause();}
 window.addEventListener('blur',pause);document.addEventListener('visibilitychange',visibility);
 function tick(ts){if(ended)return;const dt=last?Math.min(.05,Math.max(0,(ts-last)/1000)):0;last=ts;if(!paused&&!transport&&game.phase!=='complete'&&dt)emit({dt});if(!paused)drawTime+=dt;renderer.draw(game,reduced?0:drawTime,arrived());frame=requestAnimationFrame(tick);}
 artReady.then(()=>{if(!ended){paint();renderer.draw(game,drawTime,arrived());}}).catch(()=>{});
 paint();frame=requestAnimationFrame(tick);
 return{inspect:()=>({loaded:true,kind:'night-party',game,paused,transport,checkpointing,renderer:renderer.inspect()}),setCheckpointPending:v=>{checkpointing=v;paint();},setTransportPaused:v=>{transport=v;last=0;dragging=false;paint();},destroy(){if(ended)return;ended=true;cancelAnimationFrame(frame);root.removeEventListener('keydown',keyboard);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',visibility);controls.saveOutcome();}};
}
