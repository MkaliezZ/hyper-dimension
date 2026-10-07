import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {createState} from '../src/world.js';import {hydrateTown} from '../src/townSimulation.js';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),reports=[];
try{
 for(const [port,theme] of [[4173,'pixel'],[4174,'origami']])for(const [width,height] of [[1440,950],[390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated close-button QA"}'}));
  const fixture=hydrateTown(createState());fixture.inventory.ore=20;fixture.inventory.wood=60;
  await page.addInitScript(([theme,s])=>localStorage.setItem('hyper-dimension-'+theme+'-v3',JSON.stringify(s)),[theme,fixture]);
  await page.goto('http://127.0.0.1:'+port+'/?qa=1&rev=ui-v16-harbor-v17');
  const cases=[];
  async function check(name,open){
   await open();await page.locator('#closeModal').waitFor();
   const before=await page.locator('#closeModal').boundingBox();
   const body=await page.locator('.modal-body').boundingBox();
   const range=await page.locator('.modal-body').evaluate(e=>e.scrollHeight-e.clientHeight);
   await page.mouse.move(body.x+body.width-20,body.y+Math.min(40,body.height/2));await page.mouse.wheel(0,30000);await page.waitForTimeout(100);
   const after=await page.locator('#closeModal').boundingBox(),scroll=await page.locator('.modal-body').evaluate(e=>({top:e.scrollTop,client:e.clientHeight,scroll:e.scrollHeight,horizontal:e.scrollWidth>e.clientWidth+2}));
   assert.ok(after.y>=0&&after.y+after.height<=height&&after.x+after.width<=width);
   assert.ok(Math.abs(after.x-before.x)<1&&Math.abs(after.y-before.y)<1,name+' close button moved with content');
   assert.equal(scroll.horizontal,false,name+' content overflowed horizontally');
   if(range>2)assert.ok(scroll.top>0,name+' body did not scroll');
   if(name==='配方'||name==='居民'||name==='制作小游戏')await page.screenshot({path:'qa/v17-fixed-close-'+theme+'-'+width+'-'+(name==='配方'?'recipes':name==='居民'?'resident':'game')+'.png'});
   await page.locator('#closeModal').click();assert.equal(await page.locator('.modal').count(),0);
   cases.push({name,before,after,scroll});
  }
  for(const [id,name] of [['playerBtn','角色'],['stewardBtn','管家'],['gatherBtn','采集'],['recipesBtn','配方'],['businessBtn','经营'],['adminBtn','后台'],['helpBtn','帮助'],['bagBtn','背包'],['buildBtn','建筑'],['partyBtn','派对']])await check(name,()=>page.locator('#'+id).click());
  await page.locator('#residentsBtn').click();await check('居民',()=>page.locator('[data-npc="0"]').first().click());
  await check('制作小游戏',async()=>{
   await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption('0');
   await page.locator('[data-recipe="lantern"]').click();await page.locator('#itemCraft').click();
   await page.locator('.room-game').waitFor({timeout:15000});
  });
  assert.deepEqual(errors,[]);reports.push({theme,width,height,cases,errors});await context.close();
 }
 await writeFile('qa/v17-modal-close-qa.json',JSON.stringify(reports,null,2));console.log('PASS fixed modal close controls in both themes, desktop and mobile');
}finally{await browser.close()}
