import test from 'node:test';import assert from 'node:assert/strict';
import {outdoorSpot} from '../src/outdoorOccupancy.js';
import {setWorldTheme,worldWalkable,findPath,HARBOR} from '../src/world.js';
import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';
import{queueTask}from'../src/taskBoard.js';
import {createResidentRuntime}from'../src/residentRuntime.js';import{RESIDENTS}from'../src/world.js';import{followPath}from'../src/movement.js';
for(const theme of ['pixel','origami'])test(theme+' sixteen farm/forest/plaza occupants receive different reachable outdoor positions',()=>{
 setWorldTheme(theme);
 for(const base of [{x:435,y:700},{x:435,y:354},{x:780,y:465}]){
  const npcs=[];
  for(let npcId=0;npcId<16;npcId++){const p=outdoorSpot(base,npcId,npcs);assert(p,theme+' capacity '+npcId);assert(worldWalkable(p.x,p.y));assert(findPath(HARBOR.gate,p).length);assert(npcs.every(n=>Math.hypot(n.x-p.x,n.y-p.y)>=35));npcs.push({npcId,...p,path:[]});}
 }
});
test('approaching targets reserve their position and a saturated area waits instead of selecting an occupied fallback',()=>{
 setWorldTheme('pixel');const base={x:435,y:700},first=outdoorSpot(base,0,[]);
 const p=outdoorSpot(base,1,[{npcId:0,x:780,y:465,path:[first],target:first}]);assert(p);assert(Math.hypot(p.x-first.x,p.y-first.y)>=35);
 assert.equal(outdoorSpot(base,1,[{npcId:0,...first,path:[]}],{radius:0}),null);
 assert.deepEqual(outdoorSpot(base,0,[{npcId:0,...first,path:[]}],{radius:0}),first);
 assert.deepEqual(outdoorSpot(base,1,[{npcId:0,...first,path:[],inside:14}],{radius:0}),first);
});
test('crowded field runtime allocates distinct waiting/work stations while residents still complete farm life',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated occupancy QA"}',{status:503});
 try{for(const theme of ['pixel','origami']){
  setWorldTheme(theme);const s=hydrateTown(createZeroState());s.freshStartPending=false;s.inventory.seed=20;const npcs=RESIDENTS.map((r,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:id=>RESIDENTS[id],followPath,onChange:()=>{},onEvent:()=>{}});
  for(const n of npcs){n.manualUntil=1e6;if(n.npcId<12){n.manualUntil=0;assert(queueTask(s,{id:'field-crew-'+n.npcId,npcId:n.npcId,goal:'farm',resource:'wheat',quantity:2,intent:'照料田地'},{targetItem:'wheat'}).ok);n.think=0;}}
  runtime.update(.1,.1);const queued=npcs.filter(n=>n.target&&n.intent?.goal==='farm');
  assert(queued.length>=10,theme+' occupied farm '+queued.length);
  for(let i=0;i<queued.length;i++)for(let j=i+1;j<queued.length;j++)assert(Math.hypot(queued[i].target.x-queued[j].target.x,queued[i].target.y-queued[j].target.y)>=35);
  for(let i=1;i<=1200;i++)runtime.update(.1,i*.1);
  assert(s.plots.some(p=>p.stage>0));assert(Object.values(s.npcCareers).some(c=>c.completed>0));
 }}finally{globalThis.fetch=original;}
});
