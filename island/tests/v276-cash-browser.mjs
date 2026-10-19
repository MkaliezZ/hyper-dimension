import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),out=resolve(process.env.HD_QA_OUT||'qa/v276/native-cash');await mkdir(out,{recursive:true});
const cpuRate=Number(process.env.HD_QA_CDP_CPU||1);assert(Number.isFinite(cpuRate)&&cpuRate>=1&&cpuRate<=4,'CPU diagnostic rate must be between1and4');
const {chromium}=createRequire(join(root,'package.json'))('playwright-core');
const {browserLaunchOptions}=await import(pathToFileURL(join(root,'tests/browserRuntime.mjs')));
const {createLanHttpServer}=await import(pathToFileURL(join(root,'server/lanServer.mjs')));
const {createZeroState}=await import(pathToFileURL(join(root,'src/freshStart.js')));
const {hydrateTown}=await import(pathToFileURL(join(root,'src/townSimulation.js')));
const directory=await mkdtemp(join(out,'fictional-lan-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'ISOLATED-CASH-BOOK'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Native cash reporting in isolated fictional LAN islands. Declared initial200coins and3wood/2stone fund one real upgrade; resting-resident needs prevent unrelated inventory consumption. Actual browser supply/upgrade requests, authoritative debit and material consumption, save, shared-theme switch and empty-browser recovery. Providers blocked; not earned-zero, physical Mac, human or one-hour acceptance.',sourceRoot:root,sourceFrozen:false,cases:[],passed:false,wholeGoalComplete:false};let browser;
const persist=()=>writeFile(join(out,'report.json'),JSON.stringify(report,null,2));
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,phase:'setup',errors:[],passed:false};report.cases.push(row);await persist();
  const account=await service.identities.register({login:'cash_'+theme,password:'fictional-cash-password',name:'收支验证岛主',islandName:'收支验证岛',avatar:'female_1',theme}),tenant=await service.tenants.get(account.token);
  const seed=hydrateTown(createZeroState());seed.freshStartPending=false;seed.coins=200;seed.inventory.wood=3;seed.inventory.stone=2;for(let i=0;i<16;i++)seed.npcNeeds[i]={energy:0,hunger:0,social:70,rations:0,mood:'休息'};
  await tenant.saves.open(theme,{legacyState:seed});await service.tenants.open(account.token,theme,{});
  const open=async()=>{
   const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/api/**',route=>/\/api\/(npc|hermes)\//.test(route.request().url())?route.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated cash verification, providers disabled"}'}):route.continue());
   const page=await context.newPage();if(cpuRate>1){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});}page.on('pageerror',error=>row.errors.push(error.message));await page.goto(base+'/play?qa=1');try{await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!islandInspect().startup.busy&&!document.querySelector('#islandBootNotice'),null,{timeout:60000});}catch(error){row.openFailure=await page.evaluate(()=>{const i=window.islandInspect?.();return{theme:i?.theme,coins:i?.coins,startup:i?.startup,save:i?.save,commerce:i?.serverCommerce,status:document.querySelector('#saveStatus')?.dataset.status,statusText:document.querySelector('#saveStatus')?.textContent,notice:document.querySelector('#islandBootNotice')?.textContent,moduleFailure:window.__hdModuleBootstrapFailure};}).catch(()=>null);await page.screenshot({path:join(out,theme+'-boot-failure.png'),timeout:10000}).catch(()=>{});throw error;}row.cpuThrottlingRate=cpuRate;row.successfulArtworkOpens??=[];row.successfulArtworkOpens.push(await page.evaluate(()=>islandInspect().startup.art));return{page,context};
  };
  let {page,context}=await open();
  try{
   assert.equal(await page.evaluate(()=>islandInspect().coins),200);await page.locator('#businessBtn').click();await page.locator('[data-supply="seeds"]').click();
   await page.waitForFunction(()=>islandInspect().coins===182&&islandInspect().inventory.seed===5,null,{timeout:30000});row.phase='paid-supply';await persist();
   await page.locator('[data-manage="0"]').click();await page.locator('#upgradeFacility').click();await page.waitForFunction(()=>islandInspect().coins===102,null,{timeout:30000});
   assert.deepEqual(await page.evaluate(()=>({wood:islandInspect().inventory.wood,stone:islandInspect().inventory.stone})),{wood:0,stone:0});
   await page.locator('#closeModal').click();await page.locator('#businessBtn').click();await page.locator('[data-cash-coverage="complete"]').scrollIntoViewIfNeeded();
   row.cardText=await page.locator('[data-cash-coverage="complete"]').innerText();assert.match(await page.locator('[data-cash-capital]').innerText(),/-80/);assert.match(await page.locator('[data-cash-routine]').innerText(),/-90/);await page.screenshot({path:join(out,theme+'-cash-report.png')});
   const canonical=(await tenant.saves.current(theme)).state;assert.equal(canonical.coins,102);assert.equal(canonical.economy.cashDays[0].cost,98);assert.equal(canonical.economy.costs,98);row.canonicalCost=98;row.capitalCost=80;row.routineProjected=-90;
   await page.locator('#closeModal').click();const other=theme==='pixel'?'origami':'pixel';await page.locator(other==='pixel'?'#themePixel':'#themeOrigami').click();await page.waitForFunction(other=>islandInspect().theme===other&&!islandInspect().startup.busy,other,{timeout:60000});
   assert.equal(await page.evaluate(()=>islandInspect().coins),102);row.phase='theme-switched';await persist();await page.locator('#saveStatus').click();await page.locator('#saveNow').click();await page.waitForFunction(()=>{const confirmation=document.querySelector('[data-manual-save="complete"]');return !!confirmation?.dataset.manualSaveVersion&&!!confirmation.dataset.manualSaveUpdatedAt;},null,{timeout:30000});row.manualSaveConfirmation=await page.locator('[data-manual-save="complete"]').evaluate(el=>({...el.dataset,text:el.textContent}));assert.match(row.manualSaveConfirmation.text,/本次手动保存已确认/);await page.locator('#closeModal').click();
   await context.close();({page,context}=await open());assert.equal(await page.evaluate(()=>islandInspect().coins),102);assert.equal(await page.evaluate(()=>islandInspect().theme),other);await page.locator('#businessBtn').click();assert.match(await page.locator('[data-cash-capital]').innerText(),/-80/);
   const restored=(await tenant.saves.current(theme)).state;assert.equal(restored.economy.cashDays[0].cost,98);assert.equal(restored.economy.cashLedger.length,2);assert.deepEqual(row.errors,[]);row.emptyBrowserRecovered=true;row.sameWorldThemeSwitch=true;row.passed=true;row.phase='complete';await persist();
  }catch(error){row.failure=error.stack;row.phase='failed';await persist();await page.screenshot({path:join(out,theme+'-failure.png'),timeout:10000}).catch(()=>{});throw error;}finally{await context.close();}
 }
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{await browser?.close();await service.close();await persist();console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure})),wholeGoalComplete:false}));}
