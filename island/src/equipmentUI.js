import {GARMENTS,WEAR_SLOTS,TOOLS,BASE_TOOLS,wornItems,isWorn,equipOutfit,unequipOutfit,equipTool,resolveTool,toolPurpose} from './equipmentRules.js';
import {availableQuantity} from './resourceLedger.js';
import {itemMarkup} from './artStore.js';
import {drawAnimatedCharacter} from './characters.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const directions=['正面','左前','左侧','左后','背面','右后','右侧','右前'];
export function createEquipmentUI(api){
 let slot='body',heading=0,motion='walk',generation=0,canvas=null,managing=false;
 const icon=id=>itemMarkup(id,api.theme(),'equipment-icon');
 function open(){
  generation++;const s=api.state(),t=api.theme(),w=s.wardrobe,items=Object.values(GARMENTS).filter(g=>g.slot===slot);
  const slots=Object.entries(WEAR_SLOTS).map(([key,label])=>{const id=w.slots?.[key]?.item;return '<button class="equipment-slot '+(slot===key?'is-selected':'')+'" data-wear-slot="'+key+'">'+(id?icon(id):'<span class="equipment-empty">◇</span>')+'<span><small>'+label+'</small><b>'+esc(id?GARMENTS[id].name:'角色原有服饰')+'</b></span></button>'}).join('');
  const garments=items.map(g=>{const worn=isWorn(s,g.id),n=availableQuantity(s,g.id);return '<article class="equipment-garment '+(worn?'is-worn':'')+'">'+icon(g.id)+'<div><h3>'+g.name+'</h3><p>'+WEAR_SLOTS[g.slot]+' · 背包可用 '+n+(worn?' · 穿着中':'')+'</p></div><button class="'+(worn?'secondary':'primary')+'" data-wear="'+g.id+'" '+(!worn&&n<1?'disabled':'')+'>'+(worn?'换下收好':'穿上')+'</button><button class="secondary" data-equipment-detail="'+g.id+'">用途与制作</button></article>'}).join('');
  const tools=Object.entries(BASE_TOOLS).map(([action])=>{const r=resolveTool(s,action),choices=Object.values(TOOLS).filter(v=>v.action===action);return '<article class="equipment-tool">'+icon(r.id)+'<div><h3>'+r.name+'</h3><p class="equipment-source">'+(r.source==='owned'?'自有装备 · 作业时暂留':'公共借用 · 基础作业')+'</p><p>'+esc(r.source==='owned'?toolPurpose(r.id,s).text:'没有可用实物时仍可正常作业。制作并装备自己的工具，可提高效率。')+'</p><div class="equipment-tool-options">'+choices.map(v=>'<button class="'+(r.source==='owned'&&r.id===v.id?'primary':'secondary')+'" data-tool="'+v.id+'" '+(availableQuantity(s,v.id)<1?'disabled':'')+'>'+v.name+' ×'+availableQuantity(s,v.id)+(r.source==='owned'&&r.id===v.id?' ✓':'')+'</button>').join('')+'<button class="secondary" data-equipment-detail="'+r.id+'">制作图纸</button></div></div></article>'}).join('');
  api.openModal('岛主衣橱与工具箱','手作衣物真实穿着 · 六个部位自由搭配 · 自有工具提高作业效率',
   '<div class="equipment-layout"><aside class="equipment-preview"><div class="equipment-preview-title"><small>晨光岛 · 今日穿着</small><h3>'+esc(s.playerProfile.name)+'</h3></div><canvas id="equipmentPreview" width="360" height="330" aria-label="实际角色八方向与作业动画预览"></canvas><div class="equipment-directions">'+directions.map((label,i)=>'<button data-equipment-direction="'+i+'" aria-pressed="'+(i===heading)+'">'+label+'</button>').join('')+'</div><label class="equipment-motion">姿态<select id="equipmentMotion">'+[['walk','行走'],['idle','站立'],['hoe','耕地'],['water','浇水'],['pickaxe','采矿'],['axe','伐木'],['harvest','收割'],['fish','钓鱼']].map(([id,name])=>'<option value="'+id+'" '+(motion===id?'selected':'')+'>'+name+'</option>').join('')+'</select></label><p>换装保留面容与发色，所有朝向同步。衣物收好后完整归还背包。</p></aside><div class="equipment-sections"><section><h3>穿着部位</h3><div class="equipment-slots">'+slots+'</div><div class="equipment-garments">'+garments+'</div><p class="hint">连身衣与单独下装互相替换；围裙、披肩、头饰和手套可独立搭配。</p></section><section><h3>作业工具</h3><p class="hint">工具不消耗，作业时预留这一件，结束或取消后释放。产量和作物成熟时间保持一致。</p><div class="equipment-tools">'+tools+'</div></section></div></div>',
   '<button class="secondary" id="equipmentBack">返回角色档案</button><button class="secondary" id="equipmentStoreAll" '+(!wornItems(s).length?'disabled':'')+'>全部换下收好</button>');
  const root=document.querySelector('#modalRoot');root.querySelector('.modal').classList.add('equipment-modal');
  const apply=async(operation,args,local)=>{if(managing)return;managing=true;try{const result=api.command?(await api.command(operation,args)).receipt.details:local();api.persist();api.renderUI();open();api.toast(result.text||result.reason);}catch(e){api.toast(e.message);}finally{managing=false;}};
  root.querySelectorAll('[data-wear-slot]').forEach(b=>b.onclick=()=>{slot=b.dataset.wearSlot;open()});
  root.querySelectorAll('[data-wear]').forEach(b=>b.onclick=()=>apply(isWorn(s,b.dataset.wear)?'unequip':'equip',{itemId:b.dataset.wear},()=>isWorn(s,b.dataset.wear)?unequipOutfit(s,b.dataset.wear):equipOutfit(b.dataset.wear,s)));
  root.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>apply('tool',{itemId:b.dataset.tool},()=>equipTool(b.dataset.tool,s)));
  root.querySelectorAll('[data-equipment-detail]').forEach(b=>b.onclick=()=>api.detail(b.dataset.equipmentDetail));
  root.querySelector('#equipmentStoreAll').onclick=()=>apply('unequip',{},()=>unequipOutfit(s));root.querySelector('#equipmentBack').onclick=api.back;
  root.querySelectorAll('[data-equipment-direction]').forEach(b=>b.onclick=()=>{heading=Number(b.dataset.equipmentDirection);root.querySelectorAll('[data-equipment-direction]').forEach(x=>x.setAttribute('aria-pressed',String(Number(x.dataset.equipmentDirection)===heading)))});
  root.querySelector('#equipmentMotion').onchange=e=>motion=e.target.value;
  canvas=root.querySelector('#equipmentPreview');const localCanvas=canvas,ctx=canvas.getContext('2d'),token=generation,ratio=Math.min(2,window.devicePixelRatio||1);canvas.width=360*ratio;canvas.height=330*ratio;
  const actor={x:180,y:302,appearance:s.playerProfile.avatar,phase:0,direction:Math.PI/2};
  function frame(ms){if(token!==generation||!localCanvas.isConnected)return;const clock=ms/1000,latest=api.state(),theme=api.theme();ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,360,330);ctx.fillStyle=theme==='pixel'?'#d8dfc233':'#d9ceb733';ctx.beginPath();ctx.ellipse(180,305,92,16,0,0,Math.PI*2);ctx.fill();actor.appearance=latest.playerProfile.avatar;actor.garments=wornItems(latest);actor.direction=Math.PI/2+heading*Math.PI/4;actor.phase=clock*7;actor.walkMix=motion==='walk'?1:0;actor.walking=motion==='walk';actor.action=['walk','idle'].includes(motion)?null:{type:motion,t:clock%1.8,duration:1.8,equipment:{tool:resolveTool(latest,motion)}};drawAnimatedCharacter(ctx,actor,theme,'#9fba8b',false,clock,2.45);requestAnimationFrame(frame)}
  requestAnimationFrame(frame);
 }
 return {open,inspect:()=>canvas?.isConnected?{heading,motion,wear:wornItems(api.state()),version:35}:null};
}
