import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {DEFAULT_CLOCK} from '../src/environmentClock.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v237/project-window');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'PROJECT-WINDOW-ONLY'});
const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Native project UI with server-created zero resources and a real canonical wood plan. Only the displayed world-clock observation is controlled to test off-shift, sleep and next-shift rendering. No work, money, model, human or real-time scheduling acceptance claimed.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],passed:false};report.cases.push(row);let context,page;
  try{
   const account=await service.identities.register({login:'window_'+theme,password:'fictional-window-password',name:'筹备提示岛主',islandName:'时段提示岛',avatar:'female_1',theme});
   const tenant=await service.tenants.get(account.token);await service.tenants.open(account.token,theme,{});
   let hour=18,revision=1;
   context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/world/environment')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({clock:{...DEFAULT_CLOCK,clockId:'project-window-fixture',revision,epochMs:Date.now(),dayLengthMs:86400000,phaseAtEpoch:hour/24,source:'central'},serverNowMs:Date.now(),synchronization:'synced'})});
    if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled for isolated presentation check"}'});
    return route.continue();
   });
   page=await context.newPage();page.on('pageerror',error=>row.errors.push(error.message));await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#stewardBtn').click();await page.locator('#stewardProjects').click();
   for(const id of ['lantern','wheat'])await page.locator('[data-remove-target="'+id+'"]').click();
   await page.locator('#planTitle').fill('明早收集两份木材');await page.locator('#planItem').selectOption('wood');await page.locator('#planQuantity').fill('2');await page.locator('#planAdd').click();await page.locator('#planCreate').click();
   const step=page.locator('[data-plan-step]').first(),note=step.locator('.plan-work-window');
   await note.filter({hasText:'已下班'}).waitFor();assert.match(await note.innerText(),/07:00–16:00/);row.offShiftText=await note.innerText();
   const id=await step.getAttribute('data-plan-step'),before=(await tenant.saves.current(theme)).state.agentTaskLedger.find(t=>t.id===id);assert.equal(before.npcId,5);assert.equal(before.completed,0);
   await page.screenshot({path:join(out,theme+'-off-shift.png')});await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await note.scrollIntoViewIfNeeded();await page.screenshot({path:join(out,theme+'-mobile.png')});
   hour=23;revision++;await page.evaluate(async()=>{const {worldEnvironment}=await import('/src/environmentClient.js');await worldEnvironment().refresh();});await note.filter({hasText:'正在休息'}).waitFor();row.sleepText=await note.innerText();
   hour=8;revision++;await page.evaluate(async()=>{const {worldEnvironment}=await import('/src/environmentClient.js');await worldEnvironment().refresh();});await note.waitFor({state:'detached'});
   assert.equal((await tenant.saves.current(theme)).state.agentTaskLedger.find(t=>t.id===id).completed,0);assert.deepEqual(row.errors,[]);row.liveClockRepaint=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page?.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.length===2&&report.cases.every(row=>row.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,failure})=>({theme,passed,failure}))}));}
