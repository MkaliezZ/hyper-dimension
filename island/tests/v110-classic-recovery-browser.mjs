import {chromium} from 'playwright-core';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
import {suggestMatchMove} from '../src/classicRules.js';
import {browserLaunchOptions} from './browserRuntime.mjs';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v110/native-classic');await mkdir(out,{recursive:true});
const directory=await mkdtemp(path.join(out,'save-'));
for(const[key,sub]of Object.entries({HD_SAVE_DIR:'saves',HD_ENVIRONMENT_DIR:'environment',HD_HERMES_HOME:'hermes',HD_RUN_LEDGER_DIR:'runs',HD_STEWARD_WORKDIR:'documents',HD_ARTIFACT_DIR:'artifacts'}))process.env[key]=path.join(directory,sub);
const{createLanHttpServer}=await import('../server/lanServer.mjs');
const service=await createLanHttpServer({directory:path.join(directory,'server'),port:0,enrollmentKey:'ISOLATED-CLASSIC-RECOVERY'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Actual room UI link/match games, normal game clock, native cell clicks and server disk settlement. Isolated stock fixtures (99 each); no board, seed, result or clock injection; model endpoints blocked. Definite finish rejection and lost committed response are injected transport faults.',checks:[],errors:[]};let browser,page,releaseCheckpoint;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const account=await service.identities.register({login:'classic_'+theme,password:'fictional-recovery-fixture',name:'测试岛主',islandName:'小游戏恢复岛',avatar:'female_1',theme}),tenant=await service.tenants.get(account.token),store=tenant.saves;
  const state=hydrateTown(createZeroState());state.freshStartPending=false;for(const item of CATALOG_ITEMS)state.inventory[item.id]=99;await store.open(theme,{legacyState:state,protect:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'X-HD-Island':tenant.accountId}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);await context.route('**/api/**',r=>(r.request().url().includes('/api/saves/')||r.request().url().endsWith('/api/status')||r.request().url().includes('/api/world/')||r.request().url().includes('/api/lan/'))?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated minigame QA"}'}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(theme+': '+e.message));await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!document.querySelector('#app').hasAttribute('aria-busy'),null,{timeout:30000});assert.equal(await page.evaluate(()=>window.islandInspect().theme),theme);
  for(const id of [7,3]){
   const get=()=>page.evaluate(()=>window.islandInspect().roomGame);let held=false,finishFault=false;const fault=theme==='pixel'&&id===7?'definite-rejection':'lost-committed-response';
   await page.route('**/api/saves/'+theme+'/action',async route=>{
    const input=route.request().postDataJSON();
    if(input.kind==='craft'&&input.operation==='checkpoint'&&!held&&(await page.evaluate(()=>window.islandInspect().roomGame?.done&&document.querySelector('.activity-finish')?.textContent==='领取制作成果'))){held=true;await new Promise(resolve=>{releaseCheckpoint=resolve});await route.continue();return}
    if(input.kind==='craft'&&input.operation==='finish'&&!finishFault){finishFault=true;if(fault==='definite-rejection'){await route.fulfill({status:409,contentType:'application/json',body:'{"error":"isolated finish rejected before commit","code":"craft_input"}'});}else{await route.fetch();await route.abort('failed')}return}
    await route.continue();
   });
   await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption(String(id));await page.locator('[data-recipe]').first().click();await page.locator('#itemCraft').click();await page.waitForFunction(id=>window.islandInspect().roomGame?.id===id,id,{timeout:30000});
   if((await get()).level.difficulty!==1){await page.locator('[data-difficulty="1"]').click();await page.waitForFunction(()=>window.islandInspect().roomGame?.level.difficulty===1)}
   let ticketBefore,before,inputs=0;const attempts=[];
   for(let attempt=0;attempt<6;attempt++){
    ticketBefore=await page.evaluate(()=>window.islandInspect().serverCraft.ticket);before=(await store.current(theme)).state;
    for(let i=0;i<100;i++){
     const state=await get();if(state.done)break;assert(!state.busy);const move=state.kind==='link'?[state.legalMove?.a,state.legalMove?.b]:suggestMatchMove(state);assert(move&&move.every(Number.isInteger),'a visible board has a legal move');
     await page.locator('.classic-cell[data-cell="'+move[0]+'"]').click();await page.locator('.classic-cell[data-cell="'+move[1]+'"]').click();inputs++;
     await page.waitForFunction(()=>window.islandInspect().roomGame&&!window.islandInspect().roomGame.busy,null,{timeout:12000});
    }
    assert((await get()).done);const won=await page.locator('.activity-finish').innerText()==='领取制作成果';attempts.push({seed:ticketBefore.seed,won});if(won)break;
    await page.locator('.activity-finish:enabled').waitFor({timeout:15000});await page.locator('.activity-finish').click();await page.waitForFunction(seed=>window.islandInspect().roomGame?.level.seed!==seed&&window.islandInspect().roomGame?.done===false,ticketBefore.seed,{timeout:15000});
   }
   assert.equal(await page.locator('.activity-finish').innerText(),'领取制作成果','game must actually succeed');
   for(let i=0;i<100&&!held;i++)await page.waitForTimeout(40);assert(held);await page.waitForTimeout(250);assert(await page.locator('.activity-finish').isDisabled());assert((await get()).alive);
   releaseCheckpoint();releaseCheckpoint=null;await page.locator('.activity-finish:enabled').waitFor({timeout:15000});
   await page.screenshot({path:path.join(out,theme+'-'+id+'-result.png')});
   await page.locator('.activity-finish').click();await page.locator('#serverCraft:not(.hidden)').waitFor({timeout:15000});assert.match(await page.locator('#craftHeading').innerText(),/尚待确认/);assert(finishFault);
   let doc=await store.current(theme),receipts=doc.actions.receipts.filter(r=>r.ticket.sequence===ticketBefore.sequence&&r.outcome==='finished');assert.equal(receipts.length,fault==='lost-committed-response'?1:0);
   await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#serverCraft').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:path.join(out,theme+'-'+id+'-recovery-390.png')});
   if(theme==='origami'&&id===3){await page.reload();await page.waitForFunction(()=>window.islandInspect&&!window.islandInspect().serverCraft.active&&!document.querySelector('#app').inert,null,{timeout:20000});}
   else{await page.locator('#craftRetry').click();await page.waitForFunction(()=>!window.islandInspect().serverCraft.active&&!document.querySelector('#app').inert,null,{timeout:20000});}
   doc=await store.current(theme);receipts=doc.actions.receipts.filter(r=>r.ticket.sequence===ticketBefore.sequence&&r.outcome==='finished');assert.equal(receipts.length,1);assert.equal(doc.actions.active,null);assert.equal(Object.hasOwn(doc.state.resourceLedger.reservations,ticketBefore.owner),false);
   const receipt=receipts[0];assert.deepEqual(receipt.gain,{[ticketBefore.item]:1});assert.equal(doc.state.craftHistory[ticketBefore.recipeId],(before.craftHistory?.[ticketBefore.recipeId]||0)+1);
   assert(await page.locator('#serverCraft').isHidden());await page.setViewportSize({width:1440,height:1000});if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();await page.unroute('**/api/saves/'+theme+'/action');
   report.checks.push({theme,id,inputs,attempts,seed:ticketBefore.seed,quality:receipt.quality,delayedFinalCheckpointKeepsDisabled:true,transportFault:fault,receiptCount:receipts.length,product:receipt.gain,historyIncrement:1,recovery:theme==='origami'&&id===3?'reload':'retry-button',compactNoOverflow:true});console.log(theme+' '+id+' complete, '+fault+' recovered');
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;report.ui=await page?.evaluate(()=>({craft:window.islandInspect?.().serverCraft,game:window.islandInspect?.().roomGame,heading:document.querySelector('#craftHeading')?.textContent,message:document.querySelector('#craftMessage')?.textContent})).catch(()=>null);await page?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});}finally{releaseCheckpoint?.();await browser?.close();await service.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors:report.errors,failure:report.failure}));}
