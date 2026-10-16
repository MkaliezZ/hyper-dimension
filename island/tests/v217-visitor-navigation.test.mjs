import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisitorRuntime} from '../src/visitorRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {HARBOR,SLOTS,setWorldTheme,findPath,worldWalkable} from '../src/world.js';
import {followPath,followPendingPath} from '../src/movement.js';
import {advanceBoatMotion} from '../src/boatMotion.js';
for(const theme of ['pixel','origami'])test(theme+' visitor and ferry navigation use physical travel time without advancing service settlement',()=>{
 setWorldTheme(theme);try{
  const state=hydrateTown(createZeroState()),runtime=createVisitorRuntime({getState:()=>state,followPath,onChange(){},onEvent(){}});
  const walker={id:'fictional-walker',...SLOTS[0].entry,stage:'walking',arrivedAt:0,path:[],phase:0},service={id:'fictional-service',stage:'servicing',arrivedAt:0,path:[],x:-1000,y:-1000,serviceTime:0,indoorActor:{path:[],action:{type:'eat',t:0}}};walker.path=findPath(walker,SLOTS[23].entry,worldWalkable);assert(walker.path.length>0);
  const boat={id:'fictional-ferry',phase:'approaching',t:0,...HARBOR.sea},expectedWalker=structuredClone(walker),expectedBoat=structuredClone(boat);runtime.guests.push(walker,service);runtime.boats.push(boat);followPath(expectedWalker,.6,86);advanceBoatMotion(expectedBoat,.6,HARBOR);
  runtime.update(.15,.6,.6);assert.equal(walker.x,expectedWalker.x);assert.equal(walker.y,expectedWalker.y);assert.equal(boat.x,expectedBoat.x);assert.equal(boat.y,expectedBoat.y);assert.equal(service.serviceTime,.15);assert.equal(service.indoorActor.action.t,.15);
  const coins=state.coins;followPendingPath(expectedWalker,.6,86);advanceBoatMotion(expectedBoat,.6,HARBOR);runtime.animatePending(.15,.6);assert.equal(walker.x,expectedWalker.x);assert.equal(walker.y,expectedWalker.y);assert.equal(boat.x,expectedBoat.x);assert.equal(boat.y,expectedBoat.y);assert.equal(service.serviceTime,.15);assert.equal(state.coins,coins);
 }finally{setWorldTheme('pixel');}
});
