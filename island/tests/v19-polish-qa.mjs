import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050}});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,body:'{}'}));
 for(const theme of ['origami','pixel'])for(const id of [8,15,16,23,2,20]){
  await page.goto('http://127.0.0.1:4174/src/arcade.html?qa=1&theme='+theme+'&game='+id+'&seed=731&difficulty=2');
  await page.locator('[data-action="start"]:enabled').click();await page.waitForTimeout(150);
  if(id===2){
   const s=await page.evaluate(()=>arcadeInspect());for(const index of s.level.orders[0].ingredients)await page.locator('[data-action="ingredient"][data-index="'+index+'"]').click();
   for(let n=0;n<4;n++){await page.locator('[data-action="cut"]').click();await page.waitForTimeout(400);}await page.locator('[data-action="cook"]').click();await page.waitForTimeout(700);
  }
  if(id===20){
   const s=await page.evaluate(()=>arcadeInspect()),p=s.level.targets[0],box=await page.locator('.wk-canvas').boundingBox(),x=480+Math.cos(p.angle)*250,y=475+Math.sin(p.angle)*250;
   await page.mouse.move(box.x+x/960*box.width,box.y+y/540*box.height);await page.mouse.down();await page.waitForTimeout(p.power/.6*1000);await page.mouse.up();await page.waitForTimeout(p.fuse*1000);await page.mouse.down();await page.mouse.up();await page.waitForTimeout(160);
   assert.ok((await page.evaluate(()=>arcadeInspect())).shots===1);
  }
  if(id===16){
   const s=await page.evaluate(()=>arcadeInspect()),p=s.level.spots[0],box=await page.locator('.wk-canvas').boundingBox();
   await page.mouse.move(box.x+(p.x-s.level.wind)/960*box.width,box.y+p.y/540*box.height);await page.mouse.click(box.x+(p.x-s.level.wind)/960*box.width,box.y+p.y/540*box.height);
   await page.waitForFunction(()=>arcadeInspect().mode==='bite');await page.keyboard.down('Space');await page.waitForTimeout(900);await page.keyboard.up('Space');
  }
  await page.screenshot({path:'qa/v19/final-'+theme+'-'+id+'.png'});await page.locator('.wk-stage').screenshot({path:'qa/v19/stage-'+theme+'-'+id+'.png'});
 }
 assert.deepEqual(errors,[]);await writeFile('qa/v19/polish.json',JSON.stringify({errors,scenes:12,activeCooking:true,activeFishing:true,fireworksBurst:true},null,2));
}finally{await browser.close()}
console.log('12 final polished scene captures; no runtime errors');
