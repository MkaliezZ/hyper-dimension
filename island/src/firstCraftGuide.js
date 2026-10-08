import {ALL_RECIPES,ITEM_BY_ID} from './contentCatalog.js';
import {availableQuantity} from './resourceLedger.js';

// The first milestone follows the live physical bill and excludes stock reserved elsewhere.
export function firstCraftPreparation(state){
 const recipe=ALL_RECIPES.find(r=>r.item==='lantern');
 const materials=Object.entries(recipe.cost).map(([id,required])=>{
  const item=ITEM_BY_ID[id],available=availableQuantity(state,id);
  return {id,name:item.name,required,available,missing:Math.max(0,required-available),source:item.source,action:'material:'+id};
 });
 const missing=materials.filter(m=>m.missing>0),bill=materials.map(m=>m.name+' ×'+m.required).join('、');
 return {recipeId:recipe.id,materials,missing,ready:missing.length===0,bill,
  detail:missing.length?'灯笼需要'+bill+'。还缺'+missing.map(m=>m.name+' ×'+m.missing).join('、')+'；按按钮前往真实采集地点。已被其他作业预留的材料不计入可用量。':'材料已经齐备：'+bill+'。进入木作工坊完成拼合，做出星灯。'};
}
