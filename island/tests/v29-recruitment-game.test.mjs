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
import {RECRUIT_CANDIDATE} from '../src/recruitmentCatalog.js';
import {availableQuantity} from '../src/resourceLedger.js';
import {validateState} from '../server/saveStore.mjs';

function setup(theme='pixel',quantity=6){
 setWorldTheme(theme);let state=hydrateTown(createState());state.saveSlot='unit-island-'+theme;state.coins=20;
 for(const id of Object.keys(state.inventory))state.inventory[id]=0;
 const plan=createProject(state,{id:'work-plan',title:'迎宾木料',targets:{wood:quantity}});assert(plan.ok);
 const id='hire-game-'+theme;assert(prepareRecruitment(state,id,plan.project.id).ok);
 const contract={id,world:state.saveSlot,phase:'active',steps:['work-plan:wood'],projectId:'work-plan',wage:8,startedDay:1,expiresDay:3,
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
 test(theme+': real ferry, walking, work receipts, prorated wage and complete departure survive reload',()=>{
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
  assert(a.hasArrived);assert.equal(s.inventory.wood,6);assert.equal(a.feePaid,8);assert.equal(s.coins,12);assert.equal(s.recruitment.departedId,a.id);
  assert.equal(s.economy.cashLedger.filter(t=>t.category==='recruitment').length,1);
  assert(s.agentTaskLedger[0].evidence.every(e=>e.npcId===16&&e.contractId===a.id));
  for(const stage of ['inbound','landing','working','returning','waiting_boat','boarding','outbound','departed'])assert(seen.has(stage),stage);
  assert(validProjects(s));assert(validRecruitment(s));validateState(s);
  assert(handoverRecruitment(s).replayed);assert.equal(s.coins,12);
  assert(archiveRecruitment(s,a.id));r.recruit.reset();assert.equal(r.npcs.length,16);assert.equal(s.recruitment.history.length,1);
 });
}
test('cancelling before arrival releases held wages, creates no goods and no fake island arrival',()=>{
 const r=setup();assert.equal(availableQuantity(r.state(),'coins'),12);
 requestRecruitmentLeave(r.state(),'取消到岛');r.tick();
 const a=r.state().recruitment.active;
 assert.equal(a.phase,'departed');assert.equal(a.feePaid,0);assert.equal(r.state().coins,20);assert.equal(r.state().inventory.wood,0);assert(!a.hasArrived);
 assert(!a.history.some(h=>h.text.includes('已从栈桥登船')));
});
test('cancel after real partial work stops the old action and settles only delivered quantity',()=>{
 const r=setup('pixel',12);let stopped=false;
 for(let i=0;i<9000&&r.state().recruitment.active.phase!=='departed';i++){
  r.tick();if(!stopped&&recruitmentProgress(r.state()).delivered>=2){
   requestRecruitmentLeave(r.state(),'岛主接管剩余工作');stopped=true;
  }
 }
 const s=r.state(),a=s.recruitment.active;assert(stopped);assert.equal(a.phase,'departed');assert.equal(a.delivered,2);assert.equal(a.feePaid,2);assert.equal(s.coins,18);assert.equal(s.inventory.wood,2);
 assert.equal(s.agentTaskLedger[0].npcId,5);assert.equal(s.agentTaskLedger[0].remaining,10);
 const snapshot=JSON.stringify(s.inventory);for(let i=0;i<20;i++)r.tick();assert.equal(JSON.stringify(s.inventory),snapshot);
});
test('player reassignment is respected and unsupported steps cannot be assigned to the hired agent',()=>{
 const r=setup(),s=r.state();assert(assignProjectStep(s,'work-plan:wood',-1).ok);
 assert(createProject(s,{id:'other-plan',title:'别的计划',targets:{stone:2}}).ok);
 assert.equal(assignProjectStep(s,'other-plan:stone',16).ok,false);
 handoverRecruitment(s);assert.equal(s.agentTaskLedger.find(t=>t.id==='work-plan:wood').npcId,-1);
 assert.equal(s.coins,20);
});
test('the ferry waits for an occupied berth and candidate queue does not collide with tourists',()=>{
 const r=setup();r.ferry.boats.push({phase:'moored'});
 for(let i=0;i<150;i++)r.tick();assert.equal(r.state().recruitment.active.phase,'awaiting_ferry');assert.equal(r.recruit.boats.length,0);
 r.ferry.boats.splice(0);r.tick();assert.equal(r.state().recruitment.active.phase,'inbound');
 const visitors=createVisitorRuntime({getState:r.state,followPath,onEvent:()=>{},onChange:()=>{},harborReserved:()=>r.recruit.reserved(),extraPassengers:()=>r.recruit.passengers()});
 for(let i=0;i<300;i++)visitors.update(.1,i*.1);assert.equal(visitors.boats.length,0);
 visitors.reset();
});
test('slot validation rejects malformed and foreign world contracts',()=>{
 const r=setup(),s=r.state();assert(validRecruitment(s));
 const bad=structuredClone(s);bad.recruitment.active.world='different-world';assert.equal(validRecruitment(bad),false);assert.throws(()=>validateState(bad));
});

test('contract expiry hands over unfinished work and survives return/boarding reloads',()=>{
 const r=setup('origami',40),loaded=new Set();let expired=false;
 for(let i=0;i<11000&&r.state().recruitment.active.phase!=='departed';i++){
  r.tick();const a=r.state().recruitment.active;
  if(a.phase==='working'&&!expired){r.state().day=a.expiresDay;expired=true}
  if(['returning','boarding'].includes(a.phase)&&!loaded.has(a.phase)){loaded.add(a.phase);const p={x:r.npcs[16].x,y:r.npcs[16].y};r.reload();assert.equal(r.npcs[16].x,p.x);assert.equal(r.npcs[16].y,p.y)}
 }
 const a=r.state().recruitment.active;assert(expired);assert.equal(a.phase,'departed');assert.equal(a.feePaid,0);assert.match(a.leaveRequested,/聘期结束/);assert.equal(loaded.size,2);assert.notEqual(r.state().agentTaskLedger[0].npcId,16);
});
test('invalid saved transfer routes, queue indices and boats are rejected before resume',()=>{
 const r=setup();r.tick();const s=r.state();assert(validRecruitment(s));
 for(const change of [a=>a.transport.path=null,a=>a.transport.path=[{x:NaN,y:1}],a=>a.transport.queue=9,a=>a.transport.boat.phase='broken',a=>a.position.inside=99]){
  const bad=structuredClone(s);change(bad.recruitment.active);assert.equal(validRecruitment(bad),false);assert.throws(()=>validateState(bad));
 }
});
