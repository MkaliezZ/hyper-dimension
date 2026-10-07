import {lockActionUI,unlockActionUI,readRecoveryProgress} from './actionRecoveryUI.js';
export function createServerCommerce({saves,theme,persist,applyState,toast}){
 let inflight=0,locked=false,ready=false,recovering=false;
 const bar=document.createElement('section');bar.id='serverCommerce';bar.className='gather-v46 recovery-text hidden';bar.setAttribute('aria-label','经营结算核对');
 bar.innerHTML='<div><strong>经营结果尚待确认</strong><p id="commerceMessage" role="status"></p></div><div class="gather-buttons"><button id="commerceRetry" class="primary">核对本次经营</button><button id="commerceRead" class="secondary hidden">读取服务端进度</button></div>';document.body.append(bar);
 const retry=bar.querySelector('#commerceRetry'),read=bar.querySelector('#commerceRead');
 function lock(e){locked=true;lockActionUI(bar);bar.classList.remove('hidden');bar.querySelector('#commerceMessage').textContent=saves.pendingAction(theme())?'本次委托、物资或筹备分工尚待确认。核对后继续，已确认的扣款、计划与任务不会重复。':e.message;read.classList.toggle('hidden',saves.status(theme()).status!=='conflict');retry.disabled=inflight>0;}
 function release(){unlockActionUI(bar);locked=false;bar.classList.add('hidden');}
 async function send(input){inflight++;try{if(!saves.pendingAction(theme()))persist();const r=await saves.action(theme(),input);applyState(r.state);return r;}catch(e){if(saves.pendingAction(theme())||saves.status(theme()).status==='conflict')lock(e);throw e;}finally{inflight--;retry.disabled=inflight>0;}}
 async function recover(){if(recovering)return;ready=false;const pending=saves.pendingAction(theme());if(pending){if(pending.body.kind==='commerce')lock(Error('上次经营结果需要核对。'));return;}recovering=true;try{if(!saves.status(theme()).actions?.commerce)await send({kind:'commerce',operation:'enable',requestId:crypto.randomUUID()});if(!saves.status(theme()).actions?.hire)await send({kind:'commerce',operation:'hire_enable',requestId:crypto.randomUUID()});if(!saves.status(theme()).actions?.planning)await send({kind:'commerce',operation:'plan_enable',requestId:crypto.randomUUID()});release();ready=true;}catch(e){lock(e);}finally{recovering=false;}}
 async function command(operation,args={}){if(!ready)await recover();if(!ready)throw Error('经营存档尚待核对，请先完成恢复');return send({kind:'commerce',operation,requestId:crypto.randomUUID(),...args});}
 // All recovery cards reconcile the shared journal; a card must not reinterpret another job as its own.
 retry.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 read.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 return {command,recover,ensure(){if(!ready&&!locked&&!recovering&&!inflight&&!saves.pendingAction(theme()))recover();},ready:()=>ready,busy:()=>inflight>0||locked,settling:()=>inflight>0||locked,prepareTheme:async()=>{ready=false;},inspect:()=>({ready,inflight,locked})};
}
