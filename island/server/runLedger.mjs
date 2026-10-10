import {openExclusiveFile} from './atomicJson.mjs';
import './runtimeConfig.mjs';
import {mkdir,readFile,writeFile,rename,unlink,stat,open} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {NPC_CADENCE} from '../src/npcCadence.js';
export const RUN_INTERVALS=Object.freeze({plans:NPC_CADENCE.planSeconds,conversations:NPC_CADENCE.conversationSeconds,steward:NPC_CADENCE.stewardSeconds,recruitment:NPC_CADENCE.stewardSeconds});
const RUN_LIMIT=500;
const clone=v=>JSON.parse(JSON.stringify(v));
const fail=(message,code,status=503,retryAfter=0)=>Object.assign(Error(message),{code,status,retryAfter});
const count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
export function normalizeRunUsage(raw){
 if(!raw||typeof raw!=='object')return null;
 const u={input:count(raw.input??raw.prompt_tokens),output:count(raw.output??raw.completion_tokens),
  total:count(raw.total??raw.total_tokens),calls:count(raw.calls),cacheRead:count(raw.cacheRead??raw.prompt_cache_hit_tokens),
  uncachedInput:count(raw.uncachedInput??raw.prompt_cache_miss_tokens),knownTotal:count(raw.knownTotal),reportedCalls:count(raw.reportedCalls),unknownCalls:count(raw.unknownCalls)};
 if(u.total===null&&u.input!==null&&u.output!==null)u.total=u.input+u.output;
 if(u.total!==null&&u.input!==null&&u.output!==null&&u.total!==u.input+u.output)u.total=null;
 if(u.knownTotal===null)u.knownTotal=u.total;
 return Object.values(u).some(v=>v!==null)?u:null;
}
export function combineRunUsage(...values){
 const rows=values.map(normalizeRunUsage);if(!rows.length||rows.some(v=>!v))return null;
 return Object.fromEntries(['input','output','total','knownTotal','calls','reportedCalls','unknownCalls','cacheRead','uncachedInput'].map(k=>[k,rows.every(r=>r[k]!==null)?rows.reduce((n,r)=>n+r[k],0):null]));
}
const dayKey=ms=>new Date(ms+8*3600000).toISOString().slice(0,10);
const initial=()=>({policy:{version:1,paused:false,dailyRunLimit:null,dailyTokenLimit:null},nextAt:{},
 runs:[],days:{},settingsHistory:[],settingsReceipts:[],accepted:{plans:0,conversations:0,steward:0},limited:{plans:0,conversations:0,steward:0}});
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
function day(s,key){return s.days[key]??={automaticRuns:0,manualRuns:0,providerStarts:0,knownTokens:0,automaticTokens:0,automaticUnknownFinished:0,unknownFinished:0,completed:0,failed:0}}
function contribution(r){
 return {automaticTokens:r.automatic?(r.usage?.knownTotal??r.usage?.total??0):0,automaticUnknownFinished:r.automatic&&r.phase!=='running'&&r.providerStarted&&r.usage?.total==null?1:0,knownTokens:r.usage?.knownTotal??r.usage?.total??0,unknownFinished:r.phase!=='running'&&r.providerStarted&&r.usage?.total==null?1:0,
 completed:['completed','late_completed'].includes(r.phase)?1:0,
 failed:['failed','timed_out','interrupted'].includes(r.phase)?1:0};
}
function updateContribution(s,r,before){
 const a=before?contribution(before):{automaticTokens:0,automaticUnknownFinished:0,knownTokens:0,unknownFinished:0,completed:0,failed:0},b=contribution(r),d=day(s,r.budgetDay);
 for(const k of Object.keys(a))d[k]+=b[k]-a[k];
}
export function createRunLedger({directory,now=Date.now,pid=process.pid}){
 const root=resolve(directory),current=join(root,'current.json'),previous=join(root,'previous.json'),lockPath=join(root,'write.lock');
 async function atomic(path,text){const temp=path+'.'+randomUUID()+'.tmp';let f;try{f=await open(temp,'wx',0o600);await f.writeFile(text);await f.sync();await f.close();f=null;await rename(temp,path)}finally{await f?.close().catch(()=>{});await unlink(temp).catch(()=>{})}}
 async function locked(fn){
  await mkdir(root,{recursive:true});const token=randomUUID(),start=Date.now();let obtained=false;
  while(!obtained){try{const f=await openExclusiveFile(lockPath);await f.writeFile(JSON.stringify({pid:process.pid,token}));await f.close();obtained=true}
   catch(e){if(e.code!=='EEXIST')throw e;
    try{const o=JSON.parse(await readFile(lockPath,'utf8'));let alive=true;try{process.kill(o.pid,0)}catch(x){alive=x.code==='EPERM'}if(!alive){await unlink(lockPath);continue}}
    catch{try{if(Date.now()-(await stat(lockPath)).mtimeMs>30000){await unlink(lockPath);continue}}catch{}}
    if(Date.now()-start>6000)throw fail('运行账本正在写入，请稍后重试','run_ledger_busy');
    await new Promise(r=>setTimeout(r,30));
   }
  }
  try{return await fn()}finally{try{if(JSON.parse(await readFile(lockPath,'utf8')).token===token)await unlink(lockPath)}catch{}}
 }
 async function load(){
  try{const text=await readFile(current,'utf8'),doc=JSON.parse(text);
   if(doc.schema!==43||doc.checksum!==digest(doc.state)||!Array.isArray(doc.state?.runs)||!doc.state.policy)throw Error('invalid ledger');
   return {state:doc.state,text,revision:doc.revision};
  }catch(e){if(e.code==='ENOENT')return {state:initial(),text:null,revision:0};throw fail('运行账本校验失败，原文件保留；暂停新调用并检查备份','run_ledger_corrupt')}
 }
 async function save(s,old){
  s.runs=s.runs.filter(r=>r.phase==='running').concat(s.runs.filter(r=>r.phase!=='running').slice(-RUN_LIMIT)).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
  for(const key of Object.keys(s.days).sort().slice(0,-90))delete s.days[key];
  const doc={schema:43,revision:old.revision+1,state:s,checksum:digest(s)};
  if(old.text)await atomic(previous,old.text);
  await atomic(current,JSON.stringify(doc));
 }
 function view(s){
  const today=dayKey(now()),todayData=clone(day(s,today)),policy=clone(s.policy);
  return {schema:43,budgetDay:today,timeZone:'Asia/Singapore',retainedRuns:s.runs.length,runLimit:RUN_LIMIT,
   policy,today:{...todayData,inflight:s.runs.filter(r=>r.phase==='running').length},
   channels:Object.fromEntries(Object.entries(RUN_INTERVALS).map(([k,intervalSeconds])=>[k,{intervalSeconds,accepted:s.accepted[k]||0,retryAfter:Math.max(0,Math.ceil(((s.nextAt[k]||0)-now())/1000)),limited:s.limited[k]||0}])),
   runs:clone(s.runs.slice().reverse()),settingsHistory:clone(s.settingsHistory.slice().reverse())};
 }
 async function transact(fn){return locked(async()=>{const old=await load(),s=old.state,result=await fn(s);await save(s,old);return result})}
 return {
  async snapshot(){return locked(async()=>{const old=await load(),s=old.state;let changed=!s.days[dayKey(now())];
   for(const r of s.runs.filter(r=>r.phase==='running')){let alive=true;try{process.kill(r.ownerPid,0)}catch(e){alive=e.code==='EPERM'}
    if(!alive){changed=true;const before=clone(r);r.phase='interrupted';r.endedAt=new Date(now()).toISOString();r.resultCode='process_exit';updateContribution(s,r,before)}}
   const result=view(s);if(changed)await save(s,old);return result;
  })},
  async begin({kind,automatic=false,theme=null,participants=[],projectIds=[],externalId=null,parentRunId=null}={}){
   if(typeof kind!=='string'||!['plans','conversations','steward','steward_manual','recruitment','party_suggestion','legacy_plan','a2a','resident_chat'].includes(kind))throw fail('运行类型无效','invalid_run',400);
   if(automatic&&!RUN_INTERVALS[kind])throw fail('自动运行类型无效','invalid_run',400);
   let rejection;
   const result=await transact(s=>{
    const key=dayKey(now()),d=day(s,key);
    if(automatic){
     if(s.policy.paused)rejection=fail('自动模型活动已暂停，居民沿用本地生活安排','automatic_paused',429,300);
     else if(s.policy.dailyRunLimit!==null&&d.automaticRuns>=s.policy.dailyRunLimit)rejection=fail('今日自动运行次数达到上限','automatic_budget_exhausted',429,Math.ceil((Date.parse(key+'T00:00:00+08:00')+86400000-now())/1000));
     else if(s.policy.dailyTokenLimit!==null&&d.automaticTokens>=s.policy.dailyTokenLimit)rejection=fail('今日已回报用量达到自动上限','automatic_budget_exhausted',429,Math.ceil((Date.parse(key+'T00:00:00+08:00')+86400000-now())/1000));
     else if(now()<(s.nextAt[kind]||0))rejection=fail('模型更新间隔尚未结束，沿用当前生活安排','automatic_cooldown',429,Math.ceil((s.nextAt[kind]-now())/1000));
     if(rejection){s.limited[kind]=(s.limited[kind]||0)+1;return null;}
     s.nextAt[kind]=now()+RUN_INTERVALS[kind]*1000;d.automaticRuns++;s.accepted[kind]=(s.accepted[kind]||0)+1;
    }else d.manualRuns++;
    const r={id:'run-'+randomUUID(),kind,automatic,theme:['pixel','origami'].includes(theme)?theme:null,
     participants:participants.filter(i=>Number.isInteger(i)&&i>=0&&i<=16).slice(0,16),
     projectIds:projectIds.filter(i=>typeof i==='string'&&i.length<=120).slice(0,4),externalId:typeof externalId==='string'?externalId.slice(0,120):null,
     model:'deepseek-flash',parentRunId:typeof parentRunId==='string'?parentRunId.slice(0,120):null,ownerPid:pid,budgetDay:key,startedAt:new Date(now()).toISOString(),endedAt:null,
     phase:'running',providerStarted:false,usage:null,providerRunId:null,children:[],resultCode:null};
    s.runs.push(r);return clone(r);
   });
   if(rejection)throw rejection;return result;
  },
  async providerStarted(id){return transact(s=>{const r=s.runs.find(r=>r.id===id);if(r&&!r.providerStarted){r.providerStarted=true;day(s,r.budgetDay).providerStarts++}return !!r})},
  async finish(id,{phase='completed',usage=null,providerRunId=null,children=[],resultCode=null}={}){
   if(!['completed','failed','timed_out','interrupted','local_fallback'].includes(phase))throw fail('运行状态无效','invalid_run',400);
   return transact(s=>{const r=s.runs.find(r=>r.id===id);if(!r)return false;const before=clone(r),normalized=normalizeRunUsage(usage);
    if(r.phase==='running'||phase==='completed'&&['timed_out','interrupted','late_completed'].includes(r.phase)||normalized){
     if(r.phase!=='running'&&phase==='failed'&&!normalized)return clone(r);
     r.phase=phase==='completed'&&['timed_out','interrupted','late_completed'].includes(r.phase)?'late_completed':phase;
     r.usage=normalized||r.usage;r.endedAt=new Date(now()).toISOString();
     r.providerRunId=typeof providerRunId==='string'?providerRunId.slice(0,120):r.providerRunId;
     r.children=children.slice(0,2).map(c=>({id:typeof c.id==='string'?c.id.slice(0,120):null,parentId:typeof c.parentId==='string'?c.parentId.slice(0,120):null,usage:normalizeRunUsage(c.usage),phase:['completed','failed'].includes(c.phase)?c.phase:'unknown'}));
     r.resultCode=typeof resultCode==='string'?resultCode.slice(0,60):null;updateContribution(s,r,before);
    }return clone(r);
   });
  },
  async setPolicy(input){
   if(!input||typeof input.requestId!=='string'||!input.requestId||input.requestId.length>120||!Number.isSafeInteger(input.expectedVersion))throw fail('设置请求无效','invalid_policy',400);
   const fields=input.policy;
   if(!fields||typeof fields.paused!=='boolean'||Object.keys(fields).some(k=>!['paused','dailyRunLimit','dailyTokenLimit'].includes(k))||
    ![fields.dailyRunLimit,fields.dailyTokenLimit].every(v=>v===null||Number.isSafeInteger(v)&&v>0&&v<=1000000000))throw fail('预算需为正整数或留空不限','invalid_policy',400);
   return transact(s=>{
    const sig=JSON.stringify(fields),old=s.settingsReceipts.find(r=>r.id===input.requestId);
    if(old){if(old.signature!==sig)throw fail('同一设置编号内容不同','policy_conflict',409);return view(s)}
    if(s.policy.version!==input.expectedVersion)throw fail('设置已在其他窗口更新，请刷新后再修改','policy_conflict',409);
    const before=clone(s.policy);s.policy={...fields,version:s.policy.version+1};
    s.settingsHistory.push({at:new Date(now()).toISOString(),before,after:clone(s.policy)});s.settingsHistory=s.settingsHistory.slice(-32);
    s.settingsReceipts.push({id:input.requestId,signature:sig});s.settingsReceipts=s.settingsReceipts.slice(-64);return view(s);
   });
  }
 };
}
export const runLedger=createRunLedger({directory:resolve(process.env.HD_RUN_LEDGER_DIR||join(process.env.HD_SAVE_DIR||resolve(import.meta.dirname,'../data/saves'),'_runs'))});
