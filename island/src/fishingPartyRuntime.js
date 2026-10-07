
import {HARBOR,SLOTS,findPath,worldWalkable,nearestWalkable,HARBOR_LAYOUTS} from './world.js';
import {fishingCheckin} from './fishingParty.js';
export function fishingSpots(theme=null){const raw=HARBOR_LAYOUTS[theme],h=raw?{apron:raw.apron.map(([x,y])=>({x,y})),activities:raw.activities.map(([x,y])=>({x,y}))}:HARBOR;const a=h.apron[6],b=h.apron[5];return [h.activities[0],h.activities[2],{x:a.x+(b.x-a.x)*.35,y:a.y+(b.y-a.y)*.35-6},{x:1463,y:976}];}
export function createFishingPartyRuntime({state,npcs,followPath,resident,onChange,occupied=()=>false,onReady=()=>{}}){
 let id=null,held=new Set();
 const active=()=>{const g=state().fishingParty?.session;return g&&['checkin','running'].includes(g.phase)?g:null};
 function release(){for(const i of held){const n=npcs[i];n.partyControlled=false;n.action=null;n.after=null;n.path=[];n.intent=null;n.target=null;n.think=0;n.walkMix=0;}held.clear();id=null;}
 function reset(){release();const g=active();if(!g)return;for(const p of g.participants){const n=npcs[p.id],pose=state().fishingControl?state().fishingAttendance?.people?.[p.id]:p.position;if(pose){const xy=pose.inside!=null?SLOTS[pose.inside]?.entry:pose;if(xy&&worldWalkable(xy.x,xy.y)){Object.assign(n,nearestWalkable(xy.x,xy.y));n.inside=null;n.indoorActor=null;}}}}
 function update(dt){
  const g=active();if(!g){if(held.size)release();return}if(id&&id!==g.id)release();id=g.id;
  const controlled=state().fishingControl?.version===1;
  if(controlled&&(state().fishingAttendance?.id!==g.id))state().fishingAttendance={id:g.id,people:{}};
  for(const[index,p]of g.participants.entries()){
   const n=npcs[p.id],target=fishingSpots()[index<2?index:3];if(!n)continue;
   if(!held.has(p.id)){if(n.action||n.meeting||occupied(p.id)){n.status='收尾当前工作后，前往钓鱼大会';continue;}resident().releaseActor(n);n.partyControlled=true;held.add(p.id);const task=state().agentTaskLedger?.find(t=>t.npcId===p.id&&t.status==='running');if(task&&!state().planningControl?.enabled){task.status='queued';delete task.operationId;}}
   if(n.inside!=null){if(n.indoorActor?.path.length)followPath(n.indoorActor,dt,108);continue;}
   const arrived=Math.hypot(n.x-target.x,n.y-target.y)<=8;
   if(!arrived){if(!n.path.length){n.path=findPath(n,target,worldWalkable);const end=n.path.at(-1)||n;if(Array.from({length:9},(_,i)=>worldWalkable(end.x+(target.x-end.x)*i/8,end.y+(target.y-end.y)*i/8)).every(Boolean))n.path.push({...target});}n.status='经栈桥前往钓位，准备签到';n.action=null;if(n.path.length)followPath(n,dt,65);}
   else{n.path=[];n.after=null;n.walkMix=0;n.walking=false;n.status=g.match.phase==='results'?'钓鱼大会结束，等候颁奖':'钓鱼大会 · 专属钓位';n.direction=Math.PI/2;n.action={type:g.match.phase==='results'?'celebrate':index<2?'fish':'talk',t:(g.match.elapsed+index*.7)%1.6,duration:1.6};if(!controlled&&!p.arrived){p.arrived=true;fishingCheckin(state(),p.id);onChange?.();}}
   const position={x:n.x,y:n.y,inside:n.inside??null,arrived:Math.hypot(n.x-target.x,n.y-target.y)<=8};if(controlled)state().fishingAttendance.people[p.id]=position;else p.position=position;
  }
  if(controlled&&g.phase==='checkin')onReady();
 }
 return {update,reset,release};
}
