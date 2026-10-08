import {recipeContract,acceptedRecipe,validAcceptedRecipe} from '../src/recipeContracts.js';
import {routineFor} from '../src/residentLife.js';
import {cooperationWorkAuthorized} from '../src/residentCooperation.js';
import {beginAssignedStep} from './planningAuthority.mjs';
import {randomUUID} from 'node:crypto';
import {hydrateTown,commitWork,RECIPES,career,needs} from '../src/townSimulation.js';
import {RAW_MATERIALS,RECIPE_BY_ID,ITEM_BY_ID,canCraft,recipeGate} from '../src/contentCatalog.js';
import {reserveResources,releaseResources,availableQuantity,hydrateResources} from '../src/resourceLedger.js';
import {recordTaskStep,taskOwner,hydrateTaskBoard} from '../src/taskBoard.js';
import {recordResidentStoryWork,interruptResidentStory} from '../src/residentStories.js';
import {functionalUnit} from '../src/functionalFacilities.js';
import {resolveTool} from '../src/equipmentRules.js';
import {ROOMS} from '../src/rooms.js';
import {BUILDINGS} from '../src/world.js';
import {NPC_CADENCE} from '../src/npcCadence.js';
export const RESIDENT_LEASE_PREFIX='server-resident:';
const fail=(text,code='resident_invalid')=>Object.assign(Error(text),{status:409,code});
const key=v=>typeof v==='string'&&/^[-\w:.]{1,160}$/.test(v)&&!['__proto__','constructor','prototype'].includes(v);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fields=['goal','buildingId','action','activity','resource','recipeId','foodId','facilityId','purposeId','source','assignmentId','operationId','storyId','preparing'];
const signature=i=>JSON.stringify([i.actorId,i.gameTime??0,...fields.map(k=>i.intent?.[k]??null)]);
export const residentTickets=b=>Object.values(b?.resident?.leases||{});
export const residentActorOccupied=(b,i)=>[b?.active,...Object.values(b?.farm?.leases||{}),...Object.values(b?.field?.leases||{}),...residentTickets(b)].some(t=>t&&t.actor==='npc'&&t.actorId===i);
const publicTicket=t=>({requestId:t.requestId,actorId:t.actorId,assignmentId:t.assignmentId,operationId:t.operationId,sequence:t.sequence,sourceOwner:t.sourceOwner,sourceTransfer:t.sourceTransfer});
const control=b=>({version:1,leases:residentTickets(b).map(publicTicket)});
export function validResidentTicket(t){return !!t&&t.kind==='resident'&&(t.mode!=='craft'||validAcceptedRecipe(t))&&t.actor==='npc'&&Number.isInteger(t.actorId)&&t.actorId>=0&&t.actorId<=16&&id(t.requestId)&&id(t.epoch)&&Number.isSafeInteger(t.sequence)&&t.sequence>0&&typeof t.item==='string'&&key(t.operationId)&&key(t.owner)&&t.owner.startsWith(RESIDENT_LEASE_PREFIX)&&Number.isFinite(t.duration)&&t.duration>=9&&t.duration<=NPC_CADENCE.workSeconds&&Number.isFinite(t.startedAt)&&t.readyAt>=t.startedAt+t.duration*1000&&Number.isFinite(t.expiresAt)&&t.expiresAt>t.readyAt&&t.intent&&['work','eat','rest','visit'].includes(t.intent.action)&&typeof t.beginSignature==='string';}
export function validResidentBook(r,b){return r===undefined||!!r&&r.version===1&&r.leases&&typeof r.leases==='object'&&!Array.isArray(r.leases)&&Object.keys(r.leases).length<=17&&Object.entries(r.leases).every(([k,t])=>validResidentTicket(t)&&k===t.requestId&&t.epoch===b.epoch&&t.sequence<=b.sequence)&&new Set(Object.values(r.leases).map(t=>t.actorId)).size===Object.keys(r.leases).length;}
export function residentHolds(b){const out={};for(const t of residentTickets(b))if(Object.keys(t.reservedItems).length)out[t.owner]={items:Object.fromEntries(Object.entries(t.reservedItems).sort(([a],[b])=>a.localeCompare(b))),purpose:'居民作业 '+t.name,day:t.day,...(t.projectReservation?{projectTaskId:t.assignmentId,taskOperation:t.operationId,productionItem:t.item}:{})};return out;}
export function assertResidentState(s,b){if(b?.resident&&!same(s.residentControl,control(b)))throw fail('居民作业由服务器核对，请读取已确认的进度','resident_state_conflict');}
function sync(s,b){s.residentControl=control(b);}
function returnTransfer(s,t){if(!t.sourceOwner||!Object.keys(t.sourceTransfer||{}).length)return;const task=s.agentTaskLedger?.find(x=>x.id===t.assignmentId);if(!task||!['queued','running','paused','waiting'].includes(task.status)||(task.resourceOwner||taskOwner(task.id))!==t.sourceOwner)return;const held={...(s.resourceLedger.reservations[t.sourceOwner]?.items||{})};for(const [id,n]of Object.entries(t.sourceTransfer))held[id]=(held[id]||0)+n;reserveResources(s,t.sourceOwner,held,{purpose:task.intent,partial:true});}
export function clearResidentState(s){for(const t of s.residentControl?.leases||[])returnTransfer(s,t);delete s.residentControl;}
export function residentReplay(doc,i){if(i.kind!=='resident'||!doc?.actions)return null;const b=doc.actions;
 if(i.operation==='begin'){const t=residentTickets(b).find(t=>t.requestId===i.requestId)||b.receipts.find(r=>r.ticket.kind==='resident'&&r.ticket.requestId===i.requestId)?.ticket;if(t){if(t.beginSignature!==signature(i))throw fail('同一居民作业编号不能更换负责人或内容','action_id_conflict');return {document:doc,ticket:t,receipt:b.receipts.find(r=>r.ticket.requestId===t.requestId)||null,replayed:true};}}
 else{const r=b.receipts.find(r=>r.ticket.kind==='resident'&&r.ticket.requestId===i.requestId&&r.ticket.epoch===i.epoch&&r.ticket.sequence===i.sequence);if(r)return {document:doc,ticket:r.ticket,receipt:r,replayed:true};}return null;
}
function taskValid(s,t){if(!t.assignmentId)return true;const a=s.agentTaskLedger?.find(x=>x.id===t.assignmentId);return a?.status==='running'&&a.npcId===t.actorId&&a.operationId===t.operationId&&(a.assignmentVersion||0)===t.assignmentVersion;}
function storyValid(s,t,starting=false){return cooperationWorkAuthorized(s,{...t,intent:t.intent},starting)}
function plan(s,i,task){
 const d={};for(const k of fields)if(i.intent?.[k]!==undefined)d[k]=i.intent[k];d.buildingId??=null;
 if(!['work','eat','rest','visit'].includes(d.action)||typeof d.goal!=='string'||d.goal.length>40||d.buildingId!==null&&(!Number.isInteger(d.buildingId)||!BUILDINGS[d.buildingId]||s.buildings[d.buildingId]===undefined)||d.purposeId!==undefined&&(typeof d.purposeId!=='string'||d.purposeId.length>100))throw fail('居民活动或建筑无效');
 if(d.recipeId&&!RECIPE_BY_ID[d.recipeId])throw fail('居民配方不存在');
 if(d.purposeId?.startsWith('career:')&&d.purposeId!=='career:'+career(i.actorId,s).phase)throw fail('职业阶段已变化','resident_plan_changed');
 const sourceOwner=task?(task.resourceOwner||taskOwner(task.id)):null;let cost={},item='service',name=d.buildingId===null?d.goal:BUILDINGS[d.buildingId].name,mode='life',duration=d.action==='rest'?14:d.action==='eat'&&d.foodId==='rations'?9:d.action==='eat'?10:12;
 if(d.facilityId){const u=functionalUnit(s,d.facilityId),p=s.placedItems?.find(p=>p.id===d.facilityId);if(d.action!=='eat'||!p||p.item!=='c1_9'||u?.phase!=='ready'||u.servings<1)throw fail('茶炉当前不能饮茶','resident_facility_changed');mode='tea';name='暖手茶炉';duration=10;}
 else if(d.action==='eat'){
  d.foodId??=s.inventory.meal>0?'meal':s.inventory.bread>0?'bread':s.inventory.tea>0?'tea':s.inventory.wheat>0?'wheat':'rations';
  if(d.foodId==='rations'){if(needs(i.actorId,s).rations<1)throw fail('自备简餐已用完','resident_food');duration=9;}
  else{const food=ITEM_BY_ID[d.foodId];if(!food||!(food.category==='food'&&[1,2,17].includes(food.building)||['wheat','mushroom','strawberry'].includes(food.id))||availableQuantity(s,food.id)<1)throw fail('餐点已售罄或预留，请重新选择','resident_food');cost={[food.id]:1};item=food.id;}
 }else if(d.action==='work'){
  duration=NPC_CADENCE.workSeconds;
  if(d.goal==='farm'||d.goal==='mine'){mode='observe';d.noFarmTask=true;d.mineIndex=-1;}
  else if(d.goal==='forest'||d.goal==='dock'||d.buildingId===14&&!d.recipeId&&(d.resource||d.activity==='herbs')){
   d.resource??=d.goal==='forest'?'wood':d.goal==='dock'?'fish':'herb';const raw=RAW_MATERIALS.find(x=>x.id===d.resource);const source=d.goal==='forest'?['forest']:d.goal==='dock'?['shore','fishing']:['greenhouse'];
   if(d.resource==='seed'&&d.buildingId===14){}else if(!raw||!source.includes(raw.source))throw fail('素材与居民采集地点不符');mode='gather';item=d.resource;
  }else if(d.buildingId!==null){const r=RECIPE_BY_ID[d.recipeId]||RECIPES[d.buildingId];if(d.recipeId&&r?.building!==d.buildingId)throw fail('配方与工作建筑不符');mode=r&&canCraft(r,s,{owner:sourceOwner})?'craft':'maintenance';if(mode==='craft'){d.recipeId=r.id;cost={...r.cost};item=r.item;}else d.productionMode='maintenance';
  }else if(d.goal==='plaza'){mode='observe';}else throw fail('居民工作地点无效');
 }
 d.source=task?'hermes':d.source==='deepseek'?'deepseek':'local';d.resourceOwner=null;
 let action=d.action==='rest'?'rest':d.action==='eat'?'eat':d.action==='visit'?(routineFor(i.actorId,d)?.animation||'observe'):mode==='observe'?'observe':d.buildingId!==null?ROOMS[d.buildingId].action:d.goal==='forest'?'axe':d.goal==='dock'?'fish':'gather';
 if(d.action==='work'&&mode==='gather'){const source=ITEM_BY_ID[d.resource]?.source;if(source==='shore'||source==='greenhouse'||d.resource==='seed'||source==='forest'&&!['wood','bamboo','hardwood','twig','bark'].includes(d.resource))action='gather';}
 return {d,cost,item,name,mode,duration,sourceOwner,tool:resolveTool(s,action,{npc:true}),action};
}
export function enableResident(s,b){if(!b.resident){b.resident={version:1,leases:{}};sync(s,b);}}
export function applyResidentCommand(s,b,i,now){
 enableResident(s,b);assertResidentState(s,b);hydrateTown(s);hydrateTaskBoard(s);hydrateResources(s);
 if(i.operation==='begin'){
  if(!Number.isInteger(i.actorId)||i.actorId<0||i.actorId>16)throw fail('居民负责人无效');
  if(i.expectedSequence!==b.sequence||(i.epoch??b.epoch)!==b.epoch&&i.epoch!==null)throw fail('居民作业版本已变化','action_sequence');
  if(residentActorOccupied(b,i.actorId))throw fail('居民正在另一项作业','npc_action_active');
  const assignmentId=i.intent?.assignmentId||null,assigned=beginAssignedStep(s,b,{assignmentId,actorId:i.actorId,kind:'resident',intent:i.intent}),task=assigned?.task||(assignmentId&&s.agentTaskLedger.find(x=>x.id===assignmentId));
  if(assignmentId&&(!task||task.status!=='running'||task.npcId!==i.actorId||(!assigned&&task.operationId!==i.intent.operationId)))throw fail('分工已暂停或改派','resident_task_changed');
  if(i.actorId===16&&(i.intent?.action==='work'&&!task||s.recruitment?.active?.phase!=='working'||s.recruitment.active.leaveRequested))throw fail('招聘伙伴当前不能工作','resident_task_changed');
  const p=plan(s,assigned?{...i,intent:{...i.intent,...assigned.decision}}:i,task),sequence=b.sequence+1,owner=RESIDENT_LEASE_PREFIX+b.epoch+':'+sequence,operationId=task?.operationId||i.intent?.operationId||'npc-work:'+randomUUID(),storyId=i.intent?.storyId||null;
  if(!key(operationId)||s.taskActionReceipts[operationId])throw fail('居民动作编号已使用','resident_operation');
  if(storyId&&!storyValid(s,{storyId,actorId:i.actorId,operationId,intent:p.d},true))throw fail('居民约定已变化','resident_story_changed');
  if(storyId&&!['gather','craft'].includes(p.mode))throw fail('本次约定需要实际备料，不能用维护或观察代替','resident_story_changed');
  if(p.mode==='tea'&&residentTickets(b).some(t=>t.intent.facilityId===p.d.facilityId))throw fail('茶炉正在接待其他居民','resident_facility_occupied');
  const sourceTransfer={},held=p.sourceOwner&&s.resourceLedger.reservations[p.sourceOwner];
  if(held)for(const [id,n]of Object.entries(p.cost)){const moved=Math.min(held.items[id]||0,n);if(moved){sourceTransfer[id]=moved;held.items[id]-=moved;if(!held.items[id])delete held.items[id];}}if(held&&!Object.keys(held.items).length)delete s.resourceLedger.reservations[p.sourceOwner];
  const reservedItems={...p.cost};if(p.tool?.source==='owned')reservedItems[p.tool.id]=Math.max(reservedItems[p.tool.id]||0,1);
  if(Object.keys(reservedItems).length&&!reserveResources(s,owner,reservedItems,{purpose:'居民作业 '+p.name}).ok)throw fail('工作材料被其他作业占用','resident_materials');
  const t={kind:'resident',actor:'npc',actorId:i.actorId,requestId:i.requestId,epoch:b.epoch,sequence,item:p.item,name:p.name,mode:p.mode,action:p.action,tool:p.tool,duration:p.duration,gameTime:Number.isFinite(i.gameTime)&&i.gameTime>=0?Math.min(i.gameTime,1e9):0,cost:p.cost,...(p.mode==='craft'?{recipeContract:recipeContract(RECIPE_BY_ID[p.d.recipeId])}:{}),reservedItems,owner,sourceOwner:p.sourceOwner,sourceTransfer,operationId,assignmentId,assignmentVersion:task?.assignmentVersion||0,projectReservation:!!(task?.projectId&&p.mode==='craft'),storyId,day:s.day,startedAt:now,readyAt:now+p.duration*1000,expiresAt:now+30*60*1000,intent:{...p.d,operationId,resourceOwner:owner,storyId},beginSignature:signature(i)};
  if(t.projectReservation)Object.assign(s.resourceLedger.reservations[owner],{projectTaskId:t.assignmentId,taskOperation:t.operationId,productionItem:t.item});
  b.sequence=sequence;b.resident.leases[t.requestId]=t;sync(s,b);return {ticket:t,receipt:null};
 }
 const t=residentTickets(b).find(t=>t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence);if(!t)throw fail('居民作业已结束或来自旧存档','action_stale');
 if(!['finish','cancel'].includes(i.operation))throw fail('居民作业操作无效');
 let delta={},text='居民作业已取消，未用材料已归还',storyResolved=false;
 if(i.operation==='finish'){
  if(now<t.readyAt)throw fail('居民动作尚未完成','action_early');if(now>t.expiresAt)throw fail('居民作业已过期，可以取消','action_expired');
  if(t.actorId===16&&(s.recruitment?.active?.phase!=='working'||s.recruitment.active.leaveRequested))throw fail('招聘伙伴已结束工作','resident_task_changed');
  if(!taskValid(s,t)||!storyValid(s,t))throw fail('居民分工或约定已暂停或变化','resident_task_changed');
  const frozenRecipe=t.mode==='craft'?acceptedRecipe(t):null;
  if(t.mode==='craft'&&(!frozenRecipe||!canCraft(frozenRecipe,s,{owner:t.owner})))throw fail('本次制作条件已变化，请取消后重新安排','resident_plan_changed');
  if(t.mode==='tea'){const u=functionalUnit(s,t.intent.facilityId);if(u?.phase!=='ready'||u.servings<1)throw fail('茶炉余量已变化','resident_facility_changed');}
  if(t.intent.foodId==='rations'&&needs(t.actorId,s).rations<1)throw fail('自备简餐余量已变化','resident_food');
  text=commitWork(t.actorId,t.intent,s,t.gameTime+t.duration,{acceptedRecipe:frozenRecipe});delta=s.taskActionReceipts[t.operationId].delta;
  if(t.intent.action==='eat'&&t.cost[t.item]&&delta[t.item]!==-1)throw fail('餐点尚未实际消费','resident_delivery');
  if(t.mode==='craft'&&(delta[t.item]||0)!==1)throw fail('制作尚未实际交付','resident_delivery');
  if(t.assignmentId&&!recordTaskStep(s,t.assignmentId,{operationId:t.operationId,result:text,delta,preparing:!!t.intent.preparing||t.mode==='maintenance'||t.mode==='observe'}).ok)throw fail('分工成果尚未确认','resident_task_changed');
  if(t.storyId){const story=recordResidentStoryWork(s,t.storyId,t.actorId,t.operationId);storyResolved=story.ok&&story.episode.status==='resolved';}
 }else{if(t.assignmentId){const task=s.agentTaskLedger.find(x=>x.id===t.assignmentId);if(task?.status==='running'&&task.operationId===t.operationId){task.status='queued';delete task.operationId;}}if(t.storyId)interruptResidentStory(s,t.storyId,t.operationId);}
 releaseResources(s,t.owner);if(i.operation==='cancel')returnTransfer(s,t);delete b.resident.leases[t.requestId];
 const receipt={ticket:{...t},outcome:i.operation==='finish'?'finished':'cancelled',gain:Object.fromEntries(Object.entries(delta).filter(([,n])=>n>0)),cost:Object.fromEntries(Object.entries(delta).filter(([,n])=>n<0).map(([id,n])=>[id,-n])),text,storyResolved,at:now,day:s.day};b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);sync(s,b);return {ticket:receipt.ticket,receipt};
}
