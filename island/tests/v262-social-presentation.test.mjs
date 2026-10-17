import test from 'node:test';
import assert from 'node:assert/strict';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs,relationship} from '../src/townSimulation.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';

async function fixture(theme,check){
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({error:'Isolated social presentation check; providers disabled'},{status:503});
 setWorldTheme(theme);
 try{
  const state=hydrateTown(createZeroState());state.day=5;state.economy.daySeconds=40;
  const npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true}));
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>({hour:19,cycles:0,season:'spring'})});
  for(const n of npcs){n.manualUntil=100000;Object.assign(needs(n.npcId,state),{energy:100,hunger:100,social:80,rations:2});}
  for(const id of [0,8])npcs[id].manualUntil=-1;
  npcs[0].think=0;npcs[8].think=100000;needs(0,state).social=10;
  relationship(state,0,8).tension=20;relationship(state,8,0).tension=20;
  let now=0;
  runtime.update(.1,now+=.1);
  await new Promise(resolve=>setImmediate(resolve));
  let meeting;
  for(let i=0;i<1600;i++){
   runtime.update(.05,now+=.05);
   meeting=[...runtime.meetings.values()].find(m=>m.ids.includes(0)&&m.ids.includes(8));
   if(meeting?.phase==='speaking')break;
   if(i%20===0)await new Promise(resolve=>setImmediate(resolve));
  }
  assert.equal(meeting?.phase,'speaking','The real runtime must actually meet and start its local dialogue before testing an unrelated pending receipt');
  assert.equal(meeting.source,'local');assert(meeting.lines.length>0);
  await check({state,npcs,runtime,meeting,now});
 }finally{globalThis.fetch=original;setWorldTheme('pixel');}
}

for(const theme of ['pixel','origami']){
 test(theme+' unrelated pending receipts keep an existing conversation visible without committing its outcome early',()=>fixture(theme,async({state,npcs,runtime,meeting,now})=>{
  const before=structuredClone(state),duration=meeting.lines.length*3.7;
  for(let i=0;i<Math.ceil((duration+5)*10);i++)runtime.advancePendingMeetings?.(.1);
  assert(meeting.clock>=duration,'Speech must reach its natural endpoint while an unrelated receipt is pending');
  assert(meeting.clock<=duration+.001,'Pending presentation must remain bounded');
  assert.deepEqual(state,before,'Pending presentation cannot create memories, relationships, cooldowns, resources or a completed conversation');
  assert.equal(runtime.meetings.size,1);assert.equal(state.npcConversations.length,0);
  for(const id of meeting.ids)assert.equal(npcs[id].action.t,meeting.clock);
  const last=meeting.lines.at(-1);assert.equal(npcs[last.speaker].speech,last.text);
  runtime.update(.05,now+.05);
  assert.equal(state.npcConversations.length,1);assert.equal(runtime.meetings.size,0);
  assert.equal(relationship(state,0,8).interactions,1);assert.equal(relationship(state,8,0).interactions,1);
  const completed=structuredClone(state.npcConversations);
  runtime.advancePendingMeetings?.(5);runtime.update(.05,now+.1);
  assert.deepEqual(state.npcConversations,completed,'The receipt reopening cannot duplicate the conversation outcome');
 }));
 test(theme+' clearing an old world cannot complete its previously speaking meeting',()=>fixture(theme,async({state,runtime,meeting})=>{
  runtime.advancePendingMeetings?.(.5);assert(meeting.clock<meeting.lines.length*3.7);
  runtime.reset();const before=structuredClone(state);
  runtime.advancePendingMeetings?.(1000);
  assert.equal(runtime.meetings.size,0);assert.deepEqual(state,before);assert.equal(state.npcConversations.length,0);
 }));
}
