import assert from 'node:assert/strict';
import fs from 'node:fs';
import {syncBuiltinESMExports} from 'node:module';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v218/native-save-lock');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'fictional-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'LOCK-FAULT-ONLY'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions()),originalOpen=fs.promises.open;
const report={scope:'Isolated fictional LAN accounts. Inject three Windows EPERM denials into actual save-lock acquisition during a native player gather finish; real HTTP, unique gather receipt and empty-browser restore. No user browser/save/provider, clock acceleration or resource fixture.',cases:[],passed:false};let targetTheme=null,remaining=0,injected=0;
fs.promises.open=async(path,flags,mode)=>{const file=resolve(String(path));if(remaining>0&&flags==='wx'&&file.startsWith(directory+sep)&&file.endsWith(sep+targetTheme+sep+'write.lock')){remaining--;injected++;throw Object.assign(Error('Fictional Windows delete-pending save lock'),{code:'EPERM'});}return originalOpen(path,flags,mode);};syncBuiltinESMExports();
try{
 if(process.platform!=='win32'){report.skipped='Windows sharing behavior only';report.passed=true;}
 else for(const theme of ['pixel','origami']){
  const row={theme,errors:[],saveErrors:[],passed:false};report.cases.push(row);targetTheme=theme;injected=0;remaining=0;
  const account=await service.identities.register({login:'save_lock_'+theme,password:'fictional-lock-password',name:'互斥验证岛主',islandName:'互斥验证岛',avatar:'female_1',theme});
  const open=async()=>{const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);let armed=false;
   await context.route('**/api/**',r=>{const req=r.request(),path=new URL(req.url()).pathname;if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated lock test"}'});if(path.endsWith('/action')&&req.method()==='POST'){const input=req.postDataJSON();if(!armed&&!input.kind&&input.operation==='finish'){armed=true;remaining=3;row.finishRequestId=input.requestId;}}return r.continue();});
   const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/api/saves/')&&r.status()>=400)row.saveErrors.push(r.status());});await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&window.islandInspect().serverCommerce?.ready,null,{timeout:60000});return{context,page};};
  let {context,page}=await open();
  try{
   const before=await page.evaluate(()=>islandInspect());assert.equal(before.coins,0);assert(Object.values(before.inventory).every(n=>n===0));if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#gatherBtn').click();await page.locator('[data-source="forest"]').click();await page.locator('[data-gather="wood"]').click();await page.waitForFunction(()=>islandInspect().inventory.wood>=2,null,{timeout:45000});
   await page.locator('#actionRecoveryDock').waitFor({state:'hidden',timeout:10000});
   assert.equal(injected,3);assert.equal(remaining,0);assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);assert.deepEqual(row.saveErrors,[]);
   const store=(await service.tenants.get(account.token)).saves,after=await store.current(theme),receipts=after.actions.receipts.filter(r=>r.ticket.requestId===row.finishRequestId&&r.outcome==='finished');assert.equal(receipts.length,1);assert.equal(receipts[0].gain.wood,2);row.actualUniqueGatherReceipt=true;
   await page.screenshot({path:join(out,theme+'-confirmed.png')});await context.close();({context,page}=await open());assert((await page.evaluate(()=>islandInspect().inventory.wood))>=2);assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);assert.deepEqual(row.errors,[]);row.injectedFailures=injected;row.emptyBrowserRestore=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{remaining=0;await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 if(!report.skipped)report.passed=report.cases.every(c=>c.passed);
}finally{fs.promises.open=originalOpen;syncBuiltinESMExports();await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
