// A foreground frame stall must not slow a walk to a fraction of normal speed.
// Visibility changes reset lastAt in the caller; hidden tabs never spend time.
export function homeFrameTime(lastAt,now,hidden){
 const elapsed=!hidden&&lastAt>0&&Number.isFinite(now)&&now>=lastAt?Math.min(.5,(now-lastAt)/1000):0;
 return {motion:elapsed,animation:Math.min(.05,elapsed)};
}
