import {BAKING_STATIONS,bakingIssues,clampPhotoFrame,photoFrameValid} from './homeEverydayActivities.js';
import {esc} from './journeyUI.js';
export function photoCropMarkup(frame,url){return '<div class="home-photo-crop"><img draggable="false" alt="取景练习的照片" src="'+url+'" style="width:'+1000/frame.w*100+'%;height:'+660/(frame.w*.75)*100+'%;left:'+(-frame.x/frame.w*100)+'%;top:'+(-frame.y/(frame.w*.75)*100)+'%"></div>';}
export function resetEverydayGame(g){if(!['baking','photography'].includes(g.kind))return;g.preview=false;g.shot=0;g.frame=clampPhotoFrame({x:180,y:0,w:650});}
export function mountEverydayGame({g,board,controls,refresh,feedback,itemArt,url}){
 if(g.kind==='baking'){
  board.classList.add('home-baking');
  board.innerHTML='<div class="home-baking-scroll"><div class="home-baking-timeline" style="--slots:'+g.slots+'"><div class="home-baking-hours"><b>时段</b>'+Array.from({length:g.slots},(_,i)=>'<span>'+i+'</span>').join('')+'</div>'+BAKING_STATIONS.map((name,row)=>'<div class="home-baking-lane"><b>'+name+'</b><div class="home-baking-grid">'+Array.from({length:g.slots},(_,i)=>'<button data-home-bake-slot="'+row+','+i+'" aria-label="'+name+'从第'+i+'时段开始"></button>').join('')+'</div></div>').join('')+'<div class="home-baking-placements"></div><i class="home-baking-playhead"></i></div></div>';
  controls.innerHTML='<p class="home-baking-deadline">两份早餐，须在第 '+g.deadline+' 时段前完成。</p><div class="home-baking-tickets">'+g.tasks.map(t=>'<button data-home-bake-task="'+t.id+'">'+itemArt(g.orders[t.order].item)+'<span><b>'+esc(g.orders[t.order].name)+' · '+t.name+'</b><small>'+t.duration+' 时段'+(t.previous===null?' · 第一步':' · 接在'+g.tasks[t.previous].name+'后')+'</small></span></button>').join('')+'</div><p class="home-soft">先选步骤，再点对应工位的开始时段。各份早餐须依次完成揉面 → 醒发 → 烘烤 → 冷却；同一工位不能同时做两份。</p><div class="home-game-tools"><button class="secondary" data-home-bake-play>演练时间表</button><button class="secondary" data-home-bake-clear>撤下选中步骤</button><button class="secondary" data-home-reset>重新安排</button></div>';
  controls.querySelectorAll('[data-home-bake-task]').forEach(el=>el.onclick=()=>{g.selected=Number(el.dataset.homeBakeTask);refresh();});
  board.querySelectorAll('[data-home-bake-slot]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;const [row,at]=el.dataset.homeBakeSlot.split(',').map(Number),task=g.tasks[g.selected];if(row!==task.station){feedback('这一步需要放在'+BAKING_STATIONS[task.station]+'。');return;}g.values[task.id]=at;g.preview=false;refresh();});
  controls.querySelector('[data-home-bake-clear]').onclick=()=>{if(g.saved||g.submitting)return;g.values[g.selected]=null;g.preview=false;refresh();};
  controls.querySelector('[data-home-bake-play]').onclick=()=>{g.preview=!g.preview;refresh();};return true;
 }
 if(g.kind==='photography'){
  board.classList.add('home-photography');g.shot??=0;g.frame??=clampPhotoFrame({x:180,y:0,w:650});
  board.innerHTML='<div class="home-viewfinder" tabindex="0" aria-label="拖动画面取景，也可使用下方方向和镜头按钮"><div class="home-viewfinder-image"></div><div class="home-photo-thirds"></div><i class="home-photo-focus"></i><div class="home-photo-flash"></div></div><p class="home-photo-brief"></p>';
  controls.innerHTML='<p class="home-photo-tip"></p><div class="home-camera-buttons"><button data-home-pan="-1,0" aria-label="取景框向左">←</button><button data-home-pan="0,-1" aria-label="取景框向上">↑</button><button data-home-pan="0,1" aria-label="取景框向下">↓</button><button data-home-pan="1,0" aria-label="取景框向右">→</button><button data-home-lens="-20">拉近 +</button><button data-home-lens="20">拉远 −</button></div><button class="primary home-shutter" data-home-shutter>按下快门</button><div class="home-photo-contact"></div><p class="home-soft">这是以南风家为素材的构图练习。拖动取景，调整镜头，让标记主体完整落在指定构图点。</p><div class="home-game-tools"><button class="secondary" data-home-reset>重新拍摄</button></div>';
  const adjust=(dx,dy,dw=0)=>{if(g.saved||g.submitting)return;g.frame=clampPhotoFrame({x:g.frame.x+dx-dw/2,y:g.frame.y+dy-dw*.375,w:g.frame.w+dw});refresh();};
  controls.querySelectorAll('[data-home-pan]').forEach(el=>el.onclick=()=>{const [x,y]=el.dataset.homePan.split(',').map(Number);adjust(x*10,y*10);});
  controls.querySelectorAll('[data-home-lens]').forEach(el=>el.onclick=()=>adjust(0,0,Number(el.dataset.homeLens)));
  const finder=board.querySelector('.home-viewfinder');let drag=null;
  finder.onpointerdown=e=>{if(g.saved||g.submitting)return;drag={x:e.clientX,y:e.clientY,frame:{...g.frame},width:finder.clientWidth};finder.setPointerCapture(e.pointerId);e.preventDefault();};
  finder.onpointermove=e=>{if(!drag)return;g.frame=clampPhotoFrame({x:drag.frame.x-(e.clientX-drag.x)*drag.frame.w/drag.width,y:drag.frame.y-(e.clientY-drag.y)*drag.frame.w/drag.width,w:drag.frame.w});refresh();};
  finder.onpointerup=finder.onpointercancel=()=>drag=null;
  finder.onkeydown=e=>{const dir={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]}[e.key];if(dir){e.preventDefault();adjust(...dir);}};
  controls.querySelector('[data-home-shutter]').onclick=()=>{if(g.saved||g.submitting)return;const shot=g.shots[g.shot];if(!photoFrameValid(shot,g.frame)){feedback('再调整一下镜头范围和构图位置：'+shot.tip);return;}g.values[g.shot]={...g.frame};finder.querySelector('.home-photo-flash').animate([{opacity:.85},{opacity:0}],{duration:260});const next=g.values.indexOf(null);if(next>=0){g.shot=next;g.frame=clampPhotoFrame({x:180,y:0,w:650});}refresh();};
  controls.querySelector('.home-photo-contact').onclick=e=>{const el=e.target.closest('[data-home-photo]');if(!el||g.saved||g.submitting)return;g.shot=Number(el.dataset.homePhoto);g.frame=g.values[g.shot]?{...g.values[g.shot]}:clampPhotoFrame({x:180,y:0,w:650});refresh();};
  return true;
 }
 return false;
}
export function refreshEverydayGame({g,body,done,feedback,keepMessage,url}){
 if(g.kind==='baking'){
  const issues=bakingIssues(g,g.values),selected=g.tasks[g.selected];
  body.querySelectorAll('[data-home-bake-task]').forEach(el=>{const id=Number(el.dataset.homeBakeTask);el.setAttribute('aria-pressed',String(id===g.selected));el.classList.toggle('placed',g.values[id]!==null);});
  body.querySelectorAll('[data-home-bake-slot]').forEach(el=>{const [row,at]=el.dataset.homeBakeSlot.split(',').map(Number);el.disabled=g.saved||g.submitting;el.classList.toggle('available-lane',row===selected.station);el.classList.toggle('invalid-slot',row===selected.station&&at+selected.duration>g.deadline);});
  body.querySelector('.home-baking-placements').innerHTML=g.tasks.filter(t=>Number.isInteger(g.values[t.id])).map(t=>'<div class="home-baking-block order-'+t.order+(issues.some(x=>x.endsWith(':'+t.id))?' invalid':'')+'" style="--at:'+g.values[t.id]+';--duration:'+t.duration+';--lane:'+t.station+';--delay:'+g.values[t.id]*.5+'s;--length:'+t.duration*.5+'s"><span>'+t.name+'</span></div>').join('');
  const timeline=body.querySelector('.home-baking-timeline');timeline.classList.toggle('preview',!!g.preview);timeline.style.setProperty('--preview-time',g.slots*.5+'s');
  if(!keepMessage)feedback(g.saved?'今天的出炉计划已留在手账。':done?'工位没有冲突，两份早餐都能按时完成。':issues.length?'标红步骤有先后、占位或截止时间冲突，请调整。':'把八个步骤放进时间表，让等待和烘烤互相穿插。');return true;
 }
 if(g.kind==='photography'){
  const shot=g.shots[g.shot],valid=photoFrameValid(shot,g.frame),finder=body.querySelector('.home-viewfinder');
  const image=body.querySelector('.home-viewfinder-image'),key=JSON.stringify(g.frame);if(image.dataset.frame!==key){if(!image.firstElementChild)image.innerHTML=photoCropMarkup(g.frame,url);Object.assign(image.querySelector('img').style,{width:1000/g.frame.w*100+'%',height:660/(g.frame.w*.75)*100+'%',left:-g.frame.x/g.frame.w*100+'%',top:-g.frame.y/(g.frame.w*.75)*100+'%'});image.dataset.frame=key;}
  const focus=finder.querySelector('.home-photo-focus');focus.style.left=shot.gx*100+'%';focus.style.top=shot.gy*100+'%';focus.classList.toggle('ready',valid);finder.classList.toggle('framed',valid);
  body.querySelector('.home-photo-brief').textContent=(g.shot+1)+' / 4 · '+shot.name;
  body.querySelector('.home-photo-tip').textContent=shot.tip+' 镜头范围 '+g.frame.w+'，目标 '+shot.width.join('–')+'。';
  body.querySelector('[data-home-shutter]').disabled=g.saved||g.submitting;body.querySelector('[data-home-shutter]').textContent=valid?'构图合适 · 按下快门':'按下快门';
  const contact=body.querySelector('.home-photo-contact'),contactKey=JSON.stringify([g.values,g.shot]);if(contact.dataset.key!==contactKey){contact.innerHTML=g.shots.map((s,i)=>'<button data-home-photo="'+i+'" aria-pressed="'+(g.shot===i)+'" aria-label="查看第'+(i+1)+'帧'+esc(s.name)+'">'+(g.values[i]?photoCropMarkup(g.values[i],url):'<span>'+String(i+1).padStart(2,'0')+'</span>')+'</button>').join('');contact.dataset.key=contactKey;}
  if(!keepMessage)feedback(g.saved?'四帧光影已经收进相册。':done?'从采光、准备、显影到展示，一组观察完成了。':valid?'主体完整，构图点已经对齐，可以拍下这一帧。':'拖动画面移动取景框，调整镜头；构图合适时标记会变绿。');return true;
 }
 return false;
}
