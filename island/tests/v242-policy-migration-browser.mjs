import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v242/native-policy');await mkdir(out,{recursive:true});
const directory=await mkdtemp(join(out,'fictional-')),start=()=>createLanHttpServer({directory,port:0,enrollmentKey:'LEGACY-POLICY-ONLY'});
let service=await start();const users=[],hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// Reconstruct an acknowledged historical server document, never a client import.
for(const theme of ['pixel','origami']){
 const account=await service.identities.register({login:'legacy_'+theme,password:'fictional-legacy-password',name:'旧档岛主',islandName:'迁移验证岛',avatar:'male_0',theme});await service.tenants.open(account.token,theme,{});
 const tenant=await service.tenants.get(account.token);users.push({...account,theme,file:join(tenant.directory,theme,'current.json')});
}
await service.close();
for(const u of users){const doc=JSON.parse(await readFile(u.file,'utf8'));Object.assign(doc.state.economy,{budgetPolicyVersion:105,budgetPolicyStartsDay:1,budgetPreviousVersion:12});Object.assign(doc.actions.commerce.snapshot.policy,{budgetPolicyVersion:105,budgetPolicyStartsDay:1,budgetPreviousVersion:12});doc.checksum=hash(doc.state);doc.actionsChecksum=hash(doc.actions);await writeFile(u.file,JSON.stringify(doc));u.before=doc;}
service=await start();const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Two fictional server-created zero islands, with acknowledged policy105 reconstructed on disk while the service is stopped. Native LAN open, ordinary autosave, appearance transaction and reload. No original user data, injected resources/time, real models, human or physical-device acceptance.',cases:[],passed:false};
try{
 for(const u of users){const row={theme:u.theme,errors:[],saveErrors:[],passed:false};report.cases.push(row);const context=await browser.newContext({viewport:{width:1440,height:1000}});let page;
  try{
   await context.addCookies([{name:'hd_lan_session',value:u.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(p)||p==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated migration check"}'}):r.continue();});
   page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));const responses=[];page.on('response',r=>{if(r.status()>=400&&r.url().includes('/api/saves/'))responses.push(r.json().then(d=>row.saveErrors.push({status:r.status(),code:d.code})));});
   const opened=page.waitForResponse(r=>r.url().includes('/api/saves/')&&r.url().endsWith('/open')&&r.status()===200,{timeout:60000});await page.goto(base+'/play?qa=1');const doc=(await(await opened).json()).document;
   assert.equal(doc.state.economy.budgetPolicyVersion,202);assert.equal(doc.state.economy.budgetPreviousVersion,105);assert.equal(doc.state.economy.budgetPolicyStartsDay,1);assert.equal(doc.state.coins,0);assert.deepEqual(doc.state.inventory,u.before.state.inventory);assert.equal(doc.state.saveSlot,u.before.state.saveSlot);
   const ready=()=>page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&window.islandInspect().serverCommerce?.ready&&!document.getElementById('app')?.inert&&document.getElementById('actionRecoveryDock')?.hidden!==false,null,{timeout:60000});await ready();
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();await page.locator('#stewardBtn').click();await page.locator('#closeModal').click();await page.waitForResponse(r=>r.url().includes('/api/saves/')&&r.url().endsWith('/save')&&r.status()===200,{timeout:45000});row.ordinaryAutosave=true;
   const next=u.theme==='pixel'?'origami':'pixel';await page.locator(next==='pixel'?'#themePixel':'#themeOrigami').click();await page.waitForFunction(next=>window.islandInspect().theme===next,next,{timeout:60000});await ready();await page.reload();await ready();assert.equal(await page.evaluate(()=>window.islandInspect().theme),next);
   const tenant=await service.tenants.get(u.token),after=await tenant.saves.current(next);assert.equal(after.state.saveSlot,u.before.state.saveSlot);assert.equal(after.state.economy.budgetPolicyVersion,202);assert.equal(after.state.economy.budgetPolicyStartsDay,1);await Promise.all(responses);assert.deepEqual(row.errors,[]);assert.deepEqual(row.saveErrors,[]);row.sharedSaveSwitchAndReload=true;row.passed=true;await page.screenshot({path:join(out,u.theme+'-reopened.png')});
  }catch(e){row.failure=e.stack;process.exitCode=1;await page?.screenshot({path:join(out,u.theme+'-failure.png')}).catch(()=>{});}finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.length===2&&report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
