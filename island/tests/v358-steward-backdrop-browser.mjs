import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.HD_QA_OUT||'qa/v358/native-steward-backdrop');await mkdir(out,{recursive:true});
const directory=await mkdtemp(path.join(out,'fictional-')),service=await createLanHttpServer({directory,port:0,enrollmentKey:'OWNED-BACKDROP-CONTROL'}),base='http://127.0.0.1:'+service.port;
const clockFile=path.join(directory,'environment/environment-clock.json'),clockBefore=await readFile(clockFile,'utf8');
const report={scope:'Owned full application, two styles, native input, real save/checkpoint and an actual one-task proposal. A second deterministic model response is held while the blurred map backdrop is retained. Measure real game time and NPC movement, then resize and close the conversation while the same response is still held. No clock changes, injected stock or providers. Declared full-needs fixture; not model/human or complete task-chain acceptance.',cases:[],errors:[],passed:false};
const gate=()=>{let release;const waiting=new Promise(r=>release=r);return{release,waiting};};
let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,passed:false},held=gate();report.cases.push(row);let context;
  try{
   const account=await service.identities.register({login:'backdrop_'+theme,password:'fictional-backdrop-password',name:'虚构背景核对',islandName:'背景核对岛',avatar:'female_1',theme}),tenant=await service.tenants.get(account.token);await service.tenants.open(account.token,theme,{});
   const original=await tenant.saves.current(theme),state=structuredClone(original.state);for(let n=0;n<16;n++)state.npcNeeds[n]={energy:100,hunger:100,social:100,rations:2};await tenant.saves.save(theme,{state,expectedVersion:original.version});
   context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   if(process.env.HD_QA_LOST_RAF==='1')await context.addInitScript(()=>{const request=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>request(timestamp=>{if(!window.__holdOwnedRaf)callback(timestamp);});});
   await context.route('**/src/app.js',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+"\nwindow.__stewardBackdropControl=()=>({gameSeconds:now,draws:rasterQualityStatus().draws,scene,modalOpen:!!modal,busy:stewardChat?.busy(),npcs:npcs.map(n=>({x:n.x,y:n.y,actionT:n.action?.t||0,path:n.path.length}))});"});});
   let manualRequests=0;
   await context.route('**/api/**',async route=>{
    const name=new URL(route.request().url()).pathname;
    if(name==='/api/hermes/command'){
     manualRequests++;if(manualRequests===2)await held.waiting;
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({source:'hermes',model:'deepseek-flash',answer:manualRequests===1?'已经登记木材分工。':'背景核对委托已经回复。',runId:'backdrop-'+theme+'-'+manualRequests,commands:manualRequests===1?[{id:'backdrop-work-'+theme,npcId:5,goal:'forest',resource:'wood',quantity:2,intent:'到林地收两份木材'}]:[],plans:[],parties:[],operations:[]})});
    }
    if(/^\/api\/(npc|hermes)\//.test(name)||name==='/api/lan/social/tick')return route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers blocked in owned backdrop control"}'});
    return route.continue();
   });
   const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce.ready&&!islandInspect().startup.busy&&!document.querySelector('#islandBootNotice'),null,{timeout:60000});
   if(await page.locator('#startFirstDay').isVisible())await page.locator('#startFirstDay').click();
   await page.locator('#stewardBtn').click();await page.locator('#hermesInput').fill('请登记木材分工。');await page.locator('#hermesSend').click();
   await page.waitForFunction(()=>islandInspect().agentTaskLedger.some(t=>t.id.startsWith('backdrop-work-'))&&!window.__stewardBackdropControl().busy,null,{timeout:30000});
   await page.locator('#closeModal').click();await page.waitForTimeout(1000);await page.locator('#stewardBtn').click();await page.locator('#hermesInput').fill('请核对背景仍在更新。');
   const requestSeen=page.waitForRequest(r=>new URL(r.url()).pathname==='/api/hermes/command',{timeout:30000});await page.locator('#hermesSend').click();await requestSeen;await page.waitForTimeout(500);
   if(process.env.HD_QA_LOST_RAF==='1')await page.evaluate(()=>{window.__holdOwnedRaf=true;});
   const before=await page.evaluate(()=>window.__stewardBackdropControl());assert(before.busy&&before.modalOpen);
   await page.waitForTimeout(3000);const after=await page.evaluate(()=>window.__stewardBackdropControl());row.held={before,after};
   assert.equal(after.draws,before.draws,'Retain the already painted background during the pending reply');assert(after.gameSeconds-before.gameSeconds>=2,'Normal simulation clock continues');
   if(process.env.HD_QA_LOST_RAF==='1'){row.visibleFallback=await page.evaluate(()=>window.islandInspect().frameLoop);assert(row.visibleFallback.fallbackFrames>0,'Actual visible fallback must run after native RAF delivery is withheld');}
   assert(after.npcs.some((n,i)=>Math.hypot(n.x-before.npcs[i].x,n.y-before.npcs[i].y)>.1||n.actionT!==before.npcs[i].actionT),'NPC movement/actions continue while the backdrop is retained');
   await page.setViewportSize({width:1376,height:936});await page.waitForTimeout(400);const resized=await page.evaluate(()=>window.__stewardBackdropControl());assert(resized.draws>after.draws,'Actual resize repaints');row.resized=resized;
   await page.locator('#closeModal').click();await page.waitForTimeout(500);const closed=await page.evaluate(()=>window.__stewardBackdropControl());assert(closed.busy&&!closed.modalOpen&&closed.draws>resized.draws,'Closing the modal resumes map painting before the held response');row.closed=closed;
   held.release();await page.waitForFunction(()=>!window.__stewardBackdropControl().busy,null,{timeout:30000,...process.env.HD_QA_LOST_RAF==='1'?{polling:100}:{}});await page.locator('#stewardBtn').click();assert.equal(await page.locator('#hermesSend').isEnabled(),true);assert((await page.locator('#stewardMessages').innerText()).includes('背景核对委托已经回复'));assert.equal(manualRequests,2);
   row.actualTaskRegistered=(await tenant.saves.current(theme)).state.agentTaskLedger.some(t=>t.id==='backdrop-work-'+theme);assert(row.actualTaskRegistered);row.passed=true;
  }catch(e){row.failure=e.stack;throw e;}finally{held.release();await context?.close();await writeFile(path.join(out,'progress.json'),JSON.stringify(report,null,2)+'\n');}
 }
 assert.equal(await readFile(clockFile,'utf8'),clockBefore,'Clock configuration unchanged');assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser?.close();await service.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,passed:r.passed,failure:r.failure})),failure:report.failure}));}
