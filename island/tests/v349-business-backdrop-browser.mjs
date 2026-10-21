import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const root=resolve(import.meta.dirname,'..');
const output=resolve(process.env.HD_QA_OUT||'qa/v349/native-business-ledger');await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});
for(const name of Object.keys(process.env))if(name.startsWith('HD_')||/KEY|TOKEN|SECRET/.test(name))delete process.env[name];
const load=path=>import(pathToFileURL(join(root,path)));
const {chromium}=createRequire(join(root,'package.json'))('playwright-core');
const {browserLaunchOptions}=await load('tests/browserRuntime.mjs');
const {createLanHttpServer}=await load('server/lanServer.mjs');
const {createZeroState}=await load('src/freshStart.js');
const {hydrateTown}=await load('src/townSimulation.js');
const source=await readFile(join(root,'src/app.js'));
const report={startedAt:new Date().toISOString(),sourceSHA256:createHash('sha256').update(source).digest('hex'),
  scope:'Isolated real browser modal input, actual world draw calls and natural game-clock observation. No stock, sale, work, model or save assertions are bypassed. This is a targeted backdrop regression, not a replacement for the original custom-shop sale fixture.',cases:[],passed:false};
const service=await createLanHttpServer({directory:join(output,'fictional-data'),port:0,enrollmentKey:'BUSINESS-BACKDROP-QA',environmentClockProvider:null});
const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,passed:false,errors:[]};report.cases.push(row);let context;
  try{
   const account=await service.identities.register({login:'backdrop_'+theme,password:'fictional-backdrop-password',name:'虚构经营岛主',islandName:'经营手账测试岛',avatar:'male_0',theme});
   const c=await service.tenants.get(account.token);await c.worldSession.open(theme);
   const seed=hydrateTown(createZeroState());seed.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+account.view.me.id;seed.freshStartPending=false;
   await c.saves.open(theme,{legacyState:seed,protect:true});
   context=await browser.newContext({viewport:{width:1440,height:1000}});
   await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/src/app.js',async route=>{
    const response=await route.fetch();assert.equal(createHash('sha256').update(await response.body()).digest('hex'),report.sourceSHA256);
    const observation='\nlet qaWorldPaints=0;const qaOriginalDrawWorld=drawWorld;drawWorld=(...args)=>{qaWorldPaints++;return qaOriginalDrawWorld(...args)};window.__businessBackdropProbe=()=>({worldPaints:qaWorldPaints,gameSeconds:now,modal:!!modal,invalidated:!!render.invalidated,scene,body:document.querySelector(".modal-body")?.textContent});';
    await route.fulfill({response,body:source.toString()+observation});
   });
   await context.route('**/api/**',async route=>{const pathname=new URL(route.request().url()).pathname;if(/^\/api\/(npc|hermes)\//.test(pathname)||pathname==='/api/lan/social/tick')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated backdrop regression"}'});return route.continue();});
   const page=await context.newPage();page.on('pageerror',error=>row.errors.push(error.message));
   await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&window.__businessBackdropProbe,null,{timeout:60000});
   const started=Date.now();await page.locator('#businessBtn').click({timeout:30000});row.clickMs=Date.now()-started;
   await page.locator('#operatingTrend').waitFor({timeout:30000});await page.waitForTimeout(300);
   row.before=await page.evaluate(()=>window.__businessBackdropProbe());
   await page.waitForTimeout(1500);row.after=await page.evaluate(()=>window.__businessBackdropProbe());
   assert.equal(row.after.worldPaints,row.before.worldPaints,'An opaque business document must retain its already painted blurred island backdrop');
   assert(row.after.gameSeconds-row.before.gameSeconds>.5,'Business document must retain normal simulation and work/save time');
   await page.setViewportSize({width:1280,height:900});
   await page.waitForFunction(before=>window.__businessBackdropProbe().worldPaints>before,row.after.worldPaints,{timeout:30000});
   await page.waitForTimeout(300);row.resizeBefore=await page.evaluate(()=>window.__businessBackdropProbe());
   await page.waitForTimeout(750);row.resizeAfter=await page.evaluate(()=>window.__businessBackdropProbe());
   assert.equal(row.resizeAfter.worldPaints,row.resizeBefore.worldPaints,'Resize must repaint once and then retain the resized business backdrop');
   assert(row.resizeAfter.gameSeconds>row.resizeBefore.gameSeconds,'Resized business document must keep simulation time advancing');
   await page.locator('#manageShelves').click({timeout:30000});assert.equal(await page.locator('[data-shelf]').count(),25);
   await page.locator('#closeModal').click({timeout:30000});
   await page.waitForFunction(before=>window.__businessBackdropProbe().worldPaints>before,row.after.worldPaints,{timeout:30000});
   row.reopenedWorld=await page.evaluate(()=>window.__businessBackdropProbe());
   assert(!row.reopenedWorld.modal);assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;}
  finally{await context?.close();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(row=>row.passed);
}finally{
 await browser.close();await service.close();report.finishedAt=new Date().toISOString();await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,clickMs,before,after,failure})=>({theme,passed,clickMs,beforePaints:before?.worldPaints,afterPaints:after?.worldPaints,gameSeconds:after?.gameSeconds-before?.gameSeconds,failure}))}));
}
