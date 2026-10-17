import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v226/native-save-replacement');
await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'SAVE-REPLACEMENT-ONLY'});
const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Actual isolated LAN /play and save dialog, fictional accounts. Import an actual local signed export or restore an actual history snapshot. Cancel one or both automatic navigations with HTTP204; inject a single outgoing stale checkpoint after the real confirmed operation, never a game result or time. Check sealed old state, ordinary return link, canonical resources and identity, backups, original import identity on lost response, and repeated reentry. No user browser/save or provider calls.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami'])for(const operation of ['restore','import','lost-restore']){
  const row={theme,operation,errors:[],cancelledNavigations:0,imports:[],restoreRequests:0};report.cases.push(row);
  const account=await service.identities.register({login:'replace_'+theme+'_'+operation.replace('lost-restore','lost'),password:'fictional-replacement-password',name:'历史记录岛主',islandName:'档案验证岛',avatar:'female_1',theme});
  await service.tenants.open(account.token,theme);
  const store=(await service.tenants.get(account.token)).saves,before=await store.current(theme),snapshot=await store.backup(theme,{expectedVersion:before.version}),exported=await store.export(theme);
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
  await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/src/app.js',async route=>{
   const response=await route.fetch(),source=await response.text(),needle='const saveUI=createSaveUI(';
   assert.equal(source.split(needle).length,2);
   const probe=`window.__replacementSaveClient=saves;for(const method of ['restore','importSave','retryImport','acceptServer']){const original=saves[method];saves[method]=async(...args)=>{const outgoing=state,result=await original(...args);saves.enqueue(theme,outgoing);window.__replacementProbe={method,blocked:saves.blocked(theme),navigating:saves.status(theme).navigationPending===true,acceptedOutgoing:saves.status(theme).state===outgoing,dirty:saves.status(theme).dirty};return result;};}\n`;
   await route.fulfill({response,body:source.replace(needle,probe+needle)});
  });
  const manual=theme==='origami'&&operation!=='import'||theme==='pixel'&&operation==='import',cancelCount=manual?2:1;
  let documents=0,navigationAttempts=0,armed=operation!=='lost-restore',loseImport=theme==='origami'&&operation==='import',loseRestore=operation==='lost-restore';
  let holdImportRead=false,readHeld,releaseRead;const importReadHeld=new Promise(r=>readHeld=r),importReadRelease=new Promise(r=>releaseRead=r);
  await context.route(/\/play\?/,route=>{documents++;if(documents>1&&armed&&++navigationAttempts<=cancelCount){row.cancelledNavigations++;return route.fulfill({status:204,body:''});}return route.continue();});
  await context.route('**/api/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;
   if(holdImportRead&&req.method()==='GET'&&path==='/api/saves/'+theme){holdImportRead=false;const response=await route.fetch();readHeld();await importReadRelease;return route.fulfill({response});}
   if(/^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in replacement test"}'});
   if(req.method()==='POST'&&path==='/api/saves/'+theme+'/import'){
    row.imports.push(req.postDataJSON());
    if(loseImport){loseImport=false;await route.fetch();row.importResponseLost=true;return route.abort('failed');}
   }
   if(req.method()==='POST'&&path==='/api/saves/'+theme+'/restore'){
    row.restoreRequests++;
    if(loseRestore){loseRestore=false;await route.fetch();row.restoreResponseLost=true;return route.abort('failed');}
   }
   return route.continue();
  });
  page.on('pageerror',error=>row.errors.push(error.message));
  try{
   await page.goto(base+'/play?qa=1');
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#playerBtn').click();await page.locator('#playerForm input[name=name]').fill('等待回岛-'+theme);await page.locator('#savePlayer').click();await page.locator('#closeModal').click();
   await page.locator('#saveStatus').click();await page.locator('#saveNow').click();
   await page.waitForFunction(()=>document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:30000});
   assert.equal((await store.current(theme)).state.playerProfile.name,'等待回岛-'+theme);
   if(operation!=='import'){
    await page.locator('[data-restore-save="'+snapshot.id+'"]').click();await page.locator('#confirmRestore').click();
    if(operation==='lost-restore'){
     await page.waitForFunction(()=>document.querySelector('#saveStatus')?.dataset.status==='action_pending',null,{timeout:30000});
     await page.reload();await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
     assert.equal(await page.locator('#saveStatus').getAttribute('data-status'),'action_pending');assert.equal(row.restoreRequests,1);
     const durable=await page.evaluate(key=>new Promise((resolve,reject)=>{const open=indexedDB.open('hyper-dimension-save-journal',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('entries','readonly'),req=tx.objectStore('entries').get(key);req.onsuccess=()=>resolve(JSON.parse(req.result));req.onerror=()=>reject(req.error);tx.oncomplete=()=>db.close();};}),'hd-lan:'+account.view.me.id+':hyper-dimension-'+theme+'-pending-replacement');
     assert.equal(durable.operation,'restore');assert.equal(durable.body.id,snapshot.id);row.uncertainRestoreIdentityPreservedAcrossReload=true;
     armed=true;await page.locator('#recoveryAll').click();
    }
   }else{
    holdImportRead=true;
    await page.locator('#importSaveFile').setInputFiles({name:'own-signed-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
    let deadline;try{await Promise.race([importReadHeld,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Import canonical read was not reached')),30000);})]);}finally{clearTimeout(deadline);}
    row.importReadPause=await page.evaluate(async theme=>{const c=window.__replacementSaveClient,before=c.status(theme).state,moved=structuredClone(before);moved.player.x++;c.enqueue(theme,moved);let flushCode;try{await c.flush(theme);}catch(e){flushCode=e.code;}return{blocked:c.blocked(theme),outgoingRejected:c.status(theme).state===before,flushCode};},theme);
    assert.deepEqual(row.importReadPause,{blocked:true,outgoingRejected:true,flushCode:'import_pending'});releaseRead();
    await page.locator('#confirmImport').click();
    if(theme==='origami'){
     await page.locator('#retrySaveImport').waitFor({timeout:30000});await page.locator('#retrySaveImport').click();
    }
   }
   await page.waitForFunction(()=>window.__replacementProbe,null,{timeout:30000});
   row.outgoingProbe=await page.evaluate(()=>window.__replacementProbe);
   assert.equal(row.outgoingProbe.blocked,true,'A confirmed replacement must keep its obsolete page sealed until departure');
   assert.equal(row.outgoingProbe.navigating,true);assert.equal(row.outgoingProbe.acceptedOutgoing,false,'An outgoing checkpoint must not restore the pre-replacement state');assert.equal(row.outgoingProbe.dirty,false);
   if(manual){
    for(let i=0;row.cancelledNavigations<2&&i<60;i++)await page.waitForTimeout(100);
    assert.equal(row.cancelledNavigations,2);await page.locator('#recoveryOpenIsland:visible').waitFor({timeout:5000});
    assert.equal(await page.locator('#bagBtn').evaluate(e=>e.closest('[inert]')!==null),true);
    await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#actionRecoveryDock').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
    await page.screenshot({path:join(out,theme+'-'+operation+'-return-390.png')});await page.setViewportSize({width:1440,height:1000});
    await page.locator('#recoveryOpenIsland').click();
   }
   await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&islandInspect().playerProfile.name==='历史记录岛主'&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});
   assert.equal(row.cancelledNavigations,cancelCount);assert(new URL(page.url()).searchParams.has('recoveryReturn'));
   for(let round=0;round<2;round++){
    const current=await store.current(theme);assert.equal(current.state.saveSlot,before.state.saveSlot);assert.equal(current.state.playerProfile.name,'历史记录岛主');assert.equal(current.state.coins,before.state.coins);assert.deepEqual(current.state.inventory,before.state.inventory);
    assert.equal(await page.locator('#actionRecoveryDock:visible').count(),0);
    if(round===0){await page.reload();await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&document.querySelector('#saveStatus')?.dataset.status==='saved',null,{timeout:60000});}
   }
   const backups=await store.backups(theme);assert(backups.some(b=>b.reason==='before-'+(operation==='import'?'import':'restore')));
   if(operation==='lost-restore'){assert.equal(row.restoreRequests,1);assert.equal(backups.filter(b=>b.reason==='before-restore').length,1);row.uncertainRestoreNotResubmitted=true;}
   if(row.importResponseLost){assert.equal(row.imports.length,2);assert.deepEqual(row.imports[0],row.imports[1]);const current=await store.current(theme);assert.equal(current.importReceipts.filter(r=>r.id===row.imports[0].previewId).length,1);row.originalImportReplayedOnce=true;}
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();await page.locator('#bagBtn').click();await page.locator('#closeModal').click();
   assert.deepEqual(row.errors,[]);row.canonicalIdentityAndResourcesPreserved=true;row.preReplacementServerBackupPreserved=true;row.repeatedReentryStable=true;row.passed=true;
   await page.screenshot({path:join(out,theme+'-'+operation+'-returned.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-'+operation+'-failure.png')}).catch(()=>{});}
  finally{releaseRead();await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,operation:c.operation,passed:c.passed,failure:c.failure}))}));}
