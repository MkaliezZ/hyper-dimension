import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v216/native-recovery-wait');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'RECOVERY-WAIT-ONLY'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Isolated fictional LAN accounts. Hold the actual canonical-read response during reconciliation; require a durable backup and ordinary restart link while the old page remains sealed. Re-enter without releasing the old response, then check canonical resources, receipts and usable controls in both themes. No user browser/save/provider or accelerated game clock.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[]};report.cases.push(row);
  const account=await service.identities.register({login:'recovery_wait_'+theme,password:'fictional-wait-password',name:'核对验证岛主',islandName:'核对验证岛',avatar:'female_1',theme});
  await service.tenants.open(account.token,theme);const store=(await service.tenants.get(account.token)).saves,before=await store.current(theme),stale=structuredClone(before.state);stale.coins=987;
  const key='hd-lan:'+account.view.me.id+':hyper-dimension-'+theme+'-pending-server-save',pending={state:stale,baseVersion:'fictional-stale-version',clientId:'fictional-stale-client'};
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let release=null,held=false;
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({key,pending})=>{if(!sessionStorage.getItem('recovery-seeded')){sessionStorage.setItem('recovery-seeded','1');localStorage.setItem(key,JSON.stringify(pending));}},{key,pending});
  await context.route('**/api/**',async r=>{const request=r.request(),path=new URL(request.url()).pathname;if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in fictional recovery test"}'});if(!held&&request.method()==='GET'&&path==='/api/saves/'+theme){held=true;const response=await r.fetch();await new Promise(resolve=>{release=resolve;});return r.fulfill({response}).catch(()=>{});}return r.continue();});
  page.on('pageerror',e=>row.errors.push(e.message));
  row.moduleTraffic=[];
  page.on('response',response=>{const url=new URL(response.url());if(url.pathname.startsWith('/src/')&&(response.status()>=400||['/src/app.js','/src/lan-main.js'].includes(url.pathname))){row.moduleTraffic.push({path:url.pathname,status:response.status(),contentType:response.headers()['content-type']||null});if(row.moduleTraffic.length>40)row.moduleTraffic.shift();}});
  page.on('requestfailed',request=>{const url=new URL(request.url());if(url.pathname.startsWith('/src/')){row.moduleTraffic.push({path:url.pathname,failure:request.failure()?.errorText||'module request failed'});if(row.moduleTraffic.length>40)row.moduleTraffic.shift();}});
  try{
   await page.goto(base+'/play?qa=1');await page.locator('#recoveryAll:visible').waitFor({timeout:60000});await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   await page.locator('#recoveryAll').click();await page.waitForFunction(()=>document.querySelector('#actionRecoveryDock')?.getAttribute('aria-busy')==='true');
   for(let i=0;!release&&i<100;i++)await page.waitForTimeout(50);assert.equal(typeof release,'function','The actual canonical response must reach the hold barrier');
   assert.equal(await page.locator('#recoveryOpenIsland').isVisible(),true,'A stalled reconciliation must keep a safe ordinary re-entry link reachable');
   assert.match(await page.locator('#recoveryOpenIsland').textContent(),/重新/);assert.equal(await page.locator('#bagBtn').evaluate(e=>e.closest('[inert]')!==null),true);
   const backup=await page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('hyper-dimension-save-journal',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readonly'),r=tx.objectStore('entries').get(key+'-previous');r.onsuccess=()=>resolve(JSON.parse(r.result));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();};}),key);assert.equal(backup.state.coins,987);row.backupPreservedBeforeRestart=true;
   if(theme==='origami'){await page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('hyper-dimension-save-journal',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readwrite');tx.objectStore('entries').delete(key);tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);};}),key);row.resolvedPendingJournalFixture=true;}
   await page.screenshot({path:join(out,theme+'-waiting.png')});await page.locator('#recoveryOpenIsland').click();
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});
   assert(new URL(page.url()).searchParams.has('recoveryReturn'));row.reenteredWhileOldReadHeld=true;row.originalConfirmationResumedWithoutSecondClick=true;
   const retainedBackup=await page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('hyper-dimension-save-journal',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readonly'),r=tx.objectStore('entries').get(key+'-previous');r.onsuccess=()=>resolve(JSON.parse(r.result));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();};}),key);assert.equal(retainedBackup.state.coins,987);row.originalBackupPreservedAfterReentry=true;
   assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);const after=await store.current(theme);assert.equal(after.state.saveSlot,before.state.saveSlot);assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.inventory,before.state.inventory);assert.equal(after.actions.receipts.length,before.actions.receipts.length);
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();await page.locator('#bagBtn').click();await page.locator('#closeModal').click();assert.deepEqual(row.errors,[]);row.progressPreserved=true;row.controlsUsable=true;row.passed=true;await page.screenshot({path:join(out,theme+'-returned.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;row.loaderDiagnostic=await Promise.race([page.evaluate(()=>({readyState:document.readyState,appEntered:!!window.__hdIslandAppEntered,moduleFailure:window.__hdModuleBootstrapFailure||null})).catch(()=>null),new Promise(resolve=>setTimeout(()=>resolve({observationTimedOut:true}),2000))]);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{release?.();await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
