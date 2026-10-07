export function fireworksTarget(g,id){if(id===-1)return g.layout.player;const i=g.participants.findIndex(p=>p.id===id);return i>=0?g.layout.staff[i]:null;}
