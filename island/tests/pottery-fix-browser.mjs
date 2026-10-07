import {chooseAction} from './v19-play-helpers.mjs';
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
function directAction(s){
 const action=chooseAction(s);
 if(s.kind==='pottery'&&s.mode==='shape'&&['point','down'].includes(action?.type)){
  const ring=Math.max(0,Math.min(11,Math.round((action.y-125)/270*11)));
  return {...action,x:480+s.level.target[ring]};
 }
 return action;
}
await mkdir('qa/v46/pottery-fix',{recursive:true});const directory=await mkdtemp(resolve('qa/v46/pottery-fix/pottery-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=500;
 for(const item of CATALOG_ITEMS)s.inventory[item.id]=99;
 for(const f of Object.values(s.facilities)){f.quality=90;f.condition=100;f.upgrades=4}
 await store.open(theme,{legacyState:s,clientId:'pottery-fixture'});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const visualOnly=process.argv.includes('--visual-only');
const report={directory,kind:'Actual dual-theme pottery workbench with legal pointer/controls and feedback-known scripted play. Isolated 99-stock and facility fixtures; AI disabled, no provider calls or user save writes. Does not prove human skill/time or zero-start economy.',checks:[],errors:[],badAssets:[]};let engine,page;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated pottery QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url())});
  const get=()=>page.evaluate(()=>window.islandInspect()),game=()=>page.evaluate(()=>window.islandInspect().roomGame);
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().resourceLedger);
  let recipe,mouseHeld=false;
  const open=async d=>{
   await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption('15');recipe=await page.locator('[data-recipe]').first().getAttribute('data-recipe');
   await page.locator('[data-recipe]').first().click();await page.locator('#itemCraft').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded,{},{timeout:25000});
   await page.locator('[data-action="difficulty"][data-mode="'+d+'"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded);await page.locator('[data-action="start"]').click();
   assert.equal((await game()).level.d,d);
   assert(await page.evaluate(async()=>{const {potteryStageImage}=await import('/src/workshopView.js'),im=potteryStageImage(document.body.dataset.theme);return im.complete&&im.naturalWidth>1000&&im.src.includes('pottery-stage-')}));
  };
  const release=async()=>{if(mouseHeld){await page.mouse.up();mouseHeld=false;}};
  const send=async a=>{
   if(['point','down'].includes(a.type)){
    await page.locator('.wk-canvas').scrollIntoViewIfNeeded();const rect=await page.locator('.wk-canvas').boundingBox();
    const v=await page.evaluate(async()=>{const s=window.islandInspect().roomGame,{viewBounds}=await import('/src/workshopView.js'),r=document.querySelector('.wk-canvas').getBoundingClientRect();return viewBounds(s,r.width<600)});
    await page.mouse.move(rect.x+(a.x-v.x)/v.w*rect.width,rect.y+(a.y-v.y)/v.h*rect.height);
    if(a.type==='down'&&!mouseHeld){await page.mouse.down();mouseHeld=true;}return;
   }
   await release();
   if(a.type==='up')return;
   const attrs=a.type==='glazeColor'?'[data-index="'+a.index+'"]':a.type==='kilnFire'||a.type==='kilnVent'?'[data-delta="'+a.delta+'"]':'';
   await page.locator('[data-action="'+a.type+'"]'+attrs).click();
  };
  if(!visualOnly){
   await open(2);let before=await get(),owner=Object.keys(before.resourceLedger.reservations).find(k=>k.startsWith('player:craft:'));assert(owner);
   const credit=before.economy.playerGoods[recipe]||0;
   await page.locator('[data-action="submit"]').click();assert.equal((await game()).mode,'shape');assert.match((await game()).status,/口沿|局部/);
   let a=directAction(await game());await send(a);await page.waitForTimeout(450);await release();
   await page.locator('#closeModal').click();await page.waitForFunction(()=>!window.islandInspect().roomGame);
   assert.equal((await get()).resourceLedger.reservations[owner],undefined);assert.equal((await get()).economy.playerGoods[recipe]||0,credit);
   report.checks.push({theme,flow:'standard shape rejection and partial exit',reservationReleased:true,noPersonalProduct:true});
  }
  await open(3);const before=await get(),seed=before.roomGame.level.seed,owner=Object.keys(before.resourceLedger.reservations).find(k=>k.startsWith('player:craft:'));
  assert(owner);const reserved=JSON.stringify(before.resourceLedger.reservations[owner]),personal=before.economy.playerGoods[recipe]||0;
  let glazing=false,glazed=false,paused=false,kilnShot=false,visualFinished=false,shapeShot=false;
  const startTime=Date.now();
  while(Date.now()-startTime<230000){
   let s=await game();assert(s,'workbench unexpectedly closed');
   if(s.phase==='result')break;
   if(s.paused){await page.locator('[data-action="resume"]').click();continue;}
   if(s.mode==='shape'&&!shapeShot&&s.t>1){await page.screenshot({path:'qa/v46/pottery-fix/'+theme+'-pottery-shape-desktop.png'});shapeShot=true;}
   if(s.mode==='glaze'&&!glazing){
    await release();assert.equal(await page.locator('.wk-glaze-swatches button').count(),3);
    await page.locator('[data-action="submit"]').click();assert.equal((await game()).mode,'glaze');assert.match((await game()).status,/釉带/);glazing=true;
   }
   if(s.mode==='glaze'){
    const ready=await page.evaluate(async()=>{const {potteryGlazeReview}=await import('/src/potteryStudio.js');return potteryGlazeReview(window.islandInspect().roomGame).complete});
    if(ready&&!glazed){await release();await page.screenshot({path:'qa/v46/pottery-fix/'+theme+'-pottery-glaze-desktop.png'});glazed=true;}
   }
   if(s.mode==='firing'&&!paused&&s.kiln.elapsed>2){
    await release();await page.locator('[data-action="soundSettings"]').click();await page.waitForSelector('.sound-sheet[open]');
    const held=await game();assert(held.paused);await page.waitForTimeout(260);const check=await game();
    assert.equal(check.kiln.elapsed,held.kiln.elapsed);assert.equal(check.kiln.temperature,held.kiln.temperature);assert.equal(JSON.stringify((await get()).resourceLedger.reservations[owner]),reserved);
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.sound-sheet'));assert((await game()).paused);
    await page.locator('[data-action="resume"]').click();paused=true;
   }
   if(s.mode==='firing'&&!kilnShot&&s.kiln.elapsed>5){
    await page.screenshot({path:'qa/v46/pottery-fix/'+theme+'-pottery-kiln-desktop.png'});
    await page.setViewportSize({width:390,height:780});await page.locator('.modal-body').evaluate(el=>el.scrollTop=0);
    await page.screenshot({path:'qa/v46/pottery-fix/'+theme+'-pottery-kiln-compact.png'});
    assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
    const close=await page.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<=780);
    kilnShot=true;if(visualOnly){visualFinished=true;break;}
   }
   if(s.mode==='reveal'&&!visualOnly&&s.kiln.reveal>.2&&!report.checks.some(v=>v.theme===theme&&v.flow==='reveal screenshot')){
    await page.locator('.modal-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'qa/v46/pottery-fix/'+theme+'-pottery-reveal-compact.png'});report.checks.push({theme,flow:'reveal screenshot'});
   }
   const a=directAction(s);if(a)await send(a);await page.waitForTimeout(80);
  }
  await release();
  if(visualOnly){assert(visualFinished);await page.locator('#closeModal').click();report.checks.push({theme,flow:'actual shape/glaze/kiln targeted visual',fixedClose:true,noOverflow:true});await context.close();continue;}
  const completed=await game();assert(completed?.result?.passed,JSON.stringify({mode:completed?.mode,result:completed?.result,status:completed?.status,kiln:completed?.kiln?.report}));
  assert(completed.kiln.report.passed&&completed.kiln.reveal>=3.4);assert(completed.kiln.report.inBand<=1&&completed.kiln.report.fidelity<=1);assert(glazed&&paused&&kilnShot);
  assert.equal((await get()).economy.playerGoods[recipe]||0,personal);assert.equal(JSON.stringify((await get()).resourceLedger.reservations[owner]),reserved);
  assert(await page.locator('[data-action="claim"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth+1}));
  await page.screenshot({path:'qa/v46/pottery-fix/'+theme+'-pottery-receipt-compact.png'});
  await page.evaluate(()=>window.detachedClaim=document.querySelector('[data-action="claim"]'));await page.locator('[data-action="claim"]').click();await page.evaluate(()=>window.detachedClaim.click());
  await page.waitForFunction(()=>!window.islandInspect().actor.action&&!window.islandInspect().roomGame,{},{timeout:18000});
  const after=await get();assert.equal(after.economy.playerGoods[recipe],personal+1);assert.equal(after.resourceLedger.reservations[owner],undefined);
  const receipt=after.resourceLedger.receipts[owner+':result'],[receiptOwner,cost,gain]=JSON.parse(receipt.signature);
  assert.equal(receiptOwner,owner);assert.equal(gain[recipe],1);assert.equal(receipt.delta[recipe],1);assert.deepEqual(cost,JSON.parse(reserved).items);
  report.checks.push({theme,flow:'challenge actual shape, assigned glazes, three-stage heat control and unique recipe production',seed,form:completed.level.formName,glazeBands:completed.level.glazeBands,recipe,
   pausePreserved:true,uniqueProduct:true,kiln:completed.kiln.report,result:completed.result,scriptWallSeconds:(Date.now()-startTime)/1000});
  await page.locator('#closeModal').click();await context.close();
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.badAssets.length,0,JSON.stringify(report.badAssets));report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:'qa/v46/pottery-fix/pottery-failure.png'}).catch(()=>{});throw e}
finally{await writeFile(visualOnly?'qa/v46/pottery-fix/visual-browser-report.json':'qa/v46/pottery-fix/pottery-browser-report.json',JSON.stringify(report,null,2));await engine?.close();server.kill()}
console.log(JSON.stringify(report));
