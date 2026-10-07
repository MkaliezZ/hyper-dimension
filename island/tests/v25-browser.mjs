import {chromium} from 'playwright-core';
import {completeCoutureClients} from './couture-ui-helper.mjs';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
await mkdir('qa/v25',{recursive:true});
const directory=await mkdtemp(resolve('qa/v25/browser-storage-')),port=4195,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme=origami'],{cwd:resolve('.'),env:{...process.env,HD_SAVE_DIR:directory},windowsHide:true,stdio:['ignore','pipe','pipe']});
let logs='',browser;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<120;i++){if(await fn())return;await wait(100)}throw Error('condition timed out')};
const report={directory,checks:[],errors:[]};
const api=async(theme,op='',body)=>{const r=await fetch(base+'/api/saves/'+theme+(op?'/'+op:''),{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await r.json();assert(r.ok,JSON.stringify(value));return value};
try{
 await until(async()=>{try{return (await fetch(base+'/api/status')).ok}catch{return false}});
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const s=hydrateTown(createState());for(const item of CATALOG_ITEMS)s.inventory[item.id]=20;
  for(const f of Object.values(s.facilities))f.quality=80;
  for(let id=0;id<25;id++)s.roomGames[id]={plays:8,best:90};
  await api(theme,'open',{legacyState:s,clientId:'v25-fixture'});
  const context=await browser.newContext({viewport:{width:1440,height:950}});
  await context.route('**/api/**',route=>{
   if(route.request().url().includes('/api/saves/'))return route.continue();
   if(route.request().url().endsWith('/api/hermes/command'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'hermes',answer:'请岩岩收集八份矿石，按实际矿石入库计数。',commands:[{id:'browser-ore',npcId:11,goal:'mine',resource:'ore',quantity:8,intent:'筹备八份矿石'}]})});
   return route.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'});
  });
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push({theme,message:e.message,stack:e.stack}));
  await p.goto(base+'/?qa=1&theme='+theme+'&rev=tasks-v25');
  await p.locator('#stewardBtn').click();await p.locator('#hermesInput').fill('安排岩岩收集八份矿石');await p.locator('#hermesSend').click();
  const controls='.steward-task-panel [data-task-id="browser-ore"]';
  await p.locator(controls+'[data-task-action="pause"]').click();
  assert.equal((await p.evaluate(()=>window.islandInspect().agentTaskLedger[0])).status,'paused');
  assert(await p.locator('.steward-companion .half-portrait').evaluate(el=>{const r=el.getBoundingClientRect(),parent=el.closest('.steward-companion').getBoundingClientRect();return r.top>=parent.top&&r.bottom<=parent.bottom}),'butler portrait remains visible when task controls are used');
  await p.screenshot({path:'qa/v25/'+theme+'-tasks.png'});
  await p.locator('#closeModal').click();await p.locator('#saveStatus').click();await p.locator('#saveNow').click();
  await until(async()=>(await api(theme)).document.state.agentTaskLedger?.[0]?.status==='paused');
  await p.reload();await p.locator('#stewardBtn').click();
  assert.equal((await p.evaluate(()=>window.islandInspect().agentTaskLedger[0])).status,'paused');
  await p.locator(controls+'[data-task-action="resume"]').click();
  await p.locator(controls+'[data-task-action="cancel"]').click();
  assert.equal((await p.evaluate(()=>window.islandInspect().agentTaskLedger[0])).status,'cancelled');
  report.checks.push({theme,flow:'task pause, save, reload, resume, cancel through actual controls'});

  await p.locator('#closeModal').click();await p.locator('#bagBtn').click();await p.locator('[data-item="lantern"]').click();
  await p.locator('#giftRecipient').selectOption('0');
  assert.match(await p.locator('#giftPreview').textContent(),/好感 \+2/);
  await p.locator('#itemGift').click();assert.equal(await p.locator('#giftRecipient').inputValue(),'0');
  assert.match(await p.locator('#giftPreview').textContent(),/好感 \+1/);
  await p.locator('#itemGift').click();assert(await p.locator('#itemGift').isDisabled());
  assert.match(await p.locator('#giftPreview').textContent(),/两次/);
  await p.screenshot({path:'qa/v25/'+theme+'-gift.png'});
  report.checks.push({theme,flow:'gift preview, recipient retained, diminishing return and exhausted button'});

  await p.locator('#closeModal').click();await p.locator('#recipesBtn').click();await p.locator('#recipeBuilding').selectOption('4');
  await p.locator('[data-recipe]').first().click();await p.locator('#itemCraft').click();
  await p.locator('.workshop-game').waitFor({timeout:30000});
  const readReservations=()=>p.evaluate(()=>window.islandInspect().resourceLedger?.reservations||{});
  const reserved=await readReservations(),owner=Object.keys(reserved).find(k=>k.startsWith('player:craft'));
  assert(owner,'actual workbench reserves materials before play');
  await p.locator('[data-action="start"]').click();
  await completeCoutureClients(p);
  await p.locator('[data-action="claim"]').waitFor();
  await p.locator('[data-action="claim"]').click();
  await until(async()=>!(await readReservations())[owner]);
  assert.equal(await p.locator('#itemCraft').count(),1,'result produces the real product detail page');
  assert.equal((await p.evaluate(()=>window.islandInspect().resourceLedger.receipts))[owner+':result'].category,'craft');
  await p.screenshot({path:'qa/v25/'+theme+'-craft-receipt.png'});
  report.checks.push({theme,flow:'reserve ingredients, solve couture, animate production, consume reservation once'});
  await p.locator('#itemCraft').click();await p.locator('.workshop-game').waitFor({timeout:30000});
  const beforeClose=Object.keys(await readReservations()).filter(k=>k.startsWith('player:craft'));
  assert(beforeClose.length);await p.locator('#closeModal').click();
  assert.equal(Object.keys(await readReservations()).filter(k=>k.startsWith('player:craft')).length,0);
  report.checks.push({theme,flow:'closing a workbench releases unconsumed reservation'});
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{
 await browser?.close();server.kill();await writeFile('qa/v25/browser-report.json',JSON.stringify(report,null,2));
 if(!report.passed)await writeFile('qa/v25/browser-failure.log',logs+'\n'+JSON.stringify(report.errors,null,2));
}
console.log(JSON.stringify(report));
