import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {createSaveStore} from '../server/saveStore.mjs';
await mkdir('qa/v30',{recursive:true});const directory=await mkdtemp(resolve('qa/v30/browser-'));
const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const base='http://127.0.0.1:'+port,saves=createSaveStore({directory});
for(const theme of ['pixel','origami']){const s=hydrateTown(createState());s.coins=120;for(const id of Object.keys(s.inventory))s.inventory[id]=0;Object.assign(s.inventory,{rod:1,c8_2:1,c16_4:1,c16_2:1,bread:3});await saves.open(theme,{legacyState:s,clientId:'fixture'})}
const server=spawn(process.execPath,[resolve('server.mjs'),'--port='+port,'--theme=origami'],{cwd:resolve('.'),windowsHide:true,env:{...process.env,HD_SAVE_DIR:directory},stdio:['ignore','pipe','pipe']});
let logs='',browser,page;server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const report={directory,kind:'real browser input and server saves; ordinary AI disabled in isolated worlds',checks:[],errors:[]},wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=25000){const start=Date.now();while(Date.now()-start<ms){const r=await fn();if(r)return r;await wait(100)}throw Error('condition timed out after '+ms)}
try{
 await until(async()=>{try{return(await fetch(base+'/api/status')).ok}catch{return false}},10000);
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const theme of ['pixel','origami']){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
  await ctx.route('**/api/**',r=>r.request().url().includes('/api/saves/')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated QA"}'}));
  page=await ctx.newPage();page.on('pageerror',e=>report.errors.push({theme,message:e.message,stack:e.stack}));
  await page.goto(base+'/?qa=1&theme='+theme);const inspect=()=>page.evaluate(()=>window.islandInspect());
  await page.locator('#partyBtn').click();await page.locator('#fishingPartyOpen').click();
  await page.locator('.fishing-hero>img').evaluate(img=>img.decode());
  await page.screenshot({path:'qa/v30/'+theme+'-invitation.png'});
  await page.setViewportSize({width:390,height:800});assert.equal(await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  await page.screenshot({path:'qa/v30/'+theme+'-compact.png'});await page.setViewportSize({width:1440,height:1000});
  await page.locator('#fishingName').fill('和朋友一起等海风');await page.locator('#fishingCreate').click();
  for(const id of [8,2]){await page.locator('[data-fishing-invite="'+id+'"]').click();assert(await page.locator('.fishing-dialogue .half-portrait').isVisible());await page.locator('#fishingInviteGive').click()}
  assert.equal((await inspect()).inventory.c16_2,0);
  await page.locator('#fishingStart').click();
  await until(async()=>!!(await inspect()).fishingParty?.session,10000);
  console.log(theme+': event launched, walking to check-in');
  await until(async()=>(await inspect()).fishingParty.session.phase==='running',120000);
  // Arrival opens the event journal; continue through its visible entry.
  if(await page.locator('#fishingEnter').count())await page.locator('#fishingEnter').click();
  else if(!await page.locator('#fishingGame').count())await page.locator('#partyBtn').click();
  await page.locator('#fishingGame').waitFor();
  await page.locator('[data-fish="next"]').click();
  let pausedChecked=false,held=false,lastMode='',roundsLogged=0;
  const started=Date.now();
  while(Date.now()-started<300000){
   const s=await inspect(),m=s.fishingParty.session.match,c=m.current;
   if(m.phase==='results')break;
   if(m.phase==='round_result'){
    if(held){await page.mouse.up();held=false}
    roundsLogged++;console.log(theme+': completed cast '+roundsLogged);
    await page.locator('[data-fish="next"]').click();continue;
   }
   const canvas=page.locator('#fishingGame canvas'),bounds=await canvas.boundingBox(),l=m.rounds[m.index];
   const point=(x,y)=>({x:bounds.x+x/960*bounds.width,y:bounds.y+y/540*bounds.height});
   if(c.mode==='aim'){const p=point(l.spot.x-l.wind,l.spot.y);await page.mouse.click(p.x,p.y)}
   else if(c.mode==='bite'&&c.modeT>.45){const p=point(l.spot.x,l.spot.y);await page.mouse.click(p.x,p.y)}
   else if(c.mode==='fight'){
    const p=point(c.fish.x,c.fish.y);await page.mouse.move(p.x,p.y);
    const hold=!c.surge&&c.tension<.75;
    if(hold&&!held){await page.mouse.down();held=true}
    if(!hold&&held){await page.mouse.up();held=false}
    if(!pausedChecked&&c.progress>.22){
     if(held){await page.mouse.up();held=false}
     await page.locator('[data-fish="pause"]').click();const before=(await inspect()).fishingParty.session.match.elapsed;await wait(700);assert(Math.abs((await inspect()).fishingParty.session.match.elapsed-before)<.08);
     await page.screenshot({path:'qa/v30/'+theme+'-pause.png'});
     await page.locator('#closeModal').click();await page.locator('#saveStatus').click();await page.locator('#saveNow').click();
     await until(async()=>{const d=await saves.current(theme);return d.state.fishingParty?.session?.match.elapsed>=before-.1});
     await page.reload();await page.locator('#partyBtn').click();await page.locator('#fishingGame').waitFor();assert((await inspect()).fishingGame.paused);await page.locator('[data-fish="resume"]').click();
     assert(Math.abs((await inspect()).fishingParty.session.match.elapsed-before)<1);
     pausedChecked=true;
    }
   }
   if(c.mode==='fight'&&lastMode!=='fight')await page.screenshot({path:'qa/v30/'+theme+'-playing.png'});
   if(['lost','landed'].includes(c.mode)&&held){await page.mouse.up();held=false}
   lastMode=c.mode;await wait(55);
  }
  if(held)await page.mouse.up();
  const done=(await inspect()).fishingParty.session;assert.equal(done.match.phase,'results');assert.equal(done.match.results.length,6);assert(done.match.results.filter(r=>r.caught).length>=4,JSON.stringify(done.match.results));assert(pausedChecked);
  await page.locator('[data-fish="claim"]').click();await page.locator('.fishing-award').waitFor();
  const won=(await inspect()).fishingParty.session;assert.equal(won.phase,'claimed');assert(won.paid>=30&&won.paid<=42);assert.equal((await inspect()).inventory.fish,0);assert(!(await inspect()).journey?.ready.festival);assert(!(await inspect()).journey?.completed.party);
  assert.equal((await inspect()).economy.cashLedger.filter(e=>e.category==='party'&&e.income>0).length,1);
  await page.locator('#fishingAwardDisplay').click();assert.equal((await inspect()).eventWonders.displayed,'seashell_cup');
  await page.screenshot({path:'qa/v30/'+theme+'-award.png'});
  await page.locator('#fishingAwardClose').click();
  await page.locator('#saveStatus').click();await page.locator('#saveNow').click();
  await until(async()=>{const d=await saves.current(theme);return !d.state.fishingParty?.session&&d.state.eventWonders?.displayed==='seashell_cup'});
  await page.reload();assert.equal((await inspect()).eventWonders.displayed,'seashell_cup');assert.equal((await inspect()).fishingParty.history[0].paid,won.paid);
  await page.locator('#partyBtn').click();assert(await page.locator('#hostParty').isDisabled());await page.locator('#fishingPartyOpen').click();
  assert.match(await page.locator('.fishing-memento').textContent(),/贝壳奖杯/);
  await page.locator('.fishing-history summary').click();await page.locator('[data-fishing-history]').first().click();
  assert.match(await page.locator('.fishing-prep').textContent(),new RegExp('已结算 '+won.paid+' 岛币'));
  await page.screenshot({path:'qa/v30/'+theme+'-history.png'});await page.locator('#fishingHistoryBack').click();
  report.checks.push({theme,flow:'dialogue delivers materials; real walking/check-in; six cast/hook/reel inputs; pause and actual server save/reload; reward once; displayed trophy persists',score:won.result,caught:won.match.results.filter(r=>r.caught).length,reward:won.paid,elapsed:won.match.elapsed});
  await ctx.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;if(page&&!page.isClosed()){await page.screenshot({path:'qa/v30/browser-failure.png'}).catch(()=>{});report.snapshot=await page.evaluate(()=>window.islandInspect?.()).catch(()=>null)}throw e}
finally{await browser?.close();server.kill();await writeFile('qa/v30/browser-report.json',JSON.stringify(report,null,2));if(!report.passed)await writeFile('qa/v30/browser-failure.log',logs)}
console.log(JSON.stringify({passed:report.passed,checks:report.checks}));
