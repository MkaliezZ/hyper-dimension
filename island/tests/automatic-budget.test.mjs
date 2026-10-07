import test from 'node:test';
import assert from 'node:assert/strict';
import {createAutomaticBudget,AUTO_INTERVALS} from '../server/automaticBudget.mjs';
import {createState,RESIDENTS} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {followPath} from '../src/movement.js';
import {queueTask} from '../src/taskBoard.js';
import {createResidentRuntime} from '../src/residentRuntime.js';

test('simultaneous tabs share one automatic reservation and cannot bypass it on reload',async()=>{
 let now=1000;const b=createAutomaticBudget(()=>now);
 const results=await Promise.allSettled(Array.from({length:8},()=>Promise.resolve().then(()=>b.reserve('plans'))));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(b.snapshot().plans.accepted,1);assert.equal(b.snapshot().plans.limited,7);
 assert.throws(()=>b.reserve('plans'),e=>e.code==='automatic_cooldown'&&e.retryAfter===300);
 now+=299001;assert.throws(()=>b.reserve('plans'),e=>e.retryAfter===1);
 now+=999;b.reserve('plans');assert.equal(b.snapshot().plans.accepted,2);
 b.reserve('conversations');b.reserve('steward'); // Independent automatic channels.
 assert.equal(b.snapshot().conversations.intervalSeconds,600);
 assert.equal(b.snapshot().steward.intervalSeconds,950);
});

test('one-hour automatic budget is capped at 12 plans, 6 conversations and 4 steward patrols',()=>{
 let now=0;const b=createAutomaticBudget(()=>now);
 for(now=0;now<3600000;now+=1000)for(const key of Object.keys(AUTO_INTERVALS)){
  try{b.reserve(key)}catch(e){assert.equal(e.code,'automatic_cooldown')}
 }
 assert.deepEqual(Object.fromEntries(Object.entries(b.snapshot()).map(([k,v])=>[k,v.accepted])),{plans:12,conversations:6,steward:4});
});

test('theme resets keep automatic deadlines; direct butler commands remain immediate',async()=>{
 const original=globalThis.fetch,requests=[];
 globalThis.fetch=async(route)=>{requests.push(route);return new Response(JSON.stringify(route.includes('/npc/')?{decisions:[],source:'deepseek'}:{commands:[],source:'hermes',answer:'本地测试回复'}),{status:200})};
 const s=hydrateTown(createState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[]}));
 const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
 try{
  runtime.update(.2,4);await new Promise(r=>setImmediate(r));
  assert.equal(requests.filter(r=>r==='/api/npc/tick').length,1);
  assert.equal(requests.filter(r=>r==='/api/hermes/plan').length,1);
  runtime.reset();runtime.update(.2,100);await new Promise(r=>setImmediate(r));
  assert.equal(requests.filter(r=>r==='/api/npc/tick').length,1);
  assert.equal(requests.filter(r=>r==='/api/hermes/plan').length,1);
  await runtime.steward('帮我查看库存');
  assert.equal(requests.filter(r=>r==='/api/hermes/command').length,1);
  runtime.update(.2,304);await new Promise(r=>setImmediate(r));
  assert.equal(requests.filter(r=>r==='/api/npc/tick').length,2);
  assert.equal(requests.filter(r=>r==='/api/hermes/plan').length,1);
 }finally{runtime.reset();globalThis.fetch=original}
});


test('urgent food collection takes priority over a queued job without extra model requests',async()=>{
 const original=globalThis.fetch,requests=[];
 globalThis.fetch=async(route)=>{requests.push(route);return new Response(JSON.stringify({decisions:[],commands:[],source:'local'}),{status:200})};
 const s=hydrateTown(createState()),npcs=RESIDENTS.map((_,npcId)=>({npcId,x:780,y:465,path:[]}));
 const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
 try{
  runtime.update(.2,4);await new Promise(r=>setImmediate(r));const before=requests.length;
  for(const key of Object.keys(s.inventory))s.inventory[key]=0;
  s.npcNeeds[0].hunger=12;s.npcNeeds[0].energy=70;s.npcNeeds[0].rations=0;
  const job={id:'test-job',npcId:0,goal:'forest',resource:'wood',intent:'准备木材',quantity:2};
  assert(queueTask(s,job,{targetItem:'wood'}).ok);
  npcs[0].path=[];npcs[0].action=null;npcs[0].after=null;npcs[0].inside=null;npcs[0].meeting=null;npcs[0].think=20;
  runtime.update(.2,5);await new Promise(r=>setImmediate(r));
  assert.equal(npcs[0].intent.purposeId,'need:food-supply');
  assert.equal(npcs[0].intent.resource,'mushroom');assert.ok(npcs[0].assignment);
  assert.equal(s.agentTaskLedger.find(t=>t.id==='test-job').status,'queued');
  assert.equal(requests.length,before);
 }finally{runtime.reset();globalThis.fetch=original}
});
