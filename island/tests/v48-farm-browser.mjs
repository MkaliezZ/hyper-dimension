import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import {createServer} from 'node:http';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';
import {createSaveStore} from '../server/saveStore.mjs';import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {hydrateJourney} from '../src/journey.js';import {queueTask} from '../src/taskBoard.js';
import {hydratePlacements,decorate,checkDecoration} from '../src/placements.js';import {hydrateFunctionalFacilities,functionalCommand} from '../src/functionalFacilities.js';
const out='qa/v48';await mkdir(out,{recursive:true});const directory=await mkdtemp(resolve(out+'/browser-')),store=createSaveStore({directory}),unitIds={};
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());hydrateJourney(s);s.freshStartPending=false;s.inventory.seed=3;s.inventory.hoe=1;s.inventory.watering_can=1;s.inventory.sickle=1;s.coins=500;
 for(let i=0;i<17;i++)s.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};
 for(let i=1;i<8;i++)s.plots[i]={stage:3,growth:0,crop:'cotton'};s.plots[1]={stage:4,growth:180,crop:'wheat'};s.plots[2]={stage:2,growth:0,crop:'herb'};
 queueTask(s,{id:'browser-farm-task',npcId:0,goal:'farm',intent:'收集小麦',quantity:2},{targetItem:'wheat'});
 hydratePlacements(s,theme);hydrateFunctionalFacilities(s);s.inventory.c14_6=1;s.inventory.c6_5=1;let pos;
 for(let y=624;y<790&&!pos;y+=16)for(let x=344;x<640;x+=16)if(checkDecoration(s,{item:'c14_6',x,y,rotation:0},{theme}).ok){pos={x,y};break}assert(pos);
 const placed=decorate(s,{commandId:'browser-place',action:'place',item:'c14_6',...pos,rotation:0},{theme});assert(placed.ok);unitIds[theme]=placed.id;hydrateFunctionalFacilities(s);
 assert(functionalCommand(s,{commandId:'browser-filter',displayId:placed.id,action:'load',expectedRevision:s.functionalFacilities.revision}).ok);
 assert(functionalCommand(s,{commandId:'browser-connect',displayId:placed.id,action:'configure',targets:[2],enabled:true,expectedRevision:s.functionalFacilities.revision}).ok);
 const d=(await store.open(theme,{legacyState:s})).document;await store.action(theme,{kind:'farm',operation:'enable',requestId:randomUUID(),expectedVersion:d.version});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={at:new Date().toISOString(),directory,scope:'Actual dual-theme farm pointer/controls, real action and mature clocks, NPC and irrigation. Isolated fixture seed/tools, one task and one loaded irrigation; no production save writes or model providers. Scripted play is not human skill/economy evidence.',themes:[],errors:[]};let browser;const pages=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/src/app.js')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 await Promise.all(['pixel','origami'].map(async theme=>{
  const context=await browser.newContext({viewport:{width:1440,height:960}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated farm QA"}'}));
  const page=await context.newPage();pages.push({theme,page});page.on('pageerror',e=>report.errors.push(theme+': '+e.message));await page.goto(base+'/?qa=1&scene=farm&theme='+theme);await page.waitForFunction(()=>!!window.islandInspect&&!!window.islandInspect().serverFarm);
  const clickPlot=async index=>{await page.waitForFunction(()=>Math.abs(window.islandInspect().camera.width-document.querySelector('#game').getBoundingClientRect().width)<1);const p=await page.evaluate(async index=>{const m=await import('/src/rasterQuality.js'),s=window.islandInspect(),q=s.farmPlots[index],r=document.querySelector('#game').getBoundingClientRect(),p=q.corners.reduce((o,p)=>({x:o.x+p.x/4,y:o.y+p.y/4}),{x:0,y:0}),t=m.rasterTransform(s.camera.width,s.camera.height,1000,660,s.zoom,s.camera,...s.rendering.density);return {x:r.left+t.ox+p.x*t.scale,y:r.top+t.oy+p.y*t.scale}},index);await page.mouse.click(p.x,p.y)};
  let lostBegin=false;
  await page.route('**/api/saves/'+theme+'/action',async r=>{const b=r.request().postDataJSON();if(b.kind==='farm'&&b.actor==='player'&&b.operation==='begin'&&!lostBegin){await r.fetch();lostBegin=true;await r.abort('failed')}else await r.continue()});
  await clickPlot(0);await page.waitForSelector('#serverFarm:not(.hidden)',{timeout:30000});await page.waitForFunction(()=>document.querySelector('#farmHeading').textContent.includes('尚待确认'),{},{timeout:30000});assert(lostBegin);
  const seq=(await store.current(theme)).actions.active.sequence;await page.reload();await page.waitForFunction(()=>document.querySelector('#farmHeading')?.textContent.includes('继续上次'),{},{timeout:30000});
  await page.setViewportSize({width:390,height:820});await page.screenshot({path:out+'/'+theme+'-farm-recovery-compact.png'});assert.equal(await page.locator('#serverFarm').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
  await page.locator('#farmRetry').click();await page.waitForFunction(()=>window.islandInspect().plots[0].stage===1,{},{timeout:30000});assert.equal((await store.current(theme)).actions.receipts.filter(r=>r.ticket.sequence===seq).length,1);await page.unroute('**/api/saves/'+theme+'/action');
  await page.setViewportSize({width:1440,height:960});await clickPlot(0);await page.locator('[data-crop="wheat"]').click();await page.waitForFunction(()=>window.islandInspect().plots[0].stage===2,{},{timeout:30000});
  await clickPlot(0);await page.waitForFunction(()=>window.islandInspect().actor.action==='water',{},{timeout:10000});await page.screenshot({path:out+'/'+theme+'-farm-water.png'});
  await page.waitForFunction(()=>window.islandInspect().plots[0].stage===3,{},{timeout:30000});const wateredAt=Date.now();
  let lostSave=false;
  await page.route('**/api/saves/'+theme+'/save',async r=>{const b=r.request().postDataJSON();if(b.saveId&&b.activeSeconds>0&&!lostSave){await r.fetch();lostSave=true;await r.abort('failed')}else await r.continue()});
  await page.waitForFunction(()=>document.querySelector('#saveStatus').dataset.status==='offline',{},{timeout:15000});assert(lostSave);
  const growthBefore=(await store.current(theme)).state.plots[0].growth;await page.reload();await page.waitForFunction(()=>!!window.islandInspect,{},{timeout:30000});
  await page.unroute('**/api/saves/'+theme+'/save');assert((await store.current(theme)).state.plots[0].growth>=growthBefore);assert((await store.current(theme)).state.plots[0].growth<=growthBefore+1);
  console.log(theme+' growing from '+growthBefore.toFixed(2)+' effective seconds');
  await page.waitForFunction(()=>window.islandInspect().plots[0].stage===4,{},{timeout:420000});
  const matureWallSeconds=(Date.now()-wateredAt)/1000;assert(matureWallSeconds>=178);let d=await store.current(theme);assert.equal(d.state.plots[0].growth,180);
  assert(d.actions.receipts.some(r=>r.ticket.actor==='npc'&&r.ticket.index===1&&r.ticket.step==='harvest'&&r.outcome==='finished'));
  const task=d.state.agentTaskLedger.find(t=>t.id==='browser-farm-task');assert.equal(task.status,'done');assert.equal(task.completed,2);assert.equal(task.evidence.length,1);
  assert(d.actions.receipts.some(r=>r.ticket.actor==='facility'&&r.ticket.index===2&&r.outcome==='finished'));assert.equal(d.state.functionalFacilities.units[unitIds[theme]].charges,7);
  await page.screenshot({path:out+'/'+theme+'-farm-mature.png'});
  let lostFinish=false;
  await page.route('**/api/saves/'+theme+'/action',async r=>{const b=r.request().postDataJSON();if(b.kind==='farm'&&b.operation==='finish'&&!lostFinish){const active=(await store.current(theme)).actions.active;if(active?.requestId===b.requestId&&active.actor==='player'){await r.fetch();lostFinish=true;await r.abort('failed');return}}await r.continue()});
  await clickPlot(0);await page.waitForFunction(()=>document.querySelector('#farmHeading').textContent.includes('尚待确认'),{},{timeout:30000});assert(lostFinish);d=await store.current(theme);const harvested=d.actions.receipts.findLast(r=>r.ticket.actor==='player'&&r.ticket.step==='harvest');assert(harvested);assert.deepEqual(harvested.gain,{wheat:2,seed:1});
  await page.reload();await page.waitForFunction(()=>!!window.islandInspect);await page.waitForTimeout(600);d=await store.current(theme);assert.equal(d.actions.receipts.filter(r=>r.ticket.sequence===harvested.ticket.sequence).length,1);assert.equal(d.state.economy.playerGoods.wheat,2);assert.equal(await page.locator('#app').evaluate(e=>e.inert),false);
  await page.unroute('**/api/saves/'+theme+'/action');
  report.themes.push({theme,realPlotPointerAndTool:true,beginLossRefreshContinue:true,clockSaveLossRefresh:true,realMatureWallSeconds:matureWallSeconds,realMatureEffectiveSeconds:180,npcActualTaskDelivery:true,irrigationActualThreeSecondWork:true,irrigationOneCharge:true,harvestLossExactlyOnce:true,compactNoOverflow:true});
  console.log(theme+' full farm passed');await context.close();
 }));
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;for(const {theme,page}of pages){await page.screenshot({path:out+'/'+theme+'-farm-failure.png'}).catch(()=>{});report[theme]=await page.evaluate(()=>window.islandInspect?.()).catch(()=>null)}}
finally{await browser?.close();server.kill();await writeFile(out+'/farm-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,themes:report.themes,errors:report.errors,failure:report.failure}));}
