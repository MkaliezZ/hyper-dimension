import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v214/native-recovery-link');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'RECOVERY-LINK-ONLY'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Fictional LAN accounts only. Both automatic recovery navigations receive 204; the visible ordinary return link must then open the reconciled island. Original progress, backup, sealed outgoing page and usable controls checked. No user browser/save or provider calls.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],cancelledNavigations:0};report.cases.push(row);
  const account=await service.identities.register({login:'recovery_link_'+theme,password:'fictional-link-password',name:'返回验证岛主',islandName:'返回验证岛',avatar:'female_1',theme});
  await service.tenants.open(account.token,theme);const store=(await service.tenants.get(account.token)).saves,before=await store.current(theme),stale=structuredClone(before.state);stale.coins=987;
  const key='hd-lan:'+account.view.me.id+':hyper-dimension-'+theme+'-pending-server-save',pending={state:stale,baseVersion:'fictional-stale-version',clientId:'fictional-stale-client'};
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({key,pending})=>{if(!sessionStorage.getItem('recovery-seeded')){sessionStorage.setItem('recovery-seeded','1');localStorage.setItem(key,JSON.stringify(pending));}},{key,pending});
  let documents=0;await context.route(/\/play\?/,r=>{documents++;if(documents===2||documents===3){row.cancelledNavigations++;return r.fulfill({status:204,body:''});}return r.continue();});
  await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in fictional recovery test"}'}):r.continue();});
  page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base+'/play?qa=1');await page.locator('#recoveryAll:visible').waitFor({timeout:60000});
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   if(theme==='origami'){await page.locator('[data-save-recovery-details]').click();await page.locator('#acceptServerSave').click();row.entry='save-dialog';}else{await page.locator('#recoveryAll').click();row.entry='recovery-dock';}
   await page.waitForFunction(()=>document.querySelector('#saveStatus')?.textContent.includes('进度已核对'),null,{timeout:30000});
   await page.waitForFunction(()=>document.querySelector('#recoveryOpenIsland')?.getAttribute('href'),null,{timeout:10000});
   for(let i=0;row.cancelledNavigations<2&&i<100;i++)await page.waitForTimeout(100);assert.equal(row.cancelledNavigations,2);
   assert.equal(await page.locator('#recoveryOpenIsland').isVisible(),true);assert.equal(await page.locator('#recoveryAll').isVisible(),false);assert.equal(await page.locator('#bagBtn').evaluate(e=>e.closest('[inert]')!==null),true,'The obsolete page must remain sealed');
   const backup=await page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('hyper-dimension-save-journal',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readonly'),r=tx.objectStore('entries').get(key+'-previous');r.onsuccess=()=>resolve(JSON.parse(r.result));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();};}),key);assert.equal(backup.state.coins,987);row.localBackupPreserved=true;
   await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#actionRecoveryDock').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:join(out,theme+'-confirmed-return-390.png')});await page.setViewportSize({width:1440,height:1000});
   await page.screenshot({path:join(out,theme+'-confirmed-return.png')});await page.locator('#recoveryOpenIsland').click();
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});
   assert.equal(documents,4);assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);assert(new URL(page.url()).searchParams.has('recoveryReturn'));
   const after=await store.current(theme);assert.equal(after.state.saveSlot,before.state.saveSlot);assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.inventory,before.state.inventory);
   assert.equal(after.actions.receipts.length,before.actions.receipts.length);assert.equal(await page.locator('#bagBtn').evaluate(e=>e.closest('[inert]')!==null),false);
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#bagBtn').click();await page.locator('#closeModal').click();
   assert.deepEqual(row.errors,[]);row.progressPreserved=true;row.controlsUsable=true;row.passed=true;await page.screenshot({path:join(out,theme+'-returned.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
