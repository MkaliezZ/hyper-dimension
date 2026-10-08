import {specializationBrief} from './specialization.js';
import {MOMENTS,journeyView,momentProgress} from './journey.js';
import {refreshAchievements} from './achievements.js';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function momentSeal(id){const path={light:'M24 10 32 19 29 34H19L16 19Z M24 3V9 M18 38H30 M21 42H27',trade:'M11 19H37V37H11Z M8 18 13 9H35L40 18 M18 37V26H29V37 M10 20H38',festival:'M24 6 29 18 42 20 32 28 35 42 24 34 13 42 16 28 6 20 19 18Z',signature:'M23 6V35H8 M25 9 39 29H25Z M20 12 9 29H20 M7 37Q24 46 41 37'}[id]||'';
 return '<svg class="moment-seal" viewBox="0 0 48 48" aria-hidden="true"><path d="'+path+'"/></svg>'}
export function createJourneyUI({state,openModal,action,celebrate,collections,specializations,cocreation}){
 function render(){
  const v=journeyView(state()),root=document.getElementById('questList');
  const achievements=refreshAchievements(state()).book;
  const growth=specializationBrief(state());
  const text=v.ready?'值得记住的一刻':v.step?'下一步 · '+(v.index+1)+' / '+v.total:growth.path?'第二章 · '+growth.name+' '+growth.rank+' / 5 阶':'第一章完成';
  const html='<div class="journey-eyebrow">'+text+'</div><strong class="journey-current">'+esc(v.ready?.title||v.step?.title||'你的岛，正在生长')+'</strong><p class="journey-detail">'+esc(v.ready?v.ready.description:(v.step?.detail||(growth.path?(growth.next.join(' · ')||'继续完成品质委托，丰富你的海岛。'):'完成第一场派对后，选择经营方向，开始第二章。')))+'</p><div class="journey-track" role="progressbar" aria-label="新手旅程" aria-valuemin="0" aria-valuemax="'+v.total+'" aria-valuenow="'+v.done+'">'+v.steps.map(x=>'<i class="'+(v.j.completed[x.id]?'complete':'')+'"></i>').join('')+'</div><button class="journey-primary" id="journeyNext">'+(v.ready?'见证这一刻':v.step?.button||'查看成长目标')+' <span>→</span></button><button class="journey-link" id="journalOpen">完整手账 · '+Object.keys(v.j.claimed).length+' 枚纪念章'+(achievements.unseen.length?' · 新成就 '+achievements.unseen.length:'')+'</button>';
  if(root.innerHTML!==html)root.innerHTML=html;
  document.getElementById('journeyNext').onclick=()=>v.ready?celebrate(v.ready.id):v.step?action(v.step.action):growth.unlocked?specializations():open();
  document.getElementById('journalOpen').onclick=open;
  const mobile=document.getElementById('mobileJournal');if(mobile){mobile.textContent=v.ready?'手账 · 有新纪念':'岛屿手账';mobile.onclick=open}
 }
 function open(){
  const v=journeyView(state());
  const steps=v.steps.map((x,i)=>'<li class="journal-step '+(v.j.completed[x.id]?'complete':v.step?.id===x.id?'current':'future')+'"><span class="step-number">'+(v.j.completed[x.id]?'✓':String(i+1).padStart(2,'0'))+'</span><div><b>'+x.title+'</b><p>'+x.detail+'</p>'+(v.step?.id===x.id?'<button class="primary" data-journey-action="'+x.action+'">'+x.button+' →</button>':'')+'</div></li>').join('');
  const cards=MOMENTS.map(m=>{const earned=v.j.claimed[m.id],ready=v.j.ready[m.id];return '<article class="moment-card '+(earned?'earned':ready?'ready':'')+'">'+momentSeal(m.id)+'<div><small>'+(earned?'第 '+earned.day+' 天 · 已铭记':ready?'条件达成 · 等你见证':'下一段期待')+'</small><h3>'+m.title+'</h3><p>'+m.condition+'</p><p class="moment-progress">'+momentProgress(state(),m.id)+'</p><b>'+m.reward+'</b>'+(ready?'<button class="primary" data-moment="'+m.id+'">见证这一刻 →</button>':'')+'</div></article>'}).join('');
  openModal('岛屿手账','从第一份手作，到一座值得专程前来的岛。','<section class="journal-opening"><small>CHAPTER 01 / 晨光初至</small><h3>把小事，变成岛上的故事。</h3><p>一条轻松的出发路线，已完成 '+v.done+' / '+v.total+' 步。你可以自由探索，亲手完成的步骤会自动记下。</p><button class="secondary journal-collection" id="journalCollections">奇观藏册与海岛成就 →</button><button class="secondary" id="journalCoCreation">共创工坊 · 150分钟课程与作品 →</button><button class="primary journal-specialization" id="journalSpecialization">第二章 · 经营专精与品质委托 →</button></section><div class="journal-layout"><section><h3>新手旅程</h3><ol class="journal-steps">'+steps+'</ol></section><section><h3>值得期待的时刻</h3><div class="moment-cards">'+cards+'</div></section></div><details class="journal-controls"><summary>操作备忘与独立小游戏</summary><p>点击道路自动寻路；拖动画面、滚轮缩放。建筑门口可以进入室内，点工作台制作。农田与矿洞需要走近后使用工具。像素与折纸共享同一小岛进度，可随时更换外观。</p><a href="/src/arcade.html" target="_blank" rel="noopener">打开岛屿游艺集 →</a></details>');
  document.querySelector('#modalRoot .modal').classList.add('journal-modal');
  document.getElementById('journalCollections').onclick=collections;
  document.getElementById('journalSpecialization').onclick=specializations;
  document.getElementById('journalCoCreation').onclick=cocreation;
  document.querySelectorAll('[data-journey-action]').forEach(b=>b.onclick=()=>action(b.dataset.journeyAction));
  document.querySelectorAll('[data-moment]').forEach(b=>b.onclick=()=>celebrate(b.dataset.moment));
 }
 return {render,open};
}

