import {makeWorkshopPainter,prepareStage} from './workshopView.js';
import {drawAnimatedCharacter} from './characters.js';
import {createWorkshopAudio} from './workshopAudio.js';
import {getSoundUI} from './soundUI.js';
import {startFishingRound,fishingAction,tickFishing,fishingScore,FISHING_SKILLS} from './fishingRules.js';
import {esc} from './journeyUI.js';
export function mountFishingMatch(root,{session,theme,profile,avatar,persist,onClaim,onAbandon,controls=null}){
 const m=controls?structuredClone(session.match):session.match;if(controls&&m.current)m.current.holding=false;
 const save=()=>{if(!controls)persist();},trace=e=>controls?.trace(e);
 root.innerHTML='<div class="fishing-scoreboard"></div><div class="fishing-stage"><canvas width="960" height="540" tabindex="0" role="application" aria-label="钓鱼水面：点击鱼影抛竿，咬钩后提竿，按住收线，松开放线"></canvas><span class="fishing-water-label">晨光湾 / 六竿之约</span><div class="fishing-pause-cover" hidden><strong>潮汐等你回来</strong><p>比赛和 NPC 成绩都已暂停</p><button class="primary" data-fish="resume">继续这场比赛</button></div></div><div class="fishing-live"><div><span id="fishingRound"></span><b id="fishingMessage" role="status"></b><small id="fishingHint"></small></div><div class="fishing-gauges"><label>鱼线张力<meter id="fishingTension" min="0" max="1" low=".18" high=".75" optimum=".45"></meter></label><label>收线进度<progress id="fishingProgress" max="1"></progress></label></div></div><div class="fishing-controls"><button class="primary" data-fish="next">第一竿 · 开始</button><button class="primary" id="fishingControl" hidden>抛竿</button><button class="primary" data-fish="claim" hidden>领取活动奖励</button><button class="secondary" data-fish="pause">暂停</button><button class="secondary" data-fish="sound">声音</button><button class="secondary" data-fish="volume" aria-label="声音设置">音量</button><button class="secondary" data-fish="quit">结束本场</button></div><p class="fishing-help">点击水面选择落点；浮漂亮起金环再提竿。按住按钮或空格收线，鱼挣扎时松开。左右方向键可移动准星，水面也支持触摸。</p><div class="fishing-round-records"></div>';
 const $=q=>root.querySelector(q),canvas=$('canvas'),painter=makeWorkshopPainter(canvas,theme,avatar),audio=createWorkshopAudio();
 let transport=false,ended=false,frame=0,last=0,lastSave=0,lastMode='',lastCount=m.results.length,paused=m.phase==='playing',lastSignature='',lastHud=0;
 let player={npcId:-1,appearance:avatar,x:168,y:497,direction:-Math.PI/4,phase:0,walkMix:0};
 const npcs=[{npcId:8,x:796,y:423,direction:-Math.PI/2,walkMix:0},{npcId:2,x:890,y:500,direction:-Math.PI/2,walkMix:0},...(Number.isInteger(session.guestId)?[{npcId:session.guestId,x:668,y:485,direction:-Math.PI/2,walkMix:0,spectator:true}]:[])];
 const release=()=>{if(m.current)m.current.holding=false;trace({neutral:true});};
 function pause(){if(m.phase==='playing'){paused=true;release();audio.pause();if(controls)controls.saveOutcome();else persist();paint()}}
 function send(action){if(paused||ended||transport&&action.type!=='up')return;if(action.x!==undefined)action={...action,x:Math.max(0,Math.min(960,action.x)),y:Math.max(0,Math.min(540,action.y))};audio.unlock();if(!fishingAction(m,action))return;trace({action});save();paint()}
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*960,y:(e.clientY-r.top)/r.height*540}};
 canvas.onpointerdown=e=>{e.preventDefault();canvas.focus();canvas.setPointerCapture(e.pointerId);send({type:'down',...point(e)})};
 canvas.onpointermove=e=>{if(!paused&&!transport)send({type:'point',...point(e)})};
 canvas.onpointerup=canvas.onpointercancel=()=>send({type:'up'});
 const control=$('#fishingControl');control.onpointerdown=e=>{e.preventDefault();control.setPointerCapture(e.pointerId);send({type:'down'})};control.onpointerup=control.onpointercancel=()=>send({type:'up'});
 function key(e){
  if(![canvas,control].includes(document.activeElement))return;
  if(e.code==='Space'||e.code==='Enter'&&document.activeElement===control){e.preventDefault();if(!e.repeat)send({type:e.type==='keydown'?'down':'up'});}
  else if(e.type==='keydown'&&e.code.startsWith('Arrow')&&m.current){e.preventDefault();const p=m.current.pointer;send({type:'point',x:p.x+(e.code==='ArrowLeft'?-22:e.code==='ArrowRight'?22:0),y:p.y+(e.code==='ArrowUp'?-16:e.code==='ArrowDown'?16:0)})}
 }
 const onVisibility=()=>{if(document.hidden)pause()};window.addEventListener('hd-sound-settings',pause);
 window.addEventListener('blur',pause);document.addEventListener('visibilitychange',onVisibility);root.addEventListener('keydown',key);root.addEventListener('keyup',key);
 $('[data-fish="next"]').onclick=()=>{if(transport||!startFishingRound(m))return;audio.unlock();paused=false;trace({action:{type:'next'}});save();paint();canvas.focus()};
 $('[data-fish="resume"]').onclick=()=>{if(transport)return;paused=false;last=0;audio.resume();paint();canvas.focus()};
 $('[data-fish="pause"]').onclick=pause;
 $('[data-fish="volume"]').onclick=()=>getSoundUI().open();
 $('[data-fish="sound"]').onclick=()=>{audio.toggle();paint()};
 $('[data-fish="claim"]').onclick=()=>{release();audio.event({kind:'victory'});onClaim()};
 let quitting=false;
 $('[data-fish="quit"]').onclick=()=>{if(!quitting){quitting=true;pause();$('[data-fish="quit"]').textContent='确认结束 · 不发完成奖';return}onAbandon()};
 function paint(){
  const c=m.current,l=m.rounds[Math.min(m.index,5)],score=fishingScore(m);
  $('.fishing-pause-cover').hidden=!paused;
  $('#fishingRound').textContent='第 '+Math.min(m.index+1,6)+' / 6 竿'+(m.phase==='playing'?' · 本竿剩余 '+Math.max(0,Math.ceil(25-c.t))+' 秒':'');
  $('#fishingMessage').textContent=m.phase==='results'?'六竿落定，把这段海风收藏起来。':m.phase==='round_result'?m.results.at(-1).reason:m.phase==='ready'?'看一眼潮汐，准备第一竿。':c.message;
  $('#fishingHint').textContent=m.phase==='playing'?(c.mode==='fight'?(c.surge?'猛烈挣扎 · 松开放线':'鱼正在平静 · 按住收线'):'本轮 '+l.name+' · '+l.grade+' 分 · 风向 '+(l.wind<0?'←':'→')+Math.round(Math.abs(l.wind))):'钓获 1–3 分 · 精准提竿 +1 · 首次三连钓获 +2';
  $('#fishingTension').value=c?.tension||0;$('#fishingProgress').value=c?.progress||0;
  $('[data-fish="next"]').hidden=!['ready','round_result'].includes(m.phase);$('[data-fish="next"]').textContent=m.phase==='ready'?'第一竿 · 开始':'下一竿 · 第 '+(m.index+1)+' / 6';
  control.hidden=m.phase!=='playing';control.disabled=paused||transport||['casting','landed','lost'].includes(c?.mode);
  control.textContent=({aim:'瞄准后抛竿',casting:'抛竿入水…',waiting:'等待金环咬钩',bite:'现在提竿！',fight:c?.holding?'正在收线 · 松开放线':'按住收线',landed:'收获入册',lost:'等待下一竿'})[c?.mode]||'抛竿';
  control.dataset.mode=c?.mode||'ready';$('[data-fish="pause"]').disabled=m.phase!=='playing'||paused;$('[data-fish="claim"]').hidden=m.phase!=='results';$('[data-fish="claim"]').disabled=transport;$('[data-fish="next"]').disabled=transport;
  $('[data-fish="sound"]').textContent=audio.muted?'声音：关':'声音：开';
  const signature=JSON.stringify([m.index,m.results,score.rows]);
  if(signature!==lastSignature){
   lastSignature=signature;
   $('.fishing-scoreboard').innerHTML=score.rows.map(r=>'<article class="'+(r.id===-1?'is-player':'')+'"><span>'+esc(r.id===-1?profile(-1).name:profile(r.id).name)+'</span><strong>'+r.score+'<small> 分</small></strong><em>'+(r.id===-1?'你的钓位':FISHING_SKILLS.find(n=>n.id===r.id).title+' · 技能 '+Math.round(FISHING_SKILLS.find(n=>n.id===r.id).skill*100)+'%')+'</em></article>').join('');
   $('.fishing-round-records').innerHTML=m.results.map(r=>'<span class="'+(r.caught?'caught':'missed')+'">第 '+r.round+' 竿 · '+(r.caught?r.name+' +'+r.points:'未钓获')+(r.perfect?' · 精准':'')+(r.combo?' · 三连':'')+'</span>').join('');
  }
 }
 function draw(ts){
  if(ended)return;const dt=last?Math.min(.05,(ts-last)/1000):0;last=ts;
  if(!paused&&!transport&&dt>0){tickFishing(m,dt);trace({dt});if(ts-lastSave>2000&&m.phase==='playing'){lastSave=ts;save()}}
  const c=m.current,l=m.rounds[Math.min(m.index,5)],renderRound=m.phase==='round_result'||m.phase==='results'?m.rounds[Math.max(0,m.index-1)]:l;
  if(c?.mode!==lastMode){
   if(c?.mode==='bite'){audio.event({kind:'bite'});painter.event({kind:'splash',x:renderRound.spot.x,y:renderRound.spot.y})}
   if(c?.mode==='landed'){audio.event({kind:'catch'});painter.event({kind:'catch',art:'fish',x:c.fish.x,y:c.fish.y})}
   if(c?.mode==='lost')audio.event({kind:'failure'});
   lastMode=c?.mode||'';
  }
  if(lastCount!==m.results.length){lastCount=m.results.length;save();}
  const mode=({aim:'cast',landed:'landing',lost:'cast'})[c?.mode]||c?.mode||'cast';
  painter.render({id:16,kind:'angling',phase:'playing',level:{spots:[renderRound.spot],wind:renderRound.wind},catch:0,mode,t:c?.t||0,fish:c?.fish||renderRound.spot,castTarget:c?.castTarget,castAge:c?.modeT||0,tension:c?.tension||.25,progress:c?.progress||0,holding:c?.holding||false,fightStart:(c?.t||0)-(c?.fightAge||0),surge:c?.surge||false},ts);
  const ctx=canvas.getContext('2d');ctx.save();ctx.scale(canvas.width/960,canvas.height/540);
  player.action={type:c?.mode==='landed'?'celebrate':'fishing-pose',t:((c?.fightAge||c?.modeT||0)*((c?.holding)?1.9:1))%1.6,duration:1.6};
  drawAnimatedCharacter(ctx,player,theme,'#aa8260',false,(m.elapsed||0),1.37);
  for(const [i,n] of npcs.entries()){n.action={type:m.phase==='round_result'||m.phase==='results'?'celebrate':n.spectator?'talk':'fish',t:((m.elapsed||0)+i*.7)%1.6,duration:1.6};drawAnimatedCharacter(ctx,n,theme,'#b59c72',true,m.elapsed||0,.8)}
  if(c?.mode==='aim'){ctx.strokeStyle='#fff2bc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(c.pointer.x,c.pointer.y,12,0,Math.PI*2);ctx.moveTo(c.pointer.x-20,c.pointer.y);ctx.lineTo(c.pointer.x+20,c.pointer.y);ctx.stroke()}
  ctx.restore();if(ts-lastHud>100){paint();lastHud=ts}frame=requestAnimationFrame(draw);
 }
 if(Number.isInteger(session.guestId)){const label=document.createElement('p');label.className='fishing-spectator';label.textContent=profile(session.guestId).name+' · '+(session.guestReason||'来海边陪你一起等潮汐');root.querySelector('.fishing-stage').after(label);}
 prepareStage(theme).catch(()=>{});paint();frame=requestAnimationFrame(draw);
 return {setTransportPaused:v=>{transport=v;last=0;paint();},destroy(){if(ended)return;ended=true;cancelAnimationFrame(frame);release();if(controls)controls.saveOutcome();else persist();painter.destroy();audio.destroy();window.removeEventListener('hd-sound-settings',pause);window.removeEventListener('blur',pause);document.removeEventListener('visibilitychange',onVisibility);root.removeEventListener('keydown',key);root.removeEventListener('keyup',key)},inspect:()=>({match:m,paused,transport})};
}
