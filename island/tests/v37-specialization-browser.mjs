import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {ALL_RECIPES,commitRecipe} from '../src/contentCatalog.js';
import {recordPlayerGoods,reserveParty,completeParty} from '../src/economy.js';
import {trackJourney,hydrateJourney} from '../src/journey.js';
import {nextOperationId} from '../src/resourceLedger.js';
import {hydrateSpecialization,specializationOffer} from '../src/specialization.js';
await mkdir('qa/v37',{recursive:true});
const directory=await mkdtemp(resolve('qa/v37/browser-')),saves=createSaveStore({directory});
function fixture(){
 const s=hydrateTown(createZeroState());s.freshStartPending=false;hydrateJourney(s);s.coins=200;
 for(const id of Object.keys(s.inventory))s.inventory[id]=20;
 for(const f of Object.values(s.facilities)){f.upgrades=4;f.quality=95;f.condition=100;}
 const p=reserveParty(s);assert(p);completeParty(s,3);s.activities++;trackJourney(s,'party',{kind:'night',eventId:p.id});
 for(const [i,id] of ['lantern','hoe','pottery','c15_1'].entries()){
  s.day=i<2?1:2;const r=ALL_RECIPES.find(r=>r.item===id),command=nextOperationId(s,'player:craft')+':result';
  assert(commitRecipe(r,s,{commandId:command}));recordPlayerGoods(s,id);trackJourney(s,'craft',{item:id,building:r.building,quality:80,commandId:command});
 }
 hydrateSpecialization(s);
 // The isolated fixture selects a repeatable wooden lamp commission to exercise native joinery input.
 for(let i=0;i<10000;i++){s.saveSlot='career-browser-'+i;if(specializationOffer(s,'artisan').item==='lantern')break;}
 assert.equal(specializationOffer(s,'artisan').item,'lantern');
 return s;
}
for(const theme of ['pixel','origami'])await saves.open(theme,{legacyState:fixture(),clientId:'specialization-fixture'});
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,kind:'Isolated rule-generated prior personal progression and stock fixtures. Real dual-theme UI acceptance, native joinery game, character crafting, commission payment, ceremony, disk reload. Provider calls blocked; not human zero-start or economy acceptance.',checks:[],errors:[],badImages:[]};let engine,activePage;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated career QA"}'}));
  const page=await context.newPage();activePage=page;page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url());if(r.url().includes('/api/saves/')&&r.status()>=400)report.errors.push('save '+r.status())});
  const get=()=>page.evaluate(()=>window.islandInspect());
  const open=async()=>{await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'));if(await page.locator('#closeModal').count())await page.locator('#closeModal').click();await page.locator('#helpBtn').click();await page.locator('#journalSpecialization').click();await page.waitForSelector('.specialization-modal');};
  const decode=()=>page.evaluate(async()=>{await Promise.all([...new Set([...document.querySelectorAll('.specialization-modal image')].map(e=>e.getAttribute('href')))].map(async url=>{const i=new Image();i.src=url;await i.decode()}));await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&window.islandInspect?.().serverPersonal?.ready&&!document.querySelector('#app')?.hasAttribute('aria-busy'));
  assert.match(await page.locator('#questList').textContent(),/首盏星灯/,'the pending first-light milestone retains its own guidance');
  await open();assert.equal(await page.locator('.specialization-path').count(),3);await page.locator('[data-select-path="artisan"]').click();assert.equal((await get()).specialization.selected,'artisan');
  await page.locator('#careerAccept').click();assert.equal((await get()).specialization.commission.item,'lantern');assert(await page.locator('#careerDeliver').isDisabled());
  await decode();await page.screenshot({path:'qa/v37/'+theme+'-specialization-desktop.png'});
  await page.locator('.specialization-order-actions [data-growth-item]').click();await page.locator('#itemCraft').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded,{},{timeout:30000});
  assert.equal((await get()).roomGame.kind,'joinery');await page.locator('[data-action="start"]').click();
  let game=(await get()).roomGame;const solution=game.level.solution;
  for(const piece of solution){
   await page.locator('[data-piece="'+piece.piece+'"]').click();game=(await get()).roomGame;
   while(game.rotation!==piece.rotation){await page.locator('[data-action="rotate"]').click();game=(await get()).roomGame;}
   await page.locator('[data-cell="'+piece.anchor+'"]').click();
  }
  await page.waitForFunction(()=>window.islandInspect().roomGame?.result?.passed);const quality=(await get()).roomGame.result.quality;assert(quality>=40);
  await page.screenshot({path:'qa/v37/'+theme+'-commission-game.png'});await page.locator('[data-action="claim"]').click();
  await page.waitForFunction(()=>window.islandInspect().specialization.commission.production&& !window.islandInspect().actor.action,{},{timeout:12000});
  const production=(await get()).specialization.commission.production;assert.equal(production.quality,quality);await page.waitForFunction(()=>document.querySelector('.modal-head h2')?.textContent.includes('制作完成'));
  await open();assert(!(await page.locator('#careerDeliver').isDisabled()));const before=await get(),net=before.specialization.commission.net;
  await page.locator('#careerDeliver').click();await page.waitForFunction(()=>window.islandInspect().specialization.commission.status==='delivered');await page.locator('#careerDeliver').waitFor({state:'detached'});let after=await get();assert.equal(after.coins,before.coins+net);assert.equal(after.specialization.commission.status,'delivered');assert.equal(after.specialization.deliveries.artisan,1);assert.equal(await page.locator('#careerDeliver').count(),0);
  const stamp='artisan_1@2';await page.locator('[data-career-moment="artisan"]').click();await page.waitForSelector('#momentOverlay');await page.waitForTimeout(1000);
  assert.equal((await get()).celebration.id,'career:artisan:1');await page.screenshot({path:'qa/v37/'+theme+'-career-ceremony.png'});
  await page.locator('#momentLater').click();assert(!(await get()).specialization.awards[stamp]);await open();await page.locator('[data-career-moment="artisan"]').click();const cash=(await get()).coins;
  await page.locator('#momentClaim').click();await page.waitForFunction(stamp=>!!window.islandInspect().specialization.awards[stamp],stamp);await page.locator('#momentOverlay').waitFor({state:'detached'});after=await get();assert(after.specialization.awards[stamp]);assert.equal(after.coins,cash);
  let saved=false;for(let i=0;i<120;i++){const d=await saves.current(theme);if(d?.state.specialization?.awards[stamp]&&d.state.specialization.commission.status==='delivered'){saved=true;break}await page.waitForTimeout(100);}if(!saved){report.saveStatus=await page.locator('#saveStatus').textContent();const pending=await page.evaluate(t=>JSON.parse(localStorage.getItem('hyper-dimension-'+t+'-pending-server-save')||'null'),theme);await writeFile('qa/v37/failed-pending-save.json',JSON.stringify(pending,null,2));}assert(saved,JSON.stringify({errors:report.errors,status:report.saveStatus}));
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().specialization.awards['artisan_1@2']);assert.equal((await get()).specialization.deliveries.artisan,1);await open();
  assert.equal(await page.locator('[data-career-moment="artisan"]').count(),0);assert.equal(await page.locator('#careerDeliver').count(),0);assert.match(await page.locator('.specialization-path.selected').textContent(),/手作学徒/);
  await decode();await page.screenshot({path:'qa/v37/'+theme+'-specialization-earned.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('.modal-body').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
  await page.screenshot({path:'qa/v37/'+theme+'-specialization-compact.png'});await page.locator('.modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);
  const close=await page.locator('#closeModal').boundingBox();assert(close&&close.y>=0&&close.y+close.height<=844);await page.locator('#closeModal').click();
  report.checks.push({theme,nativeJoinery:true,quality,postAcceptCharacterCraft:true,onePayment:true,ceremonyCancelAndClaim:true,permanentTitle:true,diskReloadNoDuplicate:true,compactNoOverflow:true,scrolledCloseVisible:true});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);report.passed=true;
}catch(e){report.failure=e.stack;report.visibleModal=await activePage?.locator('#modalRoot').innerText().catch(()=>null);report.state=await activePage?.evaluate(()=>({coins:window.islandInspect?.().coins,specialization:window.islandInspect?.().specialization})).catch(()=>null);await activePage?.screenshot({path:'qa/v37/failure.png'}).catch(()=>{});throw e;}finally{await engine?.close();server.kill();await writeFile('qa/v37/browser-report.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
