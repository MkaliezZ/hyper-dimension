import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {followPath} from '../src/movement.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {setWorldTheme} from '../src/world.js';

const drain=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(theme,{ownPending=false,ready=true}={}){
 setWorldTheme(theme);const state=hydrateTown(createZeroState()),calls=[];
 state.visitorControl={activeSeconds:0,nextTripAt:100000,guests:[{id:1,skin:0,name:'虚构接待游客',phase:'landed',itinerary:[14],stop:0,budget:16,spent:0,ratings:[],arrivedAt:0}]};
 let pending=ownPending,available=ready,resolveBegin;
 const remote={ready:()=>available,settling:()=>pending,ensure(){},recover(){},
  command(operation,args){calls.push({operation,...args});assert.equal(operation,'begin');pending=true;return new Promise(resolve=>resolveBegin=()=>{pending=false;resolve({ticket:{kind:'visitor',requestId:'controlled-admission',guestId:1,buildingId:14,duration:12}});});},
  finish(){throw Error('A service admission must not credit a sale');},cancel(){throw Error('Unexpected cancellation');}};
 const runtime=createVisitorRuntime({getState:()=>state,followPath,onEvent(){},onChange(){},remote});
 return{runtime,state,calls,guest:runtime.guests[0],releaseOwn:()=>pending=false,setReady:value=>available=value,resolveBegin:()=>resolveBegin?.()};
}
for(const theme of ['pixel','origami'])test(theme+' visitor can queue one canonical service admission while unrelated work keeps the main simulation pending',async()=>{
 const f=fixture(theme);try{
  for(let i=0;i<800;i++){f.runtime.animatePending(.1,.1);await drain();if(f.calls.length)break;}
  assert.equal(f.calls.length,1,'A visitor that has reached its indoor seat must not wait for unrelated resident/save work to stop');
  assert.equal(f.calls[0].guestId,1);assert.equal(f.calls[0].buildingId,14);assert.equal(f.guest.stage,'startingService');assert.equal(f.guest.remotePending,true);
  for(let i=0;i<50;i++){f.runtime.animatePending(.1,.1);await drain();}
  assert.equal(f.calls.length,1,'One visitor may have only one pending admission');
  assert.equal(f.state.coins,0);assert(Object.values(f.state.inventory).every(n=>n===0));
  f.resolveBegin();await drain();assert.equal(f.guest.stage,'servicing');assert.equal(f.guest.serverTicket.requestId,'controlled-admission');
 }finally{f.runtime.reset();setWorldTheme('pixel');}
});

test('the visitor transport must finish its own operation before admitting another service',async()=>{
 const f=fixture('pixel',{ownPending:true});try{
  for(let i=0;i<800;i++){f.runtime.animatePending(.1,.1);await drain();}
  assert.equal(f.calls.length,0);f.releaseOwn();
  for(let i=0;i<100;i++){f.runtime.animatePending(.1,.1);await drain();if(f.calls.length)break;}
  assert.equal(f.calls.length,1);
 }finally{f.runtime.reset();}
});

test('an unavailable visitor authority cannot begin service during pending presentation',async()=>{
 const f=fixture('pixel',{ready:false});try{
  for(let i=0;i<800;i++){f.runtime.animatePending(.1,.1);await drain();}
  assert.equal(f.calls.length,0);assert.equal(f.state.coins,0);
 }finally{f.runtime.reset();}
});
