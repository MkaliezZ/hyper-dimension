import {getSoundMixer} from './soundMixer.js';
const ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z"/><path class="sound-wave" d="M16 8v8m4-11v14" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
export function createSoundUI({mixer=getSoundMixer(),button=document.getElementById('soundBtn')}={}){
 let dialog=null,preview=null,priorFocus=null;const labels={master:'总音量',music:'音乐',effects:'动作与游戏音效',ambience:'海浪与环境'};
 function paint(){
  const state=mixer.inspect(),p=state.preferences;if(button){if(!button.querySelector('svg'))button.innerHTML=ICON;button.dataset.muted=String(p.muted||p.master===0);button.setAttribute('aria-label','声音设置'+(p.muted?' · 已静音':''));button.title='声音设置';}
  if(!dialog)return;
  for(const [key,label] of Object.entries(labels)){const input=dialog.querySelector('[data-sound-volume="'+key+'"]');if(document.activeElement!==input)input.value=Math.round(p[key]*100);input.setAttribute('aria-valuetext',label+' '+Math.round(p[key]*100)+'%');dialog.querySelector('[data-sound-value="'+key+'"]').textContent=Math.round(p[key]*100)+'%';}
  const mute=dialog.querySelector('#soundMute');mute.textContent=p.muted?'开启声音':'全局静音';mute.setAttribute('aria-pressed',String(p.muted));
  dialog.querySelector('#soundState').textContent=state.error||(!state.unlocked?'点击试听，让岛屿发出声音。':p.muted?'全岛已静音，音量选择仍会保留。':p.master===0?'总音量为零。':state.blocked?'画面切到后台，声音已暂停。':'声音已开启 · 音乐、音效与环境分别可调');
 }
 const unsubscribe=mixer.subscribe(paint);
 function open(){
  if(!document.querySelector('link[href="/src/sound-v38.css"]')){const style=document.createElement('link');style.rel='stylesheet';style.href='/src/sound-v38.css';document.head.append(style);}
  if(dialog?.isConnected){dialog.focus();return;}void mixer.unlock();priorFocus=document.activeElement;preview=mixer.createScope('sound-preview');
  window.dispatchEvent(new CustomEvent('hd-sound-settings'));
  dialog=document.createElement('dialog');dialog.className='sound-sheet';dialog.setAttribute('aria-labelledby','soundHeading');
  dialog.innerHTML='<header class="sound-head"><div><small>晨光岛 / 岛屿声景</small><h2 id="soundHeading">听见小岛的日常</h2><p>把音乐、海风和手作声调到舒适的位置。</p></div><button class="close" id="soundClose" aria-label="关闭声音设置">×</button></header><div class="sound-body"><p id="soundState" role="status"></p><div class="sound-sliders">'+Object.entries(labels).map(([key,label])=>'<label><span>'+label+'<b data-sound-value="'+key+'"></b></span><input type="range" data-sound-volume="'+key+'" min="0" max="100" step="1" aria-label="'+label+'"></label>').join('')+'</div><h3>试听一段小岛生活</h3><div class="sound-previews"><button data-sound-cue="wood">木作落锤</button><button data-sound-cue="stone">矿镐轻击</button><button data-sound-cue="water">浇水与流水</button><button data-sound-cue="harvest">田园收获</button><button data-sound-cue="ocean">晨光海浪</button><button data-sound-cue="music">海岛旋律</button></div><p class="sound-note">音量保存在这台设备上，两种画风和所有小游戏共用。调整时小游戏会暂停，关闭后可继续挑战。</p></div><footer class="sound-footer"><button class="secondary" id="soundMute"></button><button class="primary" id="soundDone">调好了 · 回到小岛</button></footer>';
  document.body.append(dialog);
  dialog.querySelector('#soundClose').onclick=dialog.querySelector('#soundDone').onclick=()=>dialog.close();
  dialog.querySelector('#soundMute').onclick=()=>{void mixer.unlock();mixer.toggleMute()};
  for(const input of dialog.querySelectorAll('[data-sound-volume]'))input.oninput=()=>mixer.setPreferences({[input.dataset.soundVolume]:Number(input.value)/100});
  for(const b of dialog.querySelectorAll('[data-sound-cue]'))b.onclick=async()=>{await mixer.unlock();if(!preview)return;if(b.dataset.soundCue==='music'){for(const [i,n] of [60,64,67,72].entries())preview.tone(440*2**((n-69)/12),{category:'music',volume:.12,duration:.6,delay:i*.13});}else preview.play(b.dataset.soundCue,{category:b.dataset.soundCue==='ocean'?'ambience':'effects'});};
  dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation()});
  dialog.addEventListener('close',()=>{const closed=dialog;dialog=null;preview?.destroy();preview=null;closed?.remove();if(priorFocus?.isConnected)priorFocus.focus({preventScroll:true});paint();},{once:true});
  dialog.showModal();paint();dialog.querySelector('#soundClose').focus();
 }
 if(button)button.onclick=open;paint();
 return {open,destroy(){dialog?.close();preview?.destroy();unsubscribe();if(button)button.onclick=null;}};
}

let sharedUI=null;
export function getSoundUI(){sharedUI??=createSoundUI();return sharedUI;}
