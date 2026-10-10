import {ALL_RECIPES,ITEM_BY_ID} from './contentCatalog.js';
import {availableQuantity} from './resourceLedger.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const venueId=id=>Number.isInteger(id)&&id>=0&&id<25;
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function validShopListing(id,listing){
 return venueId(id)&&Array.isArray(listing)&&listing.length<=12&&new Set(listing.map(r=>r?.item)).size===listing.length&&listing.every(r=>object(r)&&Object.keys(r).length===2&&ITEM_BY_ID[r.item]?.source==='recipe'&&ITEM_BY_ID[r.item].building===id&&integer(r.keep)&&r.keep<=9999);
}
export function validShopfronts(s){
 const v=s.shopfronts;if(v===undefined)return true;
 return object(v)&&v.version===1&&integer(v.revision)&&object(v.venues)&&Object.keys(v.venues).length<=25&&Object.entries(v.venues).every(([id,rows])=>/^(?:[0-9]|1[0-9]|2[0-4])$/.test(id)&&validShopListing(Number(id),rows));
}
export const defaultShelfKeep=item=>ITEM_BY_ID[item]?.category==='food'?0:1;
export function shopListing(s,id){
 return s.shopfronts?.venues?.[id]??ALL_RECIPES.filter(r=>r.building===id).map(r=>({item:r.item,keep:defaultShelfKeep(r.item)}));
}
export function shopItemOffer(s,item){
 const i=ITEM_BY_ID[item];if(i?.source!=='recipe')return {listed:false,keep:0,available:0};
 const list=s.shopfronts?.venues?.[i.building],row=list===undefined?{item,keep:defaultShelfKeep(item)}:list.find(r=>r.item===item);
 return {listed:!!row,keep:row?.keep||0,available:row?Math.max(0,availableQuantity(s,item)-row.keep):0};
}
export function shopSummary(s,id){
 const configured=Object.hasOwn(s.shopfronts?.venues||{},id),rows=shopListing(s,id);
 return {configured,mode:!configured?'自动陈列':rows.length?'指定陈列':'暂停售卖',listed:rows.length,stock:rows.reduce((n,r)=>n+shopItemOffer(s,r.item).available,0)};
}
export function configureShopfront(s,{buildingId,listing,expectedShopRevision}){
 if(!venueId(buildingId)||s.buildings?.[buildingId]===undefined)return {ok:false,reason:'请先开放对应建筑'};
 if(expectedShopRevision!==(s.shopfronts?.revision||0))return {ok:false,reason:'货架设置已变化，请重新打开后再保存'};
 if(listing!==null&&!validShopListing(buildingId,listing))return {ok:false,reason:'每馆仅可陈列本馆的十二种制品；保留数量须为 0 至 9999 的整数'};
 s.shopfronts??={version:1,revision:0,venues:{}};
 if(listing===null)delete s.shopfronts.venues[buildingId];else s.shopfronts.venues[buildingId]=listing.map(r=>({item:r.item,keep:r.keep}));
 s.shopfronts.revision++;
 return {ok:true,buildingId,text:listing===null?'已恢复自动陈列：非食品留用一件，食品与余量可出售':listing.length?'货架已更新，游客只购买超过保留数量的陈列商品':'本馆商品已暂停出售，参观等既有体验照常开放'};
}
