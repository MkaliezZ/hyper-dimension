import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v268/recovery-background');
await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'RECOVERY-BACKGROUND-ONLY'});
const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Fictional isolated LAN saves, real native frames, viewport resize and strict4-second recovery click. Observe main canvas paints without changing frame timing, game state, input or rendering. Providers disabled; no user data or browser.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[]};report.cases.push(row);
  const account=await service.identities.register({login:'background_'+theme,password:'fictional-background-password',name:'绘制验证岛主',islandName:'绘制验证岛',avatar:'female_1',theme});
  await service.tenants.open(account.token,theme);
  const store=(await service.tenants.get(account.token)).saves,before=await store.current(theme),stale=structuredClone(before.state);stale.coins=987;
  const key='hd-lan:'+account.view.me.id+':hyper-dimension-'+theme+'-pending-server-save';
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.addInitScript(({key,stale})=>{
   if(!sessionStorage.getItem('background-seeded')){
    sessionStorage.setItem('background-seeded','1');
    localStorage.setItem(key,JSON.stringify({state:stale,baseVersion:'fictional-stale-version',clientId:'fictional-stale-client'}));
   }
   window.recoveryCanvasPaints=0;
   const clear=CanvasRenderingContext2D.prototype.clearRect;
   CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='game')window.recoveryCanvasPaints++;return clear.apply(this,args);};
  },{key,stale});
  await context.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in fictional background test"}'}):route.continue();
  });
  page.on('pageerror',e=>row.errors.push(e.message));
  const paintsAcrossFrames=()=>page.evaluate(async()=>{
   const before=window.recoveryCanvasPaints,start=performance.now();
   for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
   return {before,after:window.recoveryCanvasPaints,painted:window.recoveryCanvasPaints-before,elapsedMs:performance.now()-start,saveStatus:document.querySelector('#saveStatus')?.dataset.status};
  });
  try{
   await page.goto(base+'/play?qa=1');
   await page.locator('#recoveryAll:visible').waitFor({timeout:60000});
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   row.blocked=await paintsAcrossFrames();
   assert.equal(row.blocked.saveStatus,'conflict');
   assert.ok(row.blocked.after>0,'The blocked island must have a painted backdrop');
   assert.ok(row.blocked.painted<=1,'A blocked island must retain its backdrop instead of repainting every frame');
   const oldPaints=await page.evaluate(()=>window.recoveryCanvasPaints);
   await page.setViewportSize({width:1400,height:960});
   row.resized=await paintsAcrossFrames();row.resized.paintedSinceResize= row.resized.after-oldPaints;
   assert.ok(row.resized.paintedSinceResize>=1,'Resize must redraw the retained backdrop at its new resolution');
   assert.ok(row.resized.paintedSinceResize<=2,'Resize must not restart continuous blocked painting');
   row.nativeClick={timeoutMs:4000,startedAt:Date.now()};
   await page.locator('#recoveryAll').click({timeout:4000});
   row.nativeClick.elapsedMs=Date.now()-row.nativeClick.startedAt;
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});
   await page.waitForFunction(()=>!document.querySelector('#actionRecoveryDock')||document.querySelector('#actionRecoveryDock').hidden,null,{timeout:30000});
   const after=await store.current(theme);
   assert.equal(after.state.saveSlot,before.state.saveSlot);assert.equal(after.state.coins,before.state.coins);assert.deepEqual(after.state.inventory,before.state.inventory);assert.equal(after.actions.receipts.length,before.actions.receipts.length);
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   row.resumed=await paintsAcrossFrames();
   assert.ok(row.resumed.painted>=6,'Normal island animation must resume after reconciliation');
   await page.locator('#bagBtn').click();await page.locator('#closeModal').click();
   assert.deepEqual(row.errors,[]);row.progressPreserved=true;row.controlsUsable=true;row.passed=true;
   await page.screenshot({path:join(out,theme+'-resumed.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
