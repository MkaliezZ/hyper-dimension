import {advanceBoatMotion} from './boatMotion.js';
import {followPendingPath} from './movement.js';
import {ECONOMY_RULES,effectiveQuality} from './economy.js';
import {acquireRoomSpot,releaseRoomSpot,releaseRoomGroup} from './sceneOccupancy.js';
import {HARBOR,BUILDINGS,findPath,worldWalkable,nearestWalkable} from './world.js';
import {arrivalRoute,returnRoute,boardingRoute,queueFor,shouldYield} from './harborNavigation.js';
import {ROOMS,roomWalkable} from './rooms.js';
import {TOURISTS,hydrateTown,assessIsland,settleVisit,reviewVisit} from './townSimulation.js';

export function createVisitorRuntime({getState,followPath,onEvent,onChange,harborReserved=()=>false,extraPassengers=()=>[],remote=null}){
 const guests=[],boats=[];
 let time=0,nextBoat=8,serial=0,slotEntries=id=>({x:780,y:465});
 const s=()=>getState();
 function confirm(g,operation,args,done){
  if(g.remotePending)return;g.remotePending=true;
  const run=operation==='finish'?remote.finish(g.serverTicket):operation==='cancel'?remote.cancel(g.serverTicket):remote.command(operation,args);
  run.then(result=>{if(guests.includes(g))done(result);}).catch(e=>{if(!guests.includes(g))return;g.status=e.message;if(e.code==='visitor_early')g.remoteRetry={at:time+.7,run:()=>confirm(g,operation,args,done)};else if(!remote.settling())remote.recover();}).finally(()=>g.remotePending=false);
 }
 function fromSaved(saved){const t=TOURISTS[saved.skin],g={...t,...saved,npcId:saved.skin,isVisitor:true,x:HARBOR.entrance.x,y:HARBOR.entrance.y,face:-1,phase:saved.skin,animationPhase:saved.skin,walkMix:0,path:[],inside:null,visible:true,status:'继续已确认的游玩行程',entries:id=>slotEntries(id),arrivedAt:time-Math.max(0,(s().visitorControl?.activeSeconds||0)-saved.arrivedAt)};return g;}
 function restoreSaved(){
  const c=s().visitorControl;if(!c)return;nextBoat=time+Math.max(0,c.nextTripAt-c.activeSeconds-12);
  const moored=new Map();for(const saved of c.guests){const g=fromSaved(saved);guests.push(g);
   if(saved.phase==='onboard'){g.stage='onboard';g.visible=false;Object.assign(g,HARBOR.cabin);let boat=moored.get(saved.boatId);if(!boat){boat={id:++serial,serverTrip:saved.boatId,phase:'moored',t:0,x:HARBOR.berth.x,y:HARBOR.berth.y,arrivedAt:time,inbound:[],outbound:[],activePassenger:null,transferPhase:'unloading'};boats.push(boat);moored.set(saved.boatId,boat);}g.harborBoat=boat.id;boat.inbound.push(g.id);}
   else if(saved.phase==='reviewed'){g.stage='waitingBoat';g.harborQueue=saved.queue;g.waitAt=time;g.status='继续等候返程渡船';Object.assign(g,HARBOR.waiting[saved.queue]);}
   else goStop(g);
  }
 }

 function record(text){
  if(!remote){s().economy.visitorLog.unshift({day:s().day,time,text});s().economy.visitorLog=s().economy.visitorLog.slice(0,40);}onEvent(text);
 }
 function navigate(g,end,after){
  const p=nearestWalkable(end.x,end.y);
  g.path=findPath(g,p,worldWalkable);g.after=after;
  if(!g.path.length){
   if(Math.hypot(g.x-p.x,g.y-p.y)<32){g.after=null;after();}
   else {g.status='重新寻找港口通道';g.retryAt=time+2;g.retry={end:p,after};}
  }
 }
 function deckRoute(g,points,after,leg){
  g.retry=null;g.harborLeg=leg;g.after=after;
  g.path=points.filter((p,i)=>i||Math.hypot(p.x-g.x,p.y-g.y)>1).map(p=>({...p}));
  if(!g.path.length){g.after=null;after();}
 }
 function goStop(g){
  if(g.stop>=g.itinerary.length){returnHome(g);return;}
  const id=g.itinerary[g.stop];g.targetBuilding=id;g.stage='walking';
  g.status='前往'+BUILDINGS[id].name+' · '+g.taste;
  const p=g.entries(id);navigate(g,{x:p.x+(g.id%3-1)*12,y:p.y},()=>enter(g,id));
 }
 function enter(g,id){
  const r=ROOMS[id],claim=acquireRoomSpot(id,'guest-'+g.id,'visitor');
  if(!claim){g.status='候位中，等室内有空位';g.retryAt=time+2;g.retry={end:g.entries(id),after:()=>enter(g,id)};return;}
  const a={npcId:g.skin,isVisitor:true,x:500+(g.id%5-2)*35,y:585,phase:g.skin,path:[],face:1};
  if(!roomWalkable(id,a.x,a.y))a.x=500;
  g.inside=id;g.indoorActor=a;g.stage='entering';
  a.path=findPath(a,claim.point,(x,y)=>roomWalkable(id,x,y),20);
  a.after=()=>{
   g.stage=remote?'startingService':'servicing';g.serviceTime=0;
   a.direction=Math.atan2(r.primary.y+r.primary.h/2-a.y,r.primary.x+r.primary.w/2-a.x);
   g.status='正在体验'+r.name;
   const start=()=>{g.stage='servicing';g.serviceTime=0;a.action={type:[1,2,17].includes(id)?'eat':id===12||id===21?'perform':'observe',t:0,duration:ECONOMY_RULES.serviceSeconds};};
   if(remote)confirm(g,'begin',{guestId:g.id,stop:g.stop,buildingId:id},r=>{g.serverTicket=r.ticket;start();});else start();
  };
  if(!a.path.length)a.after();
 }
 function leaveRoom(g,after){
  releaseRoomSpot('guest-'+g.id);const a=g.indoorActor;
  if(!a){after();return;}
  const bid=g.inside;a.action=null;
  a.path=findPath(a,{x:500,y:585},(x,y)=>roomWalkable(bid,x,y),20);
  g.stage='exiting';a.after=()=>{g.inside=null;g.indoorActor=null;after();};
  if(!a.path.length)a.after();
 }
 function returnHome(g){
  g.stage='returning';g.status='结束游玩，经步行桥回码头乘船';
  const queue=queueFor([...guests,...extraPassengers()]);
  if(queue<0){g.retryAt=time+2;g.retry={end:HARBOR.entrance,after:()=>returnHome(g)};return;}
  g.harborQueue=queue;
  // Always reach the island-side bridge entrance before walking to the terminal.
  navigate(g,HARBOR.entrance,()=>deckRoute(g,returnRoute(queue),()=>{
   g.harborLeg=null;g.stage=remote?'confirmReview':'waitingBoat';g.status='等候返程渡船 · 候船位 '+(queue+1);g.waitAt=time;
   if(remote)confirm(g,'review',{guestId:g.id,queue},r=>{g.rating=r.receipt.rating;g.stage='waitingBoat';record(r.receipt.text||g.status);onChange();});else{const rating=reviewVisit(s(),g);g.rating=rating;record(g.name+'结束游玩，消费 '+g.spent+' 岛币，评价 '+rating.toFixed(1)+' 星。');onChange();}
  },'return'));
 }
 function land(boat){
  boat.phase='moored';boat.t=0;boat.x=HARBOR.berth.x;boat.y=HARBOR.berth.y;boat.arrivedAt=time;
  boat.inbound=[];boat.outbound=guests.filter(g=>g.stage==='waitingBoat').sort((a,b)=>a.waitAt-b.waitAt).map(g=>g.id);
  boat.transferPhase='unloading';boat.activePassenger=null;
  if(remote){boat.pending=true;remote.command('arrive').then(result=>{
   if(!boats.includes(boat))return;boat.serverTrip=result.receipt.boatId;for(const saved of result.receipt.accepted){const current=s().visitorControl.guests.find(g=>g.id===saved.id);if(!current)continue;const g=fromSaved(current);Object.assign(g,HARBOR.cabin,{stage:'onboard',visible:false,status:'船舱等候下船',harborBoat:boat.id});guests.push(g);boat.inbound.push(g.id);}for(const d of result.receipt.declined)record(d.name+'没有下船：'+d.reason);onChange();
  }).catch(e=>{boat.status=e.message;if(e.code==='visitor_early')boat.retryAt=time+.7;else if(!remote.settling())remote.recover();}).finally(()=>boat.pending=false);return;}
  const base=s().economy.tripCounter++*ECONOMY_RULES.guestsPerBoat;
  for(let j=0;j<ECONOMY_RULES.guestsPerBoat;j++){
   const skin=(base+j)%TOURISTS.length,t=TOURISTS[skin],decision=assessIsland(s(),t);
   const touring=guests.filter(g=>g.stage!=='departed').length;
   if(touring>=ECONOMY_RULES.maxGuests){record(t.name+'看到码头较拥挤，选择下次再来。');s().economy.declined++;continue;}
   if(!decision.accepted){s().economy.declined++;record(t.name+'没有下船：'+decision.reason+'（吸引力 '+decision.score+'）');continue;}
   const g={...t,id:++s().economy.guestSerial,npcId:skin,skin,isVisitor:true,
    x:HARBOR.cabin.x,y:HARBOR.cabin.y,face:-1,stage:'onboard',phase:skin,animationPhase:skin,
    walkMix:0,path:[],inside:null,stop:0,itinerary:decision.itinerary,budget:t.budget,spent:0,ratings:[],
    arrivedAt:time,visible:false,status:'船舱等候下船',entries:id=>slotEntries(id),harborBoat:boat.id};
   guests.push(g);boat.inbound.push(g.id);
  }
  onChange();
 }
 function releaseTransfer(boat,g){if(boat.activePassenger===g.id)boat.activePassenger=null;g.harborBoat=null;g.harborLeg=null;}
 function transfer(boat){
  if(boat.pending||boat.activePassenger!=null)return;
  if(boat.retryAt){if(time>=boat.retryAt){boat.retryAt=null;land(boat);}return;}
  while(boat.inbound.length){
   const id=boat.inbound.shift(),g=guests.find(g=>g.id===id&&g.stage==='onboard');
   if(!g)continue;
   boat.activePassenger=g.id;g.visible=true;g.stage='landing';g.status='下船，经栈桥步行上岛';
   deckRoute(g,arrivalRoute(),()=>{
    const after=()=>{releaseTransfer(boat,g);g.arrivedAt=time;goStop(g);onChange();};
    if(remote){g.stage='confirmLanding';confirm(g,'land',{guestId:g.id},r=>{record(r.receipt.text);after();});}else{s().economy.arrivals++;record(g.name+'经客运栈桥上岛，想体验'+g.itinerary.map(id=>BUILDINGS[id].name).join('、')+'。');after();}
   },'arrival');return;
  }
  boat.transferPhase='boarding';
  while(boat.outbound.length){
   const id=boat.outbound.shift(),g=guests.find(g=>g.id===id&&g.stage==='waitingBoat');
   if(!g)continue;
   boat.activePassenger=g.id;g.harborBoat=boat.id;g.stage='boarding';g.status='经登船跳板返回船舱';
   deckRoute(g,boardingRoute(g.harborQueue),()=>{
    const after=()=>{releaseTransfer(boat,g);g.stage='departed';g.visible=false;g.harborQueue=null;onChange();};
    if(remote){g.stage='confirmDeparture';confirm(g,'depart',{guestId:g.id},r=>{record(r.receipt.text);after();});}else{record(g.name+'已登船，等待渡船离港。');after();}
   },'boarding');return;
  }
  // A boat never leaves while somebody is on its gangway or still unloading.
  if(boat.t>=24){boat.phase='leaving';boat.t=0;boat.transferPhase='complete';}
 }
 function update(dt,now){
  time=now;if(remote&&!remote.ready()){remote.ensure?.();return;}if(!remote)s().economy.active=guests.filter(g=>g.stage!=='departed'&&g.stage!=='onboard').length;
  if(time>=nextBoat&&!harborReserved()){
   nextBoat=time+ECONOMY_RULES.ferryInterval;
   boats.push({id:++serial,phase:'approaching',t:0,x:HARBOR.sea.x,y:HARBOR.sea.y});
  }
  for(const b of boats){
   if(b.phase==='approaching'){
    if(advanceBoatMotion(b,dt,HARBOR)>=1)land(b);
   }else if(b.phase==='moored'){b.t+=dt;transfer(b);}
   else if(b.phase==='leaving'){
    if(advanceBoatMotion(b,dt,HARBOR)>=1)b.phase='gone';
   }
  }
  for(const g of guests){
   if(g.stage==='departed'||g.stage==='onboard')continue;
   if(g.remoteRetry&&time>=g.remoteRetry.at){const retry=g.remoteRetry;g.remoteRetry=null;retry.run();}
   if(g.remotePending)continue;
   if(g.retry&&time>=g.retryAt){const retry=g.retry;g.retry=null;navigate(g,retry.end,retry.after);}
   if(g.indoorActor?.path.length){followPath(g.indoorActor,dt,105);continue;}
   if(g.stage==='servicing'){
    g.serviceTime+=dt;g.indoorActor.action.t=g.serviceTime;
    if(g.serviceTime>=ECONOMY_RULES.serviceSeconds){
     const id=g.targetBuilding;
     if(remote){g.stage='settlingService';confirm(g,'finish',{},r=>{const saved=r.receipt.guest;g.spent=saved.spent;g.budget=saved.budget;g.ratings=[...saved.ratings];g.stop=saved.stop;g.serverTicket=null;record(r.receipt.text);leaveRoom(g,()=>goStop(g));onChange();});}
     else{const result=settleVisit(s(),g,id,'guest-'+g.id+'-'+g.stop,time);g.spent+=result.paid;g.ratings.push(result.paid?effectiveQuality(s().facilities[id])+12:18);record(result.reason);g.stop++;leaveRoom(g,()=>goStop(g));onChange();}
    }
   }else if(g.path.length){
    if(shouldYield(g,[...guests,...extraPassengers()])){g.walkMix=(g.walkMix||0)*Math.exp(-dt*10);g.walking=false;}
    else {g.animationPhase=(g.animationPhase||0)+dt*7;followPath(g,dt,86);}
   }
   if(!g.forcedReturn&&time-g.arrivedAt>220&&!['returning','waitingBoat','boarding','landing'].includes(g.stage)){
    g.forcedReturn=true;g.path=[];g.after=null;if(remote&&g.serverTicket)confirm(g,'cancel',{},()=>{g.serverTicket=null;leaveRoom(g,()=>returnHome(g));});else leaveRoom(g,()=>returnHome(g));
   }
  }
  for(let i=boats.length-1;i>=0;i--)if(boats[i].phase==='gone')boats.splice(i,1);
  for(let i=guests.length-1;i>=0;i--)if(guests[i].stage==='departed')guests.splice(i,1);
 }
 function animatePending(dt){
  for(const b of boats)advanceBoatMotion(b,dt,HARBOR);
  for(const g of guests){
   if(g.stage==='departed'||g.stage==='onboard')continue;
   if(g.indoorActor?.path.length)followPendingPath(g.indoorActor,dt,105);
   else if(g.path.length){
    if(shouldYield(g,[...guests,...extraPassengers()])){g.walkMix=(g.walkMix||0)*Math.exp(-dt*10);g.walking=false;}
    else followPendingPath(g,dt,86);
   }
   if(g.indoorActor?.action)g.indoorActor.action.visualWait=(g.indoorActor.action.visualWait||0)+dt;
  }
 }
 function reset(){releaseRoomGroup('guest-');guests.splice(0);boats.splice(0);nextBoat=time+8;hydrateTown(s());if(remote)restoreSaved();else s().economy.active=0;}
 reset();return {guests,boats,update,animatePending,reset,setEntries(fn){slotEntries=fn;},assessment:t=>assessIsland(s(),t)};
}
