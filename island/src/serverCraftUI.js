import {lockActionUI,unlockActionUI,readRecoveryProgress} from './actionRecoveryUI.js';
import {neutralCraftGame} from './craftGameReplay.js';
export function createServerCraft({saves,theme,persist,applyState,mount,closeGame,animate,onComplete,toast,kind='craft',idPrefix='craft',noun='制作',beginInput=(recipeId,taskId,mode)=>({recipeId,taskId,mode}),restartInput=t=>t.recipeId,shouldRecover=()=>true,exitMessage='材料会解除预留，不消耗材料也不发放成品。',recoveryMessage='服务器保留关卡与材料预留；继续时不会重新生成关卡。'}){
 let ticket=null,game=null,buffer=[],settling=false,active=false,claiming=false,lastInput=null,sentCount=0,exitRequested=false;
 
 function lock(){lockActionUI(bar);}
 function unlock(){unlockActionUI(bar);}
 const bar=document.createElement('section');bar.id='server'+idPrefix[0].toUpperCase()+idPrefix.slice(1);bar.className='gather-v46 hidden';bar.setAttribute('aria-label','制作作业恢复');
 bar.innerHTML='<div><strong id="craftHeading"></strong><p id="craftMessage" role="status"></p></div><div class="gather-buttons"><button class="primary" id="craftRetry">继续制作</button><button class="secondary" id="craftCancel">取消制作</button><button class="secondary hidden" id="craftReload">读取服务端进度</button></div>';bar.innerHTML=bar.innerHTML.replaceAll('craft',idPrefix).replaceAll('制作',noun);document.body.append(bar);
 const q=id=>bar.querySelector('#'+id.replace(/^craft/,idPrefix)),retry=q('craftRetry'),cancel=q('craftCancel'),reload=q('craftReload');
 function status(title,message,visible=true){q('craftHeading').textContent=title.replaceAll('制作',noun);q('craftMessage').textContent=message.replaceAll('制作',noun);bar.classList.toggle('hidden',!visible);retry.disabled=settling;cancel.disabled=settling||!!saves.pendingAction(theme());reload.classList.toggle('hidden',saves.status(theme()).status!=='conflict');}
 function halt(){game?.setTransportPaused?.(true)}
 function done(response){
  if(!response.receipt)return false;active=false;claiming=false;exitRequested=false;unlock();game?.destroy();game=null;ticket=null;buffer=[];lastInput=null;sentCount=0;bar.classList.add('hidden');closeGame();onComplete(response.receipt);persist();return true;
 }
 function failure(e){settling=false;halt();lock();status('制作进度尚待确认',e.message);}
 async function send(input){
  lastInput=input;settling=true;halt();
  try{if(!saves.pendingAction(theme()))persist();const response=await saves.action(theme(),input);applyState(response.state);ticket=response.ticket;return response}
  finally{settling=false;if(exitRequested&&!saves.pendingAction(theme()))queueMicrotask(exit)}
 }
 function identity(operation){return {kind,operation,requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence}}
 function mountTicket(){
  if(!ticket?.game)return;game?.destroy();neutralCraftGame(ticket.game);buffer=[];sentCount=0;buffer.push({neutral:true});
  game=mount(ticket,{trace:e=>{if(active&&!claiming)buffer.push(e)},claim,exit,restart,saveOutcome:checkpoint});
  unlock();bar.classList.add('hidden');game.setTransportPaused?.(false);
 }
 async function begin(recipeId,taskId=null,mode='auto'){
  if(active){status('先完成上次制作','继续或取消这次作业后，再开新的工作台。');return}
  active=true;lock();status('正在准备工作台','正在登记配方并为本次制作留好材料…');
  try{const response=await send({...beginInput(recipeId,taskId,mode),kind,operation:'begin',requestId:crypto.randomUUID()});if(!done(response))mountTicket()}
  catch(e){failure(e)}
 }
 async function checkpoint(){
  if(!active||settling||claiming||!ticket)return false;if(!buffer.length)return true;
  const events=buffer.slice(0,2048);sentCount=events.length;
  try{
   const response=await send({...identity('checkpoint'),batch:ticket.nextBatch,events});
   if(done(response))return;buffer.splice(0,sentCount);sentCount=0;game?.setTransportPaused?.(false);bar.classList.add('hidden');return true;
  }catch(e){failure(e);return false}
 }
 async function claim(){
  if(!active||settling||claiming)return false;
  if(!await checkpoint())return false;if(settling||saves.pendingAction(theme())||saves.status(theme()).status==='conflict')return false;
  // Drain a long frame batch before changing from the game to the room animation.
  while(buffer.length){if(!await checkpoint())return false}
  claiming=true;lock();status('正在完成制作','收好工作台后，成品会放入背包。',false);
  try{await animate(ticket);const response=await send(identity('finish'));return done(response)}
  catch(e){failure(e);return false}
 }
 async function exit(){
  if(!active)return;if(settling){exitRequested=true;return}exitRequested=false;game?.destroy();game=null;buffer=[];claiming=false;
  if(!ticket){if(saves.pendingAction(theme())){status('上次制作尚待确认','先核对结果，再取消作业。');return}active=false;unlock();bar.classList.add('hidden');return}
  status('正在收好工作台',exitMessage);
  try{done(await send(identity('cancel')))}catch(e){failure(e)}
 }
 async function restart(mode){
  if(!active||settling)return;const recipeId=restartInput(ticket),taskId=ticket.projectTaskId;
  await exit();if(!active)await begin(recipeId,taskId,mode);
 }
 retry.onclick=async()=>{
  if(settling)return;
  if(saves.status(theme()).status==='conflict'){await readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);return}
  const pending=saves.pendingAction(theme());
  if(!pending&&ticket){if(claiming){try{done(await send(identity('finish')))}catch(e){failure(e)}}else mountTicket();return}
  if(!pending&&!ticket){active=false;unlock();bar.classList.add('hidden');return}
  try{
   const input=pending?.body||lastInput,response=await send(input);
   if(done(response))return;
   if(input.operation==='checkpoint'){buffer.splice(0,sentCount||input.events.length);sentCount=0;if(game){unlock();game.setTransportPaused?.(false);bar.classList.add('hidden');return}}
   mountTicket();
  }catch(e){failure(e)}
 };
 cancel.onclick=exit;reload.onclick=()=>readRecoveryProgress(bar,()=>saves.acceptServer(theme()),toast);
 const timer=setInterval(()=>{if(active&&!settling&&!claiming&&game&&buffer.length)checkpoint()},5000);
 window.addEventListener('pagehide',()=>{if(active&&!settling&&!claiming)checkpoint()});
 function recover(){
  const pending=saves.pendingAction(theme()),activeTicket=saves.status(theme()).actions?.active;
  if(!shouldRecover(activeTicket,pending)||activeTicket?.kind!==kind&&pending?.body?.kind!==kind)return;
  ticket=activeTicket?.kind===kind?activeTicket:null;lastInput=pending?.body||null;active=true;lock();
  status(ticket?'继续上次的'+ticket.name+'制作':'上次制作的结果尚待确认',recoveryMessage);
 }
 return {begin,recover,exit,refresh:()=>{if(!settling&&!buffer.length&&active){ticket=saves.status(theme()).actions?.active;if(ticket?.kind===kind)mountTicket();}},resume:async()=>{if(settling)return;if(active&&ticket){if(await checkpoint())mountTicket();}else recover();},busy:()=>active,settling:()=>settling,inspect:()=>({ticket,bufferedEvents:buffer.length,settling,claiming,active,lastInput}),destroy:()=>clearInterval(timer)};
}
