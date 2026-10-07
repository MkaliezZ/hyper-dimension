import test from 'node:test';
import assert from 'node:assert/strict';
import {createState,RESIDENTS,setWorldTheme,HARBOR,SLOTS,worldWalkable} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject,assignProjectStep,validProjects} from '../src/projectPlans.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {createRecruitmentRuntime} from '../src/recruitmentRuntime.js';
import {followPath} from '../src/movement.js';
import {harborSurfaceWalkable} from '../src/harborNavigation.js';
import {prepareRecruitment,bindRecruitment,requestRecruitmentLeave,handoverRecruitment,recruitmentProgress,archiveRecruitment,validRecruitment} from '../src/recruitment.js';
import {RECRUIT_CANDIDATE,customRecruitCandidate} from '../src/recruitmentCatalog.js';
import {availableQuantity} from '../src/resourceLedger.js';
import {validateState} from '../server/saveStore.mjs';

function setup(theme='pixel',quantity=6){
 setWorldTheme(theme);let state=hydrateTown(createState());state.saveSlot='unit-island-'+theme;state.coins=20;
 for(const id of Object.keys(state.inventory))state.inventory[id]=0;
 const plan=createProject(state,{id:'work-plan',title:'迎宾木料',targets:{wood:quantity}});assert(plan.ok);
 const id='hire-game-'+theme;assert(prepareRecruitment(state,id,plan.project.id).ok);
 const candidate=customRecruitCandidate({name:'青石',roleId:'yan',appearance:'male_2',personality:'细致务实',backstory:'造访群岛的木作学者'},'custom-journey-test');
 const contract={id,profile:candidate,world:state.saveSlot,phase:'active',steps:['work-plan:wood'],projectId:'work-plan',wage:8,startedDay:1,expiresDay:3,
  context:{project:plan.project},runs:[{parent:{id:'hd-parent-fixture',usage:{total:10}},child:{id:'hd-child-fixture',acceptedSteps:['work-plan:wood'],usage:{total:10}}}]};
 assert(bindRecruitment(state,contract).ok);
 const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
 const profile=i=>i===16?{...RECRUIT_CANDIDATE,...state.recruitment.active?.profile}:RESIDENTS[i];
 const runtime=createResidentRuntime({npcs,getState:()=>state,profile,followPath,onChange:()=>{},onEvent:()=>{}});
 const ferry={boats:[],guests:[]};
 const recruit=createRecruitmentRuntime({state:()=>state,npcs,followPath,resident:()=>runtime,visitors:()=>ferry,onChange:()=>{},onEvent:()=>{}});
 recruit.reset();for(const n of npcs.slice(0,16))n.manualUntil=1e6;
 let time=0;
 function tick(){time+=.1;recruit.update(.1);runtime.update(.1,time)}
 function reload(){const before=state.recruitment.active.position;state=structuredClone(state);runtime.reset();recruit.reset();for(const n of npcs.slice(0,16))n.manualUntil=1e6;return {before,after:state.recruitment.active.position}}
 return {state:()=>state,npcs,runtime,recruit,ferry,tick,reload,contract};
}
const originalFetch=globalThis.fetch;
globalThis.fetch=async()=>new Response('{"error":"isolated mechanics test"}',{status:503});
test.after(()=>{globalThis.fetch=originalFetch});
for(const theme of ['pixel','origami']){
 test(theme+': custom specialist ferry, walking, actual wood work, wage and departure survive reload',()=>{
  const r=setup(theme),seen=new Set();let reloaded=false,maxStep=0,previous=null;
  for(let i=0;i<9000&&r.state().recruitment.active.phase!=='departed';i++){
   r.tick();const a=r.state().recruitment.active,n=r.npcs[16];seen.add(a.phase);
   if(n.visible&&n.inside==null&&previous?.visible&&previous.inside==null&&!previous.reloaded){
    const step=Math.hypot(n.x-previous.x,n.y-previous.y);maxStep=Math.max(maxStep,step);assert(step<9,'visible actor jumped '+step);
   }
   if(n.harborLeg)assert(worldWalkable(n.x,n.y)||harborSurfaceWalkable(n.x,n.y,true),'left painted harbor surface');
   previous={x:n.x,y:n.y,visible:n.visible,inside:n.inside};
   if(a.phase==='landing'&&!reloaded){const pose={x:n.x,y:n.y};r.reload();assert.equal(r.npcs[16].x,pose.x);assert.equal(r.npcs[16].y,pose.y);reloaded=true;previous.reloaded=true}
  }
  const s=r.state(),a=s.recruitment.active;
  assert.equal(a.phase,'departed',JSON.stringify({stage:a.phase,n:r.npcs[16],steps:s.agentTaskLedger},(k,v)=>k==='after'||k==='onDone'?undefined:v));
  assert.equal(a.profile.name,'青石');assert.equal(a.profile.appearance,'male_2');assert.equal(a.profile.roleId,'yan');assert(a.hasArrived);assert.equal(s.inventory.wood,6);assert.equal(a.feePaid,8);assert.equal(s.coins,12);assert.equal(s.recruitment.departedId,a.id);
  assert.equal(s.economy.cashLedger.filter(t=>t.category==='recruitment').length,1);
  assert(s.agentTaskLedger[0].evidence.every(e=>e.npcId===16&&e.contractId===a.id));
  for(const stage of ['inbound','landing','working','returning','waiting_boat','boarding','outbound','departed'])assert(seen.has(stage),stage);
  assert(validProjects(s));assert(validRecruitment(s));validateState(s);
  assert(handoverRecruitment(s).replayed);assert.equal(s.coins,12);
  assert(archiveRecruitment(s,a.id));r.recruit.reset();assert.equal(r.npcs.length,16);assert.equal(s.recruitment.history.length,1);
 });
}
