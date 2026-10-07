import {readFile,open,rename,unlink} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';
const clone=v=>structuredClone(v),sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),failure=e=>({message:e.message,code:e.code||'lan_event_settlement',status:e.status||503});
async function atomic(file,value){const tmp=file+'.'+randomUUID()+'.tmp';let h;try{h=await open(tmp,'wx',0o600);await h.writeFile(JSON.stringify(value));await h.sync();await h.close();h=null;await rename(tmp,file);}finally{await h?.close().catch(()=>{});await unlink(tmp).catch(()=>{});}}
export function createLanSettlementCoordinator({file,tenants,save,fault=()=>{}}){
 async function read(){try{const p=JSON.parse(await readFile(file,'utf8'));if(p.schema!==1||!p.next||!p.old||!Array.isArray(p.steps)||p.checksum!==sha({...p,checksum:undefined}))throw Error();return p;}catch(e){if(e.code==='ENOENT')return null;throw Object.assign(Error('活动结算待办校验失败，现有档案已保留'),{status:503,code:'lan_event_settlement_corrupt'});}}
 async function write(p){delete p.checksum;p.checksum=sha(p);await atomic(file,p);}
 async function apply(s){return s.input.operation==='lan_wonder'?tenants.awardWonderForServer(s.accountId,s.theme,s.input):tenants.externalTransactionForServer(s.accountId,s.theme,s.input);}
 async function execute(p){
  try{
   if(p.mode==='forward')for(let n=p.applied;n<p.steps.length;n++){const receipt=await apply(p.steps[n]);if(p.steps[n].input.operation==='lan_wonder'){const e=p.next.events[p.steps[n].input.eventId];if(e)e.wonderOutcome=receipt.result?clone(receipt.result):{skipped:true,code:receipt.code};}p.applied=n+1;await write(p);await fault('settlement-step',{index:n,plan:p});}
  }catch(e){
   // Only reservation plans can abort. Credits and captures always resume.
   if(p.steps.every(s=>s.input.operation==='reserve')&&['lan_wallet_funds','lan_wallet_world','lan_wallet_limit','lan_wallet_invalid'].includes(e.code)){
    p.mode='rollback';p.error=failure(e);p.rollback=p.steps.slice(0,p.applied).reverse().map(s=>({...s,input:{id:s.input.id+':undo',worldKey:s.input.worldKey,operation:'release',holdId:s.input.holdId,eventId:s.input.eventId,note:'筹备未成立，退回预留'}}));p.undone=0;await write(p);
   }else throw Object.assign(Error('活动结算已记录，按原请求核对即可继续：'+e.message),{status:503,code:'lan_event_settlement_pending'});
  }
  if(p.mode==='rollback'){
   for(let n=p.undone;n<p.rollback.length;n++){await apply(p.rollback[n]);p.undone=n+1;await write(p);}
   p.next=clone(p.old);p.next.fundedRequests??=[];if(p.request)p.next.fundedRequests.push({...p.request,error:p.error});await save(p.next,p.old);
  }else await save(p.next,p.old);
  await fault('settlement-saved',{plan:p});await unlink(file);return p.error||null;
 }
 return{
  async recover(){const p=await read();if(p)await execute(p);},
  async commit({old,next,steps,request=null}){const p={schema:1,id:randomUUID(),mode:'forward',old:clone(old),next:clone(next),steps:clone(steps),request:clone(request),applied:0,undone:0};await write(p);await fault('settlement-prepared',{plan:p});const error=await execute(p);if(error)throw Object.assign(Error(error.message),error);},
 };
}
