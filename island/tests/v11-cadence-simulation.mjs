import assert from 'node:assert/strict';
import {ECONOMY_RULES} from '../src/economy.js';
import {writeFile} from 'node:fs/promises';import {createState,RESIDENTS,setWorldTheme} from '../src/world.js';import {hydrateTown} from '../src/townSimulation.js';import {tickCrops} from '../src/farming.js';import {followPath} from '../src/movement.js';import {createResidentRuntime} from '../src/residentRuntime.js';import {groundedConversation} from '../src/conversationFallback.js';
const reports=[];
for(const theme of ['pixel','origami']){
 setWorldTheme(theme);const s=hydrateTown(createState()),npcs=RESIDENTS.map((r,i)=>({npcId:i,x:780,y:465,face:1,phase:0,path:[],walkMix:0})),counts={plans:0,conversations:0,steward:0};let now=0;
 globalThis.fetch=async(route,request)=>{const body=JSON.parse(request.body);let data;
 if(route==='/api/npc/tick'){counts.plans++;data={source:'deepseek',decisions:body.residents.map(r=>({...r.options[0],id:r.id,source:'deepseek'}))};}
 else if(route==='/api/npc/interact'){counts.conversations++;data={...groundedConversation(body.residents.map(r=>r.id),s,i=>RESIDENTS[i],body.socialType,now),source:'deepseek'};}
 else {counts.steward++;data={answer:'isolated cadence test',commands:[],source:'hermes'};}
 return new Response(JSON.stringify(data),{status:200});};
 const runtime=createResidentRuntime({npcs,getState:()=>s,profile:i=>RESIDENTS[i],followPath,onChange:()=>{},onEvent:()=>{}});
 for(let step=1;step<=18000;step++){now=step*.2;s.day=1+Math.floor(now/ECONOMY_RULES.daySeconds);runtime.update(.2,now);tickCrops(s,.2);for(const n of s.oreNodes)if(n.hp===0&&(n.regen-=.2)<=0)n.hp=3;if(step%20===0)await new Promise(r=>setImmediate(r));}
 const r={theme,seconds:3600,calls:counts,total:counts.plans+counts.conversations+counts.steward,behaviors:Object.values(s.npcCareers).reduce((v,c)=>v+c.completed,0),source:'healthy provider responses simulated locally; no external model calls'};assert.ok(r.total<=23,JSON.stringify(r));assert.equal(counts.plans,12);assert.equal(counts.steward,4);assert.ok(counts.conversations<=6);assert.ok(r.behaviors>100);assert.ok(Object.values(s.inventory).every(n=>n>=0));assert.ok(Object.values(s.npcNeeds).every(n=>n.energy>0&&n.hunger>0),JSON.stringify({r,failed:npcs.filter(n=>s.npcNeeds[n.npcId].energy<=0||s.npcNeeds[n.npcId].hunger<=0).map(n=>({id:n.npcId,needs:s.npcNeeds[n.npcId],status:n.status,intent:n.intent,inside:n.inside,roomQueued:n.roomQueued,think:n.think,action:n.action&&{type:n.action.type,t:n.action.t,duration:n.action.duration},path:n.path.length,indoorPath:n.indoorActor?.path.length,meeting:n.meeting,career:s.npcCareers[n.npcId],pos:{x:n.x,y:n.y}}))}));reports.push(r);console.log(JSON.stringify(r));runtime.reset();
}await writeFile('qa/v14-cadence-after.json',JSON.stringify(reports,null,2));
