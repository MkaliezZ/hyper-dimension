import {lockActionUI,unlockActionUI,readRecoveryProgress} from './actionRecoveryUI.js';
export function createServerResident({saves,theme,persist,applyState,toast}){
 const jobs=new Map();let current=null,inflight=0,locked=false;
 const bar=document.createElement('section');bar.id='serverResident';bar.className='gather-v46 recovery-text hidden';bar.innerHTML='<div><strong>居民作业尚待确认</strong><p id="residentMessage"></p></div><div class="gather-buttons"><button id="residentRetry" class="primary">核对本次作业</button><button id="residentRead" class="secondary hidden">读取服务端进度</button></div>';document.body.append(bar);
 const retry=bar.querySelector('#residentRetry'),read=bar.querySelector('#residentRead'),all=()=>Object.values(saves.status(theme()).actions?.resident?.leases||{}),identity=(t,operation)=>({kind:'resident',operation,requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});
 function lock(){if(locked)return;locked=true;lockActionUI(bar);}
 function release(){current=null;unlockActionUI(bar);locked=false;bar.classList.add('hidden')}
 function failed(e,t=null){current=t;lock();bar.classList.remove('hidden');bar.querySelector('#residentMessage').textContent=saves.pendingAction(theme())?'本次居民作业的结果尚未确认。请核对本次作业，已提交的成果不会重复发放。':e.message;read.classList.toggle('hidden',saves.status(theme()).status!=='conflict');retry.disabled=inflight>0;}
 async function send(input){inflight++;try{if(!saves.pendingAction(theme()))persist();const r=await saves.action(theme(),input);applyState(r.state);if(r.receipt)jobs.delete(r.ticket.requestId);return r;}finally{inflight--;retry.disabled=inflight>0;}}
 async function cancel(t){try{return await send(identity(t,'cancel'))}catch(e){if(saves.pendingAction(theme()))failed(e,t);throw e}}
 async function begin(n,d){try{const r=await send({kind:'resident',operation:'begin',actorId:n.npcId,intent:Object.fromEntries(['goal','buildingId','action','activity','resource','recipeId','foodId','facilityId','purposeId','source','assignmentId','operationId','storyId','preparing'].filter(k=>d[k]!==undefined).map(k=>[k,d[k]])),gameTime:d.serverTime||0,requestId:crypto.randomUUID()});if(r.receipt)return null;jobs.set(r.ticket.requestId,r.ticket);return r.ticket;}catch(e){if(saves.pendingAction(theme()))failed(e);throw e}}
 async function finish(t){try{return await send(identity(t,'finish'))}catch(e){if(saves.pendingAction(theme()))failed(e,t);throw e}}
 async function recover(){
  const pending=saves.pendingAction(theme());if(pending&&pending.body.kind!=='resident')return;
  if(pending){const t=all().find(t=>t.requestId===pending.body.requestId);if(pending.body.actor==='player'||saves.status(theme()).actions?.active?.requestId===pending.body.requestId)return;failed(Error('核对同一作业后再恢复居民活动，避免重复耗料或交付。'),t);return}
  for(const t of all().filter(t=>!jobs.has(t.requestId)))try{await cancel(t)}catch(e){failed(e,t);return}
 }
 // All recovery cards reconcile the shared journal; a card must not reinterpret another job as its own.
 retry.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 read.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 return {begin,finish,cancel,recover,occupied:i=>all().some(t=>t.actorId===i),settling:()=>inflight>0||locked,busy:()=>inflight>0||locked,prepareTheme:async()=>{for(const t of all())await cancel(t);jobs.clear()},inspect:()=>({inflight,locked,current,jobs:[...jobs.values()]})};
}
