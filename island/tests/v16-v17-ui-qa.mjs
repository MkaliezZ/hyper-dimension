import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const reports=[];
try{
 for(const [port,theme] of [[4173,'pixel'],[4174,'origami']]){
  for(const [width,height] of [[1440,950],[960,900],[390,844]]){
   const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),errors=[],missing=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)missing.push(r.url())});
   await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated visual QA; no external model calls"}'}));
   await page.goto('http://127.0.0.1:'+port+'/?qa=1&rev=ui-v16-harbor-v17');
   await page.waitForFunction(()=>window.islandInspect&&window.islandInspect().contentArts.metadata>0).catch(()=>page.waitForTimeout(1200));
   await page.waitForTimeout(400);
   const hud=await page.evaluate(()=>{
    const rect=s=>{const a=document.querySelector(s).getBoundingClientRect();return {x:a.x,y:a.y,width:a.width,height:a.height,right:a.right,bottom:a.bottom}};
    return {order:[...document.querySelectorAll('.toolbar-actions button')].map(b=>b.innerText.trim()),overflow:document.documentElement.scrollWidth>innerWidth+1,top:rect('.topbar'),toolbar:rect('.game-toolbar'),rail:rect('.theme-switch'),dock:rect('.bottom-bar'),folded:document.querySelector('#businessPanel').classList.contains('folded'),iconCount:document.querySelectorAll('.toolbar-actions .ui-icon').length};
   });
   assert.deepEqual(hud.order,['角色','管家','居民','采集','配方','经营','后台','？']);
   assert.equal(hud.overflow,false);assert.equal(hud.iconCount,8);
   for(const box of [hud.top,hud.toolbar,hud.rail,hud.dock])assert.ok(box.x>=-1&&box.right<=width+1&&box.bottom<=height+1,JSON.stringify({theme,width,box}));
   const overlap=(a,b)=>Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1;
   assert.equal(overlap(hud.top,hud.toolbar),false);assert.equal(overlap(hud.toolbar,hud.rail),false);assert.equal(overlap(hud.rail,hud.dock),false);
   if(width===390)assert.equal(hud.folded,true);
   await page.screenshot({path:'qa/v16-final-'+theme+'-'+width+'.png'});
   await page.locator('#playerBtn').click();
   await page.locator('.modal').waitFor();
   const profile=await page.evaluate(()=>({horizontal:[...document.querySelectorAll('.modal,.modal-body,.profile-form')].map(x=>({client:x.clientWidth,scroll:x.scrollWidth})),font:getComputedStyle(document.querySelector('.modal input')).fontSize}));
   assert.ok(profile.horizontal.every(x=>x.scroll<=x.client+2),JSON.stringify(profile));
   assert.ok(parseFloat(profile.font)>=16);
   if(width!==960)await page.screenshot({path:'qa/v16-final-profile-'+theme+'-'+width+'.png'});
   await page.locator('#closeModal').click();await page.locator('#residentsBtn').click();
   const copy=await page.locator('.resident-copy').first().evaluate(x=>({client:x.clientWidth,scroll:x.scrollWidth,whiteSpace:getComputedStyle(x).whiteSpace}));
   assert.ok(copy.scroll<=copy.client+1);
   await page.locator('[data-npc="0"]').first().click();await page.locator('.resident-modal').waitFor();
   if(width!==960)await page.screenshot({path:'qa/v16-final-resident-'+theme+'-'+width+'.png'});
   await page.locator('#closeModal').click();await page.locator('#stewardBtn').click();
   await page.locator('#hermesInput').waitFor();assert.equal(await page.locator('#hermesSend').count(),1);
   if(width===1440)await page.screenshot({path:'qa/v16-final-butler-'+theme+'.png'});
   assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
   reports.push({theme,width,height,hud,profile,residentWrap:copy,errors,missing});
   await context.close();
  }
 }
 const runs=[];
 for(const [port,theme] of [[4173,'pixel'],[4174,'origami']]){
  const context=await browser.newContext({viewport:{width:1440,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated harbor QA"}'}));
  await page.goto('http://127.0.0.1:'+port+'/?qa=1&rev=ui-v16-harbor-v17');await page.locator('#portBtn').click();
  runs.push({page,context,theme,errors});
 }
 await new Promise(r=>setTimeout(r,29000));
 for(const run of runs){
  const status=await run.page.evaluate(()=>window.islandInspect());
  assert.ok(status.boats.some(b=>b.phase==='moored'));assert.ok(status.visitors.some(g=>g.visible));
  const dock=await run.page.locator('#game').screenshot({path:'qa/v17-live-harbor-'+run.theme+'.png'});
  await run.page.screenshot({path:'qa/v17-live-screen-'+run.theme+'.png'});
  assert.deepEqual(run.errors,[]);
  reports.push({theme:run.theme,harborLive:{now:status.now,boats:status.boats,visitors:status.visitors,errors:run.errors}});
  await run.context.close();
 }
 await writeFile('qa/v16-v17-ui-qa.json',JSON.stringify(reports,null,2));
 console.log('PASS both themes: illustrated HUD, responsive layout, profile/resident/butler cards, asset loads and actual ferry landing');
}finally{await browser.close()}
