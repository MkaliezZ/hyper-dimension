// Boat rendering has its own visible clock. Saving may defer arrival, boarding
// and departure receipts, but an already sailing boat keeps its continuous arc.
export function createBoatVisualMotion(route){
 const records=new Map();
 return {
  sample(boat,time){
   if(!['approaching','leaving'].includes(boat.phase)){
    records.delete(boat.id);return {x:boat.x,y:boat.y};
   }
   const {sea,berth}=route;
   const duration=boat.phase==='approaching'?12:13,logical=Math.max(0,Number(boat.t)||0);
   const old=records.get(boat.id);
   const continuous=old&&old.phase===boat.phase&&old.sea===sea&&old.berth===berth&&time>=old.time&&logical>=old.logical-.001;
   const elapsed=Math.min(duration,Math.max(logical,continuous?old.elapsed+Math.max(0,time-old.time):logical));
   records.set(boat.id,{phase:boat.phase,time,logical,elapsed,sea,berth});
   const p=elapsed/duration,e=p*p*(3-2*p),from=boat.phase==='approaching'?sea:berth,to=boat.phase==='approaching'?berth:sea;
   return {x:from.x+(to.x-from.x)*e,y:from.y+(to.y-from.y)*e};
  },
  retain(boats){const live=new Set(boats.map(b=>b.id));for(const id of records.keys())if(!live.has(id))records.delete(id);},
  reset(){records.clear();}
 };
}
