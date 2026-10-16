import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v223/native-recovery-feedback');
await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'RECOVERY-FEEDBACK-ONLY'});
const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Fictional isolated LAN accounts. Start recovery from the actual save dialog; hold or reject its canonical read. Require visible progress, a usable safe restart or durable retry feedback, original backup and canonical resources. No user browser/save or provider calls.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,mode:theme==='pixel'?'held-read':'failed-read',errors:[]};report.cases.push(row);
  const account=await service.identities.register({login:'rec_feedback_'+theme,password:'fictional-feedback-password',name:'核对反馈岛主',islandName:'核对反馈岛',avatar:'female_1',theme});
  await service.tenants.open(account.token,theme);
  const store=(await service.tenants.get(account.token)).saves,before=await store.current(theme),stale=structuredClone(before.state);stale.coins=987;
  const key='hd-lan:'+account.view.me.id+':hyper-dimension-'+theme+'-pending-server-save';
  const pending={state:stale,baseVersion:'fictional-stale-version',clientId:'fictional-stale-client'};
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  let intercepted=false,release;
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({key,pending})=>{if(!sessionStorage.getItem('feedback-seeded')){sessionStorage.setItem('feedback-seeded','1');localStorage.setItem(key,JSON.stringify(pending));}},{key,pending});
  await context.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated recovery test"}'});
   if(!intercepted&&req.method()==='GET'&&path==='/api/saves/'+theme){
    intercepted=true;
    if(theme==='origami')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"隔离测试：本机服务暂时不可用","code":"fixture_unavailable"}'});
    const response=await route.fetch();await new Promise(resolve=>{release=resolve;});return route.fulfill({response}).catch(()=>{});
   }
   return route.continue();
  });
  page.on('pageerror',error=>row.errors.push(error.message));
  try{
   await page.goto(base+'/play?qa=1');
   await page.locator('#recoveryAll:visible').waitFor({timeout:60000});
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   await page.locator('[data-save-recovery-details]').click();
   await page.locator('#acceptServerSave').click();
   for(let i=0;!intercepted&&i<100;i++)await page.waitForTimeout(50);
   assert.equal(intercepted,true,'Recovery must reach the actual canonical read');
   assert.equal(await page.locator('#actionRecoveryDock').isVisible(),true,'The save dialog must not hide recovery feedback and the safe way back');
   if(theme==='pixel'){
    await page.waitForFunction(()=>document.querySelector('#actionRecoveryDock')?.getAttribute('aria-busy')==='true');
    await page.locator('[data-recovery-progress]:visible').waitFor();
    assert.match(await page.locator('[data-recovery-progress]').textContent(),/正在读取服务端/);
    assert.equal(await page.locator('#recoveryOpenIsland').isVisible(),true);
    assert.match(await page.locator('#recoveryOpenIsland').textContent(),/重新进入/);
   }else{
    await page.waitForFunction(()=>document.querySelector('#actionRecoveryDock [data-recovery-error]')?.textContent.includes('隔离测试：本机服务暂时不可用'));
    assert.equal(await page.locator('#recoveryAll').isEnabled(),true,'A rejected read must leave a usable retry');
    assert.equal(await page.locator('[data-recovery-progress]').isVisible(),false);
   }
   assert.equal(await page.locator('#bagBtn').evaluate(e=>e.closest('[inert]')!==null),true,'An unresolved receipt cannot resume the old simulation');
   const backup=await page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('hyper-dimension-save-journal',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readonly'),req=tx.objectStore('entries').get(key+'-previous');req.onsuccess=()=>resolve(JSON.parse(req.result));req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();};}),key);
   assert.equal(backup.state.coins,987);row.backupPreserved=true;
   await page.setViewportSize({width:390,height:844});
   assert.equal(await page.locator('#actionRecoveryDock').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
   await page.screenshot({path:join(out,theme+'-feedback-390.png')});
   await page.setViewportSize({width:1440,height:1000});
   await page.screenshot({path:join(out,theme+'-feedback.png')});
   if(theme==='pixel')await page.locator('#recoveryOpenIsland').click();else await page.locator('#recoveryAll').click();
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});
   assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);
   const after=await store.current(theme);assert.equal(after.state.saveSlot,before.state.saveSlot);assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.inventory,before.state.inventory);assert.equal(after.actions.receipts.length,before.actions.receipts.length);
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#bagBtn').click();await page.locator('#closeModal').click();
   assert.deepEqual(row.errors,[]);row.progressPreserved=true;row.controlsUsable=true;row.passed=true;
   await page.screenshot({path:join(out,theme+'-returned.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{release?.();await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure}))}));}
