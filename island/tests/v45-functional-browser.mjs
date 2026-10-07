import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import {createServer} from 'node:http';import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';import {hydrateTown} from '../src/townSimulation.js';import {hydratePlacements,decorate,checkDecoration} from '../src/placements.js';import {hydrateFunctionalFacilities,functionalUnit} from '../src/functionalFacilities.js';import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v45',{recursive:true});const directory=await mkdtemp(resolve('qa/v45/browser-')),saves=createSaveStore({directory}),ids={};
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());s.freshStartPending=false;s.journey={completed:{harvest:true}};hydratePlacements(s,theme);ids[theme]={};
 for(const item of ['c14_6','c6_8','c1_9']){
  const candidates=[];for(let y=88;y<820;y+=16)for(let x=88;x<1430;x+=16){const d=Math.hypot(x-430,y-703);if(item==='c14_6'&&d>300)continue;candidates.push({item,x,y,rotation:0,d});}candidates.sort((a,b)=>a.d-b.d);
  const p=candidates.find(p=>checkDecoration(s,p,{theme}).ok);assert(p,item+' no position');s.inventory[item]=1;
  const r=decorate(s,{commandId:'seed:'+item,action:'place',...p},{theme});assert(r.ok,r.reason);ids[theme][item]=r.id;
 }
 hydrateFunctionalFacilities(s);s.inventory.c6_5=2;s.inventory.shrimp=2;s.inventory.c6_0=2;s.inventory.tea=3;s.inventory.wood=1;s.inventory.seaweed=2;s.inventory.sand=2;
 for(let i=0;i<17;i++)s.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2,mood:'平静'};s.npcCareers[0]={phase:1,completed:0,history:[],lastResult:''};
 // Browser irrigation alone owns plot 2 for the short initial test. NPC career starts at nursery, not farm.
 Object.assign(s.plots[2],{stage:2,crop:'wheat',growth:0});
 await saves.open(theme,{legacyState:s,clientId:'functional-fixture'});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={at:new Date().toISOString(),directory,scope:'Actual dual-theme UI, pointer controls, NPC outdoor walking/drinking, real save HTTP and disk. Inventory/placements are explicit isolated fixtures. Nursery elapsed time accelerated via domain tick for QA, not a four-minute real-time acceptance. All model/real services blocked.',checks:[],errors:[],badImages:[]};let engine,page;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated functional QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url());});
  const inspect=()=>page.evaluate(()=>window.islandInspect());
  const open=async item=>{await page.locator('#bagBtn').click();await page.locator('#openDecorations').click();await page.locator('[data-place-display="'+ids[theme][item]+'"]').click();await page.locator('#placementFunctional').click();};
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().functionalArt?.pixel?.loaded&&window.islandInspect?.().functionalArt?.origami?.loaded);
  await open('c14_6');await page.locator('#functionalLoad').click();await page.locator('[data-functional-plot="2"]').check();await page.locator('#functionalEnabled').check();await page.locator('#functionalConfigure').click();
  await page.waitForFunction(id=>window.islandInspect().functionalFacilities.units[id].delivered>=1,ids[theme].c14_6,{timeout:30000});
  const watered=await inspect();assert.equal(watered.plots[2].stage,3);assert.equal(watered.functionalFacilities.units[ids[theme].c14_6].charges,7);assert(watered.plots[2].growth<10);await page.screenshot({path:'qa/v45/'+theme+'-irrigation.png'});
  await page.locator('#functionalEnabled').uncheck();await page.locator('#functionalConfigure').click();await page.locator('#closeModal').click();
  await open('c6_8');await page.locator('#functionalLoad').click();await page.waitForTimeout(1200);await page.locator('#functionalPause').click();const paused=await inspect(),elapsed=paused.functionalFacilities.units[ids[theme].c6_8].elapsed;assert(elapsed>0&&elapsed<10);assert.equal(paused.inventory.shrimp,1);await page.screenshot({path:'qa/v45/'+theme+'-nursery-paused.png'});
  await page.waitForTimeout(600);assert.equal((await inspect()).functionalFacilities.units[ids[theme].c6_8].elapsed,elapsed);
  await page.reload();await page.waitForFunction(()=>!!window.islandInspect?.().functionalFacilities);assert.equal((await inspect()).functionalFacilities.units[ids[theme].c6_8].elapsed,elapsed);
  await open('c6_8');await page.locator('#functionalPause').click();
  await page.evaluate(async()=>{const f=await import('/src/functionalFacilities.js');f.tickFunctionalFacilities(window.islandInspect(),240);});
  await page.waitForSelector('#functionalHarvest');await page.locator('#functionalHarvest').click();assert.equal((await inspect()).inventory.shrimp,4);assert.equal((await inspect()).functionalFacilities.units[ids[theme].c6_8].delivered,3);
  await page.locator('#functionalClear').click();assert.equal((await inspect()).placedItems.length,3);assert(await page.locator('#functionalClearWarning').isVisible());await page.locator('#closeModal').click();
  await open('c1_9');const teaBefore=(await inspect()).inventory.tea;await page.locator('#functionalLoad').click();const teaAfter=(await inspect()).inventory.tea;assert.equal(teaBefore-teaAfter,3);await page.evaluate(async()=>{const f=await import('/src/functionalFacilities.js');f.tickFunctionalFacilities(window.islandInspect(),12);});
  await page.waitForFunction(id=>window.islandInspect().functionalFacilities.units[id].phase==='ready',ids[theme].c1_9);await page.waitForFunction(()=>document.querySelector('#functionalState')?.textContent.includes('待客 3 杯'));await page.screenshot({path:'qa/v45/'+theme+'-tea-ready.png'});
  await page.locator('#closeModal').click();
  await page.evaluate(()=>{const s=window.islandInspect();s.npcNeeds[0].hunger=40;s.npcNeeds[0].energy=85;});
  const teaId=ids[theme].c1_9;
  await page.waitForFunction(id=>window.islandInspect().npcs.some(n=>n.intent?.facilityId===id),teaId,{timeout:150000});
  const walking=await inspect();assert(walking.npcs[0].intent.facilityId===teaId);assert.equal(walking.npcs[0].inside,null);
  await page.waitForFunction(id=>window.islandInspect().npcs[0].intent?.facilityId===id&&window.islandInspect().npcs[0].action==='eat',teaId,{timeout:100000});
  const eating=await inspect(),p=eating.placedItems.find(p=>p.id===teaId),n=eating.npcs[0];assert(Math.hypot(p.x-n.x,p.y-n.y)<85);await page.screenshot({path:'qa/v45/'+theme+'-npc-tea-world.png'});
  await page.waitForFunction(id=>window.islandInspect().functionalFacilities.units[id].servings===2,teaId,{timeout:30000});
  const after=await inspect();assert(after.npcNeeds[0].hunger>35);assert(after.inventory.tea>=0);assert.equal(after.functionalFacilities.units[teaId].delivered,1);
  await open('c1_9');await page.setViewportSize({width:390,height:820});await page.locator('.modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);
  assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);const close=await page.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<820);const footer=await page.locator('.modal-footer').boundingBox();assert(footer.y+footer.height<=821);await page.screenshot({path:'qa/v45/'+theme+'-compact-bottom.png'});
  await page.waitForFunction(id=>window.islandInspect().npcs.every(n=>n.intent?.facilityId!==id),teaId,{timeout:30000});await page.locator('#functionalClear').click();assert.equal((await inspect()).functionalFacilities.units[teaId].servings,2);assert(await page.locator('#functionalClearWarning').isVisible());await page.locator('#functionalClear').click();assert.equal((await inspect()).functionalFacilities.units[teaId].servings,0);
  await page.locator('#functionalBack').click();await page.locator('[data-place-display="'+teaId+'"]').click();await page.locator('#placementStore').click();assert.equal((await inspect()).inventory.c1_9,1);
  let persisted=false;for(let i=0;i<60;i++){const doc=await saves.current(theme);if(!doc.state.functionalFacilities.units[teaId]){persisted=true;break;}await page.waitForTimeout(100);}assert(persisted);
  await page.reload();await page.waitForFunction(()=>!!window.islandInspect?.().functionalFacilities);assert.equal((await inspect()).placedItems.length,2);assert.equal((await inspect()).inventory.c1_9,1);
  report.checks.push({theme,irrigation:true,charges:7,cropStillGrowing:true,pausedReopenedExact:true,nurseryYield:3,actualNpcWalk:true,actualOutdoorTea:true,teaSpent:3,servingSpent:1,hungerRecovered:true,clearRequiresSecondClick:true,compactNoOverflow:true,fixedClose:true,reclaimedFacilitySurvivesReload:true});console.log(JSON.stringify({theme,passed:true}));await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);report.passed=true;
}catch(e){process.exitCode=1;report.failure=e.stack;await page?.screenshot({path:'qa/v45/browser-failure.png'}).catch(()=>{});report.snapshot=await page?.evaluate(()=>window.islandInspect?.()).catch(()=>null);}
finally{await engine?.close();server.kill();await writeFile('qa/v45/functional-browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors,failure:report.failure}));}
