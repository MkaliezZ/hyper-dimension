// Preserve ordinary low-frame-rate time without catching up a suspended tab.
export const MAX_VISIBLE_FRAME_SECONDS=.15;
export function visibleFrameSeconds(at,previous,hidden=false){
 if(hidden||!Number.isFinite(at)||!Number.isFinite(previous))return 0;
 return Math.min(MAX_VISIBLE_FRAME_SECONDS,Math.max(0,(at-previous)/1000));
}

// Kinematic travel has no crop, wage or reward clock. A visible slow renderer
// needs a larger distance budget without advancing those protected systems.
export const MAX_NAVIGATION_FRAME_SECONDS=.75;
export function visibleNavigationSeconds(at,previous,hidden=false){
 if(hidden||!Number.isFinite(at)||!Number.isFinite(previous))return 0;
 return Math.min(MAX_NAVIGATION_FRAME_SECONDS,Math.max(0,(at-previous)/1000));
}
