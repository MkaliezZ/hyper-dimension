import {mkdir,readFile,rename,unlink,open,stat} from 'node:fs/promises';
import {resolve} from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {availableQuantity} from '../src/resourceLedger.js';import {wornItems,GARMENTS} from '../src/equipmentRules.js';import {ITEM_BY_ID} from '../src/contentCatalog.js';
const clone=v=>structuredClone(v),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=(message,code='a2a_conflict',status=409)=>Object.assign(Error(message),{code,status});
const terminal=new Set(['completed','declined','cancelled','expired']);
export function createLanCollaborationStore({directory,identities,tenants,activities,agents,now=Date.now,fault=async()=>{}}){
 const root=resolve(directory,'_lan'),file=resolve(root,'a2a.json'),lockfile=resolve(root,'a2a.lock'),instanceId=randomUUID(),running=new Map(),executions=new Set();let closing=false;
 async function locked(fn){await mkdir(root,{recursive:true});const token=randomUUID(),start=Date.now();let held=false;while(!held){try{const f=await open(lockfile,'wx',0o600);await f.writeFile(JSON.stringify({pid:process.pid,token}));await f.close();held=true;}catch(e){if(e.code!=='EEXIST')throw e;try{const o=JSON.parse(await readFile(lockfile,'utf8'));try{process.kill(o.pid,0)}catch(x){if(x.code!=='EPERM'){await unlink(lockfile);continue;}}}catch{try{if(Date.now()-(await stat(lockfile)).mtimeMs>30000){await unlink(lockfile);continue;}}catch{}}if(Date.now()-start>5000)throw fail('协作手账正在写入，请稍后核对','a2a_busy',503);await new Promise(r=>setTimeout(r,25));}}try{return await fn();}finally{try{if(JSON.parse(await readFile(lockfile,'utf8')).token===token)await unlink(lockfile);}catch{}}}
 async function read(){try{const d=JSON.parse(await readFile(file,'utf8'));if(d.version!==1||!d.tasks||!d.preferences||!Array.isArray(d.requests)||d.checksum!==hash({...d,checksum:undefined}))throw Error('bad');return d;}catch(e){if(e.code==='ENOENT')return{version:1,tasks:{},preferences:{},requests:[]};throw fail('协作手账校验失败，原记录已保留','a2a_corrupt',503);}}
 async function save(d){delete d.checksum;d.checksum=hash(d);const tmp=file+'.'+randomUUID()+'.tmp';let h;try{h=await open(tmp,'wx',0o600);await h.writeFile(JSON.stringify(d));await h.sync();await h.close();h=null;await rename(tmp,file);}finally{await h?.close().catch(()=>{});await unlink(tmp).catch(()=>{});}}
 const participant=(t,id)=>t.sender.ownerAccountId===id||t.recipient.ownerAccountId===id;
 function own(d,id,owner){const t=d.tasks[id];if(!t||!participant(t,owner))throw fail('这不是你的协作任务','a2a_forbidden',403);return t;}
 function actor(room,id){const p=room.members[id]?.travel?.members.find(x=>x.kind==='hermes');if(!p)throw fail('双方都需要携带本人的管家并在当前房间','a2a_room');return clone(p);}
 const contract=e=>({eventId:e.id,roomId:e.roomId,title:e.title,kind:e.kind,requirements:e.requirements,economy:{mode:e.economy.mode,delivery:e.economy.delivery,entryFee:e.economy.entryFee||0},startsAt:e.startsAt,expiresAt:e.expiresAt});
 async function validate(t,token){const consent=await read();if(!consent.preferences[t.sender.ownerAccountId]?.receive||!consent.preferences[t.recipient.ownerAccountId]?.receive)throw fail('一方已关闭管家协作接收','a2a_consent');if(now()>t.expiresAt)throw fail('协作约定已到期','a2a_expired');const room=await identities.roomStateForServer(t.roomId);
  for(const p of [t.sender,t.recipient])if(actor(room,p.ownerAccountId).actorId!==p.actorId)throw fail('同行管家身份已变化','a2a_actor');
  const e=(await activities.view(token)).events.find(e=>e.id===t.eventId);if(!e||!['preparing','live'].includes(e.phase)||hash(contract(e))!==t.contractHash)throw fail('活动约定已变化，请重新确认协作','a2a_event');
  return {room,e};
 }
 async function preparation(t,e){const p=t.recipient,doc=await tenants.readIslandForServer(p.ownerAccountId,p.homeTheme);if(!doc||doc.state.saveSlot!==p.homeWorldKey)throw fail('对方原岛档案已变化','a2a_world');const s=doc.state,held=s.lanEconomyControl?.holds?.['event:'+e.id+':entry:'+p.ownerAccountId]?.cost||{},missing=[];
  for(const i of e.requirements.items)if(availableQuantity(s,i.item)+(e.economy.delivery==='transfer'?(held[i.item]||0):0)<i.quantity)missing.push(ITEM_BY_ID[i.item].name+' ×'+i.quantity);
  if(e.requirements.garment&&!wornItems(s).includes(e.requirements.garment))missing.push('穿上'+GARMENTS[e.requirements.garment].name);
  if(s.coins+(held.coins||0)<(e.economy.entryFee||0))missing.push('入场费 '+e.economy.entryFee+' 岛币');
  if(e.participants.find(x=>x.id===p.ownerAccountId)?.response!=='accepted')missing.push('先接受活动邀请');
  return {ready:missing.length===0,missing};
 }
 async function reconcile(d){let changed=false;for(const t of Object.values(d.tasks)){if(terminal.has(t.status))continue;
  if(t.status!=='executing'&&(!d.preferences[t.sender.ownerAccountId]?.receive||!d.preferences[t.recipient.ownerAccountId]?.receive)){t.status='cancelled';t.error='一方已关闭协作接收，后续往来停止。';changed=true;continue;}
  if(t.status==='thinking'&&t.runtimeOwner!==instanceId){t.status='retry';t.error='上轮管家答复尚未确认，可以重新核对；尚未执行新的物资操作。';changed=true;}
  try{const r=await identities.roomStateForServer(t.roomId);if(!r.members[t.sender.ownerAccountId]||!r.members[t.recipient.ownerAccountId]){t.status='cancelled';t.error='一方已离岛，协作停止。已发生的活动预留按活动账本核对。';changed=true;}}
  catch(e){if(e.code==='lan_room_missing'||e.code==='lan_room_closed'){t.status='cancelled';t.error='会客已结束；活动预留由原活动账本处理。';changed=true;}else throw e;}
  if(!terminal.has(t.status)&&now()>t.expiresAt){t.status='expired';t.error='协作约定已到期，未自动执行物资操作。';changed=true;}
 }return changed;}
 function project(d,id){return {enabled:!!d.preferences[id]?.receive,tasks:Object.values(d.tasks).filter(t=>participant(t,id)).sort((a,b)=>b.createdAt-a.createdAt).map(clone),preferences:Object.fromEntries(Object.entries(d.preferences).map(([id,p])=>[id,!!p.receive])),capabilities:['event.checkin']};}
 function launch(t,token,stage){const promise=(async()=>{
  try{
   const {e}=await validate(t,token),person=stage==='review'?t.recipient:t.sender,peer=stage==='review'?t.sender:t.recipient;
   const payload={stage,taskId:t.id,theme:person.homeTheme,actor:person,peer,contract:t.contract,messages:t.messages.slice(-6),parentRunId:t.messages.at(-1)?.ledgerRunId||null,preparation:stage==='review'?await preparation(t,e):null,receipt:stage==='confirm'?t.receipt:null};
   if(stage==='confirm'&&!e.participants.find(x=>x.id===t.recipient.ownerAccountId)?.checkedIn)throw fail('原活动的入场准备记录已失效','a2a_receipt');
   const result=await agents.collaborate(token,payload);
   await locked(async()=>{const d=await read(),row=d.tasks[t.id];if(row.status!=='thinking'||row.attempt!==t.attempt)return;await validate(row,token);
    if(result.source!=='hermes'||!result.ledgerRunId||!result.reply)throw fail('管家没有给出可追溯答复','a2a_reply');
    const decision=result.reply.decision,allowed={offer:['propose'],review:['accept','decline','clarify'],confirm:['confirm','clarify']}[stage];if(!allowed.includes(decision))throw fail('答复阶段不匹配','a2a_reply');
    row.messages.push({messageId:randomUUID(),conversationId:row.id,taskId:row.id,parentRunId:payload.parentRunId,senderActorId:person.actorId,recipientActorId:peer.actorId,ownerAccountId:person.ownerAccountId,homeWorldKey:person.homeWorldKey,hostRoomId:row.roomId,capability:row.capability,expiry:row.expiresAt,stage,decision,text:String(result.reply.message).slice(0,360),ledgerRunId:result.ledgerRunId,providerRunId:result.runId,at:now()});
    row.status=stage==='offer'?'offered':stage==='review'?({accept:'accepted',decline:'declined',clarify:'needs_information'})[decision]:decision==='confirm'?'completed':'needs_information';row.error=null;await save(d);
   });
  }catch(e){await locked(async()=>{const d=await read(),row=d.tasks[t.id];if(row?.status==='thinking'&&row.attempt===t.attempt){row.status='retry';row.error=String(e.message).slice(0,240);await save(d);}});}
 })().finally(()=>running.delete(t.id));running.set(t.id,promise);
 }
 return{
 async view(token){const a=await identities.authorize(token);return locked(async()=>{const d=await read();if(await reconcile(d))await save(d);const presence=await identities.presence(token),events=(await activities.view(token)).events.filter(e=>e.roomId===presence?.roomId&&['preparing','live'].includes(e.phase)).map(e=>({...contract(e),owner:e.owner,participants:e.participants}));return {...project(d,a.id),events};});},
 async action(token,i){
  if(closing)throw fail('协作服务正在关闭','a2a_closed',503);
  if(!i||Object.keys(i).some(k=>!['operation','requestId','taskId','eventId','recipientId','receive'].includes(k))||!/^[-a-zA-Z0-9]{8,80}$/.test(i.requestId||''))throw fail('协作请求无效','a2a_invalid',400);
  const a=await identities.authorize(token);let launchTask=null,execution=null;
  const response=await locked(async()=>{const d=await read();await reconcile(d);const fingerprint=hash(i),old=d.requests.find(r=>r.owner===a.id&&r.id===i.requestId);if(old){if(old.fingerprint!==fingerprint)throw fail('相同请求编号不能改变内容','a2a_replay');return {view:project(d,a.id),taskId:old.taskId,replayed:true};}
   let t=null;
   if(i.operation==='preference'){if(typeof i.receive!=='boolean')throw fail('协作接收设置无效','a2a_invalid',400);d.preferences[a.id]={receive:i.receive};}
   else if(i.operation==='offer'){
    if(!d.preferences[a.id]?.receive||!d.preferences[i.recipientId]?.receive)throw fail('双方需先开启接收管家协作','a2a_consent');
    const e=(await activities.view(token)).events.find(e=>e.id===i.eventId);if(!e||e.owner!==a.id||!e.participants.some(p=>p.id===i.recipientId)||a.id===i.recipientId)throw fail('仅能向本人活动的受邀岛主分工','a2a_forbidden',403);
    if(e.participants.find(p=>p.id===i.recipientId)?.checkedIn)throw fail('对方已完成本场入场准备，无需重复分工','a2a_prepared');
    const room=await identities.roomStateForServer(e.roomId),sender=actor(room,a.id),recipient=actor(room,i.recipientId);
    if(Object.values(d.tasks).some(t=>t.eventId===e.id&&t.recipient.ownerAccountId===i.recipientId&&!terminal.has(t.status)))throw fail('双方已有这场活动的待办协作','a2a_duplicate');
    if(Object.keys(d.tasks).length>=512)throw fail('协作记录已达512条上限','a2a_capacity');
    t={id:randomUUID(),roomId:room.id,eventId:e.id,sender,recipient,capability:'event.checkin',contract:contract(e),contractHash:hash(contract(e)),createdAt:now(),expiresAt:Math.min(e.expiresAt,now()+1800000),status:'thinking',runtimeOwner:instanceId,stage:'offer',attempt:randomUUID(),messages:[],receipt:null,error:null};await validate(t,token);d.tasks[t.id]=t;launchTask=clone(t);
   }else{
    t=own(d,i.taskId,a.id);
    if(i.operation==='cancel'){if(t.status==='executing')throw fail('物资核对正在进行，请先查看实际回执','a2a_busy');if(terminal.has(t.status))throw fail('此协作已结束','a2a_ended');t.status='cancelled';}
    else{
     if(terminal.has(t.status))throw fail('此协作已结束','a2a_ended');await validate(t,token);
     if(i.operation==='review'){if(a.id!==t.recipient.ownerAccountId||!['offered','needs_information','retry'].includes(t.status))throw fail('当前不是你的审阅阶段','a2a_stage');t.stage='review';}
     else if(i.operation==='confirm'){if(a.id!==t.sender.ownerAccountId||!t.receipt||!['executed','retry','needs_information'].includes(t.status))throw fail('尚无可确认的执行回执','a2a_stage');t.stage='confirm';}
     else if(i.operation==='retry'){if(t.status!=='retry'||a.id!==(t.stage==='review'?t.recipient:t.sender).ownerAccountId)throw fail('当前不能重试该阶段','a2a_stage');}
     else if(i.operation==='execute'){if(a.id!==t.recipient.ownerAccountId||!['accepted','executing','execution_failed'].includes(t.status))throw fail('请先由本人管家接受协作，再确认执行','a2a_stage');t.status='executing';execution=clone(t);}
     else throw fail('不支持此协作操作','a2a_invalid',400);
     if(!execution){t.status='thinking';t.runtimeOwner=instanceId;t.attempt=randomUUID();launchTask=clone(t);}
    }
   }
   d.requests.push({id:i.requestId,owner:a.id,fingerprint,taskId:t?.id||null});d.requests=d.requests.slice(-2000);await save(d);
   return {view:project(d,a.id),taskId:t?.id||null,replayed:false};
  });
  if(launchTask)launch(launchTask,token,launchTask.stage);
  if(execution){
   const work=(async()=>{try{const {e}=await validate(execution,token),prepared=await preparation(execution,e);if(!prepared.ready)throw fail('尚未备齐：'+prepared.missing.join('、'),'a2a_preparation');
    const requestId='a2a-'+execution.id+'-checkin',r=await activities.action(token,{operation:'checkin',eventId:execution.eventId,requestId});
    await fault('after-checkin',{task:execution});
    const current=r.view.events.find(e=>e.id===execution.eventId);if(!current||!['preparing','live'].includes(current.phase)||!current.participants.find(p=>p.id===a.id)?.checkedIn)throw fail('活动准备回执尚未确认','a2a_receipt');
    await locked(async()=>{const d=await read(),t=own(d,execution.id,a.id);t.receipt={verified:true,service:'lan-activity',operation:'checkin',requestId,eventId:t.eventId,accountId:a.id,worldKey:t.recipient.homeWorldKey,at:now(),reserved:current.economy.myHold?.cost||{},delivery:current.economy.delivery,note:'仅确认入场准备及约定预留，实际交付以活动结束结算为准'};if(!terminal.has(t.status)){t.status='executed';t.error=null;}await save(d);});
   }catch(e){await locked(async()=>{const d=await read(),t=own(d,execution.id,a.id);if(!terminal.has(t.status)){t.status='execution_failed';t.error=String(e.message).slice(0,240);}await save(d);});}
   return {view:await this.view(token),taskId:execution.id,replayed:false};})();executions.add(work);try{return await work;}finally{executions.delete(work);}
  }
  return response;
 },
 async close(){closing=true;await Promise.allSettled([...running.values(),...executions]);}
 };
}
