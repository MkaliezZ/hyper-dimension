import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {queueTask} from '../src/taskBoard.js';
import {cropInfo} from '../src/farming.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';

for(const theme of ['pixel','origami'])test(theme+' resident waits for confirmed harvest stage instead of submitting a predicted one',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'Fictional farm test; providers disabled'},{status:503});setWorldTheme(theme);
 try{
  const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true})),calls=[];
  for(const p of state.plots)Object.assign(p,{stage:3,crop:'wheat',growth:0});
  state.plots[1].stage=4;state.plots[1].growth=cropInfo(state.plots[1]).seconds;
  state.farmControl={version:1,leases:[]};
  const confirmed=structuredClone(state.plots);confirmed[1].stage=3;confirmed[1].growth--;
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:9,cycles:0,season:'spring'}),farmRemote:{occupied:()=>false,ready:(i,stage)=>confirmed[i].stage===stage,begin:async(n,d,type)=>{calls.push({npcId:n.npcId,index:d.farmIndex,type});return null;},cancel:async()=>{},finish:async()=>{}}});
  for(const n of npcs){n.manualUntil=10000;Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:100,rations:2});}
  const n=npcs[0];n.manualUntil=-1;n.think=0;
  queueTask(state,{id:'wait-confirmed-crop',npcId:0,goal:'farm',resource:'wheat',quantity:1,intent:'收获已经成熟的小麦'},{targetItem:'wheat'});
  let time=0;
  for(let i=0;i<600;i++){time+=.1;runtime.update(.1,time);if(i%20===0)await new Promise(r=>setImmediate(r));}
  assert.equal(calls.length,0,'A local growth prediction must not open a harvest against an immature authoritative plot');
  assert.equal(state.inventory.wheat,0);assert.equal(state.agentTaskLedger[0].completed,0);
  confirmed[1].stage=4;
  for(let i=0;i<600&&!calls.length;i++){time+=.1;runtime.update(.1,time);if(i%20===0)await new Promise(r=>setImmediate(r));}
  assert.equal(calls.length,1);assert.deepEqual(calls[0],{npcId:0,index:1,type:'harvest'});assert.equal(state.inventory.wheat,0,'Dispatch is not a harvest receipt');
 }finally{globalThis.fetch=old;setWorldTheme('pixel');}
});
