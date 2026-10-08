import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown,needs,career} from '../src/townSimulation.js';
import {CATALOG_ITEMS,RECIPE_BY_ID} from '../src/contentCatalog.js';
import {browserLaunchOptions} from './browserRuntime.mjs';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v114/native-contracts');await mkdir(out,{recursive:true});
const directory=await mkdtemp(path.join(out,'save-')),store=createSaveStore({directory}),acceptedCost={bark:3,fiber:2};
for(const theme of ['pixel','origami']){
 const s=hydrateTown(createZeroState());s.freshStartPending=false;for(const item of CATALOG_ITEMS)s.inventory[item.id]=99;
 Object.assign(needs(15,s),{social:0,hunger:100,energy:100});career(15,s).workSinceBreak=3;
 const {document:d}=await store.open(theme,{legacyState:s,protect:true});
 // This isolated fixture represents a batch accepted under a previous recipe definition.
 // Only the fixture process changes its in-memory catalog; the app server loads the current code.
 const r=RECIPE_BY_ID.recipe_c7_0,original=r.cost;r.cost={...acceptedCost};
 try{await store.action(theme,{kind:'craft',operation:'begin',requestId:randomUUID(),recipeId:r.id,mode:'1',epoch:d.actions?.epoch||null,expectedSequence:d.actions?.sequence||0,expectedVersion:d.version})}finally{r.cost=original}
}
const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const server=spawn(process.execPath,['server.mjs','--port='+port],{windowsHide:true,env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:directory,HD_RUN_LEDGER_DIR:path.join(out,'runs')},stdio:'ignore'}),base='http://127.0.0.1:'+port;
const report={scope:'Isolated 99-stock fixtures: existing accepted navigation-journal batch costs bark 3/fiber 2 while the app current definition costs 1/1; butler has low social need and is ready for a break. Real browser resume/reload, cell clicks, server settlement and normal-speed resident movement. No runtime position, result, stock or clock injection. Model endpoints blocked. This is targeted evidence, not zero-start balance or long-duration acceptance.',cases:[]};let browser;
async function run(theme){
 const row={theme,errors:[],butlerActions:[],invalidActions:[]};report.cases.push(row);const context=await browser.newContext({viewport:{width:1440,height:1000}}),pending=[];
 await context.route('**/api/**',r=>r.request().url().includes('/api/saves/')||r.request().url().endsWith('/api/status')?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated V114 behavior check"}'}));
 const page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().endsWith('/action')&&r.request().method()==='POST'){const q=r.request().postDataJSON();if(q.kind==='resident')pending.push(r.json().then(v=>{if(v.code==='resident_invalid')row.invalidActions.push({operation:q.operation,actor:q.actorId,code:v.code});if(v.ticket?.actorId===15)row.butlerActions.push({operation:q.operation,status:r.status(),purpose:v.ticket.intent?.purposeId,action:v.ticket.intent?.action,receipt:v.receipt&&{outcome:v.receipt.outcome,cost:v.receipt.cost,gain:v.receipt.gain}})}))}});
 try{
  await page.goto(base+'/?qa=1&theme='+theme);await page.locator('#craftRetry').waitFor({state:'visible',timeout:45000});await page.locator('#craftRetry').click();await page.waitForFunction(()=>window.islandInspect?.().roomGame?.id===7,null,{timeout:30000});
  row.materials=await page.locator('.material-costs').innerText();assert.match(row.materials,/\/3/);assert.match(row.materials,/\/2/);row.beforeTicket=(await store.current(theme)).actions.active;assert.deepEqual(row.beforeTicket.recipeContract.cost,acceptedCost);
  await page.screenshot({path:path.join(out,theme+'-accepted-materials.png')});
  await page.reload();await page.locator('#craftRetry').waitFor({state:'visible',timeout:30000});await page.locator('#craftRetry').click();await page.waitForFunction(()=>window.islandInspect?.().roomGame?.id===7,null,{timeout:20000});
  row.reloadedMaterials=await page.locator('.material-costs').innerText();assert.match(row.reloadedMaterials,/\/3/);assert.match(row.reloadedMaterials,/\/2/);
  for(let i=0;i<180;i++){const game=await page.evaluate(()=>window.islandInspect().roomGame);if(game.done)break;assert(game.legalMove);await page.locator('.classic-cell[data-cell="'+game.legalMove.a+'"]').click();await page.locator('.classic-cell[data-cell="'+game.legalMove.b+'"]').click();await page.waitForFunction(()=>!window.islandInspect().roomGame.busy,null,{timeout:10000});}
  assert.equal(await page.locator('.activity-finish').innerText(),'领取制作成果');await page.locator('.activity-finish:enabled').waitFor({timeout:20000});await page.locator('.activity-finish').click();await page.waitForFunction(()=>!window.islandInspect().serverCraft.active,null,{timeout:20000});
  const d=await store.current(theme),receipts=d.actions.receipts.filter(r=>r.ticket.requestId===row.beforeTicket.requestId&&r.outcome==='finished');assert.equal(receipts.length,1);row.receipt={cost:receipts[0].cost,gain:receipts[0].gain};assert.deepEqual(row.receipt.cost,acceptedCost);assert.deepEqual(row.receipt.gain,{c7_0:1});
  if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();
  for(let i=0;i<30;i++){await page.waitForTimeout(5000);const s=await page.evaluate(()=>{const s=window.islandInspect();return {time:s.now,butler:s.npcs.find(n=>n.id===15),history:s.careers[15].history}});row.last=s;await writeFile(path.join(out,theme+'-progress.json'),JSON.stringify(row,null,2));if(s.history.some(h=>h.action==='visit'&&h.purposeId?.startsWith('life:'))&&row.butlerActions.some(a=>a.operation==='finish'))break;if(i%6===0)console.log(theme+' butler '+Math.round(s.time)+'s '+s.butler?.status);}
  await Promise.all(pending);assert(row.last.history.some(h=>h.action==='visit'&&h.purposeId?.startsWith('life:')),'butler completes real life action');assert(row.butlerActions.some(a=>a.operation==='finish'&&a.status===200));assert.deepEqual(row.invalidActions,[]);assert.deepEqual(row.errors,[]);delete row.beforeTicket;row.passed=true;console.log(theme+' accepted batch and native butler passed');
 }catch(e){row.failure=e.stack;await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});throw e}finally{await context.close()}
}
try{for(let i=0;i<100;i++){try{if((await fetch(base+'/src/recipeContracts.js')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}browser=await chromium.launch(browserLaunchOptions());const results=await Promise.allSettled(['pixel','origami'].map(run));for(const r of results)if(r.status==='rejected')throw r.reason;report.passed=true}catch(e){report.failure=e.stack;process.exitCode=1}finally{await browser?.close();server.kill();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,out,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,failure:c.failure}))}))}
