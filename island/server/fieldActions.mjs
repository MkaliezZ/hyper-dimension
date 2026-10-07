import {beginAssignedStep} from './planningAuthority.mjs';
import {randomInt,randomUUID,createHash} from 'node:crypto';
import {RAW_MATERIALS} from '../src/contentCatalog.js';
import {resolveTool,minePrecision} from '../src/equipmentRules.js';
import {reserveResources,releaseResources,commitResources} from '../src/resourceLedger.js';
import {recordPlayerGoods} from '../src/economy.js';
import {trackJourney} from '../src/journey.js';
import {createMiningGame,replayMining} from '../src/miningGame.js';
import {createCraftGame,applyCraftTrace,craftResult} from '../src/craftGameReplay.js';
import {chooseDifficulty} from '../src/gameLevels.js';
import {commitWork,hydrateTown} from '../src/townSimulation.js';
import {recordTaskStep} from '../src/taskBoard.js';
import {recordResidentStoryWork,interruptResidentStory} from '../src/residentStories.js';
import {applyFarmCommand} from './farmActions.mjs';
import {NPC_CADENCE} from '../src/npcCadence.js';
export const FIELD_LEASE_PREFIX='server-field:';
const fail=(message,code='field_invalid')=>Object.assign(Error(message),{status:409,code});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const beginSignature=i=>hash(['field','itemId','actor','actorId','index','mode','assignmentId','operationId','storyId','purposeId','source'].map(k=>i[k]??null));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const nodeOK=n=>Number.isInteger(n)&&n>=0&&n<6;
const raw=(id,field)=>RAW_MATERIALS.find(i=>i.id===id&&i.source===(field==='mine'?'mine':'fishing'));
export const fieldTickets=b=>[b?.active?.kind==='field'?b.active:null,...Object.values(b?.field?.leases||{})].filter(Boolean);
const control=b=>({version:1,leases:fieldTickets(b).filter(t=>t.field==='mine').map(t=>({index:t.index,actor:t.actor,actorId:t.actorId,requestId:t.requestId,assignmentId:t.assignmentId,operationId:t.operationId,sequence:t.sequence}))});
export function validFieldTicket(t,receipt=false){return t?.kind==='field'&&['mine','fishing'].includes(t.field)&&['player','npc'].includes(t.actor)&&raw(t.item,t.field)&&Number.isFinite(t.duration)&&t.duration>=.85&&t.duration<=NPC_CADENCE.workSeconds&&typeof t.owner==='string'&&t.owner.startsWith(FIELD_LEASE_PREFIX)&&(t.field!=='mine'||nodeOK(t.index))&&(t.actor==='npc'||receipt||t.game&&Number.isFinite(t.game.elapsed)&&t.game.elapsed>=0&&Number.isSafeInteger(t.nextBatch)&&t.nextBatch>0&&['mine','workshop'].includes(t.game.engine))}
export function validFieldBook(f,b){return f===undefined||!!f&&f.version===1&&Array.isArray(f.nodes)&&f.nodes.length===6&&f.nodes.every(n=>Number.isInteger(n.hp)&&n.hp>=0&&n.hp<=3&&Number.isFinite(n.regen)&&n.regen>=0&&n.regen<=20)&&f.leases&&typeof f.leases==='object'&&!Array.isArray(f.leases)&&Object.keys(f.leases).length<=17&&Object.values(f.leases).every(t=>validFieldTicket(t)&&t.actor==='npc'&&t.epoch===b.epoch&&Number.isSafeInteger(t.sequence)&&t.sequence>0&&t.sequence<=b.sequence)}
export function fieldHolds(b){const out={};for(const t of fieldTickets(b))if(Object.keys(t.reservedItems||{}).length)out[t.owner]={items:{...t.reservedItems},purpose:'户外作业 '+t.name,day:t.day};return out}
export function assertFieldState(s,b){if(b?.field&&(!same(s.oreNodes,b.field.nodes)||!same(s.mineControl,control(b))))throw fail('矿脉由服务器核算，请读取已确认的矿洞进度','field_state_conflict')}
export function clearFieldState(s){delete s.mineControl}
function sync(s,b){b.field.nodes=structuredClone(s.oreNodes);s.mineControl=control(b)}
export function enableField(s,b,now){if(b.field)return;applyFarmCommand(s,b,{operation:'enable'},now);if(!Array.isArray(s.oreNodes)||s.oreNodes.length!==6)throw fail('矿脉记录不完整');for(const n of s.oreNodes){if(!Number.isInteger(n.hp)||n.hp<0||n.hp>3||!Number.isFinite(n.regen))throw fail('矿脉记录无效');n.regen=n.hp>0?0:Math.max(0,Math.min(20,n.regen));}b.field={version:1,nodes:structuredClone(s.oreNodes),leases:{}};s.mineControl=control(b);if(!validFieldBook(b.field,b))throw fail('矿脉记录无效')}
export function advanceFieldClock(s,b,seconds){if(!b?.field)return;assertFieldState(s,b);for(const n of s.oreNodes)if(n.hp===0){n.regen=Math.max(0,n.regen-seconds);if(n.regen===0)n.hp=3;}sync(s,b)}
function sameBegin(t,i){return (!t.beginSignature||t.beginSignature===beginSignature(i))&&t.kind==='field'&&t.field===i.field&&t.item===i.itemId&&t.actor===(i.actor||'player')&&(t.actor==='player'||t.actorId===i.actorId)&&(t.field!=='mine'||t.index===i.index)&&(t.actor!=='player'||t.mode===(i.mode||'auto'))}
export function fieldReplay(doc,i){const b=doc?.actions;if(!b||i.kind!=='field')return null;
 if(i.operation==='begin'){const t=fieldTickets(b).find(t=>t.requestId===i.requestId)||b.receipts.find(r=>r.ticket.requestId===i.requestId)?.ticket;if(t){if(!sameBegin(t,i))throw fail('同一作业编号不能更换矿脉、物品或负责人','action_id_conflict');return {document:doc,ticket:t,receipt:b.receipts.find(r=>r.ticket.requestId===t.requestId)||null,replayed:true}}}
 else{const r=b.receipts.find(r=>r.ticket.kind==='field'&&r.ticket.requestId===i.requestId&&r.ticket.epoch===i.epoch&&r.ticket.sequence===i.sequence);if(r)return {document:doc,ticket:r.ticket,receipt:r,replayed:true};const t=b.active;if(i.operation==='checkpoint'&&t?.kind==='field'&&t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence&&i.batch===t.nextBatch-1){if(t.lastBatchHash!==hash(i.events))throw fail('同一批操作不能更换内容','field_batch_conflict');return {document:doc,ticket:t,receipt:null,replayed:true}}}
 return null;
}
function taskValid(s,t){const task=t.assignmentId&&s.agentTaskLedger?.find(x=>x.id===t.assignmentId);return !t.assignmentId||task?.status==='running'&&task.npcId===t.actorId&&task.operationId===t.operationId&&(task.assignmentVersion||0)===t.assignmentVersion}
function storyValid(s,t){if(!t.storyId)return true;const e=s.residentStories?.episodes.find(e=>e.id===t.storyId);return !!e&&['scheduled','working'].includes(e.status)&&e.stage==='work'&&e.people.includes(t.actorId)&&e.inFlight[t.actorId]?.operationId===t.operationId}
function gameResult(t){return t.field==='mine'?t.game.result:craftResult(t.game)}
export function applyFieldCommand(s,b,i,now){enableField(s,b,now);assertFieldState(s,b);
 if(i.operation==='begin'){
  const actor=i.actor||'player',actorId=actor==='player'?-1:i.actorId,item=raw(i.itemId,i.field),mode=i.mode||'auto';
  if(!item||!['mine','fishing'].includes(i.field)||!['player','npc'].includes(actor)||!['auto','1','2','3'].includes(mode)||actor==='npc'&&(!Number.isInteger(actorId)||actorId<0||actorId>16||i.field!=='mine'))throw fail('作业物品或负责人无效');
  if(actor==='player'&&b.active)throw fail('先完成或取消上次岛主作业','action_active');
  if(i.expectedSequence!==b.sequence||(i.epoch??b.epoch)!==b.epoch&&i.epoch!==null)throw fail('作业版本已变化','action_sequence');
  if(i.field==='mine'&&(!nodeOK(i.index)||s.oreNodes[i.index].hp<=0))throw fail('矿脉暂时采空，等待恢复','field_depleted');
  if(fieldTickets(b).some(t=>t.actor===actor&&t.actorId===actorId||i.field==='mine'&&t.field==='mine'&&t.index===i.index))throw fail('矿脉或负责人正在作业','field_occupied');
  if(actor==='npc'&&actorId===16&&(!i.assignmentId||s.recruitment?.active?.phase!=='working'||s.recruitment.active.leaveRequested))throw fail('招聘伙伴尚未开始或已结束工作','field_task_changed');
  const assigned=actor==='npc'?beginAssignedStep(s,b,{assignmentId:i.assignmentId,actorId,kind:'field',field:i.field,itemId:i.itemId}):null,task=assigned?.task||(i.assignmentId&&s.agentTaskLedger?.find(t=>t.id===i.assignmentId));
  if(i.assignmentId&&(!task||task.status!=='running'||task.npcId!==actorId||(!assigned&&task.operationId!==i.operationId)))throw fail('分工已暂停或改派','field_task_changed');
  const operationId=actor==='npc'?(assigned?.operationId||i.operationId||'field-work:'+randomUUID()):null,storyId=actor==='npc'&&typeof i.storyId==='string'?i.storyId:null;
  if(storyId&&!storyValid(s,{storyId,actorId,operationId}))throw fail('居民约定已变化','field_story_changed');
  const sequence=b.sequence+1,owner=FIELD_LEASE_PREFIX+b.epoch+':'+sequence,action=i.field==='mine'?'pickaxe':'fish',tool=resolveTool(s,action,{npc:actor==='npc'}),duration=actor==='npc'?NPC_CADENCE.workSeconds:Math.round(Math.max(.85,(i.field==='mine'?1.25:2.2)*(tool?.durationScale||1))*1000)/1000,name=(i.field==='mine'?'采矿':'钓获')+' · '+item.name,reservedItems=tool?.source==='owned'?{[tool.id]:1}:{};
  if(Object.keys(reservedItems).length&&!reserveResources(s,owner,reservedItems,{purpose:'户外作业 '+name}).ok)throw fail('工具已被其他作业预留','field_tool');
  let seed=null,difficulty=1,game=null;
  if(actor==='player'){
   if(i.field==='mine')game=createMiningGame(minePrecision(s,tool));
   else{const key='field-fishing',history=s.miniGameHistory??={};history[key]={attempts:0,wins:0,lossStreak:0,winStreak:0,recentSeeds:[],completedSeeds:[],...history[key]};const h=history[key];seed=randomInt(1,0x100000000);difficulty=chooseDifficulty(h,mode);h.attempts++;h.recentSeeds=[...h.recentSeeds,seed].slice(-12);h.lastMode=mode;game=createCraftGame(16,seed,difficulty,tool)}
  }
  const t={kind:'field',beginSignature:beginSignature(i),field:i.field,requestId:i.requestId,epoch:b.epoch,sequence,item:item.id,name,actor,actorId,index:i.field==='mine'?i.index:null,expectedHp:i.field==='mine'?s.oreNodes[i.index].hp:null,owner,reservedItems,action,tool,duration,mode,seed,difficulty,game,nextBatch:1,day:s.day,startedAt:now,readyAt:actor==='npc'?now+Math.ceil(duration*1000):null,expiresAt:now+30*60*1000,operationId,assignmentId:task?.id||null,assignmentVersion:task?.assignmentVersion||0,storyId,purposeId:String(i.purposeId||'').slice(0,100),source:task?'hermes':i.source==='deepseek'?'deepseek':'local'};
  if(actor==='player')t.readyAt=now+Math.ceil(duration*1000);
  b.sequence=sequence;if(actor==='player')b.active=t;else b.field.leases[t.requestId]=t;sync(s,b);return {ticket:t,receipt:null};
 }
 const t=fieldTickets(b).find(t=>t.requestId===i.requestId&&t.epoch===i.epoch&&t.sequence===i.sequence);if(!t)throw fail('作业已结束或来自旧存档','action_stale');
 if(i.operation==='checkpoint'){
  if(t.actor!=='player'||i.batch!==t.nextBatch)throw fail('操作顺序不符','field_batch_sequence');
  if(now>t.expiresAt)throw fail('作业已过期，可以取消','action_expired');
  try{if(t.field==='mine')replayMining(t.game,i.events);else applyCraftTrace(t.game,i.events)}catch{throw fail('操作无法通过规则校验，已确认进度保留','field_input')}
  if(t.game.elapsed*1000>now-t.startedAt+150)throw fail('操作时间超过实际经过时间','field_clock');
  t.lastBatchHash=hash(i.events);t.nextBatch++;const result=gameResult(t);
  if(result&&!t.outcomeRecorded){t.outcomeRecorded=true;t.readyAt=now+Math.ceil(t.duration*1000);if(t.field==='fishing'){const h=s.miniGameHistory['field-fishing'];h.completedSeeds=[...h.completedSeeds,t.seed].slice(-20);h.wins+=result.passed?1:0;h.lossStreak=result.passed?0:h.lossStreak+1;h.winStreak=result.passed?h.winStreak+1:0;h.lastResult={passed:result.passed,quality:result.quality,difficulty:t.difficulty,seed:t.seed};}}
  return {ticket:t,receipt:null};
 }
 if(!['finish','cancel'].includes(i.operation))throw fail('作业操作无效');
 let gain={},text='作业已取消，工具已解除预留',quality=null,strong=null;
 if(i.operation==='finish'){
  const result=t.actor==='player'?gameResult(t):null;if(t.actor==='player'&&!result?.passed)throw fail('先完成本局操作后领取','field_unfinished');
  if(now<t.readyAt)throw fail('工具动作尚未完成','action_early');if(now>t.expiresAt)throw fail('作业已过期，可以取消','action_expired');
  if(!taskValid(s,t)||!storyValid(s,t))throw fail('分工或居民约定已暂停或变化，可取消作业','field_task_changed');
  if(t.field==='mine'&&s.oreNodes[t.index].hp!==t.expectedHp)throw fail('矿脉阶段已变化','field_state_conflict');
  if(t.actor==='npc'){
   hydrateTown(s);const before={...s.inventory},d={goal:'mine',buildingId:null,action:'work',mineIndex:t.index,resource:t.item,operationId:t.operationId,storyId:t.storyId,purposeId:t.purposeId,source:t.source};text=commitWork(t.actorId,d,s,b.farm.activeSeconds);
   gain=Object.fromEntries(Object.entries(s.inventory).map(([id,n])=>[id,n-(before[id]||0)]).filter(([,n])=>n>0));
   if(t.assignmentId&&!recordTaskStep(s,t.assignmentId,{operationId:t.operationId,result:text,delta:s.taskActionReceipts[t.operationId]?.delta||{}}).ok)throw fail('分工交付尚未确认','field_task_changed');
   if(t.storyId)recordResidentStoryWork(s,t.storyId,t.actorId,t.operationId);
  }else{
   quality=result.quality;strong=result.strong??null;
   if(t.field==='mine'){const node=s.oreNodes[t.index];node.hp=Math.max(0,node.hp-result.damage);gain.stone=1;if(node.hp===0){gain[t.item]=(gain[t.item]||0)+2;node.regen=10;s.tasks.mine=true;}text=(strong?'精准敲击':'敲击命中')+'，石材 ×1'+(node.hp===0?'、'+RAW_MATERIALS.find(x=>x.id===t.item).name+' ×2':'，矿脉剩余 '+node.hp+' 点');}
   else{gain[t.item]=1;text='海边钓场收获'+RAW_MATERIALS.find(x=>x.id===t.item).name+' ×1';}
   const id='field:'+b.epoch+':'+t.sequence,paid=commitResources(s,{id,owner:t.owner,gain,category:'player_field',note:t.name});if(!paid.ok||paid.replayed)throw fail('物资账本与作业不一致','action_ledger_conflict');
   for(const [item,n]of Object.entries(gain)){recordPlayerGoods(s,item,n);trackJourney(s,'gather',{item,amount:n});}s.gatherCounts??={};s.gatherCounts[t.field]=(s.gatherCounts[t.field]||0)+1;
  }
 }
 if(i.operation==='cancel'&&t.assignmentId){const task=s.agentTaskLedger.find(x=>x.id===t.assignmentId);if(task?.status==='running'&&task.operationId===t.operationId){task.status='queued';delete task.operationId}}
 if(i.operation==='cancel'&&t.storyId)interruptResidentStory(s,t.storyId,t.operationId);
 releaseResources(s,t.owner);if(t.actor==='player')b.active=null;else delete b.field.leases[t.requestId];
 const ticket={...t};delete ticket.game;delete ticket.lastBatchHash;const receipt={ticket,outcome:i.operation==='finish'?'finished':'cancelled',gain,cost:{},quality,strong,text,at:now,day:s.day};b.receipts.push(receipt);b.receipts=b.receipts.slice(-128);sync(s,b);return {ticket,receipt};
}
