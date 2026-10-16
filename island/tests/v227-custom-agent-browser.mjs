import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {hydrateTown} from '../src/townSimulation.js';
import {createZeroState} from '../src/freshStart.js';
import {customItemId,customRecipeId} from '../src/customContent.js';
import {pack,image} from './v224-content-fixtures.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v227/native-custom-agent');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'CUSTOM-AGENT-ONLY',environmentClockProvider:null});
const base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Isolated fictional progressed islands; 50 declared wood/resin/fiber. Real project UI, NPC navigation, normal 20-second canonical work leases, prerequisite delivery, result claim and reload in both styles. Providers disabled; this is not a real Hermes run or human acceptance. Uploaded PNGs are QA patterns, not production artwork.',cases:[],passed:false};
try{
 await Promise.all(['pixel','origami'].map(async theme=>{
  const row={theme,errors:[]};report.cases.push(row);let context,page;
  try{
   const account=await service.identities.register({login:'custom_agent_'+theme,password:'fictional-custom-agent-password',name:'虚构共创岛主',islandName:'共创协作岛',avatar:'female_1',theme}),c=await service.tenants.get(account.token);await c.worldSession.open(theme);
   const seed=hydrateTown(createZeroState());seed.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+account.view.me.id;seed.freshStartPending=false;Object.assign(seed.inventory,{wood:50,resin:50,fiber:50});for(let id=0;id<16;id++)seed.npcNeeds[id]={energy:100,hunger:100,social:100,rations:2};await c.saves.open(theme,{legacyState:seed,protect:true});
   const p=pack(),manage=async(operation,fields={})=>c.cocreation.action(theme,{operation,requestId:randomUUID(),expectedVersion:(await c.cocreation.current(theme)).version,...fields});
   await manage('import',{packageId:p.id,pack:p});await c.cocreation.assets.put(image);const v=(await c.cocreation.current(theme)).packages[p.id].versions[0];await manage('submit',{packageId:p.id,version:v.number,hash:v.hash});await manage('review',{packageId:p.id,version:v.number,hash:v.hash,decision:'approve',note:'核对共创任务的真实前置工序及双风格图片'});await manage('activate',{packageId:p.id,version:v.number,hash:v.hash,worldKey:seed.saveSlot});
   const item=customItemId(p.id,'letter'),seal=customItemId(p.id,'seal');
   context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
   await context.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated custom-agent test"}'}):route.continue();});
   page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});
   await page.locator('#stewardBtn').click();await page.locator('#stewardProjects').click();assert.equal(await page.locator('#planItem option[value="'+item+'"]').count(),1,'A preparable custom gift must be selectable before its first prerequisite craft');
   for(const id of ['lantern','wheat'])await page.locator('[data-remove-target="'+id+'"]').click();await page.locator('#planTitle').fill('为旅人准备一封信');await page.locator('#planItem').selectOption(item);await page.locator('#planAdd').click();
   const draft=page.locator('#planDraft svg[aria-label="旅人问候信"]');assert.equal(await draft.count(),1);assert.match(await draft.locator('image').getAttribute('href'),/^\/api\/cocreation\//);await page.locator('#planCreate').click();
   await page.locator('[data-project]').waitFor();await page.locator('[data-plan-step] svg[aria-label="海风封蜡章"]').waitFor();await page.screenshot({path:join(out,theme+'-prerequisites.png')});
   const project=await page.locator('[data-project]').getAttribute('data-project');await page.locator('#closeModal').click();
   await page.waitForFunction(({project,item})=>window.islandInspect().workProjects.find(p=>p.id===project)?.status==='ready'&&window.islandInspect().inventory[item]>=1,{project,item},{timeout:180000});
   const d=await c.saves.current(theme),tasks=d.state.agentTaskLedger.filter(t=>t.projectId===project);assert(tasks.some(t=>t.targetItem===seal&&t.completed>=1));assert(tasks.some(t=>t.targetItem===item&&t.completed===1));assert.equal(d.state.craftHistory[customRecipeId(p.id,'seal')]>=1,true);assert.equal(d.state.craftHistory[customRecipeId(p.id,'letter')]>=1,true);
   for(const task of tasks)assert.equal(new Set(task.evidence.map(e=>e.id)).size,task.evidence.length);row.actualTaskDeliveries=tasks.map(t=>({item:t.targetItem,completed:t.completed,status:t.status}));
   await page.locator('#stewardBtn').click();await page.locator('#stewardProjects').click();await page.locator('[data-plan-action="finish"]').click();await page.waitForFunction(id=>window.islandInspect().workProjects.find(p=>p.id===id)?.status==='completed',project);
   await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.modal-body').evaluate(e=>e.scrollWidth>e.clientWidth+1),false);await page.screenshot({path:join(out,theme+'-completed-390.png')});await page.setViewportSize({width:1440,height:1000});
   await page.reload();await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});await page.locator('#stewardBtn').click();await page.locator('#stewardProjects').click();assert.match(await page.locator('[data-project="'+project+'"]').innerText(),/已入库/);assert.equal(await page.locator('[data-project="'+project+'"] svg[aria-label="旅人问候信"]').count()>0,true);assert.deepEqual(row.errors,[]);row.passed=true;
   await page.screenshot({path:join(out,theme+'-reopened.png')});
  }catch(error){row.failure=error.stack;process.exitCode=1;row.diagnostic=await page?.evaluate(()=>({startup:window.islandInspect?.().startup,projects:window.islandInspect?.().workProjects,agents:window.islandInspect?.().npcs,status:document.querySelector('#saveStatus')?.textContent})).catch(()=>null);await page?.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context?.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }));
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure}))}));}
