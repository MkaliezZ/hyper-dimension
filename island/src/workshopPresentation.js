// A completed result's reveal is presentation time, not simulation/earning time.
// Slow rendering must not stretch a short reveal beyond the checkpoint deadline.
export const RESULT_REVEAL_SECONDS=2.6;
export function advanceResultPresentation(state,elapsed,{hidden=false,paused=false,transportPaused=false}={}){
 if(!state.result||state.phase!=='celebrating'||hidden||paused||transportPaused||!Number.isFinite(elapsed)||elapsed<=0)return false;
 state.celebration=Math.min(RESULT_REVEAL_SECONDS,(state.celebration||0)+elapsed);
 if(state.celebration>=RESULT_REVEAL_SECONDS)state.phase='result';
 return state.phase==='result';
}
