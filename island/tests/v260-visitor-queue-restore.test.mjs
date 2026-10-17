import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {setWorldTheme,HARBOR} from '../src/world.js';
import {followPath} from '../src/movement.js';

const saved=(id,queue)=>({id,skin:id%4,name:'Fictional visitor '+id,budget:28,spent:0,ratings:[],itinerary:[11],stop:1,arrivedAt:0,phase:queue===undefined?'landed':'reviewed',...(queue===undefined?{}:{queue})});
function fixture(theme,order,extra=[]){
 setWorldTheme(theme);const state=hydrateTown(createZeroState());
 state.visitorControl={version:1,theme,activeSeconds:40,nextTripAt:99999,guests:order,leases:[]};
 const unexpected=[];
 const remote={ready:()=>true,settling:()=>false,command:async(...args)=>{unexpected.push(args);throw Error('Restoration must not submit a review before actually reaching the terminal');},recover(){unexpected.push('recover');}};
 const runtime=createVisitorRuntime({getState:()=>state,followPath,onChange(){},onEvent(){},remote,extraPassengers:()=>extra});
 return{runtime,unexpected};
}
for(const theme of ['pixel','origami']){
 for(const position of ['first','between'])test(theme+' restore reserves every reviewed queue before resuming a completed visitor placed '+position,()=>{
  const complete=saved(36),reviewed=[saved(35,0),saved(37,1)];
  const order=position==='first'?[complete,...reviewed]:[reviewed[0],complete,reviewed[1]];
  const {runtime,unexpected}=fixture(theme,order);try{
   assert.equal(runtime.guests.find(g=>g.id===36).harborQueue,2);
   assert.equal(runtime.guests.find(g=>g.id===35).harborQueue,0);
   assert.equal(runtime.guests.find(g=>g.id===37).harborQueue,1);
   assert.equal(new Set(runtime.guests.map(g=>g.harborQueue)).size,3);
   assert.deepEqual(unexpected,[]);
  }finally{setWorldTheme('pixel');}
 });
 test(theme+' a full restored terminal waits instead of claiming an occupied queue',()=>{
  const {runtime,unexpected}=fixture(theme,[saved(36),...HARBOR.waiting.map((_,i)=>saved(100+i,i))]);try{
   const g=runtime.guests.find(g=>g.id===36);assert.equal(g.harborQueue,undefined);assert(g.retry);assert.equal(g.stage,'returning');assert.deepEqual(unexpected,[]);
  }finally{setWorldTheme('pixel');}
 });
 test(theme+' a restored visitor also respects a recruited passenger queue reservation',()=>{
  const {runtime,unexpected}=fixture(theme,[saved(36),saved(35,0),saved(37,1)],[{id:'fictional-companion',stage:'waitingBoat',harborQueue:2}]);try{
   assert.equal(runtime.guests.find(g=>g.id===36).harborQueue,3);assert.deepEqual(unexpected,[]);
  }finally{setWorldTheme('pixel');}
 });
 test(theme+' repeated recovery preserves occupied queues and never duplicates restored actors',()=>{
  const {runtime,unexpected}=fixture(theme,[saved(35,0),saved(36),saved(37,1)]);try{
   for(let i=0;i<5;i++){runtime.reset();assert.equal(runtime.guests.length,3);assert.equal(new Set(runtime.guests.map(g=>g.id)).size,3);assert.equal(new Set(runtime.guests.map(g=>g.harborQueue)).size,3);assert.equal(runtime.guests.find(g=>g.id===36).harborQueue,2);}assert.deepEqual(unexpected,[]);
  }finally{setWorldTheme('pixel');}
 });
}
