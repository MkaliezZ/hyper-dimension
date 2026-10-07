import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
import {wonderAsset} from '../src/eventWonders.js';
await mkdir('qa/v33',{recursive:true});const directory=await mkdtemp(resolve('qa/v33/browser-')),saves=createSaveStore({directory});
const fixture=JSON.parse(await readFile('tests/fixtures/cooperation-v30.json','utf8'));
for(const theme of ['pixel','origami']){const s=hydrateTown(structuredClone(fixture.state));s.freshStartPending=false;s.eventWonders.owned.seashell_cup.marks=5;await saves.open(theme,{legacyState:s,clientId:'fixture'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,kind:'Actual dual-theme UI, archived real cooperation backfill, display/navigation/visuals, exchange and disk reload; five marks are a UI fixture, no new live model or human acceptance.',checks:[],errors:[],badImages:[]};
let engine,page;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const ctx=await engine.newContext({viewport:{width:1440,height:1000}});await ctx.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated collections QA"}'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badImages.push(r.url());});
  await page.goto(base+'/?qa=1&theme='+theme);await page.locator('#journalOpen').click();await page.locator('#journalCollections').click();
  const get=()=>page.evaluate(()=>({w:window.islandInspect().eventWonders,a:window.islandInspect().achievementBook}));
  assert((await get()).w.owned.cooperation_monument);assert((await get()).a.awards['cooperate_1@1']);
  await page.locator('[data-wonder="seashell_cup"][data-wonder-color="violet"]').click();assert.equal((await get()).w.owned.seashell_cup.marks,0);assert.equal((await get()).w.owned.seashell_cup.color,1);
  await page.locator('[data-wonder="seashell_cup"][data-wonder-color="sea"]').click();await page.locator('[data-wonder="seashell_cup"][data-wonder-color="violet"]').click();assert.equal((await get()).w.owned.seashell_cup.marks,0);
  await page.locator('[data-wonder-display="seashell_cup"]').click();await page.waitForFunction(()=>window.islandInspect().eventWonders.displays.seashell_cup,{},{timeout:30000});assert((await get()).w.displays.seashell_cup);
  await page.locator('[data-wonder-display="cooperation_monument"]').click();await page.waitForFunction(()=>window.islandInspect().eventWonders.displays.cooperation_monument,{},{timeout:30000});
  assert((await get()).w.displays.cooperation_monument,'display waits for real NPCs to clear its place');
  await page.locator('[data-wonder-card="cooperation_monument"] .wonder-source summary').click();
  const source=await page.locator('[data-wonder-card="cooperation_monument"] .wonder-source').innerText();assert(source.includes(fixture.provenance.parent));assert(source.includes(fixture.provenance.child));
  await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('#modalRoot img')].map(im=>im.decode()));await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.screenshot({path:'qa/v33/'+theme+'-wonders.png'});
  await page.locator('#collectionAchievements').click();await page.locator('#achievementFilter').selectOption('cooperate');assert.equal(await page.locator('.achievement-card.earned').count(),1);
  await page.screenshot({path:'qa/v33/'+theme+'-achievements.png'});await page.setViewportSize({width:390,height:820});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:'qa/v33/'+theme+'-compact.png'});await page.setViewportSize({width:1440,height:1000});
  await page.locator('#closeModal').click();await page.evaluate(async urls=>{await Promise.all(urls.map(src=>{const im=new Image();im.src=src;return im.decode()}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},[wonderAsset('seashell_cup',theme,'violet'),wonderAsset('cooperation_monument',theme)]);
  await page.screenshot({path:'qa/v33/'+theme+'-world.png'});
  let persisted=false;for(let i=0;i<100;i++){const disk=await saves.current(theme);if(disk.state.eventWonders.displays?.cooperation_monument&&disk.state.eventWonders.owned.seashell_cup.color===1){persisted=true;break}await page.waitForTimeout(100);}
  assert(persisted);await page.reload();await page.locator('#journalOpen').click();await page.locator('#journalCollections').click();
  const restored=await get();assert.equal(restored.w.owned.seashell_cup.color,1);assert.equal(restored.w.owned.seashell_cup.marks,0);assert(restored.w.displays.cooperation_monument);assert(restored.a.awards['cooperate_1@1']);
  await page.locator('[data-wonder-display="seashell_cup"]').click();assert(!((await get()).w.displays.seashell_cup));assert((await get()).w.displays.cooperation_monument);
  report.checks.push({theme,archivedProofs:restored.w.owned.cooperation_monument.proof.length,exchanged:'violet',marks:0,twoSites:true,reloaded:true,compactOverflow:false});await ctx.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.badImages,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:'qa/v33/browser-failure.png'}).catch(()=>{});}
finally{await engine?.close();server.kill();await writeFile('qa/v33/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
