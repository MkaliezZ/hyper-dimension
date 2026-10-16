import {customArtURL} from './artStore.js';
import {RAW_MATERIALS,ALL_RECIPES} from './contentCatalog.js';
import {BUILDINGS} from './world.js';
import {CUSTOM_CONTENT_SCHEMA,customRecipeId} from './customContent.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const blankCustomArt=()=>Object.fromEntries(['pixel','origami'].map(theme=>[theme,{sha256:'0'.repeat(64),width:32,height:32}]));
export function customContentSummary(pack){
 if(pack.schema!==CUSTOM_CONTENT_SCHEMA)return '';
 const items=pack.content.items,filled=items.reduce((n,item)=>n+['pixel','origami'].filter(style=>item.art[style].sha256!=='0'.repeat(64)).length,0);
 return '<small class="co-content-count">'+items.length+' 件正式物品 · 双画风 '+filled+'/'+items.length*2+'</small>';
}
export function customContentReviewMarkup(pack,theme){
 if(pack.schema!==CUSTOM_CONTENT_SCHEMA)return '';
 const itemName=id=>id.startsWith('@')?pack.content.items.find(i=>i.id===id.slice(1))?.name||id:RAW_MATERIALS.find(i=>i.id===id)?.name||ALL_RECIPES.find(r=>r.item===id)?.name||id;
 const recipeName=id=>id.startsWith('@')?itemName(id):ALL_RECIPES.find(r=>r.id===id)?.name||id;
 return '<section class="co-custom-editor co-review-products"><h3>作品原图与配方</h3>'+customContentSummary(pack)+pack.content.items.map(item=>{
  const recipe=pack.content.recipes.find(r=>r.item===item.id),purpose=({gift:'赠送居民',component:'加工组件',food:'餐食',study:'研究',decor:'岛上摆件'})[item.category];
  return '<fieldset><legend>'+esc(item.name)+'</legend><p>'+esc(BUILDINGS[item.building].name+' · '+purpose+' · '+['基础','进阶','大师'][item.tier])+'</p><div class="co-product-art">'+['pixel','origami'].map(style=>'<figure><figcaption>'+({pixel:'像素风',origami:'折纸风'})[style]+'</figcaption><img data-co-review-art="'+style+'" alt="'+esc(item.name)+' · '+({pixel:'像素风',origami:'折纸风'})[style]+'" width="96" height="96" decoding="async" src="'+customArtURL(theme,item.art[style].sha256)+'"></figure>').join('')+'</div><p>'+esc(item.description)+'</p><p class="hint">材料：'+Object.entries(recipe.cost).map(([id,n])=>esc(itemName(id))+' ×'+n).join(' · ')+'</p><p class="hint">前置：'+(recipe.requires.length?recipe.requires.map(id=>esc(recipeName(id))).join(' · '):'无前置图纸')+'</p></fieldset>';
 }).join('')+'</section>';
}
export function addCustomProduct(pack){
 const p=structuredClone(pack);p.schema=CUSTOM_CONTENT_SCHEMA;p.content??={items:[],recipes:[]};if(p.content.items.length>=12)throw Error('每件作品最多 12 件正式物品');
 let n=1;while(p.content.items.some(i=>i.id==='craft-'+n))n++;const id='craft-'+n;
 p.content.items.push({id,name:'海风手作 '+n,building:11,category:'gift',tier:0,description:'在岛上邮局制作的手作礼物，可以赠给居民留下相处记忆。',art:blankCustomArt()});p.content.recipes.push({id,item:id,cost:{wood:2,fiber:1},requires:[]});
 if(p.content.items.length===1){p.summary='在邮局制作自己的海岛手作，上传双画风素材，并将成品用于赠礼或后续加工。';p.themeNotes={pixel:'上传轮廓清楚的像素素材，核对物品数量、朝向和透明留白。',origami:'上传纸层、折痕和投影一致的折纸素材，保持物品构造与用途正确。'};Object.assign(p.challenges[0],{id:'first-craft',title:'给旅人的第一份手作',recipeId:customRecipeId(p.id,id),brief:'在邮局工作台寻找相同图案，以最多两次转折的空路线连成一对，完成全部配对。正式制作消耗所选材料，练习只记录成绩。',hints:['先观察外围，优先连通路径清楚的同类图案。','已经移开的图案会腾出新通路，再检查中间区域。']});}return p;
}
export function customContentMarkup(pack,theme){
 if(pack.schema!==CUSTOM_CONTENT_SCHEMA)return '';
 return '<section class="co-custom-editor"><h3>正式物品与加工配方</h3><p>每张配方实际产出 1 件物品；价格由材料计算。两套 PNG 各 32–512 像素、8 位非交错、最多 256 KiB。图片存入本机服务，不塞入日常存档。</p>'+pack.content.items.map((item,index)=>{
  const recipe=pack.content.recipes.find(r=>r.item===item.id),sources=[...RAW_MATERIALS,...ALL_RECIPES.map(r=>({id:r.item,name:r.name})),...pack.content.items.filter(i=>i.id!==item.id).map(i=>({id:'@'+i.id,name:'本作品 · '+i.name}))];
  return '<fieldset data-co-product="'+index+'"><legend>'+esc(item.name)+' · '+esc(item.id)+'</legend><div class="co-fields"><label>物品名称<input data-product-name maxlength="40" value="'+esc(item.name)+'"></label><label>关联建筑<select data-product-building>'+BUILDINGS.map(b=>'<option value="'+b.id+'" '+(b.id===item.building?'selected':'')+'>'+esc(b.name)+'</option>').join('')+'</select></label><label>用途<select data-product-category>'+[['gift','赠送居民'],['component','加工组件'],['food','餐食'],['study','研究'],['decor','岛上摆件']].map(([id,name])=>'<option value="'+id+'" '+(id===item.category?'selected':'')+'>'+name+'</option>').join('')+'</select></label><label>图纸等级<select data-product-tier>'+[0,1,2].map((n)=>'<option value="'+n+'" '+(n===item.tier?'selected':'')+'>'+['基础','进阶','大师'][n]+'</option>').join('')+'</select></label></div><label>物品介绍<textarea data-product-description rows="2" maxlength="240">'+esc(item.description)+'</textarea></label><div class="co-product-art">'+['pixel','origami'].map(style=>'<label><span>'+({pixel:'像素风',origami:'折纸风'})[style]+'</span>'+(item.art[style].sha256!=='0'.repeat(64)?'<img alt="'+esc(item.name)+' · '+style+'" width="96" height="96" src="'+customArtURL(theme,item.art[style].sha256)+'">':'<span class="hint">尚未上传</span>')+'<input type="file" accept="image/png" data-product-art="'+style+'"><small data-art-status="'+style+'">'+(item.art[style].sha256!=='0'.repeat(64)?item.art[style].width+' × '+item.art[style].height:'发布前需上传')+'</small></label>').join('')+'</div><label>材料数量 · JSON 对照表<textarea data-product-cost rows="4" spellcheck="false">'+esc(JSON.stringify(recipe.cost,null,2))+'</textarea></label><div class="co-fields"><label>添加材料<select data-product-ingredient>'+sources.map(i=>'<option value="'+esc(i.id)+'">'+esc(i.name)+' · '+esc(i.id)+'</option>').join('')+'</select></label><button type="button" class="secondary" data-add-ingredient>添加一份材料</button></div><label>前置配方 · 每行一个编号，空白表示无前置<textarea data-product-requires rows="2" placeholder="@craft-1 或 recipe_lantern">'+esc(recipe.requires.join('\n'))+'</textarea></label><p class="hint">本包组件用 @编号 引用，例如 @craft-1。前置制作达到一次后解锁；同馆等级与设施品质仍需满足。</p></fieldset>';
 }).join('')+'<button type="button" class="secondary" id="coAddProduct">再加一件物品与配方</button><p class="hint">本包最多 12 件物品。提交审核会核对素材是否真实存在；发布只对当前小岛生效。</p></section>';
}
export function mountCustomContentEditor({root,pack,upload,onChange,onAdd,toast}){
 const art=pack.content?.items.map(i=>structuredClone(i.art))||[];
 const read=()=>({items:[...root.querySelectorAll('[data-co-product]')].map(el=>{const i=Number(el.dataset.coProduct),v=selector=>el.querySelector(selector).value;return {...structuredClone(pack.content.items[i]),name:v('[data-product-name]'),building:Number(v('[data-product-building]')),category:v('[data-product-category]'),tier:Number(v('[data-product-tier]')),description:v('[data-product-description]'),art:structuredClone(art[i])};}),recipes:[...root.querySelectorAll('[data-co-product]')].map(el=>{const i=Number(el.dataset.coProduct);return {...structuredClone(pack.content.recipes.find(r=>r.item===pack.content.items[i].id)),cost:JSON.parse(el.querySelector('[data-product-cost]').value),requires:el.querySelector('[data-product-requires]').value.split('\n').map(s=>s.trim()).filter(Boolean)};})});
 for(const el of root.querySelectorAll('[data-co-product]')){
  el.querySelector('[data-add-ingredient]').onclick=()=>{try{const field=el.querySelector('[data-product-cost]'),value=JSON.parse(field.value),key=el.querySelector('[data-product-ingredient]').value;value[key]=(value[key]||0)+1;field.value=JSON.stringify(value,null,2);onChange();}catch{toast('请先修正材料 JSON 格式');}};
  for(const field of el.querySelectorAll('[data-product-art]'))field.onchange=async()=>{
   const file=field.files?.[0];if(!file)return;const status=el.querySelector('[data-art-status="'+field.dataset.productArt+'"]');field.disabled=true;
   try{if(file.type!=='image/png'||file.size>262144)throw Error('请使用不超过 256 KiB 的 PNG');status.textContent='正在核对与保存图片…';const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error('无法读取所选图片'));r.onload=()=>resolve(String(r.result).split(',')[1]);r.readAsDataURL(file);});const result=await upload(data);art[Number(el.dataset.coProduct)][field.dataset.productArt]={sha256:result.sha256,width:result.width,height:result.height};if(!el.isConnected)return;status.textContent='已保存 · '+result.width+' × '+result.height;let preview=field.parentElement.querySelector('img');if(!preview){preview=document.createElement('img');preview.width=preview.height=96;preview.alt='所选'+field.dataset.productArt+'素材';field.before(preview);}preview.src=customArtURL(field.dataset.productArt,result.sha256);onChange();}catch(error){if(el.isConnected){status.textContent=error.message;toast(error.message);}}finally{if(field.isConnected)field.disabled=false;}
  };
 }
 const button=root.querySelector('#coAddProduct');if(button)button.onclick=onAdd;
 return {read};
}
