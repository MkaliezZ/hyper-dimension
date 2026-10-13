// Native local redraws span joins without moving the production parcels or paths.
// The original regional source PNGs are retained; these surfaces load only in view.
export const TERRAIN_JOIN_REPAIRS=Object.freeze([
 {name:'farm-join',bounds:{x:130,y:875,w:450,h:380},core:{x:146,y:891,w:418,h:348}},
 {name:'boatyard-join',bounds:{x:1480,y:1020,w:440,h:360},core:{x:1496,y:1036,w:408,h:328}},
 {name:'photo-join',bounds:{x:1130,y:1050,w:460,h:360},core:{x:1146,y:1066,w:428,h:328}}
].map(p=>Object.freeze({...p,bounds:Object.freeze(p.bounds),core:Object.freeze(p.core)})));
