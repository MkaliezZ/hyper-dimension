// Preserve ordinary low-frame-rate time without catching up a suspended tab.
export function visibleFrameSeconds(at,previous,hidden=false){
 if(hidden||!Number.isFinite(at)||!Number.isFinite(previous))return 0;
 return Math.min(.15,Math.max(0,(at-previous)/1000));
}
