import {CRAFT_SPECIFICATIONS} from './craftSpecifications.js';
// One authoritative bill for every stable item ID. Accepted tasks retain their detached contract.
export const PRODUCTION_VERSION=123;
export const COMMON_COMPONENTS={
 c0_7:{tier:0,category:'component',role:'木作构件'},
 c7_5:{tier:0,category:'component',role:'纸品'},
 c24_1:{tier:0,category:'component',role:'矿物着色'},
 c24_5:{tier:0,category:'component',role:'植物染色'},
 c16_5:{tier:0,category:'component',role:'线材'},
 c16_6:{tier:0,category:'component',role:'金属钓具'},
 c23_0:{tier:0,category:'component',role:'防水船材'}
};
const USES={
 decor:'在所属建筑庭院陈列，提升设施品质与访客吸引力；移动或收回不销毁物品。',
 collection:'收藏并在建筑庭院陈列，完善图鉴；移动或收回保留原件。',
 food:'享用补充体力与饱足，也可给居民、补货或投入食物组合配方。',
 tool:'装备到对应作业工具栏，在耕种、采矿或钓鱼时使用该工具图像。',
 wear:'实际穿戴在角色上，也可作为派对主题穿着、居民礼物或服装收藏。',
 study:'投入本馆研究，提升制作熟练度，帮助开放进阶图纸。',
 seedling:'研究育苗材料，获得通用种子与本馆熟练度；也可继续制作花圃。',
 component:'作为后续制作的中间材料；也可陈列，收回后继续加工。',
 gift:'赠送居民、寄送或继续组合成礼盒；收礼记忆与好感会记录。'
};
export function connectWorkshops(rows){
 const ids=new Set(rows.map(r=>r.item));
 if(ids.size!==rows.length)throw Error('Duplicate production output');
 for(const id of Object.keys(CRAFT_SPECIFICATIONS))if(!ids.has(id))throw Error('Unknown craft specification '+id);
 return rows.map(r=>{
  const specification=CRAFT_SPECIFICATIONS[r.item];if(!specification)throw Error('Missing craft specification '+r.item);
  const [bill,construction,options={}]=specification,shared=COMMON_COMPONENTS[r.item]||{},category=options.category||shared.category||r.category,tier=options.tier??shared.tier??r.tier;
  if(!USES[category]||!Number.isInteger(tier)||tier<0||tier>2||typeof construction!=='string'||construction.length<12)throw Error('Invalid craft definition '+r.item);
  if(!Object.keys(bill).length)throw Error('Empty craft bill '+r.item);
  for(const [id,n] of Object.entries(bill))if(!Number.isSafeInteger(n)||n<1)throw Error('Invalid production quantity '+id);
  return {...r,...shared,...options,tier,category,cost:{...bill},construction,definitionVersion:4,productionVersion:PRODUCTION_VERSION,use:r.item==='c14_8'?'在已播种的农田施肥，一袋供三次收获各增加一份作物，不缩短成熟时间；也可用于育苗制作。':USES[category]};
 });
}
export function workshopEdges(recipes){
 const byItem=new Map(recipes.map(r=>[r.item,r]));
 return recipes.flatMap(r=>Object.entries(r.cost).filter(([id])=>byItem.has(id)).map(([id,quantity])=>({input:id,output:r.item,from:byItem.get(id).building,to:r.building,quantity})));
}
export function checkWorkshopGraph(recipes,materials){
 const byItem=new Map(recipes.map(r=>[r.item,r])),raw=new Set(materials.map(m=>m.id)),done=new Map(),active=new Set();
 function visit(id){
  if(raw.has(id))return 0;if(done.has(id))return done.get(id);
  if(!byItem.has(id))throw Error('Unknown production input '+id);
  if(active.has(id))throw Error('Production cycle '+id);active.add(id);
  const depth=1+Math.max(0,...Object.keys(byItem.get(id).cost).map(visit));active.delete(id);done.set(id,depth);return depth;
 }
 for(const r of recipes)visit(r.item);
 return {edges:workshopEdges(recipes),maxDepth:Math.max(...done.values())};
}
