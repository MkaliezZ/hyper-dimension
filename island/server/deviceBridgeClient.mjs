import {mkdir,readFile,stat,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {hostname} from 'node:os';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {atomicJSON} from './atomicJson.mjs';
import {acquireDataLease,alive} from './dataLease.mjs';
import {createOwnerRuntime} from './lanAgentService.mjs';
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const fail=(message,code='bridge_client')=>Object.assign(Error(message),{code});
const checksum=v=>hash({...v,checksum:undefined});
export function normalizeBridgeServer(value,{allowInsecureLAN=false}={}){
 const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw fail('请使用不含凭据的服务地址');
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!loopback&&!allowInsecureLAN)throw fail('原机连接需要 HTTPS；受信局域网演示可明确使用 --allow-insecure-lan。','bridge_transport');
 return url.href.replace(/\/$/,'');
}
export async function createDeviceBridgeClient({server,workspace,directory,pairCode,name=hostname(),allowInsecureLAN=false,fetchImpl=fetch,runtimeFactory=createOwnerRuntime,now=Date.now,heartbeatMs=15000}){
 server=normalizeBridgeServer(server,{allowInsecureLAN});const root=resolve(directory),lease=await acquireDataLease({directory:root,mode:'runtime'});let runtime=null,heartbeat=null,heartbeatPending=null,closed=false,configuration,closePromise;
 try{
  workspace=await realpath(resolve(workspace));if(!(await stat(workspace)).isDirectory())throw fail('请选择现有的工作区文件夹');await mkdir(root,{recursive:true});const file=resolve(root,'client.json');
  try{configuration=JSON.parse(await readFile(file,'utf8'));if(configuration.schema!==1||configuration.server!==server||configuration.workspace!==workspace||configuration.checksum!==checksum(configuration))throw fail('原机配对记录与地址／工作区不匹配，请使用新的状态目录。','bridge_client_config');if(pairCode&&configuration.ownerId||pairCode&&configuration.code&&configuration.code!==pairCode.trim().toUpperCase())throw fail('已有配对记录。重新连接请省略配对码；重新配对请使用新的 --state-dir。','bridge_client_config');}
  catch(e){if(e.code!=='ENOENT')throw e;if(!pairCode)throw fail('首次连接请提供游戏内生成的配对码');configuration={schema:1,server,workspace,deviceId:randomUUID(),secret:'device-'+randomBytes(32).toString('hex'),code:pairCode.trim().toUpperCase(),name:String(name).trim().slice(0,60),platform:process.platform+' '+process.arch};await saveConfig();}
  async function saveConfig(){configuration.checksum=checksum(configuration);await atomicJSON(file,configuration);}
  async function post(operation,input={},authenticated=true){const r=await fetchImpl(server+'/api/lan/bridge/'+operation,{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+configuration.secret}:{})},body:JSON.stringify(input),signal:AbortSignal.timeout(operation==='complete'?45000:12000)});let result;try{result=await r.json();}catch{throw fail('游戏服务没有返回有效回执','bridge_http');}if(!r.ok)throw Object.assign(fail(result.error||'原机连接暂时中断',result.code||'bridge_http'),{status:r.status});return result;}
  if(!configuration.ownerId){
   let paired;try{paired=await post('heartbeat',{});}catch(e){if(!['bridge_credential','bridge_revoked'].includes(e.code))throw e;paired=await post('enroll',{code:configuration.code,deviceId:configuration.deviceId,secret:configuration.secret,name:configuration.name,platform:configuration.platform,workspace},false);}
   configuration.ownerId=paired.ownerId;configuration.verification=paired.device.verification;configuration.code=null;await saveConfig();
  }
  runtime=runtimeFactory({directory:resolve(root,'runtime'),ownerId:configuration.ownerId,islandDirectory:resolve(root,'island-context'),documentRoot:workspace});
  const info={deviceId:configuration.deviceId,name:configuration.name,platform:configuration.platform,workspace,ownerId:configuration.ownerId,verification:configuration.verification};
  let latestStatus=await runtime.call('status',{}),current=null,lastHeartbeat=-Infinity;
  async function beat(){if(heartbeatPending)return heartbeatPending;if(now()-lastHeartbeat<heartbeatMs)return null;heartbeatPending=post('heartbeat',{status:{hermes:{configured:latestStatus.hermes?.configured===true,model:latestStatus.hermes?.model,verified:latestStatus.hermes?.verified===true,calls:latestStatus.hermes?.calls||0,lastError:latestStatus.hermes?.lastError?'原机运行端报告错误，请在原机查看日志。':''},deepseek:{configured:latestStatus.deepseek?.configured===true,model:latestStatus.deepseek?.model},automaticRequests:latestStatus.automaticRequests||{}}}).then(result=>{lastHeartbeat=now();return result;}).finally(()=>heartbeatPending=null);return heartbeatPending;}
  await beat();
  heartbeat=setInterval(()=>{void beat().catch(()=>{});},heartbeatMs);heartbeat.unref();
  async function readReceipt(id){try{const r=JSON.parse(await readFile(resolve(root,'job-'+id+'.json'),'utf8'));if(r.schema!==1||r.id!==id||r.checksum!==checksum(r))throw fail('原机回执无法核验，请先检查文件成果','bridge_client_receipt');return r;}catch(e){if(e.code==='ENOENT')return null;throw e;}}
  async function saveReceipt(r){r.updatedAt=now();r.checksum=checksum(r);await atomicJSON(resolve(root,'job-'+r.id+'.json'),r);}
  async function execute(job){
   if(job.ownerId!==configuration.ownerId||job.deviceId!==configuration.deviceId||!/^[-a-f0-9]{36}$/.test(job.id)||job.fingerprint!==hash([job.method,job.args]))throw fail('原机收到的委托身份或内容不一致','bridge_job_fingerprint');
   let r=await readReceipt(job.id);
   if(r&&r.fingerprint!==job.fingerprint)throw fail('原机已有不同的委托记录','bridge_client_receipt');
   if(r?.phase==='running'){
    // A prior execution can have written files; a restart never repeats it.
    if(alive(r.pid)&&r.pid!==process.pid)throw fail('另一连接端正在执行此委托','bridge_client_busy');
    r.phase='unconfirmed';r.error={message:'原机运行中断，文件操作结果尚待核对；未再次执行。',code:'bridge_client_interrupted'};await saveReceipt(r);
   }
   if(!r){
    const claim=await post('claim',{jobId:job.id,fingerprint:job.fingerprint});if(claim.phase!=='running')return {jobId:job.id,phase:claim.phase,replayed:true};
    r={schema:1,id:job.id,fingerprint:job.fingerprint,ownerId:job.ownerId,deviceId:job.deviceId,method:job.method,phase:'running',pid:process.pid,createdAt:now()};await saveReceipt(r);
    try{r.result=structuredClone(await runtime.call(job.method,job.args));r.phase='completed';}catch(e){r.phase='unconfirmed';r.error={message:String(e.message).slice(0,400),code:e.code||null};}
    await saveReceipt(r);latestStatus=await runtime.call('status',{}).catch(()=>latestStatus);
   }
   const completed=await post('complete',{jobId:job.id,fingerprint:job.fingerprint,...(r.phase==='completed'?{result:r.result}:{error:r.error})});
   return {jobId:job.id,phase:completed.phase,replayed:completed.replayed||!!r.replayed};
  }
  return {info,async tick(){if(closed)throw fail('原机连接已经停止');if(current)return current;current=(async()=>{await beat();let next;try{next=await post('next');}catch(e){if(e.code==='bridge_approval_pending')return {phase:'awaiting-owner-approval'};throw e;}if(!next.job)return {phase:'idle'};return execute(next.job);})().finally(()=>current=null);return current;},close(){return closePromise??=(async()=>{closed=true;clearInterval(heartbeat);await current?.catch(()=>{});await heartbeatPending?.catch(()=>{});await runtime.close();await lease.release();})();}};
 }catch(e){clearInterval(heartbeat);await runtime?.close().catch(()=>{});await lease.release();throw e;}
}
