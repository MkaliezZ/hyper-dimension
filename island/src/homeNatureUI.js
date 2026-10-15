import {PACK_ITEMS,packCells,packAnchor,packingOccupancy,placePacking,suitableDeparture,leafLineStatus} from './homeNatureActivities.js';
import {esc} from './journeyUI.js';
export function resetNatureGame(g){if(g.kind==='voyage')g.rotations=[...g.initialRotations];if(g.kind==='leafprint'){g.history=[];g.mark=1;}}
const shapeMarkup=(piece,r)=>{const cells=packCells(piece,r),w=Math.max(...cells.map(p=>p[0]))+1,h=Math.max(...cells.map(p=>p[1]))+1;return '<span class="home-pack-shape" style="--w:'+w+';--h:'+h+'">'+cells.map(([x,y])=>'<i class="'+(x===packAnchor(piece,r)[0]&&y===packAnchor(piece,r)[1]?'pack-anchor':'')+'" style="grid-column:'+(x+1)+';grid-row:'+(y+1)+'"></i>').join('')+'</span>';};
export function mountNatureGame({g,board,controls,refresh,feedback,itemArt}){
 if(g.kind==='voyage'){
  g.initialRotations??=[...g.rotations];board.classList.add('home-voyage');
  board.innerHTML='<div class="home-pack-case" aria-label="六列四行行囊收纳格">'+Array.from({length:24},(_,i)=>'<button data-home-pack="'+i+'" aria-label="第'+(Math.floor(i/6)+1)+'行第'+(i%6+1)+'列"></button>').join('')+'</div><div class="home-pack-caption">对齐轮廓亮点放入 · 拼片代表用品包装</div>';
  controls.innerHTML='<div class="home-pack-palette">'+PACK_ITEMS.map((p,i)=>'<button data-home-gear="'+i+'">'+itemArt(p.id)+'<span><b>'+p.name+'</b><span data-home-shape="'+i+'"></span></span></button>').join('')+'</div><div class="home-game-tools"><button class="secondary" data-home-rotate>旋转选中用品 · R</button><button class="secondary" data-home-unpack>移出选中用品</button></div><p class="home-tide-rule">练习出发条件：涨潮 · 风力 ≤ 3 格 · 无风雨</p><div class="home-tide-options">'+g.forecast.map((f,i)=>'<button data-home-depart="'+i+'"><b>'+String(f.hour).padStart(2,'0')+':00</b><span>'+f.tide+' · '+f.weather+'</span><span>风力 '+f.wind+' 格</span></button>').join('')+'</div><button class="secondary" data-home-reset>重新收纳</button>';
  const clearGhost=()=>board.querySelectorAll('.pack-ghost,.pack-blocked').forEach(el=>el.classList.remove('pack-ghost','pack-blocked'));
  const preview=i=>{clearGhost();if(g.saved||g.submitting)return;const r=g.rotations[g.selected],[ax,ay]=packAnchor(PACK_ITEMS[g.selected],r),valid=placePacking(g,g.values,g.selected,i%6-ax,Math.floor(i/6)-ay,r);for(const[dx,dy]of packCells(PACK_ITEMS[g.selected],r)){const x=i%6+dx-ax,y=Math.floor(i/6)+dy-ay;if(x>=0&&y>=0&&x<6&&y<4)board.querySelector('[data-home-pack="'+(y*6+x)+'"]').classList.add(valid?'pack-ghost':'pack-blocked');}};
  controls.querySelectorAll('[data-home-gear]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;g.selected=Number(el.dataset.homeGear);clearGhost();refresh();});
  controls.querySelector('[data-home-rotate]').onclick=()=>{if(g.saved||g.submitting)return;g.rotations[g.selected]=(g.rotations[g.selected]+1)%4;clearGhost();refresh();};
  controls.querySelector('[data-home-unpack]').onclick=()=>{if(g.saved||g.submitting)return;g.values[g.selected+1]=null;clearGhost();refresh();};
  controls.querySelectorAll('[data-home-depart]').forEach(el=>el.onclick=()=>{if(g.saved||g.submitting)return;g.values[0]=Number(el.dataset.homeDepart);refresh();});
  board.querySelectorAll('[data-home-pack]').forEach(el=>{const i=Number(el.dataset.homePack);el.onpointerenter=()=>preview(i);el.onfocus=()=>preview(i);el.onclick=()=>{if(g.saved||g.submitting)return;const r=g.rotations[g.selected],[ax,ay]=packAnchor(PACK_ITEMS[g.selected],r),next=placePacking(g,g.values,g.selected,i%6-ax,Math.floor(i/6)-ay,r);if(!next){feedback('放不下：避开固定隔格和其他用品，也可以先旋转或移出。');preview(i);return;}g.values=next;clearGhost();refresh();};});
  board.onpointerleave=clearGhost;board.onkeydown=e=>{if(e.key.toLowerCase()==='r'){e.preventDefault();controls.querySelector('[data-home-rotate]').click();}};return true;
 }
 if(g.kind==='leafprint'){
  g.mark??=1;g.history??=[];board.classList.add('home-leafprint');
  board.innerHTML='<div class="home-leaf-grid"><div class="leaf-corner">叶影<br>观察册</div>'+g.columns.map((clue,x)=>'<div class="home-leaf-clue leaf-column" data-leaf-column="'+x+'">'+clue.map(n=>'<span>'+n+'</span>').join('')+'</div>').join('')+g.rows.map((clue,y)=>'<div class="home-leaf-clue leaf-row" data-leaf-row="'+y+'">'+clue.join(' · ')+'</div>'+Array.from({length:6},(_,x)=>'<button data-home-leaf="'+(y*6+x)+'" aria-label="第'+(y+1)+'行第'+(x+1)+'列，未记录"></button>').join('')).join('')+'</div>';
  controls.innerHTML='<p class="home-soft">数字表示连续叶片格的长度；多组之间至少空一格。填出叶影，也给空白画上叉。</p><div class="home-leaf-tools"><button data-home-mark="1" aria-pressed="true">涂叶片</button><button data-home-mark="2" aria-pressed="false">标空白 ×</button><button data-home-mark="0" aria-pressed="false">擦除</button></div><div class="home-leaf-specimen">'+itemArt(g.specimen)+'<span>先观察，再留下记录。<br>填格是叶片剪影练习。</span></div><div class="home-game-tools"><button class="secondary" data-home-leaf-undo>撤回一笔</button><button class="secondary" data-home-reset>重画这一页</button></div>';
  controls.querySelectorAll('[data-home-mark]').forEach(el=>el.onclick=()=>{g.mark=Number(el.dataset.homeMark);refresh();});
  let stroke=null;
  const paint=(i,value)=>{if(g.values[i]===value)return;g.values[i]=value;refresh();};
  board.querySelectorAll('[data-home-leaf]').forEach(el=>{const i=Number(el.dataset.homeLeaf);el.onpointerdown=e=>{if(g.saved||g.submitting||e.button!==0)return;g.history.push([...g.values]);if(g.history.length>200)g.history.shift();stroke=g.mark;paint(i,stroke);el.setPointerCapture(e.pointerId);e.preventDefault();};el.onpointermove=e=>{if(stroke===null)return;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-home-leaf]');if(target&&board.contains(target))paint(Number(target.dataset.homeLeaf),stroke);};el.onpointerup=el.onpointercancel=el.onlostpointercapture=()=>stroke=null;el.onclick=e=>{if(e.detail!==0||g.saved||g.submitting)return;g.history.push([...g.values]);if(g.history.length>200)g.history.shift();paint(i,g.mark);};});
  controls.querySelector('[data-home-leaf-undo]').onclick=()=>{if(g.saved||g.submitting||!g.history.length)return;g.values=g.history.pop();refresh();};return true;
 }
 return false;
}
export function refreshNatureGame({g,body,done,keepMessage,feedback,itemArt}){
 if(g.kind==='voyage'){
  const occupancy=packingOccupancy(g,g.values.slice(1));
  body.querySelectorAll('[data-home-pack]').forEach(el=>{const i=Number(el.dataset.homePack),owner=occupancy[i],piece=owner>=0&&owner!==null?PACK_ITEMS[owner]:null,anchor=piece&&occupancy.indexOf(owner)===i;el.classList.toggle('fixed',owner===-1);el.classList.toggle('packed',!!piece);el.classList.toggle('selected-piece',owner===g.selected);el.style.setProperty('--piece-color',piece?.color||'transparent');el.innerHTML=owner===-1?'<span aria-hidden="true">▨</span>':anchor?itemArt(piece.id):piece?'<span class="pack-stitch"></span>':'';el.disabled=g.saved||g.submitting||owner===-1;el.setAttribute('aria-label','第'+(Math.floor(i/6)+1)+'行第'+(i%6+1)+'列，'+(piece?piece.name:owner===-1?'固定隔格':'空位'));});
  body.querySelectorAll('[data-home-gear]').forEach(el=>{const i=Number(el.dataset.homeGear);el.setAttribute('aria-pressed',String(i===g.selected));el.classList.toggle('packed',g.values[i+1]!==null);el.querySelector('[data-home-shape]').innerHTML=shapeMarkup(PACK_ITEMS[i],g.rotations[i]);});
  body.querySelectorAll('[data-home-depart]').forEach(el=>{const i=Number(el.dataset.homeDepart);el.setAttribute('aria-pressed',String(g.values[0]===i));el.classList.toggle('unsuitable',g.values[0]===i&&!suitableDeparture(g.forecast[i]));});
  if(!keepMessage)feedback(g.saved?'这次行前演练已记在潮汐本里。':done?'六件用品各有位置，出发时段也适合练习条件。':g.values[0]!==null&&!suitableDeparture(g.forecast[g.values[0]])?'这个时段不满足练习条件，再看看潮向、风力和风雨。':'选择用品，旋转后按轮廓亮点定位放入；再核对练习出发时段。');return true;
 }
 if(g.kind==='leafprint'){
  const status=leafLineStatus(g,g.values);body.querySelectorAll('[data-home-leaf]').forEach(el=>{const i=Number(el.dataset.homeLeaf),value=g.values[i];el.classList.toggle('leaf-filled',value===1);el.classList.toggle('leaf-empty',value===2);el.textContent=value===2?'×':'';el.disabled=g.saved||g.submitting;el.setAttribute('aria-label','第'+(Math.floor(i/6)+1)+'行第'+(i%6+1)+'列，'+['未记录','叶片','空白'][value]);});
  for(const[type,values]of [['row',status.rows],['column',status.columns]])body.querySelectorAll('[data-leaf-'+type+']').forEach((el,i)=>el.classList.toggle('satisfied',values[i]));
  body.querySelectorAll('[data-home-mark]').forEach(el=>el.setAttribute('aria-pressed',String(Number(el.dataset.homeMark)===g.mark)));body.querySelector('[data-home-leaf-undo]').disabled=!g.history.length||g.saved||g.submitting;
  if(!keepMessage)feedback(g.saved?'这一页叶影已收进洛白的观察册。':done?'行列线索都吻合，一片完整的叶影出现了。':'数字是一段连续叶片，空白用叉确认；可按住拖动连续记录。');return true;
 }
 return false;
}
