import {findPath,worldWalkable} from './world.js';
import {fireworksTarget} from './fireworksLayout.js';
export function createFireworksRuntime({state,npcs,resident,followPath,occupied=()=>false,player,game,now}){
 let eventId=null;const held=new Set(),active=()=>state().fireworksParty?.session?.phase==='running'?state().fireworksParty.session:null;
 function free(id){const n=npcs[id];if(n){n.partyControlled=false;n.action=null;n.path=[];n.after=null;n.intent=null;n.walkMix=0;n.walking=false;n.think=0;}held.delete(id);}
 function release(){for(const id of [...held])free(id);eventId=null;}
 function route(n,target){n.path=findPath(n,target,worldWalkable);const end=n.path.at(-1)||n;if(Math.hypot(end.x-target.x,end.y-target.y)<=35&&Array.from({length:9},(_,i)=>worldWalkable(end.x+(target.x-end.x)*i/8,end.y+(target.y-end.y)*i/8)).every(Boolean))n.path.push({...target});}
 function update(dt){
  const s=state(),g=active();if(!g){if(held.size)release();return;}if(eventId&&eventId!==g.id)release();
  if(eventId!==g.id){eventId=g.id;if(s.fireworksAttendance?.id===g.id)for(const [id,p] of Object.entries(s.fireworksAttendance.people||{})){const n=npcs[id],live=s.npcPresence?.find(n=>n.id===Number(id));if(n&&p.controlled&&p.inside===null&&live&&live.inside==null&&Math.hypot(live.x-p.x,live.y-p.y)<=8&&worldWalkable(p.x,p.y)){n.x=p.x;n.y=p.y;n.inside=null;n.indoorActor=null;}}}
  if(s.fireworksAttendance?.id!==g.id)s.fireworksAttendance={id:g.id,people:{}};const a=s.fireworksAttendance,local=game()||g.game;
  for(const p of g.participants){const n=npcs[p.id],target=fireworksTarget(g,p.id);if(!n||!target)continue;
   if(!held.has(p.id)){if(n.action||n.meeting||n.inside!=null||occupied(p.id)||n.recruitControlled){n.status='收尾手边工作，再去烟花大会协作席位';continue;}resident().releaseActor(n);n.partyControlled=true;n.after=null;n.intent=null;n.target=null;n.path=[];held.add(p.id);route(n,target);}
   const distance=Math.hypot(n.x-target.x,n.y-target.y);
   if(distance>6){n.action=null;if(!n.path.length)route(n,target);n.status='沿道路前往烟花大会 · '+p.role;followPath(n,dt,65);}
   else{n.path=[];n.walkMix=0;n.walking=false;n.direction=Math.PI/2;
    const sparkle=local.phase==='performing'&&local.shots.some(shot=>shot.round===local.round&&local.clock>=shot.burstAt&&local.clock-shot.burstAt<1.4);
    n.status=sparkle?'抬头看这一枚烟花 · '+p.role:p.role+' · 等岛主编排与发射';
    n.action={type:sparkle?'celebrate':'observe',t:(now()+p.id*.37)%1.8,duration:1.8};
   }
   a.people[p.id]={x:n.x,y:n.y,inside:n.inside??null,controlled:true,arrived:Math.hypot(n.x-target.x,n.y-target.y)<=6,role:'staff'};
  }
  const host=player();a.people[-1]={x:host.x,y:host.y,inside:null,role:'host',arrived:Math.hypot(host.x-g.layout.player.x,host.y-g.layout.player.y)<=6};
 }
 function ready(){const g=active(),a=state().fireworksAttendance;return!!(g&&a?.id===g.id&&a.people[-1]?.arrived&&g.participants.every(p=>{const live=a.people[p.id],t=fireworksTarget(g,p.id);return live?.controlled&&live.inside===null&&Math.hypot(live.x-t.x,live.y-t.y)<=6;}));}
 return{update,ready,release,reset:release,inspect:()=>({eventId,held:[...held],ready:ready()})};
}
