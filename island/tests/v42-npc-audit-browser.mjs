import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {RESIDENTS} from '../src/world.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v42',{recursive:true});
const directory=await mkdtemp(resolve('qa/v42/browser-')),store=createSaveStore({directory});
for(const theme of ['pixel','origami']){
 const s=createZeroState();s.freshStartPending=false;s.npcProfiles[0]={name:RESIDENTS[0].name,personality:RESIDENTS[0].personality,version:7};
 await store.open(theme,{legacyState:s,clientId:'audit-fixture'});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:'ignore'});
const report={directory,scope:'Actual dual-theme profile edit/history and disk recovery; isolated fixture with legacy v7 profile, AI routes disabled, no user saves or provider calls.',checks:[],errors:[],badAssets:[],externalRequests:[]};let engine,page;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});let offline=false;
  await context.route('**/*',r=>{if(r.request().url().startsWith(base+'/'))return r.fallback();report.externalRequests.push(r.request().url());return r.abort();});
  await context.route('**/api/**',r=>{
   const u=r.request().url();
   if(u.includes('/api/saves/')){
    if(offline&&u.endsWith('/save'))return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated disk outage"}'});
    return r.continue();
   }
   return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated audit QA; AI disabled"}'});
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url())});
  const inspect=()=>page.evaluate(()=>window.islandInspect());
  const admin=async()=>{if(await page.locator('#closeModal').count())await page.locator('#closeModal').click();await page.locator('#adminBtn').click();await page.waitForSelector('#adminAudit');};
  await page.goto(base+'/?qa=1&theme='+theme,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForFunction(()=>window.islandInspect?.().npcProfileAudit,{},{timeout:45000});
  await page.locator('#residentsBtn').click();assert.equal(await page.locator('#residentList .resident').count(),15);assert.equal(await page.locator('#residentList [data-npc="15"]').count(),0);
  await admin();assert.equal(await page.locator('[data-edit-npc]').count(),16);assert.equal(await page.locator('.admin-steward[data-edit-npc="15"]').count(),1);
  await page.locator('#adminAudit').click();assert.equal(await page.locator('[data-audit-entry]').count(),0);assert.match(await page.locator('.npc-audit-note').innerText(),/不追补/);
  await page.locator('#auditBack').click();await page.locator('[data-edit-npc="0"]').click();
  const firstName=await page.locator('#editNpcName').inputValue(),changedName=theme==='pixel'?'像素新邻居':'折纸新邻居';
  await page.locator('#editNpcName').fill(changedName);await page.locator('#editNpcPersonality').fill('细心、热情，上午认真工作，晚上照顾邻里。');
  await page.locator('#saveNpc').evaluate(b=>{b.click();b.click()});await page.waitForSelector('#adminAudit');
  let s=await inspect();assert.equal(s.npcProfiles[0].version,8);assert.equal(s.npcProfileAudit.entries.length,1);assert.equal(s.npcProfileAudit.totalCount,1);assert.equal(s.npcProfileAudit.entries[0].before.name,firstName);
  assert.equal((await store.current(theme)).state.npcProfileAudit.entries.length,1);
  await page.locator('[data-edit-npc="0"]').click();await page.locator('#saveNpc').click();await page.waitForSelector('#adminAudit');assert.equal((await inspect()).npcProfileAudit.totalCount,1);
  await page.locator('[data-edit-npc="15"]').click();const stewardName=theme==='pixel'?'像素管家':'折纸管家';
  await page.locator('#editNpcName').fill(stewardName);await page.locator('#editNpcSpeech').fill('简洁、温暖，先确认意图，再解释实际完成的事情。');
  await page.locator('#saveNpc').click();await page.waitForFunction(()=>!document.querySelector('#saveNpc'),{},{timeout:25000});
  await admin();await page.screenshot({path:'qa/v42/'+theme+'-admin-desktop.png'});
  await page.locator('#adminAudit').click();assert.equal(await page.locator('[data-audit-entry]').count(),2);
  await page.locator('#npcAuditFilter').selectOption('0');assert.equal(await page.locator('[data-audit-entry]').count(),1);
  await page.locator('[data-audit-entry]').first().click();assert.equal(await page.locator('.npc-audit-diff').count(),4);
  assert.equal(await page.locator('.npc-audit-diff.is-changed').count(),2);
  assert.match(await page.locator('.npc-audit-diff').first().innerText(),new RegExp(changedName));await page.screenshot({path:'qa/v42/'+theme+'-audit-desktop.png'});
  await page.setViewportSize({width:390,height:780});await page.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);
  assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  const close=await page.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<=780);
  for(const id of ['auditUseBefore','auditUseAfter'])assert(await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight}));
  await page.locator('.modal-body').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'qa/v42/'+theme+'-audit-compact.png'});
  await page.locator('#auditUseBefore').click();assert.equal(await page.locator('#editNpcName').inputValue(),firstName);assert.equal((await inspect()).npcProfiles[0].name,changedName);
  await page.setViewportSize({width:1440,height:1000});await page.locator('#saveNpc').click();await page.waitForSelector('#adminAudit');
  s=await inspect();assert.equal(s.npcProfiles[0].version,9);assert.equal(s.npcProfiles[0].name,firstName);assert.equal(s.npcProfileAudit.totalCount,3);assert.equal(s.npcProfileAudit.entries.at(-1).source,'restore');
  // An interrupted save must retain one edit without claiming disk success.
  await page.locator('[data-edit-npc="0"]').click();const pendingName=theme==='pixel'?'像素待存邻居':'折纸待存邻居';
  await page.locator('#editNpcName').fill(pendingName);offline=true;await page.locator('#saveNpc').click();
  await page.waitForFunction(()=>document.querySelector('#saveNpc')&&!document.querySelector('#saveNpc').disabled);
  assert.match(await page.locator('#toast').innerText(),/磁盘保存尚未完成/);
  assert.equal((await inspect()).npcProfileAudit.totalCount,4);assert.equal((await store.current(theme)).state.npcProfileAudit.totalCount,3);
  offline=false;await page.locator('#saveNpc').click();await page.waitForSelector('#adminAudit');
  assert.equal((await inspect()).npcProfileAudit.totalCount,4);assert.equal((await store.current(theme)).state.npcProfileAudit.totalCount,4);
  // Clear browser caches entirely and load the service's existing disk snapshot.
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>window.islandInspect?.().npcProfileAudit?.totalCount===4);
  s=await inspect();assert.equal(s.npcProfiles[0].name,pendingName);assert.equal(s.npcProfiles[0].version,10);assert.equal(s.npcProfiles[15].name,stewardName);assert.equal(s.npcProfiles[15].version,RESIDENTS[15].version+1);
  await admin();await page.locator('#adminAudit').click();await page.locator('#npcAuditFilter').selectOption('15');assert.equal(await page.locator('[data-audit-entry]').count(),1);await page.locator('[data-audit-entry]').click();
  assert.match(await page.locator('.npc-audit-detail').innerText(),new RegExp(stewardName));
  report.checks.push({theme,publicResidents:15,adminResidents:16,legacyVersion:7,finalVersion:10,stewardVersion:s.npcProfiles[15].version,auditRecords:4,noOpAndDoubleClickSafe:true,restoreForwardVersion:true,offlineRetained:true,clearBrowserReloadFromDisk:true,compactWidth:390,closeFixed:true});
  await context.close();
 }
 assert.equal(report.externalRequests.length,0,JSON.stringify(report.externalRequests));assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.badAssets.length,0,JSON.stringify(report.badAssets));report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:'qa/v42/audit-failure.png'}).catch(()=>{});throw e}
finally{await writeFile('qa/v42/npc-audit-browser-report.json',JSON.stringify(report,null,2));await engine?.close();server.kill()}
console.log(JSON.stringify(report,null,2));
