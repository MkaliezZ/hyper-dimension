import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';

function fixture(theme,{ready=true,canQueue=true,ownPending=false}={}){
 setWorldTheme(theme);const state=hydrateTown(createZeroState()),calls=[];
 state.visitorControl={activeSeconds:0,nextTripAt:100000,guests:[{id:1,skin:3,name:'Fictional buyer',phase:'landed',itinerary:[11],stop:0,budget:24,spent:0,ratings:[],arrivedAt:0}]};
 const remote={ready:()=>ready,settling:()=>true,canQueue:()=>canQueue,ensure(){},recover(){},
  command(operation,args){calls.push({operation,...args});return new Promise(()=>{});},
  finish(){assert.fail('No sale before the authority confirms admission and service');},cancel(){assert.fail('No cancellation expected');}};
 const runtime=createVisitorRuntime({getState:()=>state,followPath,onEvent(){},onChange(){},remote});
 const guest=runtime.guests[0],door=guest.path.at(-1);assert(door);Object.assign(guest,door,{path:[door],remotePending:ownPending});
 return{runtime,state,calls,guest};
}
const step=async runtime=>{runtime.animatePending(.1,.1);await new Promise(r=>setImmediate(r));};
for(const theme of ['pixel','origami'])test(`${theme}: another visitor's queued receipt cannot hold an arrived buyer outside its room`,async()=>{
 const f=fixture(theme);try{
  for(let i=0;i<100&&!f.calls.length;i++)await step(f.runtime);
  assert.equal(f.calls.length,1,'An arrived buyer may queue its own canonical admission');
  assert.deepEqual(f.calls[0],{operation:'begin',guestId:1,stop:0,buildingId:11});
  assert.equal(f.guest.stage,'startingService');assert.equal(f.guest.remotePending,true);
  for(let i=0;i<100;i++)await step(f.runtime);
  assert.equal(f.calls.length,1,'The buyer must wait for its own original response');
  assert.equal(f.state.coins,0);assert(Object.values(f.state.inventory).every(n=>n===0));
 }finally{f.runtime.reset();setWorldTheme('pixel');}
});
for(const condition of [{ownPending:true},{canQueue:false},{ready:false}])test('queued visitor movement preserves authority and own-request barriers '+JSON.stringify(condition),async()=>{
 const f=fixture('pixel',condition);try{
  for(let i=0;i<100;i++)await step(f.runtime);
  assert.equal(f.calls.length,0);assert.equal(f.state.coins,0);assert(Object.values(f.state.inventory).every(n=>n===0));
 }finally{f.runtime.reset();setWorldTheme('pixel');}
});
