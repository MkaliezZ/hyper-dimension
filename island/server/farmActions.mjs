import {recordResidentStoryWork,interruptResidentStory} from '../src/residentStories.js';
import {cooperationWorkAuthorized,cooperationFarmAvailable,bindCooperationPlot,releaseCooperationPlotToPlayer} from '../src/residentCooperation.js';
import {beginAssignedStep} from './planningAuthority.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {CROPS,hydrateCrops,tickCrops,cropInfo} from '../src/farming.js';
import {resolveTool} from '../src/equipmentRules.js';
import {reserveResources,releaseResources,commitResources} from '../src/resourceLedger.js';
import {recordPlayerGoods} from '../src/economy.js';
import {trackJourney} from '../src/journey.js';
import {commitWork,hydrateTown} from '../src/townSimulation.js';
import {recordTaskStep} from '../src/taskBoard.js';
import {functionalDefinition} from '../src/facilityCatalog.js';
import {irrigationConnected,protectedPlot} from '../src/functionalFacilities.js';
import {NPC_CADENCE} from '../src/npcCadence.js';
export const FARM_LEASE_PREFIX='server-farm:';
const fail=(message,code='farm_invalid')=>Object.assign(Error(message),{status:409,code});
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const beginSignature=i=>createHash('sha256').update(JSON.stringify(['index','step','actor','actorId','crop','assignmentId','operationId','purposeId','source'].map(k=>i[k]??null).concat(i.storyId?['story',i.storyId]:[]))).digest('hex');
const indexOK=i=>Number.isInteger(i)&&i>=0&&i<8;
const stages={hoe:0,sow:1,water:2,harvest:4};
const plotValid=p=>p&&[0,1,2,3,4].includes(p.stage)&&Object.hasOwn(CROPS,p.crop)&&Number.isFinite(p.growth)&&p.growth>=0&&p.growth<=cropInfo(p).seconds;
export function validFarmBook(f,book){
 if(f===undefined)return true;
 return !!f&&f.version===1&&Array.isArray(f.plots)&&f.plots.length===8&&f.plots.every(plotValid)&&Number.isFinite(f.lastActiveAt)&&Number.isFinite(f.activeSeconds)&&f.activeSeconds>=0&&f.leases&&typeof f.leases==='object'&&!Array.isArray(f.leases)&&Object.keys(f.leases).length<=20&&Object.values(f.leases).every(t=>t.kind==='farm'&&t.actor!=='player'&&validFarmTicket(t)&&t.epoch===book.epoch&&Number.isSafeInteger(t.sequence)&&t.sequence>0&&t.sequence<=book.sequence&&typeof t.requestId==='string'&&/^[a-zA-Z0-9-]{8,80}$/.test(t.requestId)&&Number.isFinite(t.readyAt)&&Number.isFinite(t.expiresAt))&&(!f.autosaves||Array.isArray(f.autosaves)&&f.autosaves.length<=64&&f.autosaves.every(r=>typeof r.id==='string'&&typeof r.expectedVersion==='string'&&/^[a-f0-9]{64}$/.test(r.fingerprint)));
}
export function validFarmTicket(t){
 return indexOK(t.index)&&['player','npc','facility'].includes(t.actor)&&stages[t.step]===t.expectedStage&&Object.hasOwn(CROPS,t.crop)&&t.item===CROPS[t.crop].item&&Number.isFinite(t.duration)&&t.duration>=.85&&t.duration<=NPC_CADENCE.workSeconds&&typeof t.owner==='string'&&t.owner.startsWith(FARM_LEASE_PREFIX);
}
export function farmTickets(book){return [book?.active?.kind==='farm'?book.active:null,...Object.values(book?.farm?.leases||{})].filter(Boolean)}
export function farmHolds(book){
 const result={};
 for(const t of farmTickets(book))if(Object.keys(t.reservedItems).length)result[t.owner]={items:Object.fromEntries(Object.entries(t.reservedItems).sort(([a],[b])=>a.localeCompare(b))),purpose:'农田作业 '+t.name,day:t.day,...(t.assignmentId?{projectTaskId:t.assignmentId,taskOperation:t.operationId,npcId:t.actorId}:{})};
 return result;
}
export function assertFarmState(s,book){
 if(!book?.farm)return;
 if(!same(s.farmControl,publicControl(book))||!same(s.plots,book.farm.plots))throw fail('田地进度由服务器核算，请读取已确认的农田进度','farm_state_conflict');
}
export function clearFarmState(s){delete s.farmControl;for(const u of Object.values(s.functionalFacilities?.units||{}))if(u.serverFarmRequestId){delete u.serverFarmRequestId;u.currentPlot=null;u.currentCrop=null;u.phase='idle';u.elapsed=0}}
function enableFarm(s,book,now){
 if(book.farm)return book.farm;
 if(!Array.isArray(s.plots)||s.plots.length!==8)throw fail('田地记录不完整');
 hydrateCrops(s);for(const u of Object.values(s.functionalFacilities?.units||{}))if(u.phase==='watering'&&!u.serverFarmRequestId){u.phase='idle';u.elapsed=0;u.currentPlot=null;u.currentCrop=null;}
 if(!s.plots.every(plotValid))throw fail('田地记录无效');
 s.farmControl={version:1};
 book.farm={version:1,plots:structuredClone(s.plots),leases:{},lastActiveAt:now,activeSeconds:0};s.farmControl=publicControl(book);return book.farm;
}
const publicControl=b=>({version:1,leases:farmTickets(b).map(t=>({index:t.index,actor:t.actor,actorId:t.actorId,requestId:t.requestId,assignmentId:t.assignmentId,operationId:t.operationId,sequence:t.sequence}))});
function sync(s,b){b.farm.plots=structuredClone(s.plots);s.farmControl=publicControl(b)}
export function advanceFarmClock(s,b,seconds,now){
 if(!b?.farm)return [];
 assertFarmState(s,b);
 if(!Number.isFinite(seconds)||seconds<0||seconds>15)throw fail('农田有效时间请求无效','farm_clock');
 const elapsed=Math.min(seconds,15,Math.max(0,(now-b.farm.lastActiveAt)/1000));
 b.farm.lastActiveAt=now;b.farm.activeSeconds+=elapsed;
 const grown=tickCrops(s,elapsed);sync(s,b);return grown;
}
function matching(b,input){return farmTickets(b).find(t=>t.requestId===input.requestId&&t.epoch===input.epoch&&t.sequence===input.sequence)}
export function farmReplay(doc,input){
 if(input.kind!=='farm')return null;const b=doc?.actions;if(!b)return null;
 if(input.operation==='enable'&&b.farm)return {document:doc,ticket:null,receipt:null,replayed:true};
 if(input.operation==='begin'){
  const t=farmTickets(b).find(t=>t.requestId===input.requestId)||b.receipts.find(r=>r.ticket.requestId===input.requestId)?.ticket;
  if(t){if(t.beginSignature&&t.beginSignature!==beginSignature(input)||t.kind!=='farm'||t.index!==input.index||t.step!==input.step||t.actor!==(input.actor||'player')||(t.actor!=='player'&&t.actorId!==input.actorId)||(t.step==='sow'&&t.crop!==input.crop))throw fail('同一农活编号不能更换田地、作物或负责人','action_id_conflict');return {document:doc,ticket:t,receipt:b.receipts.find(r=>r.ticket.requestId===t.requestId)||null,replayed:true}}
 }else{
  const r=b.receipts.find(r=>r.ticket.kind==='farm'&&r.ticket.requestId===input.requestId&&r.ticket.epoch===input.epoch&&r.ticket.sequence===input.sequence);
  if(r)return {document:doc,ticket:r.ticket,receipt:r,replayed:true};
 }
 return null;
}
function taskValid(s,t){if(!t.assignmentId)return true;const task=s.agentTaskLedger?.find(x=>x.id===t.assignmentId);return !!task&&task.npcId===t.actorId&&task.status==='running'&&task.operationId===t.operationId&&(task.assignmentVersion||0)===t.assignmentVersion}
function releaseTaskHold(s,t,cancelled){
 if(!t.assignmentId)return;const task=s.agentTaskLedger?.find(x=>x.id===t.assignmentId);
 if(cancelled&&task?.operationId===t.operationId&&task.status==='running'){task.status='queued';delete task.operationId}
 if(cancelled&&task?.resourceOwner&&['queued','running','waiting','paused'].includes(task.status)&&t.step==='sow'){
  const items={...(s.resourceLedger?.reservations?.[task.resourceOwner]?.items||{})};items.seed=(items.seed||0)+1;reserveResources(s,task.resourceOwner,items,{partial:true,purpose:task.intent||'农田筹备'});
 }
}
export function applyFarmCommand(s,b,input,now){
 const f=enableFarm(s,b,now);assertFarmState(s,b);
 if(input.operation==='enable')return {ticket:null,receipt:null};
 if(input.operation==='begin'){
  if(!indexOK(input.index)||!Object.hasOwn(stages,input.step))throw fail('农田或农活无效');
  if(input.expectedSequence!==b.sequence||(input.epoch??b.epoch)!==b.epoch&&input.epoch!==null)throw fail('农田作业版本已变化','action_sequence');
  const actor=input.actor||'player',actorId=actor==='player'?-1:input.actorId,p=s.plots[input.index];
  if(!['player','npc','facility'].includes(actor)||actor==='npc'&&(!Number.isInteger(actorId)||actorId<0||actorId>16)||actor==='facility'&&typeof actorId!=='string')throw fail('农活负责人无效');
  if(actor==='npc'&&!cooperationFarmAvailable(s,input.index,actorId,input.storyId))throw fail('这块田正由另一份合作分工照料','farm_story_occupied');
  if(actor==='npc'&&actorId===16&&(!input.assignmentId||s.recruitment?.active?.phase!=='working'||s.recruitment.active.leaveRequested))throw fail('招聘伙伴尚未开始或已结束岛上工作','farm_task_changed');
  if(actor==='player'&&b.active)throw fail('先完成或取消上次岛主作业','action_active');
  if(farmTickets(b).some(t=>t.index===input.index||t.actor===actor&&t.actorId===actorId))throw fail('这块田或负责人正在进行其他农活','farm_occupied');
  if(p.stage!==stages[input.step])throw fail(p.stage===3?'作物还未成熟':'田地进度已变化，请重新查看','farm_stage');
  if(actor!=='player'&&protectedPlot(s,input.index))throw fail('这块田正在由岛主亲自照料','farm_protected');
  const crop=input.step==='sow'?input.crop:p.crop;if(!Object.hasOwn(CROPS,crop))throw fail('作物无效');
  const name=({hoe:'松土',sow:'播种',water:'浇水',harvest:'收获'})[input.step]+' · '+CROPS[crop].name;
  const sequence=b.sequence+1,owner=FARM_LEASE_PREFIX+b.epoch+':'+sequence,tool=actor==='facility'?null:resolveTool(s,input.step,{npc:actor==='npc'});
  const duration=actor==='npc'?NPC_CADENCE.workSeconds:actor==='facility'?3:Math.round(Math.max(.85,(input.step==='harvest'?1.5:1.3)*(tool?.durationScale||1))*1000)/1000;
  const reservedItems=input.step==='sow'?{seed:1}:{};if(tool?.source==='owned')reservedItems[tool.id]=Math.max(1,reservedItems[tool.id]||0);
  const assigned=actor==='npc'?beginAssignedStep(s,b,{assignmentId:input.assignmentId,actorId,kind:'farm',crop,step:input.step}):null,task=assigned?.task||(actor==='npc'&&input.assignmentId?s.agentTaskLedger?.find(x=>x.id===input.assignmentId):null),assignmentOperation=assigned?.operationId||input.operationId;
  if(input.assignmentId&&(!task||task.npcId!==actorId||task.status!=='running'||task.operationId!==assignmentOperation))throw fail('农田分工已暂停或改派','farm_task_changed');
  const storyId=actor==='npc'&&typeof input.storyId==='string'?input.storyId:null;
  if(storyId&&!cooperationWorkAuthorized(s,{storyId,actorId,operationId:assignmentOperation,intent:{goal:'farm',buildingId:null,action:'work',resource:crop,step:input.step}},true))throw fail('居民农田约定已变化','farm_story_changed');
  if(input.step==='sow'&&task?.resourceOwner){const held=s.resourceLedger?.reservations?.[task.resourceOwner];if(held?.items.seed){held.items.seed--;if(!held.items.seed)delete held.items.seed;if(!Object.keys(held.items).length)delete s.resourceLedger.reservations[task.resourceOwner]}}
  if(Object.keys(reservedItems).length&&!reserveResources(s,owner,reservedItems,{purpose:'农田作业 '+name,...(task?{projectTaskId:task.id,taskOperation:assignmentOperation,npcId:actorId}:{})}).ok)throw fail('种子或工具不足，或已被其他作业预留','farm_materials');
  if(actor==='facility'){
   const u=s.functionalFacilities?.units?.[actorId],display=s.placedItems?.find(x=>x.id===actorId);
   if(input.step!=='water'||functionalDefinition(display?.item)?.kind!=='irrigation'||!u?.enabled||u.charges<1||!u.targets.includes(input.index)||!irrigationConnected(s,actorId)||u.currentPlot!==null)throw fail('滴灌设置、余料或田地已变化','farm_irrigation');
   u.currentPlot=input.index;u.currentCrop=crop;u.phase='watering';u.elapsed=0;u.serverFarmRequestId=input.requestId;s.functionalFacilities.revision++;
  }
  if(task&&Object.keys(reservedItems).length)Object.assign(s.resourceLedger.reservations[owner],{projectTaskId:task.id,taskOperation:assignmentOperation,npcId:actorId});
  const operationId=assignmentOperation||'farm-work:'+randomUUID(),t={kind:'farm',beginSignature:beginSignature(input),requestId:input.requestId,epoch:b.epoch,sequence,index:input.index,step:input.step,action:input.step,expectedStage:p.stage,crop,item:CROPS[crop].item,name,actor,actorId,owner,reservedItems,tool,duration,day:s.day,startedAt:now,readyAt:now+Math.ceil(duration*1000),expiresAt:now+30*60*1000,assignmentId:task?.id||null,assignmentVersion:task?.assignmentVersion||0,operationId,storyId,decision:actor==='npc'?{goal:'farm',action:'work',farmIndex:input.index,expectedStage:p.stage,resource:crop,resourceOwner:owner,operationId,storyId,assignmentId:task?.id||null,projectId:task?.projectId||null,preparing:p.stage!==4,purposeId:String(input.purposeId||'').slice(0,100),source:task?'hermes':input.source==='deepseek'?'deepseek':'local'}:null};
  if(actor==='player')releaseCooperationPlotToPlayer(s,input.index);else if(storyId)bindCooperationPlot(s,storyId,actorId,input.index);
  b.sequence=sequence;if(actor==='player')b.active=t;else f.leases[t.requestId]=t;sync(s,b);return {ticket:t,receipt:null};
 }
 const t=matching(b,input);if(!t)throw fail('农活已经结束或来自旧存档','action_stale');
 if(!['finish','cancel'].includes(input.operation))throw fail('农田操作无效');
 let gain={},cost={},text='农活已取消，未消耗种子或发放作物';
 if(input.operation==='finish'){
  if(now<t.readyAt)throw fail('农活动作尚未完成','action_early');if(now>t.expiresAt)throw fail('农活已过期，可以取消后继续','action_expired');
  const p=s.plots[t.index];if(p.stage!==t.expectedStage||t.step!=='sow'&&p.crop!==t.crop)throw fail('田地阶段已变化','farm_stage');
  if(!taskValid(s,t))throw fail('农田分工已暂停或改派，可取消归还种子','farm_task_changed');
  if(!cooperationWorkAuthorized(s,{...t,intent:{...t.decision,step:t.step}}))throw fail('居民农田约定已变化，可取消后重新安排','farm_story_changed');
  if(t.actor==='facility'){
   const u=s.functionalFacilities?.units?.[t.actorId];
   if(!u?.enabled||u.serverFarmRequestId!==t.requestId||u.currentPlot!==t.index||u.currentCrop!==t.crop||u.charges<1||!u.targets.includes(t.index)||!irrigationConnected(s,t.actorId))throw fail('滴灌设置已变化，可以取消本次灌溉','farm_irrigation');
   p.stage=3;p.growth=0;u.charges--;u.condition=Math.max(0,u.condition-1);u.delivered++;text='第 '+(t.index+1)+' 块田已灌溉，剩余 '+u.charges+' 次';u.lastText=text;u.phase='idle';u.elapsed=0;u.currentPlot=null;u.currentCrop=null;delete u.serverFarmRequestId;s.functionalFacilities.revision++;
  }else if(t.actor==='npc'){
   hydrateTown(s);p.crop=t.crop;const before={...s.inventory};text=commitWork(t.actorId,t.decision,s,b.farm.activeSeconds);
   if(t.storyId)recordResidentStoryWork(s,t.storyId,t.actorId,t.operationId);
   gain=Object.fromEntries(Object.entries(s.inventory).map(([id,n])=>[id,n-(before[id]||0)]).filter(([,n])=>n>0));cost=t.step==='sow'?{seed:1}:{};
   if(t.assignmentId&&!recordTaskStep(s,t.assignmentId,{operationId:t.operationId,result:text,delta:s.taskActionReceipts[t.operationId]?.delta||{},preparing:t.expectedStage!==4}).ok)throw fail('农田交付未确认','farm_task_changed');
  }else{
   cost=t.step==='sow'?{seed:1}:{};gain=t.step==='harvest'?{[t.item]:CROPS[t.crop].yield,seed:1}:{};
   const paid=commitResources(s,{id:'farm:'+b.epoch+':'+t.sequence,owner:t.owner,cost,gain,category:'player_farm',note:t.name});
   if(!paid.ok||paid.replayed)throw fail('种子与农田账本不一致','action_ledger_conflict');
   p.crop=t.crop;
   if(t.step==='harvest'){p.stage=0;p.growth=0;delete p.playerTended;s.tasks.farm=true;recordPlayerGoods(s,t.item,CROPS[t.crop].yield);trackJourney(s,'harvest',{item:t.item,amount:CROPS[t.crop].yield});if(s.journey?.completed.harvest)for(const bed of s.plots)delete bed.playerTended;text='收获'+CROPS[t.crop].name+' ×'+CROPS[t.crop].yield+'，回收种子 ×1';}
   else{p.stage=t.expectedStage+1;if(!s.journey?.completed.harvest)p.playerTended=true;if(t.step==='water'){p.growth=0;trackJourney(s,'water');}text=t.step==='hoe'?'土已松好，可以选择作物':t.step==='sow'?'已播种'+CROPS[t.crop].name+'，接下来浇水':CROPS[t.crop].name+'开始生长，约需 '+Math.ceil(CROPS[t.crop].seconds/60)+' 分钟';}
  }
 }
 if(input.operation==='cancel'&&t.actor==='facility'){const u=s.functionalFacilities?.units?.[t.actorId];if(u?.serverFarmRequestId===t.requestId){u.phase='idle';u.elapsed=0;u.currentPlot=null;u.currentCrop=null;delete u.serverFarmRequestId;s.functionalFacilities.revision++}}
 if(input.operation==='cancel'&&t.storyId)interruptResidentStory(s,t.storyId,t.operationId);
 releaseResources(s,t.owner);releaseTaskHold(s,t,input.operation==='cancel');
 const receipt={ticket:t,outcome:input.operation==='finish'?'finished':'cancelled',at:now,day:s.day,gain,cost,text};
 b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);if(t.actor==='player')b.active=null;else delete f.leases[t.requestId];sync(s,b);return {ticket:t,receipt};
}
