import {ALL_RECIPES,contentRecipes,catalogItem} from './contentCatalog.js';
import {availableQuantity} from './resourceLedger.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const venueId=id=>Number.isInteger(id)&&id>=0&&id<25;
export function shopProducts(s,id){
 const rows=new Map(contentRecipes(s).filter(r=>r.building===id).map(r=>[r.item,r]));
 for(const item of s?.customCatalog?.items||[])if(item.building===id&&!rows.has(item.id))rows.set(item.id,{...item,id:item.recipeId,item:item.id,retired:true});
 return [...rows.values()];
}
export const shopCapacity=(id,s=null)=>shopProducts(s,id).length;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const customId=id=>typeof id==='string'&&id.length<=73&&/^opc_[a-z0-9_]+$/.test(id);
export const validShopfrontCatalog=v=>v===undefined||object(v)&&Object.keys(v).length<=288&&Object.entries(v).every(([id,bid])=>customId(id)&&venueId(bid));
export function shopfrontCatalog(s){
 const rows={};for(const list of Object.values(s.shopfronts?.venues||{}))for(const row of list){const item=catalogItem(s,row.item);if(item?.source==='cocreation')rows[item.id]=item.building;}
 return Object.keys(rows).length?rows:null;
}
export function validShopListing(id,listing,s=null,customBuildings=null){
 const capacity=shopCapacity(id,s)+Object.values(customBuildings||{}).filter(bid=>bid===id).length;
 return venueId(id)&&Array.isArray(listing)&&listing.length<=capacity&&new Set(listing.map(r=>r?.item)).size===listing.length&&listing.every(r=>{
  if(!object(r)||Object.keys(r).length!==2||!integer(r.keep)||r.keep>9999)return false;
  const item=catalogItem(s,r.item);return item?['recipe','cocreation'].includes(item.source)&&item.building===id:customId(r.item)&&Object.hasOwn(customBuildings||{},r.item)&&customBuildings[r.item]===id;
 });
}
export function validShopfronts(s,{customBuildings=null}={}){
 const v=s.shopfronts;if(v===undefined)return true;
 return object(v)&&v.version===1&&integer(v.revision)&&object(v.venues)&&Object.keys(v.venues).length<=25&&Object.entries(v.venues).every(([id,rows])=>/^(?:[0-9]|1[0-9]|2[0-4])$/.test(id)&&validShopListing(Number(id),rows,s,customBuildings));
}
export const defaultShelfKeep=(item,s=null)=>catalogItem(s,item)?.category==='food'?0:1;
export function shopListing(s,id){
 return s.shopfronts?.venues?.[id]??ALL_RECIPES.filter(r=>r.building===id).map(r=>({item:r.item,keep:defaultShelfKeep(r.item)}));
}
export function shopItemOffer(s,item){
 const i=catalogItem(s,item);if(!i||!['recipe','cocreation'].includes(i.source))return {listed:false,keep:0,available:0};
 const list=s.shopfronts?.venues?.[i.building],row=list===undefined?(i.source==='recipe'?{item,keep:defaultShelfKeep(item,s)}:null):list.find(r=>r.item===item);
 return {listed:!!row,keep:row?.keep||0,available:row?Math.max(0,availableQuantity(s,item)-row.keep):0};
}
export function shopSummary(s,id){
 const configured=Object.hasOwn(s.shopfronts?.venues||{},id),rows=shopListing(s,id);
 return {configured,mode:!configured?'自动陈列':rows.length?'指定陈列':'暂停售卖',listed:rows.length,stock:rows.reduce((n,r)=>n+shopItemOffer(s,r.item).available,0)};
}
export function configureShopfront(s,{buildingId,listing,expectedShopRevision}){
 if(!venueId(buildingId)||s.buildings?.[buildingId]===undefined)return {ok:false,reason:'请先开放对应建筑'};
 if(expectedShopRevision!==(s.shopfronts?.revision||0))return {ok:false,reason:'货架设置已变化，请重新打开后再保存'};
 if(listing!==null&&!validShopListing(buildingId,listing,s))return {ok:false,reason:'仅可陈列本馆的有效制品，不可重复；保留数量须为 0 至 9999 的整数'};
 s.shopfronts??={version:1,revision:0,venues:{}};
 if(listing===null)delete s.shopfronts.venues[buildingId];else s.shopfronts.venues[buildingId]=listing.map(r=>({item:r.item,keep:r.keep}));
 s.shopfronts.revision++;
 return {ok:true,buildingId,text:listing===null?'已恢复自动陈列：非食品留用一件，食品与余量可出售':listing.length?'货架已更新，游客只购买超过保留数量的陈列商品':'本馆商品已暂停出售，参观等既有体验照常开放'};
}
