import {KITCHEN_SCHEMA,neutralKitchen} from './kitchenCutting.js';
import {BRUSH_COLORS,BRUSH_SCHEMA,neutralBrush} from './brushStudio.js';
import {POTTERY_COLORS,potteryShapeReview,potteryGlazeReview,potteryKilnTarget} from './potteryStudio.js';
import {WORKSHOP_GAMES} from './workshopCatalog.js';
import {makeWorkshopLevel,createWorkshopState,workshopAction,stepWorkshop,progressWorkshop,potteryAccuracy,outfitScore,coutureBrief,formatWorkshopTime,photoSubject,interiorReview,anglingEquipment} from './workshopRules.js';
import {makeWorkshopPainter,prepareStage,gridHits,viewBounds,W,H} from './workshopView.js';
import {createWorkshopAudio} from './workshopAudio.js';
import {getSoundUI} from './soundUI.js';
import {INTERIOR_ROLES} from './interiorDesign.js';
import {gameLevelOptions,nextGameOptions,itemName,pieceOffsets} from './gameLevels.js';
import {itemMarkup} from './artStore.js';
import {DEFAULT_RECIPES} from './contentCatalog.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatTime=formatWorkshopTime;
const DIFFICULTIES=['','轻松','标准','挑战'];
const command=(label,type,extra='',cls='')=>'<button type="button" class="wk-control '+cls+'" data-action="'+type+'" '+extra+'>'+label+'</button>';
export function mountWorkshopGame(root,id,onFinish,baseOptions={}){
 const options=gameLevelOptions(id,baseOptions),theme=options.theme||document.body.dataset.theme||'pixel',g=WORKSHOP_GAMES[id],level=options.resumeGame?.engine==='workshop'&&options.resumeGame.state?.level?.id===id?structuredClone(options.resumeGame.state.level):makeWorkshopLevel(id,options.level.seed,options.level.difficulty);
 const s=options.resumeGame?.engine==='workshop'?structuredClone(options.resumeGame.state):createWorkshopState(level,options.equipment),art=id=>itemMarkup(id,theme,'wk-item-art'),recipe=options.recipe||(options.catchItem?{item:options.catchItem,name:itemName(options.catchItem)}:DEFAULT_RECIPES[id]),audio=createWorkshopAudio();
 let alive=true,frame=0,last=performance.now(),replacement=null,paused=false,reported=false,claimed=false,uiAt=-1,uiPhase='',controlsKey='',outcomeShown=false,autoPauseReason='',loaded=false,markMode=false,entryTime=0;
 s.events=[];let transportPaused=false,checkpointPending=false;
 let wardrobeTab=0;
 const embedded=!options.standalone,workbench=options.workbench;
 const cleanup=[];
 cleanup.push(audio.subscribe(()=>ui(true)));

 function production(){
  if(!workbench)return '';
  return '<section class="wk-production" aria-label="本次制作"><div class="wk-production-item">'+art(recipe.item)+'<div><small>'+esc(workbench.station)+'</small><b>'+esc(recipe.name)+'</b></div></div><div class="wk-material-list">'+Object.entries(recipe.cost).map(([id,n])=>'<span class="'+((workbench.stock[id]||0)<n?'is-missing':'')+'">'+art(id)+'<span>'+esc(itemName(id))+' <b>'+n+'</b><small> / 库存 '+(workbench.stock[id]||0)+'</small></span></span>').join('')+'</div><details class="wk-production-info"><summary>用途与结算</summary><div><b>'+esc(recipe.name)+'</b><p>'+esc(workbench.purpose)+'</p><p>'+(workbench.ready?'通关后确认制作，才会消耗上述材料；退出或失败不扣材料。':'当前材料或解锁条件不足。本局为练习，补齐条件后才能制作。')+'</p></div></details>'+command('切换配方','recipe','id="switchRecipe"')+'</section>';
 }
 const toolbar='<div class="wk-toolbar">'+command('声音','sound','aria-label="切换游戏声音"')+command('音量','soundSettings','aria-label="声音设置"')+command('全屏','fullscreen')+command('暂停','pause')+'</div>';
 const difficulty='<div class="wk-difficulty"><span>难度 <b>'+DIFFICULTIES[level.d]+'</b></span><div role="group" aria-label="小游戏难度">'+['auto','1','2','3'].map(mode=>command(mode==='auto'?'自动':DIFFICULTIES[mode],'difficulty','data-mode="'+mode+'" aria-pressed="'+(String(options.mode)===mode)+'"')).join('')+'</div></div>';

 root.innerHTML='<section class="room-game workshop-game '+(embedded?'wk-embedded':'')+'" data-game-id="'+id+'" data-kind="'+g.kind+'" data-theme="'+theme+'">'+
 (embedded?'<div class="wk-production-root">'+production()+'</div><div class="wk-sessionbar">'+difficulty+toolbar+'</div>':'<header class="wk-header"><div><p class="wk-kicker">'+g.kicker+'</p><h3>'+g.title+'</h3></div>'+toolbar+'</header>'+difficulty)+
 '<div class="wk-layout"><div class="wk-play-column"><div class="wk-scoreboard"><div><small>进度</small><b data-stat="progress"></b></div><div><small>剩余时间</small><b data-stat="time"></b></div><div><small>本局得分</small><b data-stat="score">0</b></div><div><small data-stat="extra-label">目标</small><b data-stat="extra"></b></div></div>'+
 '<div class="wk-stage-wrap"><div class="wk-stage" tabindex="0" aria-label="'+g.title+'互动场景"><canvas class="wk-canvas" width="960" height="540" aria-label="'+g.title+'动画场景"></canvas><div class="wk-hit-layer"></div><div class="wk-stage-overlay"></div></div></div>'+
 '<div class="wk-feedback" role="status" aria-live="polite"></div>'+(embedded?'':'<div class="wk-controls"></div>')+'</div>'+
 '<aside class="wk-guide"><div class="wk-mission"><p class="wk-side-kicker">本局委托</p><h4>'+g.objective+'</h4></div><div class="wk-live-objectives"></div>'+(embedded?'<div class="wk-controls"></div>':'')+
 '<details class="wk-instructions"'+(embedded?'':' open')+'><summary>玩法说明</summary><ol>'+g.tips.map(t=>'<li>'+t+'</li>').join('')+'</ol></details>'+
 (embedded?'':'<div class="wk-reward">'+art(recipe.item)+'<div><small>挑战纪录</small><b>'+esc(itemName(recipe.item))+'</b><span>保存最佳评分与星级</span></div></div><p class="wk-save-note">每次开局都会生成新挑战。</p>')+
 '</aside></div><dialog class="wk-session-dialog" aria-labelledby="wk-dialog-title"></dialog></section>';
 const q=sel=>root.querySelector(sel),section=q('.workshop-game'),canvas=q('canvas'),stage=q('.wk-stage'),overlay=q('.wk-stage-overlay'),controls=q('.wk-controls'),hits=q('.wk-hit-layer'),feedback=q('.wk-feedback'),live=q('.wk-live-objectives');
 const dialog=q('.wk-session-dialog');
 const painter=makeWorkshopPainter(canvas,theme,options.avatar,options.catchItem);
 const listen=(el,type,fn,opt)=>{el.addEventListener(type,fn,opt);cleanup.push(()=>el.removeEventListener(type,fn,opt))};
 function transportButtons(){const busy=checkpointPending||transportPaused||claimed;for(const b of root.querySelectorAll('[data-action="claim"],[data-action="restart"],[data-action="difficulty"]')){b.disabled=busy;if(b.dataset.action==='restart'){b.textContent=busy?'正在保存本局…':'新关卡 · 再来一局';b.setAttribute('aria-busy',String(busy));b.title=busy?'本局进度确认后即可开启新关卡':'';}}}

 function send(action){if(!alive||paused)return;options.onGameEvent?.({action});workshopAction(s,action);flushEvents();ui(action.type!=='point');}
 function flushEvents(){for(const e of s.events.splice(0)){painter.event(e);audio.event(e);}}
 function pause(reason=''){
  if(s.phase!=='playing'||paused)return;paused=true;autoPauseReason=reason;s.holding=false;s.keys={};if(s.kind==='brush'&&level.schemaVersion===BRUSH_SCHEMA)neutralBrush(s);if(s.kind==='kitchen')neutralKitchen(s);options.onGameEvent?.({neutral:true});audio.pause();renderOverlay();ui(true);
 }
 function resume(){paused=false;autoPauseReason='';last=performance.now();audio.resume();renderOverlay();ui(true);stage.focus({preventScroll:true});}
 function restart(mode){if(options.onRestart){options.onRestart(mode);return}destroy();replacement=mountWorkshopGame(root,id,onFinish,nextGameOptions(options,mode));}
 function intro(){
  overlay.innerHTML=embedded?'<div class="wk-intro wk-workbench-intro"><div class="wk-intro-copy"><p>工作台已备好 · '+DIFFICULTIES[level.d]+'难度</p><h2>准备好开工了吗？</h2>'+command(loaded?'开始挑战':'布置场景中…','start',loaded?'':'disabled','wk-primary')+'<small>开始后计时，随时可以暂停</small></div></div>':
   '<div class="wk-intro"><div class="wk-intro-copy"><span class="wk-eyebrow">HYPER DIMENSION · ISLAND ARCADE</span><h2>'+g.title+'</h2><p>'+g.objective+'</p><div class="wk-intro-meta"><span>'+DIFFICULTIES[level.d]+'挑战</span><span>'+g.minutes+'</span></div><ol>'+g.tips.map(t=>'<li>'+t+'</li>').join('')+'</ol>'+command(loaded?'开始挑战':'布置场景中…','start',loaded?'':'disabled','wk-primary')+'</div><div class="wk-intro-object">'+art(recipe.item)+'<span>一座小岛，认真做好每一件事</span></div></div>';
 }
 function showDialog(html){overlay.innerHTML='';dialog.innerHTML=html;if(!dialog.open)dialog.showModal();dialog.querySelector('.wk-primary')?.focus({preventScroll:true});}
 function renderOverlay(){
  if(s.phase==='intro'){if(dialog.open)dialog.close();intro();return}
  if(paused){showDialog('<div class="wk-result-card">'+command('×','dismissPause','aria-label="关闭暂停并继续"','wk-dialog-close')+'<p class="wk-eyebrow">工作台 · 暂停</p><h2 id="wk-dialog-title">稍作休息</h2><p>'+(autoPauseReason||'进度与倒计时已暂停。')+'</p>'+command('继续挑战','resume','','wk-primary')+'</div>');return}
  if(s.phase==='result'){
   if(outcomeShown)return;outcomeShown=true;const r=s.result,best=readBest(),craftReady=workbench?.canCraft?workbench.canCraft():workbench?.ready!==false;
   showDialog('<div class="wk-result-card '+(r.passed?'wk-won':'')+'">'+command('×','exit','aria-label="'+(embedded?'关闭结算，返回房间':'关闭结算')+'"','wk-dialog-close')+
    '<p class="wk-eyebrow">'+(r.passed?'晨光岛 · 作业完成':'晨光岛 · 练习手记')+'</p><div class="wk-stars" aria-label="'+r.stars+' 星">'+[1,2,3].map(i=>'<span class="'+(i<=r.stars?'lit':'')+'">✦</span>').join('')+'</div><h2 id="wk-dialog-title">'+(r.passed?['','初露身手','佳作完成','匠心之作'][r.stars]:'再试一局')+'</h2><p>'+(r.passed?'你完成了「'+g.title+'」':'这次尚未完成目标。'+failureHint())+'</p>'+
    (r.passed&&embedded?'<div class="wk-result-product">'+art(recipe.item)+'<div><small>'+(options.catchItem?'本次钓获':craftReady?'本次制作':'本局练习')+'</small><b>'+esc(recipe.name)+'</b><span>'+(options.catchItem?'确认后收取本次钓获。':craftReady?'领取后制作 1 件，材料仅扣除一次。':'材料或解锁条件不足，不扣材料，不发放成品。')+'</span></div></div>':'')+
    '<div class="wk-result-stats"><div><small>得分</small><b>'+r.score+'</b></div><div><small>用时</small><b>'+formatTime(r.seconds)+'</b></div><div><small>历史最佳</small><b>'+best.score+'</b></div></div><div class="wk-result-actions">'+
    (r.passed?command(options.standalone?'保存成绩 · 完成挑战':options.catchItem?'收下钓获':craftReady?'领取制作成果':'完成练习','claim',(checkpointPending||transportPaused||claimed)?'disabled':'','wk-primary'):'')+
    command('新关卡 · 再来一局','restart','','wk-secondary')+'</div><small>'+(r.passed?(options.standalone?'成绩已保存到此浏览器。':options.catchItem?'关闭将放弃本次钓获。':craftReady?'关闭此窗口将返回房间，不扣材料，也不发放成品。':'补齐材料与解锁条件后，再来制作。'):'本次未扣除制作材料。')+'</small></div>');transportButtons();return
  }
  overlay.innerHTML='';if(dialog.open)dialog.close();
 }
 function failureHint(){return ({kitchen:'优先处理快超时的客单，另一口灶可以同时工作。',pottery:'分区上釉要同时满足覆盖和釉色；烧制时提前收火，退火开风门。',rhythm:'跟着底鼓找节拍，长音保持到尾部再松开。',angling:'鱼猛烈挣扎时先松线，平静后再收线。',regatta:'转弯前先减速，最后从泊位左侧低速进入。',fireworks:'在目标附近二次点击引爆，而不是等待烟花落下。',tea:'先记住角落，配对后再整理中间的茶材。',expedition:'先利用预览规划顺路的采集路线。'})[s.kind]||'尝试从约束最多的部分开始，善用撤回和提示。';}
 function bestKey(){return 'hd-workshop-best-v19-'+id+'-'+level.d}
 function readBest(){if(options.readBest)return options.readBest();try{return JSON.parse(localStorage.getItem(bestKey())||'null')||{score:0,stars:0}}catch{return {score:0,stars:0}}}
 function saveBest(){if(!s.result?.passed)return;const old=readBest();const best={score:Math.max(old.score,s.result.score),stars:Math.max(old.stars,s.result.stars),seconds:Math.min(old.seconds||Infinity,s.result.seconds)};if(options.writeBest)options.writeBest(best);else localStorage.setItem(bestKey(),JSON.stringify(best));}
 function setupHits(){
  const v=viewBounds(s,stage.clientWidth<600);stage.style.aspectRatio=v.w+' / '+v.h;stage.style.setProperty('--wk-stage-ratio',v.w/v.h);
  const areas=gridHits(s).map(a=>({...a,x:(a.x-v.x)/v.w*W,y:(a.y-v.y)/v.h*H,w:a.w/v.w*W,h:a.h/v.h*H}));hits.innerHTML=areas.map(a=>'<button type="button" class="wk-hit" data-cell="'+a.index+'" aria-label="'+(Math.floor(a.index/(level.w||level.n||level.cols))+1)+' 行 '+(a.index%(level.w||level.n||level.cols)+1)+' 列" style="left:'+a.x/W*100+'%;top:'+a.y/H*100+'%;width:'+a.w/W*100+'%;height:'+a.h/H*100+'%"></button>').join('');
 }
 function buttonControls(){
  const k=s.kind,l=level;
  if(k==='joinery')return '<div class="wk-piece-tray">'+l.pieces.map((p,i)=>{const pts=pieceOffsets(p,s.selected===i?s.rotation:0),minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0])),maxY=Math.max(...pts.map(p=>p[1]));return command('<svg viewBox="-1 -1 '+(maxX-minX+1.15)+' '+(maxY+1.15)+'" aria-hidden="true">'+pts.map(([x,y])=>'<rect x="'+(x-minX-.94)+'" y="'+(y-.94)+'" width=".88" height=".88" rx=".08"/>').join('')+'</svg><span>零件 '+(i+1)+'</span>','select','data-value="'+i+'" data-piece="'+i+'" aria-pressed="'+(s.selected===i)+'" '+(s.placed.some(p=>p.piece===i)?'disabled':''),'wk-piece');}).join('')+'</div><div class="wk-tools">'+command('旋转 · R','rotate')+command('撤回 · Z','undo')+command('提示 '+s.help+'/2','help',s.help?'':'disabled')+'</div>';
  if(k==='tea')return '<p class="wk-control-note">先观察，再翻牌。相同茶材会自动入盏；每翻两张消耗一次机会。</p>';
  if(k==='nonogram')return command(markMode?'标空模式 ×':'亮星模式 ✦','mark','aria-pressed="'+markMode+'"')+command('提示 '+s.help+'/2','help',s.help?'':'disabled')+'<span class="wk-control-note">右键也可标空；数字顺序对应连续星群。</span>';
  if(k==='pipes')return command(s.running?'水流循环中…':'开启水循环','submit',s.running?'disabled':'','wk-primary')+'<span class="wk-control-note">金色端点不能旋转，橙色亮点是漏口。</span>';
  if(k==='kitchen'){
   const j=s.jobs[s.ticket],active=s.jobs.filter(j=>['available','prep'].includes(j.state)),prepping=j&&['available','prep'].includes(j.state),needed=j?l.orders[j.id].ingredients.length:0,cutReady=prepping&&j.ingredients.length===needed&&j.cuts<needed*2,cookReady=prepping&&j.ingredients.length===needed&&j.cuts>=needed*2&&s.jobs.filter(j=>j.state==='cooking').length<2;
   return '<div class="wk-orders">'+active.map(j=>command('客单 '+(j.id+1)+' · '+l.orders[j.id].ingredients.map(v=>art(l.ids[v])).join(''),'ticket','data-index="'+j.id+'" aria-pressed="'+(s.ticket===j.id)+'"')).join('')+'</div><div class="wk-pantry">'+l.ids.map((v,index)=>command(art(v)+'<span>'+esc(itemName(v))+'</span>','ingredient','data-index="'+index+'" '+(!prepping||j.ingredients.length>=needed?'disabled':''),'wk-ingredient')).join('')+'</div><div class="wk-tools">'+command((l.schemaVersion===KITCHEN_SCHEMA?'切一刀 · 空格 ':'切配 ')+(prepping?j.cuts:0)+'/'+needed*2,'cut',cutReady?'':'disabled')+command('放入空灶','cook',cookReady?'':'disabled','wk-primary')+command('清空备料','clearPrep',prepping&&j.ingredients.length?'':'disabled')+'</div><div class="wk-stoves">'+[0,1].map(station=>{const pot=s.jobs.find(j=>j.state==='cooking'&&j.station===station),ready=pot&&pot.cooked>=pot.cook;return command((station?'右灶':'左灶')+' · '+(ready?'装盘':pot?'烹调中':'空闲'),'serve','data-station="'+station+'" '+(ready?'':'disabled'),ready?'wk-primary':'')}).join('')+'</div>';
  }
  if(k==='couture'){
   const brief=coutureBrief(s);
   return '<div class="wk-wardrobe-tabs" role="group" aria-label="服装分类">'+[0,1,2].map(slot=>command(['主服','配饰','叠搭'][slot]+(s.outfit[slot]?' ✓':''),'wardrobeTab','data-value="'+slot+'" aria-pressed="'+(wardrobeTab===slot)+'"')).join('')+'</div><div class="wk-wardrobe">'+[0,1,2].map(slot=>'<div data-wardrobe-slot="'+slot+'" '+(wardrobeTab===slot?'':'hidden')+'><div>'+l.items.filter(i=>i.slot===slot).map(i=>command(art(i.id)+'<span>'+esc(itemName(i.id))+'</span><small>预算 '+i.cost+' · 风格 '+i.tags[brief.theme]+' · 舒适 '+i.comfort+'</small>','wear','data-item="'+i.id+'" aria-pressed="'+s.outfit.includes(i.id)+'"','wk-garment')).join('')+'</div></div>').join('')+'</div>'+command(s.runway?'评审展映中…':'提交这位顾客的搭配','submit',s.outfit.every(Boolean)&&!s.runway?'':'disabled','wk-primary wk-submit');
  }
  if(k==='beacon')return '<p class="wk-control-note">移动指针保持照明；键盘 ← → 也可转动灯塔。</p>';
  if(k==='rhythm')return '<div class="wk-keys">'+[0,1,2,3].map(lane=>command(['A','S','D','F'][lane],'lane','data-lane="'+lane+'" data-hold="lane"','wk-key')).join('')+'</div>';
  if(k==='photo')return command('− 调焦','focus','data-delta="-2"')+command('+ 调焦','focus','data-delta="2"')+command('快门 · 空格','shutter','','wk-primary')+'<span class="wk-control-note">滚轮细调焦距。重合的对焦环代表清晰，姿态舒展时拍摄。</span>';
  if(['sokoban','expedition'].includes(k))return '<div class="wk-direction-pad">'+[3,0,2,1].map(dir=>command(['↑','→','↓','←'][dir],'move','data-dir="'+dir+'" aria-label="'+['向上','向右','向下','向左'][dir]+'"')).join('')+'</div>'+ (k==='sokoban'?command('撤回 · Z','undo')+command('重置布局 · R','resetBoard'):command('查看地图 '+s.help+'/2','help',s.help?'':'disabled'));
  if(k==='pottery'){
   if(s.mode==='shape')return command('补水润坯','water')+command('检查器型 → 施釉','submit','','wk-primary')+'<p class="wk-control-note">按住坯体边缘，逐段推近虚线。口沿、器足和最差段也要达标。</p>';
   if(s.mode==='glaze')return '<div class="wk-glaze-swatches" role="group" aria-label="陶艺釉色">'+POTTERY_COLORS.map((v,index)=>command('<i style="--glaze-color:'+v.color+'"></i><span>'+v.name+'</span>','glazeColor','data-index="'+index+'" aria-pressed="'+(s.glazeColor===index)+'"')).join('')+'</div>'+command('返回拉坯 · 清理旧釉','rework')+command('检查釉带 → 入窑','submit','','wk-primary')+'<p class="wk-control-note">从口沿向器足，按委托釉带涂刷。刷错可以用正确釉色重新覆盖。</p>';
   if(s.mode==='firing')return '<div class="wk-kiln-controls"><div><b>炉火 '+Math.round(s.kiln.fire*100)+'%</b>'+command('↓ 收火','kilnFire','data-delta="-10"')+command('↑ 添柴','kilnFire','data-delta="10"')+'</div><div><b>风门 '+Math.round(s.kiln.vent*100)+'%</b>'+command('← 关风门','kilnVent','data-delta="-10"')+command('→ 开风门','kilnVent','data-delta="10"')+'</div></div><p class="wk-control-note">↑↓调炉火，←→调风门。窑温有惯性，提前收火；跟随升温、保温、退火曲线。</p>';
   return '<p class="wk-control-note">正在出窑查看釉色与烧制记录，稍候评审。</p>';
  }
  if(k==='angling')return command(s.mode==='cast'?'瞄准鱼影后抛竿':s.mode==='bite'?'立即提竿！':'按住收线 · 松开放线','hold','data-hold="pointer"','wk-primary')+'<span class="wk-control-note">也可在画面按住操作或使用空格。</span>';
  if(k==='mosaic')return command('旋转选中碎片 · R','rotate')+command('查看原作 '+s.help+'/2','help',s.help?'':'disabled');
  if(k==='interior')return '<div class="wk-furniture">'+l.items.map((i,value)=>{const placed=s.furniture.some(f=>f.id===i.id);return command(art(i.id)+'<span>'+esc(itemName(i.id))+'</span><small>'+INTERIOR_ROLES[i.role]+' · '+i.w+'×'+i.h+(i.floor?' · 可铺在家具下':'')+(placed?' · 移位':'')+'</small>',placed?'pickup':'select','data-value="'+value+'" aria-pressed="'+(s.selected===value&&!placed)+'"','wk-room-piece');}).join('')+'</div><div class="wk-tools">'+command('旋转 · R','rotate')+command('撤回 · Z','undo',s.furnitureHistory.length?'':'disabled')+command(s.routeVisible?'收起动线':'查看动线','inspectRoute','aria-pressed="'+s.routeVisible+'"')+'</div>'+command(s.walkthrough?'动线验收中…':'提交房间并验收','submit',s.furniture.length===l.items.length&&!s.walkthrough?'':'disabled','wk-primary')+'<p class="wk-control-note">点已安放的家具可移位；地毯可以铺在坐具下，不阻挡通路。</p>';
  if(k==='fireworks')return command(s.projectile?'空中引爆 · 空格':'按住蓄力 · 松开发射','hold','data-hold="pointer"','wk-primary')+'<span class="wk-control-note">先移动指针瞄准，再长按发射。第二次点击引爆。</span>';
  if(k==='regatta')return command('左转','steer','data-key="left" data-hold="steer"')+command('前进','steer','data-key="forward" data-hold="steer"')+command('右转','steer','data-key="right" data-hold="steer"')+command('减速靠泊 · 空格','brake','data-hold="brake"','wk-primary');
  if(k==='brush')return '<div class="wk-swatches" role="group" aria-label="绘画颜色">'+BRUSH_COLORS.map((v,index)=>command('<i style="background:'+v.color+'"></i>'+v.name,'color','data-index="'+index+'" aria-pressed="'+(s.color===index)+'"')).join('')+'</div><div class="wk-tools">'+command(s.mode==='dipping'?'润笔蘸墨中…':'蘸墨 · 空格','dip',s.mode&&s.mode!=='drawing'?'disabled':'','wk-primary')+(level.schemaVersion===BRUSH_SCHEMA?command('重绘当前笔触','reworkStroke',s.mode==='drawing'&&s.dryRemaining<=0?'':'disabled'):'')+'</div>';
  return '';
 }
 function controlSignature(){
  switch(s.kind){
   case 'joinery':return [s.selected,s.rotation,s.placed.length,s.help].join();
   case 'kitchen':return [s.ticket,...s.jobs.map(j=>[j.state,j.ingredients.length,j.cuts,j.cooked>=j.cook].join())].join();
   case 'couture':return [wardrobeTab,s.clientIndex,!!s.runway,s.outfit.join()].join(':');
   case 'nonogram':return s.help+':'+markMode;
   case 'pottery':return [s.mode,s.glazeColor,s.potteryRevision].join();
   case 'interior':return [s.selected,s.interiorRevision,s.rotation,s.routeVisible,!!s.walkthrough].join();
   case 'angling':return s.mode;
   case 'fireworks':return !!s.projectile;
   case 'brush':return [s.color,s.mode,s.brushRevision].join();
   case 'pipes':return !!s.running;
   default:return s.help;
  }
 }
 function meter(title,value,total,color=''){return '<div class="wk-meter"><div><span>'+title+'</span><b>'+value+' / '+total+'</b></div><progress max="'+total+'" value="'+value+'" '+(color?'style="--meter-color:'+color+'"':'')+'></progress></div>'}
 function objectives(){
  const l=level,k=s.kind;
  if(k==='joinery')return meter('安放零件',s.placed.length,l.pieces.length)+'<p>旋转 '+s.rotation*90+'° · 撤回后可重新安放</p>';
  if(k==='tea')return meter('配对次数剩余',s.turns,l.turns)+'<p>连续配对 '+s.combo+' 次</p>';
  if(k==='nonogram')return '<p>数字表示相连星点的段长；两段之间至少一格空白。答案唯一。</p><p>标空模式不会扣分，可自由修正。</p>';
  if(k==='kitchen'){const j=s.jobs[s.ticket],order=j?l.orders[j.id]:null;return '<p class="wk-control-note">'+(l.schemaVersion===KITCHEN_SCHEMA?'在高亮食材上按住向下切，每份两刀；也可用空格。切配、双灶和客单需要同时照顾。':'两口灶可同时烹调。')+'</p><p class="wk-service-summary">还可失误 '+Math.max(0,s.jobs.length-l.quota-s.failed)+' 单 · 两口灶可同时烹调</p>'+(j&&['prep','available'].includes(j.state)?'<div class="wk-current-order"><strong>当前客单 '+(j.id+1)+'</strong><p>'+order.ingredients.map(i=>itemName(l.ids[i])).join(' + ')+'</p><small>已备：'+(j.ingredients.map(i=>itemName(l.ids[i])).join('、')||'还没有食材')+'</small></div>':'<p>留意双灶火候，等待下一张订单。</p>');}
  if(k==='couture'){
   const brief=coutureBrief(s),r=outfitScore(s.outfit.map(id=>l.items.find(i=>i.id===id)),brief),conditions=[['预算 ≤',r.cost,brief.budget,r.budget],['风格 ≥',r.style,brief.styleGoal,r.styled],['舒适 ≥',r.comfort,brief.comfortGoal,r.comfortable]];
   if(brief.accent)conditions.push([['主服','配饰','叠搭'][brief.accent.slot]+'风格 ≥',r.accentValue,brief.accent.minimum,r.accented]);
   return '<div class="wk-client-heading"><span>顾客 '+Math.min((s.clientIndex||0)+1,l.briefs?.length||1)+' / '+(l.briefs?.length||1)+'</span><strong>'+esc(brief.request||brief.themeName)+'</strong></div><p class="wk-client-quote">'+esc(brief.quote||'在预算内兼顾主题和舒适度。')+'</p><p class="wk-theme-name">'+esc(brief.themeName)+'</p><div class="wk-constraints">'+conditions.map(([name,value,goal,ok])=>'<div class="'+(ok?'is-met':'is-unmet')+'"><span>'+name+'</span><b>'+value+' / '+goal+'</b><i>'+(ok?'✓':'○')+'</i></div>').join('')+'</div><p class="wk-outfit-review" role="status">'+(s.runway?'正在展映与评审 · 操作暂歇':r.complete?'各项达标，可以提交评审。':r.unmet.join(' · '))+'</p><div class="wk-client-reports" aria-label="已完成顾客">'+s.clientReports.map(v=>'<span><b>'+esc(v.request)+'</b><small>'+v.quality+' 分</small></span>').join('')+'</div>';
  }
  if(k==='pipes')return meter('水缸已连接',s.flow.connected,l.tanks.length)+'<p>待修漏口 <b>'+s.flow.leaks.length+'</b> 处</p>';
  if(k==='beacon')return meter('安全入港',s.saved,l.quota)+'<p>每艘船需要连续照明约 '+l.ships[0].need.toFixed(1)+' 秒</p>';
  if(k==='rhythm')return meter('演出体力',Math.max(0,s.health),100)+meter('命中音符',s.hits,l.notes.length)+'<p>最高连击 '+s.bestCombo+' · 漏拍 '+s.misses+'</p>';
  if(k==='photo')return '<p>本张委托：'+['蝶影','海鸟','花开的瞬间'][photoSubject(s).species]+'</p>'+meter('剩余胶片',s.film,l.film)+'<div class="wk-filmstrip">'+s.photos.map(p=>'<span class="'+(p.accepted?'accepted':'')+'">'+p.quality+'<small>'+(p.accepted?'收录':'未收录')+'</small></span>').join('')+'</div>';
  if(k==='sokoban')return meter('苗箱入床',s.crates.filter(i=>l.beds.includes(i)).length,l.beds.length)+'<p>移动 '+s.moves+' 步 · 花床上的星光会亮起。</p>';
  if(k==='pottery'){
   const r=potteryShapeReview(s),g=potteryGlazeReview(s);
   const heading='<div class="wk-pottery-brief"><span>本局器型</span><strong>'+esc(l.formName)+'</strong><small>口沿 → 器足 · '+l.glazeBands+'段釉带</small></div>';
   if(s.mode==='shape')return heading+meter('轮廓吻合度',Math.round(r.accuracy*100),100)+meter('坯体湿润度',Math.round(s.wet*100),100)+'<p class="wk-pottery-check '+(r.complete?'is-met':'')+'">'+(r.complete?'器型达标，可以施釉。':'平均需≥90%；局部偏差≤'+(l.tolerance*1.5)+'；口沿和器足各≤'+l.tolerance)+'</p>';
   const bands='<div class="wk-glaze-bands" aria-label="从口沿到器足的釉色要求">'+g.bands.map(v=>'<div class="'+(v.complete?'is-met':'is-unmet')+'"><i style="--glaze-color:'+POTTERY_COLORS[v.color].color+'"></i><span>第'+(v.band+1)+'釉带 · '+POTTERY_COLORS[v.color].name+'<small>覆盖 '+Math.round(v.coverage*100)+'% · 釉色 '+Math.round(v.purity*100)+'%</small></span><b>'+(v.complete?'✓':'○')+'</b></div>').join('')+'</div>';
   if(s.mode==='glaze')return heading+bands+'<p class="wk-control-note">每带覆盖≥80%，指定釉色≥'+Math.round(l.glazeGoal*100)+'%。</p>';
   const k=s.kiln,t=potteryKilnTarget(l,k.elapsed),fidelity=k.elapsed?k.fidelity/k.elapsed:1;
   return heading+'<p class="wk-kiln-phase"><b>'+esc(s.mode==='reveal'?'出窑评审':t.stage)+'</b><span>'+Math.round(k.elapsed)+' / '+l.kiln.duration+'秒</span></p>'+meter('窑温',Math.round(k.temperature),115)+'<p>目标 '+Math.round(t.temperature)+'% · 容差 ±'+l.kiln.tolerance+'%</p>'+meter('曲线吻合',Math.round(fidelity*100),100)+meter('窑变风险',Math.round(k.damage),100,k.damage>18?'#bd695f':'')+'<p class="wk-control-note">曲线吻合需≥'+Math.round(l.kiln.minimum*100)+'%，风险≤18。窑温为游戏模拟刻度。</p>';
  }
  if(k==='angling')return '<p>'+esc(itemName(anglingEquipment(s).id))+' · '+(anglingEquipment(s).source==='owned'?'自有装备':'公共借用')+' · 控鱼容错 '+anglingEquipment(s).trackingRadius+'</p><p>风向 '+(l.wind<0?'←':'→')+' · 抛竿要留出偏移</p>'+meter('鱼线受力',Math.round(s.tension*100),100,s.tension>.7?'#c16b5d':'')+meter('收线进度',Math.round(s.progress*100),100)+'<p>失手 '+s.escape+' / 5 次</p>';
  if(k==='mosaic')return '<p>先找边缘与连续纹理。挑战难度有 '+l.n*l.n+' 块碎片，每块也需要转正。</p><p>交换与旋转 '+s.moves+' 次</p>';
  if(k==='interior'){
   const r=interiorReview(s),selected=l.items[s.selected];
   return '<div class="wk-client-heading"><span>'+l.layoutName+' · '+l.w+'×'+l.h+'</span><strong>'+esc(l.requestName)+'</strong></div><p class="wk-client-quote">'+esc(l.quote)+'</p><p class="wk-theme-name">'+l.themeName+'</p><div class="wk-room-checks">'+r.checks.map(v=>'<p class="'+(v.ok?'is-met':'is-unmet')+'"><i>'+(v.ok?'✓':'○')+'</i><span>'+esc(v.text)+'</span></p>').join('')+'</div>'+meter('居住条件',Math.round(r.score),100)+'<p class="wk-room-route">'+(r.route.length?'当前门窗动线 '+(r.route.length-1)+' 格 · 基础 '+l.baseRouteLength+' 格':'门到窗暂时不通')+(r.complete?' · 预计品质 '+r.quality:'')+'</p><p class="wk-room-selection">'+(s.walkthrough?'正在沿实际通路检查每件家具':selected?'当前：'+INTERIOR_ROLES[selected.role]+' · '+(s.rotation%2?selected.h:selected.w)+'×'+(s.rotation%2?selected.w:selected.h):'选择家具，再点击地板')+'</p>';
  }
  if(k==='fireworks')return meter('剩余烟花',l.shots-s.shots,l.shots)+meter('当前蓄力',Math.round(s.charge*100),100)+'<p>目标圈越小，需要越准确的角度与引爆时机。</p>';
  if(k==='expedition')return meter('剩余体力',s.stamina,l.budget)+'<p>已找到 '+s.collected.length+' / '+l.targets.length+' 个印记</p><p>阴影遮住未探索的路径。地图预览可以重新查看两次。</p>';
  if(k==='regatta')return meter('船体状态',s.hull,100)+'<p>航速 '+Math.round(s.boat.speed)+' · 入港低于 34</p><p>海流 '+(l.current.x>0?'向右':'向左')+'偏移。最后从左向右驶入泊位。</p>';
  if(k==='brush'){const stroke=l.strokes[s.stroke];return (l.commission?'<div class="wk-brush-brief"><small>今日风物委托</small><strong>'+esc(l.commission)+'</strong><p>'+esc(l.caption)+'</p></div>':'')+meter('笔尖墨量',Math.round(s.ink*100),100)+'<p>当前笔触 '+Math.min(l.strokes.length,s.stroke+1)+' / '+l.strokes.length+'</p>'+(stroke?'<p>'+esc(stroke.name)+' · '+BRUSH_COLORS[stroke.color].name+'</p>':'<p>作品正在装裱与评审</p>')+(l.schemaVersion===BRUSH_SCHEMA?'<p>连续运笔 · '+(s.dryRemaining>0?'色层晾干 '+s.dryRemaining.toFixed(1)+' 秒':s.mode==='dipping'?'润笔蘸墨中':'从光点落笔，松开可断笔续画')+'</p><small>评审达标 ≥ '+l.minQuality+' 分；走偏可重绘当前笔触。</small>':'');}
  return '';
 }
 function ui(force=false){
  if(!alive)return;const phaseKey=s.phase+(s.kind==='couture'?':'+s.clientIndex+':'+!!s.runway:s.kind==='interior'?':'+!!s.walkthrough:s.kind==='pottery'?':'+s.mode:'');if(!force&&s.t-uiAt<.12&&uiPhase===phaseKey)return;uiAt=s.t;uiPhase=phaseKey;
  const [done,total,label]=progressWorkshop(s);q('[data-stat="progress"]').textContent=done+' / '+total;
  q('[data-stat="time"]').textContent=formatTime(s.remaining);q('[data-stat="time"]').classList.toggle('urgent',s.remaining<20);
  q('[data-stat="score"]').textContent=Math.round(s.score);q('[data-stat="extra-label"]').textContent=['rhythm','tea','kitchen'].includes(s.kind)?'连击':'目标';q('[data-stat="extra"]').textContent=['rhythm','tea','kitchen'].includes(s.kind)?s.combo:label;
  feedback.textContent=s.status||g.tips[0];
  live.innerHTML=objectives();const key=controlSignature();if(controlsKey!==key||controls.innerHTML===''){controlsKey=key;const focused=controls.contains(document.activeElement)?{...document.activeElement.dataset}:null;controls.innerHTML=buttonControls();if(focused){[...controls.querySelectorAll('[data-action]')].find(el=>Object.entries(focused).every(([k,v])=>el.dataset[k]===v))?.focus({preventScroll:true});}}
  const inspecting=s.kind==='couture'&&!!s.runway||s.kind==='interior'&&!!s.walkthrough&&!s.walkthrough.done;controls.inert=transportPaused||paused||s.phase!=='playing'||inspecting;hits.inert=transportPaused||paused||s.phase!=='playing'||inspecting;
  q('[data-action="sound"]').textContent=audio.muted?'声音关':'声音开';q('[data-action="sound"]').setAttribute('aria-pressed',String(!audio.muted));
  q('[data-action="pause"]').textContent=paused?'继续':'暂停';q('[data-action="pause"]').disabled=s.phase!=='playing';
  transportButtons();section.dataset.phase=s.phase;section.classList.toggle('is-paused',paused);
  for(const el of hits.children){const i=+el.dataset.cell;let label;
   if(s.kind==='tea')label=s.found.includes(i)?'已配对 '+itemName(level.ids[level.values[i]]):(s.t<level.preview||s.opened.includes(i)?itemName(level.ids[level.values[i]]):'未翻开的茶材 '+(i+1));
   if(s.kind==='nonogram')label='第 '+(Math.floor(i/level.n)+1)+' 行第 '+(i%level.n+1)+' 列，'+(s.cells[i]===1?'亮星':s.cells[i]===-1?'标空':'未标记');
   if(s.kind==='pipes')label=(level.fixed.includes(i)?'固定端点':'旋转管道')+' '+(i+1);
   if(s.kind==='mosaic')label='碎片位置 '+(i+1)+(s.selected===i?'，已选中':'');
   if(s.kind==='interior'){const covered=s.furniture.find(p=>!p.floor&&i%level.w>=p.x&&i%level.w<p.x+p.w&&(i/level.w|0)>=p.y&&(i/level.w|0)<p.y+p.h);label='第 '+(Math.floor(i/level.w)+1)+' 行第 '+(i%level.w+1)+' 列，'+(level.walls.includes(i)?'壁柱':i===level.door?'门口':i===level.window?'窗前':covered?INTERIOR_ROLES[covered.role]+'占地':'可布置地板');}
   if(label)el.setAttribute('aria-label',label);
  }
 }
 setupHits();const observer=new ResizeObserver(()=>{setupHits();ui(true)});observer.observe(stage);cleanup.push(()=>observer.disconnect());renderOverlay();ui(true);
 prepareStage(theme,g.kind).then(()=>{if(!alive)return;loaded=true;controlsKey='';ui(true);if(embedded&&workbench)q('.wk-production-root').innerHTML=production();if(s.phase==='intro')intro()});
 function clickAction(e){
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const type=b.dataset.action;
  if(type==='recipe'){workbench?.onSwitchRecipe?.();return}
  if(type==='wardrobeTab'){wardrobeTab=+b.dataset.value;ui(true);return}
  if(type==='exit'){destroy();if(options.onExit)options.onExit();else root.replaceChildren();return}
  if(type==='start'){audio.unlock();entryTime=performance.now();send({type:'start'});renderOverlay();stage.focus({preventScroll:true});return}
  if(type==='soundSettings'){getSoundUI().open();return}
  if(type==='sound'){audio.toggle();ui(true);return}
  if(type==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else section.requestFullscreen?.().catch(()=>{});return}
  if(type==='pause'){paused?resume():pause();return}
  if(type==='resume'||type==='dismissPause'){resume();return}
  if(type==='difficulty'){restart(b.dataset.mode);return}
  if(type==='restart'){restart(options.mode);return}
  if(type==='claim'){
   if(transportPaused)return;
   if(claimed||!s.result?.passed||s.phase!=='result')return;claimed=true;b.disabled=true;const result={...s.result};
   // Keep the result and its retry button until the controller accepts completion.
   // A concurrent save may reject a claim before it has sent any transaction.
   Promise.resolve().then(()=>onFinish(result)).then(accepted=>{
    if(accepted!==false){destroy();return}
    if(alive){claimed=false;b.disabled=transportPaused;feedback.textContent='进度尚在核对，请稍后再次确认完成。';}
   }).catch(()=>{if(alive){claimed=false;b.disabled=transportPaused;feedback.textContent='这次提交未完成，请重试；当前结果已保留。';}});return
  }
  if(type==='mark'){markMode=!markMode;ui(true);return}
  if(b.dataset.hold)return;
  const a={type};for(const key of ['value','index','station','delta','dir','lane'])if(b.dataset[key]!==undefined)a[key]=+b.dataset[key];if(b.dataset.item)a.item=b.dataset.item;
  send(a);
 }
 listen(root,'click',clickAction);
 listen(dialog,'cancel',e=>{e.preventDefault();if(paused)resume();else if(s.phase==='result'){destroy();if(options.onExit)options.onExit();else root.replaceChildren();}});
 const pos=e=>{const r=canvas.getBoundingClientRect(),v=viewBounds(s,r.width<600);return {x:v.x+(e.clientX-r.left)/r.width*v.w,y:v.y+(e.clientY-r.top)/r.height*v.h}};
 listen(stage,'pointermove',e=>{if(e.target.closest('.wk-stage-overlay'))return;const p=pos(e);send({type:'point',...p})});
 listen(hits,'click',e=>{const b=e.target.closest('[data-cell]');if(!b)return;const i=+b.dataset.cell;if(['sokoban','expedition'].includes(s.kind)){const dx=i%level.w-s.player%level.w,dy=Math.floor(i/level.w)-Math.floor(s.player/level.w);if(Math.abs(dx)+Math.abs(dy)===1)send({type:'move',dir:dy<0?0:dx>0?1:dy>0?2:3});}else send({type:'cell',index:i,mark:markMode})});
 listen(hits,'focusin',e=>{const i=+e.target.dataset.cell,a=gridHits(s)[i];if(a)send({type:'point',x:a.x+a.w/2,y:a.y+a.h/2})});
 listen(stage,'contextmenu',e=>{e.preventDefault();const b=e.target.closest('[data-cell]');if(s.kind==='nonogram'&&b)send({type:'cell',index:+b.dataset.cell,mark:true});else if(['joinery','mosaic','interior'].includes(s.kind))send({type:'rotate'})});
 const held=new Map();
 listen(root,'pointerdown',e=>{
  if(s.phase!=='playing'||paused)return;
  const b=e.target.closest('[data-hold]');if(b){e.preventDefault();audio.unlock();const action=b.dataset.hold;held.set(e.pointerId,{action,lane:+b.dataset.lane,key:b.dataset.key});try{b.setPointerCapture?.(e.pointerId)}catch{}
   if(action==='lane')send({type:'lane',lane:+b.dataset.lane});if(action==='pointer')send({type:'down',...s.pointer});if(action==='brake')send({type:'brake',down:true});if(action==='steer')send({type:'steer',key:b.dataset.key,down:true});return}
  if(e.target===canvas||e.target===stage){e.preventDefault();stage.focus({preventScroll:true});try{stage.setPointerCapture(e.pointerId)}catch{}const p=pos(e);send({type:'point',...p});send({type:'down',...p});held.set(e.pointerId,{action:'pointer'});}
 });
 const release=e=>{const h=held.get(e.pointerId);if(!h)return;held.delete(e.pointerId);if(h.action==='lane')send({type:'releaseLane',lane:h.lane});if(h.action==='pointer')send({type:'up'});if(h.action==='brake')send({type:'brake',down:false});if(h.action==='steer')send({type:'steer',key:h.key,down:false});};
 listen(window,'pointerup',release);listen(window,'pointercancel',release);
 listen(stage,'wheel',e=>{if(s.kind==='photo'&&s.phase==='playing'){e.preventDefault();send({type:'focus',delta:e.deltaY>0?-1:1})}},{passive:false});
 const keyAction=(e,down)=>{
  if(!alive||!root.isConnected||e.target.closest?.('.sound-sheet')||e.target.closest?.('input,select,textarea,[contenteditable="true"]'))return;
  if(dialog.open&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(down){if(paused)resume();else if(s.phase==='result'){destroy();if(options.onExit)options.onExit();else root.replaceChildren();}}return;}
  if(e.code==='Escape'&&s.phase==='playing'){e.preventDefault();e.stopImmediatePropagation();if(down){paused?resume():pause()}return}
  if(e.code==='KeyP'&&down&&s.phase==='playing'){paused?resume():pause();return}
  if(s.phase!=='playing'||paused||e.altKey||e.ctrlKey||e.metaKey)return;
  const lanes=['KeyA','KeyS','KeyD','KeyF'],arrows=['ArrowUp','ArrowRight','ArrowDown','ArrowLeft'];let used=true;
  if(s.kind==='rhythm'&&lanes.includes(e.code)){if(!e.repeat)send({type:down?'lane':'releaseLane',lane:lanes.indexOf(e.code)});}
  else if(['sokoban','expedition'].includes(s.kind)&&arrows.includes(e.code)){if(down)send({type:'move',dir:arrows.indexOf(e.code)});}
  else if(s.kind==='pottery'&&s.mode==='firing'&&arrows.includes(e.code)){if(down)send({type:['ArrowUp','ArrowDown'].includes(e.code)?'kilnFire':'kilnVent',delta:['ArrowUp','ArrowRight'].includes(e.code)?10:-10});}
  else if(['regatta','beacon'].includes(s.kind)&&['ArrowLeft','ArrowRight','ArrowUp'].includes(e.code))send({type:'steer',key:e.code==='ArrowLeft'?'left':e.code==='ArrowRight'?'right':'forward',down});
  else if(e.code==='Space'){
   if(s.kind==='kitchen'&&down&&!e.repeat)send({type:'cut'});
    else if(s.kind==='photo'&&down&&!e.repeat)send({type:'shutter'});
   else if(s.kind==='regatta')send({type:'brake',down});
   else if(s.kind==='brush'&&down&&!e.repeat)send({type:'dip'});
   else if(['angling','fireworks'].includes(s.kind)&&!e.repeat)send(down?{type:'down',...s.pointer}:{type:'up'});
   else used=false;
  }else if(down&&!e.repeat&&e.code==='KeyR'&&['joinery','mosaic','interior','sokoban'].includes(s.kind))send({type:s.kind==='sokoban'?'resetBoard':'rotate'});
  else if(down&&!e.repeat&&e.code==='KeyZ'&&['joinery','sokoban','interior'].includes(s.kind))send({type:'undo'});
  else used=false;
  if(used){e.preventDefault();e.stopImmediatePropagation();}
 };
 listen(window,'keydown',e=>keyAction(e,true),true);listen(window,'keyup',e=>keyAction(e,false),true);
 listen(window,'hd-sound-settings',()=>pause('正在调整全岛声音，关卡和材料为你保留。'));
 listen(window,'blur',()=>pause('窗口已切换，倒计时与动作已暂停。'));
 listen(document,'visibilitychange',()=>{if(document.hidden)pause('画面已隐藏，进度为你保留。')});
 function tick(now){
  if(!alive||!root.isConnected)return;const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(loaded&&!paused&&!transportPaused){if(['playing','celebrating'].includes(s.phase))options.onGameEvent?.({dt});stepWorkshop(s,dt);flushEvents();audio.tick(s);}
  painter.render(s,now);ui();
  if(s.result&&!reported){reported=true;saveBest();options.onOutcome?.({...s.result});}
  if(s.phase==='result'&&!outcomeShown)renderOverlay();
  frame=requestAnimationFrame(tick);
 }
 frame=requestAnimationFrame(tick);
 function destroy(){if(!alive){replacement?.destroy();return}alive=false;if(dialog.open)dialog.close();cancelAnimationFrame(frame);cleanup.forEach(fn=>fn());audio.destroy();painter.destroy();held.clear();if(document.fullscreenElement===section)document.exitFullscreen().catch(()=>{});}
 return {destroy,setCheckpointPending(value){checkpointPending=value;transportButtons()},setTransportPaused(value){transportPaused=value;last=performance.now();ui(true);transportButtons()},config:g,inspect(){if(replacement)return replacement.inspect();const data=structuredClone(s);delete data.events;return {...data,premium:true,paused,alive,claimed,reported,loaded,activeMillis:performance.now()-entryTime}},get level(){return replacement?.level||level}};
}
