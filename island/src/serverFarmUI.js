import {lockActionUI,unlockActionUI,readRecoveryProgress} from './actionRecoveryUI.js';
import {CROPS} from './farming.js';
import {itemMarkup} from './artStore.js';
export function createServerFarm({saves,theme,persist,applyState,startAnimation,stopAnimation,onReceipt,onRelease,toast,onWaterRelease=()=>{}}){
 let current=null,lastInput=null,inflight=0,locked=false;const jobs=new Map(),water=new Map();
 const bar=document.createElement('section');bar.id='serverFarm';bar.className='gather-v46 hidden';bar.setAttribute('aria-label','田间作业');
 bar.innerHTML='<div class="gather-art"></div><div><strong id="farmHeading"></strong><p id="farmMessage" role="status"></p></div><div class="gather-buttons"><button class="primary" id="farmRetry">继续农活</button><button class="secondary" id="farmCancel">取消作业</button><button class="secondary hidden" id="farmReload">读取服务端进度</button></div>';document.body.append(bar);
 const q=id=>bar.querySelector('#'+id),retry=q('farmRetry'),cancel=q('farmCancel'),reload=q('farmReload');
 function lock(){if(locked)return;locked=true;lockActionUI(bar);}
 function unlock(){unlockActionUI(bar);locked=false}
 function show(title,text){q('farmHeading').textContent=title;q('farmMessage').textContent=text;bar.classList.remove('hidden');retry.disabled=inflight>0;cancel.disabled=inflight>0||!!saves.pendingAction(theme());reload.classList.toggle('hidden',saves.status(theme()).status!=='conflict');bar.querySelector('.gather-art').innerHTML=current?itemMarkup(current.item,theme()):''}
 const identity=(t,operation)=>({kind:'farm',operation,requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});
 const all=()=>{const b=saves.status(theme()).actions;return [b?.active?.kind==='farm'?b.active:null,...Object.values(b?.farm?.leases||{})].filter(Boolean)};
 async function send(input){
  inflight++;lastInput=input;
  try{if(!saves.pendingAction(theme()))persist();const r=await saves.action(theme(),input);applyState(r.state);return r}
  finally{inflight--;if(locked){retry.disabled=inflight>0;cancel.disabled=inflight>0||!!saves.pendingAction(theme())}}
 }
 function release(){stopAnimation();onRelease();current=null;lastInput=null;unlock();bar.classList.add('hidden');persist()}
 function receipt(r){if(!r.receipt)return false;jobs.delete(r.ticket.requestId);if(r.ticket.actor==='facility'){water.delete(r.ticket.actorId);onWaterRelease(r.ticket.index,r.ticket.actorId);}if(r.ticket.actor==='player'){onReceipt(r.receipt);release()}return true}
 function failure(e,t=current){current=t;stopAnimation();lock();show('田间作业尚待确认',e.message)}
 function play(){lock();show('正在'+current.name,'第 '+(current.index+1)+' 块田 · 动作完成后确认田地和物资。');startAnimation(current,async()=>{try{receipt(await send(identity(current,'finish')))}catch(e){failure(e)}})}
 async function begin(index,step,crop){if(current||locked)return;lock();show('正在准备农活','留好种子与工具，准备进入田垄。');try{const r=await send({kind:'farm',operation:'begin',actor:'player',index,step,crop,requestId:crypto.randomUUID()});if(!receipt(r)){current=r.ticket;play()}}catch(e){failure(e)}}
 async function beginNpc(n,d,type){
  let r;try{r=await send({kind:'farm',operation:'begin',actor:'npc',actorId:n.npcId,index:d.farmIndex,step:type,crop:type==='sow'&&Object.hasOwn(CROPS,d.resource)?d.resource:saves.status(theme()).state.plots[d.farmIndex].crop,assignmentId:d.assignmentId||null,operationId:d.operationId||null,storyId:d.storyId||null,purposeId:d.purposeId,source:d.source,requestId:crypto.randomUUID()});}catch(e){e.pendingAction=!!saves.pendingAction(theme());if(e.pendingAction)failure(e);throw e}
  if(r.receipt)return null;jobs.set(r.ticket.requestId,r.ticket);return r.ticket;
 }
 async function finishNpc(t){try{const r=await send(identity(t,'finish'));receipt(r);return r}catch(e){if(saves.pendingAction(theme()))failure(e,t);throw e}}
 async function cancelTicket(t){try{const r=await send(identity(t,'cancel'));receipt(r);return r}catch(e){if(saves.pendingAction(theme()))failure(e,t);throw e}}
 async function beginWater(id,index){
  if(water.has(id))return;water.set(id,null);
  try{const r=await send({kind:'farm',operation:'begin',actor:'facility',actorId:id,index,step:'water',requestId:crypto.randomUUID()});water.set(id,r.ticket);jobs.set(r.ticket.requestId,r.ticket)}
  catch(e){water.delete(id);onWaterRelease(index,id);if(saves.pendingAction(theme()))failure(e);else toast(e.message)}
 }
 async function finishWater(id){
  const t=water.get(id);if(!t||t.finishing||Date.now()<t.readyAt)return;t.finishing=true;
  try{const r=await send(identity(t,'finish'));receipt(r);onReceipt(r.receipt)}
  catch(e){t.finishing=false;if(saves.pendingAction(theme()))failure(e,t);else{await cancelTicket(t).catch(x=>failure(x,t));toast(e.message)}}
 }
 function cancelWater(index,owner){if(!owner?.startsWith('facility:'))return;const id=owner.slice(9),t=water.get(id);if(t&&!t.finishing){t.finishing=true;cancelTicket(t).catch(e=>failure(e,t))}}
 retry.onclick=async()=>{
  if(inflight)return;if(saves.status(theme()).status==='conflict'){await readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);return}
  const pending=saves.pendingAction(theme());
  if(!pending&&current?.actor==='player'){play();return}
  if(!pending&&!current){release();return}
  try{const r=await send(pending?.body||lastInput);if(receipt(r)){unlock();bar.classList.add('hidden');if(r.ticket.actor!=='player')await recover();return}current=r.ticket;if(current?.actor==='player')play();else{await cancelTicket(current);current=null;unlock();bar.classList.add('hidden')}}
  catch(e){failure(e)}
 };
 cancel.onclick=async()=>{if(inflight||saves.pendingAction(theme()))return;if(!current){release();return}stopAnimation();try{const r=await cancelTicket(current);if(r.ticket.actor!=='player')release()}catch(e){failure(e)}};
 reload.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 async function recover(){
  const pending=saves.pendingAction(theme());
  if(pending&&pending.body?.kind!=='farm')return;
  if(!pending)for(const t of all().filter(t=>t.actor!=='player'&&!jobs.has(t.requestId))){try{await cancelTicket(t)}catch(e){failure(e,t);return}}
  const active=saves.status(theme()).actions?.active;
  if(active?.kind==='farm'&&active.actor==='player'){current=active;lastInput=pending?.body||null;lock();show('继续上次的'+active.name,'第 '+(active.index+1)+' 块田 · 已确认进度与材料预留保留，关闭期间不生长。');return}
  if(pending?.body?.kind==='farm'){lastInput=pending.body;current=all().find(t=>t.requestId===pending.body.requestId)||null;lock();show('上次农活结果尚待确认','核对同一作业后再继续，避免重复耗种子或发作物。');return}
  // Interrupted NPC/facility actions return their unspent reservations and requeue.
  for(const t of all().filter(t=>t.actor!=='player'&&!jobs.has(t.requestId))){try{await cancelTicket(t)}catch(e){failure(e,t);break}}
 }
 return {begin,beginNpc,finishNpc,cancelTicket,beginWater,finishWater,cancelWater,recover,prepareTheme:async()=>{for(const t of all().filter(t=>t.actor!=='player'))await cancelTicket(t);jobs.clear();water.clear()},occupied:i=>all().some(t=>t.index===i),busy:()=>locked||inflight>0,settling:()=>inflight>0||locked&&current?.actor!=='player',inspect:()=>({current,inflight,locked,jobs:[...jobs.values()],water:[...water.entries()]})};
}
