import {chromium} from 'playwright-core';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {FIREWORKS_EQUIPMENT,fireworksWind,fireworksSummary} from '../src/fireworksRules.js';
import {eventRequests} from '../src/partyPlanning.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v90/browser');await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out,'accounts-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-FIREWORKS-V90'}),base='http://127.0.0.1:'+service.port;
const report={at:new Date().toISOString(),scope:'Actual isolated dual-theme UI, real gifts and dependency plan, actual resident/host roads, three seeded acts with real color/shape/lane choices and pointer aiming, finite six-shell ledger, pause-close-reload same ID, lost finish once, unique reward/SR display, 390px. Theme recommendation stub; no external model calls or user progress changes. Not zero-start economics, human enjoyment or full goal completion.',checks:[],errors:[],apiErrors:[],badAssets:[]};let page;
const browser=await chromium.launch({executablePath:process.env.HD_QA_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{
 for(const theme of ['pixel','origami']){
  console.log('fireworks browser: '+theme+' start');
  const user=await service.identities.register({login:'fireworks_'+theme,password:'isolated-fireworks-only',name:'烟花验收',islandName:'星海岛',theme,avatar:'female_1'}),tenant=await service.tenants.get(user.token),s=hydrateTown(createZeroState());s.freshStartPending=false;s.saveSlot='hd-v90-'+tenant.accountId+'-'+theme;s.coins=160;
  Object.assign(s.inventory,FIREWORKS_EQUIPMENT,{tea:4,resin:2,quartz:2,bamboo:2,shell:2});
  for(const n of Object.values(s.npcNeeds))n.hunger=n.energy=n.social=100;
  await tenant.saves.open(theme,{legacyState:s});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);let loseFinish=true,delayFirstCheckpoint=true;const calls=[],finishIds=[];let editedDuringCheckpoint=false;
  await context.route('**/api/**',async r=>{
   const url=r.request().url();if(url.includes('/api/saves/')){if(url.endsWith('/action')){const b=r.request().postDataJSON();calls.push(b);if(b.kind==='fireworks'&&b.operation==='checkpoint'&&delayFirstCheckpoint){delayFirstCheckpoint=false;const response=await r.fetch();await new Promise(resolve=>setTimeout(resolve,1800));return r.fulfill({response});}if(b.kind==='fireworks'&&b.operation==='finish'){finishIds.push(b.requestId);if(loseFinish){loseFinish=false;await r.fetch();return r.abort('failed');}}}return r.continue();}
   if(url.endsWith('/api/lan/me'))return r.continue();
   if(url.includes('/api/parties/')&&url.endsWith('/suggest')){const b=r.request().postDataJSON();assert.equal(b.input.template,'fireworks');return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...b.input,guestId:14,guestReason:'青禾愿意观察花园终曲，也会协助收拾广场。',source:'deepseek',model:'deepseek-flash',proposalId:randomUUID()})});}
   return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated fireworks QA"}'});
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push({theme,message:e.message,stack:e.stack}));page.on('response',r=>{if(r.url().includes('/api/saves/')&&r.status()>=400)report.apiErrors.push({theme,status:r.status(),url:r.url()});if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url());});
  const inspect=()=>page.evaluate(()=>window.islandInspect()),ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#islandBootNotice'));
  const book=async()=>{await page.locator('#partyBtn').click();if(await page.locator('#fireworksPartyOpen').count())await page.locator('#fireworksPartyOpen').click();await page.locator('#fireworksBoard').waitFor();};
  await page.goto(base+'/play?qa=1');await ready();await book();await page.locator('#fireworksDesign').click();await page.locator('#partyDesignName').fill('星海的三幕约定');await page.locator('#partyDesignDescription').fill('和伙伴们一起观察海风，亲手编排色彩和绽放，留下三幕相聚的记忆。');await page.locator('.party-theme-tags input[value=stars]').check();await page.locator('#partyDesignDifficulty').selectOption('easy');await page.locator('#partySuggest').click();
  await page.waitForFunction(()=>document.querySelector('.party-proposal-source')?.textContent.includes('DeepSeek'));assert.match(await page.locator('#partyPreview').innerText(),/14 岛币/);assert.match(await page.locator('#partyPreview').innerText(),/烟花/);await page.locator('#partyPublish').click();await page.locator('#fireworksBoard').waitFor();
  const draft=(await inspect()).fireworksParty.draft,requests=eventRequests(draft);assert.equal(requests.length,4);
  for(const {id} of requests){await page.locator('[data-fireworks-invite="'+id+'"]').click();await page.locator('#fireworksInviteConfirm').click();await page.waitForFunction(id=>window.islandInspect().fireworksParty?.draft?.invites?.[id]?.version===1,id);await page.locator('#fireworksBoard').waitFor();}
  await page.locator('#fireworksPlan').click();await page.waitForFunction(()=>!!window.islandInspect().fireworksParty.draft.projectId);await page.locator('#fireworksBoard').waitFor();await page.screenshot({path:resolve(out,theme+'-book.png')});
  await page.locator('#fireworksHost').click();await page.locator('#fireworksPartyRoot').waitFor();const initial=await inspect(),ticketId=initial.serverFireworks.ticket.requestId,moving=new Set();let polls=0;
  while(!(await page.locator('#fireworksStart').isEnabled())&&polls++<300){const x=await inspect();for(const n of x.npcs)if(x.fireworksParty?.session?.participants.some(p=>p.id===n.id)&&n.walking)moving.add(n.id);await page.waitForTimeout(350);}
  assert(await page.locator('#fireworksStart').isEnabled(),'all actual collaborators, guest and host reached independent positions');assert([1,3,12].every(id=>moving.has(id)),'three fixed residents followed actual roads');
  const attendance=(await inspect()).fireworksAttendance,positions=Object.values(attendance.people);for(let i=0;i<positions.length;i++)for(let j=i+1;j<positions.length;j++)assert(Math.hypot(positions[i].x-positions[j].x,positions[i].y-positions[j].y)>=25);
  await page.screenshot({path:resolve(out,theme+'-checkin.png')});
  let reloaded=false,guard=0,lastLog='',result;const armed=new Set(),burstPictures=new Set();let launchClicks=0;
  while(guard++<2600){
   const x=await inspect(),view=x.roomGame,g=view?.game;if(view?.kind!=='fireworks-party'){await page.waitForTimeout(100);continue;}
   if(g.phase+'-'+g.round!==lastLog){lastLog=g.phase+'-'+g.round;console.log(theme+' '+lastLog);}
   if(g.phase==='results'){result=g;break;}
   if(!reloaded&&g.reports.length===1&&!x.serverFireworks.settling){
    await page.locator('#fireworksPause').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.paused&&!window.islandInspect().serverFireworks.settling);const before=await inspect(),clock=before.roomGame.game.clock;
    await page.waitForTimeout(300);assert.equal((await inspect()).roomGame.game.clock,clock);await page.locator('#closeModal').click();await page.reload();await ready();await page.locator('#serverFireworks:not(.hidden)').waitFor();assert.equal(await page.locator('#serverGather:not(.hidden)').count(),0);
    await page.locator('#fireworksRetry').click();await page.waitForFunction(()=>window.islandInspect()?.roomGame?.kind==='fireworks-party'&&!window.islandInspect().serverFireworks.settling);const after=await inspect();assert.equal(after.serverFireworks.ticket.requestId,ticketId);assert.equal(after.roomGame.game.reports.length,1);reloaded=true;continue;
   }
   if(view.paused||((view.transport||x.serverFireworks.settling)&&g.phase!=='arming')){await page.waitForTimeout(60);continue;}
   if(['checkin','intermission'].includes(g.phase)){if(await page.locator('#fireworksStart').isEnabled())await page.locator('#fireworksStart').click();else await page.waitForTimeout(100);continue;}
   const act=g.level.rounds[g.round];
   if(g.phase==='arming'&&!armed.has(g.round)){
    if(view.transport)editedDuringCheckpoint=true;
    for(const t of act.targets){
     await page.locator('[data-fireworks-select="'+t.index+'"]').click();
     for(const item of ['lane:'+t.lane,'color:'+t.color,'shape:'+t.shape])await page.locator('[data-fireworks-config="'+t.index+'|'+item+'"]').click();
     await page.locator('#fireworksCanvas').scrollIntoViewIfNeeded();
     const r=await page.locator('#fireworksCanvas').boundingBox(),at=t.at-t.flight,aim=t.x-fireworksWind(g,at)*t.flight*.55;
     await page.mouse.move(r.x+r.width*aim,r.y+r.height*t.y);await page.mouse.down();await page.mouse.move(r.x+r.width*aim,r.y+r.height*t.y,{steps:2});await page.mouse.up();
     const configured=(await inspect()).roomGame.game.configs[t.index];assert.equal(configured.lane,t.lane);assert.equal(configured.color,t.color);assert.equal(configured.shape,t.shape);assert(Math.abs(configured.x-aim)<.005);assert(Math.abs(configured.y-t.y)<.005);
    }
    await page.screenshot({path:resolve(out,theme+'-arming-'+g.round+'.png')});armed.add(g.round);await page.locator('#fireworksSubmit').click();continue;
   }
   if(g.phase==='performing'){
    const t=act.targets.find(t=>!g.shots.some(s=>s.round===g.round&&s.index===t.index));
    if(t&&g.clock>=t.at-t.flight-.06){await page.locator('#fireworksLaunch'+t.index).click();launchClicks++;continue;}
    const shot=g.shots.find(s=>s.round===g.round&&g.clock-s.burstAt>=.35&&g.clock-s.burstAt<=1.5);
    if(shot&&!burstPictures.has(g.round)){burstPictures.add(g.round);await page.screenshot({path:resolve(out,theme+'-burst-'+g.round+'.png')});}
    await page.waitForTimeout(30);continue;
   }
   await page.waitForTimeout(80);
  }
  assert(result,'three actual acts completed');assert(reloaded);assert.equal(armed.size,3);assert.equal(result.reports.length,3);const summary=fireworksSummary(result);assert(editedDuringCheckpoint,'arming choices and pointer aim are accepted during delayed checkpoint');assert.equal(summary.fired,6);assert(summary.hits>=5,JSON.stringify(summary));assert(summary.passed);assert.equal(launchClicks,6);
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.locator('#fireworksClaim').scrollIntoViewIfNeeded();await page.screenshot({path:resolve(out,theme+'-results-390.png')});await page.locator('#fireworksClaim').click();await page.locator('#serverFireworks:not(.hidden)').waitFor();assert.match(await page.locator('#fireworksHeading').innerText(),/尚待确认/);await page.screenshot({path:resolve(out,theme+'-recovery-390.png')});await page.locator('#fireworksRetry').click();
  await page.waitForFunction(()=>!window.islandInspect().serverFireworks.active&&!window.islandInspect().actor.action);await page.locator('#fireworksBoard').waitFor();
  const final=await tenant.saves.current(theme),receipts=final.actions.receipts.filter(r=>r.ticket.kind==='fireworks'&&r.outcome==='finished'),eventId=final.state.fireworksParty.session.id;assert.equal(receipts.length,1);assert.equal(new Set(finishIds).size,1);assert.equal(finishIds.length,2);assert.equal(final.state.fireworksParty.history.length,1);assert.equal(final.state.eventWonders.owned.fireworks_orbit.rarity,'SR');assert.equal(Object.keys(final.state.resourceLedger.reservations).filter(id=>id.startsWith('fireworks:')).length,0);
  assert.equal(final.state.inventory.firework,0);assert.equal(final.state.inventory.c8_2,1);assert.equal(final.state.resourceLedger.receipts['cash:'+eventId+':entry'].delta.coins,-14);assert.equal(final.state.resourceLedger.receipts['fireworks-fired:'+eventId].delta.firework,-6);
  await page.locator('#fireworksCollections').click();await page.locator('[data-wonder-card=fireworks_orbit]').waitFor();assert.match(await page.locator('[data-wonder-card=fireworks_orbit]').innerText(),/星潮留影灯/);await page.locator('[data-wonder-display=fireworks_orbit]').click();await page.waitForFunction(()=>{const w=window.islandInspect().eventWonders;return w.displays.fireworks_orbit||w.pendingDisplays.fireworks_orbit;});let displaySaved=null;for(let i=0;i<80;i++){const d=await tenant.saves.current(theme);if(d.state.eventWonders?.displays?.fireworks_orbit||d.state.eventWonders?.pendingDisplays?.fireworks_orbit){displaySaved=d;break}await page.waitForTimeout(250)}assert(displaySaved,'display request actually persisted to disk before reload');await page.locator('#closeModal').click();await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:resolve(out,theme+'-world.png')});await page.reload();await ready();await book();
  const reload=await inspect();assert.equal(reload.fireworksParty.session.id,eventId);assert.equal(reload.serverFireworks.active,false);assert(reload.eventWonders.displays.fireworks_orbit||reload.eventWonders.pendingDisplays.fireworks_orbit,'persisted wonder placement survives reload');assert.equal((await tenant.saves.current(theme)).actions.receipts.filter(r=>r.ticket.kind==='fireworks'&&r.outcome==='finished').length,1);
  const probe=await context.newPage();await probe.goto(base+'/src/collectionsUI.js');await probe.setContent('<main id="modalRoot"></main>');await probe.evaluate(async fixture=>{const {createCollectionsUI}=await import(location.origin+'/src/collectionsUI.js');const first=structuredClone(fixture);first.eventWonders.displays={};first.eventWonders.pendingDisplays={};let live=first,persisted;const ui=createCollectionsUI({state:()=>live,theme:()=>fixture.theme||'pixel',openModal:(title,subtitle,body,footer)=>{document.querySelector('#modalRoot').innerHTML='<div class="modal"><div class="modal-body">'+body+(footer||'')+'</div></div>'},persist:()=>{persisted=structuredClone(live)},toast:()=>{},recipes:()=>{},canDisplay:()=>true});ui.open();live=structuredClone(first);ui.paint();window.collectionProbe=()=>({old:first.eventWonders.displays.fireworks_orbit||false,current:live.eventWonders.displays.fireworks_orbit||false,persisted:persisted.eventWonders.displays.fireworks_orbit||false});},displaySaved.state);await probe.locator('[data-wonder-display=fireworks_orbit]').click();assert.deepEqual(await probe.evaluate(()=>window.collectionProbe()),{old:false,current:true,persisted:true});await probe.close();
  report.checks.push({theme,actualFourGifts:true,realDependencyPlan:true,actualResidentRoutes:[...moving],separatePositions:positions,threeSeededActs:true,actualPointerAiming:true,launchClicks,shots:result.shots.map(({round,index,at,burstAt,point,hit,quality})=>({round,index,at,burstAt,point,hit,quality})),hits:summary.hits,quality:summary.quality,reward:receipts[0].reward,pauseCloseReloadSameId:true,lostFinishOriginalIdRetryOnce:true,sixShellsConsumedOnce:true,flagReleased:true,wonder:'SR',displayState:reload.eventWonders.displays.fireworks_orbit||false,pendingDisplay:!!reload.eventWonders.pendingDisplays.fireworks_orbit,compactNoOverflow:true,latestStateCollectionHandler:true,editedDuringCheckpoint,displayPersistedBeforeReload:true,requests:calls.length});await context.close();console.log('fireworks browser: '+theme+' passed');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badAssets,[]);assert.deepEqual(report.apiErrors,[]);report.passed=true;
}catch(e){report.failure=e.stack;report.passed=false;process.exitCode=1;if(page&&!page.isClosed()){report.inspect=await page.evaluate(()=>{const s=window.islandInspect?.();return{fireworksRuntime:s?.fireworksRuntime,serverFireworks:s?.serverFireworks,game:s?.roomGame,attendance:s?.fireworksAttendance,npcs:s?.npcs?.filter(n=>s?.fireworksParty?.session?.participants?.some(p=>p.id===n.id)),actor:s?.actor};}).catch(()=>null);await page.screenshot({path:resolve(out,'failure.png')}).catch(()=>{});}}
finally{await browser.close();await service.close();await writeFile(resolve(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,inspect:report.inspect?{fireworksRuntime:report.inspect.fireworksRuntime,actor:report.inspect.actor,npcs:report.inspect.npcs}:undefined}));}
