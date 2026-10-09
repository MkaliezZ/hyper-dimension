
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeWorkshopLevel,createWorkshopState,workshopAction as act,stepWorkshop as step,outfitScore,coutureBrief,formatWorkshopTime} from '../src/workshopRules.js';
import {WORKSHOP_PROP_FRAMES} from '../src/workshopProps.js';
const advance=(s,seconds)=>{for(let n=0;n<Math.ceil(seconds/.05);n++)step(s,.05)};
test('clock never prints a 60-second remainder or negative countdown',()=>{
 for(const [time,label] of [[0,'0:00'],[.01,'0:01'],[59.9,'1:00'],[60,'1:00'],[60.01,'1:01'],[119.9,'2:00'],[-2,'0:00'],[Infinity,'0:00']])assert.equal(formatWorkshopTime(time),label);
});
test('fashion briefs, correct slots, invalid submissions and replacements remain consistent',()=>{
 const themes=new Set();
 for(let d=1;d<=3;d++)for(let seed=1;seed<=120;seed++){
  const l=makeWorkshopLevel(4,seed,d);themes.add(l.theme);
  assert(l.solutions.length>0);assert.equal(l.items.find(i=>i.id==='c4_7').slot,0,'skirt must not be an outer cloak');
  for(const ids of l.solutions){const r=outfitScore(ids.map(id=>l.items.find(i=>i.id===id)),l);assert(r.complete);assert(r.score>=80&&r.score<=100);}
  const s=createWorkshopState(l);act(s,{type:'start'});act(s,{type:'submit'});assert.equal(s.result,null);assert.match(s.status,/每类/);
  const sameSlot=l.items.filter(i=>i.slot===0).slice(0,3);assert.equal(outfitScore(sameSlot,l).complete,false);
  for(const item of l.solutions[0])act(s,{type:'wear',item});const outfit=[...s.outfit];
  const replacement=l.items.find(i=>i.slot===0&&i.id!==outfit[0]);act(s,{type:'wear',item:replacement.id});assert.equal(s.outfit.filter(Boolean).length,3);assert.deepEqual(s.outfit.slice(1),outfit.slice(1));assert.equal(s.lastReview,null);
  act(s,{type:'wear',item:outfit[0]});act(s,{type:'submit'});assert(s.runway);assert.equal(s.result,null);advance(s,2.6);
  while(!s.result){for(const item of coutureBrief(s).solutions[0])act(s,{type:'wear',item});act(s,{type:'submit'});assert(s.runway);advance(s,2.6);}assert(s.result?.passed);assert.equal(s.clientReports.length,d);
  const result=JSON.stringify(s.result);act(s,{type:'wear',item:replacement.id});act(s,{type:'submit'});assert.equal(JSON.stringify(s.result),result);
 }assert.equal(themes.size,3);
});
test('expired kitchen ticket hands off, prep requires complete ingredients and cuts cannot be spammed',()=>{
 const l=makeWorkshopLevel(2,23,1);l.orders.forEach((o,i)=>{o.arrival=0;o.patience=i===0?.3:100});
 const s=createWorkshopState(l);act(s,{type:'start'});step(s,.05);
 act(s,{type:'ticket',index:0});act(s,{type:'cook'});assert.equal(s.jobs[0].state,'prep');assert.match(s.status,/备齐/);
 advance(s,.4);assert.equal(s.jobs[0].state,'failed');assert.equal(s.ticket,1);
 const j=s.jobs[1];act(s,{type:'ingredient',index:999});assert.equal(j.ingredients.length,0);
 for(const index of l.orders[1].ingredients)act(s,{type:'ingredient',index});
 for(let i=0;i<4;i++){act(s,{type:'cut'});advance(s,.4);}
 const events=s.events.length;act(s,{type:'cut'});assert.equal(j.cuts,4);assert.equal(s.events.length,events);
 act(s,{type:'cook'});assert.equal(j.state,'cooking');assert.equal(s.ticket,2);
 act(s,{type:'serve',station:0});assert.equal(s.served,0);
 advance(s,j.cook);act(s,{type:'serve',station:0});assert.equal(s.served,1);
 act(s,{type:'serve',station:0});assert.equal(s.served,1);
});
test('furniture undo returns the last selected piece and clears its stale review',()=>{
 const s=createWorkshopState(makeWorkshopLevel(19,43,2));act(s,{type:'start'});
 act(s,{type:'select',value:2});act(s,{type:'rotate'});act(s,{type:'cell',index:0});
 act(s,{type:'submit'});assert(s.lastReview);act(s,{type:'undo'});
 assert.equal(s.selected,2);assert.equal(s.rotation,1);assert.equal(s.furniture.length,0);assert.equal(s.lastReview,null);
});
test('runtime prop crops match the manifest and stay inside both texture atlases',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/assets/minigame-props-v19.json',import.meta.url),'utf8'));
 assert.deepEqual(WORKSHOP_PROP_FRAMES,manifest);
 for(const theme of ['pixel','origami']){
  const png=await readFile(new URL('../public/assets/minigame-props-'+theme+'-v19.png',import.meta.url)),w=png.readUInt32BE(16),h=png.readUInt32BE(20);
  assert.equal(manifest[theme].length,12);
  for(const f of manifest[theme])assert(f.x>=0&&f.y>=0&&f.w>0&&f.h>0&&f.x+f.w<=w&&f.y+f.h<=h);
  assert(manifest[theme][2].w>350,'cleaver includes padded handle and blade edges');
 }
});
