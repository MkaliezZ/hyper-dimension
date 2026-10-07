import {functionalDefinition} from './facilityCatalog.js';
import {functionalView} from './functionalFacilities.js';
import {ITEM_BY_ID} from './contentCatalog.js';
import {availableQuantity} from './resourceLedger.js';
import {BUILDINGS,worldSlots} from './world.js';
import {itemMarkup} from './artStore.js';
import {canPlaceItem,hydratePlacements,checkDecoration,decorate,snapDisplay,PLACEMENT_LIMIT} from './placements.js';
import {drawDecoration} from './placementArt.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const orientations=['朝前','朝右','朝后','朝左'];
export function createPlacementUI(api){
 let draft=null,legal={ok:false},timer=null,painted='',panel=null,clock=0,submitting=false;
 const root=()=>document.getElementById('modalRoot'),s=()=>api.state(),theme=()=>api.theme();
 function cancel(notify=true){if(submitting&&notify){api.toast('正在确认布置，请等操作回执');return;}clearTimeout(timer);draft=null;panel?.remove();panel=null;painted='';document.body.classList.remove('decorating');if(notify)api.toast('已取消布置，背包与原摆件保持不变');}
 function inventory(search=''){
  hydratePlacements(s(),theme());const rows=Object.values(ITEM_BY_ID).filter(i=>canPlaceItem(i.id)&&availableQuantity(s(),i.id)>0&&i.name.includes(search)),placed=s().placedItems;
  api.openModal('岛屿布置册','把手作留在岛上，让路过的人看见你的心意。',
   '<section class="placement-intro"><span>ISLAND ATELIER</span><h3>给每一件手作，找一个好位置。</h3><p>空位预览 · 四向展架 · 移动与收回。入口、广场中心和栈桥保留通路；同馆品质按最高陈列计算。</p><b>岛上陈列 '+placed.length+' / '+PLACEMENT_LIMIT+'</b></section><h3>背包里可以布置的手作</h3><label class="placement-search">寻找物品<input id="placementSearch" maxlength="60" value="'+esc(search)+'" placeholder="输入物品名称"/></label><div class="placement-catalog">'+(rows.length?rows.map(i=>'<button class="placement-card" data-place-item="'+i.id+'">'+itemMarkup(i.id,theme())+'<span><b>'+esc(i.name)+'</b><small>'+esc(BUILDINGS[i.building].name)+' · 可用 '+availableQuantity(s(),i.id)+' 份</small><em>选择位置 →</em></span></button>').join(''):'<p class="hint">先亲手制作一件摆设、藏品或组件，再回来布置。预留给筹备的物资不会出现在这里。</p>')+'</div><h3>已经留在岛上的手作</h3><div class="placement-catalog">'+(placed.length?placed.map(p=>'<button class="placement-card" data-place-display="'+p.id+'">'+itemMarkup(p.item,theme())+'<span><b>'+esc(ITEM_BY_ID[p.item].name)+'</b><small>'+orientations[p.rotation]+' · '+p.x+' / '+p.y+'</small><em>移动 · 旋转 · 收回 →</em></span></button>').join(''):'<p class="hint">岛上的第一件布置，会从你的第一份手作开始。</p>')+'</div>',
   '<button class="secondary" id="placementBackBag">返回背包</button>');
  root().querySelector('.modal').classList.add('placement-modal');
  root().querySelector('#placementSearch').onchange=e=>inventory(e.target.value);
  root().querySelector('#placementBackBag').onclick=api.bag;
  root().querySelectorAll('[data-place-item]').forEach(b=>b.onclick=()=>start(b.dataset.placeItem));
  root().querySelectorAll('[data-place-display]').forEach(b=>b.onclick=()=>card(b.dataset.placeDisplay));
 }
 function card(id){
  const p=s().placedItems.find(p=>p.id===id);if(!p)return inventory();const i=ITEM_BY_ID[p.item];
  api.openModal(i.name+' · 岛上陈列','这件手作有自己的位置，也可以随你的经营重新安排。',
   '<div class="placement-detail">'+itemMarkup(i.id,theme())+'<article><h3>'+esc(i.name)+'</h3><p>'+esc(BUILDINGS[p.building].name)+'的手作 · '+orientations[p.rotation]+'</p><p>移动和旋转不消耗物品；功能设施请先处理在制品和余料，再收回。收回完整返还设施本体，亲手制作记录一并保留。同馆摆件品质只取最高值。</p></article></div>',
   (functionalDefinition(i.id)?'<button class="primary" id="placementFunctional">管理功能设施</button>':'')+'<button class="secondary" id="placementBookBack">布置册</button><button class="secondary" id="placementStore">收回背包</button><button class="primary" id="placementMove">重新安排位置</button>');
  root().querySelector('#placementFunctional')?.addEventListener('click',()=>api.functional(p.id));
  root().querySelector('#placementBookBack').onclick=()=>inventory();root().querySelector('#placementMove').onclick=()=>start(p.item,p.id);
  root().querySelector('#placementStore').onclick=async e=>{if(submitting)return;submitting=true;e.currentTarget.disabled=true;const page=root().querySelector('.modal');try{const args={displayId:p.id,expectedRevision:s().placementBook.revision},r=api.command?(await api.command('store',args)).receipt.details:decorate(s(),{commandId:crypto.randomUUID(),action:'store',...args},{theme:theme()});if(r.ok){api.event?.(r.text);api.persist();if(page?.isConnected)inventory();}api.toast(r.text||r.reason);}catch(e){api.toast(e.message);if(page?.isConnected)card(p.id);}finally{submitting=false;}};
 }
 function start(item,id=null){
  cancel(false);api.closeModal();api.goWorld();hydratePlacements(s(),theme());
  const old=s().placedItems.find(p=>p.id===id),slot=worldSlots(theme()).find(p=>p.id===ITEM_BY_ID[item].building);
  let position=old?{x:old.x,y:old.y}:{x:800,y:560};
  if(!old)outer:for(let radius=48;radius<=192;radius+=24)for(let i=0;i<16;i++){
   const p={item,...snapDisplay(slot.entry.x+Math.cos(i*Math.PI/8)*radius,slot.entry.y+Math.sin(i*Math.PI/8)*radius),rotation:0};
   if(checkDecoration(s(),p,{theme:theme(),actors:api.actors(),connectivity:false}).ok){position=p;break outer;}
  }
  draft={item,id,x:position.x,y:position.y,rotation:old?.rotation||0,revision:s().placementBook.revision};
  document.body.classList.add('decorating');panel=document.createElement('section');panel.id='placementToolbar';panel.className='placement-toolbar';panel.setAttribute('aria-label','布置预览操作');document.body.append(panel);validate();api.toast('移动鼠标预览，点击选位置；R 旋转，Esc 取消。');
 }
 function validate(){
  if(!draft)return;clearTimeout(timer);legal=checkDecoration(s(),draft,{theme:theme(),except:draft.id,actors:api.actors(),connectivity:false});paint();
  if(legal.ok){const signature=JSON.stringify(draft);timer=setTimeout(()=>{if(draft&&JSON.stringify(draft)===signature){legal=checkDecoration(s(),draft,{theme:theme(),except:draft.id,actors:api.actors()});paint();}},130);}
 }
 function hover(p){if(!draft)return false;if(submitting)return true;const next=snapDisplay(p.x,p.y);if(next.x!==draft.x||next.y!==draft.y){Object.assign(draft,next);validate();}return true;}
 function rotate(){if(!draft||submitting)return;draft.rotation=(draft.rotation+1)%4;validate();}
 async function confirm(){
  if(!draft||submitting)return;const preview=draft,args={displayId:draft.id,item:draft.item,x:draft.x,y:draft.y,rotation:draft.rotation,expectedRevision:draft.revision},action=draft.id?'move':'place';submitting=true;paint();
  try{const r=api.command?(await api.command(action,args)).receipt.details:decorate(s(),{commandId:crypto.randomUUID(),action,...args},{theme:theme(),actors:api.actors()});if(r.ok){if(draft===preview)cancel(false);api.event?.(r.text);api.persist();api.toast(r.text);}else{if(draft===preview)legal=r;api.toast(r.reason);}}catch(e){api.toast(e.message);if(draft===preview){draft.revision=s().placementBook.revision;legal={ok:false,reason:e.message};}}finally{submitting=false;paint();}
 }
 function paint(){
  if(!draft||!panel)return;const signature=JSON.stringify([draft,legal,submitting]);if(signature===painted)return;painted=signature;
  panel.dataset.valid=String(legal.ok);panel.innerHTML='<div class="placement-tool-copy">'+itemMarkup(draft.item,theme())+'<div><small>ISLAND ATELIER / '+(draft.id?'移动陈列':'布置手作')+'</small><b>'+esc(ITEM_BY_ID[draft.item].name)+'</b><span id="placementStatus" role="status">'+esc(legal.ok?'空位合适 · '+orientations[draft.rotation]+' · '+draft.x+' / '+draft.y:legal.reason)+'</span></div></div><div class="placement-tool-actions"><button class="secondary" id="placementCancel">取消</button><button class="secondary" id="placementRotate">旋转 · R</button><button class="primary" id="placementConfirm" '+(!legal.ok||submitting?'disabled':'')+'>'+(submitting?'正在确认…':draft.id?'确认移动':'确认布置')+'</button></div>';
  panel.querySelector('#placementCancel').onclick=()=>cancel();panel.querySelector('#placementRotate').onclick=rotate;panel.querySelector('#placementConfirm').onclick=confirm;
 }
 function key(e){
  if(!draft)return false;if(e.key==='Escape'){cancel();return true;}
  if(e.key.toLowerCase()==='r'){rotate();return true;}
  const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(d){hover({x:draft.x+d[0]*(e.shiftKey?24:8),y:draft.y+d[1]*(e.shiftKey?24:8)});return true;}return false;
 }
 function tick(dt){if(!draft)return;clock+=dt;if(clock>=.6){clock=0;const live=checkDecoration(s(),draft,{theme:theme(),except:draft.id,actors:api.actors(),connectivity:false});if(!live.ok||!legal.ok){legal=live;paint();}}}
 function draw(ctx){if(draft)drawDecoration(ctx,draft,theme(),{ghost:true,ok:legal.ok});}
 return {inventory,card,start,hover,rotate,confirm,cancel,key,draw,tick,active:()=>!!draft,inspect:()=>draft?{...draft,legal}:null};
}
