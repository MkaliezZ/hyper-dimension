import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createNativeWorkJournal} from './nativeWorkJournal.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v343/native-project-backdrop');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'FICTIONAL-PROJECT-BACKDROP',environmentClockProvider:null}),base='http://127.0.0.1:'+service.port;
const report={scope:'Actual application, native form, real IndexedDB worker, normal HTTP/disk save and original rendering resolution. Only the obscured world backdrop is retained; RAF, game clock, input and save continue, resize redraws and closing resumes normal world drawing. Fictional islands; no model calls, user browser or human acceptance.',cases:[],passed:false,wholeGoalComplete:false};
const journal=createNativeWorkJournal(out,report,{deadlineMs:240000});
const browser=await chromium.launch(browserLaunchOptions());
try{for(const theme of ['pixel','origami']){
 const row={theme,errors:[],requests:[],passed:false};report.cases.push(row);let context;
 try{
  const user=await service.identities.register({login:'project_backdrop_'+theme,password:'fictional-password',name:'虚构岛主',islandName:'表单测试岛',avatar:'female_1',theme}),tenant=await service.tenants.get(user.token);await tenant.worldSession.open(theme);
  const seed=hydrateTown(createZeroState());seed.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+user.view.me.id;seed.freshStartPending=false;seed.inventory.wood=20;for(let i=0;i<16;i++)seed.npcNeeds[i]={energy:100,hunger:100,social:100,rations:2};await tenant.saves.open(theme,{legacyState:seed,protect:true});
  context=await browser.newContext({viewport:{width:1440,height:1000}});await journal.install(context);await context.addCookies([{name:'hd_lan_session',value:user.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Isolated models disabled"}'}):r.continue();});
  const page=await context.newPage();journal.observe(page,row);page.on('pageerror',e=>row.errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/action')){const body=r.postDataJSON();row.requests.push({kind:body?.kind,operation:body?.operation,requestId:body?.requestId,foregroundInBody:Object.hasOwn(body||{},'foreground')});}});
  await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!islandInspect().startup.busy,null,{timeout:60000});
  await page.evaluate(()=>{const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),real=ctx.clearRect;window.projectBackdropProbe={clears:0,frames:0,longTasks:[]};if(PerformanceObserver.supportedEntryTypes.includes('longtask'))new PerformanceObserver(list=>{for(const e of list.getEntries()){projectBackdropProbe.longTasks.push({startTime:e.startTime,duration:e.duration});if(projectBackdropProbe.longTasks.length>40)projectBackdropProbe.longTasks.shift();}}).observe({type:'longtask'});ctx.clearRect=function(...args){projectBackdropProbe.clears++;return real.apply(this,args);};const frame=()=>{projectBackdropProbe.frames++;requestAnimationFrame(frame);};requestAnimationFrame(frame);});
  await page.waitForFunction(()=>projectBackdropProbe.clears>=4,null,{timeout:10000});
  await page.locator('#stewardBtn').click();await page.locator('#stewardProjects').click();await page.waitForTimeout(200);
  const before=await page.evaluate(()=>({at:performance.now(),hidden:document.hidden,frameLoop:islandInspect().frameLoop,longTasks:[...projectBackdropProbe.longTasks],clears:projectBackdropProbe.clears,frames:projectBackdropProbe.frames,seconds:__nativeWorkObservation().gameSeconds,width:document.querySelector('#game').width,height:document.querySelector('#game').height}));
  await page.waitForTimeout(1200);const held=await page.evaluate(()=>({at:performance.now(),hidden:document.hidden,frameLoop:islandInspect().frameLoop,longTasks:[...projectBackdropProbe.longTasks],clears:projectBackdropProbe.clears,frames:projectBackdropProbe.frames,seconds:__nativeWorkObservation().gameSeconds,width:document.querySelector('#game').width,height:document.querySelector('#game').height}));
  row.retainedBackdrop={before,held};
  assert.equal(held.clears,before.clears);assert(held.frames>before.frames+3);assert(held.seconds>before.seconds);assert.equal(held.width,before.width);assert.equal(held.height,before.height);
  for(const id of ['lantern','wheat'])await page.locator('[data-remove-target="'+id+'"]').click();await page.locator('#planTitle').fill('为来客留一份木材');await page.locator('#planItem').selectOption('wood');await page.locator('#planAdd').click();
  const at=Date.now();await page.locator('#planCreate').click();await page.locator('[data-project]').waitFor({timeout:30000});row.nativePlanCreateMs=Date.now()-at;
  const project=await page.locator('[data-project]').getAttribute('data-project'),canonical=await tenant.saves.current(theme);assert.equal(canonical.state.workProjects.find(p=>p.id===project).status,'ready');assert.equal(canonical.state.inventory.wood,20);assert.equal(canonical.state.coins,0);
  await page.setViewportSize({width:1380,height:960});await page.waitForFunction(n=>projectBackdropProbe.clears>n,held.clears);const resized=await page.evaluate(()=>projectBackdropProbe.clears);await page.waitForTimeout(250);assert.equal(await page.evaluate(()=>projectBackdropProbe.clears),resized);
  await page.locator('#closeModal').click();await page.waitForFunction(n=>projectBackdropProbe.clears>=n+4,resized,{timeout:10000});
  const commands=row.requests.filter(r=>r.operation==='plan_create');assert.equal(commands.length,1);assert.equal(commands[0].foregroundInBody,false);assert.deepEqual(row.errors,[]);
  row.resizeRedrew=true;row.closingResumedNormalDrawing=true;row.singleCanonicalPlan=true;row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;}
 finally{await context?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
}report.passed=report.cases.every(r=>r.passed);
}finally{await journal.beforeCleanup();await browser.close();await service.close();await journal.finish();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,failure,nativePlanCreateMs})=>({theme,passed,failure,nativePlanCreateMs}))}));}
