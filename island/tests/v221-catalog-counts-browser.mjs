import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {ITEM_BY_ID,RAW_MATERIALS,ALL_RECIPES} from '../src/contentCatalog.js';
import {RAW_IDS_V1,RECIPE_IDS_V1} from '../src/achievementUniverse.js';
import {achievementMetrics,trackPlayerAchievement,acknowledgeAchievements} from '../src/achievements.js';
const out=resolve(process.env.HD_QA_OUT||'qa/v221/native-catalog-counts');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'COUNTER-FIXTURE-ONLY'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Fictional pre-unlocked catalog fixtures, every known item discovered plus retained unknown true/false legacy fields. Actual profile/bag UI, filter, mobile close and canonical preservation. No user save/browser/provider calls; not a zero-start or human quality test.',cases:[],passed:false};
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[]};report.cases.push(row);const account=await service.identities.register({login:'catalog_count_'+theme,password:'fictional-catalog-password',name:'图鉴验证岛主',islandName:'图鉴验证岛',avatar:'female_1',theme}),store=(await service.tenants.get(account.token)).saves,seed=hydrateTown(createZeroState());
  seed.freshStartPending=false;seed.research={};for(const f of Object.values(seed.facilities))f.quality=80;for(let i=0;i<25;i++)seed.research[i]=10;
  for(const id of Object.keys(ITEM_BY_ID)){seed.inventory[id]=1;seed.discovered[id]=true;}seed.inventory.unknown_future_material=9;seed.discovered.unknown_future_material=true;seed.discovered.unknown_false_legacy=false;
  for(const raw of RAW_MATERIALS)trackPlayerAchievement(seed,'gather',{item:raw.id,amount:1});acknowledgeAchievements(seed);await store.open(theme,{legacyState:seed,protect:true});const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
  await context.route('**/api/**',r=>/^\/api\/(npc|hermes)\//.test(new URL(r.request().url()).pathname)||new URL(r.request().url()).pathname==='/api/lan/social/tick'?r.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated catalog fixture"}'}):r.continue());page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false&&window.islandInspect().serverCommerce?.ready,null,{timeout:60000});
   await page.locator('#playerBtn').click();row.profileStats=(await page.locator('.profile-stats').textContent()).replace(/\s+/g,'');
   assert(row.profileStats.includes('收集素材'+RAW_MATERIALS.length+'/'+RAW_MATERIALS.length),'Profile material count must use the current catalog: '+row.profileStats);assert(row.profileStats.includes('制作图纸'+ALL_RECIPES.length+'/'+ALL_RECIPES.length),'Profile recipe count must use the current catalog: '+row.profileStats);await page.screenshot({path:join(out,theme+'-profile.png')});await page.locator('#closeModal').click();
   await page.locator('#bagBtn').click();row.bagSubtitle=await page.locator('#modalRoot .modal-head p').textContent();assert.match(row.bagSubtitle,new RegExp('^'+RAW_MATERIALS.length+' 种基础素材 · '+ALL_RECIPES.length+' 种独立成品'));
   const count=Object.keys(ITEM_BY_ID).length;row.bagCount=(await page.locator('.catalog-count').textContent()).replace(/\s+/g,'');assert.equal(row.bagCount,'显示'+count+'项·收藏已发现'+count+'/'+count);assert.equal(await page.locator('[data-item="unknown_future_material"]').count(),0);assert.equal(await page.locator('.catalog-card').count(),count);
   await page.locator('#bagFilter').selectOption('material');assert.equal(await page.locator('.catalog-card').count(),RAW_MATERIALS.length);await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(out,theme+'-bag-mobile.png')});const close=await page.locator('#closeModal').boundingBox();assert(close&&close.x>=0&&close.x+close.width<=390&&close.y>=0&&close.y+close.height<=844);await page.locator('#closeModal').click();
   const after=await store.current(theme);assert.equal(after.state.inventory.unknown_future_material,9);assert.equal(after.state.discovered.unknown_future_material,true);assert.equal(after.state.discovered.unknown_false_legacy,false);assert.equal(RAW_IDS_V1.length,50);assert.equal(RECIPE_IDS_V1.length,300);const metrics=achievementMetrics(after.state);row.achievementMetrics=metrics;assert.equal(metrics.collect,50);assert.equal(metrics.unlock,300);assert.deepEqual(row.errors,[]);row.legacyFieldsPreserved=true;row.legacyMilestonesPreserved=true;row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
