// Declarative workshop dependencies. IDs and artwork stay stable across catalog revisions.
export const PRODUCTION_VERSION=32;
export const COMMON_COMPONENTS={
 c0_7:{tier:0,category:'component',cost:{wood:3},role:'木作构件'},
 c7_5:{tier:0,category:'component',cost:{bark:2,leaves:1,fiber:1},role:'纸品'},
 c24_1:{tier:0,category:'component',cost:{ore:1,clay:1,quartz:1},role:'矿物着色'},
 c24_5:{tier:0,category:'component',cost:{bluegrass:2,seasalt:1},role:'植物染色'},
 c16_5:{tier:0,category:'component',cost:{fiber:2,wax:1},role:'线材'},
 c23_0:{tier:0,category:'component',cost:{c0_7:2,resin:1},role:'防水船材'}
};
export const WORKSHOP_LINKS={
 c0_8:{c24_5:1},c0_10:{c7_0:1},c0_11:{c15_1:1},
 c1_4:{c15_1:1},c1_9:{c15_4:1},c1_10:{c17_5:1,c11_4:1},c1_11:{c15_1:1,c24_5:1},
 c2_3:{c15_3:1},c2_4:{tea:1},c2_8:{c15_3:1},c2_10:{c17_1:1,c1_4:1},c2_11:{c7_5:1},
 c3_1:{pottery:1},c3_7:{c15_2:1},c3_9:{c0_7:2,lantern:1},c3_11:{c15_8:1},
 c4_2:{c24_5:1},c4_6:{c24_1:1},c4_8:{c3_2:1,c24_5:1},c4_11:{c3_2:1},
 c5_0:{c7_5:1},c5_4:{c15_1:1},c5_8:{c0_7:1,c24_1:1},c5_10:{lantern:1,c15_8:1},
 c6_2:{pottery:1},c6_6:{c0_7:1},c6_9:{lantern:1},c6_10:{c15_9:1,c23_1:1},c6_11:{c7_5:2,c13_0:1},
 c7_1:{c14_1:1},c7_6:{c13_3:1},c7_8:{lantern:1},c7_10:{c11_1:1,c13_0:1},c7_11:{c0_7:2},
 c8_5:{c7_6:1},c8_9:{c0_7:1,c24_5:1},c8_11:{c15_8:1,lantern:1},
 c9_1:{bouquet:1},c9_4:{tea:1,bread:1,c15_3:1},c9_7:{c0_7:2},c9_8:{c9_4:1,c13_1:1},c9_9:{c24_5:1,c0_7:2},c9_11:{c21_0:1,c0_7:2},
 c10_4:{c15_1:1},c10_8:{c15_3:1},c10_9:{c19_3:1},c10_10:{bouquet:1},c10_11:{c7_5:2,c7_1:1},
 c11_1:{c7_5:1,c13_0:1},c11_2:{c7_5:1,bouquet:1},c11_3:{c7_5:1},c11_7:{c7_5:1,c8_5:1},c11_8:{c7_5:1,c3_2:1},c11_9:{c7_5:2},
 c12_2:{c0_7:1},c12_6:{c0_7:2,c16_5:1},c12_8:{c7_5:1,c5_0:1},c12_10:{c24_1:1},
 c13_1:{c0_7:1},c13_2:{c7_5:2,bouquet:1},c13_3:{c7_5:1,c5_0:1},c13_5:{c0_7:2},c13_8:{c11_8:1},c13_11:{c7_5:2,c11_1:1},
 c14_7:{c0_7:1},c14_9:{c19_4:1},c14_10:{c0_7:1,c11_3:1},c14_11:{c3_1:1},
 c15_5:{c24_1:1},c15_6:{c24_5:1},c15_10:{c5_0:1,c24_1:1},
 c16_1:{c0_7:1},c16_8:{c6_0:1,c8_5:1},c16_9:{c0_7:1},c16_11:{c0_7:2,c19_0:1},
 c17_5:{tea:1},c17_7:{c1_3:1},c17_9:{c3_3:1},c17_10:{c15_3:1},c17_11:{c9_4:1,c15_6:1},
 c18_4:{pottery:1},c18_5:{c7_6:1},c18_6:{c7_5:1},c18_7:{c0_7:2},c18_10:{c5_7:1},c18_11:{c13_3:1,c23_8:1,c22_11:1},
 c19_5:{c3_3:1},c19_7:{c0_7:2},c19_8:{lantern:1,c15_8:1},c19_9:{c0_6:1},c19_11:{c0_7:3,c15_6:1},
 c20_4:{c7_5:1},c20_5:{c24_1:1},c20_7:{c11_4:1,c7_5:1},c20_9:{c12_0:1},c20_10:{c0_7:2},
 c21_0:{c7_5:2},c21_2:{c0_7:1},c21_4:{c11_8:1},c21_6:{c12_0:1},c21_7:{c8_0:1},c21_8:{c3_9:1,c13_8:1},c21_9:{outfit:1,c0_7:2},c21_10:{lantern:2,c8_0:1},c21_11:{c12_6:1,firework:1},
 c22_4:{c10_2:1},c22_5:{c15_3:1,meal:1},c22_7:{c15_6:1},c22_8:{c5_1:1},c22_9:{lantern:1},c22_10:{c21_1:1,c8_2:1},c22_11:{c0_7:2,c14_0:1},
 c23_5:{c16_6:1},c23_8:{c0_7:1},c23_9:{c0_7:2},c23_10:{c21_8:1,firework:1},c23_11:{c8_5:1,c23_7:1},
 c24_3:{c0_7:1},c24_4:{c7_5:1},c24_7:{c15_5:1},c24_9:{c0_9:1,c24_5:1},c24_10:{c4_6:1},c24_11:{c18_11:1,c9_9:1}
};
export function connectWorkshops(rows){
 const ids=new Set(rows.map(r=>r.item));
 for(const id of [...Object.keys(COMMON_COMPONENTS),...Object.keys(WORKSHOP_LINKS)])if(!ids.has(id))throw Error('Unknown production output '+id);
 return rows.map(r=>{
  const shared=COMMON_COMPONENTS[r.item],links=WORKSHOP_LINKS[r.item];
  if(!shared&&!links)return {...r,definitionVersion:1};
  const cost={...(shared?.cost||r.cost),...links};
  for(const [id,n] of Object.entries(cost))if(!Number.isSafeInteger(n)||n<1)throw Error('Invalid production quantity '+id);
  return {...r,...shared,cost,definitionVersion:2,previousCost:{...r.cost},productionVersion:PRODUCTION_VERSION,
   use:shared?'跨建筑的'+shared.role+'，用于后续图纸、筹备与陈列。':r.use};
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
