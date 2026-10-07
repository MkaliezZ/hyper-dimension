import {findPath,worldWalkable} from './world.js';
export function createFestivalRuntime({state,npcs,resident,followPath,occupied=()=>false,player,game,now}){
 let eventId=null;const held=new Map();
 const active=()=>state().festivalParty?.session?.phase==='running'?state().festivalParty.session:null;
 function free(id){const n=npcs[id];if(n){n.partyControlled=false;n.action=null;n.path=[];n.after=null;n.intent=null;n.walkMix=0;n.walking=false;n.think=0;}held.delete(id);}
 function release(){for(const id of [...held.keys()])free(id);eventId=null;}
 function route(n,target){
  n.path=findPath(n,target,worldWalkable);const end=n.path.at(-1)||n;
  if(Math.hypot(end.x-target.x,end.y-target.y)<=35&&Array.from({length:9},(_,i)=>worldWalkable(end.x+(target.x-end.x)*i/8,end.y+(target.y-end.y)*i/8)).every(Boolean))n.path.push({...target});
 }
 function update(dt){
  const s=state(),g=active();if(!g){if(held.size)release();return;}
  if(eventId&&eventId!==g.id)release();
  if(eventId!==g.id){
   eventId=g.id;
   // Restore only poses already saved for this event; never move a busy worker to a stall.
   if(s.festivalAttendance?.id===g.id)for(const [id,p] of Object.entries(s.festivalAttendance.people||{})){
    const n=npcs[id],live=s.npcPresence?.find(n=>n.id===Number(id));
    if(n&&p.controlled&&p.inside===null&&live&&live.inside==null&&Math.hypot(live.x-p.x,live.y-p.y)<=8&&worldWalkable(p.x,p.y)){n.x=p.x;n.y=p.y;n.inside=null;n.indoorActor=null;}
   }
  }
  if(s.festivalAttendance?.id!==g.id)s.festivalAttendance={id:g.id,people:{}};
  const a=s.festivalAttendance,local=game()||g.game,wanted=new Map(g.participants.map((p,k)=>[p.id,{role:'staff',slot:k,target:g.layout.staff[k]}]));
  for(const o of local.queue)wanted.set(o.npcId,{role:'buyer',slot:o.id%4,orderId:o.id,target:g.layout.buyers[o.id%4]});
  for(const id of [...held.keys()])if(!wanted.has(id)){free(id);delete a.people[id];}
  for(const [id,job] of wanted){
   const n=npcs[id];if(!n)continue;
   if(!held.has(id)){
    if(n.action||n.meeting||n.inside!=null||occupied(id)||n.recruitControlled){n.status=job.role==='staff'?'收尾当前工作，再去集市负责摊位':'收尾手边的事，再去集市选购';continue;}
    resident().releaseActor(n);n.partyControlled=true;n.after=null;n.intent=null;n.target=null;n.path=[];held.set(id,job);route(n,job.target);
   }else if(held.get(id).orderId!==job.orderId||held.get(id).slot!==job.slot){held.set(id,job);n.action=null;route(n,job.target);}
   const distance=Math.hypot(n.x-job.target.x,n.y-job.target.y);
   if(distance>6){n.action=null;if(!n.path.length)route(n,job.target);n.status=job.role==='staff'?'沿道路前往集市岗位':'前往集市的专属选购位置';followPath(n,dt,65);}
   else{n.path=[];n.after=null;n.walkMix=0;n.walking=false;n.direction=job.role==='staff'?Math.PI/2:-Math.PI/2;n.status=job.role==='staff'?'集市营业 · '+g.participants[job.slot].role:'选购海岛手艺 · 等候交付';n.action={type:job.role==='staff'?'craft':'talk',t:(now()+id*.37)%1.6,duration:1.6};}
   a.people[id]={x:n.x,y:n.y,inside:n.inside??null,controlled:true,arrived:Math.hypot(n.x-job.target.x,n.y-job.target.y)<=6,role:job.role,slot:job.slot,...(job.orderId==null?{}:{orderId:job.orderId})};
  }
  const host=player();a.people[-1]={x:host.x,y:host.y,inside:null,role:'host',arrived:Math.hypot(host.x-g.layout.player.x,host.y-g.layout.player.y)<=6};
 }
 function ready(){const g=active(),a=state().festivalAttendance;return !!(g&&a?.id===g.id&&a.people[-1]?.arrived&&g.participants.every(p=>a.people[p.id]?.role==='staff'&&a.people[p.id]?.arrived));}
 function arrived(o){const g=active(),p=state().festivalAttendance?.people?.[o.npcId];return !!(g&&state().festivalAttendance?.id===g.id&&p?.role==='buyer'&&p.orderId===o.id&&p.arrived&&p.inside===null);}
 return{update,ready,arrived,release,reset:release,inspect:()=>({eventId,held:[...held.keys()],ready:ready()})};
}
