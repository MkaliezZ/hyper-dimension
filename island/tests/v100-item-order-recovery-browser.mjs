import {browserLaunchOptions} from './browserRuntime.mjs';
import {chromium}from'playwright-core';import{spawn}from'node:child_process';import{mkdir,mkdtemp,writeFile}from'node:fs/promises';import{resolve,join}from'node:path';import{createServer}from'node:net';import assert from'node:assert/strict';import{rasterTransform}from'../src/rasterQuality.js';import{createSaveStore}from'../server/saveStore.mjs';
const out=resolve(process.env.HD_QA_ZERO_OUT||'qa/v100/order-recovery');await mkdir(out,{recursive:true});
const report={at:new Date().toISOString(),scope:'Actual zero first day and axe gathering; item-detail native double-click; lost HTTP response after server commits; 390px accessible recovery; exact single cash/stock/credit receipt and reload. No state/time/stock injection; providers blocked. Automated targeted fault test, not full gameplay acceptance.',cases:[],errors:[],badAssets:[],apiErrors:[]};
let browser;const sessions=[];
async function port(){const p=createServer();await new Promise(r=>p.listen(0,'127.0.0.1',r));const n=p.address().port;await new Promise(r=>p.close(r));return n;}
async function run(theme){
 const directory=await mkdtemp(join(out,theme+'-data-')),store=createSaveStore({directory:join(directory,'saves')}),n=await port(),base='http://127.0.0.1:'+n,row={theme,directory,steps:[],orderReceipts:[],apiActions:0};report.cases.push(row);
 const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+n,'--theme='+theme],{windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,DEEPSEEK_API_KEY:'',HD_MODEL_ENDPOINT:'http://127.0.0.1:9',HD_SAVE_DIR:join(directory,'saves'),HD_RUN_DIR:join(directory,'runs'),HD_HERMES_HOME:join(directory,'hermes'),HD_STEWARD_WORKDIR:join(directory,'documents')}});
 let logs='';server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
 const context=await browser.newContext({viewport:{width:1440,height:960}});await context.route('**/api/**',r=>{const u=r.request().url();return u.includes('/api/saves/')||u.endsWith('/api/status')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated first-day UI: model calls blocked"}'});});
 const page=await context.newPage(),session={theme,row,server,context,page};sessions.push(session);
 page.on('pageerror',e=>report.errors.push({theme,message:e.message}));page.on('response',r=>{if(r.status()>=400&&r.url().includes('/assets/'))report.badAssets.push({theme,url:r.url()});if(r.status()>=400&&r.url().includes('/api/saves/'))report.apiErrors.push({theme,status:r.status(),url:r.url()});if(r.url().endsWith('/action')&&r.request().method()==='POST')row.apiActions++;});
 const inspect=()=>page.evaluate(()=>window.islandInspect()),ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverPersonal?.ready&&window.islandInspect().serverCommerce?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'),{},{timeout:45000}),close=async()=>{if(await page.locator('#closeModal').count())await page.locator('#closeModal').click();};
 const save=async()=>{await writeFile(join(out,'progress.json'),JSON.stringify(report,null,2));};
 const step=async name=>{const s=await inspect();row.steps.push({name,at:new Date().toISOString(),gameSeconds:s.now,coins:s.coins,journey:structuredClone(s.journey.stats)});console.log(JSON.stringify({theme,step:name,coins:s.coins,seconds:s.now}));await save();};
 const clickScene=async p=>{const s=await inspect(),box=await page.locator('#game').boundingBox(),t=rasterTransform(s.camera.width,s.camera.height,1000,660,s.zoom,s.camera,...s.rendering.density);await page.mouse.click(box.x+t.ox+p.x*t.scale,box.y+t.oy+p.y*t.scale);};
 const clickPlot=async index=>{const s=await inspect(),q=s.farmPlots[index],p=q.corners.reduce((a,p)=>({x:a.x+p.x/4,y:a.y+p.y/4}),{x:0,y:0});await clickScene(p);};
 try{
  let up=false;for(let i=0;i<120;i++){try{up=(await fetch(base+'/api/status')).ok;if(up)break}catch{}await new Promise(r=>setTimeout(r,100));}assert(up);
  await page.goto(base+'/?qa=1&theme='+theme);await ready();let s=await inspect();assert.equal(s.coins,0);assert(Object.values(s.inventory).every(x=>x===0));assert.equal(s.economy.townDays.length,0);assert.equal(s.journey.stats.orders,0);row.serverZero=true;await page.screenshot({path:join(out,theme+'-zero.png')});await page.locator('#startFirstDay').click();await step('server-zero-first-day');
  await page.locator('#stewardBtn').click();await page.waitForFunction(()=>window.islandInspect().journey.stats.met);await close();await step('met-own-Hermes-butler');
  const gatherWood=async()=>{const old=(await inspect()).journey.stats.gathered.wood||0;await close();await page.locator('#gatherBtn').click();await page.locator('[data-gather="wood"]').click();await page.waitForFunction(old=>(window.islandInspect().journey.stats.gathered.wood||0)>old&&!window.islandInspect().actor.action,old,{timeout:60000});};
  await gatherWood();await gatherWood();assert((await inspect()).journey.stats.gathered.wood>=3);await step('two-real-axe-gathers');
  // Exercise the previously broken item-detail delivery entry, not just business UI.

  let lostReceipt=null;
  await page.route('**/api/saves/'+theme+'/action',async route=>{
   const input=route.request().postDataJSON();
   if(input.kind==='commerce'&&input.operation==='order'&&!lostReceipt){
    const response=await route.fetch();assert(response.ok());const result=await response.json();assert(result.receipt);lostReceipt=result.receipt;await route.abort('failed');return;
   }
   await route.continue();
  });
  await page.locator('#bagBtn').click();await page.locator('[data-item="wood"]').click();await page.locator('#itemOrder:enabled').waitFor();
  const before=await store.current(theme);await page.locator('#itemOrder').click({clickCount:2});
  await page.waitForFunction(()=>window.islandInspect().serverCommerce.locked,{},{timeout:30000});assert(lostReceipt);assert.equal(lostReceipt.cashDelta,6);assert.equal(lostReceipt.stockDelta.wood,-3);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(out,theme+'-order-result-unknown-390.png')});
  assert(await page.locator('#commerceRetry').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}));
  await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),page.locator('#commerceRetry').click()]);await ready();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.locked===false);
  let d=await store.current(theme);assert.equal(d.actions.receipts.filter(r=>r.ticket.requestId===lostReceipt.ticket.requestId).length,1);
  assert.equal(d.state.economy.cashLedger.filter(r=>r.category==='order').length,1);assert.equal(d.state.journey.stats.orders,1);assert.equal(d.state.economy.playerGoods.wood,before.state.economy.playerGoods.wood-3);
  await close();await page.locator('#bagBtn').click();await page.locator('[data-item="wood"]').click();assert(await page.locator('#itemOrder').isDisabled());assert.equal(await page.locator('#itemOrder').textContent(),'今日已交付');
  await page.screenshot({path:join(out,theme+'-order-recovered-390.png')});await close();
  await page.reload();await ready();d=await store.current(theme);
  assert.equal(d.state.journey.stats.orders,1);assert.equal(d.actions.receipts.filter(r=>r.ticket.requestId===lostReceipt.ticket.requestId).length,1);assert.equal(d.state.economy.cashLedger.filter(r=>r.category==='order').length,1);
  await page.locator('#bagBtn').click();await page.locator('[data-item="wood"]').click();assert(await page.locator('#itemOrder').isDisabled());
  row.orderReceipts.push(lostReceipt.ticket.requestId);row.doubleClickAndLostResponsePaidOnce=true;row.compactRecoveryButtonsClickable=true;row.reloadPreserved=true;row.passed=true;await step('item-detail-double-click-lost-response-recovered-once');
 }catch(e){row.passed=false;row.failure=e.stack;row.last=await page.evaluate(()=>window.islandInspect?.()).catch(()=>null);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
 finally{await writeFile(join(out,theme+'-server.log'),logs);await context.close().catch(()=>{});const done=new Promise(r=>server.once('close',r));server.kill();await done;await save();}
}
try{browser=await chromium.launch(browserLaunchOptions());const runs=await Promise.allSettled(['pixel','origami'].map(run));for(const r of runs)if(r.status==='rejected')report.errors.push({message:r.reason.message});assert(report.cases.every(c=>c.passed));assert.equal(report.errors.length,0);assert.equal(report.badAssets.length,0);assert.equal(report.apiErrors.length,0);report.passed=true;}
catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,steps:c.steps,passed:c.passed,failure:c.failure})),errors:report.errors,apiErrors:report.apiErrors}));}
