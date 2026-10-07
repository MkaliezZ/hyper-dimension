import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('qa/v19',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const errors=[],report=[];
try{for(const theme of ['origami','pixel']){
 const page=await browser.newPage({viewport:{width:1440,height:1080}});
 page.on('pageerror',e=>errors.push({theme,message:e.message}));
 await page.route('**/api/**',r=>r.fulfill({status:503,body:'{"error":"isolated QA"}',contentType:'application/json'}));
 await page.goto('http://127.0.0.1:4174/src/arcade.html?qa=1&theme='+theme);
 await page.waitForTimeout(700);await page.screenshot({path:'qa/v19/gallery-'+theme+'.png',fullPage:false});
 for(const id of [0,1,2,4,5,6,8,10,12,13,14,15,16,17,18,19,20,21,22,23,24]){
  await page.goto('http://127.0.0.1:4174/src/arcade.html?qa=1&theme='+theme+'&game='+id+'&seed=731&difficulty=2');
  await page.locator('[data-action="start"]:enabled').waitFor();
  if(id===15)await page.screenshot({path:'qa/v19/intro-'+theme+'.png'});
  await page.locator('[data-action="start"]').click();await page.waitForTimeout(250);
  const state=await page.evaluate(()=>arcadeInspect());report.push({theme,id,kind:state.kind,phase:state.phase,loaded:state.loaded});
  await page.locator('.wk-stage').screenshot({path:'qa/v19/stage-'+theme+'-'+id+'.png'});
  if([2,5,15,20,23].includes(id))await page.screenshot({path:'qa/v19/play-'+theme+'-'+id+'.png'});
 }
 await page.setViewportSize({width:390,height:844});
 for(const id of [2,15,5]){
  await page.goto('http://127.0.0.1:4174/src/arcade.html?qa=1&theme='+theme+'&game='+id+'&seed=731&difficulty=2');
  await page.locator('[data-action="start"]:enabled').waitFor();await page.screenshot({path:'qa/v19/mobile-intro-'+theme+'-'+id+'.png'});
  await page.locator('[data-action="start"]').click();await page.screenshot({path:'qa/v19/mobile-'+theme+'-'+id+'.png'});
  const bounds=await page.evaluate(()=>({w:innerWidth,scroll:document.documentElement.scrollWidth}));report.push({theme,id,mobile:true,...bounds});if(bounds.scroll>bounds.w+1)errors.push({theme,id,error:'horizontal overflow'});
 }
 await page.close();
}
}finally{await browser.close()}
await writeFile('qa/v19/visual-smoke.json',JSON.stringify({errors,report},null,2));
console.log(JSON.stringify({errors,checked:report.length}));
if(errors.length)process.exitCode=1;
