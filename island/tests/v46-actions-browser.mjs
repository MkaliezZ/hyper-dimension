import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v46',{recursive:true});const directory=await mkdtemp(resolve('qa/v46/browser-')),saves=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createZeroState());s.freshStartPending=false;s.player={x:445,y:360};s.inventory.axe=1;for(let i=0;i<17;i++)s.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};await saves.open(theme,{legacyState:s});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
let browser,page;const report={at:new Date().toISOString(),directory,scope:'Actual UI, real action animation clock, server disk and response-loss recovery. Isolated seeded axe; no external model requests or production saves.',themes:[],errors:[]};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/src/app.js')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
 const context=await browser.newContext({viewport:{width:1440,height:960}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>!!window.islandInspect);
 const choose=async(item,source='forest')=>{await page.locator('#gatherBtn').click();await page.locator('[data-source="'+source+'"]').click();await page.locator('[data-gather="'+item+'"]').click();};
 const untilDone=async()=>{await page.waitForSelector('#serverGather:not(.hidden)',{timeout:30000});await page.waitForSelector('#serverGather.hidden',{state:'attached',timeout:30000});};
 await choose('wood');await page.waitForSelector('#serverGather:not(.hidden)');await page.waitForFunction(()=>document.querySelector('#gatherHeading').textContent.includes('正在采集'));
 await page.screenshot({path:'qa/v46/'+theme+'-gather.png'});await page.waitForSelector('#serverGather.hidden',{state:'attached',timeout:30000});
 let doc=await saves.current(theme);assert.equal(doc.actions.receipts.length,1);assert.deepEqual(doc.actions.receipts[0].gain,{wood:2});assert.equal(doc.actions.active,null);
 assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);
 // A committed finish response disappears. Reload must recover this exact operation.
 let droppedFinish=false;
 await page.route('**/api/saves/'+theme+'/action',async route=>{const body=route.request().postDataJSON();if(body.operation==='finish'&&!droppedFinish){await route.fetch();droppedFinish=true;await route.abort('failed');}else await route.continue();});
 await choose('wood');await page.waitForFunction(()=>document.querySelector('#gatherHeading').textContent.includes('尚待确认'),{},{timeout:30000});
 assert(droppedFinish);doc=await saves.current(theme);const paidSequence=doc.actions.sequence;assert.equal(doc.actions.receipts.filter(r=>r.ticket.sequence===paidSequence).length,1);
 await page.reload();await page.waitForFunction(()=>!!window.islandInspect);await page.waitForTimeout(600);
 doc=await saves.current(theme);assert.equal(doc.actions.sequence,paidSequence);assert.equal(doc.actions.receipts.filter(r=>r.ticket.sequence===paidSequence).length,1);assert.equal(await page.locator('#serverGather').isHidden(),true);
 await page.unroute('**/api/saves/'+theme+'/action');
 // A committed begin response disappears. A new page must resume or cancel, never begin twice.
 let droppedBegin=false;
 await page.route('**/api/saves/'+theme+'/action',async route=>{const body=route.request().postDataJSON();if(body.operation==='begin'&&!droppedBegin){await route.fetch();droppedBegin=true;await route.abort('failed');}else await route.continue();});
 await choose('wood');await page.waitForFunction(()=>document.querySelector('#gatherHeading').textContent.includes('尚待确认'),{},{timeout:30000});
 doc=await saves.current(theme);const activeSequence=doc.actions.active.sequence;
 await page.reload();await page.waitForFunction(()=>document.querySelector('#gatherHeading')?.textContent.includes('继续上次'));
 await page.setViewportSize({width:390,height:820});await page.screenshot({path:'qa/v46/'+theme+'-recover-compact.png'});
 assert.equal(await page.locator('#serverGather').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
 await page.locator('#gatherRetry').click();await page.waitForSelector('#serverGather.hidden',{state:'attached',timeout:30000});
 doc=await saves.current(theme);assert.equal(doc.actions.sequence,activeSequence);assert.equal(doc.actions.receipts.at(-1).outcome,'finished');
 await page.unroute('**/api/saves/'+theme+'/action');await page.setViewportSize({width:1440,height:960});
 // Explicit cancel returns the exact reserved axe and grants no wood.
 await choose('wood');await page.waitForFunction(()=>document.querySelector('#gatherHeading').textContent.includes('正在采集'));await page.locator('#gatherCancel').click();await page.waitForSelector('#serverGather.hidden',{state:'attached',timeout:30000});
 doc=await saves.current(theme);assert.equal(doc.actions.receipts.at(-1).outcome,'cancelled');assert.deepEqual(doc.actions.receipts.at(-1).gain,{});assert(!Object.keys(doc.state.resourceLedger.reservations).some(k=>k.startsWith('server-gather:')));
 await choose('herb','greenhouse');await untilDone();doc=await saves.current(theme);assert.deepEqual(doc.actions.receipts.at(-1).gain,{herb:2});
 await choose('shell','shore');await untilDone();doc=await saves.current(theme);assert.deepEqual(doc.actions.receipts.at(-1).gain,{shell:2});
 report.themes.push({theme,actualAnimation:true,beginLossRecovered:true,finishLossExactlyOnce:true,cancelToolReturned:true,greenhouse:true,shore:true,compactNoOverflow:true});console.log(theme+' passed');await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:'qa/v46/browser-failure.png'}).catch(()=>{});report.ui=await page?.locator('#serverGather').innerText().catch(()=>null);}
finally{await browser?.close();server.kill();await writeFile('qa/v46/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
