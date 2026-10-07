import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
await mkdir('qa/v40',{recursive:true});const directory=await mkdtemp(resolve('qa/v40/interior-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=500;
 for(const item of CATALOG_ITEMS)s.inventory[item.id]=99;
 for(const f of Object.values(s.facilities)){f.quality=90;f.condition=100;f.upgrades=4}
 await store.open(theme,{legacyState:s,clientId:'interior-fixture'});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const visualOnly=process.argv.includes('--visual-only');
const report={directory,kind:'Actual dual-theme room workbench, isolated 99-stock fixtures, no provider calls or real user save writes. Solution-known legal placement, rotation, rug layer, pickup/undo, physical route, sound pause, partial exit and unique recipe production; not human time, skill or first-day economics.',checks:[],errors:[],badAssets:[]};let engine,page;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated interior QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url())});
  const get=()=>page.evaluate(()=>window.islandInspect());
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().resourceLedger);
  let recipe;
  const open=async d=>{
   await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption('19');recipe=await page.locator('[data-recipe]').first().getAttribute('data-recipe');
   await page.locator('[data-recipe]').first().click();await page.locator('#itemCraft').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded,{},{timeout:25000});
   await page.locator('[data-action="difficulty"][data-mode="'+d+'"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);await page.locator('[data-action="start"]').click();
   assert.equal((await get()).roomGame.level.d,d);
  };
  const furnish=async()=>{
   const l=(await get()).roomGame.level;
   for(const [value,p] of l.solution.entries()){
    await page.locator('[data-action="select"][data-value="'+value+'"]').click();
    while((await get()).roomGame.rotation!==(p.rotation||0))await page.locator('[data-action="rotate"]').click();
    await page.locator('[data-cell="'+(p.y*l.w+p.x)+'"]').click();
   }
   assert.equal((await get()).roomGame.furniture.length,l.items.length);assert.equal(await page.locator('.wk-room-checks .is-unmet').count(),0);
  };
  if(visualOnly){
   await open(3);await furnish();await page.locator('[data-action="inspectRoute"]').click();
   await page.screenshot({path:'qa/v40/'+theme+'-interior-visual-desktop.png'});
   await page.setViewportSize({width:390,height:780});await page.locator('.modal-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'qa/v40/'+theme+'-interior-visual-compact.png'});
   assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
   await page.locator('#closeModal').click();report.checks.push({theme,flow:'targeted title and planner visual check',fixedClose:true,noOverflow:true});await context.close();continue;
  }
  await open(2);let before=await get(),owner=Object.keys(before.resourceLedger.reservations).find(k=>k.startsWith('player:craft:'));assert(owner);
  const credit=before.economy.playerGoods[recipe]||0;await furnish();await page.locator('[data-action="submit"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame.walkthrough?.step>=2);
  assert.equal((await get()).roomGame.result,null);assert((await get()).resourceLedger.reservations[owner]);await page.locator('#closeModal').click();await page.waitForFunction(()=>!window.islandInspect().roomGame);
  assert.equal((await get()).resourceLedger.reservations[owner],undefined);assert.equal((await get()).economy.playerGoods[recipe]||0,credit);
  report.checks.push({theme,flow:'standard mid-tour exit',reservationReleased:true,noPersonalProduct:true});
  await open(3);before=await get();const l=before.roomGame.level,seed=l.seed;owner=Object.keys(before.resourceLedger.reservations).find(k=>k.startsWith('player:craft:'));assert(owner);const reserved=JSON.stringify(before.resourceLedger.reservations[owner]),personal=before.economy.playerGoods[recipe]||0;
  await furnish();const poses=JSON.stringify((await get()).roomGame.furniture);
  await page.locator('[data-action="pickup"][data-value="0"]').click();assert.equal((await get()).roomGame.furniture.length,5);
  await page.locator('[data-action="undo"]').click();assert.equal(JSON.stringify((await get()).roomGame.furniture),poses);
  await page.locator('[data-action="inspectRoute"]').click();assert((await get()).roomGame.routeVisible);
  await page.screenshot({path:'qa/v40/'+theme+'-interior-desktop.png'});
  const soundBefore=(await get()).sound.cueCounts.footstep||0;await page.locator('[data-action="submit"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame.walkthrough?.step>=2);
  let s=await get();assert(s.roomGame.walkthrough);assert.equal(s.roomGame.result,null);assert(await page.locator('.wk-controls').evaluate(el=>el.inert));assert.equal(s.economy.playerGoods[recipe]||0,personal);
  const route=await page.evaluate(async()=>{const s=window.islandInspect().roomGame,{interiorReview}=await import('/src/workshopRules.js');const r=interiorReview(s);return {path:s.walkthrough.route,blocked:r.blocked,w:s.level.w};});
  for(let i=0;i<route.path.length;i++){assert(!route.blocked.includes(route.path[i]));if(i)assert.equal(Math.abs(route.path[i]%route.w-route.path[i-1]%route.w)+Math.abs((route.path[i]/route.w|0)-(route.path[i-1]/route.w|0)),1);}
  await page.locator('[data-action="soundSettings"]').click();await page.waitForSelector('.sound-sheet[open]');s=await get();assert(s.roomGame.paused);
  const elapsed=s.roomGame.walkthrough.elapsed;await page.waitForTimeout(250);assert.equal((await get()).roomGame.walkthrough.elapsed,elapsed);assert.equal(JSON.stringify((await get()).resourceLedger.reservations[owner]),reserved);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.sound-sheet'));assert((await get()).roomGame.paused);await page.locator('[data-action="resume"]').click();await page.screenshot({path:'qa/v40/'+theme+'-interior-tour.png'});
  await page.waitForFunction(()=>window.islandInspect().roomGame.phase==='result',{},{timeout:45000});
  s=await get();assert(s.roomGame.walkthrough.done&&s.roomGame.result.passed);assert((s.sound.cueCounts.footstep||0)>soundBefore);assert.equal(s.economy.playerGoods[recipe]||0,personal);
  assert.equal(JSON.stringify(s.resourceLedger.reservations[owner]),reserved);const result=s.roomGame.result;
  await page.setViewportSize({width:390,height:780});assert(await page.locator('[data-action="claim"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth+1}));
  await page.screenshot({path:'qa/v40/'+theme+'-interior-receipt-compact.png'});
  await page.evaluate(()=>window.detachedClaim=document.querySelector('[data-action="claim"]'));await page.locator('[data-action="claim"]').click();await page.evaluate(()=>window.detachedClaim.click());
  await page.waitForFunction(()=>!window.islandInspect().actor.action&&!window.islandInspect().roomGame,{},{timeout:18000});
  const after=await get();assert.equal(after.economy.playerGoods[recipe],personal+1);assert.equal(after.resourceLedger.reservations[owner],undefined);
  const receipt=after.resourceLedger.receipts[owner+':result'],[receiptOwner,cost,gain]=JSON.parse(receipt.signature);assert.equal(receiptOwner,owner);assert.equal(gain[recipe],1);assert.equal(receipt.delta[recipe],1);assert.deepEqual(cost,JSON.parse(reserved).items);
  report.checks.push({theme,flow:'challenge actual layout and acceptance',seed,room:[l.w,l.h],pillars:l.walls.length,recipe,pickupUndo:true,rugPassable:true,legalTour:true,pausePreserved:true,uniqueProduct:true,footstepCue:true,result});
  await page.locator('#closeModal').click();await open(2);assert.notEqual((await get()).roomGame.level.seed,seed);
  const game=(await get()).roomGame;await page.locator('[data-action="select"][data-value="0"]').click();await page.locator('[data-cell="'+(game.level.w*game.level.h-1)+'"]').click();assert.equal((await get()).roomGame.furniture.length,0);
  assert.match((await get()).roomGame.status,/室内/);assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:'qa/v40/'+theme+'-interior-playing-compact.png'});await page.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);
  const close=await page.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<=780);await page.screenshot({path:'qa/v40/'+theme+'-interior-controls-compact.png'});await page.locator('#closeModal').click();
  await context.close();
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.badAssets.length,0,JSON.stringify(report.badAssets));report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:'qa/v40/interior-failure.png'}).catch(()=>{});throw e}
finally{await writeFile(visualOnly?'qa/v40/visual-browser-report.json':'qa/v40/interior-browser-report.json',JSON.stringify(report,null,2));await engine?.close();server.kill()}
console.log(JSON.stringify(report));
