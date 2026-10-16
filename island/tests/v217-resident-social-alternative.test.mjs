import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,career,needs} from '../src/townSimulation.js';
import {residentSchedule} from '../src/residentSchedule.js';
import {RESIDENTS,setWorldTheme} from '../src/world.js';
import {followPath} from '../src/movement.js';
import {createSaveStore} from '../server/saveStore.mjs';

for(const theme of ['pixel','origami'])test(theme+' unavailable social partner yields a valid personal routine and an actual accepted resident lease',async()=>{
 setWorldTheme(theme);try{
  const state=hydrateTown(createZeroState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,path:[],phase:0,visible:true})),plan=residentSchedule(10,{hour:19,cycles:0}),environment={hour:plan.eventStart+.25,cycles:0,season:'spring'};
  assert(residentSchedule(10,environment).eventActive);assert.equal(residentSchedule(10,environment).working,false);
  const runtime=createResidentRuntime({npcs,getState:()=>state,profile:id=>RESIDENTS[id],followPath,onChange(){},onEvent(){},getEnvironment:()=>environment});
  for(const n of npcs){n.manualUntil=10000;n.think=1000;Object.assign(needs(n.npcId,state),{energy:90,hunger:90,social:70});career(n.npcId,state).socialAfter=-1;}
  const n=npcs[10];n.manualUntil=-1;n.think=0;needs(10,state).social=10;career(10,state).personalAfter=10000;
  const offered=runtime.person(10).options;assert(offered.length>0);assert(offered.every(o=>o.action==='social'),'Reproduce the social-only choice set while personal routines are cooling down');
  runtime.update(.1,.5);
  assert(n.intent?.goal,'An unavailable partner must not produce an empty purpose');assert.equal(n.intent.action,'visit');assert.match(n.intent.purposeId,/^life:/);assert.equal(n.meeting,null);assert(n.path.length>0);
  await mkdir('qa/v217',{recursive:true});const store=createSaveStore({directory:await mkdtemp(resolve('qa/v217/social-alternative-'))}),doc=(await store.open(theme,{legacyState:state,protect:true})).document;
  const accepted=await store.action(theme,{kind:'resident',operation:'begin',actorId:10,intent:n.intent,gameTime:.5,requestId:crypto.randomUUID(),expectedVersion:doc.version,expectedSequence:doc.actions.sequence,epoch:doc.actions.epoch});assert.equal(accepted.ticket.intent.action,'visit');assert.equal(accepted.ticket.intent.purposeId,n.intent.purposeId);assert.equal(accepted.receipt,null);
 }finally{setWorldTheme('pixel');}
});
