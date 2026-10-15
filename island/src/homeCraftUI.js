import {BOTANICALS,botanicalRules,placeBotanical,traceRope} from './homeCraftActivities.js';
import {esc} from './journeyUI.js';

export function mountCraftGame({g,board,controls,itemArt,refresh,feedback}){
  if(g.kind==='botanical'){
    board.classList.add('home-botanical');
    const spots=[[50,50],[50,17],[78,33],[78,67],[50,83],[22,67],[22,33]];
    board.innerHTML='<span class="home-pressed-caption">'+esc(g.title)+'</span>'+spots.map(([x,y],i)=>'<button data-home-specimen-slot="'+i+'" style="left:'+x+'%;top:'+y+'%"><small>'+(i===0?'主花':i)+'</small><span class="home-specimen-art"></span></button>').join('');
    controls.innerHTML='<div class="home-specimen-palette">'+g.palette.map(id=>'<button data-home-specimen="'+id+'" aria-label="选择'+esc(BOTANICALS[id].name)+'标本">'+itemArt(id)+'<b>'+esc(BOTANICALS[id].name)+'</b></button>').join('')+'</div><ol class="home-botanical-rules"><li>中心留下'+esc(BOTANICALS[g.main].name)+'。</li><li>外圈三枚花穗、三枚叶片。</li><li>花与叶沿环交替，不相邻同类。</li><li>外圈花穗用'+(g.tone==='cool'?'冷':'暖')+'色，六枚各不相同。</li></ol><div class="home-game-tools"><button class="secondary" data-home-reset>重新拼贴</button></div>';
    controls.querySelectorAll('[data-home-specimen]').forEach(el=>el.onclick=()=>{g.selected=el.dataset.homeSpecimen;refresh();});
    board.querySelectorAll('[data-home-specimen-slot]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;const next=placeBotanical(g,g.values,g.selected,Number(el.dataset.homeSpecimenSlot));if(next){g.values=next;refresh();}});
    return true;
  }
  if(g.kind==='rigging'){
    board.classList.add('home-rigging');g.spins??=[...g.values];
    board.innerHTML=g.pipes.map((type,i)=>'<button data-home-rope="'+i+'" class="'+(g.fixed.includes(i)?'fixed':'')+'" aria-label="第'+(Math.floor(i/4)+1)+'行第'+(i%4+1)+'列绳路'+(g.fixed.includes(i)?'，固定接头':'，顺时针旋转')+'"><svg viewBox="0 0 60 60" aria-hidden="true"><g class="home-rope-turn"><path class="rope-shadow" d="'+(type==='straight'?'M30 0V60':'M30 0V18Q30 30 42 30H60')+'"/><path class="rope-core" d="'+(type==='straight'?'M30 0V60':'M30 0V18Q30 30 42 30H60')+'"/><path class="rope-twist" d="'+(type==='straight'?'M30 0V60':'M30 0V18Q30 30 42 30H60')+'"/></g></svg>'+(i===g.start?'<span class="rope-terminal rope-start">起</span>':i===g.end?'<span class="rope-terminal rope-end">终</span>':'')+'</button>').join('');
    controls.innerHTML='<div class="home-rope-legend"><span>起点 · 左岸</span><span>终点 · 右岸</span></div><p class="home-rope-progress" role="status"></p><p class="home-soft">点击木片顺时针旋转。让绳路逐格衔接到终点；两端接头固定，深色绳路表示已经连通。</p><div class="home-game-tools"><button class="secondary" data-home-rope-check>查看断点</button><button class="secondary" data-home-reset>重新布绳</button></div>';
    board.querySelectorAll('[data-home-rope]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.homeRope);if(g.fixed.includes(i)||g.saved||g.submitting)return;g.values[i]=(g.values[i]+1)%4;g.spins[i]++;g.showBreak=false;refresh();});
    controls.querySelector('[data-home-rope-check]').onclick=()=>{g.showBreak=true;refresh();const r=traceRope(g,g.values);if(!r.solved)feedback('绳路在标记处断开，检查相邻两块是否朝向彼此。');};
    return true;
  }
  return false;
}

export function refreshCraftGame({g,body,done,itemArt,feedback,keepMessage}){
  if(g.kind==='botanical'){
    body.querySelectorAll('[data-home-specimen-slot]').forEach(el=>{const i=Number(el.dataset.homeSpecimenSlot),id=g.values[i];el.disabled=g.saved||g.submitting;el.setAttribute('aria-label',(i===0?'中心':'外圈第'+i+'位')+'：'+(id?BOTANICALS[id].name:'空白'));el.classList.toggle('filled',!!id);if(el.dataset.value!==String(id)){el.querySelector('.home-specimen-art').innerHTML=id?itemArt(id):'';el.dataset.value=String(id);}});
    body.querySelectorAll('[data-home-specimen]').forEach(el=>{el.setAttribute('aria-pressed',String(el.dataset.homeSpecimen===g.selected));el.classList.toggle('placed',g.values.includes(el.dataset.homeSpecimen));});
    const rules=botanicalRules(g,g.values);body.querySelectorAll('.home-botanical-rules li').forEach((el,i)=>{el.classList.toggle('satisfied',rules[i]===true);el.classList.toggle('unsatisfied',rules[i]===false);});
    if(!keepMessage)feedback(g.saved?'今天的压花拼贴已收进标本册。':done?'花穗与叶片交错，今天的颜色有了自己的秩序。':'先选标本，再放进册页。已经放好的标本会互换位置。');return true;
  }
  if(g.kind==='rigging'){
    const r=traceRope(g,g.values);
    body.querySelectorAll('[data-home-rope]').forEach(el=>{const i=Number(el.dataset.homeRope);el.disabled=g.fixed.includes(i)||g.saved||g.submitting;el.classList.toggle('connected',r.path.includes(i));el.classList.toggle('rope-break',!!g.showBreak&&!done&&r.blocked===i);el.querySelector('.home-rope-turn').style.transform='rotate('+g.spins[i]*90+'deg)';});
    body.querySelector('.home-rope-progress').textContent=done?'左右两岸已经连通':'已衔接 '+r.path.length+' 块 · 接头必须互相对准';
    if(!keepMessage)feedback(g.saved?'今天的船模绳路已记下。':done?'从起点到终点，绳路完整相接。':'从左侧起点开始，逐步旋转下一块木片。');return true;
  }
  return false;
}
