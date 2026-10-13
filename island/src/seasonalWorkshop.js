// Called only while constructing a new game from the server-selected recipe.
// The detached projection lives in the saved rule state, so an in-flight game
// never changes its ingredients when a catalog or season changes after reload.
export function applySeasonalWorkshopRecipe(level,recipe,random){
 if(!recipe?.seasonal||recipe.building!==level.id)return level;
 const ingredients=Object.entries(recipe.cost).map(([id,amount])=>({id,amount}));
 level.production={version:1,recipeId:recipe.id,item:recipe.item,name:recipe.name,ingredients};
 if(level.kind==='tea'){
  level.ids=[...ingredients.map(i=>i.id),recipe.item];
  level.values=level.ids.flatMap((_,i)=>[i,i]);
  for(let i=level.values.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[level.values[i],level.values[j]]=[level.values[j],level.values[i]];}
  level.cols=4;level.turns=level.ids.length+[5,3,2][level.d-1];level.preview=[4,3,2][level.d-1];
 }
 if(level.kind==='kitchen'){
  level.ids=ingredients.map(i=>i.id);
  level.production.cutCounts=Object.fromEntries(level.ids.map(id=>[id,['rice','seasalt','honey','wheat'].includes(id)?0:2]));
  // Every order represents preparation of this dish. Quantities stay on the
  // accepted bill; the game never consumes inventory once per simulated guest.
  for(const order of level.orders){
   order.ingredients=level.ids.map((_,i)=>i);
   for(let i=order.ingredients.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order.ingredients[i],order.ingredients[j]]=[order.ingredients[j],order.ingredients[i]];}
  }
 }
 return level;
}
