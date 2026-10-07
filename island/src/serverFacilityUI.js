import {lockActionUI,unlockActionUI,readRecoveryProgress} from './actionRecoveryUI.js';
export function createServerFacility({saves,theme,persist,applyState,toast,onRecovered=()=>{}}){
 let inflight=0,locked=false,ready=false,recovering=false;
 const bar=document.createElement('section');bar.id='serverFacility';bar.className='gather-v46 hidden';bar.setAttribute('aria-label','设施操作核对');bar.innerHTML='<div><strong>设施结果尚待确认</strong><p id="facilityMessage" role="status"></p></div><div class="gather-buttons"><button class="primary" id="facilityRetry">核对本次设施操作</button><button class="secondary hidden" id="facilityRead">读取服务端进度</button></div>';document.body.append(bar);
 const retry=bar.querySelector('#facilityRetry'),read=bar.querySelector('#facilityRead');
 function release(){unlockActionUI(bar);locked=false;bar.classList.add('hidden');}
 function lock(e){locked=true;lockActionUI(bar);bar.classList.remove('hidden');bar.querySelector('#facilityMessage').textContent=saves.pendingAction(theme())?'投料、收取或布置的结果待核对。已确认的物资与操作不会重复结算。':e.message;read.classList.toggle('hidden',saves.status(theme()).status!=='conflict');retry.disabled=inflight>0;}
 async function send(input){inflight++;try{if(!saves.pendingAction(theme()))persist();const r=await saves.action(theme(),input);applyState(r.state);return r;}catch(e){if(saves.pendingAction(theme())||saves.status(theme()).status==='conflict')lock(e);throw e;}finally{inflight--;retry.disabled=inflight>0;}}
 async function recover(){if(recovering)return;ready=false;const pending=saves.pendingAction(theme());if(pending){if(pending.body.kind==='facility')lock(Error('上次设施操作需要核对'));return;}recovering=true;try{if(!saves.status(theme()).actions?.facility)await send({kind:'facility',operation:'enable',requestId:crypto.randomUUID()});release();ready=true;}catch(e){lock(e);}finally{recovering=false;}}
 async function command(operation,args={}){if(!ready)await recover();if(!ready)throw Error('设施进度待核对，请先完成恢复');return send({kind:'facility',operation,requestId:crypto.randomUUID(),...args});}
 // All recovery cards reconcile the shared journal; a card must not reinterpret another job as its own.
 retry.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 read.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 return {command,recover,ensure(){if(!ready&&!locked&&!recovering&&!inflight&&!saves.pendingAction(theme()))recover();},prepareTheme:()=>{ready=false;},busy:()=>locked||inflight>0,settling:()=>locked||inflight>0,inspect:()=>({ready,inflight,locked})};
}
