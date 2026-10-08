import {ITEM_BY_ID,RECIPE_BY_ID} from './contentCatalog.js';
import {PRODUCTION_VERSION} from './productionNetwork.js';
import {LEGACY_RECIPE_DEFINITIONS} from './legacyRecipeDefinitions-v32.js';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const sameCost=(a,b)=>object(a)&&object(b)&&Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([id,n])=>Object.hasOwn(b,id)&&b[id]===n);
const validCost=c=>object(c)&&Object.keys(c).length>0&&Object.keys(c).length<=32&&Object.entries(c).every(([id,n])=>Object.hasOwn(ITEM_BY_ID,id)&&integer(n,1,9999));
export function recipeContract(recipe){
 return {version:1,catalogVersion:PRODUCTION_VERSION,definitionVersion:recipe.definitionVersion||1,recipeId:recipe.id,item:recipe.item,building:recipe.building,tier:recipe.tier,cost:{...recipe.cost}};
}
export function validRecipeContract(c){
 if(!object(c)||c.version!==1||!integer(c.catalogVersion,1,1000000)||!integer(c.definitionVersion,1,1000000)||!integer(c.tier,0,2)||!validCost(c.cost))return false;
 const r=RECIPE_BY_ID[c.recipeId];return !!r&&c.item===r.item&&c.building===r.building;
}
export function acceptedRecipeContract(t){
 if(!t)return null;
 if(t.recipeContract!==undefined)return validRecipeContract(t.recipeContract)?t.recipeContract:null;
 // Older player tickets lack a cost field. Their original V32 definition is frozen here,
 // rather than guessed from the current catalog or the tool-inclusive reservation.
 const id=t.recipeId||t.intent?.recipeId,legacy=LEGACY_RECIPE_DEFINITIONS[id];
 if(!legacy)return null;
 const cost=t.kind==='resident'?t.cost:legacy.cost;
 const c={version:1,catalogVersion:32,...legacy,cost:{...cost}};
 return validRecipeContract(c)?c:null;
}
export function validAcceptedRecipe(t){
 const c=acceptedRecipeContract(t);if(!c||c.recipeId!==(t.recipeId||t.intent?.recipeId)||c.item!==t.item||c.building!==(t.kind==='resident'?t.intent?.buildingId:t.building))return false;
 if(t.kind==='resident'&&!sameCost(t.cost,c.cost))return false;
 const reserved={...c.cost};if(t.tool?.source==='owned')reserved[t.tool.id]=Math.max(reserved[t.tool.id]||0,1);
 return t.reservedItems===undefined?!t.recipeContract:sameCost(t.reservedItems,reserved);
}
export function acceptedRecipe(t){
 if(!validAcceptedRecipe(t))return null;
 const c=acceptedRecipeContract(t),current=RECIPE_BY_ID[c.recipeId];
 return {...current,tier:c.tier,definitionVersion:c.definitionVersion,productionVersion:c.catalogVersion,cost:{...c.cost}};
}
