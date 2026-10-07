import {findPath,worldWalkable} from './world.js';
import {coutureTarget} from './coutureLayout.js';
import {currentCoutureBrief} from './coutureRules.js';
export function createCoutureRuntime({state,npcs,resident,followPath,occupied=()=>false,player,game,now}){
 let eventId=null;const held=new Map();
 const active=()=>state().coutureParty?.session?.phase==='running'?state().coutureParty.session:null;
 function free(id){const n=npcs[id];if(n){n.partyControlled=false;n.coutureGarments=[];n.couturePose=null;n.action=null;n.path=[];n.after=null;n.intent=null;n.walkMix=0;n.walking=false;n.think=0;}held.delete(id);}
 function release(){for(const id of [...held.keys()])free(id);eventId=null;}
 function route(n,target){n.path=findPath(n,target,worldWalkable);const end=n.path.at(-1)||n;if(Math.hypot(end.x-target.x,end.y-target.y)<=35&&Array.from({length:9},(_,i)=>worldWalkable(end.x+(target.x-end.x)*i/8,end.y+(target.y-end.y)*i/8)).every(Boolean))n.path.push({...target});}
 // Keep a displayed model on the runway until that round's inputs have been
 // acknowledged. A later batch must still be able to verify every real pose.
 function pendingRound(g,local){return ['intermission','results'].includes(local.phase)&&local.reports.length>g.game.reports.length;}
 function movementGame(g,local){return pendingRound(g,local)&&local.reports.at(-1)?.outcome==='shown'?{...local,phase:'review'}:local;}
 function update(dt){
  const s=state(),g=active();if(!g){if(held.size)release();return;}
  if(eventId&&eventId!==g.id)release();
  if(eventId!==g.id){
   eventId=g.id;
   if(s.coutureAttendance?.id===g.id)for(const [id,p] of Object.entries(s.coutureAttendance.people||{})){
    const n=npcs[id],live=s.npcPresence?.find(n=>n.id===Number(id));
    if(n&&p.controlled&&p.inside===null&&live&&live.inside==null&&Math.hypot(live.x-p.x,live.y-p.y)<=8&&worldWalkable(p.x,p.y)){n.x=p.x;n.y=p.y;n.inside=null;n.indoorActor=null;}
   }
  }
  if(s.coutureAttendance?.id!==g.id)s.coutureAttendance={id:g.id,people:{}};
  const a=s.coutureAttendance,local=game()||g.game,brief=currentCoutureBrief(local);
  for(const p of g.participants){
   const n=npcs[p.id],target=coutureTarget(g,p.id,movementGame(g,local));if(!n||!target)continue;
   const key=target.x+','+target.y;
   if(!held.has(p.id)){
    if(n.action||n.meeting||n.inside!=null||occupied(p.id)||n.recruitControlled){n.status='收尾手边的工作，再去穿搭大会赴约';continue;}
    resident().releaseActor(n);n.partyControlled=true;n.after=null;n.intent=null;n.target=null;n.path=[];held.set(p.id,key);route(n,target);
   }else if(held.get(p.id)!==key){held.set(p.id,key);n.action=null;route(n,target);}
   const previous=local.reports.find(r=>r.npcId===p.id&&r.outcome==='shown');
   n.coutureGarments=p.model?Object.values(p.id===brief.npcId&&local.phase!=='intermission'&&local.phase!=='results'?local.outfit:previous?.outfit||{}).filter(Boolean):[];
   const distance=Math.hypot(n.x-target.x,n.y-target.y);
   if(distance>6){n.action=null;n.couturePose=null;if(!n.path.length)route(n,target);n.status=local.phase==='walking'&&p.id===brief.npcId?'穿好本轮造型，沿秀道登台':'沿道路去自己的穿搭大会席位';followPath(n,dt,65);}
   else{
    n.path=[];n.after=null;n.walkMix=0;n.walking=false;
    const effect=local.effect,current=p.model&&p.id===brief.npcId&&local.phase==='showing',pose=current&&effect?.type==='pose'?effect.pose:null;
    if(pose&&n.couturePose?.effect!==effect.id)n.couturePose={type:pose,effect:effect.id,at:now()};
    const age=now()-(n.couturePose?.at??-100),acting=current&&age<.85,base=Math.PI/2;
    n.direction=acting&&n.couturePose.type==='turn'?base+Math.PI*2*Math.min(1,age/.85):p.model?base:-Math.PI/2;
    n.status=current?'展示本轮造型 · '+(acting?{wave:'挥手',turn:'转身',bow:'致意'}[n.couturePose.type]:'等待亮拍'):p.model?'专属等候位 · 轮到自己再登台':p.role+' · 等待真实展示';
    n.action=acting?{type:n.couturePose.type==='wave'?'celebrate':'couture',couturePose:n.couturePose.type,t:age,duration:.85}:{type:p.model?'observe':'talk',t:(now()+p.id*.37)%1.8,duration:1.8};
   }
   a.people[p.id]={x:n.x,y:n.y,inside:n.inside??null,controlled:true,arrived:Math.hypot(n.x-target.x,n.y-target.y)<=6,role:p.model?'model':'judge',slot:p.model?local.level.models.indexOf(p.id):g.participants.filter(p=>!p.model).findIndex(j=>j.id===p.id)};
  }
  const host=player();a.people[-1]={x:host.x,y:host.y,inside:null,role:'host',arrived:Math.hypot(host.x-g.layout.player.x,host.y-g.layout.player.y)<=6};
 }
 function ready(){const g=active(),a=state().coutureAttendance,local=game()||g?.game;return !!(g&&!pendingRound(g,local)&&a?.id===g.id&&a.people[-1]?.arrived&&g.participants.every(p=>{const point=coutureTarget(g,p.id,local),live=a.people[p.id];return live?.controlled&&live.inside===null&&Math.hypot(live.x-point.x,live.y-point.y)<=6;}));}
 function arrived(id){const g=active(),p=state().coutureAttendance?.people?.[id];return !!(g&&state().coutureAttendance?.id===g.id&&p?.controlled&&p.inside===null&&Math.hypot(p.x-g.layout.buyers[3].x,p.y-g.layout.buyers[3].y)<=6);}
 return{update,ready,arrived,release,reset:release,inspect:()=>({eventId,held:[...held.keys()],ready:ready()})};
}
