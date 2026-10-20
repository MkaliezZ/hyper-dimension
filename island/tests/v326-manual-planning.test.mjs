import test from 'node:test';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {RESIDENTS} from '../src/world.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {queueTask} from '../src/taskBoard.js';
async function fixture(run){
 const previous=globalThis.fetch,state=hydrateTown(createZeroState()),npcs=Array.from({length:16},(_,npcId)=>({npcId,path:[],visible:true})),calls=[],requests=[];
 state.freshStartPending=false;state.saveSlot='owned-manual-planning-world';
 const command={id:'known-task',npcId:5,goal:'forest',resource:'wood',quantity:1,intent:'先收一份木材'},response={source:'hermes',answer:'已提出分工',runId:'known-run',plans:[],commands:[command],parties:[],operations:[]};
 globalThis.fetch=async(path,options)=>{requests.push({path,body:options?.body?JSON.parse(options.body):null});return Response.json(String(path).includes('/requests/')?{request:{worldKey:state.saveSlot,status:'completed',result:response}}:response);};
 const runtime=createResidentRuntime({npcs,getState:()=>state,profile:i=>RESIDENTS[i],followPath(){},onChange(){},onEvent(){},getEnvironment:()=>null,planningRemote:async(...args)=>{calls.push(structuredClone(args));assert.equal(args[0],'batch');return{commands:args[1].commands.map(c=>({id:c.id,...queueTask(state,c,{targetItem:'wood'})})),planResults:[]};}});
 try{await run({runtime,state,npcs,calls,requests});}finally{runtime.reset();globalThis.fetch=previous;}
}
test('explicit steward chat passes local foreground metadata without changing model input or task identity',()=>fixture(async({runtime,state,calls,requests,npcs})=>{
 await runtime.steward('请先安排收一份木材');assert.deepEqual(calls[0][2],{foreground:true});assert.equal(calls[0][1].runId,'known-run');assert(!Object.hasOwn(calls[0][1],'foreground'));assert(!Object.hasOwn(requests[0].body,'foreground'));assert.equal(state.agentTaskLedger.length,1);assert.equal(npcs[5].assignment.id,'known-task');assert.equal(state.inventory.wood,0);assert.equal(state.coins,0);
}));
test('automatic steward patrol keeps FIFO metadata and creates no immediate reward',()=>fixture(async({runtime,state,calls,requests})=>{
 await runtime.steward();assert.equal(requests[0].path,'/api/hermes/plan');assert.deepEqual(calls[0][2],{foreground:false});assert.equal(state.agentTaskLedger[0].completed,0);assert.equal(state.inventory.wood,0);assert.equal(state.coins,0);
}));
test('known manual receipt recovery keeps foreground intent and original task identity on replay',()=>fixture(async({runtime,state,calls,requests})=>{
 await runtime.steward('登记一项分工');const first=structuredClone(state.agentTaskLedger[0]);await runtime.recoverSteward('known-command');
 assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c[2]),[{foreground:true},{foreground:true}]);assert.deepEqual(calls[0][1],calls[1][1]);assert.equal(state.agentTaskLedger.length,1);assert.deepEqual(state.agentTaskLedger[0],first);assert.equal(requests.filter(r=>r.path==='/api/hermes/command').length,1);assert.equal(requests.filter(r=>r.path.startsWith('/api/hermes/requests/')).length,1);assert.equal(state.inventory.wood,0);assert.equal(state.coins,0);
}));
