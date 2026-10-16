import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {RECIPE_BY_ID} from '../src/contentCatalog.js';

const out=resolve(process.env.HD_QA_OUT||'qa/v205/native-recovery-return');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'RECOVERY-RETURN'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Actual isolated LAN /play, fictional accounts, authoritative unfinished craft and NPC job. Native recovery cancels only the displayed craft; a 204 response cancels the first reload, then delayed fallback navigation runs one stale outgoing-page checkpoint. Lost response replay, material reservation, three reloads and normal navigation checked. No user browser, data, injected game time or provider calls.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],traffic:[],reloads:0};report.cases.push(row);
  const account=await service.identities.register({login:'recover_return_'+theme,password:'fictional-password-only',name:'恢复验证岛主',islandName:'回执验证岛',avatar:'female_1',theme}),store=(await service.tenants.get(account.token)).saves,seed=hydrateTown(createZeroState()),recipe=RECIPE_BY_ID.recipe_c14_8;
  seed.freshStartPending=false;seed.coins=100;for(const[id,n]of Object.entries(recipe.cost))seed.inventory[id]=n;
  let doc=(await store.open(theme,{legacyState:seed,protect:true})).document;
  const craft=await store.action(theme,{kind:'craft',operation:'begin',recipeId:recipe.id,mode:'auto',requestId:crypto.randomUUID(),expectedVersion:doc.version,epoch:doc.actions.epoch,expectedSequence:doc.actions.sequence});doc=craft.document;
  const npc=await store.action(theme,{kind:'resident',operation:'begin',actorId:0,intent:{goal:'plaza',action:'rest'},requestId:crypto.randomUUID(),expectedVersion:doc.version,epoch:doc.actions.epoch,expectedSequence:doc.actions.sequence});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  if(process.env.HD_QA_RECOVERY_CLIENT)await context.route('**/src/saveClient.js',async r=>r.fulfill({contentType:'text/javascript',body:await readFile(resolve(process.env.HD_QA_RECOVERY_CLIENT),'utf8')}));
  let documents=0;await context.route(/\/play\?/,async r=>{if(++documents===2){row.cancelledReload=true;return r.fulfill({status:204,body:''});}if(documents>2)await new Promise(resolve=>setTimeout(resolve,750));await r.continue();});
  await context.route('**/src/app.js',async r=>{const response=await r.fetch(),body=await response.text(),needle='configureActionRecovery(options=>saves.acceptServer(theme,options),';assert(body.includes(needle));await r.fulfill({response,body:body.replace(needle,"configureActionRecovery(async options=>{const oldState=state;const result=await saves.acceptServer(theme,options);sessionStorage.setItem('qa-recovery-late-checkpoint','1');saves.enqueue(theme,oldState);return result;},")});});
  await context.route('**/api/**',r=>{const p=new URL(r.request().url()).pathname;return p.startsWith('/api/npc/')||p.startsWith('/api/hermes/')||p.endsWith('/suggest')||p==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated recovery check"}'}):r.continue();});
  let drop=theme==='origami',releaseStartup=null,holdStartup=true,heldResolve;
  const startupHeld=new Promise(resolve=>{heldResolve=resolve;});
  await context.route('**/api/saves/*/action',async r=>{const body=r.request().postDataJSON();row.traffic.push({kind:body.kind,operation:body.operation,requestId:body.requestId});if(holdStartup&&body.kind==='resident'&&body.operation==='cancel'){holdStartup=false;const response=await r.fetch();await new Promise(resolve=>{releaseStartup=resolve;heldResolve();});return r.fulfill({response});}if(drop&&body.kind==='craft'&&body.operation==='cancel'){drop=false;await r.fetch();await r.abort('failed');}else await r.continue();});
  page.on('pageerror',e=>row.errors.push(e.message));page.on('framenavigated',f=>{if(f===page.mainFrame())row.reloads++;});
  const ready=()=>page.waitForFunction(()=>window.islandInspect?.().serverFacility?.ready&&window.islandInspect?.().serverVisitor?.ready&&!window.islandInspect().startup.busy&&!window.islandInspect().serverCraft.active&&document.querySelector('#saveStatus')?.dataset.status!=='recovering',null,{timeout:60000});
  try{
   await page.goto(base+'/play?qa=1');await page.locator('#recoveryReturn:visible').waitFor({timeout:60000});
   // The craft card is mounted before later controllers finish recovering.
   // Hold an actual resident receipt to exercise that interval deterministically.
   let startupTimer;try{await Promise.race([startupHeld,new Promise((_,reject)=>{startupTimer=setTimeout(()=>reject(Error('Startup resident receipt never reached the hold barrier')),30000);})]);}finally{clearTimeout(startupTimer);}
   assert.equal(await page.evaluate(()=>window.islandInspect().startup.busy),true);
   assert.equal(holdStartup,false);assert.equal(typeof releaseStartup,'function');
   row.startupReceiptHeld=true;releaseStartup();releaseStartup=null;
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   assert.equal(await page.locator('#recoveryAll').isVisible(),false,'verified unfinished work must offer continue/cancel, not the same reload loop');
   assert.equal(await page.locator('#serverCraft [data-recovery-read]').isVisible(),false);
   assert(await page.locator('#craftRetry').isVisible());assert.match(await page.locator('.recovery-all p:not([data-recovery-error])').textContent(),/温室肥料/);
   await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#actionRecoveryDock').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:join(out,theme+'-choices-390.png')});await page.setViewportSize({width:1440,height:1000});
   await page.locator('#recoveryReturn').click();
   if(theme==='origami'){await page.waitForFunction(()=>!document.querySelector('#actionRecoveryDock')?.hasAttribute('aria-busy'));assert.equal(row.reloads,1);assert(await page.locator('[data-recovery-error]').isVisible());assert.match(await page.locator('[data-recovery-error]').textContent(),/连接|fetch/i);await page.locator('#recoveryReturn').click();}
   await ready();assert.equal(row.reloads,2,'one successful reconciliation reload');
   assert(row.cancelledReload);assert.equal(documents,3);assert(new URL(page.url()).searchParams.has('recoveryReturn'));row.cancelledReloadRecovered=true;
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('qa-recovery-late-checkpoint')),'1');row.staleOutgoingCheckpointInjected=true;
   let after=await store.current(theme);assert.equal(after.actions.active,null);assert.equal(after.actions.receipts.filter(r=>r.ticket.requestId===craft.ticket.requestId&&r.outcome==='cancelled').length,1);assert.equal(after.actions.receipts.filter(r=>r.ticket.requestId===npc.ticket.requestId&&r.outcome==='cancelled').length,1);
   for(let round=0;round<3;round++){
    await ready();await page.waitForTimeout(5500);assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);assert(!['conflict','blocked','action_pending'].includes(await page.locator('#saveStatus').getAttribute('data-status')));
    await page.locator('#bagBtn').click();await page.locator('#closeModal').click();if(round<2)await page.reload();
   }
   after=await store.current(theme);assert.equal(after.actions.receipts.filter(r=>r.ticket.requestId===craft.ticket.requestId).length,1);assert.equal(after.state.inventory.c14_8||0,0);for(const[id,n]of Object.entries(recipe.cost))assert.equal(after.state.inventory[id],n);assert.deepEqual(row.errors,[]);await page.screenshot({path:join(out,theme+'-recovered.png')});row.lostResponseReplayed=theme==='origami';row.unfinishedWorkCancelledOnce=true;row.repeatedReloadsStable=3;row.passed=true;
  }catch(e){row.failure=e.stack;row.diagnostic=await page.evaluate(()=>({startup:window.islandInspect?.().startup,status:document.querySelector('#saveStatus')?.dataset.status,cards:[...document.querySelectorAll('#actionRecoveryDock>.gather-v46:not(.hidden)')].map(x=>({id:x.id,text:x.textContent}))})).catch(()=>null);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
  finally{releaseStartup?.();await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
