import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
import {chooseAction} from './v19-play-helpers.mjs';
const out='qa/v47';await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out+'/browser-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createZeroState());s.freshStartPending=false;for(const i of CATALOG_ITEMS)s.inventory[i.id]=99;for(const f of Object.values(s.facilities)){f.quality=90;f.condition=100;f.upgrades=4}await store.open(theme,{legacyState:s});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={at:new Date().toISOString(),directory,scope:'Actual dual-theme UI and server disk with legal pointer/cell controls. Isolated stock fixtures; no production saves or model providers.',checks:[],errors:[]};let browser,page;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/src/app.js')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated crafting QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>!!window.islandInspect);
  const game=()=>page.evaluate(()=>window.islandInspect().roomGame);
  const open=async id=>{
   await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption(String(id));await page.locator('[data-recipe]').first().click();await page.locator('#itemCraft').click();
   await page.waitForFunction(()=>window.islandInspect().roomGame?.premium?window.islandInspect().roomGame.loaded:!!window.islandInspect().roomGame,{},{timeout:30000});
  };
  const nativeInput=async a=>{
   if(a.type==='place'||a.type==='cell')return page.locator('.wk-hit[data-cell="'+a.index+'"]').click();
   const extra=a.value!==undefined?'[data-value="'+a.value+'"]':a.index!==undefined?'[data-index="'+a.index+'"]':'';
   return page.locator('[data-action="'+a.type+'"]'+extra).click();
  };
  await open(0);await page.locator('[data-action="start"]').click();
  let first=true;for(let i=0;i<8;i++){const s=await game(),a=chooseAction(s);if(!a)break;await nativeInput(a);if(a.type==='place'||a.type==='cell'){first=false;break}}
  assert(!first);const seed=(await game()).level.seed;
  // A definite rejection never committed this batch. Resume from the last acknowledged game.
  let rejected=false;
  await page.route('**/api/saves/'+theme+'/action',async r=>{const b=r.request().postDataJSON();if(b.kind==='craft'&&b.operation==='checkpoint'&&!rejected){rejected=true;await r.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'isolated rejected input batch',code:'craft_input'})})}else await r.continue()});
  await page.waitForFunction(()=>!document.querySelector('#serverCraft').classList.contains('hidden')&&document.querySelector('#craftHeading').textContent.includes('尚待确认'),{},{timeout:12000});assert(rejected);
  await page.locator('#craftRetry').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);
  assert.equal((await game()).level.seed,seed);assert.equal((await game()).placed.length,0);assert.equal(await page.evaluate(()=>window.islandInspect().serverCraft.bufferedEvents),1);
  await page.unroute('**/api/saves/'+theme+'/action');await page.locator('[data-action="start"]').click();
  first=true;for(let i=0;i<8;i++){const a=chooseAction(await game());if(!a)break;await nativeInput(a);if(a.type==='place'||a.type==='cell'){first=false;break}}assert(!first);
  report.checks.push({theme,definiteRejectedBatchResumesAcknowledgedState:true,oldUncommittedInputsDiscarded:true});
  let dropped=false;
  await page.route('**/api/saves/'+theme+'/action',async r=>{const b=r.request().postDataJSON();if(b.kind==='craft'&&b.operation==='checkpoint'&&!dropped){await r.fetch();dropped=true;await r.abort('failed')}else await r.continue()});
  await page.waitForFunction(()=>!document.querySelector('#serverCraft').classList.contains('hidden')&&document.querySelector('#craftHeading').textContent.includes('尚待确认'),{},{timeout:12000});assert(dropped);
  await page.screenshot({path:out+'/'+theme+'-craft-retry.png'});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#craftHeading')?.textContent.includes('继续上次'));
  await page.setViewportSize({width:390,height:820});await page.screenshot({path:out+'/'+theme+'-craft-resume-compact.png'});
  assert.equal(await page.locator('#serverCraft').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  await page.locator('#craftRetry').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);
  assert.equal((await game()).level.seed,seed);assert((await game()).placed.length>0);
  await page.unroute('**/api/saves/'+theme+'/action');await page.setViewportSize({width:1440,height:960});
  for(let i=0;i<80;i++){const s=await game();if(s.result)break;const a=chooseAction(s);if(a)await nativeInput(a);else await page.waitForTimeout(80)}
  await page.waitForSelector('[data-action="claim"]',{timeout:10000});
  assert((await game()).result.passed);
  // Finish commits, but the response disappears. Reload must replay a single receipt.
  let lostFinish=false;
  await page.route('**/api/saves/'+theme+'/action',async r=>{const b=r.request().postDataJSON();if(b.kind==='craft'&&b.operation==='finish'&&!lostFinish){await r.fetch();lostFinish=true;await r.abort('failed')}else await r.continue()});
  await page.locator('[data-action="claim"]').click();
  await page.waitForFunction(()=>!document.querySelector('#serverCraft').classList.contains('hidden')&&document.querySelector('#craftHeading').textContent.includes('尚待确认'),{},{timeout:16000});assert(lostFinish);
  const paid=(await store.current(theme)).actions.receipts.at(-1);assert.equal(paid.outcome,'finished');assert.deepEqual(paid.gain,{lantern:1});
  await page.reload();await page.waitForFunction(()=>!!window.islandInspect);await page.waitForTimeout(400);
  let doc=await store.current(theme);assert.equal(doc.actions.receipts.filter(r=>r.ticket.sequence===paid.ticket.sequence).length,1);assert.equal(doc.actions.active,null);assert(await page.locator('#serverCraft').isHidden());assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);
  await page.unroute('**/api/saves/'+theme+'/action');
  report.checks.push({theme,nativeActualControls:true,checkpointLossReload:true,sameSeedAndPlacedPieces:true,finishLossExactlyOnce:true,compactNoOverflow:true});
  // A fresh browser has no cached game or local save; the server offers the in-flight board.
  await open(7);let s=await game(),m=s.legalMove;assert(m);await page.locator('.classic-cell[data-cell="'+m.a+'"]').click();await page.locator('.classic-cell[data-cell="'+m.b+'"]').click();
  await page.waitForFunction(()=>window.islandInspect().roomGame.found>0);await page.waitForTimeout(5500);
  const linkSeed=(await game()).level.seed;const other=await context.newPage();await other.goto(base+'/?qa=1&theme='+theme);await other.waitForFunction(()=>document.querySelector('#craftHeading')?.textContent.includes('继续上次'));
  await page.close();page=other;page.on('pageerror',e=>report.errors.push(theme+': '+e.message));await page.locator('#craftRetry').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.kind==='link');
  s=await game();assert.equal(s.level.seed,linkSeed);assert(s.found>0);
  for(let i=0;i<80&&!s.done;i++){const move=s.legalMove;assert(move);await page.locator('.classic-cell[data-cell="'+move.a+'"]').click();await page.locator('.classic-cell[data-cell="'+move.b+'"]').click();await page.waitForFunction(()=>!window.islandInspect().roomGame.busy,{},{timeout:10000});s=await game()}
  assert(s.done);await page.locator('.activity-finish:enabled').waitFor({timeout:8000});await page.locator('.activity-finish').click();
  await page.waitForFunction(()=>!window.islandInspect().serverCraft.active,{},{timeout:18000});
  doc=await store.current(theme);assert.equal(doc.actions.receipts.at(-1).outcome,'finished');assert.equal(doc.actions.receipts.at(-1).ticket.building,7);assert.equal(doc.actions.active,null);
  report.checks.push({theme,classicActualControls:true,serverBoardAfterFreshPage:true,linkUniqueProduct:true});
  await page.locator('#closeModal').click();await open(15);await page.locator('[data-action="start"]').click();await page.locator('#closeModal').click();await page.waitForFunction(()=>!window.islandInspect().serverCraft.active);
  doc=await store.current(theme);assert.equal(doc.actions.receipts.at(-1).outcome,'cancelled');assert(!Object.keys(doc.state.resourceLedger.reservations).some(k=>k.startsWith('server-craft:')));
  report.checks.push({theme,actualExitReturnedStock:true});console.log(theme+' crafting passed');await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:out+'/craft-browser-failure.png'}).catch(()=>{});report.status=await page?.locator('#serverCraft').innerText().catch(()=>null);report.game=await page?.evaluate(()=>({craft:window.islandInspect?.().serverCraft,game:window.islandInspect?.().roomGame})).catch(()=>null)}
finally{await browser?.close();server.kill();await writeFile(out+'/craft-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors,failure:report.failure,status:report.status}));}
