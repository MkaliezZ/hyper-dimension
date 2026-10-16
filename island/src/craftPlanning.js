import {taskOwner} from './taskBoard.js';
import {availableQuantity,reserveResources} from './resourceLedger.js';
import {catalogItem,catalogRecipe,recipeGate} from './contentCatalog.js';import {BUILDINGS} from './world.js';
export function planningRecipeGate(recipe,s,path=[]){
 if(!recipe||path.includes(recipe.id)||path.length>24)return {ready:false,text:'配方依赖需要重新核对'};
 const current=recipeGate(recipe,s);if(current.ready)return current;
 const missing=(recipe.requires||[]).filter(id=>!(s.craftHistory?.[id]>0));if(!missing.length)return current;
 const future={...s,craftHistory:{...s.craftHistory}};
 for(const id of missing){const before=catalogRecipe(s,id),gate=planningRecipeGate(before,future,[...path,recipe.id]);if(!gate.ready)return gate;future.craftHistory[id]=Math.max(1,future.craftHistory[id]||0);}
 return recipeGate(recipe,future);
}
// Resolve the entire ingredient chain before dispatching the next physical action.
export function planRecipeAssignment(recipe,s,task,{server=false,path=[]}={}){
 if(!recipe||path.includes(recipe.id)||path.length>24)return {...task,blocked:true,preparing:true,reason:'制作依赖需要重新核对'};
 const required=(recipe.requires||[]).find(id=>!(s.craftHistory?.[id]>0));
 if(required)return planRecipeAssignment(catalogRecipe(s,required),s,{...task,preparing:true,reason:'为'+recipe.name+'先完成前置制作'},{server,path:[...path,recipe.id]});
 const gate=recipeGate(recipe,s);
 const owner=task.resourceOwner||null;
 if(owner&&(!s.planningControl?.enabled||server)){const desired={...(s.resourceLedger?.reservations[owner]?.items||{})};for(const [id,n] of Object.entries(recipe.cost))desired[id]=Math.max(desired[id]||0,n);reserveResources(s,owner,desired,{partial:true,purpose:task.reason||recipe.name});}
 const missing=Object.entries(recipe.cost).find(([id,n])=>availableQuantity(s,id,owner)<n);
 if(!missing)return gate.ready?{...task,goal:BUILDINGS[recipe.building].kind,buildingId:recipe.building,recipeId:recipe.id,resource:null}:{...task,goal:BUILDINGS[recipe.building].kind,buildingId:recipe.building,recipeId:recipe.id,resource:null,blocked:true,reason:gate.text};
 const ingredient=catalogItem(s,missing[0]),sub=catalogRecipe(s,ingredient?.recipeId);
 if(sub)return planRecipeAssignment(sub,s,{...task,preparing:true,reason:'为'+recipe.name+'制作组件'+sub.name},{server,path:[...path,recipe.id]});
 if(!ingredient||ingredient.recipeId)return {...task,blocked:true,preparing:true,reason:'当前材料的制作配方未启用'};
 const source=ingredient.id==='seed'?'greenhouse':ingredient.source,resource=ingredient.id==='seed'?'herb':ingredient.id;
 return {...task,goal:source==='greenhouse'?BUILDINGS[14].kind:['shore','fishing'].includes(source)?'dock':source,buildingId:source==='greenhouse'?14:null,resource,recipeId:null,preparing:true,reason:'为'+recipe.name+'准备'+ingredient.name};
}


// Both the walking planner and the authoritative action gate resolve the same next step.
export function planAssignedTask(s,t,{server=false}={}){
 const c=t.command,bid=Number.isInteger(c.buildingId)?c.buildingId:({workshop:0,tea:1,gallery:11})[c.goal]??null;
 let d={goal:c.goal,buildingId:bid,action:'work',recipeId:c.recipeId||null,resource:c.resource||(!c.recipeId&&catalogItem(s,t.targetItem)?.category==='material'?t.targetItem:null),resourceOwner:t.resourceOwner||taskOwner(t.id),preparing:false,reason:t.intent};
 if(d.recipeId&&!t.projectId)d=planRecipeAssignment(catalogRecipe(s,d.recipeId),s,d,{server});
 return d;
}
