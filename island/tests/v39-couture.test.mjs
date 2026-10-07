import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeWorkshopLevel,createWorkshopState,workshopAction as act,stepWorkshop as step,outfitScore,coutureBrief,progressWorkshop} from '../src/workshopRules.js';
test('pixel apron crop excludes the neighbor while every other item frame is unchanged',async()=>{
 const current=JSON.parse(await readFile(new URL('../public/assets/art-frames-v8.json',import.meta.url),'utf8'));
 const f=current['items-pixel-products-0-v8.png'].frames[50];assert.equal(f.w,134);assert(f.x+f.w<=479);
 const restored=JSON.parse(JSON.stringify(current));restored['items-pixel-products-0-v8.png'].frames[50].w=147;assert.equal(createHash('sha256').update(JSON.stringify(restored)).digest('hex'),'6c3e1a35471191a8297df76a2854214925260ca09107a7774006f4ade5866002');
});
const advance=(s,n)=>{for(let i=0;i<Math.ceil(n/.05);i++)step(s,.05)};
const dress=s=>{for(const item of coutureBrief(s).solutions[0])act(s,{type:'wear',item});act(s,{type:'submit'})};
test('all client briefs have actual three-slot feasible outfits across seeds and difficulties',()=>{
 for(let d=1;d<=3;d++)for(let seed=1;seed<=150;seed++){
  const l=makeWorkshopLevel(4,seed*97,d);assert.equal(l.briefs.length,d);assert.equal(new Set(l.briefs.map(b=>b.theme)).size,d);
  for(const b of l.briefs){assert(b.solutions.length);assert.equal(Boolean(b.accent),d>1);for(const ids of b.solutions){assert.equal(ids.length,3);assert(outfitScore(ids.map(id=>l.items.find(i=>i.id===id)),b).complete)}}
 }
});
test('randomized couture briefs vary budgets, comfort, accents and requests without mutating shared levels',()=>{
 const signatures=new Set(),budgets=new Set(),comfort=new Set(),accents=new Set(),requests=new Set();
 for(let seed=1;seed<70;seed++){const l=makeWorkshopLevel(4,seed,3);signatures.add(JSON.stringify(l.briefs));for(const b of l.briefs){budgets.add(b.budget);comfort.add(b.comfortGoal);accents.add(b.accent.slot);requests.add(b.request)}assert.deepEqual(l,makeWorkshopLevel(4,seed,3));}
 assert(signatures.size>50);assert(budgets.size>=2);assert(comfort.size>=3);assert.equal(accents.size,3);assert(requests.size>=9);
});
test('accent constraint can reject an otherwise valid total theme outfit with actionable feedback',()=>{
 let found=false;
 for(let seed=1;seed<150&&!found;seed++){const l=makeWorkshopLevel(4,seed,2);
 for(const b of l.briefs)for(const a of l.items.filter(i=>i.slot===0))for(const c of l.items.filter(i=>i.slot===1))for(const d of l.items.filter(i=>i.slot===2)){
  const r=outfitScore([a,c,d],b);if(r.slots&&r.budget&&r.styled&&r.comfortable&&!r.accented){assert(!r.complete);assert.equal(r.score,0);assert(r.unmet.some(t=>t.includes('风格还差')));found=true;}
 }}assert(found,'accent must add a meaningful condition for at least one generated brief');
});
test('review is an actual timed phase and legal inputs cannot duplicate reports or change exhibited outfit',()=>{
 const s=createWorkshopState(makeWorkshopLevel(4,89,3));act(s,{type:'start'});dress(s);const outfit=[...s.outfit];
 assert(s.runway);assert.equal(s.result,null);assert.deepEqual(progressWorkshop(s),[0,3,'顾客']);
 for(let i=0;i<50;i++){act(s,{type:'submit'});act(s,{type:'wear',item:s.level.items[i%s.level.items.length].id})}
 assert.deepEqual(s.outfit,outfit);assert.equal(s.clientReports.length,0);advance(s,2.5);assert.equal(s.clientReports.length,0);
 advance(s,.1);assert.equal(s.clientReports.length,1);assert.equal(s.clientIndex,1);assert.equal(s.runway,null);assert.deepEqual(s.outfit,[null,null,null]);assert.equal(s.lastReview,null);assert.equal(s.result,null);
});
test('continuous session aggregates customer quality once and finishes only after the final review',()=>{
 const l=makeWorkshopLevel(4,21,3),original=JSON.stringify(l),s=createWorkshopState(l);act(s,{type:'start'});
 for(let i=0;i<3;i++){assert.equal(s.clientIndex,i);dress(s);assert.equal(s.result,null);advance(s,2.6);assert.equal(s.clientReports.length,i+1);if(i<2)assert.equal(s.result,null)}
 assert(s.result.passed);assert.equal(s.phase,'celebrating');assert.equal(s.result.quality,Math.round(s.clientReports.reduce((n,r)=>n+r.quality,0)/3));assert(s.score<=1000);
 const result=JSON.stringify(s.result);advance(s,4);act(s,{type:'submit'});act(s,{type:'wear',item:l.items[0].id});assert.equal(JSON.stringify(s.result),result);assert.equal(s.clientReports.length,3);assert.equal(JSON.stringify(l),original);assert.deepEqual(progressWorkshop(s),[3,3,'顾客']);
});
test('invalid submissions preserve editable outfit and impose only a bounded final quality deduction',()=>{
 const s=createWorkshopState(makeWorkshopLevel(4,27,1));act(s,{type:'start'});for(let i=0;i<20;i++)act(s,{type:'submit'});
 assert.equal(s.strikes,20);assert.equal(s.runway,null);assert.equal(s.result,null);dress(s);advance(s,2.6);assert(s.result.passed);assert.equal(s.result.quality,s.clientReports[0].quality-12);
});
test('timeout during review cannot turn an unfinished commission into a passing reward',()=>{
 const s=createWorkshopState(makeWorkshopLevel(4,42,1));act(s,{type:'start'});s.t=s.level.time-.02;dress(s);step(s,.05);
 assert.equal(s.result.passed,false);assert.equal(s.clientReports.length,0);act(s,{type:'submit'});advance(s,5);assert.equal(s.result.passed,false);
});
test('legacy single-brief levels still use one review and complete without session metadata',()=>{
 const l=makeWorkshopLevel(4,8,1);delete l.briefs;const s=createWorkshopState(l);assert.equal(coutureBrief(s),l);act(s,{type:'start'});dress(s);advance(s,2.6);assert(s.result.passed);assert.equal(s.clientReports.length,1);
});
