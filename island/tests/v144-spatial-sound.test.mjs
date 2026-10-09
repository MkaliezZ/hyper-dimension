import test from 'node:test';import assert from 'node:assert/strict';
import {spatialSound,audibleResidents,residentStrokePeriod} from '../src/soundSpatial.js';
import {createWorldSound} from '../src/worldSound.js';import {soundForAction} from '../src/soundMixer.js';
function scene(){const events=[];let paused=false;const scope={play(kind,options){if(paused)return false;events.push({kind,...options});return true},tone(){},pause(){paused=true},resume(){paused=false},destroy(){paused=true},inspect(){return {paused}}};return {events,world:createWorldSound({createScope:()=>scope})};}
const listener={x:0,y:0};
test('distance attenuation is monotonic and bounded; screen-left and screen-right sources separate',()=>{
 const near=spatialSound({x:24,y:0},listener),middle=spatialSound({x:130,y:0},listener),far=spatialSound({x:260,y:0},listener);
 assert.equal(near.volume,1);assert(middle.volume>0&&middle.volume<near.volume);assert.equal(far.volume,0);assert(middle.pan>0);assert(spatialSound({x:-130,y:0},listener).pan<0);assert.equal(spatialSound({x:0,y:130},listener).pan,0);
 for(const p of [null,{x:NaN,y:0},{x:Infinity,y:0}])assert.equal(spatialSound(p,listener).volume,0);assert.equal(spatialSound(listener,listener,{radius:0}).volume,0);
});
test('only current-scene residents are audible, capped at four nearest actual actor positions',()=>{
 const residents=Array.from({length:8},(_,npcId)=>({npcId,x:(npcId+1)*20,y:0,inside:null}));residents.push({npcId:9,x:5,y:0,inside:2,indoorActor:{x:500,y:500}});
 assert.deepEqual(audibleResidents(residents,listener,'world',0).map(n=>n.id),[0,1,2,3]);
 assert.equal(audibleResidents(residents,{x:490,y:500},'workshop',3).length,0);const inRoom=audibleResidents(residents,{x:490,y:500},'workshop',2);assert.equal(inRoom.length,1);assert.equal(inRoom[0].actor.x,500);assert.equal(inRoom[0].id,9);assert.equal(audibleResidents(residents,listener,'mine',0).length,0);
});
test('resident tool contact follows the drawn 1.4-second stroke, once per contact and never from missed history',()=>{
 const {world,events}=scene(),action={type:'pickaxe',t:.4,duration:20},npc={npcId:3,x:100,y:0,action,inside:null};const tick=()=>world.tick(.05,{scene:'world',actor:listener,npcs:[npc]});
 tick();assert.equal(events.filter(e=>e.sourceId).length,0);action.t=.8;tick();tick();assert.equal(events.filter(e=>e.kind==='stone').length,1);
 action.t=2.2;tick();assert.equal(events.filter(e=>e.kind==='stone').length,2);world.tick(.05,{scene:'world',actor:listener,npcs:[npc],playing:false});action.t=10;tick();assert.equal(events.filter(e=>e.kind==='stone').length,2);
 npc.x=500;action.t=11;tick();npc.x=100;action.t=12;tick();assert.equal(events.filter(e=>e.kind==='stone').length,2);assert.equal(soundForAction('pickaxe'),'stone');
});
test('steps follow actual gait crossings and spoken lines, with no idle or listening chatter',()=>{
 const {world,events}=scene(),npc={npcId:2,x:-70,y:0,inside:null,walking:true,phase:.2};const tick=()=>world.tick(.05,{scene:'world',actor:listener,npcs:[npc]});tick();npc.phase=Math.PI+.1;tick();tick();assert.equal(events.filter(e=>e.sourceId&&e.kind==='footstep').length,1);assert(events.find(e=>e.sourceId).pan<0);
 npc.walking=false;npc.action={type:'talk',t:0,duration:10};npc.speech='一起去集市吧';tick();tick();assert.equal(events.filter(e=>e.kind==='talk').length,1);npc.speech='';npc.action.t=6;tick();assert.equal(events.filter(e=>e.kind==='talk').length,1);npc.speech='先把灯笼准备好';tick();assert.equal(events.filter(e=>e.kind==='talk').length,2);
});
test('crowds cannot exceed four emitting residents and switching rooms clears the previous sound contact',()=>{
 const {world,events}=scene(),npcs=Array.from({length:12},(_,npcId)=>({npcId,x:20+npcId*10,y:0,inside:null,walking:true,phase:0}));world.tick(.05,{actor:listener,npcs});for(const n of npcs)n.phase=4;world.tick(.05,{actor:listener,npcs});assert.equal(events.filter(e=>e.sourceId).length,4);assert.equal(world.inspect().nearbyCount,4);
 world.tick(.05,{scene:'workshop',building:2,actor:listener,npcs});assert.equal(world.inspect().nearbyCount,0);for(const n of npcs)n.phase=10;world.tick(.05,{actor:listener,npcs});assert.equal(events.filter(e=>e.sourceId).length,4);world.destroy();
});
test('leisure arranging uses its slower four-second visual stroke without replaying every work beat',()=>{
 assert.equal(residentStrokePeriod({type:'arrange',leisure:true,duration:20}),4);assert.equal(residentStrokePeriod({type:'arrange',duration:20}),1.4);assert.equal(residentStrokePeriod({type:'hoe',duration:2}),2);assert.equal(residentStrokePeriod({type:'hoe',duration:Infinity}),0);
 const {world,events}=scene(),action={type:'arrange',leisure:true,duration:20,t:.5},npc={npcId:1,x:20,y:0,inside:null,action};const tick=()=>world.tick(.05,{actor:listener,npcs:[npc]});tick();action.t=1;tick();assert.equal(events.filter(e=>e.sourceId).length,0);action.t=2.2;tick();assert.equal(events.filter(e=>e.kind==='ribbon').length,1);
});
