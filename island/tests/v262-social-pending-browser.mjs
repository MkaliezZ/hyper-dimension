import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {DEFAULT_CLOCK} from '../src/environmentClock.js';
import {residentSchedule} from '../src/residentSchedule.js';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,career,needs,relationship} from '../src/townSimulation.js';
import {groundedConversation} from '../src/conversationFallback.js';
import {RESIDENTS} from '../src/world.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v262/social-pending');await mkdir(out,{recursive:true});
const report={scope:'Two fictional LAN worlds with declared prior-day cooldown/needs/disagreement and normal-rate evening clock fixtures. Actual local conversation and player gather begin. The real accepted unrelated gather response is held below its timeout: dialogue must visibly progress, with no early conversation outcome; normal cancellation, completion, durable save and reload follow. Models are disabled; no invented AI reply, resource/result or elapsed clock. Not real players, physical devices or a full-hour claim.',cases:[],passed:false,wholeGoalComplete:false};
const persist=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],saveErrors:[],passed:false};report.cases.push(row);await persist();
  const directory=await mkdtemp(join(out,theme+'-fictional-'));let service,context,page,releaseHold;let released=false;
  try{
   const event=residentSchedule(0,{hour:19,cycles:0}),clock={...DEFAULT_CLOCK,clockId:'social-pending-'+theme,epochMs:Date.now(),phaseAtEpoch:(event.eventStart+.1)/24};
   await mkdir(join(directory,'environment'),{recursive:true});await writeFile(join(directory,'environment/environment-clock.json'),JSON.stringify(clock));
   service=await createLanHttpServer({directory,port:0,enrollmentKey:'SOCIAL-PENDING-ONLY'});const base='http://127.0.0.1:'+service.port;
   const account=await service.identities.register({login:'sp_'+theme,password:'fictional-social-password',name:'虚构对白验证岛主',islandName:'虚构对白验证岛',avatar:'female_1',theme}),store=(await service.tenants.get(account.token)).saves;
   const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.day=5;seed.economy.daySeconds=40;
   for(let i=0;i<16;i++)Object.assign(needs(i,seed),{energy:90,hunger:90,social:70});needs(0,seed).social=10;relationship(seed,0,8).tension=20;relationship(seed,8,0).tension=20;
   const c=career(0,seed);c.personalAfter=3565;c.socialAfter=3300;c.history.push({day:3,daySeconds:800,time:3000,action:'social',buildingId:7,result:'旧交谈已结束'},{day:4,daySeconds:800,time:3500,action:'visit',buildingId:7,purposeId:'life:seed-notes',result:'旧休闲已结束'});
   const expectedLineCount=groundedConversation([0,8],structuredClone(seed),id=>RESIDENTS[id],'dispute').lines.length;assert.equal(expectedLineCount,4,'This fixture must retain the actual four-line local dialogue');const duration=expectedLineCount*3.7;row.expectedPresentationDuration=duration;
   await store.open(theme,{legacyState:seed,protect:true});
   context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled for isolated dialogue presentation check"}'}):route.continue();});
   page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&new URL(r.url()).pathname.startsWith('/api/saves/'))void r.json().then(d=>row.saveErrors.push({status:r.status(),code:d.code})).catch(()=>{});});
   const ready=()=>page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&window.islandInspect().environment.clockId?.startsWith('social-pending-'),null,{timeout:60000});
   const pair=()=>page.evaluate(()=>{const s=islandInspect(),meeting=s.meetings.find(m=>m.ids.includes(0)&&m.ids.includes(8));return{now:s.now,meeting,conversations:s.npcConversations.filter(c=>c.participants?.includes(0)&&c.participants.includes(8)),saveStatus:document.querySelector('#saveStatus')?.dataset.status};});
   await page.goto(base+'/play?qa=1',{waitUntil:'domcontentloaded'});await ready();
   // Prepare the native control before observing a short, autonomous dialogue.
   // Enter is genuine browser input; do not spend its lifetime locating menus.
   await page.locator('#gatherBtn').click();await page.locator('[data-source="forest"]').click();
   const gatherButton=page.locator('[data-gather="wood"]');assert(await gatherButton.isVisible());assert(await gatherButton.isEnabled());await gatherButton.focus();
   await page.evaluate(()=>document.addEventListener('click',event=>{if(!event.target?.closest?.('[data-gather="wood"]'))return;const s=islandInspect();window.socialPendingNativeActivation={isTrusted:event.isTrusted,at:performance.now(),meeting:s.meetings.find(m=>m.ids.includes(0)&&m.ids.includes(8)),conversationCount:s.npcConversations.filter(c=>c.participants?.includes(0)&&c.participants.includes(8)).length};},{capture:true}));
   await page.waitForFunction(()=>islandInspect().meetings.some(m=>m.ids.includes(0)&&m.ids.includes(8)&&m.phase==='speaking'&&m.clock<1.5),null,{timeout:150000});
   let accepted,dispatched;const acceptedResponse=new Promise(resolve=>accepted=resolve),dispatchedRequest=new Promise(resolve=>dispatched=resolve),hold=new Promise(resolve=>releaseHold=resolve);let holdCount=0;row.gatherTimings={};
   await context.route('**/api/saves/*/action',async route=>{const i=route.request().postDataJSON();if(i.operation==='begin'&&i.itemId==='wood'&&!i.kind&&!holdCount){holdCount++;row.gatherTimings.dispatchedAt=Date.now();dispatched();const response=await route.fetch();assert.equal(response.status(),200);row.gatherTimings.acceptedAt=Date.now();row.gatherTimings.httpAcceptanceMs=row.gatherTimings.acceptedAt-row.gatherTimings.dispatchedAt;row.heldRequestId=i.requestId;accepted();await hold;await route.fulfill({response});}else await route.fallback();});
   const pendingStart=await pair();row.observedPendingStart=pendingStart;assert.equal(pendingStart.meeting?.phase,'speaking');assert(await gatherButton.evaluate(el=>document.activeElement===el));row.gatherTimings.clickedAt=Date.now();await page.keyboard.press('Enter');row.nativeActivation=await page.evaluate(()=>window.socialPendingNativeActivation);assert.equal(row.nativeActivation?.isTrusted,true,'Gather must begin through genuine native keyboard activation');assert.equal(row.nativeActivation.meeting?.phase,'speaking','The conversation must still be speaking at actual input delivery');assert.equal(row.nativeActivation.conversationCount,0,'The native input must precede conversation completion');await persist();
   // Native preparation includes draining the real prior save before dispatch.
   // Keep the10second HTTP bound, measured from the actual request itself.
   await Promise.race([dispatchedRequest,new Promise((_,reject)=>setTimeout(()=>reject(Error('Native gather preparation did not dispatch its request')),30000))]);
   row.gatherTimings.preparationMs=row.gatherTimings.dispatchedAt-row.gatherTimings.clickedAt;
   await Promise.race([acceptedResponse,new Promise((_,reject)=>setTimeout(()=>reject(Error('Actual gather HTTP response exceeded10seconds after dispatch')),Math.max(1,10000-(Date.now()-row.gatherTimings.dispatchedAt))))]);
   const before=await pair();row.observedAccepted=before;await persist();assert.equal(before.meeting?.phase,'speaking');await page.waitForTimeout(2600);const during=await pair();
   const minimumHeldAdvance=Math.min(1,Math.max(0,duration-before.meeting.clock));
   row.pendingPresentation={start:pendingStart.meeting.clock,before:before.meeting.clock,during:during.meeting?.clock,duration,minimumHeldAdvance,actualAcceptedResponseHeld:true};await persist();
   assert.equal(during.meeting?.phase,'speaking');
   // Keep the original one-second progress gate over the native pending action.
   // A slow pre-dispatch save may have already played most of the final line.
   assert(during.meeting.clock-pendingStart.meeting.clock>=1,'Dialogue must advance at least one second during the native unrelated action');
   assert(during.meeting.clock-before.meeting.clock+1e-6>=minimumHeldAdvance,'Dialogue must advance during the accepted hold until its natural endpoint');
   assert(during.meeting.clock<=duration+1e-6,'An accepted hold cannot play past the final line');
   assert.equal(during.conversations.length,0,'The pending presentation must not claim completion');
   assert.equal((await store.current(theme)).state.npcConversations.filter(c=>c.participants.includes(0)&&c.participants.includes(8)).length,0);
   row.pendingPresentation.noEarlyOutcome=true;releaseHold();released=true;
   await page.waitForFunction(()=>document.querySelector('#gatherCancel')&&!document.querySelector('#gatherCancel').disabled,null,{timeout:15000});await page.locator('#gatherCancel').click();await page.waitForFunction(()=>document.querySelector('#serverGather').classList.contains('hidden'),null,{timeout:30000});
   await page.waitForFunction(()=>islandInspect().npcConversations.some(c=>c.participants?.includes(0)&&c.participants.includes(8)),null,{timeout:150000});const after=await pair();assert.equal(after.conversations.length,1);assert.equal(after.conversations[0].source,'local');assert.equal(after.conversations[0].lines.length,expectedLineCount,'The actual completed local dialogue must match the duration fixture');
   await page.locator('#saveStatus').click();await page.locator('#saveNow').click();await page.waitForFunction(()=>!document.querySelector('#saveNow')?.disabled,null,{timeout:30000});await page.locator('#closeModal').click();
   const saved=(await store.current(theme)).state.npcConversations.filter(c=>c.participants.includes(0)&&c.participants.includes(8));assert.equal(saved.length,1);assert.equal(saved[0].id,after.conversations[0].id);
   await page.reload({waitUntil:'domcontentloaded'});await ready();assert.deepEqual((await pair()).conversations,saved);assert.equal(holdCount,1);assert.deepEqual(row.errors,[]);assert.deepEqual(row.saveErrors,[]);await page.screenshot({path:join(out,theme+'-restored.png')});row.nativeGatherCancelledAfterHold=true;row.oneDurableConversationAfterReload=true;row.passed=true;
  }catch(e){row.failure=e.stack;row.failedAt=Date.now();process.exitCode=1;if(!released){releaseHold?.();released=true;}await persist();await page?.screenshot({path:join(out,theme+'-failure.png'),timeout:10000}).catch(()=>{});}
  finally{if(!released)releaseHold?.();await context?.close();await service?.close();await persist();}
 }
 report.passed=report.cases.length===2&&report.cases.every(c=>c.passed);
}finally{await browser.close();await persist();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,failure})=>({theme,passed,failure})),wholeGoalComplete:false}));}
