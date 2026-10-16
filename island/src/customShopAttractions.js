import {catalogItem} from './contentCatalog.js';
import {shopItemOffer} from './shopfronts.js';

const tastes={
 '花草与茶香':['food','decor'],
 '收藏与知识':['study','gift','decor'],
 '海岛美食':['food'],
 '音乐与舞台':['gift','decor','study'],
 '海洋与航船':['component','decor','study'],
 '工艺与服饰':['component','decor','gift'],
 '自然与露营':['food','decor','study'],
 '摄影与精品展览':['gift','decor','study']
};
export const customProductAttracts=(item,tourist)=>item?.source==='cocreation'&&(tastes[tourist.taste]||[]).includes(item.category);
// Only deliberately stocked, fitting custom products add destinations. Publishing
// alone does not change a visitor's tastes, boat capacity or spending budget.
export function customShopVenues(s,tourist){
 return Object.entries(s.shopfronts?.venues||{}).filter(([,rows])=>rows.some(row=>{const item=catalogItem(s,row.item);return customProductAttracts(item,tourist)&&shopItemOffer(s,item.id).available>0;})).map(([id])=>Number(id));
}
