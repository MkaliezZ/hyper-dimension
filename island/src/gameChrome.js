import {DIFFICULTIES} from './gameLevels.js';
import {getSoundUI} from './soundUI.js';
export function addGameChrome(root,options,restart){
 const bar=document.createElement('div');bar.className='game-level-bar';
 bar.innerHTML='<div><span class="game-level-badge difficulty-'+options.level.difficulty+'">'+DIFFICULTIES[options.level.difficulty]+'关卡</span><small>每局新目标 · 难度可自由选择</small></div><div class="game-difficulty" aria-label="小游戏难度"></div>';
 for(const [mode,title] of [['auto','随熟练度'],['1','轻松'],['2','标准'],['3','挑战']]){
  const b=document.createElement('button');b.type='button';b.textContent=title;b.dataset.difficulty=mode;b.className=(String(options.mode)===mode?'active':'');
  b.setAttribute('aria-pressed',String(String(options.mode)===mode));b.title='以'+title+'难度开始新一局';b.onclick=()=>restart(mode);bar.lastElementChild.append(b);
 }
 const volume=document.createElement('button');volume.type='button';volume.textContent='音量';volume.setAttribute('aria-label','声音设置');volume.onclick=()=>getSoundUI().open();bar.lastElementChild.append(volume);
 root.querySelector('.room-game').prepend(bar);
}
