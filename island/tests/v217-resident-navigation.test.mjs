import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {RESIDENTS,SLOTS,setWorldTheme,findPath,worldWalkable,WORLD_CELL} from '../src/world.js';
import {followPath} from '../src/movement.js';
import {roomWalkable} from '../src/rooms.js';

for(const theme of ['pixel','origami'])for(const indoors of [false,true])test(theme+' '+(indoors?'indoor':'outdoor')+' residents use the visible navigation budget while needs and work keep protected time',()=>{
 setWorldTheme(theme);try{
  const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true}));
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:12,cycles:.5,season:'spring'})});
  for(const n of npcs){n.manualUntil=10000;n.think=1000;}const n=npcs[5];let actor=n;
  if(indoors){n.inside=0;n.indoorActor={x:500,y:585,path:[],phase:0};actor=n.indoorActor;actor.path=findPath(actor,{x:500,y:420},(x,y)=>roomWalkable(0,x,y),20);}
  else{Object.assign(n,SLOTS[0].entry);n.path=findPath(n,SLOTS[23].entry,worldWalkable,WORLD_CELL);}
  assert(actor.path.length>0,'Use an actual scene route');const expected=structuredClone(actor),start={x:actor.x,y:actor.y},before={...needs(5,state)};followPath(expected,.6,indoors?108:59);
  let completed=false;npcs[6].action={type:'observe',t:0,duration:20,onDone(){completed=true;}};
  runtime.update(.15,.6,.6);
  assert(Math.hypot(actor.x-start.x,actor.y-start.y)>.15*(indoors?108:59));assert.equal(actor.x,expected.x);assert.equal(actor.y,expected.y);assert.deepEqual(actor.path,expected.path);
  assert(Math.abs(needs(5,state).hunger-(before.hunger-.15*.12))<1e-8);assert.equal(npcs[6].action.t,.15);assert.equal(completed,false);
  const paused={x:actor.x,y:actor.y};runtime.update(0,.6,0);assert.deepEqual({x:actor.x,y:actor.y},paused);
 }finally{setWorldTheme('pixel');}
});
