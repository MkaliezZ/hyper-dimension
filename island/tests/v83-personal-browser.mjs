import {chromium} from 'playwright-core';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';
import {createLanHttpServer} from '../server/lanServer.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {hydrateJourney} from '../src/journey.js';
import {GARMENTS} from '../src/equipmentRules.js';import {ITEM_BY_ID} from '../src/contentCatalog.js';
const out=resolve('qa/v83');await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out,'ui-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-PERSONAL-V83'}),base='http://127.0.0.1:'+service.port;
const garment=Object.keys(GARMENTS).find(k=>GARMENTS[k].slot==='body'),study=Object.values(ITEM_BY_ID).find(i=>i.category==='seedling').id;
const report={scope:'Actual dual-theme home UI, original art, real account saves and server personal commands. Seeded clothes/study/confirmed moment fixtures; not human zero-start acceptance. Providers blocked.',checks:[],errors:[]};
const browser=await chromium.launch({executablePath:process.env.HD_QA_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{for(const theme of ['pixel','origami']){
 const user=await service.identities.register({login:'personal_'+theme,password:'isolated-personal-only',name:'事务验证',islandName:'物资验证岛',theme,avatar:'female_1'}),tenant=await service.tenants.get(user.token),s=hydrateTown(createZeroState());hydrateJourney(s);s.freshStartPending=false;s.saveSlot='hd-v83-'+tenant.accountId+'-'+theme;s.inventory[garment]=3;s.inventory[study]=3;s.inventory.hoe=1;s.journey.stats.crafted.lantern=1;
 await tenant.saves.open(theme,{legacyState:s});
 const ctx=await browser.newContext({viewport:{width:1365,height:900}});await ctx.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);
 let lost=false;const giftRequests=[];
 await ctx.route('**/api/**',async route=>{
  const req=route.request(),url=req.url();if(url.includes('/api/saves/')){
   if(url.endsWith('/action')){const input=req.postDataJSON();if(input.kind==='personal'&&input.operation==='gift'){giftRequests.push(input.requestId);if(!lost){lost=true;await route.fetch();await route.abort('failed');return;}}}
   await route.continue();return;
  }
  if(url.endsWith('/api/lan/me'))return route.continue();await route.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated personal authority UI"}'});
 });
 const page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));const inspect=()=>page.evaluate(()=>window.islandInspect());
 await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#islandBootNotice'));
 await page.locator('#playerBtn').click();await page.locator('#openEquipment').click();await page.locator('[data-wear-slot="body"]').click();await page.locator('[data-wear="'+garment+'"]').click();
 await page.waitForFunction(id=>window.islandInspect().wardrobe.slots.body?.item===id,garment);assert.equal((await inspect()).inventory[garment],2);
 await page.locator('#equipmentStoreAll').click();await page.waitForFunction(id=>window.islandInspect().inventory[id]===3,garment);
 await page.locator('[data-tool="hoe"]').click();await page.waitForFunction(()=>window.islandInspect().serverPersonal.inflight===0);assert.equal((await inspect()).inventory.hoe,1);
 await page.screenshot({path:resolve(out,theme+'-personal-equipment.png')});await page.locator('#closeModal').click();
 await page.locator('#bagBtn').click();await page.locator('[data-item="'+garment+'"]').click();await page.locator('#giftRecipient').selectOption('3');await page.locator('#itemGift').click();
 await page.waitForSelector('#serverPersonal:not(.hidden)');assert.equal((await tenant.saves.current(theme)).state.inventory[garment],2);
 const desktopText=await page.locator('#personalMessage').boundingBox();assert(desktopText.width>400&&desktopText.height<120);await page.screenshot({path:resolve(out,theme+'-personal-uncertain.png')});await page.setViewportSize({width:390,height:820});const compactText=await page.locator('#personalMessage').boundingBox();assert(compactText.width>250&&compactText.height<180);await page.locator('#personalRetry').scrollIntoViewIfNeeded();assert(await page.locator('#personalRetry').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));await page.screenshot({path:resolve(out,theme+'-personal-uncertain-compact.png')});await page.setViewportSize({width:1365,height:900});
 await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#islandBootNotice'));
 const recovered=await inspect();assert.equal(recovered.inventory[garment],2);assert.equal(new Set(giftRequests).size,1);assert.equal(giftRequests.length,2);
 const gifted=await tenant.saves.current(theme);assert.equal(gifted.state.giftLog.filter(r=>r.item===garment&&r.npcId===3).length,1);
 assert.equal(await page.locator('#serverPersonal').isVisible(),false);assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);
 lost=false;await page.locator('#bagBtn').click();await page.locator('[data-item="'+garment+'"]').click();await page.locator('#giftRecipient').selectOption('4');await page.locator('#itemGift').click();await page.waitForSelector('#serverPersonal:not(.hidden)');await page.locator('#recoveryAll').click();await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#islandBootNotice')&&!document.querySelector('#serverPersonal:not(.hidden)'));assert.equal((await inspect()).inventory[garment],1);const twice=await tenant.saves.current(theme);assert.equal(twice.state.giftLog.filter(r=>r.item===garment).length,2);assert.equal(new Set(giftRequests).size,2);assert.equal(giftRequests.length,4);
 await page.locator('#bagBtn').click();await page.locator('[data-item="'+study+'"]').click();await page.locator('#itemUse').click();
 await page.waitForFunction(id=>window.islandInspect().inventory[id]===2,study);await page.locator('#closeModal').click();
 await page.locator('#journalOpen').click();await page.locator('[data-moment="light"]').click();await page.waitForSelector('#momentOverlay');await page.locator('#momentClaim').click();
 await page.waitForSelector('#momentOverlay',{state:'detached'});assert((await inspect()).journey.claimed.light);
 const claimed=await tenant.saves.current(theme),momentReceipt=claimed.actions.receipts.find(r=>r.ticket.kind==='personal'&&r.ticket.command==='moment');assert.deepEqual(momentReceipt.stockDelta,{seed:2});
 assert.equal(claimed.actions.personal.snapshot.inventory.seed,claimed.state.inventory.seed);
 const beforeTime=(await inspect()).now;await page.waitForFunction(t=>window.islandInspect().now>t+.5,beforeTime);
 await page.locator('#saveStatus').click();await page.locator('#saveNow').click();await page.waitForFunction(()=>document.querySelector('#saveStatus').dataset.status==='saved');await page.locator('#closeModal').click();
 await page.screenshot({path:resolve(out,theme+'-personal-complete.png')});
 await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#islandBootNotice'));assert((await inspect()).journey.claimed.light);assert.equal((await inspect()).inventory[garment],1);
 const final=await tenant.saves.current(theme);assert.equal(final.actions.receipts.filter(r=>r.ticket.command==='moment').length,1);
 report.checks.push({theme,serverInventoryEnabled:true,clothingActualDebitAndReturn:true,toolRetained:true,studyConsumed:true,giftLossResponseReloadReplayedOriginalId:true,giftConsumedOnce:true,recoveryButtonActuallyClears:true,desktopAndCompactRecoveryText:true,confirmedMomentAwardOnce:true,rewardSeedDelta:2,autosaveAndReopen:true,simulationContinuesAfterRecovery:true});await ctx.close();
}assert.deepEqual(report.errors,[]);report.passed=true;}catch(e){report.passed=false;report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await service.close();await writeFile(resolve(out,'browser-report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));}
