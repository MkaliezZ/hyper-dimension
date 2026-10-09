// Listener and source must share the current scene's unscaled coordinates.
export function spatialSound(source,listener,{radius=260,fullRadius=24}={}){
 if(!source||!listener||![source.x,source.y,listener.x,listener.y,radius,fullRadius].every(Number.isFinite)||radius<=0)return {volume:0,pan:0,distance:null};
 const dx=source.x-listener.x,dy=source.y-listener.y,distance=Math.hypot(dx,dy),near=Math.max(0,Math.min(radius-1,fullRadius));
 const volume=distance>=radius?0:distance<=near?1:((radius-distance)/(radius-near))**2;
 return {volume,pan:Math.max(-.85,Math.min(.85,dx/(radius*.65))),distance};
}
export function audibleResidents(npcs,listener,scene,building){
 const list=[];for(const n of npcs||[]){let a;
  if(scene==='world'&&n.inside==null)a=n;
  else if(!['world','farm','mine'].includes(scene)&&n.inside===building&&n.indoorActor)a={...n.indoorActor,action:n.action,speech:n.speech};
  else continue;
  const sound=spatialSound(a,listener,{radius:scene==='world'?260:190});if(sound.volume>0)list.push({id:n.npcId,actor:a,sound});
 }
 return list.sort((a,b)=>a.sound.distance-b.sound.distance||a.id-b.id).slice(0,4);
}
export function residentStrokePeriod(action){
 if(!action||!Number.isFinite(action.duration)||action.duration<=0)return 0;
 if(action.leisure&&action.type==='arrange')return 4;
 return action.duration>3&&['craft','pickaxe','axe','hoe','water','harvest','cook','brew','paint','arrange'].includes(action.type)?1.4:action.duration;
}
