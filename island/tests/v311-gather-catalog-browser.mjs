import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
const root=path.resolve(import.meta.dirname,'..'),appRoot=path.resolve(process.env.HD_QA_APP_ROOT||root),out=path.resolve(process.env.HD_QA_OUT||'qa/v311/native-gather-catalog');
await mkdir(out,{recursive:true});
const report={scope:'Owned native game, fictional saves, both styles. The real gather button opens the catalogue; an explicit call to the ordinary renderUI callback reproduces the unrelated HUD refresh that previously replaced it with the wonder book. No clock, action result, provider call or user data is injected. Original player-action test and deadlines remain unchanged. Not human or physical-device acceptance.',cases:[],passed:false};
const portFor=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;};
let browser;
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami']){
 const row={theme,errors:[],passed:false};report.cases.push(row);const directory=await mkdtemp(path.join(out,theme+'-')),saveDir=path.join(directory,'saves'),store=createSaveStore({directory:saveDir}),state=hydrateTown(createZeroState());state.freshStartPending=false;await store.open(theme,{legacyState:state,protect:true});
 const port=await portFor(),base='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'server.mjs'),'--theme='+theme,'--port='+port],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:saveDir,HD_RUN_LEDGER_DIR:path.join(directory,'runs'),HD_ENVIRONMENT_DIR:path.join(directory,'environment')}}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
 try{
  page.on('pageerror',e=>row.errors.push(e.message));
  await context.route('**/api/npc/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated model-free test"}'}));
  await context.route('**/api/hermes/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated model-free test"}'}));
  await context.route('**/src/**',async route=>{const url=new URL(route.request().url());if(path.extname(url.pathname)!=='.js')return route.continue();const file=path.resolve(appRoot,'.'+url.pathname);assert(file.startsWith(appRoot+path.sep));let body=await readFile(file,'utf8');if(url.pathname==='/src/app.js')body+='\nwindow.__gatherCatalogQA={refresh:()=>renderUI(),book:()=>collectionsUI.open(),prepare:async()=>{for(const n of npcs){runtime.releaseActor(n);n.manualUntil=1e9;}await saves.idle(theme);}};';await route.fulfill({status:200,contentType:'text/javascript',body});});
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await page.goto(base+'/?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce.ready&&!window.islandInspect().startup.busy,null,{timeout:60000});
  if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();await page.evaluate(()=>window.__gatherCatalogQA.prepare());
  await page.locator('#gatherBtn').click();assert.equal(await page.locator('.catalog-grid').evaluate(el=>getComputedStyle(el).display),'grid','native CSS must load with its correct MIME type');await page.evaluate(()=>window.__gatherCatalogQA.refresh());
  row.afterRefresh=await page.evaluate(()=>({gather:!!document.querySelector('#modalRoot [data-gather="wax"]'),book:!!document.getElementById('collectionWonders'),catalog:!!document.querySelector('#modalRoot .gather-catalog-modal')}));
  assert.equal(row.afterRefresh.gather,true,'ordinary HUD refresh must retain the gather choices');assert.equal(row.afterRefresh.book,false,'wonder-book painter must not replace the gather catalogue');assert.equal(row.afterRefresh.catalog,true);
  await page.locator('[data-source="mine"]').click();assert(await page.locator('[data-source="mine"].active').count());await page.evaluate(()=>window.__gatherCatalogQA.refresh());assert.equal(await page.locator('#collectionWonders').count(),0);assert(await page.locator('[data-gather]').count()>0);row.sourceTabsRemainInteractive=true;
  await page.locator('#closeModal').click();await page.evaluate(()=>window.__gatherCatalogQA.book());await page.locator('#collectionAchievements').click();await page.evaluate(()=>window.__gatherCatalogQA.refresh());assert.equal(await page.locator('#collectionAchievements').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-gather]').count(),0);assert.equal(await page.locator('.gather-catalog-modal').count(),0);row.wonderAndAchievementBookRetainsOwnPainter=true;
  await page.locator('#closeModal').click();await page.locator('#gatherBtn').click();await page.evaluate(()=>window.__gatherCatalogQA.refresh());assert.equal(await page.locator('[data-gather="wax"]').count(),1);assert.equal(await page.locator('#collectionWonders').count(),0);row.returnToGatherPassed=true;assert.deepEqual(row.errors,[]);await page.screenshot({path:path.join(out,theme+'-confirmed.png')});row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});}
 finally{await context.close();if(server.exitCode===null){const ended=new Promise(r=>server.once('close',r));server.kill();await ended;}await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
}report.passed=report.cases.every(r=>r.passed);
}finally{await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,passed:r.passed,afterRefresh:r.afterRefresh,failure:r.failure}))}));}
