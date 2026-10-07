import {WORKSHOP_GAMES} from './workshopCatalog.js';
import {mountWorkshopGame} from './workshopGames.js';
import {createGameContext} from './gameLevels.js';
import {prepareStage,paintPanel} from './workshopView.js';
import {DEFAULT_RECIPES} from './contentCatalog.js';
import {drawItem} from './artStore.js';
let theme=new URLSearchParams(location.search).get('theme')||localStorage.getItem('hd-arcade-theme')||'origami';if(!['origami','pixel'].includes(theme))theme='origami';
let game=null,current=null;const root=document.querySelector('#arcadeRoot');let history;try{history=JSON.parse(localStorage.getItem('hd-arcade-history')||'{}')}catch{history={}}history??={};
const persist=()=>localStorage.setItem('hd-arcade-history',JSON.stringify(history));
function applyTheme(){document.body.dataset.theme=theme;document.querySelector('#arcadeTheme').textContent='切换'+(theme==='pixel'?'折纸':'像素')+'风';localStorage.setItem('hd-arcade-theme',theme)}
function home(){
 game?.destroy();game=null;current=null;const url=new URL(location.href);url.searchParams.delete('game');url.searchParams.delete('seed');url.searchParams.delete('difficulty');window.history.replaceState(null,'',url);
 root.innerHTML='<section class="arcade-introduction"><div><small>A COLLECTION OF LITTLE WORLDS</small><h1>在小岛，认真玩一会。</h1><p>煮一桌热饭，修复一幅旧画，或把小船稳稳驶入港湾。<br>每次相遇，都是一场新的挑战。</p></div><div class="arcade-count">21<small>可独立游玩的岛屿挑战</small></div></section><section class="arcade-grid" aria-label="小游戏书架">'+Object.entries(WORKSHOP_GAMES).map(([id,g])=>'<button class="arcade-card" data-game="'+id+'"><canvas width="640" height="320" aria-hidden="true"></canvas><div class="arcade-card-copy"><small>'+g.kicker+'</small><h2>'+g.title+'</h2><p>'+g.objective+'</p><div class="arcade-card-bottom"><span>'+g.minutes+' · 三档难度</span><b>翻开这一页 →</b></div></div></button>').join('')+'</section>';
 paintCards();window.scrollTo({top:0});
}
async function paintCards(){await prepareStage(theme);if(current!=null)return;for(const b of root.querySelectorAll('[data-game]')){const id=+b.dataset.game,c=b.querySelector('canvas').getContext('2d');paintPanel(c,theme,WORKSHOP_GAMES[id].panel,0,0,640,320);c.fillStyle='#15342c15';c.fillRect(0,0,640,320);drawItem(c,DEFAULT_RECIPES[id].item,theme,320,161,218);}setTimeout(()=>{if(current==null)for(const b of root.querySelectorAll('[data-game]')){const id=+b.dataset.game,c=b.querySelector('canvas').getContext('2d');paintPanel(c,theme,WORKSHOP_GAMES[id].panel,0,0,640,320);drawItem(c,DEFAULT_RECIPES[id].item,theme,320,161,218);}},600);}
function open(id){
 if(!WORKSHOP_GAMES[id])return;game?.destroy();current=id;
 const params=new URLSearchParams(location.search),fixed=params.has('seed'),options=createGameContext(history,id,{theme,standalone:true,onExit:home,avatar:'female_2',persist},params.get('difficulty')||undefined);
 if(fixed)options.level.seed=+params.get('seed');
 root.innerHTML='<section class="arcade-session"><header><button id="arcadeBack">← 游戏书架</button><span>自由游玩 · 不消耗岛屿材料</span></header><div id="arcadeGame"></div></section>';
 game=mountWorkshopGame(document.querySelector('#arcadeGame'),id,result=>{home();const note=document.createElement('div');note.className='arcade-receipt';note.setAttribute('role','status');note.textContent='挑战已完成 · '+result.stars+' 星 · '+result.score+' 分';document.body.append(note);setTimeout(()=>note.remove(),3500)},options);
 const url=new URL(location.href);url.searchParams.set('game',id);url.searchParams.set('theme',theme);window.history.replaceState(null,'',url);document.querySelector('#arcadeBack').onclick=home;window.scrollTo({top:0});
}
root.addEventListener('click',e=>{const b=e.target.closest('[data-game]');if(b)open(+b.dataset.game)});
document.querySelector('#arcadeHome').onclick=home;
document.querySelector('#arcadeTheme').onclick=()=>{theme=theme==='pixel'?'origami':'pixel';applyTheme();current==null?home():open(current)};
window.addEventListener('pagehide',()=>game?.destroy());
applyTheme();const initial=+new URLSearchParams(location.search).get('game');if(new URLSearchParams(location.search).has('game')&&WORKSHOP_GAMES[initial])open(initial);else home();
if(new URLSearchParams(location.search).has('qa'))window.arcadeInspect=()=>game?.inspect()||null;
