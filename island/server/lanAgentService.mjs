import {manualPartyContext} from './manualPartyContext.mjs';
import {travelPerson} from './lanTravelParty.mjs';
import {fork} from 'node:child_process';
import {mkdir,readFile,writeFile,rename,unlink,open} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');
const liveOwnerProcesses=new Set();
const fail=(message,code,status=409)=>Object.assign(Error(message),{code,status});
const clone=structuredClone,hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function createOwnerRuntime({directory,ownerId,islandDirectory=directory}){
 const documents=resolve(directory,'documents'),pending=new Map();let child=null,serial=0,idle=null,closed=false;
 async function start(){
  if(closed)throw fail('管家运行端已停止','lan_agent_closed',503);
  if(child)return child;
  await mkdir(documents,{recursive:true});
  if(child)return child;
  if(liveOwnerProcesses.size>=4)throw fail('四位岛主的管家运行端正在使用中，请稍后再试','lan_agent_capacity',503);
  child=fork(resolve(root,'server/lanAgentWorker.mjs'),[],{cwd:root,windowsHide:true,stdio:['ignore','ignore','ignore','ipc'],env:{...process.env,
   HD_SAVE_DIR:islandDirectory,HD_RUN_LEDGER_DIR:resolve(directory,'runs'),HD_ARTIFACT_DIR:resolve(directory,'artifacts'),
   HD_HERMES_HOME:resolve(directory,'hermes'),HD_STEWARD_WORKDIR:documents,TERMINAL_CWD:documents,HD_DOCUMENT_ROOT:documents,HD_AGENT_OWNER:ownerId}});
  const proc=child;liveOwnerProcesses.add(proc);
  proc.on('message',r=>{const w=pending.get(r.id);if(!w)return;pending.delete(r.id);clearTimeout(w.timer);r.error?w.reject(Object.assign(fail(r.error.message,r.error.code||'lan_agent_runtime',r.error.status||503),{retryAfter:r.error.retryAfter||0})):w.accept(r.value);scheduleIdle();});
  const gone=()=>{liveOwnerProcesses.delete(proc);if(child===proc)child=null;for(const w of pending.values()){clearTimeout(w.timer);w.reject(fail('管家执行端断开，结果尚未确认，请先检查文档成果','lan_agent_interrupted',503));}pending.clear();};
  proc.once('exit',gone);proc.once('error',gone);return proc;
 }
 function scheduleIdle(){clearTimeout(idle);if(!pending.size)idle=setTimeout(()=>{if(!pending.size&&child?.connected)child.send({method:'close'});},180000).unref();}
 return{
  async call(method,args={}){clearTimeout(idle);const proc=await start(),id=++serial;return new Promise((accept,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(fail('管家请求超时，执行结果尚未确认','lan_agent_timeout',503));if(proc.connected)proc.send({method:'close'});},260000);
   pending.set(id,{accept,reject,timer});proc.send({id,method,args},e=>{if(e){clearTimeout(timer);pending.delete(id);reject(e)}});
  });},
  async close(){closed=true;clearTimeout(idle);if(!child)return;const proc=child;await new Promise(r=>{proc.once('exit',r);proc.once('error',r);if(proc.connected)proc.send({method:'close'});else r();});},
  documents
 };
}
export function createLanAgentService({directory,identities,tenants,runtimeFactory=createOwnerRuntime,socialContext=async()=>({}),now=Date.now}){
 const accounts=new Map();let closed=false,recruitmentHooks=null;
 async function account(token){
  if(closed)throw fail('管家服务正在关闭','lan_agent_closed',503);
  const c=await tenants.get(token);
  let promise=accounts.get(c.accountId);
  if(!promise){promise=(async()=>{
   const dir=resolve(directory,'_lan','agents',c.accountId);await mkdir(dir,{recursive:true});const file=resolve(dir,'conversation.json');
   let state;try{state=JSON.parse(await readFile(file,'utf8'));if(state.version!==1||!Array.isArray(state.jobs))throw Error('invalid agent journal')}
   catch(e){if(e.code!=='ENOENT')throw fail('管家记录无法核对，原记录已保留','lan_agent_corrupt',503);state={version:1,jobs:[],seeds:{}};}
   const a={dir,file,state,runtime:runtimeFactory({directory:dir,ownerId:c.accountId,islandDirectory:c.directory}),tail:Promise.resolve(),running:null,automatic:new Set(),automaticTasks:new Map()};
   let changed=false;for(const j of state.jobs)if(j.status==='running'){j.status='unconfirmed';j.error='服务重启前的执行结果尚未确认，请先检查成果；不会自动重复执行。';changed=true;}
   if(changed)await persist(a);return a;
  })();accounts.set(c.accountId,promise);promise.catch(()=>accounts.delete(c.accountId));}
  return {a:await promise,c};
 }
 async function persist(a){const tmp=a.file+'.'+randomUUID()+'.tmp';let handle;try{handle=await open(tmp,'wx',0o600);await handle.writeFile(JSON.stringify(a.state));await handle.sync();await handle.close();handle=null;await rename(tmp,a.file);}finally{await handle?.close().catch(()=>{});await unlink(tmp).catch(()=>{});}}
 function lock(a,fn){const next=a.tail.then(fn);a.tail=next.catch(()=>{});return next;}
 async function world(c,theme){
  if(!['pixel','origami'].includes(theme))throw fail('画风无效','lan_agent_theme',400);
  const d=await tenants.readIslandForServer(c.accountId,theme);if(!d)throw fail('请先进入自己的小岛建立档案','lan_save_missing',404);
  return d.state;
 }
 const history=(a,key)=>[...(a.state.seeds[key]||[]),...a.state.jobs.filter(j=>j.worldKey===key).flatMap(j=>[
  {role:'user',content:j.message},...(j.result?.answer?[{role:'assistant',content:j.result.answer}]:[])])].slice(-12);
 async function submit(token,input){
  const {a,c}=await account(token),theme=input.theme||c.account.profile.theme,requestId=input.requestId,message=String(input.message||'').trim();
  if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{8,100}$/.test(requestId)||!message||message.length>1000)throw fail('请填写有效的委托和请求编号','lan_agent_input',400);
  if(input.resumeSessionId!==undefined&&(typeof input.resumeSessionId!=='string'||!/^[-A-Za-z0-9_]{6,100}$/.test(input.resumeSessionId)))throw fail('请选择有效的工作记录','lan_agent_session',400);
  const fingerprint=hash({theme,message,includeWorkProject:!!input.includeWorkProject,...(input.resumeSessionId?{resumeSessionId:input.resumeSessionId}:{})});
  return lock(a,async()=>{
   const old=a.state.jobs.find(j=>j.id===requestId);
   if(old){if(old.fingerprint!==fingerprint)throw fail('同一委托编号不能更换内容','lan_agent_replay');return clone(old);}
   if(a.running)throw fail('管家正在完成上一项委托，可先查看进度','lan_agent_busy');
   if(a.state.jobs.length>=1000)throw fail('管家手账已达当前容量，请先导出整理记录','lan_agent_capacity');
   const state=await world(c,theme),worldKey=state.saveSlot;
   if(input.saveSlot&&input.saveSlot!==worldKey)throw fail('原岛档案已变化，请重新打开管家','lan_agent_world');
   if(!a.state.seeds[worldKey])a.state.seeds[worldKey]=(state.stewardChat?.messages||[]).filter(m=>(m.role==='user'&&m.status==='sent')||(m.role==='assistant'&&m.status==='done')).slice(-12).map(m=>({role:m.role,content:String(m.text||'').slice(0,1400)}));
   const prior=history(a,worldKey),presence=await identities.presence(token),job={id:requestId,fingerprint,theme,worldKey,message,status:'running',createdAt:now(),location:presence?'visit':'home',...(input.resumeSessionId?{resumeSessionId:input.resumeSessionId}:{})};
   // Durable request identity is written before any model or document tool starts.
   a.state.jobs.push(job);try{await persist(a)}catch(e){a.state.jobs.pop();throw e;}
   a.running=job.id;
   const data={...input,theme,saveSlot:worldKey,history:prior,automatic:false,message,butler:travelPerson(c.account,{state},15),
    events:[...(Array.isArray(input.events)?input.events:[]),presence?'岛主正在会客，原岛生产暂停；岛内分工只能讨论，不能声称已经执行。':'岛主正在自己的小岛。']};
   // Client metadata never chooses an owner, runtime directory, or conversation history.
   delete data.ownerId;delete data.runtime;delete data.directory;
   Object.assign(data,manualPartyContext(state,theme,{saveSlot:input.saveSlot,visiting:!!presence}));
   if(presence){data.residents=[];data.built=[];data.recipes=[];data.inventory=state.inventory||{};}
   void Promise.resolve(a.automaticTasks.get('steward')).catch(()=>{}).then(()=>a.runtime.call('command',data)).then(result=>lock(a,async()=>{
    job.result=result;job.status=result.source==='hermes'?'completed':'failed';job.finishedAt=now();await persist(a);
   }),error=>lock(a,async()=>{job.status='unconfirmed';job.error=String(error.message).slice(0,300);job.finishedAt=now();await persist(a);})).catch(()=>{job.status='unconfirmed';job.error='执行记录保存失败，请检查文档成果后核对';}).finally(()=>{a.running=null;});
   return clone(job);
  });
 }
 return{
  submit,
  setRecruitmentHooks(hooks){recruitmentHooks=hooks;},
  async automatic(token,kind,input){
   if(!['plans','conversations','steward'].includes(kind))throw fail('自动运行类型无效','lan_agent_method',400);
   const {a,c}=await account(token),theme=input.theme;
   const before=await identities.homeAgentContext(token),state=await world(c,theme);
   if(input.saveSlot!==state.saveSlot)throw fail('岛屿档案已变化，忽略旧的自动安排','lan_agent_stale');
   if(kind==='steward'&&a.running)throw Object.assign(fail('管家正在完成你的委托，自动巡查稍后继续','automatic_cooldown',429),{retryAfter:60});
   if(a.automatic.has(kind))throw Object.assign(fail('本轮自动安排仍在处理中','automatic_cooldown',429),{retryAfter:30});
   a.automatic.add(kind);
   try{
    // Only gameplay observations enter automatic rounds. Personal history and documents never do.
    const crossMemories=await socialContext(c.accountId,theme,state.saveSlot);
    const data={theme,saveSlot:state.saveSlot,day:state.day,built:input.built,inventory:input.inventory,
     recipes:input.recipes,projects:input.projects,taskBoard:input.taskBoard,journey:input.journey,tasks:input.tasks,
     events:input.events,executions:input.executions,economy:input.economy,residents:(input.residents||[]).map(r=>({...r,memories:[...(r.memories||[]),...(crossMemories[r.id]||[])]})),
     topic:input.topic,socialType:input.socialType,butler:travelPerson(c.account,{state},15),
     history:[],includeWorkProject:false,automatic:true};
    if(kind==='steward'&&recruitmentHooks){const v=await recruitmentHooks.observe(token,theme);data.recruitment={eligible:v.eligible,reason:v.reason,stats:v.stats,policy:{enabled:v.policy.enabled,dailyBudget:v.policy.dailyBudget,maxContractsPerDay:v.policy.maxContractsPerDay,coinFloor:v.policy.coinFloor},opportunities:v.opportunities.slice(0,12).map(o=>({...o,steps:o.steps.slice(0,6)}))};}
    const running=a.runtime.call(kind,data);a.automaticTasks.set(kind,running);
    const result=await running;
    const after=await identities.homeAgentContext(token),current=await world(c,theme);
    if(after.travelEpoch!==before.travelEpoch||current.saveSlot!==state.saveSlot)throw fail('出行或档案已变化，本轮旧安排已失效','lan_agent_stale');
    if(kind==='steward'&&recruitmentHooks){const decision=await recruitmentHooks.decide(token,theme,result);result.recruitmentOffers=decision.offers;result.recruitmentReason=decision.reason||null;}
    return result;
   }finally{a.automatic.delete(kind);a.automaticTasks.delete(kind);}
  },
  async travelConverse(token,roomId,data){
   const {a}=await account(token),before=await identities.presence(token);
   if(before?.roomId!==roomId)throw fail('当前已不在会客房','lan_agent_stale');
   if(a.automatic.has('conversations'))throw Object.assign(fail('本轮交谈仍在处理中','automatic_cooldown',429),{retryAfter:30});
   a.automatic.add('conversations');
   try{const result=await a.runtime.call('conversations',{...data,encounter:true,history:[],includeWorkProject:false,automatic:true});if((await identities.presence(token))?.roomId!==roomId)throw fail('离岛后旧交谈已失效','lan_agent_stale');return result;}
   finally{a.automatic.delete('conversations');}
  },
  async collaborate(token,payload){
   const {a,c}=await account(token);
   if(payload.actor?.ownerAccountId!==c.accountId)throw fail('协作管家与当前岛主不一致','lan_agent_owner',403);
   const id='a2a:'+payload.taskId;
   await lock(a,async()=>{if(a.running)throw fail('管家正在处理其他委托，请稍后继续协作','provider_busy');a.running=id;});
   try{await Promise.resolve(a.automaticTasks.get('steward')).catch(()=>{});return await a.runtime.call('a2a',payload);}
   finally{if(a.running===id)a.running=null;}
  },

  async homeTools(token){
   const {a,c}=await account(token);a.cancelledRecruitments??=new Set();
   async function exclusive(id,run){
    await lock(a,async()=>{if(a.running)throw fail('管家正在处理另一项委托，请稍后继续','provider_busy');a.running=id;});
    try{await Promise.resolve(a.automaticTasks.get('steward')).catch(()=>{});return await run();}
    finally{if(a.running===id)a.running=null;}
   }
   return {
    recruit:async(context,id)=>{try{return await exclusive('recruit:'+id,async()=>{
     if(a.cancelledRecruitments.has(id))throw fail('招聘已取消','recruitment_cancelled');
     const theme=id.split(':')[0],state=await world(c,theme);if(state.saveSlot!==context.world)throw fail('招聘所属岛屿已改变','lan_agent_stale');
     const payload=structuredClone(context);if(payload.continuingVisit&&socialContext)payload.continuingVisit.encounters=(await socialContext(c.accountId,theme,state.saveSlot))[16]||[];return a.runtime.call('recruit',{context:payload,id});
    });}finally{a.cancelledRecruitments.delete(id);}},
    cancelRecruit:async id=>{if(a.running==='recruit:'+id)a.cancelledRecruitments.add(id);return a.runtime.call('cancelRecruit',{id});},
    suggest:payload=>exclusive('party-suggestion:'+randomUUID(),()=>a.runtime.call('suggestParty',payload))
   };
  },

  async status(token){const {a}=await account(token);const status=await a.runtime.call('status');return {...status,automaticAvailable:true,personalRuntime:true,deviceBridge:false,a2a:true,a2aProtocol:'hyper-dimension-v1',a2aCapabilities:['event.checkin']};},
  async view(token,theme){const {a,c}=await account(token);theme||=c.account.profile.theme;const state=await world(c,theme);
   return {ownerId:c.accountId,worldKey:state.saveSlot,butler:travelPerson(c.account,{state},15),theme,documents:a.runtime.documents,jobs:clone(a.state.jobs.filter(j=>j.worldKey===state.saveSlot).slice(-60)),capabilities:{personalRuntime:true,workspaceDocuments:true,deviceBridge:false,a2a:true,a2aProtocol:'hyper-dimension-v1',a2aCapabilities:['event.checkin']},status:await a.runtime.call('status')};
  },
  async wait(token,input){const job=await submit(token,input),{a}=await account(token);while(a.running===job.id)await new Promise(r=>setTimeout(r,100));const done=a.state.jobs.find(j=>j.id===job.id);if(!done.result)throw fail(done.error||'委托尚待核对','lan_agent_unconfirmed',409);return {...clone(done.result),requestId:done.id};},
  async residentChat(token,method,args){const {a}=await account(token);if(!['residentChatHistory','residentChatSend'].includes(method))throw fail('不支持此居民对话操作','resident_chat_method',400);return a.runtime.call(method,args);},
  async work(token,method,args){const {a}=await account(token);if(!['list','project','detail','preview','download','ledger','policy'].includes(method))throw fail('不支持此管家操作','lan_agent_method',400);return a.runtime.call(method,args);},
  async close(){closed=true;for(const promise of accounts.values()){try{const a=await promise;await a.runtime.close();await a.tail;}catch{}}accounts.clear();}
 };
}
