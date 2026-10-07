import {FUNCTIONAL_FACILITIES,functionalDefinition} from './facilityCatalog.js';
import {ALL_RECIPES,ITEM_BY_ID,RECIPE_BY_ID,recipeGate} from './contentCatalog.js';
import {GARMENTS,WEAR_SLOTS,toolPurpose} from './equipmentRules.js';
import {townOrders,visitorPrice} from './economy.js';
import {BUILDINGS} from './world.js';
import {TOURISTS} from './townSimulation.js';
const direct={
 tool:{action:'装备',text:'装备到对应作业工具栏；耕种、采矿或钓鱼时使用该物品图像。'},
 food:{action:'享用',text:'补充岛主体力和饱足；接下来三次手作额外提升设施品质。也能赠送给饥饿的居民。'},
 wear:{action:'穿上服装',text:'从背包取用一套作为主题穿着，换下时完整放回；承办星灯夜集时获得 2 岛币着装奖励。'},
 study:{action:'阅读研究',text:'消耗一份，本馆研究熟练度 +1，帮助开放进阶图纸。'},
 seedling:{action:'研究种苗',text:'消耗一份，获得通用种子 ×2，本馆研究熟练度 +1。'},
 gift:{action:'赠送',text:'交给指定居民，增加好感并留下真实收礼记忆。'},
 component:{action:'布置到岛上',text:'作为后续制作的中间材料；也可选择岛上空位陈列，收回后继续加工。'},
 collection:{action:'布置到岛上',text:'选择安全空位展示，可旋转、移动和收回；同馆仅按最高陈列计 1–3 点品质。'},
 decor:{action:'布置到岛上',text:'在岛上空位预览后确认；同馆最高陈列增加 1–3 点品质，不靠堆叠刷品质。摆件会占地，居民绕行。'}
};
export function itemPurpose(id,s){
 const item=ITEM_BY_ID[id];if(!item)return null;const recipe=RECIPE_BY_ID[item.recipeId];
 const facility=functionalDefinition(id);
 const equipment=facility?{action:'布置功能设施',text:facility.description}:item.category==='tool'?toolPurpose(id,s):item.category==='wear'?{action:'穿上'+WEAR_SLOTS[GARMENTS[id].slot],text:'实际显示在地图与室内角色上，八方向和作业动作同步；占用'+WEAR_SLOTS[GARMENTS[id].slot]+'，可与其他部位搭配。替换或换下归还原件。'+(GARMENTS[id].onePiece?'连身衣会收好已有下装。':'')+(id==='c4_4'?'采矿精准区额外拓宽 3 个百分点。':'')}:null;
 const fishing={rod:'海风钓鱼大会所需渔竿 ×1，开场预留、结束归还',c8_2:'海风钓鱼大会所需海风旗 ×1，可反复使用',c16_4:'海风钓鱼大会开场消耗 ×1，一份供六竿使用',c16_2:'邀请小满参加钓鱼大会，交付贝壳浮漂 ×1',bread:'钓鱼大会开场点心 ×2，另备 ×1 亲自邀请露露'};
 const next=ALL_RECIPES.filter(r=>r.cost[id]).map(r=>({id:r.item,name:r.name,quantity:r.cost[id],building:r.building,crossWorkshop:!!recipe&&r.building!==recipe.building,ready:recipeGate(r,s).ready}));
 const buyers=recipe?TOURISTS.filter(t=>t.likes.includes(recipe.building)).map(t=>t.name):[];
 const order=townOrders(s).find(o=>o.item===id),party=id==='lantern'?'星灯夜集必需灯笼 ×1':id==='wheat'?'星灯夜集必需小麦 ×2':id==='firework'?'星海烟花大会：预留 ×6，只消耗实际发射者；也可用于夜集单枚助兴':item.category==='wear'?'先设为主题穿着，再承办派对；着装奖励 +2 岛币':null;
 const inputs=recipe?Object.entries(recipe.cost).filter(([input])=>ITEM_BY_ID[input]?.recipeId).map(([input,quantity])=>({id:input,name:ITEM_BY_ID[input].name,quantity,building:ITEM_BY_ID[input].building,crossWorkshop:ITEM_BY_ID[input].building!==recipe.building})):[];
 const facilityUses=Object.entries(FUNCTIONAL_FACILITIES).filter(([,d])=>d.cost[id]).map(([display,d])=>({item:display,name:d.name,quantity:d.cost[id],description:d.description}));
 return {item,recipe,inputs,facilityUses,primary:equipment||(id==='c16_4'?{action:'派对筹备',text:'留作钓鱼大会六竿的消耗品，开场时统一使用；不作为庭院摆件。'}:direct[item.category]||{action:'制作材料',text:'选择下列真实配方，采集后按材料数量投入制作。'}),next,buyers,building:recipe?BUILDINGS[recipe.building].name:null,marketPrice:recipe?visitorPrice(id,recipe):null,order,fishing:!!fishing[id],party:[party,fishing[id]].filter(Boolean).join('；')||null};
}
