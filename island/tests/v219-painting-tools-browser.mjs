import {createNativeWorkJournal} from './nativeWorkJournal.mjs';
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
import {brushGuide} from '../src/brushStudio.js';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v219/native-painting-tools');await mkdir(out,{recursive:true});
const report={scope:'Isolated pre-unlocked fixtures with one prepared canvas, paint inputs and one personal brush. Native building-modal mouse gestures, natural game/animation clocks, actual server replay, one accepted painting receipt and retained reusable brush, refresh persistence and responsive review. No AI calls or user data; not zero-start/human/complete art acceptance.',cases:[]};let browser;const sessions=[];
const workJournal=createNativeWorkJournal(out,report,{deadlineMs:45*60*1000});
async function run(theme){
 const dir=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(dir,'saves')}),state=hydrateTown(createZeroState());state.freshStartPending=false;state.research={};state.shopfronts={version:1,revision:0,venues:{}};
 for(const raw of RAW_MATERIALS)state.inventory[raw.id]=100;for(let id=0;id<25;id++){state.research[id]=10;state.facilities[id].quality=75;state.facilities[id].upgrades=2;state.shopfronts.venues[id]=[];}for(let id=0;id<16;id++)Object.assign(needs(id,state),{hunger:100,energy:100,social:100});for(const r of ALL_RECIPES)assert.equal(state.inventory[r.item],0);state.inventory.c24_2=1;for(const[id,n]of Object.entries(RECIPE_BY_ID.recipe_painting.cost))state.inventory[id]=n;
 await store.open(theme,{legacyState:state,protect:true});const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
 const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme='+theme],{windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs')}}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();sessions.push({server,context});const row={theme,errors:[],badAssets:[],actions:[]},pending=[];report.cases.push(row);workJournal.observe(page,row);await workJournal.install(context);workJournal.phase(row,'opening');
 const progress=()=>writeFile(path.join(out,theme+'-progress.json'),JSON.stringify(row,null,2));page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(r.url());if(r.url().endsWith('/action')&&r.request().method()==='POST'){const q=r.request().postDataJSON();if(q.kind==='craft')pending.push(r.json().then(v=>row.actions.push({operation:q.operation,status:r.status(),code:v.code||null,requestId:q.requestId})));}});
 await context.route('**/api/**',r=>/\/api\/(saves\/|status$|world\/session)/.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated drawing check"}'}));
 const inspect=()=>page.evaluate(()=>window.islandInspect().roomGame),current=()=>store.current(theme);
 let canvasBox;async function move(p){const box=canvasBox||await page.locator('.wk-canvas').boundingBox();const v=box.width<600?{x:186,y:56,w:590,h:426}:{x:0,y:0,w:960,h:540};await page.mouse.move(box.x+(p.x-v.x)/v.w*box.width,box.y+(p.y-v.y)/v.h*box.height);}
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await page.goto('http://127.0.0.1:'+port+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});await page.locator('#bagBtn').click();await page.locator('#bagFilter').selectOption('all');await page.locator('[data-item="c24_2"]').click();assert.match(await page.locator('#itemUse').textContent(),/\u88c5\u5907/);workJournal.phase(row,'equip-personal-brush');await page.locator('#itemUse').click();for(let i=0;i<100&&(await current()).state.toolbelt?.paint!=='c24_2';i++)await page.waitForTimeout(50);assert.equal((await current()).state.toolbelt.paint,'c24_2');row.equippedViaBag=true;workJournal.phase(row,'brush-equipped');await page.locator('#backBag').click();await page.locator('#bagFilter').selectOption('all');await page.locator('[data-item="painting"]').click();await page.locator('#itemCraft:enabled').click();await page.waitForFunction(()=>window.islandInspect?.().roomGame?.kind==='brush',null,{timeout:180000});
  const ticket=(await current()).actions.active;assert.equal(ticket.recipeId,'recipe_painting');assert(!ticket.practice);assert.equal(ticket.game.state.level.schemaVersion,139);assert.equal(ticket.tool.id,'c24_2');assert.equal(ticket.tool.source,'owned');assert.equal(ticket.duration,1.68);assert.equal(ticket.reservedItems.c24_2,1);assert.equal(ticket.recipeContract.cost.c24_3,1);assert.equal(ticket.recipeContract.cost.c24_2,undefined);row.ticket={requestId:ticket.requestId,recipeContract:ticket.recipeContract,seed:ticket.seed};await page.locator('[data-action="start"]:visible').click();await page.screenshot({path:path.join(out,theme+'-drawing-start.png')});let captured=false;
  for(let tries=0;tries<1800;tries++){
   await page.waitForFunction(()=>!window.islandInspect().serverCraft.settling,null,{timeout:30000});const s=await inspect();row.live={stroke:s.stroke,arc:s.arc,mode:s.mode,seconds:s.t,status:s.status};
   if(s.phase==='result'){assert(s.result.passed);row.result=s.result;break;}
   if(s.mode!=='drawing'||s.dryRemaining>0||s.phase==='celebrating'){await page.waitForTimeout(120);continue;}
   const stroke=s.level.strokes[s.stroke];if(s.color!==stroke.color){await page.mouse.up();await page.locator('[data-action="color"][data-index="'+stroke.color+'"]').click();continue;}
   if(s.ink<.045){await page.mouse.up();await page.locator('[data-action="dip"]:enabled').click();continue;}
   canvasBox=await page.locator('.wk-canvas').boundingBox();
   if(!s.holding||!s.brushAnchored){await page.mouse.up();await move(brushGuide(s));await page.mouse.down();await page.waitForTimeout(35);continue;}
   // Interpolate a continuous four-pixel gesture at native pointer coordinates.
   // This retains the game's speed/quality/time gates without spending a
   // browser round trip on layout for every densely sampled guide point.
   const points=[];for(let arc=s.arc+4;arc<Math.min(stroke.length,s.arc+32);arc+=4)points.push(brushGuide({...s,arc}));points.push(brushGuide({...s,arc:Math.min(stroke.length,s.arc+32)}));for(const p of points){await move(p);await page.waitForTimeout(34);}
   if(!captured&&s.stroke>=2){captured=true;await page.screenshot({path:path.join(out,theme+'-drawing-progress.png')});}
   if(tries%25===0)await progress();
  }
  assert(row.result?.passed,'native painting did not finish');await page.mouse.up();await page.screenshot({path:path.join(out,theme+'-drawing-result.png')});assert(await page.locator('#modalRoot .wk-embedded').isVisible());assert(page.url().includes('/?qa=1'));
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,theme+'-result-mobile.png')});const close=page.locator('.wk-dialog-close'),box=await close.boundingBox();assert(box&&box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844);await page.setViewportSize({width:1440,height:1000});
  await page.waitForFunction(()=>!window.islandInspect().serverCraft.settling,null,{timeout:30000});await page.locator('[data-action="claim"]:enabled').click();await page.waitForTimeout(350);await page.screenshot({path:path.join(out,theme+'-brush-finishing.png')});await page.waitForFunction(()=>!window.islandInspect().serverCraft.active,null,{timeout:30000});const d=await current(),receipts=d.actions.receipts.filter(v=>v.ticket?.requestId===ticket.requestId&&v.outcome==='finished');assert.equal(receipts.length,1);assert.deepEqual(receipts[0].gain,{painting:1});assert.deepEqual(receipts[0].cost,RECIPE_BY_ID.recipe_painting.cost);assert.equal(d.state.inventory.c24_2,1);assert.equal(d.state.inventory.c24_3,0);row.brushReturned=true;row.canvasConsumed=true;row.receipt={cost:receipts[0].cost,gain:receipts[0].gain,result:receipts[0].details?.result};
  workJournal.phase(row,'reload-finished-painting');await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});const reopened=await current();assert.equal(reopened.actions.receipts.filter(v=>v.ticket?.requestId===ticket.requestId&&v.outcome==='finished').length,1);assert.equal(reopened.state.inventory.painting,1);row.refreshPreserved=true;await Promise.all(pending);assert(row.actions.every(v=>v.status===200));assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;workJournal.phase(row,'complete');await progress();console.log(theme+' native drawing and production passed');
 }catch(e){row.failure=e.stack;workJournal.phase(row,'failed');row.last=await page.evaluate(()=>window.islandInspect?.()).catch(()=>null);await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});await progress();throw e;}finally{
  // Theme checks are sequential. Retire this completed isolated world before
  // opening the next; four-map rendering is tested in its own retained-map flow.
  await context.close().catch(()=>{});
 }
}
try{browser=await chromium.launch(browserLaunchOptions());for(const theme of ['pixel','origami'])await run(theme);report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await workJournal.beforeCleanup();for(const s of sessions){await s.context.close().catch(()=>{});if(s.server.exitCode===null){const end=new Promise(r=>s.server.once('close',r));s.server.kill();await end;}}await browser?.close();await workJournal.finish();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,result:c.result,failure:c.failure}))}));}
