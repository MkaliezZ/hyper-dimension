
import {chromium} from 'playwright-core';
import {completeCoutureClients} from './couture-ui-helper.mjs';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const report=[];
await mkdir('qa/v20',{recursive:true});
async function room(port,id,viewport={width:1440,height:950}){
 const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated gameplay validation"}'}));
 const s=hydrateTown(createState());for(const i of CATALOG_ITEMS)s.inventory[i.id]=99;for(let b=0;b<25;b++){s.facilities[b].quality=80;s.roomGames[b]={plays:8,best:90}}
 await page.addInitScript(s=>{const key='hyper-dimension-'+(location.port==='4173'?'pixel':'origami')+'-v3';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},s);
 await page.goto('http://127.0.0.1:'+port+'/?qa=1');
 await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption(String(id));const recipe=await page.locator('[data-recipe]').first().getAttribute('data-recipe');
 await page.locator('[data-recipe]').first().click();await page.locator('#itemCraft').click();
 await page.locator('.workshop-game').waitFor({timeout:30000});await page.locator('[data-action="start"]:not(:disabled)').waitFor();
 return {page,errors,recipe,inspect:()=>page.evaluate(()=>window.islandInspect().roomGame)};
}
async function visibleInside(page,selector,host='.modal-body'){
 return page.locator(selector).evaluate((el,host)=>{const r=el.getBoundingClientRect(),h=document.querySelector(host).getBoundingClientRect();return r.x>=h.x-1&&r.right<=h.right+1&&r.y>=h.y-1&&r.bottom<=h.bottom+1},host);
}
try{
for(const port of [4174,4173]){
 const theme=port===4173?'pixel':'origami';
 {
 const {page,errors,recipe,inspect}=await room(port,4);
 await page.screenshot({path:'qa/v20/'+theme+'-couture-intro.png'});
 assert(await visibleInside(page,'[data-action="start"]'),'start must be visible on entry');
 assert.equal(await page.locator('.wk-header').count(),0,'single building title');
 await page.locator('[data-action="start"]').click();
 const level=(await inspect()).level;
 assert(await page.locator('[data-action="submit"]').isDisabled(),'incomplete outfit cannot be submitted');
 for(const [slot,item] of level.solutions[0].entries()){
  await page.locator('[data-action="wardrobeTab"][data-value="'+slot+'"]').click();
  await page.locator('[data-item="'+item+'"]').click();
 }
 assert.equal((await inspect()).outfit.filter(Boolean).length,3);
 assert.match(await page.locator('.wk-outfit-review').textContent(),/达标/);
 await page.waitForTimeout(300);await page.screenshot({path:'qa/v20/'+theme+'-couture-playing.png'});
 // Selecting every control must not hide the stage on desktop.
 assert(await visibleInside(page,'.wk-stage'),'stage stays visible while picking garments');
 const before=await page.evaluate(recipe=>window.islandInspect().inventory[recipe],recipe);
 await page.locator('[data-action="submit"]').click();await completeCoutureClients(page);
 await page.waitForFunction(()=>window.islandInspect().roomGame?.phase==='result');
 // Deliberately move the underlying view: receipt stays in the browser top layer.
 await page.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);await page.waitForTimeout(400);
 await page.screenshot({path:'qa/v20/'+theme+'-receipt-desktop.png'});
 const resultDesktop=await page.locator('[data-action="claim"]').evaluate(el=>{const r=el.getBoundingClientRect();return {visible:r.y>=0&&r.bottom<=innerHeight&&r.x>=0&&r.right<=innerWidth,height:r.height,width:r.width,font:getComputedStyle(el).fontSize,dialog:el.closest('dialog')?.open}});
 assert(resultDesktop.visible&&resultDesktop.dialog&&resultDesktop.height>=44);
 await page.setViewportSize({width:390,height:780});await page.screenshot({path:'qa/v20/'+theme+'-receipt-mobile.png'});
 assert(await page.locator('[data-action="claim"]').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth+1}));
 await page.evaluate(()=>window.detachedClaim=document.querySelector('[data-action="claim"]'));
 await page.locator('[data-action="claim"]').click();
 await page.evaluate(()=>window.detachedClaim.click());
 await page.waitForTimeout(2350);
 const after=await page.evaluate(()=>window.islandInspect());
 assert.equal(after.inventory[recipe],before+1,'one confirmed craft after actual room action');
 assert.equal(await page.locator('dialog[open]').count(),0);
 report.push({theme,flow:'couture',recipe,oneReceipt:true,resultDesktop,errors});assert.deepEqual(errors,[]);
 await page.close();
 }
 {
 const {page,errors,inspect}=await room(port,2,{width:1280,height:800});
 await page.screenshot({path:'qa/v20/'+theme+'-kitchen-intro.png'});
 assert(await visibleInside(page,'[data-action="start"]'));
 await page.locator('[data-action="start"]').click();await page.waitForTimeout(300);
 const j=(await inspect()).jobs[0];
 for(const index of j.ingredients.length?j.ingredients:(await inspect()).level.orders[0].ingredients)await page.locator('[data-action="ingredient"][data-index="'+index+'"]').click();
 await page.screenshot({path:'qa/v20/'+theme+'-kitchen-prep.png'});
 assert(await visibleInside(page,'.wk-stage'),'whole kitchen stage is visible');
 assert(await visibleInside(page,'[data-action="serve"][data-station="0"]','.wk-guide'),'both stove controls fit beside the kitchen');
 await page.locator('[data-action="cut"]').click();await page.waitForTimeout(100);
 await page.screenshot({path:'qa/v20/'+theme+'-kitchen-cut.png'});
 for(let i=1;i<4;i++){await page.waitForTimeout(400);await page.locator('[data-action="cut"]').click();}
 assert(await page.locator('[data-action="cut"]').isDisabled(),'finished cut cannot be spammed');
 await page.locator('[data-action="cook"]').click();
 assert(await page.locator('[data-action="serve"][data-station="0"]').isDisabled());
 await page.waitForFunction(()=>{const j=window.islandInspect().roomGame.jobs.find(j=>j.state==='cooking');return j&&j.cooked>=j.cook});
 await page.locator('[data-action="serve"][data-station="0"]:not(:disabled)').click();
 assert.equal((await inspect()).served,1);
 await page.locator('[data-action="pause"]').click();assert(await page.locator('dialog').evaluate(el=>el.open));
 await page.keyboard.press('Escape');assert.equal((await inspect()).paused,false);
 await page.locator('[data-action="pause"]').click();await page.locator('[data-action="resume"]').last().click();
 await page.setViewportSize({width:390,height:780});await page.locator('.modal-body').evaluate(el=>el.scrollTop=el.scrollHeight);
 assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
 const close=await page.locator('#closeModal').boundingBox();assert(close.y>=0&&close.y+close.height<780);
 await page.screenshot({path:'qa/v20/'+theme+'-kitchen-mobile.png'});
 await page.locator('#closeModal').click();assert.equal((await page.evaluate(()=>window.islandInspect().roomGame)),undefined);
 report.push({theme,flow:'kitchen',nativeCutCookServe:true,mobileNoOverflow:true,errors});assert.deepEqual(errors,[]);
 await page.close();
 }
}
}finally{await browser.close();await writeFile('qa/v20/workbench-qa.json',JSON.stringify(report,null,2))}
console.log(JSON.stringify(report));
