import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {queueTask} from '../src/taskBoard.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath,followPendingPath} from '../src/movement.js';

// Controlled domain fixture, not a native or hosted macOS root-cause proof.
function fixture(theme,boundary){
 setWorldTheme(theme);
 const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true,manualUntil:10000,think:1000}));
 for(const n of npcs)Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:100,rations:2});
 const command={id:'exit-queued-task',npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'Return to accepted work'};
 const task=queueTask(state,command,{targetItem:'wood'}).task,n=npcs[5];
 const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:boundary==='off-shift'?18:9,day:2,cycles:1.4,season:'spring'})});
 Object.assign(n,{manualUntil:-1,inside:8,indoorActor:{x:500,y:420,path:[],phase:0,walkMix:0},intent:{goal:'gallery',buildingId:8,action:'visit',purposeId:'life:beacon-watch'},assignment:{...command,targetItem:'wood'}});
 if(boundary==='hungry')needs(5,state).hunger=25;
 if(boundary==='paused')task.status='paused';
 if(boundary==='own-pending')n.intent={goal:'gallery',buildingId:8,action:'work',assignmentId:task.id,starting:true};
 return{state,n,task,runtime};
}
for(const theme of ['pixel','origami'])test(theme+' a scheduled resident can finish a pose-only exit while unrelated receipts settle',()=>{
 try{
  const f=fixture(theme);f.runtime.update(.1,.1);
  assert(f.n.indoorActor.path.length>0);assert.equal(f.n.indoorActor.after.navigationOnly,true);
  for(let i=0;i<150;i++)if(f.n.indoorActor?.path.length)followPendingPath(f.n.indoorActor,.1,108);
  assert.equal(f.n.inside,null);assert.equal(f.n.indoorActor,null);assert.equal(f.n.intent,null);assert.equal(f.n.think,0);
  assert.equal(f.task.status,'queued');assert.equal(f.task.completed,0);assert.equal(f.state.inventory.wood,0);
 }finally{setWorldTheme('pixel');}
});
for(const boundary of ['off-shift','hungry','paused','own-pending'])test('room exit does not override '+boundary,()=>{
 try{
  const f=fixture('pixel',boundary),intent=f.n.intent;f.runtime.update(.1,.1);
  for(let i=0;i<150;i++)if(f.n.indoorActor?.path.length)followPendingPath(f.n.indoorActor,.1,108);
  assert.equal(f.n.inside,8);assert.equal(f.n.intent,intent);assert.equal(f.task.completed,0);assert.equal(f.state.inventory.wood,0);
 }finally{setWorldTheme('pixel');}
});
