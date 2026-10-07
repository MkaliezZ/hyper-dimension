// Run snapshot copies after the browser has painted, rather than in a RAF microtask.
// The timeout also releases a save if a visible tab becomes hidden before its RAF.
export function yieldForSave(){
 return new Promise(resolve=>{
  let queued=false,frame,timer;
  const finish=()=>{if(queued)return;queued=true;clearTimeout(timer);if(frame!==undefined&&typeof cancelAnimationFrame==="function")cancelAnimationFrame(frame);setTimeout(resolve,0);};
  if(typeof requestAnimationFrame==="function"&&!globalThis.document?.hidden){
   timer=setTimeout(finish,100);try{frame=requestAnimationFrame(finish)}catch{finish()}
  }else finish();
 });
}
