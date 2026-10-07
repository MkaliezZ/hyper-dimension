import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v38',{recursive:true});const directory=await mkdtemp(resolve('qa/v38/classic-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createZeroState());s.freshStartPending=false;await store.open(theme,{legacyState:s,clientId:'classic-sound-fixture'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,kind:'Actual link and match room UI settings pause/resume, isolated first-day practice saves and no provider calls; no reward or human acceptance.',checks:[],errors:[]};let engine;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated classic sound QA"}'}));const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const id of [7,3]){
   await page.goto(base+'/?qa=1&theme='+theme+'&room='+id);await page.waitForFunction(()=>window.islandInspect?.().sceneBuilding!=null);
   const p=await page.evaluate(async id=>{const s=window.islandInspect(),{ROOMS}=await import('/src/rooms.js'),{rasterTransform}=await import('/src/rasterQuality.js');const f=ROOMS[id].primary,t=rasterTransform(...s.rendering.css,1000,660,s.zoom,s.camera,...s.rendering.density),r=document.querySelector('#game').getBoundingClientRect();return {x:r.left+((f.x+f.w/2)*t.scale+t.ox)*r.width/s.rendering.css[0],y:r.top+((f.y+f.h/2)*t.scale+t.oy)*r.height/s.rendering.css[1]};},id);
   await page.mouse.click(p.x,p.y);await page.waitForFunction(()=>window.islandInspect().roomGame?.kind==='link'||window.islandInspect().roomGame?.kind==='match',{},{timeout:20000});
   if(id===7)await page.locator('[data-session="pause"]').click();await page.waitForTimeout(150);
   const before=await page.evaluate(()=>window.islandInspect());await page.locator('.game-level-bar button[aria-label="声音设置"]').click();await page.waitForSelector('.sound-sheet[open]');
   const paused=await page.evaluate(()=>window.islandInspect());assert(paused.roomGame.paused);await page.waitForTimeout(200);assert.equal((await page.evaluate(()=>window.islandInspect())).roomGame.t,paused.roomGame.t);
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.sound-sheet'));assert(await page.locator('#roomGameRoot').count());assert((await page.evaluate(()=>window.islandInspect())).roomGame.paused);
   await page.locator('[data-session="pause"]').click();await page.waitForTimeout(120);let resumed=await page.evaluate(()=>window.islandInspect());assert(!resumed.roomGame.paused);assert(resumed.roomGame.t>paused.roomGame.t);assert.deepEqual(resumed.inventory,before.inventory);
   await page.locator('#closeModal').click();await page.waitForFunction(()=>window.islandInspect().sound.scopes===1);report.checks.push({theme,id,kind:resumed.roomGame.kind,pausedDuringSettings:true,escapePreservedRoom:true,clockResumed:true,inventoryUnchanged:true,scopeCleaned:true});
  }await context.close();
 }assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;throw e}finally{await writeFile('qa/v38/classic-browser-report.json',JSON.stringify(report,null,2));await engine?.close();server.kill();}
console.log(JSON.stringify(report));
