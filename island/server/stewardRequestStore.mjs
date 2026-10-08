import {mkdir,readFile,open,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {atomicJSON} from './atomicJson.mjs';
import {alive} from './dataLease.mjs';
const digest=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const fail=(message,code='steward_receipt_unavailable',status=503)=>Object.assign(Error(message),{code,status});
export const validStewardRequestId=id=>typeof id==='string'&&/^[-A-Za-z0-9]{8,100}$/.test(id);
function identity(worldKey,id){if(typeof worldKey!=='string'||!worldKey||worldKey.length>180||!validStewardRequestId(id))throw fail('委托编号或小岛身份无效','steward_request_invalid',400);}
function signature(input){const message=String(input.message||'').trim();if(!message||message.length>1000)throw fail('请填写有效的委托内容','steward_request_invalid',400);return digest({message,includeWorkProject:input.includeWorkProject===true,resumeSessionId:input.resumeSessionId||null});}
const checksum=v=>digest({...v,checksum:undefined});
const view=r=>({id:r.id,worldKey:r.worldKey,status:r.status==='running'&&!alive(r.pid)?'unconfirmed':r.status,createdAt:r.createdAt,updatedAt:r.updatedAt,result:r.result||null,error:r.error|| (r.status==='running'&&!alive(r.pid)?'原运行已经停止，结果尚待核对。请先检查文档成果。':null)});
// A claim is persisted before tools start. A missing response never authorizes a
// second execution, including after another service or a new process takes over.
export function createStewardRequestStore({directory,now=()=>Date.now(),wait=delay,waitMs=270000,writeJSON=atomicJSON}={}){
 const root=resolve(directory,'steward-requests');const pending=new Map();
 const paths=(worldKey,id)=>{identity(worldKey,id);const dir=resolve(root,digest(worldKey)),file=resolve(dir,digest(id)+'.json');return{dir,file,lock:file+'.lock'};};
 async function read(worldKey,id){const {file}=paths(worldKey,id);try{const r=JSON.parse(await readFile(file,'utf8'));if(r.schema!==1||r.worldKey!==worldKey||r.id!==id||r.checksum!==checksum(r)||!['running','completed','unconfirmed'].includes(r.status)||typeof r.signature!=='string')throw Error();return r;}catch(e){if(e.code==='ENOENT')return null;throw fail('原委托回执未通过核验，已保留文件，请先查看文档成果','steward_receipt_corrupt');}}
 async function write(file,r){r.updatedAt=now();r.checksum=checksum(r);await writeJSON(file,r);}
 async function active(r){if(!alive(r.pid))return false;try{const owner=JSON.parse(await readFile(paths(r.worldKey,r.id).lock,'utf8'));return owner.pid===r.pid&&typeof owner.token==='string'&&!!owner.token&&alive(owner.pid);}catch{return false;}}
 async function terminal(worldKey,id,sig){const start=Date.now();for(;;){const r=await read(worldKey,id);if(r){if(r.signature!==sig)throw fail('同一委托编号不能改变内容或授权','steward_request_replay',409);if(r.status==='completed')return {...structuredClone(r.result),requestId:id,receiptReplay:true};if(r.status==='unconfirmed'||!await active(r))throw fail(r.error||'原委托可能已经操作文件，请先检查文档成果，再明确发起新的工作','steward_request_unconfirmed',409);}if(Date.now()-start>=waitMs)throw fail('原委托仍在执行，请稍后核对；没有再次执行工具','steward_request_running',409);await wait(100);}}
 async function claim(lock){const token=randomUUID();for(let n=0;n<3;n++){try{const h=await open(lock,'wx',0o600);try{await h.writeFile(JSON.stringify({pid:process.pid,token}));await h.sync();}finally{await h.close();}return token;}catch(e){if(e.code!=='EEXIST')throw e;let text,owner;try{text=await readFile(lock,'utf8');owner=JSON.parse(text);}catch{return null;}if(alive(owner.pid))return null;if(await readFile(lock,'utf8')!==text)return null;await unlink(lock).catch(e=>{if(e.code!=='ENOENT')throw e;});}}return null;}
 async function execute(input,run){const {worldKey,requestId:id}=input,sig=signature(input),{dir,file,lock}=paths(worldKey,id);await mkdir(dir,{recursive:true});const old=await read(worldKey,id);if(old)return terminal(worldKey,id,sig);const token=await claim(lock);if(!token)return terminal(worldKey,id,sig);
  try{if(await read(worldKey,id))return terminal(worldKey,id,sig);const r={schema:1,id,worldKey,signature:sig,status:'running',pid:process.pid,createdAt:now(),updatedAt:now()};await write(file,r);
   let result;try{result=structuredClone(await run());if(!result||typeof result!=='object')throw Error('委托没有返回可核对的结果');}catch(e){r.status='unconfirmed';r.error='原委托已启动但结果尚待核对。'+String(e.message||'').slice(0,220);try{await write(file,r);}catch{}throw fail(r.error,'steward_request_unconfirmed',409);}
   r.status='completed';r.result=result;try{await write(file,r);}catch{throw fail('工具可能已完成，但委托回执尚未保存；请先检查文档成果','steward_receipt_unavailable');}return {...result,requestId:id};
  }finally{try{const owner=JSON.parse(await readFile(lock,'utf8'));if(owner.token===token)await unlink(lock);}catch{}}
 }
 return{async get(worldKey,id){const r=await read(worldKey,id);if(!r)return null;const result=view(r);if(r.status==='running'&&!await active(r)){result.status='unconfirmed';result.error||='原委托已停止或回执尚未保存，请先检查文档成果。';}return result;},async run(input,run){identity(input.worldKey,input.requestId);const key=digest(input.worldKey)+':'+input.requestId,sig=signature(input),old=pending.get(key);if(old){if(old.signature!==sig)throw fail('同一委托编号不能改变内容或授权','steward_request_replay',409);return old.promise;}const promise=execute(input,run);pending.set(key,{signature:sig,promise});try{return await promise;}finally{if(pending.get(key)?.promise===promise)pending.delete(key);}}};
}
