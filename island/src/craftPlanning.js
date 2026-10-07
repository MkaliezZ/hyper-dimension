import {taskOwner} from './taskBoard.js';
import {availableQuantity,reserveResources} from './resourceLedger.js';
import {ITEM_BY_ID,RECIPE_BY_ID} from './contentCatalog.js';import {BUILDINGS} from './world.js';
// Resolve the entire ingredient chain before dispatching the next physical action.
export function planRecipeAssignment(recipe,s,task,{server=false}={}){
 const owner=task.resourceOwner||null;
 if(owner&&(!s.planningControl?.enabled||server)){const desired={...(s.resourceLedger?.reservations[owner]?.items||{})};for(const [id,n] of Object.entries(recipe.cost))desired[id]=Math.max(desired[id]||0,n);reserveResources(s,owner,desired,{partial:true,purpose:task.reason||recipe.name});}
 const missing=Object.entries(recipe.cost).find(([id,n])=>availableQuantity(s,id,owner)<n);
 if(!missing)return {...task,goal:BUILDINGS[recipe.building].kind,buildingId:recipe.building,recipeId:recipe.id,resource:null};
 const ingredient=ITEM_BY_ID[missing[0]],sub=RECIPE_BY_ID[ingredient?.recipeId];
 if(sub)return planRecipeAssignment(sub,s,{...task,preparing:true,reason:'为'+recipe.name+'制作组件'+sub.name},{server});
 if(!ingredient)return {...task,preparing:true,reason:'等待图纸材料信息'};
 const source=ingredient.id==='seed'?'greenhouse':ingredient.source,resource=ingredient.id==='seed'?'herb':ingredient.id;
 return {...task,goal:source==='greenhouse'?BUILDINGS[14].kind:['shore','fishing'].includes(source)?'dock':source,buildingId:source==='greenhouse'?14:null,resource,recipeId:null,preparing:true,reason:'为'+recipe.name+'准备'+ingredient.name};
}


// Both the walking planner and the authoritative action gate resolve the same next step.
export function planAssignedTask(s,t,{server=false}={}){
 const c=t.command,bid=Number.isInteger(c.buildingId)?c.buildingId:({workshop:0,tea:1,gallery:11})[c.goal]??null;
 let d={goal:c.goal,buildingId:bid,action:'work',recipeId:c.recipeId||null,resource:c.resource||(!c.recipeId&&ITEM_BY_ID[t.targetItem]?.category==='material'?t.targetItem:null),resourceOwner:t.resourceOwner||taskOwner(t.id),preparing:false,reason:t.intent};
 if(d.recipeId&&!t.projectId&&Object.hasOwn(RECIPE_BY_ID,d.recipeId))d=planRecipeAssignment(RECIPE_BY_ID[d.recipeId],s,d,{server});
 return d;
}
