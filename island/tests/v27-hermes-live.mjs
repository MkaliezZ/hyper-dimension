import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createState,RESIDENTS,BUILDINGS} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createProject} from '../src/projectPlans.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
await mkdir('qa/v27',{recursive:true});const directory=await mkdtemp(resolve('qa/v27/hermes-live-'));
process.env.HD_HERMES_HOME=resolve(directory,'home');process.env.HD_STEWARD_WORKDIR=resolve(directory,'documents');
const {steward}=await import('../server/agentService.mjs');
const report={directory};
try{
 const data=await steward({day:1,built:BUILDINGS.map(b=>({...b,quality:45})),inventory:{},recipes:['recipe_lantern'],residents:[],projects:[],taskBoard:[],message:'请建立一份名为「码头迎宾灯」的共同筹备计划，最终需要灯笼 lantern 一盏。请先观察，再使用 island_prepare 建立计划。无需重复派发单独任务，不要操作本机文档。'});
 report.source=data.source;report.model=data.model;report.runId=data.runId;report.plans=data.plans;report.commands=data.commands?.length;report.error=data.errorCode;
 assert.equal(data.source,'hermes');assert.equal(data.model,'deepseek-flash');assert.equal(data.plans?.length,1);assert.match(data.runId,/^hd-island-/);assert.deepEqual(data.plans[0].targets,{lantern:1});assert.equal(data.commands.length,0);
 const s=hydrateTown(createState());for(const id of Object.keys(s.inventory))s.inventory[id]=0;
 const r=createProject(s,{...data.plans[0],runId:data.runId,source:'hermes'});assert(r.ok,r.reason);
 const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[],walkMix:0}));
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('{"error":"isolated after live planning"}',{status:503});
 try{
  const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
  for(const n of npcs)if(![1,5,11].includes(n.npcId))n.manualUntil=1e6;
  for(let i=1;i<=4500&&r.project.status!=='ready';i++)runtime.update(.2,i*.2);
  assert.equal(r.project.status,'ready');assert.equal(s.inventory.lantern,1);
  report.execution={status:r.project.status,inventory:{lantern:s.inventory.lantern,wood:s.inventory.wood,ore:s.inventory.ore},tasks:s.agentTaskLedger.map(t=>({item:t.targetItem,npcId:t.npcId,completed:t.completed,receipts:t.evidence.length,status:t.status})),sameRunId:r.project.runId===data.runId};report.passed=true;
 }finally{globalThis.fetch=original}
}catch(e){report.failure=e.stack;process.exitCode=1}finally{
 await writeFile('qa/v27/hermes-live-project.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exit(process.exitCode||0);
}
