import {validCustomCatalog} from '../src/customContent.js';
import {recipeGate} from '../src/contentCatalog.js';
import {planningRecipeGate} from '../src/craftPlanning.js';

// Populate these fields only from this owner's canonical save. Client catalog
// snapshots never select publications for an Agent or grant tool permissions.
export function agentCatalogContext(state){
 const catalog=state?.customCatalog;
 if(!catalog||!validCustomCatalog(catalog,state.saveSlot))return {customCatalog:null,customPreparableRecipes:[],customRecipeReadiness:{}};
 return {customCatalog:catalog,
  customPreparableRecipes:catalog.recipes.filter(r=>planningRecipeGate(r,state).ready).map(r=>r.id),
  customRecipeReadiness:Object.fromEntries(catalog.recipes.map(r=>[r.id,recipeGate(r,state).ready]))};
}
