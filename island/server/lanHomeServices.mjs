import {createRecruitmentService} from './recruitmentService.mjs';import {createRecruitmentStore} from './recruitmentStore.mjs';import {createPartyPlanningService} from './partyPlanningService.mjs';
const fail=(text,code='lan_home_service',status=409)=>Object.assign(Error(text),{code,status});
export function createLanHomeServices({identities,tenants,agents,now=Date.now}){
 const owners=new Map();let closing=false;
 async function get(token){
  if(closing)throw fail('岛屿服务正在结束，请稍后重试','lan_home_closing',503);
  const c=await tenants.get(token);let pending=owners.get(c.accountId);
  if(!pending){pending=(async()=>{const tools=await agents.homeTools(token),store=createRecruitmentStore({directory:c.directory,now});
   return {c,recruitment:createRecruitmentService({directory:c.directory,saves:c.saves,store,run:tools.recruit,cancel:tools.cancelRecruit}),planning:createPartyPlanningService({saves:c.saves,suggest:tools.suggest,now})};
  })();owners.set(c.accountId,pending);pending.catch(()=>owners.delete(c.accountId));}
  return pending;
 }
 return{
  async recruitment(token,theme,operation,input={}){
   if(!['pixel','origami'].includes(theme)||!['status','hire','retry','cancel','activate','departed','profile','candidate','candidate_manage','recall','renew','policy'].includes(operation))throw fail('招聘操作无效','lan_home_method',400);
   const {c,recruitment}=await get(token);
   if(operation==='status'||operation==='cancel')return recruitment[operation](theme,input);
   return identities.withHomeIsland(c.accountId,theme,()=>recruitment[operation](theme,input));
  },
  async recruitmentObservation(token,theme){const {recruitment}=await get(token);return recruitment.autonomy_observe(theme);},
  async recruitmentDecision(token,theme,result){const {c,recruitment}=await get(token);return identities.withHomeIsland(c.accountId,theme,()=>recruitment.autonomy_decide(theme,result));},
  async propose(token,theme,input){
   const before=await identities.homeAgentContext(token),{planning}=await get(token);
   const result=await planning.propose(theme,input),after=await identities.homeAgentContext(token);
   if(before.travelEpoch!==after.travelEpoch)throw fail('出行状态已变化，请回岛重新设计活动','lan_agent_stale');
   return result;
  },
  async pending(){const result=[];for(const promise of owners.values()){const o=await promise;result.push(...o.recruitment.pending().map(j=>({...j,ownerId:o.c.accountId})));}return result;},
  async close(){closing=true;for(const promise of owners.values()){const o=await promise;await o.recruitment.close();}owners.clear();}
 };
}
