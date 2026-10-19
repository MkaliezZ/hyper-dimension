// Run snapshot copies after the browser has painted, rather than in a RAF microtask.
// The timeout also releases a save if a visible tab becomes hidden before its RAF.
let waitingPaints=0,paintFramesDue=0;
// Existing callers retain their one-paint floor. The animated world reserves
// three actual paint opportunities between save deferrals, even during writes.
function deferWithPaintFloor(minimumPaints){
 if(paintFramesDue>0){paintFramesDue--;return false;}
 if(!waitingPaints)return false;
 paintFramesDue=minimumPaints;return true;
}
export function deferSavePaint(){return deferWithPaintFloor(1);}
export function deferWorldSavePaint(){return deferWithPaintFloor(3);}
export function yieldForSave(){
 return new Promise(resolve=>{
  let queued=false,frame,timer;waitingPaints++;
  const finish=()=>{if(queued)return;queued=true;waitingPaints--;clearTimeout(timer);if(frame!==undefined&&typeof cancelAnimationFrame==="function")cancelAnimationFrame(frame);setTimeout(resolve,0);};
  if(typeof requestAnimationFrame==="function"&&!globalThis.document?.hidden){
   timer=setTimeout(finish,100);try{frame=requestAnimationFrame(finish)}catch{finish()}
  }else finish();
 });
}
