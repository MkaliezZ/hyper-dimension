import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {setWorldTheme,SLOTS} from '../src/world.js';
import {followPath} from '../src/movement.js';
import {advanceAcceptedVisitorService} from '../src/visitorActivityControl.js';

function fixture(theme){
 setWorldTheme(theme);const state=hydrateTown(createZeroState()),calls=[],errors=[];
 const remote={ready:()=>true,settling:()=>false,recover:()=>errors.push(guest.status),finish:async ticket=>{calls.push(structuredClone(ticket));return{receipt:{guest:{spent:7,budget:28,ratings:[60],stop:1},text:'Controlled service receipt; no actual stock or money is credited by this adapter.'}};},command(){throw Error('Unexpected visitor command');},cancel(){throw Error('Unexpected cancellation');}};
 const runtime=createVisitorRuntime({getState:()=>state,followPath,onChange(){},onEvent(){},remote});
 const guest={id:2,skin:1,name:'虚构游客',stage:'servicing',stop:0,itinerary:[11,18,7],x:500,y:585,path:[],inside:11,arrivedAt:0,targetBuilding:11,spent:0,budget:28,ratings:[],serviceTime:0,serviceAcknowledgedAt:performance.now()-13000,serverTicket:{kind:'visitor',requestId:'controlled-visitor-lease',epoch:'controlled',sequence:1,guestId:2,buildingId:11,duration:12},indoorActor:{npcId:1,isVisitor:true,x:500,y:585,path:[],action:{type:'observe',duration:12,t:0}}};
 guest.entries=id=>SLOTS[id].entry;runtime.guests.push(guest);return{runtime,state,guest,calls,errors};
}
const settled=()=>new Promise(resolve=>setImmediate(resolve));
for(const theme of ['pixel','origami'])test(theme+' an accepted visitor service can submit its original lease while unrelated receipts hold simulation updates',async()=>{
 const f=fixture(theme);try{
  for(let i=0;i<40;i++){f.runtime.animatePending(.15,.6);await settled();}
  assert.equal(f.calls.length,1,'A confirmed12second service must not remain frozen behind unrelated saves');
  assert.equal(f.calls[0].requestId,'controlled-visitor-lease');assert.equal(f.calls[0].sequence,1);assert.deepEqual(f.errors,[]);
  assert.equal(f.state.coins,0);assert(Object.values(f.state.inventory).every(n=>n===0),'Only an authoritative server receipt may credit actual sale proceeds');
 }finally{f.runtime.reset();setWorldTheme('pixel');}
});
test('hidden or suspended frames cannot advance an accepted visitor service',async()=>{
 const f=fixture('pixel');try{for(let i=0;i<40;i++)f.runtime.animatePending(0,0);await settled();assert.equal(f.guest.serviceTime,0);assert.equal(f.calls.length,0);}finally{f.runtime.reset();}
});
test('an already submitted visitor service cannot send a duplicate finish',async()=>{
 const f=fixture('pixel');try{f.guest.remotePending=true;for(let i=0;i<40;i++)f.runtime.animatePending(.15,.6);await settled();assert.equal(f.guest.serviceTime,0);assert.equal(f.calls.length,0);}finally{f.runtime.reset();}
});
test('a partial visible pose cannot bypass the full monotonic acknowledged service duration',async()=>{
 const f=fixture('pixel');try{f.guest.serviceAcknowledgedAt=performance.now();for(let i=0;i<40;i++)f.runtime.animatePending(.15,.6);await settled();assert.equal(f.calls.length,0);}finally{f.runtime.reset();}
});
test('a single long frame has a bounded pose and cannot catch up a suspended interval',()=>{
 const f=fixture('pixel');try{assert.equal(advanceAcceptedVisitorService(f.guest,600000,performance.now()),false);assert.equal(f.guest.serviceTime,.75);assert.equal(f.guest.indoorActor.action.t,.75);}finally{f.runtime.reset();}
});
for(const mode of ['ungranted','wrong-guest','wrong-building','wrong-duration','missing-ack'])test(mode+' visitor pose cannot complete a service lease',()=>{
 const f=fixture('pixel');try{
  if(mode==='ungranted')f.guest.serverTicket=null;
  if(mode==='wrong-guest')f.guest.serverTicket.guestId++;
  if(mode==='wrong-building')f.guest.serverTicket.buildingId++;
  if(mode==='wrong-duration')f.guest.serverTicket.duration=1;
  if(mode==='missing-ack')delete f.guest.serviceAcknowledgedAt;
  for(let i=0;i<40;i++)assert.equal(advanceAcceptedVisitorService(f.guest,.6,performance.now()),false);assert.equal(f.guest.serviceTime,0);assert.equal(f.calls.length,0);
 }finally{f.runtime.reset();}
});
