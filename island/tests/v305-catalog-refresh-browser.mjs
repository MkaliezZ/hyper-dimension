import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {pack,image} from './v224-content-fixtures.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v305/native-catalog-refresh');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'CATALOG-SYNC-ONLY'}),base='http://127.0.0.1:'+service.port;
const report={scope:'Owned isolated native co-creation component and real publication HTTP authority, both styles. A declared unrelated save failure is injected only into the component refresh callback; retry reads the actual canonical catalog. The minimal shell excludes the island renderer, NPCs and gameplay clocks. No provider calls, user browser/data or human acceptance; this is not full-game validation.',cases:[],passed:false};let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],activations:[]};report.cases.push(row);let context;
  try{
   const account=await service.identities.register({login:'catalog_'+theme,password:'fictional-catalog-password',name:'虚构发布岛主',islandName:'图纸同步验证岛',avatar:'female_1',theme}),tenant=await service.tenants.get(account.token);await tenant.worldSession.open(theme);
   const state=hydrateTown(createZeroState());state.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+account.view.me.id;state.freshStartPending=false;await tenant.saves.open(theme,{legacyState:state,protect:true});
   const p=pack(),manage=async(operation,fields={})=>tenant.cocreation.action(theme,{operation,requestId:randomUUID(),expectedVersion:(await tenant.cocreation.current(theme)).version,...fields});
   await manage('import',{pack:p});await tenant.cocreation.assets.put(image);const version=(await tenant.cocreation.current(theme)).packages[p.id].versions[0];await manage('submit',{packageId:p.id,version:version.number,hash:version.hash});await manage('review',{packageId:p.id,version:version.number,hash:version.hash,decision:'approve',note:'Declared fixture review before publication sync test'});
   context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:{'X-HD-Island':account.view.me.id}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/qa-v305?*',route=>route.fulfill({status:200,contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><style>.modal{margin:20px;width:1000px}.modal-body{max-height:780px;overflow:auto}button{padding:9px}img{max-width:96px}</style><main id="modalRoot"></main><script type="module">
import {createCoCreationUI} from '/src/cocreationUI.js';
const root=document.getElementById('modalRoot'),fixture=window.catalogFixture={state:${JSON.stringify(state)},calls:0,mode:'reject',details:[],toasts:[]};
const openModal=(title,subtitle,body,footer)=>{root.innerHTML='<article class="modal"><header class="modal-head"><h2>'+title+'</h2><p>'+subtitle+'</p></header><div class="modal-body">'+body+'</div><footer class="modal-footer">'+(footer||'')+'</footer></article>';};
fixture.ui=createCoCreationUI({theme:()=>${JSON.stringify(theme)},state:()=>fixture.state,openModal,closeModal:()=>root.replaceChildren(),back:()=>root.replaceChildren(),detail:id=>fixture.details.push(id),toast:text=>fixture.toasts.push(text),refresh:async()=>{fixture.calls++;await new Promise((resolve,reject)=>fixture.release=()=>fixture.mode==='reject'?reject(Object.assign(Error('Declared unrelated resident receipt needs confirmation'),{code:'action_pending'})):resolve());const response=await fetch('/api/saves/'+${JSON.stringify(theme)}),data=await response.json();if(!response.ok)throw Error(data.error);fixture.state=data.document.state;}});
await fixture.ui.open();fixture.ready=true;
</script>`}));
   const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/cocreation/')&&r.method()==='POST'){const body=r.postDataJSON();if(body.operation==='activate')row.activations.push({requestId:body.requestId,version:body.version});}});
   await page.goto(base+'/qa-v305?theme='+theme);await page.waitForFunction(()=>window.catalogFixture?.ready);await page.locator('[data-co-package="'+p.id+'"]').click();await page.locator('[data-co-activate="1"]').click();await page.waitForFunction(()=>window.catalogFixture.calls===1);
   const canonical=await tenant.cocreation.current(theme);assert.equal(canonical.packages[p.id].active.version,1);
   await page.locator('[data-co-catalog-sync="pending"]').waitFor({timeout:5000});assert.match(await page.locator('.co-badges').innerText(),/当前岛内版本 v1/);assert.equal(await page.locator('[data-co-recipe]').first().isDisabled(),true);assert.equal(await page.evaluate(()=>window.catalogFixture.ui.busy()),true);row.confirmedVersionVisibleBeforeGameSync=true;
   await page.evaluate(()=>window.catalogFixture.release());await page.locator('[data-co-catalog-sync="error"]').waitFor({timeout:5000});assert.match(await page.locator('.co-catalog-sync').innerText(),/版本已保留/);assert.equal(await page.locator('[data-co-recipe]').first().isDisabled(),true);assert.equal(await page.evaluate(()=>window.catalogFixture.ui.busy()),false);row.refreshFailurePreservesAcknowledgedVersion=true;
   await page.screenshot({path:join(out,theme+'-confirmed-sync-error.png')});await page.evaluate(()=>window.catalogFixture.mode='ready');await page.locator('#coCatalogRetry').click();await page.waitForFunction(()=>window.catalogFixture.calls===2);await page.locator('[data-co-catalog-sync="pending"]').waitFor();
   await page.locator('#coShelf').click();await page.evaluate(()=>window.catalogFixture.release());await page.waitForFunction(()=>window.catalogFixture.ui.inspect().catalogSync===null);assert.equal(await page.locator('.co-catalog').count(),1);assert.equal(await page.locator('.co-badges').count(),0);row.lateSyncDoesNotReopenClosedDetails=true;
   await page.locator('[data-co-package="'+p.id+'"]').click();assert.equal(await page.locator('.co-catalog-sync').count(),0);assert.equal(await page.locator('[data-co-recipe]').first().isEnabled(),true);assert.equal(await page.evaluate(()=>window.catalogFixture.state.customCatalog.items.length),2);await page.locator('[data-co-recipe]').first().click();assert.equal(await page.evaluate(()=>window.catalogFixture.details.length),1);
   const after=await tenant.cocreation.current(theme);assert.equal(after.version,canonical.version);assert.equal(after.events.filter(e=>e.type==='activate').length,1);assert.equal(row.activations.length,1);row.synchronizationRetryDoesNotRepublish=true;row.canonicalCatalogReadAfterRetry=true;assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;}
  finally{await context?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}catch(error){report.failure=error.stack;process.exitCode=1;}
finally{await browser?.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure}))}));}
