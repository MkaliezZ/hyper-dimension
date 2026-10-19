// Owned progressed islands. Native policy editing plus real status reads around
// two declared transient503 replies. No hire,policy mutation or injected clock.
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=resolve(process.env.HD_QA_APP_ROOT||join(import.meta.dirname,'..'));
const {chromium}=createRequire(join(root,'package.json'))('playwright-core');
const {browserLaunchOptions}=await import(pathToFileURL(join(root,'tests/browserRuntime.mjs')));
const {createLanHttpServer}=await import(pathToFileURL(join(root,'server/lanServer.mjs')));
const {hydrateTown}=await import(pathToFileURL(join(root,'src/townSimulation.js')));
const {createZeroState}=await import(pathToFileURL(join(root,'src/freshStart.js')));
const {createProject}=await import(pathToFileURL(join(root,'src/projectPlans.js')));
const out=resolve(process.env.HD_QA_OUT||'qa/v323/native-recruitment-focus');await mkdir(out,{recursive:true});
const report={scope:'Owned fictional progressed LAN islands with100coins and a wood plan. Native unsaved policy draft stays focused while status recovers and fails again. Only two declared GET503 replies and held successful reads; no request/state/clock/result edits. Original8000ms error/recovery UI budgets,actual reservation/policy state and escaping retained. Providers disabled. Not zero-start,real recruitment,human or physical-device acceptance.',cases:[],passed:false,wholeGoalComplete:false};
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'FOCUSED-STATUS-ONLY'}),base='http://127.0.0.1:'+service.port;
let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,statusReplies:[],mutationRequests:[],errors:[],passed:false};report.cases.push(row);
  const account=await service.identities.register({login:'focused_status_'+theme,password:'fictional-focused-status-password',name:'虚构状态检查岛主',islandName:'焦点状态验证岛',avatar:'female_1',theme}),tenant=await service.tenants.get(account.token),store=tenant.saves,seed=hydrateTown(createZeroState());
  seed.freshStartPending=false;seed.coins=100;seed.saveSlot='focused-status-'+account.view.me.id;assert(createProject(seed,{id:'focused-status-plan',title:'状态恢复验证清单',targets:{wood:20}}).ok);await store.open(theme,{legacyState:seed,protect:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let mode=null;
  function holdOneError(index){let ready,release;const held=new Promise(r=>ready=r),gate=new Promise(r=>release=r);mode={index,fail:true,held:false,ready,gate,release};return{held,release};}
  const inspect=()=>page.evaluate(()=>({focus:document.activeElement?.id,draft:document.querySelector('#recruitPolicyFloor')?.value,sameInput:window.__ownedPolicyInput===document.querySelector('#recruitPolicyFloor'),error:document.querySelector('.recruit-error')?.textContent||'',frameLoop:window.islandInspect?.().frameLoop}));
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/**',async route=>{
   const request=route.request(),path=new URL(request.url()).pathname;
   if(path.startsWith('/api/recruitment/')&&request.method()==='POST')row.mutationRequests.push(path);
   if(path==='/api/recruitment/'+theme+'/status'&&mode){
    const current=mode;
    if(current.fail){current.fail=false;row.statusReplies.push({kind:'declared-error',index:current.index,at:Date.now()});return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'状态验证'+current.index+' <em data-status-inject>暂不可用</em>',code:'recruitment_unavailable'})});}
    if(!current.held){current.held=true;const response=await route.fetch();assert.equal(response.status(),200);current.ready();await current.gate;row.statusReplies.push({kind:'released-success',index:current.index,at:Date.now()});if(mode===current)mode=null;return route.fulfill({response});}
   }
   if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in owned focus fixture"}'});
   return route.continue();
  });
  page.on('pageerror',error=>row.errors.push(error.message));
  try{
   await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});await page.locator('#stewardBtn').click();await page.locator('#stewardRecruit').click();await page.locator('#recruitPolicyForm').waitFor({state:'attached'});
   row.initialPolicy=await service.homeServices.recruitment(account.token,theme,'status');
   const first=holdOneError(1);await page.waitForFunction(()=>document.querySelector('.recruit-error')?.textContent.includes('状态验证1'),null,{timeout:8000});
   await page.locator('details[data-history="autonomy-policy"]>summary').click();await page.locator('#recruitPolicyFloor').fill('37');await page.evaluate(()=>window.__ownedPolicyInput=document.querySelector('#recruitPolicyFloor'));
   await Promise.race([first.held,new Promise((_,reject)=>setTimeout(()=>reject(Error('The next actual status read did not arrive')),8000))]);row.beforeRecovery=await inspect();assert.equal(row.beforeRecovery.focus,'recruitPolicyFloor');first.release();
   await page.waitForFunction(()=>!document.querySelector('.recruit-error'),null,{timeout:8000});row.recovered=await inspect();assert.equal(row.recovered.focus,'recruitPolicyFloor');assert.equal(row.recovered.draft,'37');assert(row.recovered.sameInput,'Recovery must preserve the original focused input');
   const second=holdOneError(2);await page.waitForFunction(()=>document.querySelector('.recruit-error')?.textContent.includes('状态验证2'),null,{timeout:8000});row.secondError=await inspect();assert.equal(row.secondError.focus,'recruitPolicyFloor');assert.equal(row.secondError.draft,'37');assert(row.secondError.sameInput);assert.equal(await page.locator('[data-status-inject]').count(),0);
   await Promise.race([second.held,new Promise((_,reject)=>setTimeout(()=>reject(Error('The second actual status read did not arrive')),8000))]);second.release();await page.waitForFunction(()=>!document.querySelector('.recruit-error'),null,{timeout:8000});row.final=await inspect();assert.equal(row.final.focus,'recruitPolicyFloor');assert.equal(row.final.draft,'37');assert(row.final.sameInput);assert.equal(row.final.frameLoop.running,true);
   const policy=await service.homeServices.recruitment(account.token,theme,'status'),doc=await store.current(theme);assert.equal(policy.autonomy.policy.coinFloor,row.initialPolicy.autonomy.policy.coinFloor);assert.equal(doc.state.coins,100);assert(!doc.state.recruitment.pending);assert.equal(Object.keys(doc.state.resourceLedger?.reservations||{}).filter(k=>k.startsWith('hire:')).length,0);assert.deepEqual(row.mutationRequests,[]);assert.deepEqual(row.errors,[]);row.policyWasNotSubmitted=true;row.passed=true;await page.screenshot({path:join(out,theme+'-focused-status-recovered.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;row.observed=await inspect().catch(()=>null);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{mode?.release();await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(row=>row.passed);
}finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,failure})=>({theme,passed,failure})),wholeGoalComplete:false}));}
