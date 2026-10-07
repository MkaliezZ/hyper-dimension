import {createLanSettlementCoordinator} from './lanSettlementCoordinator.mjs';
import {createGuestProposal,validateGuestProposal,guestWalletStep,guestProof} from './guestCooperation.mjs';
import {readTravelContract} from './lanTravelParty.mjs';
import {ALL_RECIPES,recipeGate} from '../src/contentCatalog.js';import {BUILDINGS} from '../src/world.js';
import {mkdir,readFile,open,rename,unlink,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {roomPeople} from './lanRoomResidents.mjs';import {NPC_CADENCE} from '../src/npcCadence.js';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),clone=structuredClone;
const fail=(message,code='lan_social_conflict',status=409)=>Object.assign(Error(message),{code,status});
const interests={farm:'园艺与种植',tea:'茶饮与料理',mine:'矿物与材料',workshop:'手作与设计',gallery:'展览与收藏',plaza:'聚会与表演'};
const ended=new Set(['completed','cancelled','failed']);
const blank=()=>({affinity:0,trust:0,affection:0,tension:0,interactions:0,label:'初识'});
export function createLanSocialStore({directory,identities,tenants,agents,now=Date.now,fault=()=>{}}){
 const root=resolve(directory,'_lan'),file=resolve(root,'social.json'),lock=resolve(root,'social.lock'),instance=randomUUID(),running=new Set();let closing=false;
 async function locked(fn){await mkdir(root,{recursive:true});const key=randomUUID(),start=Date.now();for(;;){try{const f=await open(lock,'wx',0o600);try{await f.writeFile(JSON.stringify({pid:process.pid,key}));}finally{await f.close()}break;}catch(e){if(e.code!=='EEXIST')throw e;try{const o=JSON.parse(await readFile(lock,'utf8'));try{process.kill(o.pid,0)}catch(x){if(x.code!=='EPERM'){await unlink(lock);continue}}}catch{try{if(Date.now()-(await stat(lock)).mtimeMs>30000){await unlink(lock);continue}}catch{}}if(Date.now()-start>5000)throw fail('相遇手账正在保存','lan_social_busy',503);await new Promise(r=>setTimeout(r,25));}}
 try{await settlements.recover();return await fn()}finally{try{if(JSON.parse(await readFile(lock,'utf8')).key===key)await unlink(lock)}catch{}}}
 async function read(){try{const d=JSON.parse(await readFile(file,'utf8'));if(d.version!==1||!d.rooms||!Array.isArray(d.events)||d.checksum!==hash({...d,checksum:undefined}))throw Error();return d}catch(e){if(e.code==='ENOENT')return {version:1,rooms:{},events:[],relations:{}};throw fail('相遇手账校验失败，原档保留','lan_social_corrupt',503)}}
 async function save(d){delete d.checksum;d.checksum=hash(d);const tmp=file+'.'+randomUUID()+'.tmp';let f;try{f=await open(tmp,'wx',0o600);await f.writeFile(JSON.stringify(d));await f.sync();await f.close();f=null;await rename(tmp,file)}finally{await f?.close().catch(()=>{});await unlink(tmp).catch(()=>{})}}
 const relKey=(a,b)=>a.actorId+'|'+b.actorId;
 function present(room,people){return people.every(p=>room.members[p.ownerAccountId]&&now()-room.members[p.ownerAccountId].lastSeen<=45000&&roomPeople(room).some(c=>c.person.actorId===p.actorId));}
 const relation=(d,a,b)=>d.relations[relKey(a,b)]||blank();
 function motivation(d,a,b){
  const r=relation(d,a,b),shared=a.interest.filter(x=>b.interest.includes(x));
  if(r.tension>=8)return {type:'reconcile',reason:'上次留下了不同意见，这次想当面谈清。',topic:'上次交流留下分歧：'+(r.lastEvent||'观点不同')+'。尝试谈清楚，允许尚未和解。'};
  if(r.interactions&&r.affinity<0)return {type:'dispute',reason:'对上次讨论的看法仍不一致，决定继续交流。',topic:'继续讨论上次的不同意见：'+r.lastEvent+'。不要编造资源争夺或旧仇。'};
  if(shared.length)return {type:'negotiate',reason:'两人都喜欢'+shared.map(x=>interests[x]||x).join('、')+'，停下脚步交换心得。',topic:a.job+'与'+b.job+'在客岛见面，交流共同兴趣 '+shared.map(x=>interests[x]||x).join('、')+'；可以比较做法，合作仅是意向，没有交付物资。'};
  return {type:'friendship',reason:'在岛上初次相遇，聊起各自的工作和生活。',topic:a.job+'与'+b.job+'在主岛相遇，分享职业生活和审美差异；依据性格表达真实看法，不要求互相赞同。'};
 }
 async function reconcile(d){let changed=false;for(const [roomId,slot] of Object.entries(d.rooms)){const t=slot.task;if(!t||ended.has(t.status))continue;
  try{const room=await identities.roomStateForServer(roomId);if(!present(room,t.people)){t.status='cancelled';t.error='参与者已离岛或暂离，未登记新的共同经历';changed=true;await identities.finishSocialMeeting(roomId,t.id);continue;}}
  catch(e){if(!['lan_room_missing','lan_room_closed'].includes(e.code))throw e;t.status='cancelled';t.error='会客已结束';changed=true;continue}
  if(t.status==='thinking'&&t.runtimeOwner!==instance||now()>t.expiresAt){t.status='failed';t.error='本次交谈未确认，保留已有经历，稍后再相遇';changed=true;await identities.finishSocialMeeting(roomId,t.id);}
 }return changed}
 function record(d,t,result){
  if(result.source!=='deepseek'||!result.ledgerRunId||!Array.isArray(result.lines)||result.lines.length<4||result.lines.length>6)throw fail('居民没有给出可追溯的完整交谈','lan_social_reply');
  if(![0,1].every(i=>result.lines.some(l=>l.speaker===i))||result.lines.some(l=>![0,1].includes(l.speaker)||typeof l.text!=='string'||!l.text.trim()))throw fail('居民交谈参与者不匹配','lan_social_reply');
  const type=['friendship','negotiate','dispute','reconcile'].includes(result.type)?result.type:t.type,summary=String(result.summary||t.topic).slice(0,120),changes=[];
  for(let i=0;i<2;i++){const a=t.people[i],b=t.people[1-i],r={...relation(d,a,b)},delta=(result.changes||[]).find(c=>c.from===i&&c.to===1-i)||{};
   for(const [k,max]of [['affinity',6],['trust',4],['affection',3],['tension',6]]){const raw=Number(delta[k]),v=Number.isFinite(raw)?Math.max(-max,Math.min(max,raw)):0;r[k]=Math.max(k==='tension'?0:-100,Math.min(100,r[k]+v));}
   r.interactions++;r.lastEvent=summary;r.at=now();r.label=r.tension>=12?'有些芥蒂':r.affinity< -10?'关系紧张':r.affinity>=18?'熟悉的朋友':r.trust>=10?'信任':'相识';d.relations[relKey(a,b)]=r;changes.push({actorId:a.actorId,peerId:b.actorId,...r});
  }
  const event={id:t.id,roomId:t.roomId,at:now(),people:t.people,topic:t.topic,contextText:t.reason,type,summary,lines:result.lines.map(l=>({actorId:t.people[l.speaker].actorId,text:l.text.slice(0,80)})),changes,source:'deepseek',model:result.model,ledgerRunId:result.ledgerRunId};
  d.events.push(event);const activeEvents=d.events.filter(e=>cooperationActive(e.cooperation));d.events=[...activeEvents,...d.events.filter(e=>!cooperationActive(e.cooperation)).slice(-Math.max(0,1000-activeEvents.length))].sort((a,b)=>a.at-b.at);
  const entries=Object.entries(d.relations).sort((a,b)=>(a[1].at||0)-(b[1].at||0));for(const [k]of entries.slice(0,Math.max(0,entries.length-2048)))delete d.relations[k];
  return event;
 }

 const settlements=createLanSettlementCoordinator({file:resolve(root,'social-settlement.json'),tenants,save,fault});
 const cooperationActive=c=>c&&['proposed','agreed','assembling','working'].includes(c.status);
 async function stopGuest(d,e,reason){
  const c=e.cooperation,old=clone(d);c.status='cancelled';c.reason=reason;c.stoppedAt=now();
  if(c.funded){c.funded=false;await settlements.commit({old,next:d,steps:[guestWalletStep(c,e.id,'release')]});}
  await identities.finishGuestWork(e.roomId,c.workId);return true;
 }
 function rewardTrust(d,e,c){
  c.effects=[];for(const a of e.people){const b=e.people.find(p=>p.actorId!==a.actorId),before=relation(d,a,b),r={...before};r.trust=Math.min(100,r.trust+3);r.affinity=Math.min(100,r.affinity+2);r.tension=Math.max(0,r.tension-2);r.lastEvent=c.title+'：双方已完成实际制作';r.at=now();r.label=r.tension>=12?'有些芥蒂':r.affinity< -10?'关系紧张':r.affinity>=18?'熟悉的朋友':r.trust>=10?'信任':'相识';d.relations[relKey(a,b)]=r;c.effects.push({actorId:a.actorId,affinity:r.affinity-before.affinity,trust:r.trust-before.trust,tension:r.tension-before.tension});}
 }
 async function advanceGuest(d,e){
  const c=e.cooperation;
  if(!cooperationActive(c)){await identities.finishGuestWork(e.roomId,c.workId);return false;}
  let room;try{room=await identities.roomStateForServer(e.roomId);await validateGuestProposal({directory,e,c,room,tenants,now});}
  catch(error){if(['lan_room_missing','lan_room_closed','lan_social_contract','lan_social_guest_expired','lan_social_guest_left','lan_social_guest_world','lan_social_guest_recipe'].includes(error.code))return stopGuest(d,e,error.message);throw error;}
  if(!c.funded)return false;
  try{await identities.prepareGuestWork(e.roomId,c.parts,c.workId);}catch(error){if(error.code==='lan_work_wait'){c.lastAt=now();c.reason=error.message;return true;}return stopGuest(d,e,'工位暂时不可达，材料已退回。');}
  const positions=await identities.guestWorkProgress(e.roomId,c.workId),delta=Math.min(2,Math.max(0,(now()-(c.lastAt??now()))/1000));c.lastAt=now();c.stations=positions.actors;
  if(!positions.ready){c.status='assembling';c.reason='材料已预留；所有参与者到达各自工位后才开始制作。';for(const p of c.parts)p.taskStatus='approaching';return true;}
  if(c.status==='working')c.elapsed=Math.min(Math.max(...c.parts.map(p=>p.duration)),c.elapsed+delta);
  c.status='working';c.reason='双方在各自工位共同试作，原聘约仍保留。';for(const p of c.parts)p.taskStatus='running';
  await identities.guestWorkProgress(e.roomId,c.workId,c.elapsed);
  if(c.elapsed<Math.max(...c.parts.map(p=>p.duration)))return true;
  const old=clone(d);c.status='completed';c.funded=false;c.completedAt=now();c.reason='双方已在客岛实际完成试作；主岛材料已消耗，成品进入主岛库存。';
  for(const [i,p]of c.parts.entries()){p.taskStatus='done';p.proof={...guestProof(c,p,i,e,now()),station:c.stations.find(x=>x.actorId===p.actorId)};}
  rewardTrust(d,e,c);await settlements.commit({old,next:d,steps:[guestWalletStep(c,e.id,'capture'),...c.parts.map((_,i)=>guestWalletStep(c,e.id,'credit',i))]});await identities.finishGuestWork(e.roomId,c.workId);return true;
 }
 async function updateCooperations(d){
  let changed=false;const documents=new Map();
  for(const e of d.events){
   const c=e.cooperation;if(c?.mode==='host_workshop'){if(await advanceGuest(d,e))changed=true;continue;}if(!cooperationActive(c))continue;
   for(const part of c.parts){
    const p=e.people.find(p=>p.actorId===part.actorId),key=p.ownerAccountId+':'+p.homeTheme;
    if(!documents.has(key))documents.set(key,await tenants.readIslandForServer(p.ownerAccountId,p.homeTheme));
    const doc=documents.get(key);
    if(doc?.state.saveSlot!==p.homeWorldKey){c.status='cancelled';c.reason='一方重新开始了岛屿，旧约定停止；已制作成果保留';changed=true;break;}
    const record=doc.state.crossIslandTasks?.[part.command.id],task=doc.state.agentTaskLedger?.find(t=>t.id===part.command.id);
    if(task&&part.taskStatus!==task.status){part.taskStatus=task.status;changed=true;}
    if(!part.proof&&record?.proof&&JSON.stringify(record.command)===JSON.stringify(part.command)&&record.item===part.item&&record.proof.item===part.item){
     part.proof=clone(record.proof);changed=true;
    }
   }
   if(cooperationActive(c)&&c.parts.every(p=>p.proof)){
    c.status='completed';c.completedAt=now();c.reason='双方都完成了约定制作，成果留在各自岛上，合作有了实际依据。';
    c.effects=[];for(const a of e.people){const b=e.people.find(p=>p.actorId!==a.actorId),before=relation(d,a,b),r={...before};
     r.trust=Math.min(100,r.trust+3);r.affinity=Math.min(100,r.affinity+2);r.tension=Math.max(0,r.tension-2);r.lastEvent=c.title+'：双方已完成实际制作';r.at=now();r.label=r.tension>=12?'有些芥蒂':r.affinity< -10?'关系紧张':r.affinity>=18?'熟悉的朋友':r.trust>=10?'信任':'相识';d.relations[relKey(a,b)]=r;c.effects.push({actorId:a.actorId,affinity:r.affinity-before.affinity,trust:r.trust-before.trust,tension:r.tension-before.tension});
    }
    changed=true;
   }
  }
  return changed;
 }
 async function ownedEvent(d,account,eventId){
  const e=d.events.find(e=>e.id===eventId);if(!e||!e.people.some(p=>p.ownerAccountId===account.id)&&e.cooperation?.hostAccountId!==account.id)throw fail('这不是本人居民的相遇','lan_social_owner',403);
  for(const p of e.people){const home=await tenants.readIslandForServer(p.ownerAccountId,p.homeTheme);if(home?.state.saveSlot!==p.homeWorldKey)throw fail('约定所属岛屿已重新开始','lan_social_world');}
  return e;
 }
 async function createProposal(d,e){
  if(d.events.filter(x=>cooperationActive(x.cooperation)&&x.people.some(p=>e.people.some(a=>a.ownerAccountId===p.ownerAccountId))).length>=4)throw fail('先完成已有的合作约定，再开始新的项目');
  if(e.people.some((p,i)=>relation(d,p,e.people[1-i]).tension>=12))throw fail('双方仍有明显分歧，先当面谈清楚再合作');
  if(e.people.some(p=>p.kind==='agent_recruited')){if(d.events.some(x=>x.id!==e.id&&cooperationActive(x.cooperation)&&x.people.some(p=>e.people.some(a=>a.actorId===p.actorId))))throw fail('参与者已有待完成的制作约定。','lan_social_guest_busy');const room=await identities.roomStateForServer(e.roomId);if(!present(room,e.people))throw fail('伙伴与居民需要在本次会客岛上一起确认合作。','lan_social_guest_left');return createGuestProposal({directory,e,room,tenants,now});}
  const shared=e.people[0].interest.find(x=>e.people[1].interest.includes(x)),themes={tea:{title:'各做一份茶点，交流制作心得',buildings:[1,17]},farm:{title:'把园艺想法做成花礼与种苗',buildings:[3,14]},mine:{title:'试做矿物陈列与陶器',buildings:[18,15]},workshop:{title:'手作试样：灯饰与陶器',buildings:[0,15]},gallery:{title:'一起准备小岛展览的试作品',buildings:[24,7]},plaza:{title:'为未来聚会准备两份试作',buildings:[20,21]}},theme=themes[shared]||{title:'各自完成一件手作，再来交换心得',buildings:[0,15]};
  const parts=[];
  for(const [i,p]of e.people.entries()){
   const recipe=ALL_RECIPES.find(r=>r.building===theme.buildings[i]&&r.index===0),doc=await tenants.readIslandForServer(p.ownerAccountId,p.homeTheme);
   if(!recipe||!recipeGate(recipe,doc.state).ready)throw fail('需要先开放合作对应的制作配方');
   const command={id:'cross:'+e.id+':'+p.npcId,npcId:p.npcId,goal:BUILDINGS[recipe.building].kind,buildingId:recipe.building,recipeId:recipe.id,quantity:1,intent:'跨岛约定：为与'+e.people[1-i].name+'交流制作 '+recipe.name};
   parts.push({actorId:p.actorId,ownerAccountId:p.ownerAccountId,name:p.name,command,item:recipe.item,itemName:recipe.name,cost:clone(recipe.cost),proof:null,taskStatus:null});
  }
  return {title:theme.title,status:'proposed',createdAt:now(),accepted:[],parts,reason:'双方先认可方案，返岛后分别安排居民完成制作。'};
 }

 function launch(t,token,payload){const work=(async()=>{try{
  const result=await agents.travelConverse(token,t.roomId,payload);
  await locked(async()=>{const d=await read();await reconcile(d);const row=d.rooms[t.roomId]?.task;if(row?.id!==t.id||row.status!=='thinking'||row.runtimeOwner!==instance)return;
   const room=await identities.roomStateForServer(t.roomId);if(!present(room,t.people)||!await identities.socialMeetingReady(t.roomId,t.people.map(p=>p.actorId),t.id))throw fail('双方没有继续在同一处会面','lan_social_left');
   const event=record(d,t,result);row.status='completed';row.error=null;await save(d);await identities.finishSocialMeeting(t.roomId,t.id,event);
  });
 }catch(e){await locked(async()=>{const d=await read(),slot=d.rooms[t.roomId],row=slot?.task;if(row?.id===t.id&&!ended.has(row.status)){row.status='failed';row.error=String(e.message).slice(0,200);slot.nextAt=Math.max(slot.nextAt,now()+(e.retryAfter?e.retryAfter*1000:NPC_CADENCE.providerFailureSeconds*1000));await save(d);}await identities.finishSocialMeeting(t.roomId,t.id).catch(()=>{});});}})().finally(()=>running.delete(work));running.add(work);void work.catch(()=>{});}
 return{
 async reconcileRooms(){return locked(async()=>{const d=await read();if(await reconcile(d)|await updateCooperations(d))await save(d);});},

 async cooperate(token,input){
  const account=await identities.authorize(token);
  if(!['propose','accept','decline','withdraw','start'].includes(input.operation))throw fail('合作操作无效','lan_social_operation',400);
  return locked(async()=>{const d=await read();if(await updateCooperations(d))await save(d);const e=await ownedEvent(d,account,input.eventId);
   if(input.operation==='propose'){if(!e.cooperation)e.cooperation=await createProposal(d,e);}
   else {const c=e.cooperation;if(!c)throw fail('尚未提出合作方案');
    if(input.operation==='start'){if(c.mode!=='host_workshop')throw fail('普通居民制作安排在返岛后进行。');if(account.id!==c.hostAccountId)throw fail('由主岛在预留材料后安排工位。','lan_social_owner',403);if(['assembling','working','completed'].includes(c.status))return {event:clone(e)};if(c.status!=='agreed'||!c.requiredOwners.every(id=>c.accepted.includes(id)))throw fail('先由所有参与岛主和主岛认可这份方案。');const room=await identities.roomStateForServer(e.roomId);await validateGuestProposal({directory,e,c,room,tenants,now});const old=clone(d);c.status='assembling';c.funded=true;c.reason='主岛材料已预留，居民将沿道路前往各自工位。';c.lastAt=now();await settlements.commit({old,next:d,steps:[guestWalletStep(c,e.id,'reserve')]});await advanceGuest(d,e);}
    else if(input.operation==='withdraw'&&c.mode==='host_workshop'){if(c.status==='completed')throw fail('已完成的合作保留成果记录');await stopGuest(d,e,'一方搁置了约定，尚未使用的材料已退还主岛。');}
    else if(input.operation==='withdraw'){if(c.status==='completed')throw fail('已完成的合作保留成果记录');c.status='cancelled';c.reason='一方搁置了约定，已制作物品保留；已安排的本岛任务可在管家分工中暂停或取消。';}
    else if(c.status==='proposed'){
     if(input.operation==='decline'){c.status='declined';c.reason='一方决定暂不合作，双方的经历仍保留。';}
     else {if(!c.accepted.includes(account.id))c.accepted.push(account.id);if((c.requiredOwners||e.people.map(p=>p.ownerAccountId)).every(id=>c.accepted.includes(id))){c.status='agreed';c.reason=c.mode==='host_workshop'?'所有参与岛主与主岛已认可，由主岛预留材料并安排客岛工位。':'双方已认可，返岛后安排各自居民完成制作。';}}
    }else if(input.operation==='accept'&&!c.accepted.includes(account.id)||input.operation==='decline'&&c.status!=='declined')throw fail('合作状态已变化，请重新查看');
   }
   await save(d);return {event:clone(e)};
  });
 },
 async queueCooperation(token,theme,input){
  const account=await identities.authorize(token);
  if(input.operation!=='queue'||typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId))throw fail('制作安排请求无效','lan_social_request',400);
  return locked(async()=>{const d=await read();if(await updateCooperations(d))await save(d);const e=await ownedEvent(d,account,input.eventId),c=e.cooperation,p=e.people.find(p=>p.ownerAccountId===account.id),part=c?.parts.find(x=>x.actorId===p.actorId);
   if(c?.mode==='host_workshop')throw fail('这份合作在客岛工位完成，不会覆盖伙伴原岛分工。','lan_social_contract');
   if(!part||!['agreed','working','completed'].includes(c.status)||!c.accepted.includes(account.id)||theme!==p.homeTheme)throw fail('双方认可方案并返回对应岛屿后才能安排制作');
   const context=await tenants.get(token),result=await context.saves.queueCrossTask(theme,{worldKey:p.homeWorldKey,plan:{eventId:e.id,...part,retiredIds:d.events.filter(x=>['completed','cancelled','declined'].includes(x.cooperation?.status)).flatMap(x=>x.cooperation.parts.filter(p=>p.ownerAccountId===account.id).map(p=>p.command.id))},expectedVersion:input.expectedVersion,requestId:input.requestId,clientId:input.clientId});
   part.enqueuedAt??=now();if(c.status!=='completed')c.status='working';await save(d);return result;
  });
 },
 async contextForOwner(accountId,theme,worldKey){
  const home=await tenants.readIslandForServer(accountId,theme),activeContract=home?.state.saveSlot===worldKey?home.state.recruitment?.active?.id:null,activeVisit=home?.state.saveSlot===worldKey?home.state.recruitment?.active?.visitId||activeContract:null;
  return locked(async()=>{const d=await read();if(await updateCooperations(d))await save(d);const out={};
   for(const e of d.events)for(const p of e.people.filter(p=>p.ownerAccountId===accountId&&p.homeTheme===theme&&p.homeWorldKey===worldKey&&(p.kind!=='agent_recruited'||p.contractId===activeContract||p.visitId===activeVisit||p.contractId===activeVisit))){
    const peer=e.people.find(a=>a.actorId!==p.actorId),c=e.cooperation,part=c?.parts.find(x=>x.actorId===p.actorId);
    const outcome=c?(c.status==='completed'?'双方已通过生产收据确认完成':c.status==='declined'?'尚未合作':c.status==='cancelled'?'旧约定已停止':part?.proof?'本人已完成，等候对方真实成果':part?.taskStatus?'本人制作任务 '+part.taskStatus:'尚未安排制作'):null;const text=(c?'合作 '+outcome+'：'+c.title+'。':'')+'跨岛认识的'+peer.homeIslandName+'的'+peer.name+'（'+peer.job+'）：'+e.summary;
    (out[p.npcId]??=[]).push(text);
   }
   for(const id of Object.keys(out))out[id]=out[id].slice(-3);return out;
  });
 },

 async tick(token){
  if(closing)return;const account=await identities.authorize(token),presence=await identities.presence(token);if(!presence)return;
  let model=null;
  await locked(async()=>{const d=await read();if(await reconcile(d))await save(d);const room=await identities.roomStateForServer(presence.roomId),slot=d.rooms[room.id]??={nextAt:0,task:null},people=roomPeople(room).filter(c=>['ai','agent_recruited'].includes(c.person.kind)&&room.members[c.person.ownerAccountId]&&now()-room.members[c.person.ownerAccountId].lastSeen<=45000);
   let t=slot.task;
   if(t&&!ended.has(t.status)){
    if(t.status==='thinking'||!t.people.some(p=>p.ownerAccountId===account.id))return;
    if(!await identities.socialMeetingReady(room.id,t.people.map(p=>p.actorId),t.id))return;
    const own=room.members[account.id].travel,doc=await tenants.readIslandForServer(account.id,own.homeTheme);
    if(!doc||doc.state.saveSlot!==own.homeWorldKey)throw fail('原岛档案已变化','lan_social_world');
    const needsByPerson=await Promise.all(t.people.map(async p=>{const home=await tenants.readIslandForServer(p.ownerAccountId,p.homeTheme);if(home?.state.saveSlot!==p.homeWorldKey)throw fail('居民原岛档案已变化','lan_social_world');return home.state.npcNeeds?.[p.npcId]||{energy:78,hunger:76,social:62};}));
    const payload={theme:own.homeTheme,saveSlot:own.homeWorldKey,day:doc.state.day,topic:t.topic,socialType:t.type,events:d.events.filter(e=>e.people.some(p=>t.people.some(a=>a.actorId===p.actorId))).slice(-3).map(e=>e.summary),residents:t.people.map((p,i)=>({...p,id:i,relationships:[{target:1-i,...relation(d,p,t.people[1-i])}],memories:d.events.filter(e=>e.people.some(a=>a.actorId===p.actorId)).slice(-3).map(e=>e.summary),status:'正在与客岛朋友当面交流',needs:needsByPerson[i]}))};
    t.status='thinking';t.runtimeOwner=instance;t.expiresAt=now()+180000;await save(d);
    model={task:clone(t),payload};return;
   }
   if(now()<slot.nextAt)return;
   const candidates=[];for(const a of people.filter(c=>c.person.ownerAccountId===account.id))for(const b of people.filter(c=>c.person.ownerAccountId!==account.id)){
    const r=relation(d,a.person,b.person),score=(r.tension>=8?40:0)+(a.person.interest.some(x=>b.person.interest.includes(x))?20:0)-r.interactions*4-Math.hypot(a.x-b.x,a.y-b.y)/40;candidates.push({a,b,score});}
   candidates.sort((a,b)=>b.score-a.score);
   for(const {a,b}of candidates.slice(0,12)){const id=randomUUID();try{await identities.prepareSocialMeeting(room.id,[a.person.actorId,b.person.actorId],id);}catch{continue}
    const motive=motivation(d,a.person,b.person);slot.task={id,roomId:room.id,people:[clone(a.person),clone(b.person)],...motive,status:'approaching',createdAt:now(),expiresAt:now()+180000};slot.nextAt=now()+NPC_CADENCE.conversationSeconds*1000;await save(d);break;
   }
  });
  if(model)launch(model.task,token,model.payload);
 },
 async view(token){const a=await identities.authorize(token),presence=await identities.presence(token);return locked(async()=>{const d=await read();if(await reconcile(d)|await updateCooperations(d))await save(d);if(!presence)return{events:[],task:null};return{events:d.events.filter(e=>e.roomId===presence.roomId).slice(-20),task:d.rooms[presence.roomId]?.task||null};});},
 async history(token,npcId,theme=null,contractId=null){const a=await identities.authorize(token);if(!Number.isInteger(npcId)||npcId<0||npcId>16||npcId===15)throw fail('请选择居民或临时伙伴','lan_social_npc',400);theme||=a.profile.theme;if(!['pixel','origami'].includes(theme))throw fail('画风无效','lan_social_theme',400);const doc=await tenants.readIslandForServer(a.id,theme);if(!doc)return{events:[]};if(npcId===16){contractId||=doc.state.recruitment?.active?.id;if(typeof contractId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(contractId))return{events:[]};const contract=await readTravelContract(directory,{...a,profile:{...a.profile,theme}},doc,contractId);if(!contract)return{events:[]};contractId=contract.visitId||contract.id;}const actor=a.id+':'+doc.state.saveSlot+(npcId===16?':recruit:'+contractId:':npc:'+npcId);return locked(async()=>{const d=await read();if(await updateCooperations(d))await save(d);return {events:d.events.filter(e=>e.people.some(p=>p.actorId===actor)).slice(-30),actorId:actor};});},
 async close(){closing=true;await Promise.allSettled([...running]);}
 };
}
