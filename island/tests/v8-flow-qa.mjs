import {solvePacking} from './v18-play-helpers.mjs';
import {chromium} from 'playwright-core';import assert from 'node:assert/strict';
import {createState} from '../src/world.js';import {hydrateTown} from '../src/townSimulation.js';import {CATALOG_ITEMS,ALL_RECIPES} from '../src/contentCatalog.js';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),report=[];
for(const port of [4173,4174]){
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated gameplay validation"}'}));
 const s=hydrateTown(createState());for(const i of CATALOG_ITEMS)s.inventory[i.id]=99;for(let b=0;b<25;b++){s.facilities[b].quality=80;s.roomGames[b]={plays:8,best:90}};
 await page.addInitScript(s=>{const key='hyper-dimension-'+(location.port==='4173'?'pixel':'origami')+'-v3';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(s))},s);
 await page.goto('http://127.0.0.1:'+port+'/?qa=1');await page.waitForTimeout(700);
 // Edit through the actual form, reload, and verify persisted fields.
 await page.locator('#playerBtn').click();await page.locator('[name="name"]').fill('海风岛主');await page.locator('[name="islandName"]').fill('拾光岛');await page.locator('[name="bio"]').fill('花园与音乐的海岛。');await page.locator('#savePlayer').click();await page.locator('#closeModal').click();await page.reload();await page.waitForTimeout(400);
 assert.equal((await page.evaluate(()=>window.islandInspect().playerProfile)).name,'海风岛主');
 await page.locator('#stewardBtn').click();await page.getByRole('button',{name:'选择管家形象',exact:true}).click();await page.locator('[data-gender="女"]').click();await page.locator('[data-avatar="female_3"]').click();await page.locator('#backProfile').click();assert.equal(await page.locator('.avatar-half').count(),1);assert.equal((await page.evaluate(()=>window.islandInspect().butlerAvatar)),'female_3');await page.locator('#closeModal').click();
 // Real selected intermediate recipe, actual arrival, puzzle, tool action, one inventory commit.
 await page.locator('#recipesBtn').click();await page.locator('[data-recipe="hoe"]').click();await page.locator('#itemCraft').click();await page.locator('.room-game').waitFor({timeout:15000});
 assert.equal(await page.locator('.room-game').getAttribute('data-game-id'),'0');const before=await page.evaluate(()=>window.islandInspect().inventory.hoe);
 await solvePacking(page,()=>page.evaluate(()=>window.islandInspect().roomGame));await page.getByRole('button',{name:'领取制作成果',exact:true}).click();await page.waitForTimeout(2250);
 const after=await page.evaluate(()=>window.islandInspect());assert.equal(after.inventory.hoe,before+1);assert.equal(after.craftHistory.recipe_hoe,1);assert.equal(after.miniGameHistory[0].wins,1);assert.equal(after.recipeSelection[0],'recipe_hoe');await page.locator('.item-purpose').waitFor();await page.locator('#closeModal').click();
 // Gathering is awarded after movement and visible animation, not when a card is selected.
 await page.locator('#gatherBtn').click();await page.locator('[data-gather="honey"]').click();const honey=await page.evaluate(()=>window.islandInspect().inventory.honey);
 await page.waitForFunction(v=>window.islandInspect().inventory.honey===v+2,honey,{timeout:18000});
 // Expanded crop selection and readable small viewport without profile overflow.
 await page.locator('#gatherBtn').click();await page.locator('[data-source="farm"]').click();assert.equal(await page.locator('[data-gather]').count(),11);
 await page.locator('#closeModal').click();await page.locator('#playerBtn').click();await page.setViewportSize({width:640,height:780});
 await page.screenshot({path:'qa/v8-mobile-'+port+'.png'});
 assert.equal(await page.evaluate(()=>[...document.querySelectorAll('.profile-form,.profile-form input,.profile-form textarea,.modal-body')].some(e=>e.scrollWidth>e.clientWidth+2)),false);
 assert.equal(await page.locator('.profile-form input').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),16);
 report.push({port,editedProfile:true,butlerAppearance:true,recipeReceipt:true,collectAfterAction:true,mobileNoOverflow:true,errors});assert.deepEqual(errors,[]);
 await page.close();
}
await browser.close();console.log(JSON.stringify(report));

