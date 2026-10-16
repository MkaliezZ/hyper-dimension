// Declarative definitions only. No scripts, URLs, currency rewards or replacement
// of built-in catalog entries can be supplied by a content author.
export const CUSTOM_CONTENT_SCHEMA='hyper-dimension.cocreation/v2';
export const CUSTOM_CONTENT_LIMITS={items:12,ingredients:6,requirements:6,artBytes:262144,artMin:32,artMax:512};
const object=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const fail=message=>Object.assign(Error(message),{status:400,code:'cocreation_invalid'});
const own=(v,k)=>Object.hasOwn(v,k);
function fields(v,keys){if(!object(v)||Object.keys(v).some(k=>!keys.includes(k)))throw fail('自定义内容存在未支持的字段');}
function text(v,min,max){if(typeof v!=='string'||v.trim().length<min||v.trim().length>max||/[\u0000-\u001f]/.test(v))throw fail('自定义物品文字长度或格式无效');return v.trim();}
const local=id=>typeof id==='string'&&/^[a-z][a-z0-9-]{1,24}$/.test(id);
const integer=(n,min,max)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const categories=new Set(['decor','food','study','gift','component']);
export function customItemId(packageId,id){const value=packageId.replaceAll('-','_')+'_'+id.replaceAll('-','_');if(!local(id)||value.length>73)throw fail('自定义内容编号过长或无效');return value;}
export function customRecipeId(packageId,id){return 'recipe_'+customItemId(packageId,id);}
export function validateCustomArt(art){
 fields(art,['pixel','origami']);const result={};
 for(const theme of ['pixel','origami']){const a=art[theme];fields(a,['sha256','width','height']);if(!/^[a-f0-9]{64}$/.test(a.sha256||'')||!integer(a.width,32,512)||!integer(a.height,32,512))throw fail('每件作品需有效的像素与折纸 PNG 素材');result[theme]={sha256:a.sha256,width:a.width,height:a.height};}
 return result;
}
export function compileCustomContent(packageId,input,{items:baseItems,recipes:baseRecipes}){
 if(!/^opc-[a-z0-9]+(?:-[a-z0-9]+){0,8}$/.test(packageId||''))throw fail('共创作品编号无效');
 fields(input,['items','recipes']);
 if(!Array.isArray(input.items)||!input.items.length||input.items.length>12||!Array.isArray(input.recipes)||input.recipes.length!==input.items.length)throw fail('每包需 1–12 件物品，每件物品有且只有一张配方');
 const items=new Map(),recipes=new Map();
 for(const value of input.items){fields(value,['id','name','category','building','tier','description','art']);if(!local(value.id)||items.has(value.id)||!categories.has(value.category)||!integer(value.building,0,24)||!integer(value.tier,0,2))throw fail('物品编号、类型、建筑或等级无效');const id=customItemId(packageId,value.id);if(own(baseItems,id))throw fail('不能覆盖原有物品');items.set(value.id,{id,name:text(value.name,2,40),category:value.category,building:value.building,tier:value.tier,description:text(value.description,6,240),art:validateCustomArt(value.art),source:'cocreation'});}
 for(const value of input.recipes){
  fields(value,['id','item','cost','requires']);
  if(!local(value.id)||value.id!==value.item||!items.has(value.item)||recipes.has(value.id))throw fail('配方需使用对应物品的本地编号');
  fields(value.cost,Object.keys(value.cost||{}));const entries=Object.entries(value.cost);if(!entries.length||entries.length>6||entries.some(([,n])=>!integer(n,1,20)))throw fail('每张配方需 1–6 种材料，每种 1–20 份');
  const cost={},dependencies=[];
  for(const [key,n] of entries){if(key.startsWith('@')){const id=key.slice(1);if(!items.has(id)||id===value.item)throw fail('自定义材料不存在或配方消耗自身');cost[items.get(id).id]=n;dependencies.push(id);}else{if(!own(baseItems,key))throw fail('材料不在基础目录或当前作品内');cost[key]=n;}}
  if(!Array.isArray(value.requires)||value.requires.length>6||new Set(value.requires).size!==value.requires.length)throw fail('前置制作条件无效');
  const requires=value.requires.map(key=>{if(typeof key!=='string')throw fail('前置配方编号无效');if(key.startsWith('@')){const id=key.slice(1);if(!items.has(id)||id===value.item)throw fail('前置配方不存在或指向自身');dependencies.push(id);return customRecipeId(packageId,id);}if(!own(baseRecipes,key))throw fail('前置配方不在目录中');return key;});
  const item=items.get(value.item),id=customRecipeId(packageId,value.id);if(own(baseRecipes,id))throw fail('不能覆盖原有配方');
  recipes.set(value.id,{id,item:item.id,name:item.name,category:item.category,building:item.building,tier:item.tier,definitionVersion:1,cost,requires,dependencies,description:item.description,source:'cocreation'});
 }
 const visiting=new Set(),done=new Set(),ordered=[];
 function visit(id){if(visiting.has(id))throw fail('配方存在循环依赖');if(done.has(id))return;const r=recipes.get(id);if(!r)throw fail('自定义材料缺少对应配方');visiting.add(id);for(const d of r.dependencies)visit(d);visiting.delete(id);done.add(id);ordered.push(r);}
 for(const id of recipes.keys())visit(id);
 const known={...baseItems};
 for(const r of ordered){const value=Object.entries(r.cost).reduce((n,[id,amount])=>n+amount*(known[id]?.price||2),0);r.price=Math.min(24,Math.max(2,Math.floor(value*.6)));delete r.dependencies;const item=[...items.values()].find(i=>i.id===r.item);item.price=r.price;item.recipeId=r.id;known[item.id]=item;}
 return {items:[...items.values()],recipes:ordered};
}

// Snapshots contain only metadata; PNG bytes live in the owner's asset store.
// Craft tickets carry their accepted definition even after a publication changes.
export function validCustomRecipeDefinition(r){
 return object(r)&&r.source==='cocreation'&&typeof r.id==='string'&&r.id.length<=80&&/^recipe_opc_[a-z0-9_]{3,73}$/.test(r.id)&&r.item===r.id.slice(7)&&integer(r.building,0,24)&&integer(r.tier,0,2)&&categories.has(r.category)&&typeof r.name==='string'&&r.name.length>=2&&r.name.length<=40&&object(r.cost)&&Object.keys(r.cost).length>=1&&Object.keys(r.cost).length<=6&&Object.entries(r.cost).every(([id,n])=>/^[a-zA-Z0-9_-]{1,80}$/.test(id)&&id!==r.item&&integer(n,1,20))&&Array.isArray(r.requires)&&r.requires.length<=6&&r.requires.every(id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id))&&integer(r.price,2,24)&&object(r.publication)&&/^opc-[a-z0-9-]+$/.test(r.publication.packageId||'')&&integer(r.publication.version,1,20)&&/^[a-f0-9]{64}$/.test(r.publication.hash||'')&&r.id.startsWith('recipe_'+r.publication.packageId.replaceAll('-','_')+'_');
}

export function validCustomCatalog(c,worldKey){
 if(c===undefined||c===null)return true;
 if(!object(c)||Object.keys(c).some(k=>!['schema','worldKey','items','recipes'].includes(k))||c.schema!==1||c.worldKey!==worldKey||!Array.isArray(c.items)||c.items.length>288||!Array.isArray(c.recipes)||c.recipes.length>288)return false;
 const ids=new Set(),recipes=new Set();
 for(const item of c.items){
  if(!object(item)||item.source!=='cocreation'||typeof item.id!=='string'||item.id.length>73||!/^opc_[a-z0-9_]+$/.test(item.id)||ids.has(item.id)||!integer(item.building,0,24)||!integer(item.tier,0,2)||!categories.has(item.category)||typeof item.name!=='string'||item.name.length<2||item.name.length>40||typeof item.description!=='string'||item.description.length>240||item.recipeId!=='recipe_'+item.id||!integer(item.price,2,24))return false;
  try{validateCustomArt(item.art);}catch{return false;}ids.add(item.id);
 }
 for(const recipe of c.recipes){if(!validCustomRecipeDefinition(recipe)||recipes.has(recipe.id)||!ids.has(recipe.item))return false;recipes.add(recipe.id);}
 return true;
}
