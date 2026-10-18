// Poll a submitted fence with a zero timeout. In particular, do not run upload
// error queries until the GPU has finished, or spin inside the drawing task.
export function afterGpuCommands(gl,validate,reject,{schedule=fn=>setTimeout(fn,8),cancel=clearTimeout}={}){
 let sync=null,timer=null,active=true;
 const clean=()=>{if(timer!==null){cancel(timer);timer=null;}if(sync){try{gl.deleteSync(sync);}catch{}sync=null;}};
 const fail=error=>{if(!active)return;active=false;clean();reject(error);};
 const poll=()=>{
  timer=null;if(!active)return;
  try{
   if(gl.isContextLost())throw Error('sprite_context_lost');
   const state=gl.clientWaitSync(sync,0,0);
   if(state===gl.TIMEOUT_EXPIRED){timer=schedule(poll);return;}
   if(state!==gl.ALREADY_SIGNALED&&state!==gl.CONDITION_SATISFIED)throw Error('sprite_gpu_wait_failed');
   clean();validate();active=false;
  }catch(error){fail(error);}
 };
 try{sync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(!sync)throw Error('sprite_gpu_fence_unavailable');gl.flush();timer=schedule(poll);}catch(error){fail(error);}
 return()=>{active=false;clean();};
}
