import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v220/native-recovery-modal');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'RECOVERY-MODAL-ONLY'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Isolated fictional LAN /play accounts and canonical save conflicts. A native modal dialog reproduces the browser top-layer input lock used by workshop pause/result screens; no game completion is simulated. Native clicks must reconcile the actual save, preserve its backup/resources, reload and release controls in both themes. No user browser/save/provider calls.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[]};report.cases.push(row);
  const account=await service.identities.register({login:'modal_recovery_'+theme,password:'fictional-modal-password',name:'弹窗验证岛主',islandName:'弹窗验证岛',avatar:'female_1',theme});
  await service.tenants.open(account.token,theme);const store=(await service.tenants.get(account.token)).saves,before=await store.current(theme),stale=structuredClone(before.state);stale.coins=987;
  const key='hd-lan:'+account.view.me.id+':hyper-dimension-'+theme+'-pending-server-save',pending={state:stale,baseVersion:'fictional-stale-version',clientId:'fictional-stale-client'};
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({key,pending})=>{if(!sessionStorage.getItem('modal-recovery-seeded')){sessionStorage.setItem('modal-recovery-seeded','1');localStorage.setItem(key,JSON.stringify(pending));}},{key,pending});
  await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in fictional modal recovery test"}'}):r.continue();});
  page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base+'/play?qa=1');await page.locator('#recoveryAll:visible').waitFor({timeout:60000});await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   // Native showModal() makes outside elements implicitly inert, independently
   // of their HTML inert property or CSS z-index. Model a previously open pause.
   await page.evaluate(()=>{const d=document.createElement('dialog');d.className='wk-session-dialog';d.innerHTML='<h2>工作台 · 暂停</h2><button>继续挑战</button>';document.querySelector('#modalRoot').append(d);d.showModal();});
   await page.locator('#recoveryAll').click({timeout:4000});
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('#actionRecoveryDock')||document.querySelector('#actionRecoveryDock').hidden,null,{timeout:30000});
   const after=await store.current(theme);assert.equal(after.state.saveSlot,before.state.saveSlot);assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.inventory,before.state.inventory);assert.equal(after.actions.receipts.length,before.actions.receipts.length);
   const backup=await page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('hyper-dimension-save-journal',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readonly'),r=tx.objectStore('entries').get(key+'-previous');r.onsuccess=()=>resolve(JSON.parse(r.result));r.onerror=()=>reject(r.error);tx.oncomplete=()=>db.close();};}),key);assert.equal(backup.state.coins,987);
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();await page.locator('#bagBtn').click();await page.locator('#closeModal').click();
   // A failed read must restore the prior native pause on dismissal without
   // discarding its contents. Exercise the shared recovery owner directly.
   row.restoredDialog=await page.evaluate(async()=>{const ui=await import('/src/actionRecoveryUI.js'),d=document.createElement('dialog'),bar=document.createElement('section');d.className='wk-session-dialog';d.innerHTML='<h2>保留的暂停</h2><button>继续挑战</button>';document.querySelector('#modalRoot').append(d);d.showModal();bar.innerHTML='<p>断线待核对</p>';ui.lockActionUI(bar);await new Promise(r=>setTimeout(r,0));if(d.open)throw Error('Native pause still blocks recovery');ui.unlockActionUI(bar);bar.remove();await new Promise(r=>setTimeout(r,0));const intact=d.open&&d.matches(':modal')&&d.querySelector('h2').textContent==='保留的暂停';d.close();d.remove();return intact;});assert.equal(row.restoredDialog,true);
   row.modalLifecycle=await page.evaluate(async()=>{
    const ui=await import('/src/actionRecoveryUI.js'),root=document.querySelector('#modalRoot'),bar=document.createElement('section'),second=document.createElement('section'),d=document.createElement('dialog');
    d.className='wk-session-dialog';d.innerHTML='<h2>待恢复的结算</h2>';root.append(d);d.showModal();ui.lockActionUI(bar);
    await new Promise(r=>setTimeout(r,0));d.showModal();await new Promise(r=>setTimeout(r,0));const reopenedDuringRecoverySuspended=!d.open;
    ui.unlockActionUI(bar);ui.lockActionUI(second);await new Promise(r=>setTimeout(r,0));const remainsSuspended=!d.open;ui.unlockActionUI(second);await new Promise(r=>setTimeout(r,0));const restoredAfterLastOwner=d.matches(':modal');
    ui.lockActionUI(bar);d.innerHTML='<h2>另一局</h2>';ui.unlockActionUI(bar);await new Promise(r=>setTimeout(r,0));const replacedContentNotRestored=!d.open;d.remove();bar.remove();second.remove();
    const nonmodal=document.createElement('dialog');root.append(nonmodal);nonmodal.show();ui.lockActionUI(bar);const ordinaryDialogUntouched=nonmodal.open;ui.unlockActionUI(bar);bar.remove();nonmodal.close();nonmodal.remove();
    return {reopenedDuringRecoverySuspended,remainsSuspended,restoredAfterLastOwner,replacedContentNotRestored,ordinaryDialogUntouched};
   });for(const value of Object.values(row.modalLifecycle))assert.equal(value,true);
   assert.deepEqual(row.errors,[]);row.progressPreserved=true;row.backupPreserved=true;row.controlsUsable=true;row.passed=true;await page.screenshot({path:join(out,theme+'-returned.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure}))}));}
