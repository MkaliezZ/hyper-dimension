import {BUILDINGS} from './world.js';
import {ALL_RECIPES} from './contentCatalog.js';
import {shopListing,shopSummary,shopItemOffer} from './shopfronts.js';
import {availableQuantity,reservedQuantity} from './resourceLedger.js';
import {visitorPrice,operatingCost,VENUE_SERVICES} from './economy.js';
import {itemMarkup} from './artStore.js';
export function createShopfrontUI({state,theme,openModal,command,toast,back,detail}){
 let busy=false;
 const root=()=>document.querySelector('#modalRoot');
 const icon=id=>itemMarkup(id,theme(),'shelf-icon');
 function open(id=null){
  if(busy)return;
  if(id===null){
   openModal('岛屿商铺货架','把手作品变成收入，也给下一道工序留下材料',
    '<section class="shopfront-intro"><h3>由你决定卖什么、留下多少。</h3><p>游客按喜好和预算到店。每次实际购买一份，扣除 30% 运营费；未卖出的物品仍在背包，可继续制作或用于派对。</p></section><div class="shopfront-grid">'+BUILDINGS.map(b=>{const v=shopSummary(state(),b.id),r=ALL_RECIPES.find(r=>r.building===b.id);return '<button class="shopfront-venue secondary" data-shelf="'+b.id+'">'+icon(r.item)+'<span><b>'+b.name+'</b><small>'+v.mode+' · 可售 '+v.stock+' 份</small><small>陈列 '+v.listed+' / 12 种</small></span></button>';}).join('')+'</div>',
    '<button class="secondary" id="shelvesBack">返回经营手账</button>');
   root().querySelector('#shelvesBack').onclick=back;
   root().querySelectorAll('[data-shelf]').forEach(el=>el.onclick=()=>open(Number(el.dataset.shelf)));
   root().querySelector('.modal').classList.add('shopfront-modal');return;
  }
  const s=state(),b=BUILDINGS[id],summary=shopSummary(s,id),listing=shopListing(s,id),revision=s.shopfronts?.revision||0,recipes=ALL_RECIPES.filter(r=>r.building===id);
  openModal(b.name+' · 商品陈列','勾选上架品种，留下制作、赠礼和筹备需要的数量',
   '<section class="shopfront-intro"><span class="shelf-mode">'+summary.mode+'</span><h3>先留好原料，再出售余量。</h3><p>只出售勾选商品中超过留用量的部分。</p><details class="shelf-help"><summary>库存与成交规则</summary><p>保留数量只限制游客购买，仍可用于制作、分工、赠礼和派对。预留给任务的物资不会售出。'+(VENUE_SERVICES[id]?'取消全部商品后，'+VENUE_SERVICES[id]+'仍可营业。':'取消全部商品后，本馆暂停商品营业。')+'</p><p>正在服务的游客会按已确认的商品与价格完成本次交易；新设置用于之后的到店选择。</p></details></section><div class="shelf-toolbar"><button class="secondary" id="shelfAll">全部上架</button><button class="secondary" id="shelfNone">全部下架</button><span>售价 / 扣费后净收入</span></div><form id="shopfrontForm"><div class="shelf-products">'+recipes.map(r=>{const row=listing.find(x=>x.item===r.item),price=visitorPrice(r.item,r),offer=shopItemOffer(s,r.item);return '<article class="shelf-product"><label class="shelf-choice"><input type="checkbox" data-stock-item="'+r.item+'" '+(row?'checked':'')+' aria-label="上架'+r.name+'"/>'+icon(r.item)+'<span><b>'+r.name+'</b><small>'+price+' / +'+(price-operatingCost(price))+' 岛币</small></span></label><p class="shelf-stock"><span data-stock-count="'+r.item+'">背包 '+s.inventory[r.item]+' · 已预留 '+reservedQuantity(s,r.item)+'</span><br><span data-sale-count="'+r.item+'">可售 '+offer.available+' 份</span></p><label class="shelf-keep">留用<input type="number" min="0" max="9999" step="1" inputmode="numeric" value="'+(row?.keep||0)+'" data-keep-item="'+r.item+'" aria-label="保留'+r.name+'数量"/></label><button type="button" class="secondary shelf-purpose" data-purpose="'+r.item+'">来源与用途</button></article>';}).join('')+'</div><p class="shelf-feedback" id="shelfFeedback" role="status" aria-live="polite"></p></form>',
   '<button class="secondary" id="shelvesBack">全部商铺</button><button class="secondary" id="shelfReset">恢复自动陈列</button><button class="primary" id="saveShelf">保存货架</button>');
  root().querySelector('.modal').classList.add('shopfront-modal');
  const form=root().querySelector('#shopfrontForm'),feedback=root().querySelector('#shelfFeedback'),selects=[...form.querySelectorAll('[data-stock-item]')];
  let changed=false,errorMessage=null;const preview=(edited=false)=>{if(edited){changed=true;errorMessage=null;}let total=0;for(const el of selects){const item=el.dataset.stockItem,input=form.querySelector('[data-keep-item="'+item+'"]'),n=el.checked&&input.checkValidity()?Math.max(0,availableQuantity(state(),item)-Number(input.value)):0;form.querySelector('[data-stock-count="'+item+'"]').textContent='背包 '+state().inventory[item]+' · 已预留 '+reservedQuantity(state(),item);form.querySelector('[data-sale-count="'+item+'"]').textContent='可售 '+n+' 份';total+=n;}feedback.textContent=errorMessage||(changed?'待保存：':'当前货架：')+selects.filter(el=>el.checked).length+' 种商品，可售 '+total+' 份。';};
  form.oninput=()=>preview(true);preview();const refresh=setInterval(()=>{if(!form.isConnected){clearInterval(refresh);return;}if(!busy)preview();},1000);root().querySelector('#shelfAll').onclick=()=>{for(const el of selects)el.checked=true;preview(true)};root().querySelector('#shelfNone').onclick=()=>{for(const el of selects)el.checked=false;preview(true)};
  root().querySelector('#shelvesBack').onclick=()=>open();
  form.querySelectorAll('[data-purpose]').forEach(el=>el.onclick=()=>detail(el.dataset.purpose));
  const save=async reset=>{
   if(busy||!reset&&!form.reportValidity())return;busy=true;
   const buttons=[...root().querySelectorAll('button')];for(const el of buttons)el.disabled=true;
   feedback.textContent='正在确认货架设置…';
   try{const rows=reset?null:selects.filter(el=>el.checked).map(el=>({item:el.dataset.stockItem,keep:Number(form.querySelector('[data-keep-item="'+el.dataset.stockItem+'"]').value)}));const r=await command('shopfront',{buildingId:id,listing:rows,expectedShopRevision:revision});busy=false;if(form.isConnected)open(id);toast(r.receipt.text);}
   catch(e){errorMessage=e.message;feedback.textContent=e.message;toast(e.message);}
   finally{busy=false;for(const el of buttons)if(el.isConnected)el.disabled=false;}
  };
  root().querySelector('#saveShelf').onclick=()=>save(false);root().querySelector('#shelfReset').onclick=()=>save(true);
 }
 return {open};
}
