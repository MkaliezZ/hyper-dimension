export const DIRECTION_NAMES=['S','SW','W','NW','N','NE','E','SE'];
export function directionIndex(angle){return ((Math.round((angle-Math.PI/2)/(Math.PI/4))%8)+8)%8}
// A small hysteresis avoids frame chatter at the boundaries while preserving turns.
export function facingIndex(a){const angle=Number.isFinite(a.direction)?a.direction:Math.PI/2,candidate=directionIndex(angle);if(a.facing8==null){a.facing8=candidate;return candidate}const center=Math.PI/2+a.facing8*Math.PI/4,error=Math.atan2(Math.sin(angle-center),Math.cos(angle-center));if(Math.abs(error)>Math.PI/8+.07)a.facing8=candidate;return a.facing8}
