import {lockActionUI,unlockActionUI,readRecoveryProgress,isRecoveryTarget} from './actionRecoveryUI.js';
import {itemMarkup} from './artStore.js';
export function createServerGather({saves,theme,persist,applyState,startAnimation,stopAnimation,onGain,onRelease,toast}){
 let ticket=null,lastInput=null,settling=false,active=false;
 const bar=document.createElement('section');bar.id='serverGather';bar.className='gather-v46 hidden';bar.setAttribute('aria-label','采集作业');bar.innerHTML='<div class="gather-art"></div><div><strong id="gatherHeading"></strong><p id="gatherMessage" role="status"></p></div><div class="gather-buttons"><button class="primary" id="gatherRetry">继续采集</button><button class="secondary" id="gatherCancel">取消</button><button class="secondary hidden" id="gatherReload">读取服务端进度</button></div>';document.body.append(bar);
 const heading=bar.querySelector('#gatherHeading'),message=bar.querySelector('#gatherMessage'),retry=bar.querySelector('#gatherRetry'),cancel=bar.querySelector('#gatherCancel'),reload=bar.querySelector('#gatherReload');
 
 function lock(){if(active)return;active=true;lockActionUI(bar);bar.classList.remove('hidden');}
 function release(){stopAnimation();onRelease();ticket=null;lastInput=null;settling=false;active=false;unlockActionUI(bar);bar.classList.add('hidden');persist();}
 function show(title,text,{again=false,cancellable=true}={}){heading.textContent=title;message.textContent=text;retry.hidden=!again;cancel.hidden=!cancellable;retry.disabled=settling;cancel.disabled=settling;reload.classList.toggle('hidden',saves.status(theme()).status!=='conflict');bar.querySelector('.gather-art').innerHTML=ticket?itemMarkup(ticket.item,theme()):'';}
 function apply(response){applyState(response.state);ticket=response.ticket;return response;}
 async function send(input){
  lastInput=input;settling=true;show('正在收好这次采集','请稍候…',{cancellable:false});
  try{if(!saves.pendingAction(theme()))persist();return apply(await saves.action(theme(),input));}
  finally{settling=false;}
 }
 function complete(response){
  if(response.receipt?.outcome==='finished'){onGain(response.receipt);release();return true;}
  if(response.receipt?.outcome==='cancelled'){release();toast('采集已取消，工具已归还');return true;}
  return false;
 }
 function failure(error){
  stopAnimation();settling=false;
  show('这次采集尚待确认',error.message,{again:true,cancellable:!saves.pendingAction(theme())});
 }
 function play(){
  show('正在采集'+ticket.name,'完成动作后，收获会放入背包。');
  startAnimation(ticket,()=>finish());cancel.focus();
 }
 async function begin(itemId){
  if(active)return;lock();
  try{const r=await send({operation:'begin',itemId,requestId:crypto.randomUUID()});if(!complete(r))play();}
  catch(e){failure(e);}
 }
 async function finish(){
  if(settling||!ticket)return;
  try{complete(await send({operation:'finish',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence}));}
  catch(e){failure(e);}
 }
 async function cancelAction(){
  if(settling)return;if(!ticket){release();return;}stopAnimation();
  try{complete(await send({operation:'cancel',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence}));}
  catch(e){failure(e);}
 }
 retry.onclick=async()=>{
  if(settling)return;
  if(saves.status(theme()).status==='conflict'){await readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);return;}
  if(!saves.pendingAction(theme())&&ticket){play();return;}
  try{const r=await send(lastInput||saves.pendingAction(theme())?.body);if(!complete(r))play();}
  catch(e){failure(e);}
 };
 cancel.onclick=cancelAction;reload.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 document.addEventListener('keydown',e=>{if(active&&!isRecoveryTarget(e.target)){e.preventDefault();e.stopImmediatePropagation();}},true);
 function recover(){
  const status=saves.status(theme()),pending=saves.pendingAction(theme());
  ticket=status.actions?.active||null;
  if(['craft','farm','field','resident','visitor','commerce','party','fishing','festival','couture','fireworks','facility'].includes(ticket?.kind)||['craft','farm','field','resident','visitor','commerce','party','fishing','festival','couture','fireworks','facility'].includes(pending?.body?.kind))return;
  if(!ticket&&!pending)return;
  lock();lastInput=pending?.body||null;
  show(ticket?'继续上次的'+ticket.name+'采集':'上次采集的结果尚待确认','完成或取消本次作业后，可以继续探索。',{again:true,cancellable:!!ticket&&!pending});
  retry.focus();
 }
 return {begin,recover,busy:()=>active,settling:()=>settling};
}
