// Waiting models, judges and the host have separate legal points. Only the current
// model moves to the fourth runway point; the others keep their waiting positions.
export function coutureTarget(g,id,game=g.game){
 if(id===-1)return g.layout.player;const judges=g.participants.filter(p=>!p.model),j=judges.findIndex(p=>p.id===id);if(j>=0)return g.layout.staff[j];
 const m=g.game.level.models.indexOf(id);if(m<0)return null;return ['walking','showing','review'].includes(game.phase)&&game.level.models[game.round]===id?g.layout.buyers[3]:g.layout.buyers[m];
}
