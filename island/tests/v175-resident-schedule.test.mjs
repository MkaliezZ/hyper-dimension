import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {residentSchedule,RESIDENT_SHIFTS,scheduledOptions} from '../src/residentSchedule.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {RESIDENTS,setWorldTheme,findWorldPathForTheme,worldWalkableForTheme,worldSlots} from '../src/world.js';
import {PERMANENT_HOMES,ISLAND_GEOGRAPHY} from '../src/islandGeography.js';
import {followPath} from '../src/movement.js';
import {queueTask} from '../src/taskBoard.js';
import {advanceResidents,publicPerson,prepareMeeting} from '../server/lanRoomResidents.mjs';

const env=hour=>({hour,cycles:5+hour/24,season:'spring'});
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(theme,{getEnvironment,residentRemote=null}={}){
 setWorldTheme(theme);const state=hydrateTown(createZeroState()),npcs=Array.from({length:16},(_,npcId)=>({npcId,path:[],phase:0,visible:true}));
 for(let i=0;i<16;i++)state.npcNeeds[i]={energy:75,hunger:100,social:100,rations:2,mood:'平静'};
 const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment,residentRemote});
 return {state,npcs,runtime};
}
async function isolate(fn){const prior=globalThis.fetch,calls=[];globalThis.fetch=async(route,opts)=>{calls.push({route,body:JSON.parse(opts?.body||'{}')});return new Response(JSON.stringify(route==='/api/npc/tick'?{decisions:[],source:'deepseek'}:{commands:[],source:'hermes',answer:'隔离测试回复'}),{status:200});};try{return await fn(calls);}finally{globalThis.fetch=prior;setWorldTheme('pixel');}}
async function evidence(name,value){if(process.env.HD_NPC_QA_DIR){await mkdir(process.env.HD_NPC_QA_DIR,{recursive:true});await writeFile(join(process.env.HD_NPC_QA_DIR,name+'.json'),JSON.stringify(value,null,2)+'\n');}}

test('all 16 permanent residents have fixed shifts, private homes and stable varied daily free-time windows',()=>{
 assert.equal(RESIDENT_SHIFTS.length,16);const starts=[];
 for(const shift of RESIDENT_SHIFTS){const at=residentSchedule(shift.id,env(12));assert.equal(at.home.ownerId,shift.id);assert(at.eventStart>=shift.end);assert(at.eventEnd<shift.sleep);assert.deepEqual(at,residentSchedule(shift.id,env(12)));starts.push(at.eventStart);assert.notEqual(at.eventStart,residentSchedule(shift.id,{hour:12,cycles:6.5}).eventStart);assert(residentSchedule(shift.id,env(0)).sleeping);assert(residentSchedule(shift.id,env((shift.start+shift.end)/2)).working);}
 assert(new Set(starts).size>12);assert.equal(residentSchedule(16,env(0)),null,'temporary visitor retains their recruitment contract');
 const rows=[{action:'work',purposeId:'career:0'},{action:'visit',purposeId:'life:read'},{action:'social',purposeId:'relationship:1'},{action:'eat',purposeId:'need:food'}];
 assert.deepEqual(scheduledOptions(rows,residentSchedule(0,env(9))).map(x=>x.action),['work','eat']);
 assert.deepEqual(scheduledOptions(rows,residentSchedule(0,env(21))).map(x=>x.action),['visit','eat']);
 assert.deepEqual(scheduledOptions(rows,residentSchedule(0,env(0))),[]);
});

for(const theme of ['pixel','origami'])test(theme+' all 16 residents really walk home, sleep, preserve queued work and wake without extra model calls',async()=>isolate(async calls=>{
 let hour=0;const f=fixture(theme,{getEnvironment:()=>env(hour)}),{state,npcs,runtime}=f;
 assert(queueTask(state,{id:'morning-wood',npcId:0,goal:'forest',resource:'wood',intent:'明早准备木材',quantity:2},{targetItem:'wood'}).ok);
 const before={inventory:{...state.inventory},coins:state.coins},travelled=Array(16).fill(0),arrivals={};
 for(let i=1;i<=1800;i++){const previous=npcs.map(n=>({x:n.x,y:n.y}));runtime.update(.1,i/10);for(const [id,n]of npcs.entries()){const distance=Math.hypot(n.x-previous[id].x,n.y-previous[id].y);travelled[id]+=distance;assert(distance<=6.01,theme+' '+id+' must follow its route without teleporting');assert(worldWalkableForTheme(theme,n.x,n.y),theme+' '+id+' stays on land');if(n.homeRest&&arrivals[id]===undefined)arrivals[id]=i/10;}if(i%20===0)await tick();}
 for(const [id,n]of npcs.entries()){assert(n.homeRest,theme+' '+id+' reaches home');assert.equal(n.inside,PERMANENT_HOMES.find(h=>h.ownerId===id).id);assert(Math.hypot(n.x-PERMANENT_HOMES[id].entry.x,n.y-PERMANENT_HOMES[id].entry.y)<24);assert(travelled[id]>10);assert.equal(n.action,null);}
 assert.equal(state.agentTaskLedger.find(t=>t.id==='morning-wood').status,'queued');assert.deepEqual(state.inventory,before.inventory);assert.equal(state.coins,before.coins);
 assert.equal(calls.filter(c=>c.route==='/api/npc/tick').length,1);assert.equal(calls.filter(c=>c.route==='/api/hermes/plan').length,1);
 await runtime.steward('隔离测试：请回答一句问候');assert.equal(calls.filter(c=>c.route==='/api/hermes/command').length,1,'sleep never disables Hermes real-work entry');
 const slept=npcs.map(n=>({id:n.npcId,home:n.inside,x:n.x,y:n.y,walked:travelled[n.npcId],arrivalSeconds:arrivals[n.npcId],energy:state.npcNeeds[n.npcId].energy}));hour=9;
 runtime.update(.1,180.1);assert(npcs.every(n=>!n.homeRest));assert(npcs[0].path.length,'assigned farmer starts the preserved morning work');assert(npcs[15].path.length,'butler physical character wakes too');
 await evidence(theme+'-resident-night',{theme,slept,queuedWorkPreserved:true,wakeHour:hour,automaticCalls:calls.filter(c=>c.route!=='/api/hermes/command').map(c=>c.route),manualHermesWhileSleeping:true});
}));

for(const theme of ['pixel','origami'])test(theme+' LAN residents use the same clock and walk home before disappearing from map projection',async()=>{
 setWorldTheme(theme);const slots=worldSlots(theme),r={owner:'host',theme,members:{host:{...ISLAND_GEOGRAPHY.spawn,lastSeen:1000}},residents:Array.from({length:15},(_,id)=>({person:{actorId:'resident-'+id,npcId:id,kind:'ai',ownerAccountId:'host',job:'隔离测试'},...slots[id].entry,path:[],updatedAt:1000,visitAt:0,visitIndex:0}))};
 const route=(t,start,end,avoid=[])=>{const path=findWorldPathForTheme(t,start,end,avoid);if(!path.length&&Math.hypot(start.x-end.x,start.y-end.y)>18)throw Error('unreachable');return path;};
 for(let i=1;i<=900;i++){const at=1000+i*200;r.members.host.lastSeen=at;advanceResidents(r,at,route,env(0));}
 for(const c of r.residents){assert(c.homeRest,theme+' '+c.person.npcId);assert.equal(publicPerson(c).position.indoors,PERMANENT_HOMES[c.person.npcId].id);assert(!c.walking);}
 assert.throws(()=>prepareMeeting(r,['resident-0','resident-1'],'sleep-meeting',181000,route),/休息/);
 r.members.host.lastSeen=181200;advanceResidents(r,181200,route,env(9));assert(r.residents.every(c=>!c.homeRest));assert(r.residents.filter(c=>c.schedulePeriod==='work').every(c=>c.activity.includes('固定工作时段')));
 await evidence(theme+'-lan-night',{theme,residents:r.residents.map(c=>({id:c.person.npcId,home:c.homeId,awake:!c.homeRest,period:c.schedulePeriod,activity:c.activity})),sleepProjectionConfirmed:true});setWorldTheme('pixel');
});

test('an accepted resident lease finishes exactly once before bedtime, with no cancellation or fabricated reward',async()=>isolate(async()=>{
 let hour=9,finishes=0,cancels=0;const remote={begin:async n=>({kind:'resident',requestId:'night-handover',actorId:n.npcId,action:'axe',duration:20,operationId:'night-finish'}),finish:async()=>{finishes++;return {receipt:{text:'已确认材料入库'}};},cancel:async()=>{cancels++;}};
 const {state,npcs,runtime}=fixture('pixel',{getEnvironment:()=>env(hour),residentRemote:remote});for(let i=1;i<16;i++)npcs[i].manualUntil=10000;
 assert(queueTask(state,{id:'finish-before-bed',npcId:0,goal:'forest',resource:'wood',intent:'晚间收尾',quantity:2},{targetItem:'wood'}).ok);
 let time=0;for(let i=0;i<1500&&!npcs[0].action;i++){time+=.1;runtime.update(.1,time);if(i%10===0)await tick();}assert(npcs[0].action);
 hour=0;for(let i=0;i<1800&&!npcs[0].homeRest;i++){time+=.1;runtime.update(.1,time);if(i%10===0)await tick();}
 assert(npcs[0].homeRest);assert.equal(finishes,1);assert.equal(cancels,0);assert.equal(state.inventory.wood,0,'client must not mint goods already owned by server receipt');
}));

test('autonomous sowing chooses an in-season crop without replacing a named out-of-season assignment',async()=>isolate(async()=>{
 const starts=[];const remote={occupied:()=>false,begin:async(n,d,type)=>{starts.push({id:n.npcId,resource:d.resource,type,index:d.farmIndex});return null;},cancel:async()=>{}};
 const state=hydrateTown(createZeroState());state.inventory.seed=10;for(const p of state.plots){p.stage=3;p.crop='strawberry';}state.plots[1].stage=1;
 for(let i=0;i<16;i++)state.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2};
 const npcs=Array.from({length:16},(_,npcId)=>({npcId,path:[],phase:0})),runtime=createResidentRuntime({npcs,getState:()=>state,profile:i=>RESIDENTS[i],followPath,onChange(){},onEvent(){},farmRemote:remote,getEnvironment:()=>({...env(9),season:'autumn'})});for(let i=1;i<16;i++)npcs[i].manualUntil=10000;
 for(let i=1;i<600&&!starts.length;i++){runtime.update(.1,i/10);if(i%10===0)await tick();}
 assert.equal(starts.length,1);assert.equal(starts[0].type,'sow');assert.equal(starts[0].resource,'wheat');
 runtime.reset();starts.length=0;state.plots[1].crop='strawberry';for(let i=1;i<16;i++)npcs[i].manualUntil=10000;
 assert(queueTask(state,{id:'spring-strawberry',npcId:0,goal:'farm',resource:'strawberry',intent:'等待春季种草莓',quantity:1},{targetItem:'strawberry'}).ok);
 for(let i=601;i<1200;i++){runtime.update(.1,i/10);if(i%10===0)await tick();}assert.equal(starts.length,0);assert.equal(state.agentTaskLedger.find(t=>t.id==='spring-strawberry').status,'queued');
 state.plots[1].stage=4;for(let i=1200;i<1800&&!starts.length;i++){runtime.update(.1,i/10);if(i%10===0)await tick();}assert.equal(starts.length,1);assert.equal(starts[0].type,'harvest','existing out-of-season crops may still be harvested');assert.equal(starts[0].resource,'strawberry');
}));
