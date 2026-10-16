export const RESIDENT_PLAN_GOALS=Object.freeze(['farm','mine','plaza','workshop','tea','gallery','forest','dock']);
const goals=new Set(RESIDENT_PLAN_GOALS),actions=new Set(['work','social','rest','visit','eat']);
// A sleeping resident has no new purpose to choose. This is not an AI decision.
export function residentPlanAvailability(residents){
 const rows=Array.isArray(residents)?residents:[],seen=new Set(),requestedIds=[],skippedIds=[];
 for(const r of rows){
  if(!Number.isInteger(r?.id)||r.id<0||r.id>=15||seen.has(r.id))continue;seen.add(r.id);
  const actionable=r.schedule?.period!=='sleep'&&Array.isArray(r.options)&&r.options.some(o=>typeof o?.purposeId==='string'&&o.purposeId.trim().length>0&&o.purposeId.length<=160&&goals.has(o.goal)&&actions.has(o.action));
  (actionable?requestedIds:skippedIds).push(r.id);
 }
 const sleeping=seen.size>0&&rows.filter(r=>seen.has(r?.id)).every(r=>r.schedule?.period==='sleep');
 return {requestedIds,skippedIds,reason:requestedIds.length?null:sleeping?'sleeping':'no_actionable_purposes',message:sleeping?'居民正在休息 · 本轮无需模型规划':'暂无可执行的新安排 · 沿用当前生活'};
}
