import {catalogRecipe} from './contentCatalog.js';
import {planningRecipeGate,planRecipeAssignment} from './craftPlanning.js';
import {BUILDINGS} from './world.js';

// A small workshop sample, grounded in the resident's trade. Stock includes
// reserved goods; a project holding the last copy must not trigger overproduction.
export function customProductionOptions(s,{route,history=[],profile={},crowd=()=>0}){
 if(history.filter(h=>h.day===s.day&&h.action==='work'&&h.purposeId?.startsWith('custom:')).length>=2)return [];
 const buildings=new Set(route.filter(Number.isInteger));
 const leases=s.residentControl?.leases||[],traits=[profile.job,profile.personality,...profile.interest||[]].join(' ');
 return (s.customCatalog?.recipes||[]).filter(r=>buildings.has(r.building)&&planningRecipeGate(r,s).ready).flatMap(r=>{
  if((s.agentTaskLedger||[]).some(t=>t.targetItem===r.item&&['queued','running','waiting','paused'].includes(t.status)))return [];
  const target=['component','food'].includes(r.category)?2:1,stock=(s.inventory[r.item]||0)+leases.filter(t=>t.item===r.item&&t.mode==='craft').length;
  if(stock>=target)return [];
  const purposeId='custom:'+r.id;if(leases.some(t=>t.intent?.purposeId===purposeId))return [];
  const preference=r.category==='gift'&&/信|交流|通信|友善/.test(traits)||r.category==='decor'&&/设计|美|创作/.test(traits)||r.category==='food'&&/烹|食|照护/.test(traits);
  const decision=planRecipeAssignment(catalogRecipe(s,r.id),s,{goal:BUILDINGS[r.building].kind,buildingId:r.building,action:'work',activity:'station',recipeId:r.id,purposeId,item:r.item,score:66+(r.category==='component'?0:2)+(preference?3:0)-crowd(r.building)*4,reason:'在本职工坊准备'+r.name+'样品，现存'+stock+' / '+target+'份'});
  return decision.blocked?[]:[decision];
 }).sort((a,b)=>b.score-a.score||a.purposeId.localeCompare(b.purposeId)).slice(0,2);
}
