import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createLanHttpServer} from '../server/lanServer.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {customItemId,customRecipeId} from '../src/customContent.js';
import {findLinkMove} from '../src/classicRules.js';
import {png} from './v224-content-fixtures.mjs';

const out=resolve(process.env.HD_QA_OUT||'qa/v234/native-review');await mkdir(out,{recursive:true});
const service=await createLanHttpServer({directory:await mkdtemp(join(out,'fictional-')),port:0,enrollmentKey:'CONTENT-UI-ONLY'}),base='http://127.0.0.1:'+service.port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Fictional progressed islands with declared fixture materials. Native UI exposes both artworks per product during review and correct catalog product totals; then creates two custom products, uploads distinct PNG fixtures, reviews and publishes, plays canonical link games with pointer input, reuses the component, gifts the result, exports and imports on another island. Normal game clocks and server input replay; no injected results. PNG fixtures are test patterns, not production artwork. No user browser/save/provider calls.',cases:[],passed:false};
async function owner(theme,login,row){
 const account=await service.identities.register({login,password:'fictional-custom-password',name:'共创演示岛主',islandName:'共创演示岛',avatar:'female_1',theme});
 const c=await service.tenants.get(account.token);await c.worldSession.open(theme);
 const seed=hydrateTown(createZeroState());seed.saveSlot='hyper-dimension-'+theme+'-v3-restart-'+account.view.me.id;seed.freshStartPending=false;seed.inventory.wood=50;seed.inventory.resin=50;seed.inventory.fiber=50;await c.saves.open(theme,{legacyState:seed,protect:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addCookies([{name:'hd_lan_session',value:account.token,url:base,httpOnly:true,sameSite:'Strict'}]);
 await context.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;return /^\/api\/(npc|hermes)\//.test(path)||path==='/api/lan/social/tick'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Providers disabled in isolated content test"}'}):route.continue();});
 const page=await context.newPage();page.on('pageerror',error=>row.errors.push(error.message));await page.goto(base+'/play?qa=1');await page.waitForFunction(()=>window.islandInspect?.().startup.busy===false,null,{timeout:60000});return {context,page,store:c.saves,co:c.cocreation,theme};
}
async function workshop(page){await page.locator('#adminBtn').click();await page.locator('#adminCoCreation').click();await page.locator('#coNewContent').waitFor();}
async function approve(page,version=1){await page.locator('[data-co-review="'+version+'"]').click();assert.equal(await page.locator('img[data-co-review-art]').count(),4,'Every product must expose both actual PNGs to its reviewer');assert.equal(await page.locator('img[data-co-review-art]').evaluateAll(async images=>{await Promise.all(images.map(i=>i.decode()));return images.every(i=>i.complete&&i.naturalWidth===32&&i.naturalHeight===32);}),true);for(const style of ['pixel','origami'])assert.equal(await page.locator('img[data-co-review-art="'+style+'"]').count(),2);assert.deepEqual(await page.locator('img[data-co-review-art]').evaluateAll(images=>images.map(i=>({style:i.dataset.coReviewArt,rendering:getComputedStyle(i).imageRendering}))),[{style:'pixel',rendering:'pixelated'},{style:'origami',rendering:'auto'},{style:'pixel',rendering:'pixelated'},{style:'origami',rendering:'auto'}]);await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await page.setViewportSize({width:1440,height:1000});await page.locator('#coReviewNote').fill('已核对双画风、材料工序和实际用途，允许本岛发布。');await page.locator('#coApprove').click();await page.locator('[data-co-activate="'+version+'"]').click();await page.waitForFunction(version=>Object.values(window.islandInspect().cocreation.doc.packages).some(p=>p.active?.version===version),version);await page.waitForFunction(()=>[...document.querySelectorAll('.co-badges span')].some(e=>e.textContent.includes('当前岛内版本')));await page.locator('#coShelf').click();assert.match(await page.locator('[data-co-package] .co-content-count').first().textContent(),/2 件正式物品.*双画风 4\/4/);await page.locator('[data-co-package]').first().click();}
async function play(page){
 await page.locator('#itemCraft').click();await page.waitForFunction(()=>window.islandInspect?.().roomGame?.kind==='link',null,{timeout:60000});
 const start=await page.evaluate(()=>window.islandInspect().serverCraft.ticket);assert.equal(start.recipeContract.version,2);assert.equal(start.practice,false);
 if(await page.locator('[data-session="pause"]').textContent()==='开始计时')await page.locator('[data-session="pause"]').click();
 for(let i=0;i<200;i++){
  const g=await page.evaluate(()=>window.islandInspect().roomGame);if(g.done)break;
  if(g.busy){await page.waitForFunction(()=>!window.islandInspect().roomGame?.busy);continue;}
  const move=findLinkMove(g.values,g.columns,g.rows);assert(move);await page.locator('[data-cell="'+move.a+'"]').click();await page.locator('[data-cell="'+move.b+'"]').click();await page.waitForFunction(()=>!window.islandInspect().roomGame?.busy);
 }
 await page.locator('.activity-finish:enabled').waitFor({timeout:30000});await page.locator('.activity-finish').click();await page.waitForFunction(id=>window.islandInspect().inventory[id]>0,start.item,{timeout:30000});await page.locator('#backBag').waitFor({timeout:30000});return start;
}
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[]};report.cases.push(row);let a,b;
  try{
   a=await owner(theme,'author_'+theme,row);const page=a.page;await workshop(page);await page.locator('#coNewContent').click();const id='opc-native-'+theme;await page.locator('#coId').fill(id);await page.locator('#coTitle').fill('给旅人的两道手作');
   await page.locator('[data-product-name]').fill('海风封蜡章');await page.locator('[data-product-category]').selectOption('component');await page.locator('[data-product-cost]').fill('{"wood":2,"resin":1}');
   for(const style of ['pixel','origami']){await page.locator('[data-product-art="'+style+'"]').setInputFiles({name:style+'.png',mimeType:'image/png',buffer:png({tint:style==='pixel'?130:180})});await page.locator('[data-art-status="'+style+'"]').filter({hasText:'已保存'}).waitFor();}
   await page.locator('#coAddProduct').click();const second=page.locator('[data-co-product="1"]');await second.locator('[data-product-name]').fill('旅人问候信');await second.locator('[data-product-cost]').fill('{"@craft-1":1,"fiber":2}');await second.locator('[data-product-requires]').fill('@craft-1');
   for(const style of ['pixel','origami']){await second.locator('[data-product-art="'+style+'"]').setInputFiles({name:style+'.png',mimeType:'image/png',buffer:png({tint:style==='pixel'?130:180})});await second.locator('[data-art-status="'+style+'"]').filter({hasText:'已保存'}).waitFor();}
   await page.locator('.co-product-art img').first().waitFor();assert.equal(await page.locator('.co-product-art img').count(),4);assert.equal(await page.locator('.co-product-art img').evaluateAll(async images=>{await Promise.all(images.map(i=>i.decode()));return images.every(i=>i.complete&&i.naturalWidth===32);}),true);await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await page.screenshot({path:join(out,theme+'-editor-390.png')});await page.setViewportSize({width:1440,height:1000});await page.locator('#coSaveSubmit').click();await approve(page);await page.screenshot({path:join(out,theme+'-published.png')});
   await page.locator('[data-co-recipe]').first().click();assert.match(await page.locator('.modal-head h2').textContent(),/海风封蜡章/);assert.equal(await page.locator('.item-detail image').count()>0,true);assert.equal(await page.locator('.item-detail image').first().evaluate(el=>new Promise((resolve,reject)=>{const image=new Image(),timer=setTimeout(()=>reject(Error('Custom artwork did not decode')),5000);image.onload=()=>{clearTimeout(timer);resolve(image.naturalWidth===32&&image.naturalHeight===32);};image.onerror=()=>{clearTimeout(timer);reject(Error('Custom artwork request failed'));};image.src=el.getAttribute('href');})),true);row.customArtworkDecoded=true;const first=await play(page);assert.equal(first.recipeId,customRecipeId(id,'craft-1'));
   await page.locator('#closeModal').click();await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption('11');await page.locator('[data-recipe="'+customItemId(id,'craft-2')+'"]').click();const next=await play(page);assert.equal(next.recipeId,customRecipeId(id,'craft-2'));assert.deepEqual(next.recipeContract.definition.cost,{[customItemId(id,'craft-1')]:1,fiber:2});
   const state=(await a.store.current(theme)).state;assert.equal(state.inventory[customItemId(id,'craft-1')],0);assert.equal(state.inventory[customItemId(id,'craft-2')],1);
   await page.screenshot({path:join(out,theme+'-crafted.png')});await page.locator('#itemUse').click();await page.waitForFunction(item=>window.islandInspect().inventory[item]===0,customItemId(id,'craft-2'));row.realCraftReuseAndGift=true;
   await page.locator('#closeModal').click();await workshop(page);await page.locator('[data-co-package="'+id+'"]').click();const downloading=page.waitForEvent('download');await page.locator('[data-co-export="1"]').click();const download=await downloading,bundle=JSON.parse(await readFile(await download.path(),'utf8'));assert.equal(bundle.format,'hyper-dimension.bundle/v1');assert.equal(bundle.assets.length,2);
   b=await owner(theme,'reader_'+theme,row);await workshop(b.page);await b.page.locator('#coFile').setInputFiles({name:'friend.hdpack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});await b.page.locator('#coSaveSubmit').click();await approve(b.page);await b.page.locator('[data-co-recipe]').first().click();await play(b.page);row.crossOwnerImportedAssetsAndCraft=true;
   await b.page.setViewportSize({width:390,height:844});assert.equal(await b.page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);await b.page.screenshot({path:join(out,theme+'-imported-390.png')});assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await a?.page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await b?.context.close();await a?.context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{await browser.close();await service.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure}))}));}
