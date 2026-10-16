import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fixture,produce,start,finish,fixtureProof,CONFIG} from './v92-cooperation-fixture.mjs';
import {archiveRecruitment,finishRecruitmentDeparture} from '../src/recruitment.js';
import {availableQuantity} from '../src/resourceLedger.js';
import {townDailyBudget,upgradeCost,maintenanceCost,ECONOMY_RULES} from '../src/economy.js';
import {partyDraftStamp} from '../src/partyPlanning.js';
import {HARBOR_LAYOUTS} from '../src/world.js';
import {validActionBook} from '../server/playerActions.mjs';

const days=Number(process.env.HD_COMBINED_ECON_DAYS||10),out=resolve(process.env.HD_QA_OUT||'qa/v231/combined-economy');
assert(Number.isInteger(days)&&days>=10&&days<=60);await mkdir(out,{recursive:true});
const report={scope:'One canonical progressed island per style, rotating all five legally replayed party games, actual visitor quotes/escrow, per-day recruitment wages, paid upgrades/maintenance and900accepted seconds/day. Starts with140coins and100declared stock per catalog item except initial wood/lantern deficits. Clock, attendance and model lineage are deterministic fixtures; no rendering, human input, real provider or zero-resource-gathering claim. This is a combined accounting check, not a full zero-start economic or human balance acceptance.',clockInjected:true,initialStateSynthetic:true,modelsCalled:false,humanAcceptance:false,cases:[],passed:false};

for(const theme of ['pixel','origami'])test(theme+' combined same-island party, wage, visitor and investment books',{timeout:60000+days*15000},async context=>{
 const f=await fixture('night',theme,{nonTargetStock:100}),row={theme,days,initialCoins:(await f.current()).state.coins,categories:{},daily:[],parties:[],hires:[],investments:[],snapshots:0,passed:false};report.cases.push(row);
 let previous=await f.current(),receiptIds=new Set((previous.state.resourceLedger?.events||[]).map(e=>e.id)),net=0,queuedSeconds=0,domainNow=previous.actions.commerce.lastActiveAt,flushing=false;
 const originalAdvance=f.advance;
 // Keep one immutable acknowledged snapshot. Editors explicitly clone below;
 // readers cannot silently mutate the audit baseline. Every mutation still goes
 // through the durable store and a new store checks the final disk state.
 function immutable(value){const pending=[value],seen=new WeakSet();while(pending.length){const v=pending.pop();if(!v||typeof v!=='object'||seen.has(v))continue;seen.add(v);for(const child of Object.values(v))if(child&&typeof child==='object')pending.push(child);Object.freeze(v);}return value;}
 f.current=async()=>previous;
 function observe(d){
  const s=d.state,events=(s.resourceLedger?.events||[]).filter(e=>!receiptIds.has(e.id));for(const e of events)receiptIds.add(e.id);
  const delta=s.coins-previous.state.coins,recorded=events.reduce((n,e)=>n+(e.delta.coins||0),0);assert.equal(delta,recorded,'Cash movement must match new resource events');net+=delta;assert.equal(s.coins,row.initialCoins+net);assert(s.coins>=0);assert(Object.values(s.inventory).every(n=>n>=0));assert(validActionBook(d.actions));
  const cash=events.filter(e=>e.id.startsWith('cash:')||e.delta.coins),ledger=s.economy.cashLedger.slice(-cash.length||s.economy.cashLedger.length);
  if(cash.length){assert.equal(ledger.length,cash.length);assert.equal(ledger.reduce((n,r)=>n+r.net,0),delta,'Cash ledger and resource ledger must agree');for(const r of ledger){const a=row.categories[r.category]??={count:0,income:0,cost:0,net:0};a.count++;a.income+=r.income;a.cost+=r.cost;a.net+=r.net;}}
  previous=immutable(structuredClone(d));row.snapshots++;
 }
 async function raw(kind,operation,args={}){const d=previous,r=await f.store.action(theme,{kind,operation,requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions?.sequence||0,epoch:d.actions?.epoch||null,day:d.state.day,...(kind==='party'&&operation==='begin'?{gameVersion:2}:{}),...args});observe(r.document);return r;}
 async function pump(){
  let d=await f.current(),v=d.actions.visitor;if(!v)return;if(v.activeSeconds+1e-7>=v.nextTripAt)await raw('visitor','arrive');
  for(const id of Object.keys((await f.current()).actions.visitor.guests)){
   d=await f.current();v=d.actions.visitor;const g=v.guests[id];if(!g)continue;
   if(g.phase==='onboard'&&domainNow>=g.landReadyAt)await raw('visitor','land',{guestId:g.id});
   else if(g.phase==='servicing'){const t=v.leases[g.lease];if(domainNow>=t.readyAt)await raw('visitor','finish',{requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});}
   else if(g.phase==='landed'&&g.stop<g.itinerary.length)await raw('visitor','begin',{guestId:g.id,buildingId:g.itinerary[g.stop],stop:g.stop});
   else if(g.phase==='landed'){const occupied=new Set(Object.values(v.guests).map(x=>x.queue)),queue=HARBOR_LAYOUTS[theme].waiting.findIndex((_,i)=>!occupied.has(i));if(queue>=0)await raw('visitor','review',{guestId:g.id,queue});}
   else if(g.phase==='reviewed'&&domainNow>=g.boardReadyAt)await raw('visitor','depart',{guestId:g.id});
  }
 }
 async function flushTime(){
  if(flushing)return;flushing=true;try{while(queuedSeconds>1e-7){context.signal.throwIfAborted();const n=Math.min(15,queuedSeconds),milliseconds=Math.ceil(n*1000);queuedSeconds-=n;originalAdvance(milliseconds);domainNow+=milliseconds;const d=await f.current(),r=await f.store.save(theme,{state:d.state,expectedVersion:d.version,activeSeconds:n,saveId:randomUUID()});observe(r.document);await pump();}}finally{flushing=false;}
 }
 f.advance=n=>{queuedSeconds+=n/1000;};f.call=async(...args)=>{await flushTime();return raw(...args);};f.save=async edit=>{const d=previous,state=structuredClone(d.state);edit(state);const r=await f.store.save(theme,{state,expectedVersion:d.version});observe(r.document);return r;};
 f.manage=async(operation,extra={})=>{await flushTime();const draft=(await f.current()).state[f.config.field]?.draft;return f.call('commerce',operation,{eventId:draft?.id??null,eventVersion:draft?.version??null,eventStamp:partyDraftStamp(draft),...extra});};
 async function retire(){const id=f.contract.id;await f.registry.cancel(theme,await f.current(),id);const paid=await f.manage('hire_handover',{contractId:id});row.hires.push({day:paid.document.state.day,fee:paid.receipt.details.fee,delivered:paid.receipt.details.delivered,quantity:paid.receipt.details.quantity});assert(paid.receipt.details.delivered>0);assert(paid.receipt.details.fee>0&&paid.receipt.details.fee<=8);await f.save(s=>assert(finishRecruitmentDeparture(s)));await f.registry.departed(theme,await f.current(),id);await f.save(s=>assert(archiveRecruitment(s,id)));}
 async function hireWood(day){
  const s=(await f.current()).state,project={id:'audit-wood-'+day,title:'经营木材补充',targets:{wood:availableQuantity(s,'wood')+1}};await f.manage('plan_create',{project});f.projectId=project.id;
  const c=(await f.registry.start(theme,await f.current(),{requestId:randomUUID(),candidateId:'mai',projectId:project.id})).contract,run=fixtureProof(c.context);assert(run.child.acceptedSteps.length);await f.registry.complete(theme,c.id,c.attempt,run);f.contract=(await f.registry.activate(theme,await f.current(),c.id)).contract;await f.call('commerce','hire_bind',{contractId:c.id});await f.save(s=>{s.recruitment.active.phase='working';s.recruitment.active.hasArrived=true;});await produce(f);await f.manage('plan_control',{projectId:project.id,control:'finish'});
 }
 try{
  await f.call('visitor','enable',{theme});
  // Initial stock exists only to fund party fixtures, not as free visitor sales.
  for(let buildingId=0;buildingId<25;buildingId++)await f.manage('shopfront',{buildingId,listing:[],expectedShopRevision:(await f.current()).state.shopfronts?.revision||0});
  for(let day=1;day<=days;day++){
   assert.equal((await f.current()).state.day,day);const template=Object.keys(CONFIG)[(day-1)%5];f.template=template;f.config=CONFIG[template];
   if(day===1)await produce(f);else{await hireWood(day);await f.manage(f.config.prefix+'_enable');await f.manage(f.config.prefix+'_create',{proposal:{template,name:'第'+day+'天经营活动',description:'同一座岛的实际活动收入与费用核对',tags:['stars'],difficulty:'normal',guestId:null,...(template==='night'?{fireworks:false}:{})}});const plan=await f.manage(f.config.prefix+'_plan');f.projectId=plan.receipt.details.project.id;await produce(f);}
   const prepared=(await f.current()).state.workProjects.find(p=>p.id===f.projectId);if(prepared?.status==='ready')await f.manage('plan_control',{projectId:f.projectId,control:'finish'});
   await start(f);const done=await finish(f),before=done.document.state.coins;assert.equal(done.receipt.outcome,'finished');const replay=await f.call(f.config.kind,'finish',{requestId:done.ticket.requestId,epoch:done.ticket.epoch,sequence:done.ticket.sequence});assert(replay.replayed);assert.equal(replay.document.state.coins,before);row.parties.push({day,template,reward:done.receipt.reward??null});if(template!=='night'){const session=(await f.current()).state[f.config.field].session;const archived=await f.manage(f.config.prefix+'_archive',{eventId:session.id});assert.equal(archived.receipt.cashDelta,0);assert.equal((await f.current()).state[f.config.field].session,null);}await retire();
   let s=(await f.current()).state,bill=townDailyBudget(s).total;const bid=14,upgrade=upgradeCost(s.facilities[bid]);if(day%5===0&&s.facilities[bid].upgrades<3&&availableQuantity(s,'coins')>=upgrade.coins+bill+20&&availableQuantity(s,'wood')>=upgrade.wood&&availableQuantity(s,'stone')>=upgrade.stone){const r=await f.manage('upgrade',{buildingId:bid});assert.equal(r.receipt.cashDelta,-upgrade.coins);row.investments.push({day,kind:'upgrade',coins:upgrade.coins});}
   s=(await f.current()).state;const wornEntry=Object.entries(s.facilities).find(([,x])=>x.condition<55),worn=wornEntry?.[1],cost=worn&&maintenanceCost(worn);if(worn&&availableQuantity(s,'coins')>=cost.coins+townDailyBudget(s).total+20&&availableQuantity(s,'wood')>=cost.wood&&availableQuantity(s,'stone')>=cost.stone){const r=await f.manage('maintain',{buildingId:Number(wornEntry[0])});assert.equal(r.receipt.cashDelta,-cost.coins);row.investments.push({day,kind:'maintain',coins:cost.coins});}
   let clockSteps=0;while((await f.current()).state.day===day){context.signal.throwIfAborted();assert(++clockSteps<=80,'A canonical day clock must advance at millisecond resolution');const s=(await f.current()).state;f.advance(Math.min(15,900-s.economy.daySeconds)*1000);await flushTime();}
   const end=await f.current();row.daily.push(structuredClone(end.state.economy.townDays.find(x=>x.day===day)));assert(row.daily.at(-1));assert.equal(row.daily.at(-1).net,row.daily.at(-1).income-row.daily.at(-1).cost);assert.equal(row.daily.at(-1).operatingNet,row.daily.at(-1).net-row.daily.at(-1).deferred);if(day%5===0)context.diagnostic(theme+' completed '+day+' combined days');
  }
  const final=await f.other().current(theme);observe(final);assert.equal(final.state.day,days+1);assert.equal(row.parties.length,days);assert.equal(new Set(row.parties.map(x=>x.template)).size,5);assert.equal(row.hires.length,days);assert(row.categories.visitor?.income>0);assert(row.categories.recruitment?.cost>0);assert(row.categories.town?.count===days);assert.equal(final.state.coins,row.initialCoins+net);assert(Math.abs(final.actions.commerce.activeSeconds-days*ECONOMY_RULES.daySeconds)<1e-6);row.finalCoins=final.state.coins;row.totalNet=net;row.fullOperatingNet=row.daily.reduce((n,r)=>n+r.operatingNet,0);row.deferred=row.daily.reduce((n,r)=>n+r.deferred,0);row.passed=true;
 }catch(error){row.failure=error.stack;throw error;}finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));}
});
test.after(async()=>{report.passed=report.cases.length===2&&report.cases.every(x=>x.passed);await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));});
