import {chromium} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {COUTURE_EQUIPMENT,coutureSolutions,coutureReview} from '../src/coutureRules.js';
import {eventRequests} from '../src/partyPlanning.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v89/browser');await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out,'accounts-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-COUTURE-V89'}),base='http://127.0.0.1:'+service.port;
const report={at:new Date().toISOString(),scope:'Isolated actual dual-theme owner UI; progression-gated seeded inventory, seven real gifts, real roads and garment slots, three random feasible styling/pose rounds, pause-close-reload same ID, lost finish response once, unique payout, garment release, R wonder/display, 390px. Theme recommendation stub, no external model calls or user save mutation. Not zero-start economics, human enjoyment or full goal completion.',checks:[],errors:[],apiErrors:[],badAssets:[]};let page;
const browser=await chromium.launch({executablePath:process.env.HD_QA_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 for(const theme of ['pixel','origami']){
  console.log('couture browser: '+theme+' start');
  const user=await service.identities.register({login:'couture_'+theme,password:'isolated-couture-only',name:'穿搭验收',islandName:'星织岛',theme,avatar:'female_1'}),tenant=await service.tenants.get(user.token),s=hydrateTown(createZeroState());s.freshStartPending=false;s.saveSlot='hd-v89-'+tenant.accountId+'-'+theme;s.coins=160;s.roomGames[4]={plays:5};s.facilities[4].quality=65;
  Object.assign(s.inventory,COUTURE_EQUIPMENT,{fiber:7,tea:4,bread:3,wheat:4,rose:4,bamboo:4,shell:3,quartz:3,c4_8:1,c4_4:1,c4_2:1,c4_7:1,c4_11:1});
  for(const n of Object.values(s.npcNeeds))n.hunger=n.energy=n.social=100;
  await tenant.saves.open(theme,{legacyState:s});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);let loseFinish=true;const calls=[],finishIds=[];
  await context.route('**/api/**',async r=>{
   const url=r.request().url();if(url.includes('/api/saves/')){if(url.endsWith('/action')){const b=r.request().postDataJSON();calls.push(b);if(b.kind==='couture'&&b.operation==='finish'){finishIds.push(b.requestId);if(loseFinish){loseFinish=false;await r.fetch();return r.abort('failed');}}}return r.continue();}
   if(url.endsWith('/api/lan/me'))return r.continue();
   if(url.includes('/api/parties/')&&url.endsWith('/suggest')){const b=r.request().postDataJSON();assert.equal(b.input.template,'couture');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...b.input,guestId:3,guestReason:'星野熟悉星空故事，会与评审一起观看居民登台。',source:'deepseek',model:'deepseek-flash',proposalId:randomUUID()})});}
   return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated couture QA"}'});
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push({theme,message:e.message,stack:e.stack}));page.on('response',r=>{if(r.url().includes('/api/saves/')&&r.status()>=400)report.apiErrors.push({theme,status:r.status(),url:r.url(),bodyPromise:true});if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url());});
  const inspect=()=>page.evaluate(()=>window.islandInspect()),ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#islandBootNotice'));
  const book=async()=>{await page.locator('#partyBtn').click();if(await page.locator('#couturePartyOpen').count())await page.locator('#couturePartyOpen').click();await page.locator('#coutureBoard').waitFor();};
  await page.goto(base+'/play?qa=1');await ready();await book();await page.locator('#coutureDesign').click();await page.locator('#partyDesignName').fill('海风与星织衣橱');await page.locator('#partyDesignDescription').fill('让每位居民穿出自己的海岛故事，星光下分享手作与姿态。');await page.locator('.party-theme-tags input[value=stars]').check();await page.locator('#partyDesignDifficulty').selectOption('easy');await page.locator('#partySuggest').click();
  await page.waitForFunction(()=>document.querySelector('.party-proposal-source')?.textContent.includes('DeepSeek'));assert.match(await page.locator('#partyPreview').innerText(),/12 岛币/);assert.match(await page.locator('#partyPreview').innerText(),/服装/);await page.locator('#partyPublish').click();await page.locator('#coutureBoard').waitFor();
  const draft=(await inspect()).coutureParty.draft,requests=eventRequests(draft);assert.equal(requests.length,7);
  for(const {id} of requests){await page.locator('[data-couture-invite="'+id+'"]').click();await page.locator('#coutureInviteConfirm').click();await page.waitForFunction(id=>window.islandInspect().coutureParty?.draft?.invites?.[id]?.version===1,id);await page.locator('#coutureBoard').waitFor();}
  await page.locator('#couturePlan').click();await page.waitForFunction(()=>!!window.islandInspect().coutureParty.draft.projectId);await page.locator('#coutureBoard').waitFor();await page.screenshot({path:resolve(out,theme+'-book.png')});
  await page.locator('#coutureHost').click();await page.locator('#couturePartyRoot').waitFor();const initial=await inspect(),ticketId=initial.serverCouture.ticket.requestId,moving=new Set();let polls=0;
  while(!(await page.locator('#coutureStart').isEnabled())&&polls++<300){const x=await inspect();for(const n of x.npcs)if(x.coutureParty?.session?.participants.some(p=>p.id===n.id)&&n.walking)moving.add(n.id);await page.waitForTimeout(350);}
  assert(await page.locator('#coutureStart').isEnabled(),'all actual judges/models and host reached independent positions');assert(moving.size>=6,'all fixed residents walked their actual routes');
  const start=(await inspect()).coutureAttendance,positions=Object.values(start.people);for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)assert(Math.hypot(positions[i].x-positions[j].x,positions[i].y-positions[j].y)>=25);
  await page.screenshot({path:resolve(out,theme+'-checkin.png')});
  let reloaded=false,guard=0,garmentsVerified=false,modelMovement=new Set(),poseClicks=0,shown=new Set(),lastLog='',result;
  while(guard++<2600){
   const x=await inspect(),view=x.roomGame,g=view?.game;if(view?.kind!=='couture-party'){await page.waitForTimeout(100);continue;}
   if(g.phase+'-'+g.round!==lastLog){lastLog=g.phase+'-'+g.round;console.log(theme+' '+lastLog);}
   const brief=g.level.rounds[g.round];for(const n of x.npcs)if(n.id===brief.npcId&&g.phase==='walking'&&n.walking)modelMovement.add(n.id);
   if(g.phase==='results'){result=g;break;}
   if(!reloaded&&g.reports.length===1&&!x.serverCouture.settling){
    await page.locator('#couturePause').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.paused&&!window.islandInspect().serverCouture.settling);const before=await inspect(),clock=before.roomGame.game.clock;
    await page.waitForTimeout(300);assert.equal((await inspect()).roomGame.game.clock,clock);await page.locator('#closeModal').click();await page.reload();await ready();await page.locator('#serverCouture:not(.hidden)').waitFor();assert.equal(await page.locator('#serverGather:not(.hidden)').count(),0);
    await page.locator('#coutureRetry').click();await page.waitForFunction(()=>window.islandInspect()?.roomGame?.kind==='couture-party'&&!window.islandInspect().serverCouture.settling);const after=await inspect();assert.equal(after.serverCouture.ticket.requestId,ticketId);assert.equal(after.roomGame.game.reports.length,1);reloaded=true;continue;
   }
   if(view.transport||view.paused||x.serverCouture.settling){await page.waitForTimeout(75);continue;}
   if(['checkin','intermission'].includes(g.phase)){if(await page.locator('#coutureStart').isEnabled())await page.locator('#coutureStart').click();else await page.waitForTimeout(100);continue;}
   if(g.phase==='styling'){
    const solution=coutureSolutions(g.wardrobe,brief).sort((a,b)=>coutureReview(b,brief).score-coutureReview(a,brief).score)[0];assert(solution);
    for(const item of Object.values(solution).filter(Boolean))await page.locator('[data-couture-wear="'+item+'"]').click();
    await page.waitForTimeout(120);const dressed=await inspect(),n=dressed.npcs.find(n=>n.id===brief.npcId);assert.deepEqual([...n.coutureGarments].sort(),Object.values(solution).filter(Boolean).sort());garmentsVerified=true;
    if(!shown.has(brief.npcId)){shown.add(brief.npcId);await page.screenshot({path:resolve(out,theme+'-styling-'+g.round+'.png')});}
    await page.locator('#coutureSubmit').click();continue;
   }
   if(g.phase==='showing'){const beat=Math.min(3,Math.floor(g.clock/1.8)),local=g.clock-beat*1.8;if(local>=.78&&local<=1.14&&!g.show.attempts[beat]){await page.locator('[data-couture-pose="'+brief.cues[beat]+'"]').click();poseClicks++;}await page.waitForTimeout(35);continue;}
   await page.waitForTimeout(100);
  }
  assert(result,'three actual model rounds completed');assert(reloaded);assert(garmentsVerified);assert.equal(modelMovement.size,3);assert.equal(result.reports.length,3);assert(result.reports.every(r=>r.outcome==='shown'));assert(result.reports.reduce((s,r)=>s+r.hits.filter(Boolean).length,0)>=6);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.locator('#coutureClaim').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,theme+'-results-390.png')});await page.locator('#coutureClaim').click();await page.locator('#serverCouture:not(.hidden)').waitFor();assert.match(await page.locator('#coutureHeading').innerText(),/尚待确认/);await page.screenshot({path:resolve(out,theme+'-recovery-390.png')});await page.locator('#coutureRetry').click();
  await page.waitForFunction(()=>!window.islandInspect().serverCouture.active&&!window.islandInspect().actor.action);await page.locator('#coutureBoard').waitFor();
  const final=await tenant.saves.current(theme),receipts=final.actions.receipts.filter(r=>r.ticket.kind==='couture'&&r.outcome==='finished');assert.equal(receipts.length,1);assert.equal(new Set(finishIds).size,1);assert.equal(finishIds.length,2);assert.equal(final.state.coutureParty.history.length,1);assert(final.state.eventWonders.owned.couture_ribbon);assert.equal(Object.keys(final.state.resourceLedger.reservations).filter(id=>id.startsWith('couture:')).length,0);
  for(const id of Object.keys(COUTURE_EQUIPMENT))assert.equal(final.state.inventory[id],1);assert.equal(final.state.resourceLedger.receipts['cash:'+final.state.coutureParty.session.id+':entry'].delta.coins,-12);
  await page.locator('#coutureCollections').click();await page.locator('[data-wonder-card=couture_ribbon]').waitFor();assert.match(await page.locator('[data-wonder-card=couture_ribbon]').innerText(),/星织展示台/);await page.locator('[data-wonder-display=couture_ribbon]').click();await page.waitForTimeout(350);await page.locator('#closeModal').click();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:resolve(out,theme+'-world.png')});await page.reload();await ready();await book();
  const reload=await inspect();assert.equal(reload.coutureParty.session.id,final.state.coutureParty.session.id);assert.equal(reload.serverCouture.active,false);
  report.checks.push({theme,actualSevenGifts:true,realDependencyPlan:true,actualResidentRoutes:[...moving],separatePositions:positions,actualModelRoutes:[...modelMovement],garmentsVerified,threeRandomRounds:true,poseClicks,hits:result.reports.reduce((s,r)=>s+r.hits.filter(Boolean).length,0),quality:final.state.coutureParty.session.result.quality,reward:receipts[0].reward,pauseCloseReloadSameId:true,lostFinishOriginalIdRetryOnce:true,garmentsReleased:true,wonder:true,displayState:reload.eventWonders.displays.couture_ribbon||false,pendingDisplay:!!reload.eventWonders.pendingDisplays.couture_ribbon,compactNoOverflow:true,requests:calls.length});await context.close();console.log('couture browser: '+theme+' passed');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);assert.deepEqual(report.apiErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;report.passed=false;process.exitCode=1;if(page&&!page.isClosed()){report.inspect=await page.evaluate(()=>{const s=window.islandInspect?.();return{coutureRuntime:s?.coutureRuntime,serverCouture:s?.serverCouture,game:s?.roomGame,attendance:s?.coutureAttendance,npcs:s?.npcs?.filter(n=>s?.coutureParty?.session?.participants?.some(p=>p.id===n.id)),actor:s?.actor};}).catch(()=>null);await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}}
finally{await browser.close();await service.close();await writeFile(resolve(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,inspect:report.inspect?{coutureRuntime:report.inspect.coutureRuntime,actor:report.inspect.actor,npcs:report.inspect.npcs}:undefined}));}
