import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {rasterTransform} from '../src/rasterQuality.js';
await mkdir('qa/v34',{recursive:true});const directory=await mkdtemp(resolve('qa/v34/browser-')),saves=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createZeroState());s.freshStartPending=false;s.inventory.lantern=3;s.inventory.pottery=1;s.economy.playerGoods.lantern=3;s.economy.playerGoods.pottery=1;await saves.open(theme,{legacyState:s,clientId:'art-fixture'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,kind:'Actual dual-theme placement UI, pointer/keyboard/cancel/rotate/place/move/reclaim, world navigation and independent disk reload. Seeded handmade goods are an explicit UI fixture; not a new zero-start human acceptance.',checks:[],errors:[],badImages:[]};
let engine,page;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const ctx=await engine.newContext({viewport:{width:1440,height:1000}});
  await ctx.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated placement QA"}'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url());});
  const get=()=>page.evaluate(()=>window.islandInspect());
  const point=async(x,y)=>{const v=await get(),box=await page.locator('#game').boundingBox(),t=rasterTransform(v.camera.width,v.camera.height,v.worldExtent.width,v.worldExtent.height,v.zoom,v.camera,...v.rendering.density);return {x:box.x+t.ox+x*t.scale,y:box.y+t.oy+y*t.scale};};
  const move=async(x,y)=>{const p=await point(x,y);await page.mouse.move(p.x,p.y);await page.waitForTimeout(180);};
  const book=async()=>{await page.locator('#bagBtn').click();await page.locator('#openDecorations').click();};
  const begin=async(item)=>{await page.locator('#bagBtn').click();await page.locator('[data-item="'+item+'"]').click();await page.locator('#itemUse').click();};
  const confirm=async()=>{await page.waitForFunction(()=>!!window.islandInspect().placementPreview?.legal.ok,{},{timeout:30000});await page.locator('#placementConfirm').click();};
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().contentArts.metadata>0);
  await begin('lantern');assert.equal((await get()).inventory.lantern,3);await move(800,560);await page.keyboard.press('r');assert.equal((await get()).placementPreview.rotation,1);
  await page.screenshot({path:'qa/v34/'+theme+'-preview.png'});await page.locator('#placementCancel').click();assert.equal((await get()).inventory.lantern,3);assert.equal((await get()).placedItems.length,0);
  await begin('lantern');await move(800,560);await page.keyboard.press('r');await confirm();assert.equal((await get()).inventory.lantern,2);assert.equal((await get()).placedItems[0].rotation,1);
  await book();await page.locator('[data-place-item="pottery"]').click();await move(720,568);await confirm();assert.equal((await get()).placedItems.length,2);
  const first=(await get()).placedItems.find(p=>p.item==='lantern').id;await book();await page.locator('[data-place-display="'+first+'"]').click();await page.locator('#placementMove').click();
  await move(848,560);await page.keyboard.press('r');await confirm();const moved=(await get()).placedItems.find(p=>p.id===first);assert.equal(moved.x,848);assert.equal(moved.rotation,2);assert.equal((await get()).inventory.lantern,2);
  const routes=await page.evaluate(async()=>{const w=await import('/src/world.js');return {blocked:!w.worldWalkable(848,560),entries:w.SLOTS.map(p=>w.findPath(w.HARBOR.entrance,p.entry).length)};});assert(routes.blocked);assert(routes.entries.every(Boolean));
  await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});await page.screenshot({path:'qa/v34/'+theme+'-world.png'});
  let persisted=false;for(let i=0;i<100;i++){const d=await saves.current(theme);if(d.state.placedItems.length===2&&d.state.placedItems.find(p=>p.id===first)?.x===848){persisted=true;break}await page.waitForTimeout(100);}assert(persisted);
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().placedItems.length===2);
  assert.equal((await get()).placedItems.find(p=>p.id===first).rotation,2);await book();await page.setViewportSize({width:390,height:820});
  assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:'qa/v34/'+theme+'-compact.png'});
  await page.locator('[data-place-display="'+first+'"]').click();await page.locator('#placementStore').click();assert.equal((await get()).inventory.lantern,3);assert.equal((await get()).placedItems.length,1);
  await page.locator('[data-place-display]').click();await page.locator('#placementStore').click();assert.equal((await get()).inventory.pottery,1);assert.equal((await get()).placedItems.length,0);
  report.checks.push({theme,cancelConserved:true,rotation:2,twoDecorations:true,allEntrancesReachable:true,reloaded:true,personalCreditsRestored:(await get()).economy.playerGoods.lantern===3,compactOverflow:false});await ctx.close();
 }
 const switchContext=await engine.newContext({viewport:{width:1440,height:1000}});await switchContext.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated placement QA"}'}));page=await switchContext.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?qa=1&theme=pixel');await page.locator('#bagBtn').click();await page.locator('[data-item="lantern"]').click();await page.locator('#itemUse').click();await page.locator('#themeOrigami').click();await page.waitForFunction(()=>window.islandInspect().theme==='origami');assert.equal(await page.locator('#placementToolbar').count(),0);assert.equal((await page.evaluate(()=>window.islandInspect())).placementBook.theme,'origami');await page.locator('#themePixel').click();await page.waitForFunction(()=>window.islandInspect().theme==='pixel');assert.equal((await page.evaluate(()=>window.islandInspect())).placementBook.theme,'pixel');report.themeSwitchCancelsPreview=true;await switchContext.close();
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:'qa/v34/browser-failure.png'}).catch(()=>{});report.snapshot=await page?.evaluate(()=>window.islandInspect?.()).catch(()=>null);}
finally{await engine?.close();server.kill();await writeFile('qa/v34/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
