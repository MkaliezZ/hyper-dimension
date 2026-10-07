import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v32',{recursive:true});const directory=await mkdtemp(resolve('qa/v32/browser-')),saves=createSaveStore({directory}),report={directory,kind:'Dual theme real UI, production routes and plan registration/disk reload; no live model or human acceptance.',checks:[],errors:[]};
for(const theme of ['pixel','origami']){const s=hydrateTown(createZeroState());s.freshStartPending=false;await saves.open(theme,{legacyState:s,clientId:'fixture'});}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
let engine,page;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const ctx=await engine.newContext({viewport:{width:1440,height:1000}});await ctx.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated production QA"}'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/?qa=1&theme='+theme);
  await page.locator('#bagBtn').click();await page.locator('#bagFilter').selectOption('all');await page.locator('[data-item="c7_5"]').click();
  assert((await page.locator('.item-purpose').innerText()).includes('舞台'));await page.locator('[data-next-recipe="c21_0"]').click();
  await page.locator('.workshop-route').waitFor();assert((await page.locator('.workshop-route').innerText()).includes('图书馆'));assert((await page.locator('.workshop-route').innerText()).includes('纸张 ×2'));
  await page.evaluate(async()=>{const urls=[...new Set([...document.querySelectorAll('#modalRoot image')].map(e=>e.getAttribute('href')).filter(Boolean))];await Promise.all(urls.map(src=>{const im=new Image();im.src=src;return im.decode()}));await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.locator('.workshop-route').scrollIntoViewIfNeeded();await page.screenshot({path:'qa/v32/'+theme+'-production-route.png'});
  await page.setViewportSize({width:390,height:820});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:'qa/v32/'+theme+'-production-compact.png'});await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-detail="c7_5"]').last().click();assert((await page.locator('.modal-head h2').innerText()).includes('纸张'));
  await page.locator('#closeModal').click();await page.locator('#stewardBtn').click();await page.locator('#stewardProjects').click();
  await page.locator('#planTitle').fill('木作到船坞的真实工序');await page.locator('#planItem').selectOption('c23_0');await page.locator('#planAdd').click();await page.locator('#planCreate').click();
  const get=()=>page.evaluate(()=>({projects:window.islandInspect().workProjects,tasks:window.islandInspect().agentTaskLedger}));
  const current=await get(),plan=current.projects.find(p=>p.title==='木作到船坞的真实工序');assert(plan);assert(current.tasks.some(t=>t.projectId===plan.id&&t.targetItem==='c0_7'));assert(current.tasks.some(t=>t.projectId===plan.id&&t.targetItem==='c23_0'));
  for(let i=0;i<100;i++){const disk=await saves.current(theme);if(disk.state.workProjects?.some(p=>p.id===plan.id))break;await new Promise(r=>setTimeout(r,100));}
  const disk=await saves.current(theme);assert(disk.state.workProjects.some(p=>p.id===plan.id));await page.reload();assert((await get()).projects.some(p=>p.id===plan.id));assert.equal((await saves.current(theme)).state.contentVersion,9);
  report.checks.push({theme,upstream:'图书馆纸张→舞台海报',registered:plan.id,reloaded:true,compactOverflow:false});await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;await page?.screenshot({path:'qa/v32/browser-failure.png'}).catch(()=>{});}
finally{await engine?.close();server.kill();await writeFile('qa/v32/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
