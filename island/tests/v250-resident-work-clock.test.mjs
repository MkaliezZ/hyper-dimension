import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceAcceptedWorkAction} from '../src/residentActivityControl.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';
import {visibleFrameSeconds,visibleNavigationSeconds} from '../src/frameClock.js';

for(const[kind,key,type]of[['farm','serverFarmTicket','water'],['field','serverFieldTicket','pickaxe'],['resident','serverResidentTicket','axe']])test(kind+' accepted work cannot finish before a full monotonic duration after acknowledgment',()=>{
 let calls=0;const action={type,t:19.9,duration:20,acknowledgedAt:1000,onDone:()=>calls++},n={npcId:0,intent:{[key]:{kind,actor:'npc',actorId:0,action:type}},action};
 assert.equal(advanceAcceptedWorkAction(n,.5,1200),true);assert.equal(action.t,20);assert.equal(calls,0,'A frame partly predating the grant cannot finish an action early');assert.equal(n.action,action);
 assert.equal(advanceAcceptedWorkAction(n,0,1000000),false);assert.equal(calls,0,'Hidden or paused frames cannot finish work, even after a long suspension');
 assert.equal(advanceAcceptedWorkAction(n,.1,21000),true);assert.equal(calls,1);assert.equal(n.action,null);assert.equal(advanceAcceptedWorkAction(n,.1,22000),false);assert.equal(calls,1);
});

test('an accepted work pose has a bounded visible step and cannot catch up a suspension in one call',()=>{
 let calls=0;const action={type:'axe',t:0,duration:20,acknowledgedAt:0,onDone:()=>calls++},n={npcId:0,intent:{serverResidentTicket:{kind:'resident',actor:'npc',actorId:0,action:'axe'}},action};
 assert.equal(advanceAcceptedWorkAction(n,600000,600000),true);assert.equal(action.t,.75);assert.equal(calls,0);
});

for(const theme of ['pixel','origami'])test(theme+' regular runtime advances an already granted20s job at visible low-frame speed without advancing protected simulation clocks',async()=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'Providers disabled in fictional work-clock unit'},{status:503});setWorldTheme(theme);
 try{
  const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true}));
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:9,cycles:0,season:'spring'})});
  for(const n of npcs){n.manualUntil=10000;Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:100,rations:2});}
  let calls=0,simulation=0,visible=0,firstAt;const n=npcs[0];n.path=[];n.intent={goal:'forest',action:'work',serverResidentTicket:{kind:'resident',actor:'npc',actorId:0,action:'axe'}};n.action={type:'axe',t:0,duration:20,onDone:()=>{calls++;firstAt=visible;}};
  for(let i=0;i<100;i++){const previous=i*600,at=previous+600,dt=visibleFrameSeconds(at,previous),travel=visibleNavigationSeconds(at,previous);simulation+=dt;visible+=travel;runtime.update(dt,simulation,travel);}
  assert.equal(calls,1);assert(firstAt>=20&&firstAt<=21,'One20s granted action must not take80s under a slow renderer');assert.equal(n.action,null);
  assert(Math.abs(simulation-15)<1e-8);assert(Math.abs(needs(0,state).energy-99.4)<1e-8);assert.equal(state.coins,0);assert(Object.values(state.inventory).every(v=>v===0),'A presentation completion is not a material receipt');
  let hiddenCalls=0;const held=n.action={type:'axe',t:20,duration:20,acknowledgedAt:performance.now(),onDone:()=>hiddenCalls++};runtime.update(0,simulation,0);assert.equal(hiddenCalls,0,'The regular runtime must not fall through to a local completion on a hidden frame');assert.equal(n.action,held);
 }finally{globalThis.fetch=oldFetch;setWorldTheme('pixel');}
});
