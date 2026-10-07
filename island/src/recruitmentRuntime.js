import {HARBOR,SLOTS,nearestWalkable,findPath,worldWalkable} from './world.js';
import {arrivalRoute,returnRoute,boardingRoute,queueFor,shouldYield} from './harborNavigation.js';
import {hydrateRecruitment,recruitmentProgress,requestRecruitmentLeave,handoverRecruitment,finishRecruitmentDeparture} from './recruitment.js';
import {RECRUIT_STAGE_LABEL} from './recruitmentCatalog.js';

export function createRecruitmentRuntime({state,npcs,followPath,resident,visitors,onChange,onEvent,settleHire=null}){
 let actor=null,lastId=null,handoverPending=false,handoverRetryAt=0;
 function settle(){const a=active();if(a.feePaid!==null)return true;if(!settleHire)return handoverRecruitment(state()).ok;if(handoverPending||Date.now()<handoverRetryAt)return false;handoverPending=true;const id=a.id;settleHire(id).then(r=>{if(active()?.id===id){resident().releaseActor(actor);onEvent?.(r.receipt.text);changed();}}).catch(e=>{if(actor)actor.status=e.message;handoverRetryAt=Date.now()+10000;}).finally(()=>handoverPending=false);return false;}
 const active=()=>hydrateRecruitment(state()).active;
 const crowd=()=>visitors()?.guests||[];
 const boat=()=>active()?.transport?.boat||null;
 function changed(){onChange?.()}
 function savePose(){
  const a=active();if(!a||!actor)return;
  a.position={x:actor.x,y:actor.y,inside:actor.inside??null,direction:actor.direction||0};
  a.transport??={boat:null,path:[],queue:null};
  a.transport.path=actor.recruitControlled?actor.path.map(p=>({x:p.x,y:p.y})):[];
  a.transport.queue=actor.harborQueue??null;
 }
 function path(points,phase,leg){
  const a=active();a.phase=phase;actor.recruitControlled=true;actor.visible=true;actor.harborLeg=leg;
  actor.path=points.map(p=>({...p}));actor.after=null;actor.status=RECRUIT_STAGE_LABEL[phase];savePose();changed();
 }
 function sail(){const b=boat();if(b){b.phase='leaving';b.t=0}active().phase='outbound';actor.visible=false;actor.path=[];actor.harborLeg=null;savePose();changed()}
 function finish(){
  if(finishRecruitmentDeparture(state())){actor.visible=false;actor.recruitControlled=true;actor.path=[];onEvent?.(active().profile.name+(active().hasArrived?'已乘船离岛，协作记录留在招聘手账。':'本次没有登岛，已取消到岛安排。'));changed()}
 }
 function beginReturn(){
  const a=active(),queue=queueFor(crowd());if(queue<0){actor.status='候船区较忙，等空出位置';return}
  actor.harborQueue=queue;
  const route=findPath(actor,HARBOR.entrance,worldWalkable);
  if(!route.length&&Math.hypot(actor.x-HARBOR.entrance.x,actor.y-HARBOR.entrance.y)>36){actor.status='正在寻找回码头的通路';return}
  path([...route,...returnRoute(queue)],'returning','return');
 }
 function beginLeave(){
  const a=active();if(a.feePaid===null){if(!settle())return false;resident().releaseActor(actor)}
  actor.recruitControlled=true;a.phase='leaving_room';actor.status=RECRUIT_STAGE_LABEL.leaving_room;savePose();changed();return true;
 }
 function createBoat(){
  if(visitors()?.boats.length)return false;
  active().transport.boat={id:9001,phase:'approaching',t:0,x:HARBOR.sea.x,y:HARBOR.sea.y};changed();return true;
 }
 function attach(){
  const a=active();if(!a){if(npcs.length>16){resident().releaseActor(npcs[16]);npcs.splice(16)}actor=null;lastId=null;return}
  if(lastId===a.id&&actor)return;
  if(npcs.length>16){resident().releaseActor(npcs[16]);npcs.splice(16)}
  a.transport??={boat:null,path:[],queue:null};
  const pos=a.position?.inside!=null?SLOTS[a.position.inside]?.entry:a.position;
  actor={npcId:16,x:pos?.x??HARBOR.cabin.x,y:pos?.y??HARBOR.cabin.y,direction:a.position?.direction||0,
   face:1,phase:0,path:[],think:0,inside:null,action:null,assignment:null,aiSource:'hermes',walkMix:0,visible:!['awaiting_ferry','inbound','outbound','departed'].includes(a.phase),
   recruitControlled:a.phase!=='working',harborQueue:a.transport.queue??null,status:RECRUIT_STAGE_LABEL[a.phase]};
  if(a.phase==='working')Object.assign(actor,nearestWalkable(actor.x,actor.y));
  if(['landing','returning','boarding'].includes(a.phase)){actor.path=a.transport.path.map(p=>({...p}));actor.harborLeg=({landing:'arrival',returning:'return',boarding:'boarding'})[a.phase]}
  if(a.phase==='leaving_room')actor.inside=null;
  npcs.push(actor);lastId=a.id;
 }
 function reset(){lastId=null;attach()}
 function update(dt){
  attach();const a=active();if(!a||!actor)return;
  if(a.phase==='departed')return;
  if(a.phase==='working'&&state().recruitment.renewal?.oldId===a.id){savePose();actor.recruitControlled=true;actor.status='正在与管家商量续约分工';return;}
  if(a.phase==='working'){actor.recruitControlled=false;
   const progress=recruitmentProgress(state()),project=state().workProjects.find(p=>p.id===a.projectId);
   if(state().day>=a.expiresDay)requestRecruitmentLeave(state(),'聘期结束，交回剩余工作后继续采风');
   else if(!project||['completed','cancelled'].includes(project.status)||progress.done)requestRecruitmentLeave(state(),'约定工作已经结束，继续群岛采风');
   if(a.leaveRequested)beginLeave();
  }
  if(a.leaveRequested&&['awaiting_ferry','inbound'].includes(a.phase)){
   if(a.feePaid===null&&!settle())return;
   if(!boat()){finish();return}
   if(boat().phase==='moored')sail();
  }
  if(a.phase==='awaiting_ferry'&&!a.leaveRequested&&createBoat())a.phase='inbound';
  if(a.phase==='leaving_room'){
   if(actor.indoorActor?.path.length)followPath(actor.indoorActor,dt,108);
   if(actor.inside==null)beginReturn();
  }
  if(a.phase==='waiting_boat'&&!boat())createBoat();
  const b=boat();
  if(b){
   b.t+=dt;
   if(b.phase==='approaching'){
    const p=Math.min(1,b.t/12),e=p*p*(3-2*p);b.x=HARBOR.sea.x+(HARBOR.berth.x-HARBOR.sea.x)*e;b.y=HARBOR.sea.y+(HARBOR.berth.y-HARBOR.sea.y)*e;
    if(p===1){b.phase='moored';b.t=0;
     if(a.phase==='inbound'){
      if(a.leaveRequested)sail();
      else{Object.assign(actor,HARBOR.cabin);path(arrivalRoute(),'landing','arrival')}
     }
    }
   }else if(b.phase==='leaving'){
    const p=Math.min(1,b.t/13),e=p*p*(3-2*p);b.x=HARBOR.berth.x+(HARBOR.sea.x-HARBOR.berth.x)*e;b.y=HARBOR.berth.y+(HARBOR.sea.y-HARBOR.berth.y)*e;
    if(p===1){a.transport.boat=null;if(a.phase==='outbound'){finish();return}}
   }
  }
  if(a.phase==='waiting_boat'&&boat()?.phase==='moored')path(boardingRoute(actor.harborQueue),'boarding','boarding');
  if(['landing','returning','boarding'].includes(a.phase)){
   if(actor.path.length&&!shouldYield(actor,[...crowd(),actor]))followPath(actor,dt,78);
   else if(actor.path.length){actor.walkMix*=Math.exp(-dt*10);actor.walking=false}
   if(!actor.path.length){
    if(a.phase==='landing'){
     actor.harborLeg=null;
     if(a.leaveRequested)beginLeave();
     else{a.phase='working';a.hasArrived=true;actor.recruitControlled=false;actor.think=0;actor.status='到岛了，开始执行约定的筹备步骤';if(boat()){boat().phase='leaving';boat().t=0}onEvent?.(a.profile.name+'经客运栈桥到岛，开始协助'+a.title+'。');changed()}
    }else if(a.phase==='returning'){a.phase='waiting_boat';actor.harborLeg=null;actor.status=RECRUIT_STAGE_LABEL.waiting_boat;changed()}
    else sail();
   }
  }
  savePose();
 }
 return {update,reset,get boats(){return boat()?[boat()]:[]},get actor(){return actor},
  reserved:()=>!!active()&&(!!boat()||['awaiting_ferry','inbound','landing','waiting_boat','boarding','outbound'].includes(active().phase)),
  passengers:()=>actor?.visible&&actor.harborQueue!=null?[actor]:[]};
}
