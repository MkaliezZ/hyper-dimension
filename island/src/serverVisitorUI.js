import {lockActionUI,unlockActionUI,readRecoveryProgress} from './actionRecoveryUI.js';
export function createServerVisitor({saves,theme,persist,applyState,restore,toast}){
 let inflight=0,locked=false,ready=false,recovering=false;
 const bar=document.createElement('section');bar.id='serverVisitor';bar.className='gather-v46 hidden';
 bar.innerHTML='<div><strong>游客经营尚待确认</strong><p id="visitorMessage"></p></div><div class="gather-buttons"><button id="visitorRetry" class="primary">核对游客行程</button><button id="visitorRead" class="secondary hidden">读取服务端进度</button></div>';document.body.append(bar);
 const retry=bar.querySelector('#visitorRetry'),read=bar.querySelector('#visitorRead'),all=()=>Object.values(saves.status(theme()).actions?.visitor?.leases||{}),identity=(t,operation)=>({kind:'visitor',operation,requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});
 function lock(e){locked=true;lockActionUI(bar);bar.classList.remove('hidden');bar.querySelector('#visitorMessage').textContent=saves.pendingAction(theme())?'本次游客行程或消费的结果尚未确认。核对后继续游玩，已确认收入不会重复发放。':e.message;read.classList.toggle('hidden',saves.status(theme()).status!=='conflict');retry.disabled=inflight>0;}
 function release(){unlockActionUI(bar);locked=false;bar.classList.add('hidden');}
 async function send(input){inflight++;try{if(!saves.pendingAction(theme()))persist();if(input.operation==='arrive'&&!saves.pendingAction(theme())){await saves.flush(theme());const v=saves.status(theme()).actions?.visitor;if(v&&v.activeSeconds+1e-7<v.nextTripAt)throw Object.assign(Error('渡船正在靠泊，稍候完成上岛确认'),{code:'visitor_early'});}const r=await saves.action(theme(),input);applyState(r.state);return r;}catch(e){if(saves.pendingAction(theme())||saves.status(theme()).status==='conflict')lock(e);throw e;}finally{inflight--;retry.disabled=inflight>0;}}
 const command=(operation,args={})=>send({kind:'visitor',operation,theme:theme(),requestId:crypto.randomUUID(),...args});
 async function recover(){
  if(recovering)return;ready=false;const pending=saves.pendingAction(theme());if(pending){if(pending.body.kind==='visitor')lock(Error('上次游客经营结果需要核对。'));return;}
  recovering=true;try{if(!saves.status(theme()).actions?.visitor)await command('enable');for(const t of all())await send(identity(t,'cancel'));release();ready=true;restore();}catch(e){lock(e);}finally{recovering=false;}
 }
 // All recovery cards reconcile the shared journal; a card must not reinterpret another job as its own.
 retry.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 read.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 return {ensure(){if(!ready&&!locked&&!recovering&&!inflight&&!saves.pendingAction(theme()))recover();},command,finish:t=>send(identity(t,'finish')),cancel:t=>send(identity(t,'cancel')),recover,ready:()=>ready,settling:()=>inflight>0||locked,busy:()=>inflight>0||locked,prepareTheme:async()=>{ready=false;for(const t of all())await send(identity(t,'cancel'));},inspect:()=>({ready,inflight,locked,leases:all()})};
}
