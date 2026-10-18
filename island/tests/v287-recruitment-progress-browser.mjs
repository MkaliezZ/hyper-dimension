import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {createProject} from '../src/projectPlans.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v287/native-recruitment-progress');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'OWNED-RECRUIT-PROGRESS'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Owned fictional progressed islands with100coins and a saved supply plan. Hold a real accepted commerce response behind actual hire preparation, then inspect preparation/transmitted/error UI phases, one8coin hold and cancellation. The hire rejection is a declared409fixture; no model, actual recruitment, game clock, completed action or receipt is injected. Not earned-zero, human or physical-device acceptance.',cases:[],passed:false};let browser;
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function within(promise,ms,message){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error(message)),ms))]);}finally{clearTimeout(timer);}}
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],hireInputs:[],passed:false};report.cases.push(row);
  const account=await service.identities.register({login:'progress_'+theme,password:'fictional-password',name:'Fictional progress owner',islandName:'Owned progress island',avatar:'female_1',theme}),store=(await service.tenants.get(account.token)).saves;
  const state=hydrateTown(createZeroState());state.freshStartPending=false;state.coins=100;state.saveSlot='owned-progress-'+account.view.me.id;
  assert(createProject(state,{id:'progress-supply',title:'Owned supply plan',targets:{wood:20}}).ok);await store.open(theme,{legacyState:state,protect:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),foreignId=randomUUID();
  const foreignHeld=deferred(),releaseForeign=deferred(),hireSent=deferred(),rejectHire=deferred();let armed=true;
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/src/app.js',async route=>{const response=await route.fetch(),source=await response.text(),needle='const saveUI=createSaveUI(';assert.equal(source.split(needle).length,2);return route.fulfill({response,body:source.replace(needle,'window.__recruitProgress={saves,async quiet(){for(const n of npcs){runtime.releaseActor(n);n.manualUntil=1e9;}await saves.idle(theme);}};'+needle)});});
  await context.route('**/api/**',async route=>{
   try{
    const pathname=new URL(route.request().url()).pathname;
    if(pathname==='/api/saves/'+theme+'/action'){
     const input=route.request().postDataJSON();
     if(armed&&input.kind==='commerce'&&input.operation==='hire_prepare'){
      armed=false;const response=await route.fetch();assert.equal(response.status(),200);row.realHirePreparationAccepted=true;
      await page.evaluate(({theme,id})=>{window.__recruitForeign={settled:false};window.__recruitProgress.saves.action(theme,{kind:'commerce',operation:'enable',requestId:id}).then(()=>window.__recruitForeign.settled=true,error=>window.__recruitForeign.error=error.message);},{theme,id:foreignId});
      return await route.fulfill({response});
     }
     if(input.requestId===foreignId){const response=await route.fetch();assert.equal(response.status(),200);foreignHeld.resolve();await releaseForeign.promise;return await route.fulfill({response});}
    }
    if(pathname==='/api/recruitment/'+theme+'/hire'){
     row.hireInputs.push(route.request().postDataJSON());hireSent.resolve();await rejectHire.promise;
     return await route.fulfill({status:409,contentType:'application/json',body:'{"error":"明确拒绝：本次测试未创建聘约","code":"recruitment_no_work"}'});
    }
    if(/^\/api\/(npc|hermes)\//.test(pathname)||pathname==='/api/lan/social/tick')return await route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in owned progress fixture"}'});
    return await route.continue();
   }catch(error){if(!page.isClosed())row.errors.push(error.message);await route.abort().catch(()=>{});}
  });
  page.on('pageerror',error=>row.errors.push(error.message));
  try{
   await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce.ready&&!islandInspect().startup.busy,null,{timeout:60000});
   await page.evaluate(()=>window.__recruitProgress.quiet());await page.locator('#stewardBtn').click();await page.locator('#stewardRecruit').click();await page.locator('#recruitPlan').selectOption('progress-supply');await page.locator('#recruitHire').click();
   await within(foreignHeld.promise,8000,'The actual accepted foreign response must be held');await page.locator('#recruitResume').waitFor({state:'visible',timeout:8000});
   assert.equal(await page.locator('#recruitResume').isDisabled(),true,'Do not present a clickable retry that silently ignores input while preparation is in progress');
   assert.equal(await page.locator('#recruitmentPanel').getAttribute('aria-busy'),'true');assert.match(await page.locator('.recruit-await').textContent(),/正在保存本次筹备/);
   assert.equal(row.hireInputs.length,0,'The external hire must not cross the accepted foreign receipt');
   let document=await store.current(theme);const contractId=document.state.recruitment.pending.id;
   assert.equal(document.state.coins,100);assert.equal(document.state.resourceLedger.reservations['hire:'+contractId].items.coins,8);
   row.checkpointWaitFeedback=true;await page.screenshot({path:join(out,theme+'-preparing.png')});
   releaseForeign.resolve();await within(hireSent.promise,8000,'Hire must issue after the original foreign response is acknowledged');
   assert.equal(await page.evaluate(()=>window.__recruitForeign.settled),true);assert.equal(row.hireInputs[0].requestId,contractId);
   assert.equal(await page.locator('#recruitResume').isDisabled(),true);assert.match(await page.locator('.recruit-await').textContent(),/已发出邀请/);row.transmittedFeedback=true;
   rejectHire.resolve();await page.waitForFunction(()=>document.querySelector('.recruit-error')?.textContent.includes('明确拒绝'),null,{timeout:8000});
   assert.equal(await page.locator('#recruitResume').isEnabled(),true);assert.equal(await page.locator('#recruitmentPanel').getAttribute('aria-busy'),'false');
   document=await store.current(theme);assert.equal(document.state.recruitment.pending.id,contractId);assert.equal(document.state.coins,100);assert.equal(document.state.resourceLedger.reservations['hire:'+contractId].items.coins,8);assert.equal(row.hireInputs.length,1);
   await page.locator('#recruitCancel').click();await page.waitForFunction(()=>!islandInspect().recruitment.pending,null,{timeout:30000});
   document=await store.current(theme);assert.equal(document.state.coins,100);assert.equal(document.state.resourceLedger.reservations['hire:'+contractId],undefined);assert.deepEqual(row.errors,[]);
   row.definiteErrorRetryEnabled=true;row.originalReceiptDrainedBeforeHire=true;row.singleReservationReleased=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{releaseForeign.resolve();rejectHire.resolve();await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(row=>row.passed);
}finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
