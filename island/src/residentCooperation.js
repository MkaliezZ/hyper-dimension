import {ITEM_BY_ID,RECIPE_BY_ID,DEFAULT_RECIPES,canCraft} from './contentCatalog.js';
import {eventCost,eventRequests,partyDraftStamp,partyPlanningContext} from './partyPlanning.js';
import {preparationNeeds} from './projectPlans.js';
import {BUILDINGS} from './world.js';
import {CROPS} from './farming.js';
export const COOPERATION_PARTIES=Object.freeze({night:'nightParty',fishing:'fishingParty',market:'festivalParty',couture:'coutureParty',fireworks:'fireworksParty'});
const live=e=>['scheduled','meeting','working'].includes(e.status);
export function cooperationPlanFor(e,id){return e.plans?.[id]||e.plan}
export function validCooperationPlan(plan){
 if(!plan||!ITEM_BY_ID[plan.resource])return false;
 const item=ITEM_BY_ID[plan.resource],recipe=RECIPE_BY_ID[plan.recipeId];
 if(plan.recipeId)return !!recipe&&recipe.item===plan.resource&&recipe.building===plan.buildingId&&plan.goal===BUILDINGS[recipe.building].kind;
 if(plan.resource==='seed')return plan.buildingId===14&&plan.goal===BUILDINGS[14].kind;
 if(plan.buildingId===null)return plan.goal==='forest'&&item.source==='forest'||plan.goal==='mine'&&item.source==='mine'||plan.goal==='farm'&&!!CROPS[plan.resource]||plan.goal==='dock'&&['shore','fishing'].includes(item.source);
 return plan.buildingId===14&&['building','workshop',BUILDINGS[14].kind].includes(plan.goal)&&item.source==='greenhouse';
}
export function cooperationPlanReady(s,plan){return validCooperationPlan(plan)&&(!plan.recipeId||canCraft(RECIPE_BY_ID[plan.recipeId],s))}
function quantity(plan){return plan.goal==='forest'?2:plan.goal==='farm'?CROPS[plan.resource].yield:1}
function canonical(command,item){return {goal:command.goal,buildingId:command.buildingId??null,resource:item,...(command.recipeId?{recipeId:command.recipeId}:{})}}
export function activityCooperationNeeds(s,reference=null){
 const results=[];
 for(const [template,field]of Object.entries(COOPERATION_PARTIES)){
  if(reference&&reference.template!==template)continue;
  const book=s[field],d=book?.draft;if(!d||book.session||template==='night'&&s.partySession)continue;
  const stamp=partyDraftStamp(d);if(reference&&(d.id!==reference.id||d.version!==reference.version||stamp!==reference.stamp))continue;
  const project=s.workProjects?.find(p=>p.id===d.projectId);
  // An explicit steward project retains ownership, including when the player pauses it.
  if(project&&['preparing','paused','ready'].includes(project.status))continue;
  const targets={...eventCost(d),...partyPlanningContext(s,template).equipment};delete targets.coins;
  for(const r of eventRequests(d)){const left=Math.max(0,r.quantity-(d.inviteGifts?.[r.id]?.delivered?.[r.item]??d.invites?.[r.id]?.delivered?.[r.item]??0));if(left)targets[r.item]=(targets[r.item]||0)+left;}
  const demand={template,id:d.id,version:d.version,stamp,name:d.name};
  const needs=preparationNeeds(s,{id:'resident-cooperation:'+d.id,targets});
  const nodes=needs.nodes.filter(n=>!n.blocked).map(n=>({...n,plan:canonical(n.command,n.item)})).filter(n=>validCooperationPlan(n.plan));
  results.push({demand,targets,nodes});
 }
 return results;
}
export function cooperationNeedState(s,e){
 if(!e.demand)return {active:true,needed:new Set(e.people.map(id=>cooperationPlanFor(e,id).resource))};
 const current=activityCooperationNeeds(s,e.demand)[0];
 return {active:!!current,needed:new Set(current?.nodes.filter(n=>n.remaining>0).map(n=>n.item)||[])};
}
export function cooperationWorkNeeded(s,e,id){const need=cooperationNeedState(s,e);return need.active&&need.needed.has(cooperationPlanFor(e,id).resource)}
function fit(plan,career,preferred,id){const route=career?.route||[];return (preferred===id?30:0)+(route.includes(plan.buildingId??plan.goal)?18:0)+(plan.goal==='farm'&&route.includes('farm')?12:0);}
export function chooseResidentCooperation(s,people,{careers,options,activityOnly=false,groups=activityCooperationNeeds(s)}={}){
 for(const group of groups){
  const available=group.nodes.filter(n=>n.depends.length===0&&cooperationPlanReady(s,n.plan)).map(n=>({...n,left:n.remaining}));
  for(const e of s.residentStories?.episodes||[])if(live(e)&&e.demand?.id===group.demand.id&&e.demand.version===group.demand.version&&e.demand.stamp===group.demand.stamp)for(const id of e.people)if(!e.contributions[id]){
   const plan=cooperationPlanFor(e,id),node=available.find(n=>n.item===plan.resource);if(node)node.left-=quantity(plan);
  }
  let best=null;
  for(const a of available)for(const b of available){
   if(a.left<=0||b.left-(a===b?quantity(a.plan):0)<=0)continue;
   const af=fit(a.plan,careers?.[people[0]],a.command.npcId,people[0]),bf=fit(b.plan,careers?.[people[1]],b.command.npcId,people[1]);
   if(!af||!bf)continue;const score=af+bf+(a.item!==b.item?12:0);
   if(!best||score>best.score)best={score,plans:{[people[0]]:a.plan,[people[1]]:b.plan}};
  }
  if(best)return {plan:best.plans[people[0]],plans:best.plans,demand:group.demand};
 }
 if(activityOnly)return null;
 // Without a suitable shared activity, retain each person's current occupation.
 const plans={};for(const id of people){
  const o=options?.[id];let plan=o?.resource?canonical(o,o.resource):o?.recipeId?canonical(o,RECIPE_BY_ID[o.recipeId]?.item):null;
  if(!validCooperationPlan(plan)){
   const route=careers?.[id]?.route||[],source=route.find(v=>['farm','mine','forest','dock'].includes(v));
   const resource=({farm:'wheat',mine:'stone',forest:'wood',dock:'fish'})[source]||(route.includes(14)?'herb':null);
   if(resource)plan={goal:source||BUILDINGS[14].kind,buildingId:source?null:14,resource};
  }
  if(!validCooperationPlan(plan)){const recipe=(careers?.[id]?.route||[]).map(b=>DEFAULT_RECIPES[b]).find(r=>r&&canCraft(r,s));if(recipe)plan={goal:BUILDINGS[recipe.building].kind,buildingId:recipe.building,resource:recipe.item,recipeId:recipe.id};}
  if(!cooperationPlanReady(s,plan))return null;plans[id]=plan;
 }
 return {plan:plans[people[0]],plans};
}
// A story may only credit the promised item from that participant's actual job.
export function storyWorkMatches(s,e,id,{goal,buildingId=null,resource,recipeId=null,action='work',step=null}={}){
 const p=cooperationPlanFor(e,id);const plannedGoal=p?.buildingId===14?BUILDINGS[14].kind:p?.goal;
 if(!p||action!=='work'||goal!==plannedGoal||buildingId!==p.buildingId)return false;
 if(p.goal==='farm'&&step==='hoe')return true;
 return resource===p.resource&&(recipeId||null)===(p.recipeId||null);
}

export function cooperationWorkAuthorized(s,{storyId,actorId,operationId,intent},starting=false){
 if(!storyId)return true;
 const e=s.residentStories?.episodes?.find(e=>e.id===storyId);
 return !!e&&['scheduled','working'].includes(e.status)&&e.stage==='work'&&e.people.includes(actorId)&&!e.contributions[actorId]&&e.inFlight[actorId]?.operationId===operationId&&storyWorkMatches(s,e,actorId,intent)&&(!starting||cooperationWorkNeeded(s,e,actorId));
}

export function cooperationPlotClaim(s,index){
 for(const e of s.residentStories?.episodes||[])if(live(e)&&e.stage==='work')for(const [id,site] of Object.entries(e.workSites||{}))if(site.farmIndex===index&&!e.contributions[id])return {episode:e,actorId:Number(id)};
 return null;
}
export function cooperationFarmAvailable(s,index,actorId,storyId=null){
 const held=cooperationPlotClaim(s,index);if(held&&(held.actorId!==actorId||held.episode.id!==storyId))return false;
 const own=storyId&&s.residentStories?.episodes.find(e=>e.id===storyId)?.workSites?.[actorId];
 return !own||own.farmIndex===index;
}
export function bindCooperationPlot(s,storyId,actorId,index){
 if(!storyId)return;const e=s.residentStories.episodes.find(e=>e.id===storyId);e.workSites??={};e.workSites[actorId]={farmIndex:index};e.version++;
}
export function releaseCooperationPlotToPlayer(s,index){
 const claim=cooperationPlotClaim(s,index);if(!claim)return;delete claim.episode.workSites[claim.actorId];claim.episode.version++;
}
