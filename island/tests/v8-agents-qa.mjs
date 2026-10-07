import {BUILDINGS,RESIDENTS,createState} from '../src/world.js';import {hydrateTown,purposeOptions,needs,CAREERS} from '../src/townSimulation.js';import {ALL_RECIPES} from '../src/contentCatalog.js';import assert from 'node:assert/strict';
const s=hydrateTown(createState()),residents=RESIDENTS.slice(0,15).map((r,id)=>({...r,id,needs:needs(id,s),career:{title:CAREERS[id].title},options:purposeOptions(id,s,r,0),assignment:null,availableForConversation:true})),world={built:BUILDINGS.map(b=>({...b,quality:60})),inventory:s.inventory,day:1,events:[],tasks:s.tasks,recipes:ALL_RECIPES.filter(r=>r.tier===0).map(r=>r.id),residents};
const runs=await Promise.all([4173,4174].map(async port=>{
 const base='http://127.0.0.1:'+port,post=async(path,body)=>{const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(95000)});const json=await res.json();assert.equal(res.status,200,JSON.stringify(json));return json};
 const decision=await post('/api/npc/tick',world);assert.equal(decision.source,'deepseek');assert.ok(decision.decisions.length);
 const steward=await post('/api/hermes/command',{...world,message:'这是岛内调度验证。请先观察，只用 island_dispatch 给管家自己 npcId15 安排一次林地采集蜂蜡，goal=forest，resource=wax，intent为采集蜂蜡。不要给其他居民派任务，不安排其他工作。执行仅代表排队，不可说已经获得蜂蜡。'});
 assert.equal(steward.source,'hermes');assert.ok(steward.tools.includes('island_observe'));assert.ok(steward.commands.some(c=>c.npcId===15&&c.resource==='wax'&&c.goal==='forest'));
 return {port,deepseekDecisions:decision.decisions.length,hermesSource:steward.source,resource:steward.commands.find(c=>c.npcId===15)?.resource};
}));console.log(JSON.stringify(runs));


