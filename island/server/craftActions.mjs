import {randomInt,createHash} from 'node:crypto';
import {RECIPE_BY_ID,canCraft,recipeGate,hydrateContent,takeCraftNutrition} from '../src/contentCatalog.js';
import {reserveResources,releaseResources,commitResources,nextOperationId} from '../src/resourceLedger.js';
import {createCraftGame,applyCraftTrace,craftResult,neutralCraftGame} from '../src/craftGameReplay.js';
import {chooseDifficulty} from '../src/gameLevels.js';
import {playerProjectTask} from '../src/projectPlans.js';
import {beginTaskStep,recordTaskStep} from '../src/taskBoard.js';
import {recordPlayerGoods,improveQuality} from '../src/economy.js';
import {trackJourney} from '../src/journey.js';
import {ROOMS} from '../src/rooms.js';
import {resolveTool} from '../src/equipmentRules.js';
export const CRAFT_LEASE_PREFIX='server-craft:';
const fail=(text,code='craft_invalid')=>Object.assign(Error(text),{status:409,code});
const digest=events=>createHash('sha256').update(JSON.stringify(events)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function validCraftTicket(t,receipt=false){
 if(!RECIPE_BY_ID[t.recipeId]||t.item!==RECIPE_BY_ID[t.recipeId].item||t.building!==RECIPE_BY_ID[t.recipeId].building||!Number.isInteger(t.seed)||t.seed<0||t.seed>0xffffffff||![1,2,3].includes(t.difficulty)||typeof t.practice!=='boolean'||!Number.isFinite(t.duration)||t.duration<.85||t.duration>2.1)return false;
 return receipt||!!t.game&&['workshop','link','match'].includes(t.game.engine)&&Number.isFinite(t.game.elapsed)&&t.game.elapsed>=0&&Number.isSafeInteger(t.nextBatch)&&t.nextBatch>=1;
}
export function craftHold(t){return t.practice?{}:{[t.owner]:{items:Object.fromEntries(Object.entries(t.reservedItems||RECIPE_BY_ID[t.recipeId].cost).sort(([a],[b])=>a.localeCompare(b))),purpose:'服务端制作 '+t.name,day:t.day,...(t.projectTaskId?{projectTaskId:t.projectTaskId,taskOperation:t.taskOperation,assignmentVersion:t.assignmentVersion}:{})}}}
export function craftReplay(doc,input){
 const b=doc?.actions;if(!b||input.kind!=='craft')return null;
 if(input.operation==='begin'){
  const t=b.active?.requestId===input.requestId?b.active:null,done=b.receipts.find(r=>r.ticket.requestId===input.requestId);
  if(t||done){const ticket=t||done.ticket;if(ticket.kind!=='craft'||ticket.recipeId!==input.recipeId||ticket.mode!==(input.mode||'auto'))throw fail('同一作业编号不能更换配方或难度','action_id_conflict');return {document:doc,ticket,receipt:done||null,replayed:true}}
 }else{
  const r=b.receipts.find(r=>r.ticket.requestId===input.requestId&&r.ticket.epoch===input.epoch&&r.ticket.sequence===input.sequence);
  if(r)return {document:doc,ticket:r.ticket,receipt:r,replayed:true};
  const t=b.active;
  if(input.operation==='checkpoint'&&t?.kind==='craft'&&t.requestId===input.requestId&&t.epoch===input.epoch&&t.sequence===input.sequence&&input.batch===t.nextBatch-1){
   if(t.lastBatchHash!==digest(input.events))throw fail('同一批操作不能更换内容','craft_batch_conflict');
   return {document:doc,ticket:t,receipt:null,replayed:true};
  }
 }
 return null;
}
function recordOutcome(s,t,now){
 const r=craftResult(t.game);if(!r||t.outcomeRecorded)return;
 t.outcomeRecorded=true;t.readyAt=now+Math.ceil(t.duration*1000);
 const h=s.miniGameHistory[t.building];
 h.completedSeeds=[...(h.completedSeeds||[]),t.seed].slice(-20);h.wins+=r.passed?1:0;h.lossStreak=r.passed?0:h.lossStreak+1;h.winStreak=r.passed?h.winStreak+1:0;h.lastResult={passed:r.passed,quality:r.quality,difficulty:t.difficulty,seed:t.seed};
 if(r.passed){s.workshopBests??={};const key=t.building+'-'+t.difficulty,old=s.workshopBests[key]||{score:0,stars:0};s.workshopBests[key]={score:Math.max(old.score,r.score),stars:Math.max(old.stars,r.stars),seconds:Math.min(old.seconds??Infinity,r.seconds)}}
}
function returnProjectHold(s,t){
 if(!t.projectTaskId)return;
 const task=s.agentTaskLedger?.find(x=>x.id===t.projectTaskId);
 if(task?.npcId===-1&&task.operationId===t.taskOperation&&task.status==='running'){task.status='queued';delete task.operationId}
 if(task?.resourceOwner&&['queued','running','paused','waiting'].includes(task.status)){
  const held={...(s.resourceLedger?.reservations[task.resourceOwner]?.items||{})};
  for(const [id,n] of Object.entries(RECIPE_BY_ID[t.recipeId].cost))held[id]=(held[id]||0)+n;
  reserveResources(s,task.resourceOwner,held,{partial:true,purpose:task.intent||t.name});
 }
}
export function applyCraftCommand(s,b,input,now){
 if(input.operation==='begin'){
  if(b.active)throw fail('上一次作业尚未完成，请继续或取消','action_active');
  if((input.epoch??null)!==b.epoch&&input.epoch!==null)throw fail('作业所属存档已更换','action_epoch');
  if(input.expectedSequence!==b.sequence)throw fail('另一窗口已更新作业','action_sequence');
  const recipe=RECIPE_BY_ID[input.recipeId];if(!recipe)throw fail('配方不存在');
  const mode=input.mode||'auto';if(!['auto','1','2','3'].includes(mode))throw fail('难度无效');
  hydrateContent(s);
  const project=playerProjectTask(s,recipe.item,input.taskId||null),projectOwner=project?.resourceOwner||null;
  if(input.taskId&&!project)throw fail('筹备步骤已暂停、完成或改派','craft_task_changed');
  const practice=!canCraft(recipe,s,{owner:projectOwner});
  if(!recipeGate(recipe,s).ready)throw fail('尚未解锁本馆图纸','craft_locked');
  const h=s.miniGameHistory??={};h[recipe.building]={attempts:0,wins:0,lossStreak:0,winStreak:0,recentSeeds:[],completedSeeds:[],...h[recipe.building]};
  const history=h[recipe.building],seed=randomInt(1,0x100000000),difficulty=chooseDifficulty({...history,wins:Math.max(history.wins,s.roomGames?.[recipe.building]?.plays||0)},mode);
  const sequence=b.sequence+1,owner=CRAFT_LEASE_PREFIX+b.epoch+':'+sequence,tool=resolveTool(s,ROOMS[recipe.building].action);
  const duration=Math.round(Math.max(.85,2.1*(tool?.durationScale||1))*1000)/1000;
  const reservedItems={...recipe.cost};if(tool?.source==='owned')reservedItems[tool.id]=Math.max(reservedItems[tool.id]||0,1);
  let taskOperation=null;
  if(!practice){
   if(projectOwner){const held=s.resourceLedger.reservations[projectOwner];if(held){for(const [id,n] of Object.entries(recipe.cost)){held.items[id]=Math.max(0,(held.items[id]||0)-n);if(!held.items[id])delete held.items[id]}if(!Object.keys(held.items).length)delete s.resourceLedger.reservations[projectOwner]}}
   if(!reserveResources(s,owner,reservedItems,{purpose:'服务端制作 '+recipe.name}).ok)throw fail('制作物资已被其他作业预留','craft_materials');
   if(project)taskOperation=beginTaskStep(s,project.id);
  }
  history.attempts++;history.recentSeeds=[...history.recentSeeds,seed].slice(-12);history.lastDifficulty=difficulty;history.lastMode=mode;
  const ticket={kind:'craft',requestId:input.requestId,epoch:b.epoch,sequence,recipeId:recipe.id,item:recipe.item,name:recipe.name,building:recipe.building,amount:1,action:ROOMS[recipe.building].action,mode,difficulty,seed,practice,duration,tool,reservedItems,owner,day:s.day,startedAt:now,readyAt:now+Math.ceil(duration*1000),expiresAt:now+24*60*60*1000,projectTaskId:project&&!practice?project.id:null,taskOperation,assignmentVersion:project?.assignmentVersion||0,nextBatch:1,game:createCraftGame(recipe.building,seed,difficulty,tool)};
  if(ticket.projectTaskId)Object.assign(s.resourceLedger.reservations[owner],{projectTaskId:ticket.projectTaskId,taskOperation:ticket.taskOperation,assignmentVersion:ticket.assignmentVersion});
  b.sequence=sequence;b.active=ticket;return {ticket,receipt:null};
 }
 const t=b.active;
 if(!t||t.kind!=='craft'||t.requestId!==input.requestId||t.epoch!==input.epoch||t.sequence!==input.sequence)throw fail('制作作业已结束或来自另一次存档','action_stale');
 if(input.operation==='checkpoint'){
  if(now>t.expiresAt)throw fail('制作已过期，请取消后重开','action_expired');
  if(input.batch!==t.nextBatch)throw fail('这批操作已处理或顺序不符','craft_batch_sequence');
  try{applyCraftTrace(t.game,input.events)}catch{throw fail('小游戏操作无法通过规则校验，已保存的进度保留','craft_input')}
  if(t.game.elapsed*1000>now-t.startedAt+150)throw fail('操作时间超过实际经过时间','craft_clock');
  t.lastBatchHash=digest(input.events);t.nextBatch++;recordOutcome(s,t,now);return {ticket:t,receipt:null};
 }
 if(!['finish','cancel'].includes(input.operation))throw fail('制作操作无效');
 let outcome='cancelled',gain={},quality=null,resourceReceiptId=null;
 if(input.operation==='finish'){
  const r=craftResult(t.game);if(!r?.passed)throw fail('请完成本局小游戏后领取','craft_unfinished');
  if(now<t.readyAt)throw fail('制作收尾动作尚未完成','action_early');
  if(now>t.expiresAt)throw fail('制作已过期，请取消后重开','action_expired');
  quality=r.quality;outcome=t.practice?'practiced':'finished';
  if(!t.practice){
   const task=t.projectTaskId&&s.agentTaskLedger?.find(x=>x.id===t.projectTaskId);
   if(t.projectTaskId&&(!task||task.npcId!==-1||task.status!=='running'||task.operationId!==t.taskOperation||(task.assignmentVersion||0)!==t.assignmentVersion))throw fail('筹备步骤已暂停、完成或改派，可以取消归还材料','craft_task_changed');
   const recipe=RECIPE_BY_ID[t.recipeId],id=nextOperationId(s,'player:craft')+':result';
   const paid=commitResources(s,{id,owner:t.owner,cost:recipe.cost,gain:{[recipe.item]:1},category:'craft',note:recipe.name});
   if(!paid.ok||paid.replayed)throw fail('物资账本与制作作业不一致','action_ledger_conflict');
   resourceReceiptId=id;
   s.craftHistory[recipe.id]=(s.craftHistory[recipe.id]||0)+1;
   if(task&&!recordTaskStep(s,task.id,{operationId:t.taskOperation,result:'岛主亲手制作'+recipe.name,delta:{[recipe.item]:1}}).ok)throw fail('筹备步骤交付未确认','craft_task_changed');
   recordPlayerGoods(s,recipe.item,1);trackJourney(s,'craft',{item:recipe.item,building:t.building,quality,commandId:id});if(recipe.item==='lantern')s.tasks.craft=true;
   if(s.facilities?.[t.building])improveQuality(s.facilities[t.building],quality/400+takeCraftNutrition(s));
   s.roomGames??={};s.roomGames[t.building]={plays:(s.roomGames[t.building]?.plays||0)+1,best:Math.max(quality,s.roomGames[t.building]?.best||0)};gain={[recipe.item]:1};
  }
 }
 releaseResources(s,t.owner);if(outcome==='cancelled')returnProjectHold(s,t);
 const ticket={...t};delete ticket.game;delete ticket.lastBatchHash;
 const receipt={ticket,outcome,gain,cost:outcome==='finished'?RECIPE_BY_ID[t.recipeId].cost:{},quality,resourceReceiptId,at:now,day:s.day};
 b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);b.active=null;return {ticket,receipt};
}
