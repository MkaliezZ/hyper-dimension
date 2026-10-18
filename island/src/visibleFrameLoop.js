// One RAF chain, with a real-time fallback only when a visible page stops
// receiving callbacks. This does not create synthetic simulation timestamps.
export function createVisibleFrameLoop(onFrame,{
 requestFrame=globalThis.requestAnimationFrame?.bind(globalThis),
 cancelFrame=globalThis.cancelAnimationFrame?.bind(globalThis),
 scheduleTimer=globalThis.setTimeout.bind(globalThis),
 cancelTimer=globalThis.clearTimeout.bind(globalThis),
 now=()=>performance.now(),visible=()=>!globalThis.document?.hidden,
 staleAfterMs=500,checkEveryMs=250
}={}){
 if(typeof onFrame!=='function'||typeof requestFrame!=='function'||typeof cancelFrame!=='function'||!Number.isFinite(staleAfterMs)||staleAfterMs<=0||!Number.isFinite(checkEveryMs)||checkEveryMs<=0)throw TypeError('Invalid visible frame loop');
 let running=false,frameId=null,timerId=null,generation=0,lastCompletedAt=0;
 const counts={rafFrames:0,fallbackFrames:0,errors:0};
 function stop(){running=false;generation++;if(frameId!==null)cancelFrame(frameId);if(timerId!==null)cancelTimer(timerId);frameId=timerId=null;}
 function requestNext(){const own=++generation;frameId=requestFrame(timestamp=>{if(!running||own!==generation)return;frameId=null;deliver(timestamp,'rafFrames');});}
 function deliver(timestamp,kind){
  counts[kind]++;
  try{onFrame(timestamp);}catch(error){counts.errors++;stop();throw error;}
  // A slow callback is not a missing callback. Allow the next RAF to arrive
  // before considering fallback work, even if the draw itself was expensive.
  lastCompletedAt=now();if(running)requestNext();
 }
 function armTimer(){timerId=scheduleTimer(check,checkEveryMs);}
 function check(){
  timerId=null;
  try{
   if(!running)return;
   if(!visible()){lastCompletedAt=now();return;}
   const timestamp=now();if(timestamp-lastCompletedAt<staleAfterMs)return;
   if(frameId!==null)cancelFrame(frameId);frameId=null;generation++;
   deliver(timestamp,'fallbackFrames');
  }finally{if(running)armTimer();}
 }
 return{
  start(){if(running)return;running=true;lastCompletedAt=now();requestNext();armTimer();},stop,
  inspect:()=>({running,...counts,sinceCompletedMs:Math.max(0,now()-lastCompletedAt)})
 };
}
