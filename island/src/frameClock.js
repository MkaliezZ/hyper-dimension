// Preserve ordinary low-frame-rate time without catching up a suspended tab.
export const MAX_VISIBLE_FRAME_SECONDS=.15;
export function visibleFrameSeconds(at,previous,hidden=false){
 if(hidden||!Number.isFinite(at)||!Number.isFinite(previous))return 0;
 return Math.min(MAX_VISIBLE_FRAME_SECONDS,Math.max(0,(at-previous)/1000));
}
