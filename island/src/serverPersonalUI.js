import {lockActionUI,unlockActionUI,readRecoveryProgress} from './actionRecoveryUI.js';
export function createServerPersonal({saves,theme,persist,applyState,toast}){
 let inflight=0,locked=false,ready=false,recovering=false;
 const bar=document.createElement('section');bar.id='serverPersonal';bar.className='gather-v46 recovery-text hidden';bar.setAttribute('aria-label','个人物资操作核对');
 bar.innerHTML='<div><strong>物品操作尚待确认</strong><p id="personalMessage" role="status"></p></div><div class="gather-buttons"><button id="personalRetry" class="primary">核对本次操作</button><button id="personalRead" class="secondary hidden">读取服务端进度</button></div>';document.body.append(bar);
 const retry=bar.querySelector('#personalRetry'),read=bar.querySelector('#personalRead');
 function release(){unlockActionUI(bar);locked=false;bar.classList.add('hidden');}
 function lock(e){locked=true;lockActionUI(bar);bar.classList.remove('hidden');bar.querySelector('#personalMessage').textContent=saves.pendingAction(theme())?'本次赠礼、使用、换装或纪念领取的结果待核对。已确认的扣除和奖励不会重复。':e.message;read.classList.toggle('hidden',saves.status(theme()).status!=='conflict');retry.disabled=inflight>0;}
 async function send(input){inflight++;try{if(!saves.pendingAction(theme()))persist();const r=await saves.action(theme(),input);applyState(r.state);return r;}catch(e){if(saves.pendingAction(theme())||saves.status(theme()).status==='conflict')lock(e);throw e;}finally{inflight--;retry.disabled=inflight>0;}}
 async function recover(){if(recovering)return;ready=false;const pending=saves.pendingAction(theme());if(pending){if(pending.body.kind==='personal')lock(Error('上次物品操作需要核对'));return;}recovering=true;try{if(!saves.status(theme()).actions?.personal)await send({kind:'personal',operation:'enable',requestId:crypto.randomUUID()});release();ready=true;}catch(e){lock(e);}finally{recovering=false;}}
 async function command(operation,args={}){if(!ready)await recover();if(!ready)throw Error('物品进度待核对，请先完成恢复');return send({kind:'personal',operation,requestId:crypto.randomUUID(),...args});}
 retry.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);read.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 return {command,recover,ensure(){if(!ready&&!locked&&!recovering&&!inflight&&!saves.pendingAction(theme()))recover();},prepareTheme:()=>{ready=false;},busy:()=>locked||inflight>0,settling:()=>locked||inflight>0,inspect:()=>({ready,inflight,locked})};
}
