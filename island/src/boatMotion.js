// Move only the ferry image. Arrival, departure and passenger handoffs are
// confirmed by the normal visitor state machine after outstanding receipts.
export function advanceBoatMotion(boat,dt,harbor){
 if(!['approaching','leaving'].includes(boat.phase))return null;
 if(!Number.isFinite(dt)||dt<0)throw TypeError('Invalid boat frame time');
 boat.t+=dt;const duration=boat.phase==='approaching'?12:13,p=Math.min(1,Math.max(0,boat.t/duration)),ease=p*p*(3-2*p),from=boat.phase==='approaching'?harbor.sea:harbor.berth,to=boat.phase==='approaching'?harbor.berth:harbor.sea;
 boat.x=from.x+(to.x-from.x)*ease;boat.y=from.y+(to.y-from.y)*ease;return p;
}
