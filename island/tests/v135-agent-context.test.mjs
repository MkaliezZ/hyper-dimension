import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createState,RESIDENTS} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createResidentRuntime} from '../src/residentRuntime.js';
import {followPath} from '../src/movement.js';
import {chatHistory} from '../src/stewardChat.js';
import {readJsonBody,MANUAL_STEWARD_BODY_BYTES} from '../server/httpBody.mjs';

test('a mature island and long Chinese chat fit the manual command transport without deleting local history',async()=>{
 const s=hydrateTown(createState());
 for(let i=0;i<15;i++)s.npcMemory[i]=Array.from({length:16},(_,n)=>({day:n+1,text:'真实工作与生活的完整回忆。'.repeat(50)}));
 s.stewardChat={messages:Array.from({length:12},(_,n)=>({role:n%2?'assistant':'user',status:n%2?'done':'sent',text:'这是一段已经保存的中文工作对话。'.repeat(1200)}))};
 const histories=chatHistory(s);assert.equal(histories.length,12);assert(histories.every(m=>m.content.length===1400));
 const before=structuredClone(s.npcMemory),chatBefore=structuredClone(s.stewardChat);let bytes;
 const previous=globalThis.fetch;
 globalThis.fetch=async(route,options)=>{assert.equal(route,'/api/hermes/command');bytes=Buffer.from(options.body);return new Response(JSON.stringify({commands:[],source:'hermes',answer:'Transport-only fixture'}),{status:200})};
 const npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[]}));
 const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
 try{
  await runtime.steward('请整理本机工作资料',false,histories);
  assert(bytes.length>90000,'The fixture reproduces the old transport rejection');
  assert(bytes.length<MANUAL_STEWARD_BODY_BYTES);
  await assert.rejects(readJsonBody(Readable.from([bytes]),90000),e=>e.code==='body_too_large');
  const payload=await readJsonBody(Readable.from([bytes]),MANUAL_STEWARD_BODY_BYTES);
  assert.equal(payload.residents.length,15);assert(payload.residents.every(r=>r.memories.length===5&&r.memories.every(m=>m.length===130)));
  assert.equal(payload.partyTemplates.fireworks.template,'fireworks');assert.equal(payload.history.length,12);
  assert.deepEqual(s.npcMemory,before);assert.deepEqual(s.stewardChat,chatBefore);
  await assert.rejects(readJsonBody(Readable.from([Buffer.alloc(MANUAL_STEWARD_BODY_BYTES+1)]),MANUAL_STEWARD_BODY_BYTES),e=>e.status===413);
 }finally{runtime.reset();globalThis.fetch=previous}
});
