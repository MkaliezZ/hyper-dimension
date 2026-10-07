import {solvePacking} from './v18-play-helpers.mjs';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';
import {ECONOMY_RULES} from '../src/economy.js';
import {createState} from '../src/world.js';import {hydrateTown} from '../src/townSimulation.js';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),reports=[];
try{
 for(const [port,theme] of [[4173,'pixel'],[4174,'origami']]){
  async function setup(s){
   const context=await browser.newContext({viewport:{width:1440,height:950}}),page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated UI test; no external inference"}'}));
   await page.addInitScript(([theme,s])=>{const key='hyper-dimension-'+theme+'-v3';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s));},[theme,s]);
   await page.goto('http://127.0.0.1:'+port+'/?qa=1&rev=economy-v12');await page.waitForFunction(()=>window.islandInspect);
   return {context,page,errors};
  }
  const fixture=hydrateTown(createState());Object.assign(fixture.inventory,{wood:40,ore:10,tea:3,c0_7:1});fixture.facilities[0].quality=50;fixture.roomGames[0]={plays:3};
  const {context,page,errors}=await setup(fixture);
  const stored=()=>page.evaluate(theme=>JSON.parse(localStorage.getItem('hyper-dimension-'+theme+'-v3')),theme);
  async function recipe(item,building){if(await page.locator('#closeModal').count())await page.locator('#closeModal').click();await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption(String(building));await page.locator('[data-recipe="'+item+'"]').click();}
  try{
   await recipe('lantern',0);await page.locator('#itemCraft').click();await page.locator('.room-game').waitFor({timeout:15000});
   await solvePacking(page,()=>page.evaluate(()=>window.islandInspect().roomGame));
   await page.getByRole('button',{name:'领取制作成果',exact:true}).click();
   await page.getByRole('heading',{name:/制作完成/}).waitFor({timeout:10000});
   assert.ok((await page.locator('.item-purpose').innerText()).includes('派对筹备'));
   assert.equal((await stored()).economy.playerGoods.lantern,1);
   assert.equal(await page.locator('#itemOrder').isDisabled(),false);
   await page.screenshot({path:'qa/v12-craft-purpose-'+theme+'.png'});
   await page.locator('#itemOrder').click();let after=await stored();
   assert.equal(after.economy.cashLedger.filter(r=>r.category==='order').length,1);
   assert.equal(after.economy.cashLedger.find(r=>r.category==='order').net,10);assert.equal(after.economy.playerGoods.lantern,0);
   assert.equal(await page.locator('#itemOrder').isDisabled(),true);
   const elapsed=after.economy.daySeconds;await page.reload();after=await stored();assert.ok(after.economy.daySeconds>=elapsed-3);
   await recipe('tea',1);await page.locator('#itemUse').click();assert.equal((await stored()).playerVitals.craftMeals,3);
   await page.locator('#giftRecipient').selectOption('0');await page.locator('#itemGift').click();after=await stored();assert.ok(after.npcMemory[0].some(m=>m.text.includes('岛主送给我')));
   await recipe('c0_7',0);assert.ok(await page.locator('[data-next-recipe="c0_8"]').count());await page.locator('[data-next-recipe="c0_8"]').click();assert.ok((await page.locator('.item-purpose').innerText()).length>30);
   await page.locator('#closeModal').click();await page.locator('#businessBtn').click();assert.equal(await page.locator('[data-town-order]').count(),3);
   assert.ok((await page.locator('.modal-body').innerText()).includes('今日岛务预算 · 18'));
   await page.setViewportSize({width:640,height:780});await page.screenshot({path:'qa/v12-business-mobile-'+theme+'.png'});
   const overflow=await page.locator('.modal').evaluate(el=>el.scrollWidth>el.clientWidth+1);assert.equal(overflow,false);
   assert.deepEqual(errors,[]);reports.push({theme,flow:'craft-result/order/reload/food/gift/dependency/mobile',pageErrors:errors});console.log('PASS',theme,'actual craft purpose and economic actions');
  }finally{await context.close()}
  const dayFixture=hydrateTown(createState());dayFixture.economy.daySeconds=ECONOMY_RULES.daySeconds-.5;
  const day=await setup(dayFixture);
  try{
   await day.page.waitForFunction(()=>window.islandInspect().economy.townDays.length===1);
   let inspect=await day.page.evaluate(()=>window.islandInspect());assert.equal(inspect.coins,102);
   await day.page.reload();inspect=await day.page.evaluate(()=>window.islandInspect());assert.equal(inspect.economy.townDays.length,1);assert.equal(inspect.coins,102);assert.deepEqual(day.errors,[]);
   reports.push({theme,flow:'actual day rollover and reload',paid:18,pageErrors:day.errors});
  }finally{await day.context.close()}
  const partyFixture=hydrateTown(createState());Object.assign(partyFixture.inventory,{outfit:1,firework:1,lantern:1,wheat:2});partyFixture.partyInvites={0:true,2:true};
  const party=await setup(partyFixture);
  try{
   await party.page.locator('#recipesBtn').click();await party.page.locator('#recipeBuilding').selectOption('4');await party.page.locator('[data-recipe="outfit"]').click();await party.page.locator('#itemUse').click();
   await party.page.locator('#itemParty').click();await party.page.locator('#partyFireworks').check();await party.page.locator('#hostParty').click();
   const reserved=await party.page.evaluate(()=>window.islandInspect());assert.equal(reserved.inventory.firework,0);assert.equal(reserved.partySession.outfit,'outfit');assert.equal(reserved.partySession.fireworks,true);
   for(let i=0;i<4;i++)await party.page.locator('#launchLantern').click();
   await party.page.waitForFunction(()=>window.islandInspect().partySession===null,{},{timeout:10000});
   const inspect=await party.page.evaluate(()=>window.islandInspect()),rows=inspect.economy.cashLedger.filter(r=>r.category==='party');
   assert.equal(rows.filter(r=>r.income>0).length,1);assert.ok(rows.find(r=>r.income>0).income>=25);
   assert.deepEqual(party.errors,[]);reports.push({theme,flow:'wear/firework/party escrow and one reward',reward:rows.find(r=>r.income>0).income,pageErrors:party.errors});console.log('PASS',theme,'actual outfit and firework party uses');
  }finally{await party.context.close()}
 }
 await writeFile('qa/v12-commerce-ui.json',JSON.stringify(reports,null,2));
}finally{await browser.close()}
