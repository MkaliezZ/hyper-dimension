import {WORKSHOP_GAMES} from './workshopCatalog.js';
import {createWorkshopAudio} from './workshopAudio.js';
import {mountWorkshopGame} from './workshopGames.js';
import {createGamePerformance} from './gamePerformance.js';
import {itemMarkup,itemFrame,drawItem} from './artStore.js';
import {avatarPortrait,avatarThumbnail} from './avatars.js';
import {DEFAULT_RECIPES} from './contentCatalog.js';
import {gameLevelOptions,nextGameOptions,pieceOffsets,mazePath,itemName} from './gameLevels.js';
import {addGameChrome} from './gameChrome.js';
import {mountClassicGame} from './classicGames.js';
export const ACTIVITY_GAMES={
 0:{kind:'packing',title:'榫卯拼装',instructions:'旋转不同木块，严丝合缝地填满高亮轮廓。可撤回上一步或重新摆放。'},
 1:{kind:'memory',title:'闻香识茶',instructions:'先观察茶材，再翻开相同的两张。每局香气、位置与配对数量都会变化。'},
 2:{kind:'orders',title:'海岛订单厨房',instructions:'按顾客的新订单配料、处理并入锅。在各自的火候窗口内装盘。'},
 3:{kind:'match',title:'花园花材三消',instructions:'交换相邻花材，完成本局配色订单。四连、五连与交叉消除可生成特殊花材；部分订单需清除封条。'},
 4:{kind:'dress',title:'航海主题搭配',instructions:'根据本局派对主题，从衣柜中选择合适服饰放到对应位置。可拖拽，也可点选。'},
 7:{kind:'link',title:'书页连连看',instructions:'配对相同的书页，连线路径最多转两次弯，不能穿过其他图块。可从棋盘外侧绕行。'},
 9:{kind:'match',title:'集市鲜果配货',instructions:'将同类商品组成三消，完成指定出货数量与封条清理。规划四连、五连和连续消除。'},
 10:{kind:'orders',title:'香草护理小铺',instructions:'每位顾客的游戏护理包不同。按订单选择草药、处理、温煮，在适宜时间装瓶。'},
 11:{kind:'link',title:'邮袋连连看',instructions:'找出同一收件主题的信件，两次转弯内连通即可归袋。先整理边缘，为内侧信件打开通路。'},
 12:{kind:'notes',title:'海风音乐演奏',instructions:'音符落到判断线时按 A S D F 或对应音轨。谱面与节奏每局变化，至少命中七成音符。'},
 14:{kind:'maze',title:'温室引水巡护',instructions:'规划巡护路线，收齐本局种苗再到达出口。方向键或点相邻格；标准与挑战难度有步数预算。'},
 15:{kind:'trace',title:'陶器拉坯描形',instructions:'按住鼠标沿陶器轮廓连续描画。完成至少 85% 轮廓点。'},
 16:{kind:'fishing',title:'海风钓场收线',instructions:'按住鼠标 / 空格向上提竿，松开下沉。让绿色捕获框持续罩住游鱼。'},
 17:{kind:'packing',title:'烘焙摆盘',instructions:'旋转点心拼块，填满本局烤盘轮廓，不留空格。可以撤回重新规划。'},
 18:{kind:'puzzle',title:'奇观修复拼图',instructions:'对照本局原作，交换碎片修复奇观。难度越高，碎片越多。'},
 19:{kind:'decorate',title:'居民之家布置',instructions:'阅读本局居家主题，选择相配物件布置窗边、休息角等区域。'},
 20:{kind:'launch',title:'节庆烟花彩排',instructions:'瞄准星光标记，按住蓄力，松开发射。在有限烟花内点亮本局所有星光，蓄力需要达到提示值。'},
 21:{kind:'notes',title:'广场舞台节拍',instructions:'跟随落下的灯光音符，在判断线按 A S D F 或对应轨道。'},
 22:{kind:'maze',title:'林间营地探索',instructions:'沿新生成的林道收集全部补给，再走到营地出口。留意剩余步数，避免绕远。'},
 23:{kind:'boat',title:'小舟试航',instructions:'按住目标方向操纵小舟，依次通过本局浮标，再低速靠泊右下码头。水流与航线每局变化。'},
 24:{kind:'trace',title:'海岛连续笔触',instructions:'按住鼠标沿叶片轮廓描画。跟随完整曲线，完成至少 85% 笔触。'}
};
for(const [id,g] of Object.entries(WORKSHOP_GAMES))ACTIVITY_GAMES[id]={...g,instructions:g.tips.join('。')};
export {matchedCells} from './gameBoards.js';

export function mountActivityGame(root,id,onFinish,options={}){
 if(WORKSHOP_GAMES[id])return mountWorkshopGame(root,id,onFinish,options);
 options=gameLevelOptions(id,options);const level=options.level;
 const g=ACTIVITY_GAMES[id];if(['link','match'].includes(g.kind))return mountClassicGame(root,id,onFinish,options,g);
 const theme=options.theme||document.body.dataset.theme||'pixel',recipe=options.recipe||DEFAULT_RECIPES[id],materials=Object.keys(recipe.cost),art=k=>itemMarkup(k,theme);
 let done=false,alive=true,frame=0,last=performance.now(),t=0,selected=null,score=0,errors=0,holding=false,replacement=null,detail={},started=g.kind!=='notes',userPaused=false,windowActive=true;
 const timers=[],listeners=[],timeouts=[];const audio=createWorkshopAudio();
 root.innerHTML='<section class="room-game" data-game-id="'+id+'" data-kind="'+g.kind+'"><div class="game-brief">'+art(recipe.item)+'<div><b>'+g.title+'</b><p>'+g.instructions+'</p></div></div><div class="activity-status" role="status"></div><div class="activity-board"></div><div class="activity-controls"></div></section>';
 const board=root.querySelector('.activity-board'),controls=root.querySelector('.activity-controls'),status=root.querySelector('.activity-status');
 function text(s){status.textContent=s}function button(label,fn,cls=''){const b=document.createElement('button');b.className=cls||'secondary';b.innerHTML=label;b.onclick=()=>{if(alive&&!done)fn()};return b}
 function listen(el,type,fn){const handler=e=>{if(!alive||done||!root.isConnected)return;if(['keydown','keyup'].includes(type)&&(document.hidden||userPaused||!windowActive||!started||e.target?.closest?.('input,textarea,select,[contenteditable=true]')))return;fn(e)};el.addEventListener(type,handler);listeners.push(()=>el.removeEventListener(type,handler))}
 function later(fn,ms){timeouts.push({fn,at:t+ms/1000})}
 function result(pass,quality=90){if(done)return;quality=Math.max(55,Math.min(100,Math.round(quality)));done=true;holding=false;options.onOutcome?.({passed:pass,quality});text(pass?'操作完成 · 品质 '+quality:'这次未完成，材料未消耗');controls.innerHTML='';const b=button(pass?'领取制作成果':'重新尝试',()=>{});b.className='primary activity-finish';b.disabled=true;performanceStage.present(pass,()=>{if(alive)b.disabled=false});b.onclick=()=>{if(!alive||b.disabled)return;if(pass){destroy();onFinish({passed:true,score:1,total:1,quality})}else{destroy();replacement=mountActivityGame(root,id,onFinish,nextGameOptions(options))}};controls.append(b)}
 function mistake(msg){errors++;text(msg+' · 失误 '+errors+'/'+level.mistakeLimit);if(errors>=level.mistakeLimit)result(false)}
 function grid(cols,rows,cls){board.innerHTML='<div class="activity-grid '+cls+'"></div>';const el=board.firstElementChild;el.style.setProperty('--columns',cols);el.style.setProperty('--rows',rows);return Array.from({length:cols*rows},(_,i)=>{const b=button('',()=>{},'activity-cell');b.dataset.cell=i;el.append(b);return b})}
 function dragItems(ids){for(const k of ids){const b=button(art(k)+'<span>'+itemName(k)+'</span>',()=>{selected=k;controls.querySelectorAll('.activity-item').forEach(x=>x.classList.toggle('selected',x.dataset.item===k))},'activity-item');b.dataset.item=k;b.draggable=true;b.ondragstart=e=>{selected=k;e.dataTransfer.setData('text/plain',k)};controls.append(b)}}
 function drop(b,fn){b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();selected=e.dataTransfer.getData('text/plain')||selected;fn()};b.onclick=fn}
 function note(i){audio.unlock();audio.event({kind:'note',lane:i})}
 let animate=()=>{};const effects=(kind,x,y,item)=>performanceStage.emit(kind,x,y,item);
 if(g.kind==='packing'){
  const cells=grid(6,4,'assembly-grid'),pieces=level.pieces,target=new Set(level.target),occupied=new Set(),placed=new Set(),moves=[];
  let shape=0,rotation=0;const sprites=id===0?['wood','bamboo','hardwood','c0_1','stone']:['bread','c17_1','c17_2','c17_3','c17_4'];
  const offsets=()=>pieceOffsets(pieces[shape],rotation);
  function paint(){
   cells.forEach((c,i)=>{c.className='activity-cell'+(target.has(i)?' target-cell':' blocked')+(occupied.has(i)?' occupied':'');c.innerHTML=occupied.has(i)?art(sprites[moves.find(m=>m.cells.includes(i)).piece]):'';c.disabled=!target.has(i)});
   controls.querySelectorAll('[data-piece]').forEach(b=>{b.classList.toggle('selected',+b.dataset.piece===shape);b.disabled=placed.has(+b.dataset.piece)});
   text('轮廓 '+occupied.size+'/'+target.size+' 格 · 零件 '+placed.size+'/'+pieces.length+' · 当前 '+(shape+1)+' 号 · '+rotation*90+'°');
   detail={shape,rotation,occupied:[...occupied],placed:[...placed],target:[...target],pieces,solution:level.solution};
  }
  pieces.forEach((p,i)=>{
   const b=button(art(sprites[i])+'<span>'+(i+1)+' 号 · '+p.length+' 格</span><span class="piece-preview">'+Array.from({length:16},(_,k)=>'<i class="'+(p.some(([x,y])=>x===k%4&&y===Math.floor(k/4))?'solid':'')+'"></i>').join('')+'</span>',()=>{shape=i;rotation=0;paint()},'activity-item');
   b.dataset.piece=i;controls.append(b);
  });
  function rotate(){rotation=(rotation+1)%4;paint()}
  controls.append(button('旋转 90°',rotate),button('撤回上一步',()=>{const move=moves.pop();if(!move)return;move.cells.forEach(i=>occupied.delete(i));placed.delete(move.piece);shape=move.piece;rotation=move.rotation;paint()}),button('重新摆放',()=>{moves.length=0;occupied.clear();placed.clear();shape=0;rotation=0;paint()}));
  listen(window,'keydown',e=>{if(e.code==='KeyR'){e.preventDefault();rotate()}});
  cells.forEach((c,index)=>{
   const positions=()=>offsets().map(([dx,dy])=>[index%6+dx,Math.floor(index/6)+dy]);
   const invalid=p=>p.some(([x,y])=>x<0||y<0||x>=6||y>=4||!target.has(y*6+x)||occupied.has(y*6+x));
   c.onpointerenter=()=>{cells.forEach(x=>x.classList.remove('preview-valid','preview-invalid'));if(done||placed.has(shape))return;const p=positions(),bad=invalid(p);for(const [x,y] of p)if(x>=0&&y>=0&&x<6&&y<4)cells[y*6+x].classList.add(bad?'preview-invalid':'preview-valid')};
   c.onpointerleave=()=>cells.forEach(x=>x.classList.remove('preview-valid','preview-invalid'));
   c.onclick=()=>{if(done||placed.has(shape))return;const p=positions();if(invalid(p)){text('请将整块放入高亮轮廓，不能覆盖已有零件');return}
    const move={piece:shape,rotation,cells:p.map(([x,y])=>y*6+x)};move.cells.forEach(i=>occupied.add(i));moves.push(move);placed.add(shape);
    p.forEach(([x,y])=>effects('collect',50+x*100,42+y*85,sprites[shape]));shape=pieces.findIndex((_,i)=>!placed.has(i));if(shape<0)shape=0;rotation=0;paint();
    if(occupied.size===target.size&&placed.size===pieces.length)result(true);
   };
  });paint();
 }else if(g.kind==='memory'){
  const l=level.memory,ids=l.ids,values=l.values,cells=grid(l.columns,Math.ceil(values.length/l.columns),'memory-grid'),found=new Set();
  let opened=[],busy=true,preview=true;
  const back='<span class="card-back">✿</span>';
  function sync(){detail={values:[...values],found:[...found],opened:[...opened],busy,preview,pairs:values.length/2,mistakeLimit:l.mistakes};}
  cells.forEach((c,i)=>{c.innerHTML=art(ids[values[i]]);c.setAttribute('aria-label','第 '+(i+1)+' 张茶材卡');c.onclick=()=>{
   if(done||busy||found.has(i)||opened.includes(i))return;c.innerHTML=art(ids[values[i]]);c.classList.remove('card-flip');void c.offsetWidth;c.classList.add('card-flip');opened.push(i);
   if(opened.length===2){const [a,b]=opened;
    if(values[a]===values[b]){found.add(a);found.add(b);cells[a].classList.add('done');cells[b].classList.add('done');opened=[];effects('collect',300,170,ids[values[a]]);text('配对 '+found.size/2+'/'+values.length/2+' · 可失误 '+(l.mistakes-errors)+' 次');if(found.size===values.length)result(true,100-errors*5)}
    else{busy=true;later(()=>{cells[a].innerHTML=cells[b].innerHTML=back;opened=[];busy=false;errors++;text('再记一下位置 · 可失误 '+(l.mistakes-errors)+' 次');if(errors>=l.mistakes)result(false);sync()},650)}
   }sync();
  }});
  text('先闻香记位置 · '+l.preview+' 秒后翻面');sync();
  later(()=>{preview=false;busy=false;cells.forEach(c=>c.innerHTML=back);text('寻找 '+values.length/2+' 对香气 · 可失误 '+l.mistakes+' 次');sync()},l.preview*1000);
 }else if(g.kind==='orders'){
  const ids=id===2?['fish','wheat','tomato','rice']:['herb','mint','lavender','wax'],orders=level.orders;let ticket=0,chopped=0,ingredients=[],cookingAt=null;board.classList.add('cook-board');
  board.innerHTML='<div class="order-ticket"></div><div class="order-ingredients"></div><div class="stations"></div><div class="order-pot">'+art(recipe.item)+'<span></span><progress max="5" value="0"></progress></div>';
  function paint(){board.querySelector('.order-ticket').innerHTML='<b>订单 '+(ticket+1)+'/'+orders.length+'</b> '+orders[ticket].ingredients.map(i=>art(ids[i])).join('');board.querySelector('.order-ingredients').innerHTML=ingredients.map(i=>art(ids[i])).join('');detail={orders,ticket,chopped,ingredients:[...ingredients],cookingAt,t};}
  function reset(){ingredients=[];chopped=0;cookingAt=null;paint()}
  ids.forEach((k,i)=>controls.append(button(art(k)+'<span>'+itemName(k)+'</span>',()=>{if(ingredients.length<orders[ticket].ingredients.length&&cookingAt==null){ingredients.push(i);paint()}},'activity-item')));
  const stations=board.querySelector('.stations');
  stations.append(button('处理食材',()=>{
   if(cookingAt!=null)return;if(ingredients.length!==orders[ticket].ingredients.length){text('先放入订单要求的 '+orders[ticket].ingredients.length+' 份食材');return}
   chopped=Math.min(ingredients.length,chopped+1);effects('chop',230+chopped*40,140,ids[ingredients[chopped-1]]);board.classList.remove('chopping');void board.offsetWidth;board.classList.add('chopping');text('处理 '+chopped+'/'+ingredients.length);paint();
  }),button('入锅温煮',()=>{
   if(chopped<orders[ticket].ingredients.length||cookingAt!=null)return;
   if([...ingredients].sort().join()!==[...orders[ticket].ingredients].sort().join()){reset();mistake('订单食材不匹配');return}
   cookingAt=t;effects('steam',300,170);text('温煮 '+orders[ticket].cook.toFixed(1)+' 秒后装盘');paint();
  }),button('装盘 / 装瓶',()=>{
   if(cookingAt==null)return;const elapsed=t-cookingAt,order=orders[ticket];
   if(elapsed<order.cook){text('还没煮好，留意火候条');return}
   if(elapsed>order.cook+order.window){reset();mistake('温煮过久，请重新备料');return}
   effects('collect',300,160,recipe.item);ticket++;if(ticket===orders.length){result(true,100-errors*8);return}reset();text('交付成功 · 下一份订单需要不同配料');
  }),button('清空食材',reset));
  animate=()=>{
   const pot=board.querySelector('.order-pot'),elapsed=cookingAt==null?0:t-cookingAt,order=orders[ticket];
   pot.classList.toggle('is-cooking',cookingAt!=null);pot.classList.toggle('ready-to-serve',elapsed>=order.cook);
   pot.querySelector('span').textContent=cookingAt==null?'按订单备料':elapsed<order.cook?'温煮中 · '+(order.cook-elapsed).toFixed(1)+' 秒':'可以装盘 · 剩余 '+Math.max(0,order.cook+order.window-elapsed).toFixed(1)+' 秒';
   const meter=pot.querySelector('progress');meter.max=order.cook+order.window;meter.value=elapsed;detail.t=t;detail.elapsed=elapsed;
   if(elapsed>order.cook+order.window){reset();mistake('错过火候，请重新备料')}
  };paint();text('按订单配料 · 不同订单有不同火候');
 }else if(['dress','decorate'].includes(g.kind)){
  const plan=level.arrangement,ids=plan.items,labels=plan.labels;board.classList.add(g.kind+'-board');
  board.innerHTML=(g.kind==='dress'?avatarPortrait(options.avatar||'male_0',theme,'wardrobe-portrait'):art('c19_10'))+'<div class="dress-slots"><b>'+plan.name+'</b></div>';
  const placed=new Set();ids.forEach((k,i)=>{
   const b=button(labels[i],()=>{},'secondary');b.dataset.slot=i;b.setAttribute('aria-label',labels[i]);
   drop(b,()=>{if(done||!selected)return;if(selected!==k){text('这件物品与「'+plan.name+'」的'+labels[i]+'不相配，再找找');return}
    placed.add(i);b.innerHTML=art(k)+'<span>'+labels[i]+' ✓</span>';b.classList.add('action-snap');effects('collect',300,180,k);detail.placed=[...placed];
    if(placed.size===ids.length)result(true);else text(plan.name+' · 已搭配 '+placed.size+'/'+ids.length);
   });board.querySelector('.dress-slots').append(b);
  });dragItems(plan.choices);detail={arrangement:plan,placed:[]};text('本局主题：'+plan.name+' · 选择物品放入合适的位置');
 }else if(g.kind==='puzzle'){
  const plan=level.puzzle,order=[...plan.order],cells=grid(plan.columns,plan.rows,'jigsaw-grid');let swaps=0;
  function paint(){
   cells.forEach((c,i)=>{c.className='puzzle-cell '+(selected===i?'selected':'');c.dataset.piece=order[i];c.setAttribute('aria-label','第 '+(i+1)+' 块拼图');c.innerHTML=art(plan.referenceItem);const image=c.firstElementChild;image.style.cssText='width:'+plan.columns*100+'%;height:'+plan.rows*100+'%;max-height:none;left:'+-(order[i]%plan.columns)*100+'%;top:'+-Math.floor(order[i]/plan.columns)*100+'%';});
   detail={order:[...order],columns:plan.columns,rows:plan.rows,swaps};text('修复 '+itemName(plan.referenceItem)+' · '+order.length+' 块 · 交换 '+swaps+' 次');
  }
  cells.forEach((c,i)=>c.onclick=()=>{if(done)return;if(selected==null){selected=i;paint();return}if(selected!==i){[order[selected],order[i]]=[order[i],order[selected]];swaps++;effects('collect',300,170,plan.referenceItem)}selected=null;paint();if(order.every((x,i)=>x===i))result(true,100-Math.max(0,swaps-order.length)*2)});
  controls.innerHTML='<div class="activity-item puzzle-reference">'+art(plan.referenceItem)+'<span>完整原作</span></div>';paint();
 }else if(g.kind==='maze'){
  const plan=level.maze,cells=grid(8,6,'maze-grid'),walls=new Set(plan.walls),targets=new Set(plan.targets),collected=new Set();let position=plan.start,steps=0,hints=2,hint=[];
  function paint(){
   cells.forEach((c,i)=>{c.classList.toggle('blocked',walls.has(i));c.classList.toggle('maze-hint',hint.includes(i));c.classList.toggle('maze-exit',i===plan.exit);c.innerHTML=i===position?avatarThumbnail(options.avatar||'male_0',theme):targets.has(i)&&!collected.has(i)?art(id===14?'c14_0':'c22_0'):i===plan.exit?'出口':'';c.setAttribute('aria-label',i===plan.exit?'出口':'路线 '+i);});
   detail={position,walls:[...walls],targets:[...targets],collected:[...collected],exit:plan.exit,steps,stepLimit:plan.steps};
   text('补给 '+collected.size+'/'+targets.size+' · '+(plan.steps?'剩余 '+(plan.steps-steps)+' 步':'自由探索')+' · 收齐后走到出口');
  }
  function move(next){
   if(done||next<0||next>=48||walls.has(next)||Math.abs(next%8-position%8)+Math.abs(Math.floor(next/8)-Math.floor(position/8))!==1)return;
   position=next;steps++;hint=[];
   if(targets.has(next)&&!collected.has(next)){collected.add(next);effects('collect',(next%8+.5)*75,(Math.floor(next/8)+.5)*56,id===14?'c14_0':'c22_0')}
   paint();cells[next].classList.add('action-snap');
   if(position===plan.exit&&collected.size===targets.size)result(true,100-Math.max(0,steps-plan.optimal));
   else if(plan.steps&&steps>=plan.steps)result(false);
  }
  cells.forEach((c,i)=>c.onclick=()=>move(i));listen(window,'keydown',e=>{const d={ArrowUp:-8,ArrowDown:8,ArrowLeft:-1,ArrowRight:1}[e.key];if(d!=null){e.preventDefault();move(position+d)}});
  controls.append(button('路线提示 ×2',function(){if(!hints)return;hints--;const next=[...targets].filter(i=>!collected.has(i)).map(i=>mazePath(position,i,plan.walls)).sort((a,b)=>a.length-b.length)[0]||mazePath(position,plan.exit,plan.walls);hint=next.slice(1);paint();text('高亮路线通向最近的目标 · 剩余提示 '+hints)}));paint();
 }else{
  const c=document.createElement('canvas');c.className='activity-canvas';c.width=600;c.height=340;board.append(c);const ctx=c.getContext('2d'),point=e=>{const r=c.getBoundingClientRect();return {x:(e.clientX-r.left)*600/r.width,y:(e.clientY-r.top)*340/r.height}};
  let pointer={x:300,y:170},pointerMove=()=>{},pointerRelease=()=>{},pointerCancel=()=>{},pointerDown=()=>{};listen(c,'pointerdown',e=>{if(userPaused||!windowActive)return;pointer=point(e);holding=true;c.setPointerCapture(e.pointerId);pointerDown(pointer)});listen(c,'pointermove',e=>{const next=point(e);pointerMove(pointer,next);pointer=next});listen(c,'pointerup',e=>{pointer=point(e);if(holding)pointerRelease(pointer);holding=false});listen(c,'pointercancel',()=>{holding=false;pointerCancel()});
  const backdrop=()=>{
   ctx.clearRect(0,0,600,340);
   const night=['launch','notes'].includes(g.kind),water=['boat','fishing'].includes(g.kind);
   const bg=ctx.createLinearGradient(0,0,0,340);
   const colors=night?(theme==='origami'?['#6c648c','#a17f94']:['#253852','#53657d']):water?(theme==='origami'?['#a5cfce','#74a7b3']:['#74b9c6','#477f9d']):(theme==='origami'?['#efe0d0','#dcc4aa']:['#e7efd8','#cdd9b7']);
   bg.addColorStop(0,colors[0]);bg.addColorStop(1,colors[1]);ctx.fillStyle=bg;ctx.fillRect(0,0,600,340);
   if(night)for(let i=0;i<24;i++){ctx.globalAlpha=.35+.25*Math.sin(t*1.6+i);ctx.fillStyle='#fff4cb';const x=20+(i*137)%565,y=15+(i*53)%230;ctx.fillRect(x,y,theme==='pixel'?2:3,2)}ctx.globalAlpha=1;
   if(water)for(let i=0;i<15;i++){const x=(i*53+t*8)%600,y=35+i*20;ctx.strokeStyle='#e0f4ec40';ctx.beginPath();ctx.ellipse(x,y,14+Math.sin(t+i)*4,3,0,0,Math.PI);ctx.stroke()}
   if(theme==='origami'){ctx.fillStyle='#ffffff0c';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(350,0);ctx.lineTo(600,340);ctx.closePath();ctx.fill()}
  };const label=(s,x,y)=>{ctx.fillStyle=['launch','notes'].includes(g.kind)?'#fff1cc':'#534734';ctx.font='17px sans-serif';ctx.textAlign='center';ctx.fillText(s,x,y)};
  if(g.kind==='trace'){
   const path=level.trace.path;
   const marks=new Set();function stamp(a,b){for(let step=0,len=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/8));step<=len;step++){const x=a.x+(b.x-a.x)*step/len,y=a.y+(b.y-a.y)*step/len;path.forEach((p,i)=>{if(Math.hypot(p.x-x,p.y-y)<level.trace.radius)marks.add(i)})}}pointerDown=p=>stamp(p,p);pointerMove=(a,b)=>{if(holding)stamp(a,b)};animate=()=>{backdrop();ctx.globalAlpha=.24;drawItem(ctx,recipe.item,theme,300,170,250,id===15?Math.sin(t*.8)*.025:0);ctx.globalAlpha=1;ctx.lineWidth=4;ctx.strokeStyle='#97795b';ctx.beginPath();path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    path.forEach((p,i)=>{if(holding&&Math.hypot(p.x-pointer.x,p.y-pointer.y)<level.trace.radius)marks.add(i);if(marks.has(i)){ctx.fillStyle='#619e7d';ctx.beginPath();ctx.arc(p.x,p.y,5,0,7);ctx.fill()}});ctx.strokeStyle='#619e7d';ctx.lineWidth=7;ctx.beginPath();let tracing=false;path.forEach((p,i)=>{if(marks.has(i)){if(tracing)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);tracing=true}else tracing=false});ctx.stroke();drawItem(ctx,id===15?'pottery':'c24_2',theme,pointer.x,pointer.y,44,-.4);text('完成轮廓 '+Math.round(marks.size/path.length*100)+'%');detail={path,marks:[...marks]};if(marks.size>=path.length*.85)result(true)};
  }else if(g.kind==='fishing'){
   let bar=170,velocity=0,progress=0,tension=0;const swim={...level.fish,halfHeight:level.fish.halfHeight+(options.equipment?.source==='owned'?Math.min(14,Math.max(0,options.equipment.trackingBonus||0)):0)},fishY=()=>165+Math.sin(t*swim.frequency+swim.phase)*swim.amplitude+Math.sin(t*1.3+swim.secondPhase)*8;
   listen(window,'keydown',e=>{if(e.code==='Space'){e.preventDefault();holding=true}});listen(window,'keyup',e=>{if(e.code==='Space')holding=false});
   animate=dt=>{velocity=Math.max(-150,Math.min(150,velocity+(holding?-210:210)*dt));bar=Math.max(52,Math.min(288,bar+velocity*dt));if(bar===52&&velocity<0||bar===288&&velocity>0)velocity=0;const f=fishY(),caught=Math.abs(f-bar)<swim.halfHeight-2;progress=Math.max(0,Math.min(1,progress+dt*(caught?swim.rate:-.075)));tension=holding?Math.min(4,tension+dt*.5):Math.max(0,tension-dt);backdrop();ctx.fillStyle='#88bfc6';ctx.fillRect(235,25,130,290);ctx.fillStyle='#8dd79899';ctx.fillRect(235,bar-swim.halfHeight,130,swim.halfHeight*2);for(let i=0;i<7;i++){const yy=310-(t*23+i*39)%280;ctx.strokeStyle='#d2f7ed77';ctx.beginPath();ctx.arc(250+(i*19)%95,yy,2+i%3,0,7);ctx.stroke()}ctx.strokeStyle='#f8eee5';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(185,78+Math.sin(t*4)*3);ctx.quadraticCurveTo(220,100,300,f);ctx.stroke();drawItem(ctx,options.catchItem||'fish',theme,300+Math.sin(t*3)*5,f,62,Math.sin(t*4)*.09);drawItem(ctx,options.equipment?.id||'rod',theme,160,150,150,-.3+(holding?-.07:.04));if(holding&&Math.sin(t*14)>.96)effects('splash',300,f);label('收线 '+Math.round(progress*100)+'%',440,130);label('绷紧 '+Math.round(tension/4*100)+'%',440,175);detail={bar,fishY:f,progress,tension,t,equipment:options.equipment,controlHalfHeight:swim.halfHeight};text((options.equipment?.name||'公共渔竿')+' · '+swim.name+'鱼群 · 按住提竿 / 松开下沉 · 持续罩住海产');if(progress>=1)result(true);else if(tension>=4)result(false)};
  }else if(g.kind==='notes'){
   const notes=level.music.notes.map(n=>({...n}));let combo=0;
   function hit(lane){if(done||!started||userPaused||!windowActive)return;const n=notes.find(n=>!n.hit&&!n.miss&&n.lane===lane&&Math.abs(t-n.at)<=level.music.window);if(n){n.hit=true;score++;combo++;note(lane);effects('note',150+lane*100,280,'c12_0');text((Math.abs(t-n.at)<.09?'完美':'准确')+' · '+score+'/'+notes.length+' · '+combo+' 连击')}else text('跟随音符落到判断线，再演奏');}
   controls.append(...['A','S','D','F'].map((k,i)=>button(k,()=>hit(i))));listen(window,'keydown',e=>{const lane=['KeyA','KeyS','KeyD','KeyF'].indexOf(e.code);if(lane>=0&&!e.repeat){e.preventDefault();hit(lane)}});listen(c,'pointerdown',e=>{const p=point(e);if(p.x>=100&&p.x<500&&p.y<=320)hit(Math.floor((p.x-100)/100))});
   animate=()=>{backdrop();for(let i=0;i<4;i++){ctx.strokeStyle='#c1ac88';ctx.strokeRect(100+i*100,10,100,310);label(['A','S','D','F'][i],150+i*100,330)}ctx.fillStyle='#598d77';ctx.fillRect(100,278,400,5);for(const n of notes){if(!n.hit&&!n.miss){const y=280+(t-n.at)*150;if(t>n.at+level.music.window){n.miss=true;errors++;combo=0}else if(y>-20)drawItem(ctx,id===12?'c12_0':'c21_2',theme,150+n.lane*100,y,45)}}detail={notes,t,score};if(notes.every(n=>n.hit||n.miss))result(score>=Math.ceil(notes.length*.7),Math.round(55+45*score/notes.length))};
  }else if(g.kind==='launch'){
   const targets=level.launch.targets,lit=new Set();let charge=0,shots=0,projectile=null;pointerRelease=p=>{if(done||projectile)return;shots++;projectile={x:300,y:308,tx:p.x,ty:p.y,life:0,charge};charge=0};pointerCancel=()=>charge=0;
   animate=dt=>{if(holding&&!projectile)charge=Math.min(1,charge+dt);backdrop();for(let i=0;i<targets.length;i++){const p=targets[i];if(lit.has(i))drawItem(ctx,'firework',theme,p.x,p.y,60);else{ctx.strokeStyle='#f8d89a';ctx.fillStyle='#f8d89a22';ctx.lineWidth=2;ctx.beginPath();for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,r=k%2?9:21;const x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r;k?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke()}label(String(i+1),p.x,p.y-32)}drawItem(ctx,'firework',theme,300,308,45);ctx.strokeStyle='#bc927c';ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(300,308);ctx.lineTo(pointer.x,pointer.y);ctx.stroke();ctx.setLineDash([]);
    if(projectile){const p=projectile;p.life+=dt;const f=Math.min(1,p.life/.65);p.x=300+(p.tx-300)*f;p.y=308+(p.ty-308)*f;if(Math.sin(t*50)>.5)effects('trail',p.x,p.y+12);drawItem(ctx,'c20_8',theme,p.x,p.y,34,Math.atan2(p.ty-308,p.tx-300)+Math.PI/2);if(f>=1){const hit=targets.findIndex((v,i)=>!lit.has(i)&&Math.hypot(v.x-p.x,v.y-p.y)<level.launch.radius);if(hit>=0&&p.charge>=level.launch.charge){lit.add(hit);effects('firework',p.x,p.y)}else effects('splash',p.x,p.y);projectile=null;if(lit.size===targets.length)result(true,100-(shots-targets.length)*7);else if(shots>=level.launch.shots)result(false)}}detail={targets,lit:[...lit],shots,charge};if(!done)text('星光 '+lit.size+'/'+targets.length+' · 发射 '+shots+'/'+level.launch.shots+' · 蓄力 '+Math.round(charge*100)+'% / 需要 '+Math.round(level.launch.charge*100)+'%');
   };
  }else if(g.kind==='boat'){
   const buoys=level.boat.buoys,visited=new Set();let pos={x:70,y:285},vx=0,vy=0;
   animate=dt=>{if(holding){const dx=pointer.x-pos.x,dy=pointer.y-pos.y,len=Math.hypot(dx,dy);vx+=dx/Math.max(30,len)*180*dt;vy+=dy/Math.max(30,len)*180*dt}vx+=level.boat.current.x*dt;vy+=level.boat.current.y*dt;vx*=Math.exp(-1.7*dt);vy*=Math.exp(-1.7*dt);pos.x=Math.max(25,Math.min(575,pos.x+vx*dt));pos.y=Math.max(25,Math.min(315,pos.y+vy*dt));backdrop();ctx.fillStyle='#86bac4';ctx.fillRect(0,0,600,340);for(let i=0;i<buoys.length;i++){const b=buoys[i];if(Math.hypot(b.x-pos.x,b.y-pos.y)<level.boat.radius&&i===visited.size)visited.add(i);drawItem(ctx,'c23_6',theme,b.x,b.y,visited.has(i)?30:45);label(String(i+1),b.x,b.y+40)}ctx.fillStyle='#af936f';ctx.fillRect(490,260,100,70);label('码头',540,310);if(Math.hypot(vx,vy)>12&&Math.sin(t*20)>.9)effects('splash',pos.x-vx*.17,pos.y-vy*.17);drawItem(ctx,'c23_8',theme,pos.x,pos.y,70,Math.atan2(vy,vx)+Math.PI/2);detail={pos:{...pos},buoys,visited:[...visited]};text('依次通过浮标 '+visited.size+'/'+buoys.length+' · 松开减速，靠泊右下码头');if(visited.size===buoys.length&&pos.x>490&&pos.y>260&&Math.hypot(vx,vy)<80)result(true)};
  }
 }
 const performanceStage=createGamePerformance(board,theme,options.catchItem||recipe.item);
 const session=document.createElement('div');session.className='activity-session-controls';root.querySelector('.room-game').append(session);
 const restart=button('换一局',()=>{});restart.onclick=()=>{if(!alive)return;destroy();replacement=mountActivityGame(root,id,onFinish,nextGameOptions(options))};session.append(restart);
 if(['notes','fishing','trace','launch','boat','orders','memory'].includes(g.kind)){const pause=button(started?'暂停':'开始演奏',()=>{if(!started){started=true;t=0;last=performance.now();}else userPaused=!userPaused;holding=false;pause.textContent=userPaused?'继续':'暂停';});pause.dataset.session='pause';session.prepend(pause);}
 addGameChrome(root,options,mode=>{if(!alive)return;destroy();replacement=mountActivityGame(root,id,onFinish,nextGameOptions(options,mode))});
 const soundSettings=()=>{if(!alive||done)return;userPaused=true;holding=false;audio.pause();performanceStage.pause();const b=session.querySelector('[data-session="pause"]');if(b)b.textContent='继续';};window.addEventListener('hd-sound-settings',soundSettings);listeners.push(()=>window.removeEventListener('hd-sound-settings',soundSettings));
 const blur=()=>{windowActive=false;holding=false;audio.pause();performanceStage.pause()},focus=()=>{windowActive=true;last=performance.now()},visibility=()=>{holding=false;last=performance.now()};window.addEventListener('blur',blur);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',visibility);listeners.push(()=>window.removeEventListener('blur',blur),()=>window.removeEventListener('focus',focus),()=>document.removeEventListener('visibilitychange',visibility));
 function tick(time){if(!alive)return;const dt=Math.min(.05,Math.max(0,(time-last)/1000));last=time;const active=started&&!userPaused&&windowActive&&!document.hidden;root.querySelector('.room-game').dataset.paused=String(!active);if(active){t+=dt;if(!done)for(let i=timeouts.length-1;i>=0;i--)if(timeouts[i].at<=t){const task=timeouts.splice(i,1)[0];if(alive&&!done)task.fn();}}performanceStage.tick(active?dt:0);if(!done&&(!started||active))animate(active?dt:0);frame=requestAnimationFrame(tick)}
 frame=requestAnimationFrame(tick);
 function destroy(){replacement?.destroy();alive=false;audio.destroy();performanceStage.destroy();cancelAnimationFrame(frame);timeouts.length=0;listeners.forEach(f=>f());}
 return {config:g,destroy,inspect:()=>replacement?replacement.inspect():({id,kind:g.kind,level,t,score,errors,done,started,paused:userPaused||!windowActive||document.hidden,performance:performanceStage.inspect(),...detail})};
}

