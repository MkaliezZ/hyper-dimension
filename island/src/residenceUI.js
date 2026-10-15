import {homeResearchChallenge,homeResearchSolved} from './homeResearchActivities.js';
import {mountResearchGame,refreshResearchGame,resetResearchGame} from './homeResearchUI.js';
import {homeNatureChallenge,homeNatureSolved} from './homeNatureActivities.js';
import {mountNatureGame,refreshNatureGame,resetNatureGame} from './homeNatureUI.js';
import {homeEverydayChallenge,homeEverydaySolved} from './homeEverydayActivities.js';
import {mountEverydayGame,refreshEverydayGame,resetEverydayGame,photoCropMarkup} from './homeEverydayUI.js';
import {RESIDENCE_LAYOUTS,homeWalkable,homeZoneAt} from './residenceLayouts.js';
import {nurseryChallenge,nurseryErrors,nurserySolved,solveNursery,joineryChallenge,slideWood,joinerySolved} from './homeActivities.js';
import {drawAnimatedCharacter} from './characters.js';
import {findPath} from './world.js';
import {followPath} from './movement.js';
import {CROPS} from './farming.js';
import {SEASON_NAMES} from './environmentClock.js';
import {residentSchedule} from './residentSchedule.js';
import {wornItems} from './equipmentRules.js';
import {esc} from './journeyUI.js';
import {homeSocialChallenge,homeSocialSolved} from './homeSocialActivities.js';
import {mountSocialGame,refreshSocialGame} from './homeSocialUI.js';
import {homeCraftChallenge,homeCraftSolved} from './homeCraftActivities.js';
import {mountCraftGame,refreshCraftGame} from './homeCraftUI.js';

export function createResidenceUI({state,theme,environment,profile,resident,openModal,closeModal,talk,itemArt,command,recipes,goFarm}){
  let active=null;
  function destroy(){
    if(!active)return;
    active.disposed=true;cancelAnimationFrame(active.frame);active.resize?.disconnect();
    document.removeEventListener('visibilitychange',active.visibility);active=null;
  }
  function open(id){
    const layout=RESIDENCE_LAYOUTS[id];if(!layout)return false;
    const owner=profile(id),style=theme(),url=layout.image(style);
    openModal(esc(layout.name),esc(owner.name)+'的家 · '+esc(owner.job),
      '<section class="home-visit"><div class="home-scene-column"><div class="home-room" aria-busy="true">'+
      '<img class="home-room-art" src="'+url+'" alt="'+esc(layout.name)+'的独立室内布局"/>'+
      '<canvas class="home-room-actors" aria-label="点击地板行走，点击家具查看或互动"></canvas>'+
      '<div class="home-loading" role="status">正在打开门扉…</div>'+
      '<div class="home-room-markers">'+layout.zones.map((z,i)=>'<button class="home-marker" data-home-zone="'+z.id+'" style="left:'+((z.rect[0]+z.rect[2]/2)/10)+'%;top:'+((z.rect[1]+z.rect[3]*.65)/6.6)+'%" aria-label="走到'+z.name+'"><span>'+(i+1)+'</span><span class="home-marker-name">'+z.name+'</span></button>').join('')+'</div></div>'+
      '<div class="home-room-caption"><span>点击地面行走 · 家具前停留互动</span><button class="secondary" data-home-labels aria-pressed="true">收起标记</button></div><nav class="home-shortcuts" aria-label="家中家具">'+layout.zones.map((z,i)=>'<button class="secondary" data-home-zone="'+z.id+'">'+(i+1)+' · '+z.name+'</button>').join('')+'</nav></div>'+
      '<aside class="home-sidebar"><div class="home-presence" role="status"></div><div class="home-detail"></div></aside></section>',
      '<button class="primary home-game-save hidden" disabled>完成后记入手账</button><button class="secondary" id="homeReturn">返回小岛</button><button class="primary" id="visitHomeOwner">和'+esc(owner.name)+'交流</button>');
    const root=document.querySelector('.home-visit'),modal=root.closest('.modal'),room=root.querySelector('.home-room'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
    modal.classList.add('residence-dialog');
    const session={id,layout,style,url,owner,root,room,canvas,ctx,loaded:false,disposed:false,last:0,time:0,frame:0,selected:null,player:{...layout.entry,path:[],phase:0,face:1,direction:-Math.PI/2,walkMix:0},game:null,presence:'',statusAt:0};
    active=session;
    root.querySelector('[data-home-labels]').onclick=e=>{const button=e.currentTarget,on=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(on));button.textContent=on?'收起标记':'显示标记';room.classList.toggle('home-hide-markers',!on);};
    document.getElementById('homeReturn').onclick=closeModal;
    document.getElementById('visitHomeOwner').onclick=()=>talk(id);
    root.querySelectorAll('[data-home-zone]').forEach(button=>button.onclick=()=>visitZone(session,layout.zones.find(z=>z.id===button.dataset.homeZone)));
    canvas.onclick=e=>{if(!session.loaded)return;const r=canvas.getBoundingClientRect(),p={x:(e.clientX-r.left)*1000/r.width,y:(e.clientY-r.top)*660/r.height},zone=homeZoneAt(layout,p.x,p.y);if(zone)visitZone(session,zone);else if(homeWalkable(layout,p.x,p.y))walk(session,p,null);};
    session.visibility=()=>{session.last=0;};document.addEventListener('visibilitychange',session.visibility);
    session.resize=new ResizeObserver(()=>{const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.max(1,Math.round(r.width*dpr));canvas.height=Math.max(1,Math.round(r.height*dpr));});session.resize.observe(canvas);
    const image=root.querySelector('.home-room-art');
    const ready=()=>{if(active!==session)return;session.loaded=true;room.setAttribute('aria-busy','false');root.querySelector('.home-loading')?.remove();};
    image.onload=ready;image.onerror=()=>{if(active!==session)return;root.querySelector('.home-loading').innerHTML='房间画面未载入。<button class="secondary" data-home-retry>重新载入</button>';root.querySelector('[data-home-retry]').onclick=()=>{image.src=url+'?retry='+Date.now();};};
    if(image.complete&&image.naturalWidth)ready();
    overview(session);presence(session);session.frame=requestAnimationFrame(t=>frame(session,t));return true;
  }
  function walk(s,p,after){
    if(!s.loaded||s.disposed)return;
    const route=findPath(s.player,p,(x,y)=>homeWalkable(s.layout,x,y),10);
    if(!route.length){if(Math.hypot(s.player.x-p.x,s.player.y-p.y)<22)after?.();return;}
    s.player.path=route;s.player.after=after;s.player.action=null;s.target=p;
  }
  function visitZone(s,z){walk(s,z.entry,()=>{s.player.direction=Math.atan2(z.rect[1]+z.rect[3]*.5-s.player.y,z.rect[0]+z.rect[2]*.5-s.player.x);s.player.action={type:'arrange',leisure:true,t:0,duration:1.6};detail(s,z);});}
  function presence(s){
    const n=resident(s.id),schedule=residentSchedule(s.id,environment()),text=n?.homeRest?'主人在休息，轻声看一看。':schedule?.working?'主人正在工作，也可以通过联络按钮交流。':'主人在岛上生活，家中保留着今天的记录。';
    if(text===s.presence)return;s.presence=text;
    s.root.querySelector('.home-presence').innerHTML='<span class="home-status-dot '+(n?.homeRest?'resting':'')+'"></span><div><b>'+esc(profile(s.id).name)+'</b><p>'+text+'</p></div>';
  }
  function frame(s,t){
    if(active!==s||s.disposed)return;
    const dt=s.last&& !document.hidden?Math.min(.05,(t-s.last)/1000):0;s.last=t;s.time+=dt;
    if(s.loaded&&!document.hidden){
      followPath(s.player,dt,165);
      if(s.player.action){s.player.action.t+=dt;if(s.player.action.t>=s.player.action.duration)s.player.action=null;}
      const {ctx,canvas}=s;ctx.setTransform(canvas.width/1000,0,0,canvas.height/660,0,0);ctx.clearRect(0,0,1000,660);
      if(s.player.path.length&&s.target){ctx.strokeStyle=s.style==='pixel'?'#f2e3a6':'#fff5d4';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(s.target.x,s.target.y,13+Math.sin(s.time*3),5,0,0,Math.PI*2);ctx.stroke();}
      s.player.appearance=state().playerProfile?.avatar;s.player.garments=wornItems(state());drawAnimatedCharacter(ctx,s.player,s.style,'#c39368',false,s.time,1.05);
      // Local window/lantern glints are tied to painted light sources, never a full-room tint.
      for(const[x,y]of s.layout.lamps){const r=12+Math.sin(s.time*1.3+x)*1.2,g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'#fff5b238');g.addColorStop(1,'#fff5b200');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
      if(resident(s.id)?.homeRest){ctx.fillStyle='#f2e6c7';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.globalAlpha=.65+Math.sin(s.time)*.1;ctx.fillText('休息中',s.layout.bed.x,s.layout.bed.y-35);ctx.globalAlpha=1;}
      if(s.time-s.statusAt>1){presence(s);s.statusAt=s.time;}
    }
    s.frame=requestAnimationFrame(next=>frame(s,next));
  }
  const panel=s=>s.root.querySelector('.home-detail');
  const saveButton=s=>s.root.closest('.modal').querySelector('.home-game-save');
  function overview(s){
    panel(s).innerHTML='<small class="home-eyebrow">一间有主人的家</small><h3>'+esc(s.layout.name)+'</h3><p>'+esc(s.layout.intro)+'</p><blockquote>'+esc(s.owner.personality)+'</blockquote><p class="home-soft">走到家具前，读读留下的记录，或玩一会儿主人的桌上游戏。</p>';
  }
  function detail(s,z){
    if(active!==s)return;s.selected=z.id;saveButton(s).classList.toggle('hidden',z.kind!=='activity');s.root.classList.toggle('home-playing',z.kind==='activity'&&s.id>=2);
    panel(s).innerHTML='<small class="home-eyebrow">'+esc(s.layout.name)+'</small><h3>'+esc(z.name)+'</h3><p>'+esc(z.description)+'</p><div class="home-zone-content"></div>';
    const body=panel(s).querySelector('.home-zone-content');
    if(z.kind==='activity'){mountGame(s,body);return;}
    if(z.kind==='record'){
      const row=state().homeActivities?.[s.id];body.innerHTML=row?'<div class="home-keepsake"><small>第 '+row.lastDay+' 天</small><b>'+esc(row.last.title)+'</b><p>已经留下 '+row.completedDays+' 天的记录。</p><span>闲暇里的小小完成</span></div>':'<div class="home-keepsake"><b>这一页还空着</b><p>完成桌上游戏后，留下一张今天的手账。</p></div>';
      if(s.id===7&&state().homeActivities?.[7]?.last?.kind==='photography'){body.innerHTML+='<div class="home-saved-photos">'+state().homeActivities[7].last.board.map(frame=>photoCropMarkup(frame,s.url)).join('')+'</div>';}
      if(s.id===0){const challenge=nurseryChallenge(state().day,environment().season);body.innerHTML+='<h4>本季的种苗</h4><div class="home-seed-catalog">'+challenge.crops.map(id=>'<span>'+itemArt(id)+'<b>'+CROPS[id].name+'</b></span>').join('')+'</div>';}
    }else if(z.kind==='farm'){
      const plots=state().plots||[],needs=plots.filter(p=>p.stage===2).length,ripe=plots.filter(p=>p.stage===4).length;
      body.innerHTML='<div class="home-farm-summary"><b>来自真实农田</b><span>'+needs+' 块待浇水 · '+ripe+' 块可收获</span></div><button class="primary" data-home-farm>前往照料田地</button>';body.querySelector('button').onclick=goFarm;
    }else if(z.kind==='weather'){
      const e=environment(),weather=e.weather,ready=weather?.id==='clear'&&['night','dusk'].includes(e.period);
      body.innerHTML='<div class="home-keepsake"><b>'+esc(SEASON_NAMES[e.season]+'季 · '+(weather?.name||'天气未同步'))+'</b><p>岛上时刻 '+esc(e.clockText||'—')+'</p><span>'+(s.id===3?(ready?'天空晴朗，适合观测。':'先整理已经记录的星图，等到晴朗的夜晚再观察。'):s.id===8?'这是小岛当前天气，行囊桌上的海况是单独的每日演练。':'留意此刻的光线，天气会改变家里的观察。')+'</span></div><p>'+((weather?.watersCrops)?'今天的降水会照料露天田地。':'露天作物仍需要按田块状态照料。')+(weather?.fishingAssist?' 雨天钓鱼更容易把握。':'')+'</p>';
    }else if(z.kind==='recipes'){body.innerHTML='<button class="primary" data-home-recipes>翻阅制作配方</button>';body.querySelector('button').onclick=recipes;
    }else if(z.kind==='bed'){const schedule=residentSchedule(s.id,environment());const clock=h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.round(h%1*60)).padStart(2,'0');body.innerHTML='<div class="home-keepsake"><b>安静的生活角</b><p>'+clock(schedule.sleep)+' 休息 · '+clock(schedule.wake)+' 起床</p><span>作息跟随岛上的世界时钟。</span></div>';
    }else{const memory=state().npcMemory?.[s.id]?.at(-1)?.text;body.innerHTML='<blockquote>'+esc(memory||s.owner.lifeGoal)+'</blockquote>';}
  }
  function mountGame(s,body){
    const day=state().day,season=environment().season;
    if(!s.game||s.game.day!==day){const c=s.id===0?nurseryChallenge(day,season):s.id===1?joineryChallenge(day):homeSocialChallenge(s.id,day)||homeCraftChallenge(s.id,day)||homeEverydayChallenge(s.id,day)||homeNatureChallenge(s.id,day)||homeResearchChallenge(s.id,day);s.game={...c,values:s.id===0?[...c.givens]:[...c.board],selected:c.guests?.[0]??c.palette?.[0]??0,moves:'',saved:false,submitting:false};}
    const g=s.game;
    body.innerHTML='<div class="home-game"><div class="home-game-meta">第 '+g.day+' 天 · '+(g.kind==='nursery'?SEASON_NAMES[g.season]+'季育苗':{joinery:'木片修复',gathering:'四人小聚预排',starchart:'星迹观测整理',botanical:'花房标本拼贴',rigging:'船模绳路练习',baking:'早餐出炉计划',photography:'光影四帧',voyage:'潮汐行囊',leafprint:'一页叶影',archive:'六页航海录',strata:'地层标本复原'}[g.kind])+'</div><div class="home-game-board"></div><div class="home-game-controls"></div><p class="home-game-feedback" aria-live="polite"></p><p class="home-soft home-game-note">家中消遣不消耗物资；完成后保存手账。</p></div>';
    const board=body.querySelector('.home-game-board'),controls=body.querySelector('.home-game-controls');
    if(g.kind==='nursery'){
      board.classList.add('home-nursery');board.innerHTML=Array.from({length:16},(_,i)=>'<button data-home-cell="'+i+'" '+(g.givens[i]!==null?'disabled':'')+'></button>').join('');
      controls.innerHTML='<div class="home-seed-palette">'+g.crops.map((id,i)=>'<button data-home-seed="'+i+'" aria-label="选择'+CROPS[id].name+'">'+itemArt(id)+'<span>'+CROPS[id].name+'</span></button>').join('')+'</div><div class="home-game-tools"><button class="secondary" data-home-erase>擦除</button><button class="secondary" data-home-hint>给一点提示</button><button class="secondary" data-home-reset>重新排列</button></div>';
      board.querySelectorAll('[data-home-cell]').forEach(button=>button.onclick=()=>{if(g.submitting||g.saved)return;g.values[Number(button.dataset.homeCell)]=g.selected;refreshGame(s);});
      controls.querySelectorAll('[data-home-seed]').forEach(button=>button.onclick=()=>{g.selected=Number(button.dataset.homeSeed);refreshGame(s);});
      controls.querySelector('[data-home-erase]').onclick=()=>{g.selected=null;refreshGame(s);};
      controls.querySelector('[data-home-hint]').onclick=()=>{if(g.saved||g.submitting)return;const solved=solveNursery(g,g.values),index=g.values.indexOf(null);if(solved&&index>=0){g.values[index]=solved[index];refreshGame(s);}else feedback(s,'先调整标红的重复格，再试着找一个空格。');};
    }else if(g.kind==='joinery'){
      board.classList.add('home-wood-picture');board.innerHTML=Array.from({length:8},(_,tile)=>'<button data-home-wood="'+tile+'" aria-label="移动第'+(tile+1)+'块木片" style="background-image:url('+s.url+');background-position:'+(tile%3*50)+'% '+(Math.floor(tile/3)*50)+'%"><span>'+(tile+1)+'</span></button>').join('');
      controls.innerHTML='<div class="home-game-tools"><button class="secondary" data-home-picture aria-pressed="false">看原画</button><button class="secondary" data-home-undo>退一步</button><button class="secondary" data-home-reset>重新拼画</button></div>';
      board.querySelectorAll('button').forEach(button=>button.onclick=()=>{if(g.saved||g.submitting||g.moves.length>=2000)return;const tile=Number(button.dataset.homeWood),next=slideWood(g.values,tile);if(next){g.values=next;g.moves+=tile;refreshGame(s);}});
      controls.querySelector('[data-home-picture]').onclick=e=>{const on=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(on));board.classList.toggle('home-show-picture',on);board.style.backgroundImage=on?'url('+s.url+')':'';};
      controls.querySelector('[data-home-undo]').onclick=()=>{if(!g.moves.length||g.saved||g.submitting)return;g.values=slideWood(g.values,Number(g.moves.at(-1)));g.moves=g.moves.slice(0,-1);refreshGame(s);};
    }else {const options={g,board,controls,style:s.style,url:s.url,profile,itemArt,refresh:()=>refreshGame(s),feedback:text=>feedback(s,text)};mountSocialGame(options)||mountCraftGame(options)||mountEverydayGame(options)||mountNatureGame(options)||mountResearchGame(options);}
    controls.querySelector('[data-home-reset]').onclick=()=>{if(g.submitting)return;g.values=g.kind==='nursery'?[...g.givens]:[...g.board];g.moves='';g.saved=false;g.spins=[...g.values];g.showBreak=false;resetEverydayGame(g);resetNatureGame(g);resetResearchGame(g);refreshGame(s);};
    saveButton(s).onclick=async()=>{
      if(g.submitting||g.saved||!solved(g))return;g.submitting=true;refreshGame(s);
      try{const result=await command('home_activity',{homeId:s.id,day:g.day,...(g.kind==='nursery'?{season:g.season,board:[...g.values]}:g.kind==='joinery'?{moves:g.moves}:{board:[...g.values]})});g.saved=true;if(active===s&&s.game===g)feedback(s,result.receipt.text);}
      catch(error){if(active===s&&s.game===g)feedback(s,error.message);}
      finally{g.submitting=false;if(active===s&&s.game===g)refreshGame(s,true);}
    };
    refreshGame(s);
  }
  const solved=g=>g.kind==='nursery'?nurserySolved(g,g.values):g.kind==='joinery'?joinerySolved(g.values):homeSocialSolved(g,g.values)||homeCraftSolved(g,g.values)||homeEverydaySolved(g,g.values)||homeNatureSolved(g,g.values)||homeResearchSolved(g,g.values);
  function feedback(s,text){const el=panel(s).querySelector('.home-game-feedback');if(el)el.textContent=text;}
  function refreshGame(s,keepMessage=false){
    const g=s.game,body=panel(s).querySelector('.home-game');if(!g||!body)return;
    const done=solved(g);body.classList.toggle('is-complete',done);
    if(g.kind==='nursery'){
      const errors=nurseryErrors(g,g.values);
      body.querySelectorAll('[data-home-cell]').forEach(button=>{const i=Number(button.dataset.homeCell),v=g.values[i];button.classList.toggle('invalid',errors.includes(i));button.classList.toggle('fixed',g.givens[i]!==null);button.disabled=g.givens[i]!==null||g.saved||g.submitting;button.setAttribute('aria-label','第'+(Math.floor(i/4)+1)+'行第'+(i%4+1)+'格：'+(v===null?'空格':CROPS[g.crops[v]].name)+(g.givens[i]!==null?'，已定种苗':''));if(button.dataset.value!==String(v)){button.innerHTML=v===null?'':itemArt(g.crops[v]);button.dataset.value=String(v);}});
      body.querySelectorAll('[data-home-seed]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.homeSeed)===g.selected)));body.querySelector('[data-home-erase]').setAttribute('aria-pressed',String(g.selected===null));
      if(!keepMessage)feedback(s,g.saved?'今天的育苗手账已保存。':done?'每行、每列、每片小区，都有四种不同作物。':errors.length?'标红格重复了，试着挪换种苗。':'先选种苗，再选空格。每行、列和四格小区不重复。');
    }else if(g.kind==='joinery'){
      body.querySelectorAll('[data-home-wood]').forEach(button=>{const tile=Number(button.dataset.homeWood),i=g.values.indexOf(tile);button.style.transform='translate('+(i%3*100)+'%, '+(Math.floor(i/3)*100)+'%)';button.disabled=g.saved||g.submitting||!slideWood(g.values,tile);});
      if(!keepMessage)feedback(s,g.saved?'今天的木片拼画已保存。':done?'画面与接缝都对齐了。':'沿空位滑动木片 · 已移动 '+g.moves.length+' 步');
    }else {const options={g,body,url:s.url,profile,itemArt,done,keepMessage,feedback:text=>feedback(s,text)};refreshSocialGame(options)||refreshCraftGame(options)||refreshEverydayGame(options)||refreshNatureGame(options)||refreshResearchGame(options);}
    const save=saveButton(s);save.disabled=!done||g.submitting||g.saved;save.textContent=g.submitting?'正在记入手账…':g.saved?'已留在家中手账':done?'记下今天的小完成':'完成后记入手账';
  }
  return {open,destroy,inspect:()=>active?{id:active.id,loaded:active.loaded,zone:active.selected,player:{x:active.player.x,y:active.player.y,walking:!!active.player.walking,path:active.player.path.map(p=>({...p}))},game:active.game?{kind:active.game.kind,day:active.game.day,season:active.game.season,values:[...active.game.values],moves:active.game.moves,frame:active.game.frame?{...active.game.frame}:null,shot:active.game.shot??null,solved:solved(active.game),saved:active.game.saved}:null}:null};
}
