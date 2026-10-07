import {drawFunctionalFacility} from './functionalArt.js';
import {FACILITY_ART_FRAMES} from './facilityArtFrames.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {itemMarkup} from './artStore.js';
import {cropInfo} from './farming.js';
import {hydrateFunctionalFacilities,functionalCommand,functionalView,protectedPlot,irrigationConnected} from './functionalFacilities.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phaseName={idle:'待机',growing:'育养',brewing:'温茶',ready:'完成',watering:'滴灌'};
export function createFunctionalUI(api){
 let showing=null,clock=0,clearing=false,executing=false,visualElapsed=0,visualStamp=null;
 const state=()=>api.state(),root=()=>document.getElementById('modalRoot');
 const materials=(cost)=>Object.entries(cost).map(([id,n])=>'<span>'+itemMarkup(id,api.theme())+esc(ITEM_BY_ID[id]?.name||id)+' ×'+n+'</span>').join('');
 async function execute(id,action,extra={}){
  if(executing)return;executing=true;const page=root()?.querySelector('.modal'),input={displayId:id,expectedRevision:state().functionalFacilities.revision,...extra};page?.querySelectorAll('.modal-body button,.modal-footer button').forEach(b=>b.disabled=true);
  try{const r=api.command?(await api.command(action,input)).receipt.details:functionalCommand(state(),{commandId:crypto.randomUUID(),action,...input},api.hooks?.()||{});if(r.ok){api.event?.(r.text);api.persist();}api.toast(r.text||r.reason);if(page?.isConnected)open(id);return r;}catch(e){api.toast(e.message);if(page?.isConnected)open(id);}finally{executing=false;refresh();}
 }
 function open(id){
  hydrateFunctionalFacilities(state());const v=functionalView(state(),id);if(!v)return api.book();showing=id;clearing=false;const {unit:u,definition:d}=v;
  const row=['irrigation','nursery','tea'].indexOf(d.kind),stage=u.phase,ready=stage==='ready';
  const uses=d.kind==='nursery'?'<div class="functional-chain"><b>水族馆</b><span>海藻饲料 + 海虾</span><i>→</i><b>育养盒 · 4 分钟</b><i>→</i><span>海虾 ×3</span><i>→</i><b>食堂餐食 / 渔具鱼饵</b></div>':d.kind==='tea'?'<div class="functional-chain"><b>茶屋花茶 ×3</b><i>+</i><b>林地木材 ×1</b><i>→</i><span>茶炉温茶 · 12 秒</span><i>→</i><b>居民饮用三杯</b></div>':'<div class="functional-chain"><b>水族馆过滤器</b><i>→</i><span>八次田间灌溉</span><i>→</i><b>农作原料 → 各馆制作</b></div>';
  const configuration=d.kind==='irrigation'?'<section class="functional-config"><h3>连接田地 · 至多四块</h3><p>'+(!irrigationConnected(state(),id)?'当前离农田太远，请关闭后把设施移到农田周边。':'已接入农田供水范围。')+'新手首次收获前的第一块田及岛主正在亲自照料的田会跳过。</p><div class="functional-plots">'+state().plots.map((p,i)=>'<label><input type="checkbox" data-functional-plot="'+i+'" '+(u.targets.includes(i)?'checked':'')+' '+(protectedPlot(state(),i)?'disabled':'')+'><span><b>田垄 '+(i+1)+'</b><small>'+esc(cropInfo(p).name)+' · '+['未松土','已松土','待浇水','生长中','成熟'][p.stage]+(protectedPlot(state(),i)?' · 岛主照料':'')+'</small></span></label>').join('')+'</div><label class="functional-switch"><input type="checkbox" id="functionalEnabled" '+(u.enabled?'checked':'')+'> 开启自动滴灌</label><button class="secondary" id="functionalConfigure">保存连接与开关</button></section>':'';
  const cost=materials(d.cost),available=Object.entries(v.missing).length?'缺少 '+Object.entries(v.missing).map(([id,n])=>(ITEM_BY_ID[id]?.name||id)+' ×'+n).join('、'):'物资已备齐';
  const controls='<button class="secondary" id="functionalBack">返回布置册</button><button class="secondary" id="functionalClear">停用并清空余料</button>'+(d.kind==='nursery'&&ready?'<button class="primary" id="functionalHarvest">收取海虾 ×3</button>':['growing','brewing'].includes(stage)?'<button class="primary" id="functionalPause">'+(u.enabled?'暂停生产':'继续生产')+'</button>':'<button class="primary" id="functionalLoad" '+(!v.canLoad?'disabled':'')+'>'+(d.kind==='irrigation'?'安装过滤器':'投入一批物资')+'</button>');
  api.openModal(d.name+' · '+d.tag,'一件手作，在岛上开始真正工作。',
   '<section class="functional-hero" data-functional-id="'+id+'"><div class="functional-diorama" data-kind="'+d.kind+'" data-active="'+String(u.enabled&&(stage!=='idle'||u.charges>0))+'"><div class="functional-sprite"><canvas id="functionalCanvas" width="330" height="440" aria-label="'+esc(d.name)+'实际运行画面"></canvas></div><div class="functional-motes"><i></i><i></i><i></i><i></i></div><span>'+esc(d.tag)+'</span></div><article><small>ISLAND / WORKING HANDCRAFT</small><h3>'+esc(d.name)+'</h3><p>'+esc(d.description)+'</p><div class="functional-state" id="functionalState" role="status">'+esc(v.status)+'</div><div class="functional-progress" role="progressbar" aria-label="设施进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(v.progress*100)+'"><i style="width:'+v.progress*100+'%"></i></div><div id="functionalNumbers" class="functional-numbers"></div></article></section>'+uses+configuration+
   '<section class="functional-inputs"><h3>下一批投入</h3><div>'+cost+'</div><p id="functionalMissing">'+esc(available)+'。使用可用库存，筹备预留不受影响。</p></section>'+
   '<section class="functional-maintenance"><article><h3>清洁与寿命</h3><p>每批育养耗损 8%，温茶耗损 3%，每次滴灌耗损 1%。不足 8% 时需清洁再投料。海藻 ×1 + 细沙 ×1 可恢复设备状态。</p></article><button class="secondary" id="functionalClean" '+(u.condition===100||['growing','brewing','watering'].includes(stage)?'disabled':'')+'>清洁设施</button></section>'+
   '<p class="functional-note">只推进有效游戏时间，离线不补产。设施产出不会伪装为岛主亲手制作或发放额外岛币。暂停保留进度；移动保留内部物资；收回前必须处理在制品和余料。</p><p id="functionalClearWarning" class="functional-clear-warning hidden">清空会丢弃当前这一批在制品、待收产物与剩余消耗品，不返还投料。再次点击确认清空；设施本体不会消失。</p>',controls);
  root().querySelector('.modal').classList.add('functional-modal');
  root().querySelector('#functionalBack').onclick=api.book;
  root().querySelector('#functionalLoad')?.addEventListener('click',()=>execute(id,'load'));
  root().querySelector('#functionalHarvest')?.addEventListener('click',()=>execute(id,'harvest'));
  root().querySelector('#functionalPause')?.addEventListener('click',()=>execute(id,u.enabled?'pause':'resume'));
  root().querySelector('#functionalClean').onclick=()=>execute(id,'clean');
  root().querySelector('#functionalConfigure')?.addEventListener('click',()=>execute(id,'configure',{targets:[...root().querySelectorAll('[data-functional-plot]:checked')].map(e=>Number(e.dataset.functionalPlot)),enabled:root().querySelector('#functionalEnabled').checked}));
  root().querySelector('#functionalClear').onclick=e=>{if(!clearing){clearing=true;root().querySelector('#functionalClearWarning').classList.remove('hidden');e.currentTarget.textContent='确认丢弃余料并停用';return;}execute(id,'clear');};
  refresh();
 }
 function refresh(){
  const el=root()?.querySelector('[data-functional-id]');if(!el||el.dataset.functionalId!==showing)return;
  const v=functionalView(state(),showing);if(!v){api.book();return;}const {unit:u,definition:d}=v;
  el.querySelector('#functionalState').textContent=v.status;
  const canvas=el.querySelector('#functionalCanvas'),ctx=canvas.getContext('2d'),p=state().placedItems.find(p=>p.id===showing),box=canvas.getBoundingClientRect(),density=Math.min(2,window.devicePixelRatio||1),width=Math.round(box.width*density),height=Math.round(box.height*density);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}ctx.clearRect(0,0,width,height);ctx.save();ctx.scale(density,density);const frame=FACILITY_ART_FRAMES[api.theme()].rows[['irrigation','nursery','tea'].indexOf(d.kind)][p.rotation],worldWidth=d.shape.h*frame.w/frame.h,scale=Math.min(6,(box.width-16)/worldWidth,(box.height-24)/(d.shape.h+21));ctx.translate(box.width/2,(box.height+(d.shape.h+15)*scale)/2);ctx.scale(scale,scale);drawFunctionalFacility(ctx,{...p,x:0,y:0},api.theme(),{s:state(),now:performance.now()/1000});ctx.restore();
  if(state().facilityControl&&u.enabled&&['growing','brewing','watering'].includes(u.phase)){v.progress=Math.min(.999,(u.elapsed+visualElapsed)/d.seconds);v.remaining=Math.max(0,d.seconds-u.elapsed-visualElapsed);}
  const progress=el.querySelector('.functional-progress');progress.setAttribute('aria-valuenow',Math.round(v.progress*100));progress.firstElementChild.style.width=v.progress*100+'%';
  el.querySelector('#functionalNumbers').innerHTML='<span>设备状态 <b>'+u.condition+'%</b></span><span>已交付 <b>'+u.delivered+(d.kind==='irrigation'?' 次':d.kind==='nursery'?' 只':' 杯')+'</b></span><span>'+(d.kind==='irrigation'?'余量 <b>'+u.charges+' / 8 次</b>':d.kind==='tea'&&u.servings?'待客 <b>'+u.servings+' / 3 杯</b>':'余时 <b>'+Math.ceil(v.remaining)+' 秒</b>')+'</span>';
  el.querySelector('.functional-diorama').dataset.active=String(u.enabled&&(u.phase!=='idle'||u.charges>0));
  const load=root().querySelector('#functionalLoad');if(load)load.disabled=!v.canLoad;
  const clean=root().querySelector('#functionalClean');if(clean)clean.disabled=u.condition===100||['growing','brewing','watering'].includes(u.phase);
  const occupied=(state().npcPresence||[]).some(n=>n.facilityId===showing),clear=root().querySelector('#functionalClear');if(clear){clear.disabled=occupied;clear.title=occupied?'居民正在用茶，请等使用结束再清空':'';}
  if(d.kind!=='irrigation'&&el.dataset.phase&&el.dataset.phase!==u.phase){open(showing);return;}el.dataset.phase=u.phase;
 }
 function tick(dt){const u=state().functionalFacilities?.units?.[showing],stamp=u?JSON.stringify([u.phase,u.elapsed,u.enabled,u.serverFarmRequestId,state().facilityControl?.activeSeconds]):null;if(stamp!==visualStamp){visualStamp=stamp;visualElapsed=0;}else if(u?.enabled&&['growing','brewing','watering'].includes(u.phase))visualElapsed+=dt;clock+=dt;if(clock>.06){clock=0;refresh();}}
 return {open,tick,inspect:()=>showing?functionalView(state(),showing):null};
}
