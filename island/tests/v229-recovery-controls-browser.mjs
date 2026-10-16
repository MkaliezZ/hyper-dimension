import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v229/recovery-controls');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'RECOVERY-CONTROLS-ONLY'});
const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Isolated fictional LAN saves. Actual canonical conflict recovery with one held/rejected read, then retry and navigation. Additional UI-only cards exercise controller mount/release and disabled-state transitions during the held read; they do not simulate game completion or receipts. No original user browser/save or provider calls.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[]};report.cases.push(row);
  const account=await service.identities.register({login:'controls_'+theme,password:'fictional-controls-password',name:'核对控制验证',islandName:'核对控制岛',avatar:'female_1',theme});
  await service.tenants.open(account.token,theme);const store=(await service.tenants.get(account.token)).saves,before=await store.current(theme),stale=structuredClone(before.state);stale.coins=987;
  const key='hd-lan:'+account.view.me.id+':hyper-dimension-'+theme+'-pending-server-save',pending={state:stale,baseVersion:'fictional-stale-version',clientId:'fictional-stale-client'};
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let held=false,release;
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({key,pending})=>{if(!sessionStorage.getItem('controls-seeded')){sessionStorage.setItem('controls-seeded','1');localStorage.setItem(key,JSON.stringify(pending));}},{key,pending});
  await context.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated recovery test"}'});
   if(!held&&request.method()==='GET'&&path==='/api/saves/'+theme){held=true;await new Promise(resolve=>{release=resolve;});return route.fulfill({status:503,contentType:'application/json',body:'{"error":"隔离测试：读取暂时失败","code":"fixture_unavailable"}'}).catch(()=>{});}
   return route.continue();
  });
  page.on('pageerror',error=>row.errors.push(error.message));
  try{
   await page.goto(base+'/play?qa=1');await page.locator('#recoveryAll:visible').waitFor({timeout:60000});await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   await page.evaluate(async()=>{const ui=await import('/src/actionRecoveryUI.js'),bar=document.createElement('section');bar.id='qaEarlierCard';bar.className='gather-v46';bar.innerHTML='<p>控制器回执处理中</p><button disabled>原控制器按钮</button>';document.body.append(bar);ui.lockActionUI(bar);});
   await page.locator('#recoveryAll').click();
   await page.waitForFunction(()=>document.querySelector('#actionRecoveryDock')?.getAttribute('aria-busy')==='true');
   for(let i=0;!release&&i<100;i++)await page.waitForTimeout(50);assert.equal(typeof release,'function');
   await page.evaluate(async()=>{const ui=await import('/src/actionRecoveryUI.js');document.querySelector('#qaEarlierCard button').disabled=false;const bar=document.createElement('section');bar.id='qaNewCard';bar.className='gather-v46';bar.innerHTML='<p>核对期间新出现的控制器</p><button>新控制器按钮</button>';document.body.append(bar);ui.lockActionUI(bar);});
   for(const id of ['qaEarlierCard','qaNewCard'])assert.equal(await page.locator('#'+id).evaluate(e=>e.inert),true,'Recovery must block newly mounted cards and changing controller controls while its read is pending');
   assert.equal(await page.locator('#recoveryAll').isEnabled(),false);assert.equal(await page.locator('#recoveryOpenIsland').isVisible(),true);
   await page.screenshot({path:join(out,theme+'-checking.png')});release();release=null;
   await page.waitForFunction(()=>document.querySelector('#actionRecoveryDock [data-recovery-error]')?.textContent.includes('隔离测试：读取暂时失败'));
   assert.equal(await page.locator('#recoveryAll').isEnabled(),true);
   for(const id of ['qaEarlierCard','qaNewCard']){assert.equal(await page.locator('#'+id).evaluate(e=>e.inert),false);assert.equal(await page.locator('#'+id+' button').first().isEnabled(),true,'Failure must not restore a stale disabled flag over the controller latest state');}
   row.dynamicControlsLocked=true;row.latestControllerStatePreserved=true;
   await page.evaluate(async()=>{const ui=await import('/src/actionRecoveryUI.js');for(const id of ['qaEarlierCard','qaNewCard']){const bar=document.getElementById(id);ui.unlockActionUI(bar);bar.remove();}});
   await page.locator('#recoveryAll').click();await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});
   assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);const after=await store.current(theme);assert.equal(after.state.saveSlot,before.state.saveSlot);assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.inventory,before.state.inventory);assert.equal(after.actions.receipts.length,before.actions.receipts.length);
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();await page.locator('#bagBtn').click();await page.locator('#closeModal').click();
   row.readOutlivesCard=await page.evaluate(async()=>{
    const ui=await import('/src/actionRecoveryUI.js'),bar=document.createElement('section');document.body.append(bar);ui.lockActionUI(bar);
    let finish;const read=ui.readRecoveryProgress(bar,()=>new Promise(resolve=>{finish=resolve;}));ui.unlockActionUI(bar);bar.remove();await new Promise(resolve=>setTimeout(resolve,0));
    const dock=document.getElementById('actionRecoveryDock'),retained=!dock.hidden&&document.getElementById('recoveryAll').disabled&&!!document.getElementById('bagBtn').closest('[inert]');finish();await read;
    return retained&&dock.hidden&&!document.getElementById('bagBtn').closest('[inert]');
   });assert.equal(row.readOutlivesCard,true,'An outstanding read must own the dock and its lock even after its last operation card is released');
   assert.deepEqual(row.errors,[]);row.canonicalProgressPreserved=true;row.retryReturned=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{release?.();await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(row=>row.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,failure})=>({theme,passed,failure}))}));}
