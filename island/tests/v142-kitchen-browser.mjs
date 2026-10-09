import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs} from '../src/townSimulation.js';
import {RAW_MATERIALS,ALL_RECIPES,RECIPE_BY_ID} from '../src/contentCatalog.js';

const out=path.resolve(process.env.HD_QA_OUT||'qa/v142/native-kitchen');
await mkdir(out,{recursive:true});
const report={scope:'Isolated, pre-unlocked 75-quality fixtures with 100 of each raw material, zero manufactured products and suspended retail shelves before startup. NPCs retain normal local work/life; model endpoints are blocked. Actual kitchen catalog navigation and walking, mouse slicing, mobile touch slicing, space cutting, normal animation, accepted server costs, one receipt per craft and mid-game disk refresh/resume. Does not establish zero-start gathering/unlocks, human puzzle difficulty or long-duration economy.',cases:[]};
let browser;const sessions=[];
async function run(theme){
 const dir=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(dir,'saves')}),state=hydrateTown(createZeroState());
 state.freshStartPending=false;state.research={};state.shopfronts={version:1,revision:0,venues:{}};
 for(const raw of RAW_MATERIALS)state.inventory[raw.id]=100;
 for(let id=0;id<25;id++){state.research[id]=10;state.facilities[id].quality=75;state.facilities[id].upgrades=2;state.shopfronts.venues[id]=[];}
 for(let id=0;id<16;id++)Object.assign(needs(id,state),{hunger:100,energy:100,social:100});
 for(const r of ALL_RECIPES)assert.equal(state.inventory[r.item],0,'fixture must not grant '+r.item);
 await store.open(theme,{legacyState:state,protect:true});
 const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme='+theme],{windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs')}});
 const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true}),page=await context.newPage();sessions.push({server,context});
 const row={theme,errors:[],badAssets:[],actions:[],crafts:[]},pending=[];report.cases.push(row);
 const progress=()=>writeFile(path.join(out,theme+'-progress.json'),JSON.stringify(row,null,2));
 page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(r.url());if(r.url().endsWith('/action')&&r.request().method()==='POST'){const q=r.request().postDataJSON();if(['craft','personal'].includes(q.kind))pending.push(r.json().then(v=>row.actions.push({kind:q.kind,operation:q.operation,status:r.status(),code:v.code||null,requestId:q.requestId})));}});
 await context.route('**/api/**',r=>/\/api\/(saves\/|status$|world\/session)/.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated native production check"}'}));
 const current=()=>store.current(theme),inspect=()=>page.evaluate(()=>window.islandInspect().roomGame);
 async function openItem(id){if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();await page.locator('#bagBtn').click();await page.locator('#bagFilter').selectOption('all');await page.locator('[data-item="'+id+'"]').click();}

 const touch=await context.newCDPSession(page);
 let restored=false,touchUsed=false,mouseCuts=0,keyboardCuts=0;
 async function slice(mode){
  const g=await inspect(),j=g.jobs[g.ticket],index=Math.floor(j.cuts/2),x=421+index*69;
  const box=await page.locator('.wk-canvas').boundingBox(),small=box.width<600,v=small?{x:337,y:200,w:290,h:245}:{x:0,y:0,w:960,h:540};
  const pos=(y)=>({x:box.x+(x-v.x)/v.w*box.width,y:box.y+(y-v.y)/v.h*box.height});
  const a=pos(286),b=pos(356);
  if(mode==='touch'){
   await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});row.touchDown=await page.evaluate(()=>{const g=window.islandInspect().roomGame;return {t:g.t,lastCut:g.lastCut,holding:g.holding,kitchenStroke:g.kitchenStroke,pointer:g.pointer}});await page.waitForTimeout(110);
   await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...b,id:1}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.waitForTimeout(110);await page.mouse.move(b.x,b.y,{steps:4});await page.mouse.up();}
  await page.waitForTimeout(80);
  const after=await inspect();assert.equal(after.jobs[j.id].cuts,j.cuts+1,mode+' cut must cross the actual food');
  if(mode==='mouse')mouseCuts++;else touchUsed=true;
 }
 async function restore(){
  await page.keyboard.press('KeyP');const before=await inspect();assert(before.paused);
  for(let i=0;i<160;i++){const ticket=(await current()).actions.active;if(ticket?.game?.state?.jobs[0]?.cuts===before.jobs[0].cuts)break;await page.waitForTimeout(100);}
  const saved=(await current()).actions.active;assert.equal(saved.game.state.jobs[0].cuts,before.jobs[0].cuts);
  await page.screenshot({path:path.join(out,theme+'-sliced-before-reload.png')});await page.reload();await page.locator('#craftRetry').waitFor({state:'visible',timeout:45000});await page.locator('#craftRetry').click();
  await page.waitForFunction(()=>window.islandInspect?.().roomGame?.kind==='kitchen',null,{timeout:45000});
  const after=await inspect();assert.equal(after.level.schemaVersion,142);assert.equal(after.jobs[0].cuts,before.jobs[0].cuts);assert.equal(after.kitchenStroke,null);assert.deepEqual(after.jobs[0].cutQuality,before.jobs[0].cutQuality);
  assert.equal((await current()).actions.active.requestId,saved.requestId);row.resume={passed:true,cuts:after.jobs[0].cuts,sameRequest:true};restored=true;
 }
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await page.goto('http://127.0.0.1:'+port+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});
  await openItem('meal');await page.locator('#itemCraft:enabled').click();await page.waitForFunction(()=>window.islandInspect?.().roomGame?.kind==='kitchen',null,{timeout:180000});
  const ticket=(await current()).actions.active;assert(!ticket.practice);assert.equal(ticket.recipeId,'recipe_meal');
  if(await page.locator('[data-action="start"]:visible').isVisible())await page.locator('[data-action="start"]').click();
  for(let tries=0;tries<1400;tries++){
   const g=await inspect();if(g.phase==='result'){assert(g.result.passed);row.result=g.result;break;}if(g.phase==='celebrating'){await page.waitForTimeout(160);continue;}
   if(g.paused){await page.locator('[data-action="resume"]').click();continue;}
   const ready=g.jobs.find(j=>j.state==='cooking'&&j.cooked>=j.cook+.1);if(ready){await page.locator('[data-action="serve"][data-station="'+ready.station+'"]').click();continue;}
   const j=g.jobs[g.ticket];
   if(j&&['available','prep'].includes(j.state)){
    const goal=g.level.orders[j.id].ingredients;
    if(j.ingredients.length<goal.length){await page.locator('[data-action="ingredient"][data-index="'+goal[j.ingredients.length]+'"]').click();continue;}
    if(j.cuts<goal.length*2){
     if(g.t-g.lastCut<.4){await page.waitForTimeout(150);continue;}
     if(mouseCuts<2)await slice('mouse');
     else if(!restored){await restore();continue;}
     else if(!touchUsed){
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(120);await page.locator('.wk-stage').scrollIntoViewIfNeeded();await slice('touch');
      await page.screenshot({path:path.join(out,theme+'-mobile-touch.png')});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width:1440,height:1000});
     }else{await page.keyboard.press('Space');keyboardCuts++;}
     continue;
    }
    if(g.jobs.filter(j=>j.state==='cooking').length<2){await page.locator('[data-action="cook"]').click();continue;}
   }
   await page.waitForTimeout(160);
  }
  assert(row.result?.passed,'normal-clock kitchen must complete');assert(restored&&touchUsed&&mouseCuts===2&&keyboardCuts>0);
  await page.screenshot({path:path.join(out,theme+'-completed.png')});await page.waitForFunction(()=>!window.islandInspect().serverCraft.settling,null,{timeout:30000});await page.locator('[data-action="claim"]:enabled').click();
  await page.waitForFunction(()=>!window.islandInspect().serverCraft.active,null,{timeout:30000});let d=await current(),receipts=d.actions.receipts.filter(r=>r.ticket?.requestId===ticket.requestId&&r.outcome==='finished');assert.equal(receipts.length,1);assert.deepEqual(receipts[0].cost,RECIPE_BY_ID.recipe_meal.cost);assert.deepEqual(receipts[0].gain,{meal:1});
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});d=await current();assert.equal(d.actions.receipts.filter(r=>r.ticket?.requestId===ticket.requestId&&r.outcome==='finished').length,1);
  row.receipt={cost:receipts[0].cost,gain:receipts[0].gain,oneAfterReopen:true};row.inputs={mouseCuts,touchUsed,keyboardCuts};await Promise.all(pending);assert(row.actions.every(a=>a.status===200));assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;await progress();console.log(theme+' native kitchen, disk resume and exact meal receipt passed');
 }catch(e){row.failure=e.stack;row.last=await inspect().catch(()=>null);await progress();await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
}
try{browser=await chromium.launch(browserLaunchOptions());const results=await Promise.allSettled(['pixel','origami'].map(run));for(const r of results)if(r.status==='rejected')throw r.reason;report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{for(const s of sessions){await s.context.close().catch(()=>{});if(s.server.exitCode===null){const ended=new Promise(r=>s.server.once('close',r));s.server.kill();await ended;}}await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,inputs:c.inputs,failure:c.failure}))}));}
