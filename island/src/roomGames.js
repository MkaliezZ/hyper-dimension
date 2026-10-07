import {createGamePerformance} from './gamePerformance.js';
import {createWorkshopAudio} from './workshopAudio.js';
import {ACTIVITY_GAMES,mountActivityGame} from './activityGames.js';
import {itemMarkup} from './artStore.js';
import {DEFAULT_RECIPES} from './contentCatalog.js';
import {gameLevelOptions,nextGameOptions,itemName} from './gameLevels.js';
import {addGameChrome} from './gameChrome.js';
// Every building has its own playable objective; families share input plumbing.
const LEGACY_GAMES=[
 {kind:'timing',title:'榫卯敲合',verb:'落锤',instructions:'等锤头进入亮区，完成三处榫卯。至少两次精准才能成品。',rounds:['固定底座','安装提梁','收紧榫口'],symbol:'⌁'},
 {kind:'sequence',title:'海风花茶',instructions:'记住茶师的调饮步骤，依次投料与冲泡。',steps:['筛小麦','放草药','注热水','静置出香'],choices:['注热水','筛小麦','静置出香','放草药'],symbol:'♨'},
 {kind:'sequence',title:'海鲜料理课',instructions:'按厨师示范完成四道工序，顺序决定口感。',steps:['清理鲜鱼','切好配料','小麦入锅','小火炖煮'],choices:['小火炖煮','清理鲜鱼','小麦入锅','切好配料'],symbol:'♨'},
 {kind:'sequence',title:'四季花束',instructions:'记住客人的配色要求，按顺序插入花材。',steps:['鼠尾草','粉花','白花','金色丝带'],choices:['粉花','金色丝带','鼠尾草','白花'],symbol:'✿'},
 {kind:'sequence',title:'织出海岛纹样',instructions:'观察经纬配色，再按顺序编织六段。',steps:['海蓝','米白','珊瑚','海蓝','米白','珊瑚'],choices:['珊瑚','海蓝','米白'],symbol:'◇'},
 {kind:'connect',title:'星图观测',instructions:'按本局天文笔记的星名顺序连线，完成星座观测。',steps:['天枢','天璇','天玑','天权','玉衡','开阳','摇光'],points:[[18,25],[30,47],[47,52],[57,33],[69,29],[79,41],[91,27]],symbol:'✧'},
 {kind:'balance',title:'珊瑚水域养护',instructions:'调整观赏缸的三项参数，使它们都回到适宜区间。',controls:[['水温',24,28,15,35,'℃'],['溶氧',65,85,0,100,'%'],['水流',35,55,0,100,'%']],symbol:'≈'},
 {kind:'sort',title:'整理漂流书架',instructions:'逐本选择书籍，再放入对应主题的书架。',bins:['自然','艺术','生活'],items:[['海岛植物志',0],['星光诗集',1],['木作生活',2],['海洋图鉴',0]],symbol:'▤'},
 {kind:'dial',title:'航标校准',instructions:'旋转灯束对准本轮航线方位，再锁定。完成三个航标。',targets:[45,135,270],rounds:['东南客船','西南渔船','北方商船'],symbol:'◉'},
 {kind:'sort',title:'集市配货',instructions:'按顾客清单把商品送到相应摊位，避免错发。',bins:['花草摊','餐食摊','工艺摊'],items:[['花束',0],['面包',1],['陶器',2],['花茶',1]],symbol:'▥'},
 {kind:'sequence',title:'草药调配练习',instructions:'按岛上药草配方卡的工序调配游戏药剂。',steps:['挑选药草','研磨叶片','加入清水','过滤装瓶'],choices:['过滤装瓶','加入清水','挑选药草','研磨叶片'],symbol:'⚗'},
 {kind:'sort',title:'漂流信分拣',instructions:'根据收件地址把信件放到对应邮袋。',bins:['山上区','花园区','海岸区'],items:[['观星台来信',0],['花艺小屋来信',1],['船坞来信',2],['灯塔来信',2]],symbol:'✉'},
 {kind:'rhythm',title:'海风小夜曲',verb:'弹奏',instructions:'每个音符在亮区时按键或点击琴键，跟上四拍旋律。',rounds:['DO','MI','SOL','MI'],symbol:'♫'},
 {kind:'focus',title:'定格海岛瞬间',instructions:'点击取景框中的拍摄主体，再调清晰度到60附近，按快门。',symbol:'◎'},
 {kind:'balance',title:'温室育苗',instructions:'调节温室，让温度、湿度和光照共同满足幼苗需求。',controls:[['温度',22,28,10,40,'℃'],['湿度',55,75,0,100,'%'],['光照',45,65,0,100,'%']],symbol:'❀'},
 {kind:'balance',title:'手作拉坯',instructions:'控制转速、手压和坯口宽度，拉出稳定的陶器轮廓。',controls:[['转速',40,60,0,100,'%'],['手压',25,45,0,100,'%'],['坯口',50,70,0,100,'%']],symbol:'∪'},
 {kind:'timing',title:'绑好钓线',verb:'收线',instructions:'控制三次收线力度，亮区内打结才牢固。',rounds:['鱼钩结','浮漂结','线轴结'],symbol:'⌁'},
 {kind:'sequence',title:'海岛面包房',instructions:'记住烘焙工序，按顺序完成一份面包。',steps:['筛小麦','揉面','醒发','入炉烘焙'],choices:['醒发','入炉烘焙','揉面','筛小麦'],symbol:'♨'},
 {kind:'sort',title:'藏品归档',instructions:'根据藏品用途完成博物馆分区，形成清晰的展陈。',bins:['航海史','自然志','岛屿工艺'],items:[['旧罗盘',0],['珊瑚标本',1],['手烧陶瓶',2],['航海日志',0]],symbol:'◈'},
 {kind:'sort',title:'把家布置好',instructions:'把生活物件放到适合的位置，准备舒适的休息角。',bins:['书架','沙发','壁炉'],items:[['故事书',0],['毛毯',1],['木柴',2],['软靠垫',1]],symbol:'⌂'},
 {kind:'sequence',title:'配制节庆烟花',instructions:'依照安全工序制作游戏中的节庆烟花，牢记装配顺序。',steps:['铺好纸筒','放色彩芯','封好筒口','接好引线'],choices:['封好筒口','接好引线','铺好纸筒','放色彩芯'],symbol:'✦'},
 {kind:'rhythm',title:'舞台灯光彩排',verb:'切灯',instructions:'跟随四个演出节点，在亮区切换对应灯光。',rounds:['开场暖光','独奏蓝光','合唱金光','谢幕星光'],symbol:'♫'},
 {kind:'balance',title:'营地搭建',instructions:'调好帐篷张力、防风和营灯亮度，形成舒适的营地。',controls:[['篷绳张力',55,75,0,100,'%'],['挡风角度',30,50,0,100,'°'],['营灯亮度',35,55,0,100,'%']],symbol:'△'},
 {kind:'timing',title:'船体修补',verb:'固定木板',instructions:'等工具进入亮区，依次固定三块船板，至少两块准确。',rounds:['船首木板','中部木板','船尾木板'],symbol:'⚓'},
 {kind:'sequence',title:'海岛配色课',instructions:'记住老师示范的色彩层次，完成画作。',steps:['天蓝底色','海蓝波纹','沙金海岸','叶绿点缀'],choices:['叶绿点缀','天蓝底色','沙金海岸','海蓝波纹'],symbol:'✎'}
].map((g,id)=>({...g,id}));
export const ROOM_GAMES=LEGACY_GAMES.map(g=>ACTIVITY_GAMES[g.id]?{...ACTIVITY_GAMES[g.id],id:g.id}:g);
export function gameResult(g,score,total){return {passed:score>=Math.ceil(total*.65),score,total,quality:Math.round(55+45*score/total)}}
function workArt(id){return itemMarkup(DEFAULT_RECIPES[id].item,document.body.dataset.theme||'pixel','work-art')}
export function mountRoomGame(root,id,onFinish,options={}){if(ACTIVITY_GAMES[id])return mountActivityGame(root,id,onFinish,options);
 options=gameLevelOptions(id,options);const level=options.level,theme=options.theme||document.body.dataset.theme||'pixel',g={...ROOM_GAMES[id]};
 if(level.constellation){g.steps=level.constellation.steps;g.points=level.constellation.points;g.title='星图观测 · '+level.constellation.name;g.instructions='依观测笔记连通星图，每局会遇到不同的星座与星位。'}
 if(level.balance){g.controls=level.balance;g.instructions='根据本局鱼群调整水温、溶氧与水流。水温和水流会影响溶氧，三项达标后保持稳定再确认。'}
 if(level.headings){g.targets=level.headings;g.rounds=g.targets.map((_,i)=>'第 '+(i+1)+' 条客船航线');}
 if(level.photos){g.rounds=level.photos;g.instructions='捕捉本局不同的海岛主体。先点选移动主体，再按当前焦距提示调焦并拍照。'}
 let frame=0,alive=true,t=0,last=performance.now(),round=0,score=0,errors=0,selected=null,done=false,focused=false,replacement=null,detail={},activeWindow=true,stable=0;const timers=[];let update=()=>{};const audio=createWorkshopAudio();
 const e=(sel)=>root.querySelector(sel),safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 root.innerHTML='<section class="room-game" data-game-id="'+id+'" data-kind="'+g.kind+'"><div class="game-brief"><span class="game-emblem">'+g.symbol+'</span><div><b>'+g.title+'</b><p>'+g.instructions+'</p></div></div><div class="game-score"><span id="gameRound"></span><span id="gameStatus" role="status">准备操作</span></div><div id="gameBoard" class="game-board"></div><div id="gameControls" class="game-controls"></div><p id="gameFeedback" class="game-feedback" aria-live="polite"></p></section>';
 const board=e('#gameBoard'),controls=e('#gameControls'),feedback=e('#gameFeedback');
 function status(text){e('#gameStatus').textContent=text}function count(){e('#gameRound').textContent='进度 '+round+' / '+(g.steps?.length||g.items?.length||g.rounds?.length||g.targets?.length||1)}
 function finish(total){if(done)return;done=true;const result=gameResult(g,score,total);options.onOutcome?.(result);status(result.passed?'操作完成':'再练习一次');controls.innerHTML='<button class="primary" id="gameFinish">'+(result.passed?'领取成果':'重新尝试')+'</button>';feedback.textContent=result.passed?'完成度 '+score+'/'+total+' · 成果品质 '+result.quality:'这次没有达到要求，材料未扣除。';e('#gameFinish').disabled=true;performanceStage.present(result.passed,()=>{if(alive)e('#gameFinish').disabled=false});e('#gameFinish').onclick=()=>{if(!alive||e('#gameFinish').disabled)return;if(result.passed){destroy();onFinish(result)}else{destroy();replacement=mountRoomGame(root,id,onFinish,nextGameOptions(options))}}}
 function button(text,fn){const b=document.createElement('button');b.className='game-choice';b.textContent=text;b.onclick=()=>{if(alive&&!done)fn()};return b}
 function mistake(){errors++;feedback.textContent='这一步还不对，按提示再想一想。';status('需重新调整');if(errors>=level.mistakeLimit){score=0;finish(g.steps?.length||g.items?.length||3)}}
 function note(i){audio.unlock();audio.event({kind:'note',lane:i})}
 count();
 if(['timing','rhythm'].includes(g.kind)){board.innerHTML='<div class="workpiece workpiece-'+id+'">'+workArt(id)+'<b id="workRound">'+g.rounds[0]+'</b><div class="work-progress" id="workProgress"></div></div><div class="skill-track"><span class="skill-zone"></span><i id="skillMarker"></i></div>';const press=()=>{if(done)return;const value=(Math.sin(t*2.8-Math.PI/2)+1)/2,hit=value>=.36&&value<=.64;if(hit)score++;feedback.textContent=hit?'精准！这一处已经处理好了。':'力度有偏差，下一处要更仔细。';if(g.kind==='rhythm')note(round);round++;e('#workProgress').style.width=(round/g.rounds.length*100)+'%';count();if(round>=g.rounds.length)finish(g.rounds.length);else e('#workRound').textContent=g.rounds[round]};controls.append(button(g.verb+' · 空格',press));const key=ev=>{if(ev.code==='Space'){ev.preventDefault();press()}};window.addEventListener('keydown',key);timers.push(()=>window.removeEventListener('keydown',key));}
 else if(g.kind==='sequence'){board.innerHTML='<div class="recipe-preview">'+g.steps.map((s,i)=>'<span>'+ (i+1)+' · '+safe(s)+'</span>').join('')+'</div><div class="sequence-work" id="sequenceWork">'+workArt(id)+'<p>观察示范，再开始操作</p></div>';let ready=false;controls.append(button('我记住了 · 开始',()=>{ready=true;e('.recipe-preview').classList.add('covered');controls.innerHTML='';for(const c of g.choices)controls.append(button(c,()=>{if(!ready||done)return;if(c!==g.steps[round]){mistake();return}score++;round++;feedback.textContent='完成：'+c;e('#sequenceWork p').textContent='已完成 '+round+' 道工序';const bead=document.createElement('i');bead.style.background=['#77a99a','#deb487','#b386a4','#a9bb7d'][round%4];e('#sequenceWork').append(bead);count();if(round>=g.steps.length)finish(g.steps.length)}));status('按顺序完成工序')}));}
 else if(g.kind==='sort'){board.innerHTML='<div class="sort-items"></div><div class="sort-bins"></div>';function select(i,b){selected=i;root.querySelectorAll('.sort-item').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');feedback.textContent='把「'+g.items[i][0]+'」放入对应区域。'}g.items.forEach(([name],i)=>{const b=button(name,()=>select(i,b));b.innerHTML=itemMarkup('c11_'+(i+1),document.body.dataset.theme||'pixel')+name;b.classList.add('sort-item');b.draggable=true;b.dataset.item=i;b.ondragstart=ev=>{selected=i;ev.dataTransfer.setData('text/plain',String(i))};e('.sort-items').append(b)});g.bins.forEach((name,k)=>{const drop=()=>{if(done||selected==null)return;if(g.items[selected][1]!==k){mistake();return}const b=e('[data-item="'+selected+'"]');if(b.disabled)return;b.disabled=true;b.classList.remove('selected');b.insertAdjacentHTML('beforeend',' ✓');b.classList.add('action-snap');performanceStage.emit('collect',300,170,'c11_'+(selected+1));selected=null;score++;round++;count();feedback.textContent='归类正确，物件已经放好。';if(round===g.items.length)finish(g.items.length)};const b=button(name,drop);b.setAttribute('aria-label',name);b.classList.add('sort-bin');b.ondragover=ev=>ev.preventDefault();b.ondrop=ev=>{ev.preventDefault();drop()};e('.sort-bins').append(b)});status('选择物件，再选区域');}
 else if(g.kind==='balance'){
  board.innerHTML='<div class="balance-scene balance-'+id+'">'+workArt(id)+'<div class="aquarium-fish">'+['fish','shrimp','crab'].map(k=>itemMarkup(k,theme)).join('')+'</div><div class="balance-orbit"></div><b id="balanceHealth">调节鱼群环境</b><progress class="balance-stability" max="'+level.stableSeconds+'" value="0"></progress></div>';
  const sliders=[];
  const countValid=()=>sliders.filter((x,i)=>+x.value>=g.controls[i][1]&&+x.value<=g.controls[i][2]).length;
  function paint(){
   sliders.forEach((x,i)=>x.parentElement.querySelector('b').textContent=x.value+g.controls[i][5]);
   const valid=countValid();status(valid+'/3 项适宜');e('.balance-orbit').style.transform='scale('+(1+valid*.15)+')';
   detail={values:sliders.map(x=>+x.value),stable,stableSeconds:level.stableSeconds};if(valid<3)stable=0;
  }
  g.controls.forEach(([name,lo,hi,min,max,unit],i)=>{
   const label=document.createElement('label');label.innerHTML='<span>'+name+' <b></b><small>适宜 '+lo+'–'+hi+unit+'</small></span><input type="range" min="'+min+'" max="'+max+'" value="'+level.balanceStart[i]+'" aria-label="'+name+'">';
   const slider=label.querySelector('input');let previous=+slider.value;sliders.push(slider);
   slider.oninput=()=>{if(done||!alive)return;const delta=+slider.value-previous;previous=+slider.value;if(i!==1&&sliders[1])sliders[1].value=Math.max(0,Math.min(100,+sliders[1].value+delta*(i===0?-1.5:.12)));stable=0;paint();};
   controls.append(label);
  });paint();
  controls.append(button('确认状态',()=>{if(countValid()<3||stable<level.stableSeconds){feedback.textContent='让三项参数都进入适宜区间，并维持 '+level.stableSeconds+' 秒。';return}score=3;round=1;count();finish(3)}));
  update=dt=>{if(done)return;if(countValid()===3)stable=Math.min(level.stableSeconds,stable+dt);else stable=0;e('.balance-stability').value=stable;e('#balanceHealth').textContent=stable>=level.stableSeconds?'鱼群状态稳定 · 可以确认':'稳定观察 '+stable.toFixed(1)+' / '+level.stableSeconds+' 秒';detail.stable=stable;};
 } else if(g.kind==='connect'){board.classList.add('star-board');board.innerHTML='<svg class="star-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg>';g.points.forEach(([x,y],i)=>{const b=button(g.steps[i],()=>{if(done)return;if(i!==round){mistake();return}if(round){const prev=g.points[round-1],line=document.createElementNS('http://www.w3.org/2000/svg','line');for(const [k,v] of Object.entries({x1:prev[0],y1:prev[1],x2:x,y2:y,stroke:'#efd69a','stroke-width':.6}))line.setAttribute(k,v);e('svg').append(line)}b.classList.add('lit');performanceStage.emit('note',x*6,y*3.4);score++;round++;count();if(round===g.steps.length)finish(g.steps.length)});b.setAttribute('aria-label',g.steps[i]);b.classList.add('star-node');b.style.left=x+'%';b.style.top=y+'%';board.append(b)});controls.innerHTML='<div class="constellation-note">观测顺序：'+g.steps.join(' → ')+'</div>';}
 else if(g.kind==='dial'){board.innerHTML='<div class="compass"><span>北</span><i id="lightBeam"></i><b id="heading">0°</b></div><p id="bearingTarget">目标航向 '+g.targets[0]+'° · '+g.rounds[0]+'</p>';let angle=level.initialHeading;const turn=delta=>{angle=(angle+delta+360)%360;e('#lightBeam').style.transform='rotate('+angle+'deg)';e('#heading').textContent=angle+'°';detail={angle,targets:g.targets}};turn(0);controls.append(button('逆时针 −15°',()=>turn(-15)),button('顺时针 +15°',()=>turn(15)),button('锁定航标',()=>{if(done)return;const diff=Math.abs(((angle-g.targets[round]+540)%360)-180);if(diff>10){feedback.textContent='灯束还没有对准这条航线。';return}score++;round++;count();if(round===g.targets.length)finish(g.targets.length);else{e('#bearingTarget').textContent='目标航向 '+g.targets[round]+'° · '+g.rounds[round];feedback.textContent='航标已确认，继续下一条航线。'}}));}
 else if(g.kind==='focus'){
  board.innerHTML='<div class="viewfinder"><button id="photoSubject" aria-label="拍摄主体"></button><i id="focusReticle"></i><span class="photo-counter"></span></div>';
  const label=document.createElement('label');label.innerHTML='<span id="photoFocusLabel"></span><input type="range" id="photoFocus" min="0" max="100" value="20">';controls.append(label);
  function prepare(){
   const shot=level.photos[round];e('#photoSubject').innerHTML=itemMarkup(shot.art,theme,'work-art');e('#photoFocusLabel').textContent='对焦范围 '+(shot.focus-level.focusTolerance)+'–'+(shot.focus+level.focusTolerance);
   e('#photoFocus').value=20;e('.photo-counter').textContent=(round+1)+' / '+level.photos.length+' · '+itemName(shot.art);focused=false;detail={photos:level.photos,focusTolerance:level.focusTolerance};board.classList.remove('shutter-flash');e('#focusReticle').style.opacity=0;
  }
  e('#photoSubject').onclick=()=>{if(done||!alive)return;focused=true;e('#focusReticle').style.left=e('#photoSubject').style.left;e('#focusReticle').style.top=e('#photoSubject').style.top;e('#focusReticle').style.opacity=1;status('主体已锁定 · 调焦后拍摄')};
  controls.append(button('按下快门',()=>{
   if(done)return;const shot=level.photos[round],val=+e('#photoFocus').value;
   if(!focused||Math.abs(val-shot.focus)>level.focusTolerance){feedback.textContent='先点击主体锁定，再将焦距调到当前提示范围。';return}
   board.classList.remove('shutter-flash');void board.offsetWidth;board.classList.add('shutter-flash');performanceStage.emit('collect',300,140,shot.art);
   score++;round++;count();if(round===level.photos.length)finish(level.photos.length);else{prepare();feedback.textContent='照片已收入相册 · 捕捉下一个主体';}
  }));prepare();
 }
 const performanceStage=createGamePerformance(board,options.theme||document.body.dataset.theme||'pixel',options.recipe?.item||DEFAULT_RECIPES[id].item);
 function animate(time){if(!alive)return;const dt=document.hidden||!activeWindow?0:Math.min(.05,(time-last)/1000);last=time;t+=dt;performanceStage.tick(dt);if(!done)update(dt);if(e('#skillMarker')&&!done)e('#skillMarker').style.left=((Math.sin(t*2.8-Math.PI/2)+1)/2*100)+'%';if(e('#photoSubject')&&!focused&&!done){const shot=level.photos[round];e('#photoSubject').style.left=(shot.x+Math.sin(t*shot.speed)*12)+'%';e('#photoSubject').style.top=(shot.y+Math.cos(t*shot.speed*.7)*6)+'%'}frame=requestAnimationFrame(animate)}
 frame=requestAnimationFrame(animate);
 function destroy(){replacement?.destroy();alive=false;performanceStage.destroy();cancelAnimationFrame(frame);for(const stop of timers)stop();audio.destroy();}
 const restart=document.createElement('button');restart.className='secondary';restart.textContent='换一局';restart.onclick=()=>{if(!alive)return;destroy();replacement=mountRoomGame(root,id,onFinish,nextGameOptions(options))};root.querySelector('.room-game').append(restart);
 addGameChrome(root,options,mode=>{if(!alive)return;destroy();replacement=mountRoomGame(root,id,onFinish,nextGameOptions(options,mode))});
 const blur=()=>activeWindow=false,focus=()=>{activeWindow=true;last=performance.now()};window.addEventListener('blur',blur);window.addEventListener('focus',focus);timers.push(()=>window.removeEventListener('blur',blur),()=>window.removeEventListener('focus',focus));
 return {destroy,inspect:()=>replacement?replacement.inspect():({id,kind:g.kind,level,t,round,score,errors,done,...detail,performance:performanceStage.inspect()}),config:g};
}
