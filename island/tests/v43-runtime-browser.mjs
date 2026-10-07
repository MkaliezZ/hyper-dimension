import {chromium} from 'playwright-core';import {spawn} from 'node:child_process';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import {resolve} from 'node:path';import {createServer} from 'node:http';import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';import {createSaveStore} from '../server/saveStore.mjs';import {createRunLedger} from '../server/runLedger.mjs';
await mkdir('qa/v43',{recursive:true});const directory=await mkdtemp(resolve('qa/v43/browser-')),store=createSaveStore({directory}),ledger=createRunLedger({directory:resolve(directory,'_runs')});
for(const theme of ['pixel','origami']){const s=createZeroState();s.freshStartPending=false;await store.open(theme,{legacyState:s,clientId:'runtime-ui-fixture'})}
for(let i=0;i<28;i++){
 const r=await ledger.begin({kind:i===0?'recruitment':'steward_manual',theme:i%2?'origami':'pixel',projectIds:['fixture-project'],participants:i===0?[15,16]:[15]});await ledger.providerStarted(r.id);
 await ledger.finish(r.id,{phase:i===1?'failed':'completed',usage:i===1?null:i===0?{input:50,output:20,total:70,calls:2}:{input:20,output:10,total:30,calls:1},providerRunId:'fixture-parent-'+i,children:i===0?[{id:'fixture-parent',parentId:null,usage:{input:20,output:10,total:30,calls:1},phase:'completed'},{id:'fixture-child',parentId:'fixture-parent',usage:{input:30,output:10,total:40,calls:1},phase:'completed'}]:[]});
}
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port,server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port],{windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory,DEEPSEEK_API_KEY:'local-disabled-qa',HD_MODEL_ENDPOINT:'http://127.0.0.1:1'},stdio:'ignore'});
const report={directory,scope:'Actual runtime UI and policy disk API in two themes; displayed usage rows are seeded fixtures, not live provider evidence. All model routes and external requests blocked.',checks:[],errors:[],externalRequests:[],badAssets:[]};let engine,page;
try{
 let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/api/status')).ok;if(ready)break}catch{}await new Promise(r=>setTimeout(r,100))}assert(ready);
 engine=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const context=await engine.newContext({viewport:{width:1440,height:1000}});let lostReply=false,policies=0;
  await context.route('**/*',r=>{if(r.request().url().startsWith(base+'/'))return r.fallback();report.externalRequests.push(r.request().url());return r.abort()});
  await context.route('**/api/**',async r=>{
   const url=r.request().url();
   if(url.includes('/api/admin/policy')){
    policies++;
    if(lostReply){lostReply=false;await r.fetch();return r.abort('failed')}
    await new Promise(resolve=>setTimeout(resolve,200));return r.continue();
   }
   if(url.includes('/api/saves/')||url.includes('/api/admin/runtime')||url.endsWith('/api/status'))return r.continue();
   return r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA; model routes disabled"}'});
  });
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)report.badAssets.push(r.url())});
  const open=async()=>{if(await page.locator('#closeModal').count())await page.locator('#closeModal').click();await page.locator('#adminBtn').click();await page.locator('#adminRuntime').click();await page.waitForSelector('#runtimeApply')};
  await page.goto(base+'/?qa=1&theme='+theme,{waitUntil:'domcontentloaded',timeout:45000});await page.waitForFunction(()=>window.islandInspect?.().npcProfileAudit,{},{timeout:45000});await open();
  assert.equal(await page.locator('.runtime-run').count(),25);await page.locator('#runtimeNext').click();assert.equal(await page.locator('.runtime-run').count(),3);
  await page.locator('.runtime-run').filter({hasText:'管家与伙伴招聘'}).locator('summary').click();assert.match(await page.locator('.runtime-lineage').innerText(),/fixture-parent.*fixture-child/s);
  assert.match(await page.locator('.runtime-run').filter({hasText:'运行失败'}).innerText(),/用量未知/);
  await page.locator('#runtimePrevious').click();await page.locator('#runtimePaused').check();await page.locator('#runtimeRunLimit').fill('12');await page.locator('#runtimeTokenLimit').fill('2400');
  await page.locator('#runtimeFilter').selectOption('manual');assert.equal(await page.locator('#runtimeRunLimit').inputValue(),'12');assert(await page.locator('#runtimePaused').isChecked());
  const before=(await ledger.snapshot()).policy.version;await page.locator('#runtimeApply').evaluate(b=>{b.click();b.click()});await page.waitForFunction(()=>!document.querySelector('#runtimeApply')?.disabled&&document.querySelector('#runtimeSaveNote')?.textContent.includes('保存在本机'));
  let state=await ledger.snapshot();assert.equal(state.policy.version,before+1);assert.equal(state.policy.paused,true);assert.equal(state.policy.dailyTokenLimit,2400);assert.equal(policies,1);
  await page.locator('#runtimeRunLimit').fill('0');await page.locator('#runtimeApply').click();assert.equal((await ledger.snapshot()).policy.version,state.policy.version);assert.match(await page.locator('#toast').innerText(),/正整数/);
  await page.locator('#runtimeRunLimit').fill('13');lostReply=true;const lostVersion=state.policy.version;await page.locator('#runtimeApply').click();await page.waitForFunction(()=>document.querySelector('#runtimeApply')&&!document.querySelector('#runtimeApply').disabled);assert.equal((await ledger.snapshot()).policy.version,lostVersion+1);
  await page.locator('#runtimeApply').click();await page.waitForFunction(()=>!document.querySelector('#runtimeApply')?.disabled&&document.querySelector('#runtimeSaveNote')?.textContent.includes('保存在本机'));assert.equal((await ledger.snapshot()).policy.version,lostVersion+1);
  // A different window wins: stale drafts must not silently overwrite it.
  await page.locator('#runtimeRunLimit').fill('15');state=await ledger.snapshot();await ledger.setPolicy({expectedVersion:state.policy.version,requestId:'other-'+theme,policy:{paused:true,dailyRunLimit:19,dailyTokenLimit:3000}});
  await page.locator('#runtimeApply').click();await page.waitForFunction(()=>document.querySelector('#runtimeRunLimit')?.value==='19');assert.equal((await ledger.snapshot()).policy.dailyRunLimit,19);
  await page.locator('#runtimePaused').uncheck();await page.locator('#runtimeRunLimit').fill('');await page.locator('#runtimeTokenLimit').fill('');await page.locator('#runtimeApply').click();await page.waitForFunction(()=>!document.querySelector('#runtimeApply')?.disabled&&document.querySelector('#runtimeSaveNote')?.textContent.includes('保存在本机'));state=await ledger.snapshot();assert.equal(state.policy.paused,false);assert.equal(state.policy.dailyRunLimit,null);
  await page.locator('#runtimeFilter').selectOption('all');await page.locator('#runtimeStyle').selectOption(theme);assert.equal(await page.locator('.runtime-run').count(),14);await page.locator('#runtimeStyle').selectOption('all');await page.locator('.runtime-run').first().locator('summary').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#runtimeExport').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/^hyper-dimension-runs-/);
  await page.screenshot({path:'qa/v43/'+theme+'-runtime-desktop.png'});
  await page.setViewportSize({width:390,height:780});await page.locator('.modal-body').evaluate(el=>el.scrollTop=0);assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await page.screenshot({path:'qa/v43/'+theme+'-runtime-compact.png'});
  await page.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);const close=await page.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<=780);for(const id of ['runtimeBack','runtimeRefresh','runtimeProjects'])assert(await page.locator('#'+id).evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight}));
  await page.locator('#closeModal').click();await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>window.islandInspect?.().npcProfileAudit);await open();assert.equal(await page.locator('#runtimePaused').isChecked(),false);assert.equal(await page.locator('#runtimeRunLimit').inputValue(),'');
  report.checks.push({theme,pagination:true,lineage:true,unknownNotZero:true,invalidRejected:true,doubleClickSafe:true,lostReplyRetryIdempotent:true,staleConflictRefresh:true,policyReloadFromDisk:true,export:true,compactNoOverflow:true,fixedCloseAndFooter:true});await context.close();
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.externalRequests.length,0);assert.equal(report.badAssets.length,0);report.passed=true;
}catch(e){report.passed=false;report.failure=e.stack;if(page&&!page.isClosed())await page.screenshot({path:'qa/v43/browser-failure.png'}).catch(()=>{});throw e}
finally{await writeFile('qa/v43/runtime-browser-report.json',JSON.stringify(report,null,2));await engine?.close();server.kill()}
console.log(JSON.stringify(report,null,2));
