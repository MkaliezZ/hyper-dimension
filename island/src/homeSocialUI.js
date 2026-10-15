import {HOME_SEATS,SKY_DIRECTIONS,SKY_COLORS,gatheringRule,seatGuest} from './homeSocialActivities.js';
import {residentPortraitMarkup} from './residentPortraits.js';
import {esc} from './journeyUI.js';

const ruleText=(r,profile)=>r.kind==='seat'?profile(r.guest).name+'需要安静一点，预留'+HOME_SEATS[r.seat]+'。':r.kind==='opposite'?profile(r.guest).name+'与'+profile(r.other).name+'隔桌相对，各留一点空间。':profile(r.guest).name+'坐在'+profile(r.other).name+'的'+(r.step===1?'顺':'逆')+'时针下一位，方便传递邀请函。';
export const skyDescription=star=>SKY_DIRECTIONS[star.sector]+' · '+SKY_COLORS[star.color].name+' · '+(star.bright?'明亮':'柔和');

export function mountSocialGame({g,board,controls,style,profile,refresh,feedback}){
  if(g.kind==='gathering'){
    board.classList.add('home-seating');board.innerHTML='<div class="home-table-center"><span>小聚预排</span><small>沿桌沿顺时针 ↻</small></div>'+HOME_SEATS.map((label,i)=>'<button data-home-seat="'+i+'" class="home-seat seat-'+i+'" aria-label="安排到'+label+'"><small>'+label+'</small><span class="home-seat-guest"></span></button>').join('');
    controls.innerHTML='<div class="home-guest-palette">'+g.guests.map(id=>'<button data-home-guest="'+id+'" aria-label="选择'+esc(profile(id).name)+'的来宾卡">'+residentPortraitMarkup(id,style,profile(id).name,'home-guest-portrait')+'<b>'+esc(profile(id).name)+'</b></button>').join('')+'</div><ol class="home-seat-rules">'+g.rules.map((r,i)=>'<li data-seat-rule="'+i+'">'+esc(ruleText(r,profile))+'</li>').join('')+'</ol><p class="home-soft">这是桌上预排，尚未向居民发出实际邀请。</p><div class="home-game-tools"><button class="secondary" data-home-reset>重新安排</button></div>';
    g.selected??=g.guests[0];
    controls.querySelectorAll('[data-home-guest]').forEach(el=>el.onclick=()=>{g.selected=Number(el.dataset.homeGuest);refresh();});
    board.querySelectorAll('[data-home-seat]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;const next=seatGuest(g,g.values,g.selected,Number(el.dataset.homeSeat));if(next){g.values=next;refresh();}});
    return true;
  }
  if(g.kind==='starchart'){
    board.classList.add('home-star-chart');
    board.innerHTML='<svg class="home-sky-lines" viewBox="0 0 300 300" aria-hidden="true"><circle cx="150" cy="150" r="122"/><circle cx="150" cy="150" r="88"/><path d="M150 18V282M18 150H282M57 57L243 243M57 243L243 57"/>'+'<polyline class="home-star-trail" points=""/></svg>'+SKY_DIRECTIONS.map((label,i)=>{const a=(i*45-90)*Math.PI/180;return '<span class="home-sky-bearing" style="left:'+(50+Math.cos(a)*46)+'%;top:'+(50+Math.sin(a)*46)+'%">'+label+'</span>';}).join('')+g.stars.map(star=>'<button data-home-star="'+star.id+'" aria-label="星点：'+skyDescription(star)+'" title="'+skyDescription(star)+'" class="home-star '+(star.bright?'bright':'soft')+'" style="left:'+star.x/3+'%;top:'+star.y/3+'%;--star-color:'+SKY_COLORS[star.color].color+'"><span>✦</span><small></small></button>').join('');
    controls.innerHTML='<ol class="home-observation-log">'+g.targets.map((star,i)=>'<li data-star-log="'+i+'"><time>'+star.time+'</time><span>'+skyDescription(star)+'</span></li>').join('')+'</ol><div class="home-game-tools"><button class="secondary" data-home-star-undo>撤回一笔</button><button class="secondary" data-home-reset>重新连星</button></div><p class="home-soft">按记录的时刻连接星点。外圈明亮，内圈柔和；这是岛上的虚构星图。</p>';
    board.querySelectorAll('[data-home-star]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting||g.values.length===6)return;const id=Number(el.dataset.homeStar);if(g.targets[g.values.length].starId===id){g.values.push(id);refresh();}else{g.misses=(g.misses||0)+1;board.querySelectorAll('.missed').forEach(n=>n.classList.remove('missed'));el.classList.add('missed');feedback('这一颗的方位、颜色或亮度不符合当前记录，再核对一次。');}});
    controls.querySelector('[data-home-star-undo]').onclick=()=>{if(g.saved||g.submitting)return;g.values.pop();refresh();};
    return true;
  }
  return false;
}

export function refreshSocialGame({g,body,profile,done,feedback,keepMessage}){
  if(g.kind==='gathering'){
    body.querySelectorAll('[data-home-seat]').forEach(el=>{const id=g.values[Number(el.dataset.homeSeat)];el.disabled=g.saved||g.submitting;el.querySelector('.home-seat-guest').textContent=id==null?'空席':profile(id).name;el.classList.toggle('occupied',id!=null);el.classList.toggle('selected',id===g.selected);});
    body.querySelectorAll('[data-home-guest]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.homeGuest)===g.selected)));
    body.querySelectorAll('[data-seat-rule]').forEach(el=>{const valid=gatheringRule(g.rules[Number(el.dataset.seatRule)],g.values);el.classList.toggle('satisfied',valid===true);el.classList.toggle('unsatisfied',valid===false);});
    if(!keepMessage)feedback(g.saved?'今天的小聚预排已记下。':done?'每个人都被妥善安排了。':'先选来宾卡，再点座位。已经落座的人可以互换。');return true;
  }
  if(g.kind==='starchart'){
    body.querySelectorAll('[data-home-star]').forEach(el=>{const i=g.values.indexOf(Number(el.dataset.homeStar));el.disabled=g.saved||g.submitting||i>=0||done;el.classList.toggle('charted',i>=0);el.classList.remove('missed');el.querySelector('small').textContent=i<0?'':i+1;});
    body.querySelector('.home-star-trail').setAttribute('points',g.values.map(id=>g.stars[id].x+','+g.stars[id].y).join(' '));
    body.querySelectorAll('[data-star-log]').forEach(el=>{const i=Number(el.dataset.starLog);el.classList.toggle('charted',i<g.values.length);el.classList.toggle('current',i===g.values.length);});
    if(!keepMessage)feedback(g.saved?'今天的星迹手记已保存。':done?'六次观测连成了一条完整星迹。':'正在核对第 '+(g.values.length+1)+' 条记录 · 已连 '+g.values.length+'/6 颗');return true;
  }
  return false;
}
