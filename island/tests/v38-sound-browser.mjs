import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v38',{recursive:true});const directory=await mkdtemp(resolve('qa/v38/browser-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());s.freshStartPending=false;s.coins=100;s.inventory.wood=24;s.inventory.stone=12;s.inventory.ore=12;s.inventory.seed=6;
 for(const f of Object.values(s.facilities)){f.quality=90;f.condition=100;f.upgrades=4;}
 s.plots[4].playerTended=true;Object.assign(s.plots[5],{stage:4,crop:'wheat',growth:180,playerTended:true});
 await store.open(theme,{legacyState:s,clientId:'sound-fixture'});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,kind:'Isolated stock and mature-crop fixtures. Actual dual-theme volume controls, trusted gesture AudioContext, farm actions, native joinery, no provider calls or real user save writes. Generated audio verified by OfflineAudioContext energy; not human listening or full animation acceptance.',checks:[],errors:[],badImages:[]};let engine;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated sound QA"}'}));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url());});
  const get=()=>page.evaluate(()=>window.islandInspect());await page.goto(base+'/?qa=1&theme='+theme+'&scene=farm');await page.waitForFunction(()=>window.islandInspect?.().sound);
  let before=await get();assert.equal(before.sound.unlocked,false);assert.equal(before.sound.produced,0);
  await page.locator('#soundBtn').click();await page.waitForSelector('.sound-sheet[open]');await page.waitForFunction(()=>window.islandInspect().sound.state==='running');
  assert.equal((await get()).sound.scopes,2);
  const volume=async(key,value)=>page.locator('[data-sound-volume="'+key+'"]').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await volume('master',65);await volume('music',18);await volume('effects',75);await volume('ambience',25);
  const count=(await get()).sound.cueCounts.stone||0;await page.locator('[data-sound-cue="stone"]').click();assert.equal((await get()).sound.cueCounts.stone,count+1);
  await page.locator('#soundMute').click();before=await get();await page.locator('[data-sound-cue="wood"]').click();assert.equal((await get()).sound.produced,before.sound.produced);
  assert.equal((await get()).sound.preferences.muted,true);await page.locator('#soundMute').click();
  await page.screenshot({path:'qa/v38/'+theme+'-sound-desktop.png'});
  await page.locator('#soundDone').click();await page.waitForFunction(()=>!document.querySelector('.sound-sheet')&&window.islandInspect().sound.scopes===1);assert.equal((await get()).sound.scopes,1);assert.equal(await page.locator('.sound-sheet').count(),0);
  const clickPlot=async(index)=>{
   const p=await page.evaluate(async(index)=>{const s=window.islandInspect(),{plotPoint}=await import('/src/farming.js'),{rasterTransform}=await import('/src/rasterQuality.js');const q=plotPoint(s.farmPlots[index],.5,.5),t=rasterTransform(s.rendering.css[0],s.rendering.css[1],1000,660,s.zoom,s.camera,...s.rendering.density),r=document.querySelector('#game').getBoundingClientRect();return {x:r.left+(q.x*t.scale+t.ox)*r.width/s.rendering.css[0],y:r.top+(q.y*t.scale+t.oy)*r.height/s.rendering.css[1]};},index);
   await page.mouse.click(p.x,p.y);
  };
  await clickPlot(4);await page.waitForFunction(()=>window.islandInspect().plots[4].stage===1&&!window.islandInspect().actor.action,{},{timeout:18000});assert((await get()).sound.cueCounts.hoe>0);
  await clickPlot(4);await page.waitForSelector('[data-crop="wheat"]',{timeout:12000});await page.locator('[data-crop="wheat"]').click();await page.waitForFunction(()=>window.islandInspect().plots[4].stage===2&&!window.islandInspect().actor.action,{},{timeout:18000});assert((await get()).sound.cueCounts.sow>0);
  await clickPlot(4);await page.waitForFunction(()=>window.islandInspect().plots[4].stage===3&&!window.islandInspect().actor.action,{},{timeout:18000});assert((await get()).sound.cueCounts.water>0);
  await clickPlot(5);await page.waitForFunction(()=>window.islandInspect().plots[5].stage===0&&!window.islandInspect().actor.action,{},{timeout:18000});assert((await get()).sound.cueCounts.harvest>0);assert((await get()).sound.cueCounts.collect>0);
  await page.locator('#recipesBtn').click();await page.locator('[data-recipe="lantern"]').click();await page.locator('#itemCraft').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.loaded,{},{timeout:25000});
  await page.locator('[data-action="start"]').click();await page.waitForTimeout(180);before=await get();const reserved=JSON.stringify(before.resourceLedger.reservations);
  await page.locator('[data-action="soundSettings"]').click();await page.waitForSelector('.sound-sheet[open]');let paused=await get();assert(paused.roomGame.paused);const t=paused.roomGame.t;
  await volume('music',20);await page.waitForTimeout(250);assert.equal((await get()).roomGame.t,t);assert.equal(JSON.stringify((await get()).resourceLedger.reservations),reserved);
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.sound-sheet'));assert.equal(await page.locator('.sound-sheet').count(),0);assert((await get()).roomGame.paused);assert.equal(await page.locator('#roomGameRoot').count(),1);
  await page.locator('[data-action="resume"]').click();await page.waitForTimeout(130);assert((await get()).roomGame.t>t);
  const solution=(await get()).roomGame.level.solution;
  for(const piece of solution){await page.locator('[data-piece="'+piece.piece+'"]').click();let game=(await get()).roomGame;while(game.rotation!==piece.rotation){await page.locator('[data-action="rotate"]').click();game=(await get()).roomGame;}await page.locator('[data-cell="'+piece.anchor+'"]').click();}
  await page.waitForFunction(()=>window.islandInspect().roomGame?.result?.passed);assert((await get()).sound.cueCounts.join>0);
  await page.locator('[data-action="claim"]').click();await page.waitForFunction(()=>!window.islandInspect().actor.action&&!window.islandInspect().roomGame,{},{timeout:12000});assert((await get()).sound.cueCounts.wood>0);
  if(await page.locator('#closeModal').count())await page.locator('#closeModal').click();await page.locator('#soundBtn').click();await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);
  const layout=await page.evaluate(()=>{const d=document.querySelector('.sound-sheet'),b=d.querySelector('.sound-body'),c=d.querySelector('#soundClose');b.scrollTop=b.scrollHeight;const r=d.getBoundingClientRect(),x=c.getBoundingClientRect();return {overflow:d.scrollWidth>d.clientWidth+1,within:r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight,close:x.top>=r.top&&x.bottom<=r.bottom};});assert(!layout.overflow);assert(layout.within&&layout.close);
  await page.screenshot({path:'qa/v38/'+theme+'-sound-compact.png'});await page.locator('#soundClose').click();await page.waitForFunction(()=>!document.querySelector('.sound-sheet'));assert.equal((await get()).sound.scopes,1);
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().sound);const saved=(await get()).sound.preferences;assert.equal(saved.master,.65);assert.equal(saved.music,.2);assert.equal(saved.effects,.75);assert.equal(saved.ambience,.25);
  report.checks.push({theme,noAutoplay:true,trustedAudioRunning:true,sharedBusSettings:true,muteNoOutput:true,realHoeSowWaterHarvest:true,realCraftContact:true,gameSettingsPausePreservesReservation:true,escapeKeepsGame:true,compactFixedClose:true,preferencesAfterReload:saved});
  // Native audio engine renders actual samples, including the zero-volume and split-bus cases.
  const energies=await page.evaluate(async()=>{
   const {createSoundMixer}=await import('/src/soundMixer.js');
   async function energy(category,partial){const offline=new OfflineAudioContext(1,22050,22050);offline.resume=async()=>{};const mixer=createSoundMixer({storage:null,contextFactory:()=>offline});await mixer.unlock();mixer.setPreferences(partial);mixer.tone(440,{category,duration:.5,volume:.15});const b=await offline.startRendering(),data=b.getChannelData(0);let square=0,peak=0;for(const v of data){square+=v*v;peak=Math.max(peak,Math.abs(v));}mixer.destroy();return {rms:Math.sqrt(square/data.length),peak};}
   return {audible:await energy('effects',{}),masterZero:await energy('effects',{master:0}),effectsZero:await energy('effects',{effects:0}),musicIndependent:await energy('music',{effects:0}),muted:await energy('music',{muted:true})};
  });
  assert(energies.audible.rms>.001);assert(energies.audible.peak<.2);assert.equal(energies.masterZero.rms,0);assert.equal(energies.effectsZero.rms,0);assert.equal(energies.muted.rms,0);assert(energies.musicIndependent.rms>.001);report.checks.at(-1).offlineEnergy=energies;
  await context.close();
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.badImages.length,0);report.passed=true;
}catch(e){report.failure=e.stack;report.passed=false;throw e}finally{await writeFile('qa/v38/browser-report.json',JSON.stringify(report,null,2));await engine?.close();server.kill();}
console.log(JSON.stringify(report));
