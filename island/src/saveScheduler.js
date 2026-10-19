// Run snapshot copies after the browser has painted, rather than in a RAF microtask.
// The timeout also releases a save if a visible tab becomes hidden before its RAF.
let waitingPaints=0,lastPaintDeferred=false;
// Give pending durable copies one light frame. The following frame must paint,
// even under continuous writes; simulation and accepted action clocks still run.
export function deferSavePaint(){
 if(lastPaintDeferred){lastPaintDeferred=false;return false;}
 if(!waitingPaints)return false;
 lastPaintDeferred=true;return true;
}
export function yieldForSave(){
 return new Promise(resolve=>{
  let queued=false,frame,timer;waitingPaints++;
  const finish=()=>{if(queued)return;queued=true;waitingPaints--;clearTimeout(timer);if(frame!==undefined&&typeof cancelAnimationFrame==="function")cancelAnimationFrame(frame);setTimeout(resolve,0);};
  if(typeof requestAnimationFrame==="function"&&!globalThis.document?.hidden){
   timer=setTimeout(finish,100);try{frame=requestAnimationFrame(finish)}catch{finish()}
  }else finish();
 });
}
