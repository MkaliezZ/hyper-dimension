import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
await mkdir('qa/v26',{recursive:true});
const directory=await mkdtemp(resolve('qa/v26/browser-storage-')),port=4196,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme=origami'],{cwd:resolve('.'),env:{...process.env,HD_SAVE_DIR:directory},windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='',browser;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await wait(100)}throw Error('condition timed out')};
const report={directory,checks:[],errors:[]};
const api=async(theme,op='',body)=>{const r=await fetch(base+'/api/saves/'+theme+(op?'/'+op:''),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await r.json();assert(r.ok,JSON.stringify(value));return value};
try{
 await until(async()=>{try{return (await fetch(base+'/api/status')).ok}catch{return false}});
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const s=hydrateTown(createState());s.inventory.outfit=2;s.inventory.c4_1=1;
  await api(theme,'open',{legacyState:s,clientId:'v26-fixture'});
  const context=await browser.newContext({viewport:{width:1440,height:950}});
  await context.route('**/api/**',route=>route.request().url().includes('/api/saves/')?route.continue():route.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push({theme,message:e.message,stack:e.stack}));
  await p.goto(base+'/?qa=1&theme='+theme+'&rev=balance-v26');
  await p.locator('#bagBtn').click();await p.locator('[data-item="outfit"]').click();await p.locator('#itemUse').click();
  assert(await p.locator('#itemUse').isDisabled());assert.match(await p.locator('#itemUse').textContent(),/正在穿着/);
  assert.match(await p.locator('.item-detail h3').textContent(),/×1/);
  await p.screenshot({path:'qa/v26/'+theme+'-worn-detail.png'});
  await p.locator('#backBag').click();await p.locator('[data-item="c4_1"]').click();await p.locator('#itemUse').click();
  await p.locator('#backBag').click();assert.match(await p.locator('[data-item="outfit"]').textContent(),/背包 × 2/);
  assert.match(await p.locator('[data-item="c4_1"]').textContent(),/穿着中/);
  await p.locator('#closeModal').click();await p.locator('#saveStatus').click();await p.locator('#saveNow').click();
  await until(async()=>(await api(theme)).document.state.wardrobe?.equipped?.item==='c4_1');
  await p.reload();await p.locator('#playerBtn').click();assert(await p.locator('#profileUnequip').isVisible());assert(await p.locator('#profileUnequip').evaluate(el=>el.getBoundingClientRect().bottom<=el.closest('.modal-body').getBoundingClientRect().bottom),'equipment control is visible without scrolling');
  await p.screenshot({path:'qa/v26/'+theme+'-profile.png'});
  await p.locator('#profileUnequip').click();assert.equal(await p.locator('#profileUnequip').count(),0);
  await p.locator('#closeModal').click();await p.locator('#bagBtn').click();
  assert.match(await p.locator('[data-item="c4_1"]').textContent(),/背包 × 1/);
  report.checks.push({theme,flow:'equip, duplicate disabled, exchange returns old copy, real disk save/reload, unequip returns current copy'});
  await p.locator('#closeModal').click();await p.locator('#businessBtn').click();
  assert.match(await p.locator('.budget-card').first().textContent(),/今日岛务预算 · 80 岛币/);
  assert.match(await p.locator('.budget-card').first().textContent(),/预算按开放设施/);
  await p.screenshot({path:'qa/v26/'+theme+'-budget.png'});
  const horizontal=await p.locator('.modal').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(horizontal,false);
  await p.setViewportSize({width:980,height:720});await p.locator('#closeModal').click();await p.locator('#playerBtn').click();
  assert.equal(await p.locator('.modal').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  report.checks.push({theme,flow:'80-coin budget and explicit policy, themed profile controls fit desktop and compact viewport'});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{
 await browser?.close();server.kill();await writeFile('qa/v26/browser-report.json',JSON.stringify(report,null,2));
 if(!report.passed)await writeFile('qa/v26/browser-failure.log',logs+'\n'+JSON.stringify(report.errors,null,2));
}
console.log(JSON.stringify(report));
