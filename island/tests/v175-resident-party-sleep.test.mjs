import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createNightPartyRuntime,nightPartyArrived} from '../src/nightPartyRuntime.js';
import {createFestivalRuntime} from '../src/festivalRuntime.js';
import {createCoutureRuntime} from '../src/coutureRuntime.js';
import {createFireworksRuntime} from '../src/fireworksRuntime.js';
import {createFishingPartyRuntime} from '../src/fishingPartyRuntime.js';
import {createFestivalLayout} from '../src/festivalLayout.js';
import {createCoutureGame} from '../src/coutureRules.js';
import {createMarketGame} from '../src/marketRules.js';
import {createFireworksGame} from '../src/fireworksRules.js';
import {eventRequests} from '../src/partyPlanning.js';
import {residentActivityBlocked} from '../src/residentActivityControl.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {RESIDENTS,setWorldTheme,worldWalkableForTheme} from '../src/world.js';
import {PERMANENT_HOMES} from '../src/islandGeography.js';
import {followPath} from '../src/movement.js';

const atNight=()=>({hour:0,cycles:5,season:'spring'});
async function isolated(fn){const prior=globalThis.fetch;globalThis.fetch=async()=>new Response('{"decisions":[],"commands":[],"source":"local"}');try{await fn();}finally{globalThis.fetch=prior;setWorldTheme('pixel');}}
function createFixture(theme){
 setWorldTheme(theme);const state=hydrateTown(createZeroState()),npcs=Array.from({length:16},(_,npcId)=>({npcId,path:[],phase:0,visible:true}));
 for(let i=0;i<16;i++)state.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2};
 const cancellations=[],resident=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:atNight,residentRemote:{cancel:async t=>cancellations.push(t.requestId)}});let time=0;
 return {theme,state,npcs,resident,cancellations,now:()=>time,step(activity=null){time+=.1;activity?.update(.1);resident.update(.1,time);},sleep(){for(let i=0;i<1800;i++)this.step();assert(npcs.every(n=>n.homeRest));}};
}
function acceptedActivity(f,kind){
 const {state,npcs,resident,theme}=f,layout=createFestivalLayout(state,theme,3),id='invited-'+kind,base={state:()=>state,npcs,resident:()=>resident,followPath,occupied:()=>false,now:f.now,player:()=>layout.player,game:()=>null,onChange(){}};
 if(kind==='night'){state.partyControl={version:1};state.partySession={id,participants:[0,2]};return {runtime:createNightPartyRuntime(base),ids:[0,2],ready:()=>nightPartyArrived(state),end:()=>{state.partySession=null;}};}
 if(kind==='fishing'){state.fishingControl={version:1};state.fishingParty={session:{id,phase:'checkin',participants:[{id:8},{id:2}],match:{phase:'setup',elapsed:0}}};return {runtime:createFishingPartyRuntime(base),ids:[8,2],end:()=>{state.fishingParty.session=null;}};}
 const field={market:'festivalParty',couture:'coutureParty',fireworks:'fireworksParty'}[kind],participants=eventRequests({template:kind,guestId:null}).map(p=>({id:p.id,role:p.role,model:!!p.model}));
 const game=kind==='market'?createMarketGame(175,'easy',participants.map(p=>p.id)):kind==='couture'?createCoutureGame(175,'easy'):createFireworksGame(175,'easy');
 state[field]={session:{id,phase:'running',layout,participants,game}};
 return {runtime:({market:createFestivalRuntime,couture:createCoutureRuntime,fireworks:createFireworksRuntime})[kind](base),ids:participants.map(p=>p.id),end:()=>{state[field].session=null;}};
}
async function evidence(name,value){if(process.env.HD_NPC_QA_DIR){await mkdir(process.env.HD_NPC_QA_DIR,{recursive:true});await writeFile(join(process.env.HD_NPC_QA_DIR,name+'.json'),JSON.stringify(value,null,2)+'\n');}}

for(const theme of ['pixel','origami'])test(theme+' invited sleepers walk from their own doors to the night party and return home afterwards',async()=>isolated(async()=>{
 const f=createFixture(theme);f.sleep();const {state,npcs}=f,initial=npcs.map(n=>({x:n.x,y:n.y})),before={inventory:{...state.inventory},coins:state.coins},party=acceptedActivity(f,'night'),travelled={0:0,2:0};
 for(let i=0;i<1800&&!party.ready();i++){const old=npcs.map(n=>({x:n.x,y:n.y}));f.step(party.runtime);for(const id of party.ids){const n=npcs[id],delta=Math.hypot(n.x-old[id].x,n.y-old[id].y);assert(delta<=6.51,'a party invitation cannot teleport a sleeping resident');assert(worldWalkableForTheme(theme,n.x,n.y));travelled[id]+=delta;}}
 assert(party.ready(),'accepted night-party guests must really sign in');for(const id of party.ids){assert(npcs[id].partyControlled);assert(!npcs[id].homeRest);assert(travelled[id]>100);}
 const attendance=structuredClone(state.nightAttendance);
 for(let id=0;id<16;id++)if(!party.ids.includes(id)){assert(npcs[id].homeRest);assert.equal(npcs[id].x,initial[id].x);assert.equal(npcs[id].y,initial[id].y);}
 party.end();for(let i=0;i<1800&&!party.ids.every(id=>npcs[id].homeRest);i++)f.step(party.runtime);
 for(const id of party.ids){assert(npcs[id].homeRest);assert(!npcs[id].partyControlled);assert.equal(npcs[id].inside,PERMANENT_HOMES[id].id);}
 assert.deepEqual(state.inventory,before.inventory);assert.equal(state.coins,before.coins);assert.deepEqual(f.cancellations,[]);
 await evidence(theme+'-night-party-wake',{theme,attendance,travelled,returned:party.ids.map(id=>({id,home:npcs[id].inside})),uninvitedStillSleeping:true,productionCancelled:0});
}));

for(const kind of ['night','fishing','market','couture','fireworks'])test(kind+' takeover wakes only its event roster and waits for in-flight accepted work',async()=>isolated(async()=>{
 const f=createFixture('pixel');f.sleep();const a=acceptedActivity(f,kind),id=a.ids[0],n=f.npcs[id],home={x:n.x,y:n.y};
 n.intent={starting:true};a.runtime.update(.1);assert(!n.partyControlled,'pending begin cannot be dropped to join an event');assert(n.homeRest);assert.deepEqual({x:n.x,y:n.y},home);
 n.intent={serverResidentTicket:{requestId:'accepted-work'},serverResidentFinished:false};a.runtime.update(.1);assert(!n.partyControlled,'pending authoritative finish cannot be dropped');assert.deepEqual(f.cancellations,[]);
 n.intent.serverResidentFinished=true;a.runtime.update(.1);assert(n.partyControlled);assert(!n.homeRest);assert.equal(n.inside,null);assert(Math.hypot(n.x-home.x,n.y-home.y)<=6.51);assert.deepEqual(f.cancellations,[]);
 for(let other=0;other<16;other++)if(!a.ids.includes(other))assert(f.npcs[other].homeRest,'uninvited '+other+' stays asleep');
 a.end();for(let i=0;i<1800&&!a.ids.every(id=>f.npcs[id].homeRest);i++)f.step(a.runtime);for(const id of a.ids)assert(f.npcs[id].homeRest,kind+' '+id+' returns home');
}));

test('activity guard distinguishes sleep, active room work, start requests and unconfirmed field receipts',()=>{
 const n={npcId:0,inside:'home:0',homeRest:true};assert.equal(residentActivityBlocked(n),false);assert(residentActivityBlocked({...n,action:{type:'work'}}));assert(residentActivityBlocked({...n,meeting:1}));assert(residentActivityBlocked({...n,partyControlled:true}),'another activity retains its participant');assert(residentActivityBlocked({...n,homeRest:false}));assert(residentActivityBlocked(n,()=>true));
 for(const kind of ['Resident','Farm','Field']){const intent={['server'+kind+'Ticket']:{requestId:'pending'}};assert(residentActivityBlocked({...n,intent}));intent['server'+kind+'Finished']=true;assert.equal(residentActivityBlocked({...n,intent}),false);}
});
