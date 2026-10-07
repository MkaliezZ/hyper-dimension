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
await mkdir('qa/v39',{recursive:true});const directory=await mkdtemp(resolve('qa/v39/couture-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=500;
 for(const item of CATALOG_ITEMS)s.inventory[item.id]=99;
 for(const f of Object.values(s.facilities)){f.quality=90;f.condition=100;f.upgrades=4}
 await store.open(theme,{legacyState:s,clientId:'couture-fixture'});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,kind:'Actual dual-theme recipe workbench using isolated 99-stock fixtures and solution-known legal UI input. Verifies multi-client conditions, timed review/pause, exit/refund and unique final production. Autonomous NPC shared-stock changes are distinguished from playerGoods credit and the exact craft receipt. Not human difficulty or first-day economic acceptance; no provider calls or real user save writes.',checks:[],errors:[],badAssets:[]};let engine,page;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated couture QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url())});
  const get=()=>page.evaluate(()=>window.islandInspect());
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().resourceLedger);
  const open=async d=>{
   await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption('4');await page.locator('[data-recipe="outfit"]').click();await page.locator('#itemCraft').click();
   await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded,{},{timeout:25000});
   await page.locator('[data-action="difficulty"][data-mode="'+d+'"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);
   assert.equal((await get()).roomGame.level.briefs.length,d);await page.locator('[data-action="start"]').click();
  };
  const wear=async()=>{
   const game=(await get()).roomGame,brief=game.level.briefs[game.clientIndex];
   assert((await page.locator('.wk-client-heading').textContent()).includes(brief.request));
   for(const [slot,item] of brief.solutions[0].entries()){
    await page.locator('[data-action="wardrobeTab"][data-value="'+slot+'"]').click();await page.locator('[data-item="'+item+'"]').click();
   }
   assert.match(await page.locator('.wk-outfit-review').textContent(),/达标/);
   assert.equal((await get()).roomGame.level.items.filter(i=>i.slot===game.level.briefs[game.clientIndex].accent.slot).length>0,true);
  };
  const initial=await get();await open(2);let before=await get(),owner=Object.keys(before.resourceLedger.reservations).find(k=>k.startsWith('player:craft:'));assert(owner);
  await wear();await page.locator('[data-action="submit"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame.clientReports.length===1);
  assert.equal((await get()).roomGame.result,null);assert.equal((await get()).economy.playerGoods.outfit||0,initial.economy.playerGoods.outfit||0);assert((await get()).resourceLedger.reservations[owner]);
  await page.locator('#closeModal').click();await page.waitForFunction(()=>!window.islandInspect().roomGame);assert.equal((await get()).resourceLedger.reservations[owner],undefined);
  assert.equal((await get()).economy.playerGoods.outfit||0,initial.economy.playerGoods.outfit||0);
  report.checks.push({theme,flow:'standard partial exit',clients:2,noIntermediateReward:true,reservationReleased:true});
  await open(3);before=await get();const seed=before.roomGame.level.seed;assert.equal(before.roomGame.level.briefs.length,3);
  owner=Object.keys(before.resourceLedger.reservations).find(k=>k.startsWith('player:craft:'));assert(owner);
  const reserved=JSON.stringify(before.resourceLedger.reservations[owner]);
  for(let index=0;index<3;index++){
   assert.equal((await get()).roomGame.clientIndex,index);await wear();
   if(index===0)await page.screenshot({path:'qa/v39/'+theme+'-couture-desktop.png'});
   await page.locator('[data-action="submit"]').click();await page.waitForFunction(()=>!!window.islandInspect().roomGame.runway);
   let game=(await get()).roomGame;assert.equal(game.result,null);assert.equal(game.clientReports.length,index);
   assert(await page.locator('.wk-controls').evaluate(el=>el.inert));assert.equal((await get()).economy.playerGoods.outfit||0,before.economy.playerGoods.outfit||0);
   if(index===0){
    await page.waitForTimeout(600);await page.locator('[data-action="pause"]').click();game=(await get()).roomGame;assert(game.paused);
    const elapsed=game.runway.elapsed;await page.waitForTimeout(240);assert.equal((await get()).roomGame.runway.elapsed,elapsed);
    await page.screenshot({path:'qa/v39/'+theme+'-couture-review-paused.png'});await page.locator('[data-action="resume"]').click();
    await page.screenshot({path:'qa/v39/'+theme+'-couture-review.png'});
   }
   await page.waitForFunction(index=>window.islandInspect().roomGame.clientReports.length===index+1,index);
   game=(await get()).roomGame;assert.equal(JSON.stringify((await get()).resourceLedger.reservations[owner]),reserved);
   if(index<2){assert.equal(game.result,null);assert.deepEqual(game.outfit,[null,null,null]);assert.equal((await get()).economy.playerGoods.outfit||0,before.economy.playerGoods.outfit||0)}
  }
  await page.waitForFunction(()=>window.islandInspect().roomGame.phase==='result');assert((await get()).roomGame.result.passed);
  await page.setViewportSize({width:390,height:780});await page.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);
  assert(await page.locator('[data-action="claim"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth+1}));
  await page.screenshot({path:'qa/v39/'+theme+'-couture-receipt-compact.png'});
  await page.evaluate(()=>window.detachedClaim=document.querySelector('[data-action="claim"]'));await page.locator('[data-action="claim"]').click();await page.evaluate(()=>window.detachedClaim.click());
  await page.waitForFunction(()=>!window.islandInspect().actor.action&&!window.islandInspect().roomGame,{},{timeout:18000});
  const after=await get();assert.equal(after.economy.playerGoods.outfit,(before.economy.playerGoods.outfit||0)+1);assert.equal(after.resourceLedger.reservations[owner],undefined);
  const receipt=after.resourceLedger.receipts[owner+':result'];assert(receipt);assert.equal(receipt.category,'craft');const [receiptOwner,cost,gain]=JSON.parse(receipt.signature);assert.equal(receiptOwner,owner);assert.equal(gain.outfit,1);assert.equal(receipt.delta.outfit,1);assert.deepEqual(cost,JSON.parse(reserved).items);
  report.checks.push({theme,flow:'challenge continuous clients',seed,clients:3,distinctThemes:true,pausePreservedReview:true,uniqueFinalProduct:true,receipt:owner+':result',quality:after.miniGameHistory[4].lastResult.quality});
  await page.locator('#closeModal').click();await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption('4');await page.locator('[data-recipe="outfit"]').click();await page.locator('#itemCraft').click();
  await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);await page.locator('[data-action="difficulty"][data-mode="2"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);
  await page.locator('[data-action="start"]').click();assert.notEqual((await get()).roomGame.level.seed,seed);
  assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  const close=await page.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<=780);
  await page.screenshot({path:'qa/v39/'+theme+'-couture-playing-compact.png'});await page.locator('#closeModal').click();
  await context.close();
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.badAssets.length,0,JSON.stringify(report.badAssets));report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:'qa/v39/couture-failure.png'}).catch(()=>{});throw e}
finally{await writeFile('qa/v39/couture-browser-report.json',JSON.stringify(report,null,2));await engine?.close();server.kill()}
console.log(JSON.stringify(report));
