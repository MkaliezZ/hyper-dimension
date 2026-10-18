import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(process.env.HD_QA_ROOT||'.'),out=resolve(process.env.HD_QA_OUT||'qa/v292/activity-refresh');await mkdir(out,{recursive:true});
process.env.DEEPSEEK_API_KEY='';
const load=n=>import(pathToFileURL(join(root,n))),{chromium}=createRequire(join(root,'package.json'))('playwright-core'),{browserLaunchOptions}=await load('tests/browserRuntime.mjs'),{createLanHttpServer}=await load('server/lanServer.mjs');
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'owned-')),port:0,enrollmentKey:'OWNED-REFRESH-FIXTURE'}),base='http://127.0.0.1:'+service.port;
const report={startedAt:new Date().toISOString(),sourceSha256:createHash('sha256').update(await readFile(join(root,'src/lanActivitiesUI.js'))).digest('hex'),scope:'Actual production activity UI in owned native browser DOM. Explicit HTTP fixtures represent an already-running refresh and one definitive revision conflict; only the pre-existing refresh reply is delayed180ms. Assert the UI awaits that reply before its unchanged single retry. No real event/economy authority, models, user data or full-flow acceptance claimed.',cases:[],passed:false};let browser;
function fixture(theme,revision=1,phase='live'){
 return{at:Date.now(),me:'owner',kinds:[{id:'tea',name:'虚构茶会',brief:'组件检查',recipeId:'recipe_tea'}],hosts:[],economyRules:{venue:8,entry:12,baseReward:2,qualityBonus:1,bonusQuality:90,maxReward:3},events:[{id:'fixture-event',owner:'owner',ownerName:'虚构组件岛主',islandName:'虚构组件岛',roomId:'room',theme,title:'刷新回执组件检查',brief:'明确标记的活动协议夹具，不是真实经营结算。',kind:'tea',recipeId:'recipe_tea',startsAt:Date.now()-60000,expiresAt:Date.now()+60000,phase,revision,requirements:{items:[],garment:null},economy:{mode:'social'},participants:[],results:[],reviews:[],minQuality:55,invited:true,trial:null,myReview:null}]};
}
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,gets:0,finishRevisions:[],errors:[],passed:false};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();let release;const gate=new Promise(r=>release=r);let complete=false;
  await context.route('**/owned-refresh',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div id="lanActivities"></div><div id="lanEventModal"></div></body></html>'}));
  await context.route('**/api/lan/activities**',async route=>{
   if(route.request().method()==='GET'){
    const order=++row.gets;if(order===2)await gate;
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({view:fixture(theme,order===1?1:2,complete?'completed':'live')})});
   }
   const input=route.request().postDataJSON();assert.equal(input.operation,'finish');row.finishRevisions.push(input.expectedRevision);
   if(input.expectedRevision!==2){if(row.finishRevisions.length===1)setTimeout(release,180);return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'明确夹具：活动版本已更新',code:'lan_event_revision'})});}
   complete=true;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({view:fixture(theme,3,'completed'),replayed:false})});
  });
  page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base+'/owned-refresh');
   await page.evaluate(async theme=>{document.body.dataset.theme=theme;const{createLanActivitiesUI}=await import('/src/lanActivitiesUI.js');window.ownedActivityUI=createLanActivitiesUI({toast:message=>(window.ownedToasts??=[]).push(message)});ownedActivityUI.setContext({me:{id:'owner',profile:{theme}},room:{id:'room',owner:'owner',revision:1,maxPlayers:4},users:[]});},theme);
   await page.locator('[data-event-finish="fixture-event"]').waitFor();await page.locator('#lanEventRefresh').click();
   while(row.gets<2)await page.waitForTimeout(10);
   await page.locator('[data-event-finish="fixture-event"]').click();
   try{await page.waitForFunction(()=>ownedActivityUI.inspect().doc.events[0].phase==='completed'&&!ownedActivityUI.inspect().flight&&!ownedActivityUI.inspect().pending,null,{polling:50,timeout:4000});}catch(e){row.observationError=e.message;}
   row.last=await page.evaluate(()=>({ui:ownedActivityUI.inspect(),toasts:window.ownedToasts||[]}));
   assert.deepEqual(row.finishRevisions,[1,2],'The one revision retry must await the already-running refresh instead of reusing its stale document');assert(complete);assert.equal(row.last.ui.doc.events[0].phase,'completed');assert.equal(row.last.ui.pending,null);assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(e){row.failure=e.stack;}
  finally{release();await page.evaluate(()=>ownedActivityUI?.clear()).catch(()=>{});await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);if(!report.passed)process.exitCode=1;
}finally{await browser?.close();await service.close();report.finishedAt=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,finishRevisions,failure})=>({theme,passed,finishRevisions,failure}))}));}
