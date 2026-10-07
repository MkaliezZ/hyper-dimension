import {availableQuantity,reservedQuantity} from './resourceLedger.js';
import {isWorn,wornItems} from './equipmentRules.js';
import {MOMENTS} from './journey.js';
import {momentSeal} from './journeyUI.js';
import {itemPurpose} from './itemPurpose.js';
import {AVATARS} from './avatarCatalog.js';
import {avatarPortrait} from './avatars.js';
import {itemMarkup} from './artStore.js';
import {RAW_MATERIALS,ALL_RECIPES,ITEM_BY_ID,RECIPE_BY_ID,recipeGate,itemUse,giftPreview,unequipOutfit} from './contentCatalog.js';
import {BUILDINGS,RESIDENTS} from './world.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sources={forest:'林地',mine:'矿洞',farm:'农田',greenhouse:'育苗温室',shore:'海岸拾取',fishing:'海边钓场'};
export function createContentUI(api){
 const {state,theme,persist,renderUI,toast,craft,gather}=api;
 let selectedGiftRecipient=15,managing=false,ordering=false;
 async function manage(operation,args,local,after){if(managing)return;managing=true;try{const result=api.command?(await api.command(operation,args)).receipt.details:local();api.persist();api.renderUI();after(result);api.toast(result.text||result.reason);}catch(e){api.toast(e.message);}finally{managing=false;}}
 const openModal=(...args)=>{api.openModal(...args);document.querySelector('#modalRoot .modal').classList.add('content-modal')};
 const root=()=>document.getElementById('modalRoot'),bind=(sel,fn)=>root().querySelectorAll(sel).forEach(el=>el.onclick=()=>fn(el));
 const icon=id=>itemMarkup(id,theme());
 function wardrobe(butler=false,gender='男'){
  const s=state(),selected=butler?s.butlerAvatar:s.playerProfile.avatar;
  openModal(butler?'管家形象衣橱':'岛主形象衣橱','不同发型、服饰与身份气质 · 八向行走与作业动作',
   '<div class="content-tabs"><button data-gender="男" class="'+(gender==='男'?'active':'')+'">男性 · 6 套</button><button data-gender="女" class="'+(gender==='女'?'active':'')+'">女性 · 6 套</button></div><div class="avatar-gallery">'+
   (butler?'<button class="avatar-card '+(selected==='default'?'selected':'')+'" data-avatar="default"><div class="default-butler"></div><b>Hermes 管家</b><p>原始管家形象</p></button>':'')+
   AVATARS.filter(a=>a.gender===gender).map(a=>'<button class="avatar-card '+(selected===a.id?'selected':'')+'" data-avatar="'+a.id+'">'+avatarPortrait(a.id,theme(),'wardrobe-portrait')+'<b>'+a.name+'</b><p>'+a.description+'</p><span>'+(selected===a.id?'正在使用':'选择此形象')+'</span></button>').join('')+'</div>',
   '<button id="backProfile" class="secondary">返回'+(butler?'管家档案':'个人档案')+'</button>');
  bind('[data-gender]',el=>wardrobe(butler,el.dataset.gender));bind('[data-avatar]',el=>{if(butler)s.butlerAvatar=el.dataset.avatar;else s.playerProfile.avatar=el.dataset.avatar;persist();renderUI();wardrobe(butler,gender);toast('角色形象已更新');});bind('#backProfile',()=>butler?api.butler():player());
 }
 function player(){
  const s=state(),p=s.playerProfile,unlocked=ALL_RECIPES.filter(r=>recipeGate(r,s).ready).length;
  openModal(esc(p.name)+' · 岛主档案','个人信息、角色形象、穿着与岛屿收藏',
   '<div class="profile-layout"><aside class="character-stage">'+avatarPortrait(p.avatar,theme())+'<h3>'+esc(p.name)+'</h3><button class="primary" id="openWardrobe">选择角色 · 男 6 / 女 6</button><button class="secondary" id="openEquipment">穿着与工具</button>'+
   '<p class="profile-vitals">体力 '+Math.round(s.playerVitals?.energy??70)+' · 饱足 '+Math.round(s.playerVitals?.hunger??70)+'<br/>岛币 '+s.coins+' · 第 '+s.day+' 天</p>'+'</aside><form id="playerForm" class="profile-form">'+
   (wornItems(s).length?'<div class="outfit-display wide">'+wornItems(s).map(id=>'<span>'+icon(id)+ITEM_BY_ID[id].name+'</span>').join('')+'<button type="button" class="secondary" id="profileUnequip">全部换下并放回背包</button></div>':'')+
   [['name','角色名称',18],['islandName','小岛名称',18],['pronouns','自我称谓',24],['birthday','生日 / 纪念日',24]].map(([key,label,max])=>'<label>'+label+'<input name="'+key+'" maxlength="'+max+'" value="'+esc(p[key])+'"/></label>').join('')+
   '<label class="wide">个人介绍<textarea name="bio" maxlength="240" rows="4">'+esc(p.bio)+'</textarea></label><div class="profile-stats wide"><span>收集素材<b>'+RAW_MATERIALS.filter(i=>s.discovered[i.id]).length+' / 50</b></span><span>制作图纸<b>'+unlocked+' / 300</b></span><span>制作次数<b>'+Object.values(s.craftHistory).reduce((a,b)=>a+b,0)+'</b></span><span>活动承办<b>'+s.activities+'</b></span></div><div class="journey-medals">'+MOMENTS.filter(m=>s.journey?.claimed[m.id]).map(m=>'<span class="journey-medal">'+momentSeal(m.id)+(m.badge||m.title)+'</span>').join('')+'</div><p class="hint wide">姓名、岛名、称谓、生日与介绍可修改。经营记录随实际游玩积累。</p></form></div>',
   '<button class="secondary" id="profileRecipes">查看配方</button><button class="primary" id="savePlayer">保存个人信息</button>');
  bind('#profileUnequip',()=>{manage('unequip',{},()=>unequipOutfit(s),()=>player())});bind('#openWardrobe',()=>wardrobe());bind('#openEquipment',()=>api.equipment());bind('#profileRecipes',()=>recipes());bind('#savePlayer',()=>{
   const f=root().querySelector('#playerForm'),data=new FormData(f);
   if(!String(data.get('name')).trim()||!String(data.get('islandName')).trim()){toast('角色名称与小岛名称不能为空');return}
   for(const key of ['name','islandName','pronouns','birthday','bio'])p[key]=String(data.get(key)).trim();
   persist();renderUI();player();toast('个人信息已保存');
  });
 }
 function bag(filter='owned',search=''){
  const s=state(),items=Object.values(ITEM_BY_ID).filter(i=>(filter==='all'||filter==='owned'&&((s.inventory[i.id]||0)>0||isWorn(s,i.id))||i.category===filter)&&i.name.includes(search));
  openModal('岛屿背包与图鉴','50 种基础素材 · 300 种独立成品 · 点击查看来源与用途',
   '<div class="catalog-filter"><input id="bagSearch" placeholder="搜索物品名称" value="'+esc(search)+'"/><select id="bagFilter">'+[['owned','已拥有'],['all','全部图鉴'],['material','基础素材'],['tool','工具'],['food','餐食'],['wear','服装'],['decor','摆设'],['study','研究'],['collection','奇观'],['gift','礼物'],['seedling','种苗'],['component','组件']].map(([v,n])=>'<option value="'+v+'" '+(filter===v?'selected':'')+'>'+n+'</option>').join('')+'</select></div><p class="catalog-count">显示 '+items.length+' 项 · 收藏已发现 '+Object.keys(s.discovered).length+' / 350</p><div class="catalog-grid">'+items.map(i=>'<button class="catalog-card" data-item="'+i.id+'">'+icon(i.id)+'<b>'+i.name+'</b><small>'+(i.category==='material'?sources[i.source]:BUILDINGS[i.building].name)+'</small><span>背包 × '+(s.inventory[i.id]||0)+(isWorn(s,i.id)?' · 穿着中':'')+'</span></button>').join('')+'</div>','<button class="secondary" id="openEquipmentBag">穿着与工具</button><button class="secondary" id="openDecorations">岛屿布置册 →</button>');
  root().querySelector('#openDecorations').onclick=api.placements;root().querySelector('#openEquipmentBag').onclick=api.equipment;
  bind('[data-item]',el=>detail(el.dataset.item));const field=root().querySelector('#bagSearch');field.onchange=()=>bag(filter,field.value);root().querySelector('#bagFilter').onchange=e=>bag(e.target.value,field.value);
 }
 function detail(id,{crafted=false}={}){
  const s=state(),i=ITEM_BY_ID[id];if(!i)return;
  const p=itemPurpose(id,s),r=p.recipe,gate=r?recipeGate(r,s):null,o=p.order,worn=i.category==='wear'&&isWorn(s,id);
  const next=p.next.map(n=>'<button class="secondary" data-next-recipe="'+n.id+'">'+icon(n.id)+esc(n.name)+' · '+esc(BUILDINGS[n.building].name)+' · 需要 '+n.quantity+' 份'+(!n.ready?'（查看解锁条件）':'')+'</button>').join('');
  const actions=r?'<div class="purpose-actions"><button class="primary" id="itemUse" '+(worn||availableQuantity(s,id)<1?'disabled':'')+'>'+(worn?'正在穿着':p.primary.action)+'</button>'+(worn?'<button class="secondary" id="itemUnequip">换下并放回背包</button>':'')+(i.category!=='gift'?'<button class="secondary" id="itemGift" '+(availableQuantity(s,id)<1?'disabled':'')+'>赠送居民</button>':'')+'</div>':'';
  const purpose='<div class="item-purpose"><h3>怎么使用这件物品</h3><p>'+esc(p.primary.text)+'</p>'+actions+
   (p.facilityUses?.length?'<div class="purpose-row workshop-route"><b>功能设施投入</b><div class="next-recipes">'+p.facilityUses.map(f=>'<button class="secondary" data-detail="'+f.item+'">'+icon(f.item)+esc(f.name)+' · 每批使用 '+f.quantity+' 份</button>').join('')+'</div><p>制作并布置设施后，在设施页投料。已预留物资不会被取用。</p></div>':'')+
   (p.shop?'<div class="purpose-row"><b>本馆货架 · '+(p.shop.listed?'正在陈列':'已下架')+'</b><p>保留 '+p.shop.keep+' 份，可供游客购买 '+p.shop.available+' 份。保留品仍可用于下一道制作或派对。</p><button class="secondary" id="itemShelf">设置本馆货架</button></div>':'')+
   (p.buyers.length?'<div class="purpose-row"><b>游客购买 · '+p.marketPrice+' 岛币</b><p>'+esc(p.buyers.join('、'))+'等旅人会在'+esc(p.building)+'按货架设置购买真实库存；访客买走后从背包扣除一份，入账时扣运营费。</p></div>':'')+
   (p.party?'<div class="purpose-row"><b>派对筹备</b><p>'+esc(p.party)+'</p><button class="secondary" id="itemParty">查看派对筹备</button></div>':'')+
   (o?'<div class="purpose-row"><b>今日岛主订单 · 净收入 +'+o.net+'</b><p>交付 '+o.quantity+' 份；亲手产出可用 '+o.personal+' 份。'+(o.done?'今日已结算。':'每天仅结算一次。')+'</p><button class="primary" id="itemOrder" '+(o.done||o.personal<o.quantity?'disabled':'')+'>'+(o.done?'今日已交付':'交付订单')+'</button></div>':'')+
   (p.inputs.some(x=>x.crossWorkshop)?'<div class="purpose-row workshop-route"><b>跨馆制作工序</b><p>先在对应场馆备好组件，再到'+esc(p.building)+'完成制作。已有组件直接取用，筹备计划按实际缺口分工。</p><div class="next-recipes">'+p.inputs.filter(x=>x.crossWorkshop).map(x=>'<button class="secondary" data-detail="'+x.id+'">'+icon(x.id)+esc(BUILDINGS[x.building].name)+' · '+esc(x.name)+' ×'+x.quantity+'</button>').join('')+'</div></div>':'')+
   (next?'<div class="purpose-row"><b>继续加工 · '+p.next.length+' 张后续图纸</b><div class="next-recipes">'+next+'</div></div>':'')+'</div>';
  openModal((crafted?'制作完成 · ':'')+i.name,r?BUILDINGS[r.building].name+' · '+['基础','进阶','大师'][r.tier]+'图纸':sources[i.source]+' · 基础素材',
   '<div class="item-detail">'+icon(id)+'<article><h3>背包持有 ×'+s.inventory[id]+'</h3><p class="hint">可用 '+availableQuantity(s,id)+' · 已预留 '+reservedQuantity(s,id)+'，预留物资留给对应任务。</p>'+
   (r?'<p class="hint">'+gate.text+'</p><div class="material-costs">'+Object.entries(r.cost).map(([key,n])=>'<button class="secondary" data-detail="'+key+'">'+icon(key)+'<span>'+ITEM_BY_ID[key].name+' '+s.inventory[key]+'/'+n+'</span></button>').join('')+'</div>':'<p>来源：'+sources[i.source]+'</p>')+
   (r?'<label>可选赠礼对象<select id="giftRecipient">'+[15,...RESIDENTS.map((_,i)=>i).filter(i=>i!==15)].map(n=>'<option value="'+n+'" '+(n===selectedGiftRecipient?'selected':'')+'>'+esc(s.npcProfiles?.[n]?.name||RESIDENTS[n].name)+'</option>').join('')+'</select></label><p id="giftPreview" class="hint"></p>':'')+'</article></div>'+purpose,
   '<button class="secondary" id="backBag">返回背包</button>'+
   (r?'<button class="secondary" id="itemCraft" '+(!gate.ready?'disabled':'')+'>'+(crafted?'继续制作':'前往制作')+'</button>':'<button class="primary" id="itemGather">前往收集</button>')+
   '<button class="secondary" id="itemBusiness">经营与订单</button>');
  bind('[data-detail]',el=>detail(el.dataset.detail));bind('[data-next-recipe]',el=>detail(el.dataset.nextRecipe));bind('#backBag',()=>bag());bind('#itemCraft',()=>craft(r));bind('#itemGather',()=>gather(i));
  const use=action=>{const npcId=Number(root().querySelector('#giftRecipient')?.value||0);return manage(action==='gift'?'gift':'use',{itemId:id,npcId},()=>itemUse(id,s,{npcId,action}),result=>{if(result.route==='fishing')(api.fishing||api.party)();else if(result.route==='placement')api.place(id);else detail(id);});};
  if(r){const recipient=root().querySelector('#giftRecipient'),preview=root().querySelector('#giftPreview');const update=()=>{selectedGiftRecipient=Number(recipient.value);const gift=giftPreview(id,s,selectedGiftRecipient);preview.textContent=gift.text;const btn=root().querySelector(i.category==='gift'?'#itemUse':'#itemGift');if(btn)btn.disabled=availableQuantity(s,id)<1||gift.gain<1};recipient.onchange=update;update();}
  bind('#itemUnequip',()=>{manage('unequip',{itemId:id},()=>unequipOutfit(s,id),()=>detail(id))});bind('#itemUse',()=>use('use'));bind('#itemGift',()=>use('gift'));bind('#itemShelf',()=>api.shopfront(i.building));bind('#itemBusiness',()=>api.business());bind('#itemParty',()=>p.fishing?(api.fishing||api.party)():api.party());
  bind('#itemOrder',async()=>{
   if(ordering)return;ordering=true;const button=root().querySelector('#itemOrder');if(button){button.disabled=true;button.textContent='正在确认交付…';}
   try{
    if(api.deliverOrder){const result=await api.deliverOrder(o.slot);detail(id);toast(result.receipt.text);}
    else throw Error('经营服务尚未就绪，请稍后再试');
   }catch(error){toast(error.message);}
   finally{ordering=false;if(button?.isConnected){button.disabled=false;button.textContent='交付订单';}}
  });
 }
 function recipes(building=0,search=''){
  const s=state(),rows=ALL_RECIPES.filter(r=>(building==='all'||r.building===Number(building))&&r.name.includes(search));
  openModal('建筑制作图鉴','每馆 12 张图纸 · 制作 / 研究提高熟练度 · 品质开放进阶配方',
   (Number(building)===18?'<button class="secondary journal-collection" id="museumCollections">打开奇观藏册与陈列 →</button>':'')+'<div class="catalog-filter"><select id="recipeBuilding"><option value="all" '+(building==='all'?'selected':'')+'>全部 300 图纸</option>'+BUILDINGS.map(b=>'<option value="'+b.id+'" '+(String(building)===String(b.id)?'selected':'')+'>'+b.name+' · 12</option>').join('')+'</select><input id="recipeSearch" placeholder="搜索配方名称" value="'+esc(search)+'"/></div><div class="catalog-grid recipe-grid">'+rows.map(r=>{const gate=recipeGate(r,s);return '<button class="catalog-card '+(!gate.ready?'locked-card':'')+'" data-recipe="'+r.item+'">'+icon(r.item)+'<b>'+r.name+'</b><small>'+BUILDINGS[r.building].name+' · '+['基础','进阶','大师'][r.tier]+'</small><span>'+(!gate.ready?'图纸未解锁':Object.entries(r.cost).every(([i,n])=>s.inventory[i]>=n)?'材料已齐备':'查看制作材料')+'</span><small>'+gate.text+'</small></button>'}).join('')+'</div>');
  if(root().querySelector('#museumCollections'))root().querySelector('#museumCollections').onclick=api.collections;
  bind('[data-recipe]',el=>detail(el.dataset.recipe));root().querySelector('#recipeBuilding').onchange=e=>recipes(e.target.value,search);root().querySelector('#recipeSearch').onchange=e=>recipes(building,e.target.value);
 }
 function collection(source='forest'){
  const rows=RAW_MATERIALS.filter(i=>i.source===source),s=state();
  openModal('采集手账','每种素材都有采集地点、操作动作和制作用途',
   '<div class="content-tabs">'+Object.entries(sources).map(([key,n])=>'<button data-source="'+key+'" class="'+(key===source?'active':'')+'">'+n+'</button>').join('')+'</div><p class="hint">'+({forest:'到达林地后采集。木料使用斧头，植物与蜂产物使用采集动作。',mine:'选择矿种，再进入矿洞敲击矿脉。击碎后获得选定矿物。',farm:'逐块锄地、选择种子、浇水、等待成熟并收获；通用种子从收获与种苗研究取得。',greenhouse:'在育苗温室培育区采收花草，制作种苗和花艺。',shore:'沿码头海岸拾取冲上岸的材料。珊瑚碎片来自漂流物。',fishing:'持续控制浮标位置，完成收线后取得海产。'}[source])+'</p><div class="catalog-grid">'+rows.map(i=>'<button class="catalog-card" data-gather="'+i.id+'">'+icon(i.id)+'<b>'+i.name+'</b><small>持有 ×'+s.inventory[i.id]+'</small></button>').join('')+'</div>');
  bind('[data-source]',el=>collection(el.dataset.source));bind('[data-gather]',el=>gather(ITEM_BY_ID[el.dataset.gather]));
 }
 return {player,wardrobe,bag,recipes,collection,detail};
}

