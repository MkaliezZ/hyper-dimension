import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {BUILDINGS} from '../src/world.js';

const out='qa/v46/scene-return';await mkdir(out,{recursive:true});
const directory=await mkdtemp(resolve(out+'/fixture-')),saves=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createZeroState());s.freshStartPending=false;await saves.open(theme,{legacyState:s,clientId:'scene-navigation-review'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={at:new Date().toISOString(),scope:'Actual 25 room scenes, both themes, transient hint fixture and actual return click. Isolated zero-progress saves; all model and non-save APIs blocked.',directory,checks:[],errors:[],badImages:[]};
let browser,page;
const intersects=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
try {
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready);
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const oldHtml=(await readFile('qa/v45/art-recheck-baseline/index.html','utf8')).replaceAll('__DEFAULT_THEME__','origami');
 const oldCss=await readFile('qa/v45/art-recheck-baseline/src/ui-v16.css','utf8');
 const before=await browser.newContext({viewport:{width:1440,height:1000}});
 await before.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"layout QA"}'}));
 await before.route('**/src/ui-v16.css',r=>r.fulfill({contentType:'text/css',body:oldCss}));
 await before.route(base+'/?qa=1&theme=origami&room=0',r=>r.fulfill({contentType:'text/html',body:oldHtml}));
 const oldPage=await before.newPage();await oldPage.goto(base+'/?qa=1&theme=origami&room=0');await oldPage.waitForFunction(()=>window.islandInspect?.().scene==='workshop');
 await oldPage.locator('[data-go="workshop"]').click();await oldPage.waitForSelector('#toast:not(.hidden)');
 const collision=await oldPage.evaluate(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}};return {back:rect('sceneBack'),hint:rect('toast')}});
 report.before={...collision,overlap:intersects(collision.back,collision.hint)};assert(report.before.overlap);
 await oldPage.screenshot({path:out+'/before-origami.png'});await before.close();
 for(const theme of ['pixel','origami']) {
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"layout QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url())});
  for(let room=0;room<25;room++) {
   await page.goto(base+'/?qa=1&theme='+theme+'&room='+room);
   await page.waitForFunction(id=>window.islandInspect?.().sceneBuilding===id&&window.islandInspect?.().scene!=='world',room);
   for(const [width,height] of [[1440,1000],[960,700],[900,480],[390,780]]) {
    await page.setViewportSize({width,height});
    await page.evaluate(text=>{const e=document.getElementById('toast');e.textContent=text;e.classList.remove('hidden')},'进入'+BUILDINGS[room].name+' · 点击家具前往操作');
    await page.waitForTimeout(40);
    const v=await page.evaluate(()=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
     const back=document.getElementById('sceneBack'),b=rect(back),hit=document.elementFromPoint((b.left+b.right)/2,(b.top+b.bottom)/2);
     return {back:b,hint:rect(document.getElementById('toast')),header:rect(document.querySelector('.topbar')),menu:rect(document.querySelector('.game-toolbar')),status:rect(document.querySelector('.top-center')),onScreen:b.left>=0&&b.top>=0&&b.right<=innerWidth&&b.bottom<=innerHeight,clickable:!!hit?.closest('#sceneBack'),textFits:back.scrollWidth<=back.clientWidth+1};
    });
    assert(v.onScreen,theme+' room '+room+' off screen '+width);
    assert(v.clickable,theme+' room '+room+' blocked '+width);
    assert(v.textFits,theme+' room '+room+' clipped '+width);
    assert(!intersects(v.back,v.hint),theme+' room '+room+' hint overlap '+width);
    assert(!intersects(v.back,v.menu),theme+' room '+room+' menu overlap '+width);
    assert(!intersects(v.back,v.status),theme+' room '+room+' status overlap '+width);
    report.checks.push({theme,room,width,height,back:v.back,hint:v.hint,clickable:v.clickable});
    if(room===0&&(width===1440||width===390))await page.screenshot({path:out+'/'+theme+'-'+(width===1440?'desktop':'compact')+'.png'});
   }
   await page.locator('#sceneBack').click();await page.waitForFunction(()=>window.islandInspect?.().scene==='world');
   assert.equal(await page.locator('#sceneBack').isVisible(),false);assert.equal(await page.locator('#mapBadge').evaluate(e=>e.classList.contains('hidden')),false);
  }
  console.log(JSON.stringify({theme,rooms:25,viewports:4,returnClicks:25,passed:true}));await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);assert.equal(report.checks.length,200);report.passed=true;
} catch(e){process.exitCode=1;report.failure=e.stack;await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});}
finally{await browser?.close();server.kill();await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,badImages:report.badImages.length,failure:report.failure}));}
