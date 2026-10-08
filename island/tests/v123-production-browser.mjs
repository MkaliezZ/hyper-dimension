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

const out=path.resolve(process.env.HD_QA_OUT||'qa/v123/native-production');
await mkdir(out,{recursive:true});
const report={scope:'Isolated, pre-unlocked 75-quality fixtures with 100 of each raw material, zero manufactured products and suspended retail shelves before startup. NPCs retain normal local work/life; model endpoints are blocked. Actual catalog navigation and walking, native joinery/classic/tea controls, normal animation, accepted server costs, one receipt per craft, mid-game refresh/resume, gift use and persistence. Does not establish zero-start gathering/unlocks, human puzzle difficulty or long-duration economy.',cases:[]};
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
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();sessions.push({server,context});
 const row={theme,errors:[],badAssets:[],actions:[],crafts:[]},pending=[];report.cases.push(row);
 const progress=()=>writeFile(path.join(out,theme+'-progress.json'),JSON.stringify(row,null,2));
 page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(r.url());if(r.url().endsWith('/action')&&r.request().method()==='POST'){const q=r.request().postDataJSON();if(['craft','personal'].includes(q.kind))pending.push(r.json().then(v=>row.actions.push({kind:q.kind,operation:q.operation,status:r.status(),code:v.code||null,requestId:q.requestId})));}});
 await context.route('**/api/**',r=>/\/api\/(saves\/|status$|world\/session)/.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated native production check"}'}));
 const current=()=>store.current(theme),inspect=()=>page.evaluate(()=>window.islandInspect().roomGame);
 async function openItem(id){if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();await page.locator('#bagBtn').click();await page.locator('#bagFilter').selectOption('all');await page.locator('[data-item="'+id+'"]').click();}
 async function teaPair(g){const a=g.opened[0]??g.level.values.findIndex((v,i)=>!g.found.includes(i)),b=g.level.values.findIndex((v,i)=>i!==a&&!g.found.includes(i)&&v===g.level.values[a]);assert(a>=0&&b>=0);if(!g.opened.includes(a))await page.locator('.wk-hit[data-cell="'+a+'"]').click();await page.locator('.wk-hit[data-cell="'+b+'"]').click();return [a,b];}
 async function solve(resume){
  let refreshed=false;
  for(let tries=0;tries<250;tries++){
   let g=await inspect();
   if(g.done)return {passed:true,kind:'classic',score:g.score};
   if(g.phase==='result'){assert(g.result.passed);return {...g.result,kind:g.kind};}
   if(g.legalMove){await page.locator('.classic-cell[data-cell="'+g.legalMove.a+'"]').click();await page.locator('.classic-cell[data-cell="'+g.legalMove.b+'"]').click();await page.waitForFunction(()=>!window.islandInspect().roomGame.busy,null,{timeout:10000});continue;}
   if(g.phase==='celebrating'){await page.waitForTimeout(150);continue;}
   if(g.kind==='joinery'){
    const next=g.level.solution.find(p=>!g.placed.some(q=>q.piece===p.piece));
    if(next){if(g.selected!==next.piece)await page.locator('[data-piece="'+next.piece+'"]').click();else if(g.rotation!==next.rotation)await page.locator('[data-action="rotate"]').click();else await page.locator('.wk-hit[data-cell="'+next.anchor+'"]').click();}
   }else if(g.kind==='tea'){
    if(g.t<g.level.preview||g.opened.length>=2){await page.waitForTimeout(150);continue;}
    await page.waitForFunction(()=>!window.islandInspect().serverCraft.settling,null,{timeout:30000});
    const pair=await teaPair(g);
    if(resume&&!refreshed){
     await page.waitForTimeout(5700);g=await inspect();assert(pair.every(i=>g.found.includes(i)));
     const accepted=(await current()).actions.active;assert(accepted?.game);row.resume={requestId:accepted.requestId,cost:accepted.recipeContract.cost,values:g.level.values,found:g.found};
     await page.screenshot({path:path.join(out,theme+'-before-resume.png')});
     await page.reload();await page.locator('#craftRetry').waitFor({state:'visible',timeout:45000});await page.locator('#craftRetry').click();await page.waitForFunction(()=>window.islandInspect?.().roomGame?.kind==='tea',null,{timeout:30000});
     const restored=await inspect(),ticket=(await current()).actions.active;
     assert.equal(ticket.requestId,accepted.requestId);assert.deepEqual(ticket.recipeContract.cost,accepted.recipeContract.cost);assert.deepEqual(restored.level.values,g.level.values);assert(pair.every(i=>restored.found.includes(i)));
     row.resume.restoredFound=restored.found;row.resume.passed=true;refreshed=true;await progress();
    }
   }else throw Error('Unexpected native production game '+g.kind);
   await page.waitForTimeout(130);
  }
  throw Error('Native puzzle did not finish');
 }
 async function craft(id,{resume=false,repair=false}={}){
  const r=RECIPE_BY_ID['recipe_'+id];await openItem(id);await page.locator('#itemCraft:enabled').waitFor({timeout:10000});await page.locator('#itemCraft').click();
  await page.waitForTimeout(1500);row.opening=await page.evaluate(()=>{const s=window.islandInspect();return {scene:s.scene,actor:s.actor,roomClaims:s.roomClaims,now:s.now,serverCraft:s.serverCraft,toast:document.querySelector("#toast")?.textContent}});await progress();await page.waitForFunction(()=>!!window.islandInspect?.().roomGame,null,{timeout:180000});
  const ticket=(await current()).actions.active;assert.equal(ticket.recipeId,r.id);assert.deepEqual(ticket.recipeContract.cost,r.cost);assert(!ticket.practice);
  if(await page.locator('[data-action="start"]:visible').isVisible())await page.locator('[data-action="start"]').click();
  const result=await solve(resume),claim=page.locator('[data-action="claim"]:enabled,.activity-finish:enabled');await claim.waitFor({timeout:20000});await page.waitForFunction(()=>!window.islandInspect().serverCraft.settling,null,{timeout:30000});await claim.click();
  await page.waitForFunction(()=>!window.islandInspect().serverCraft.active,null,{timeout:30000});
  const d=await current(),receipts=d.actions.receipts.filter(v=>v.ticket?.requestId===ticket.requestId&&v.outcome==='finished');assert.equal(receipts.length,1);assert.deepEqual(receipts[0].cost,r.cost);assert.deepEqual(receipts[0].gain,{[id]:1});
  row.crafts.push({id,requestId:ticket.requestId,cost:receipts[0].cost,gain:receipts[0].gain,result,repairForNaturalNpcUse:repair});await progress();console.log(theme+' crafted '+id+' ('+row.crafts.length+')');
 }
 async function ensure(id,n,depth=0){assert(depth<8);let d=await current(),qty=d.state.inventory[id]||0;while(qty<n){assert(row.crafts.length<35,'NPC consumption prevents chain completion');const r=RECIPE_BY_ID['recipe_'+id];assert(r,'raw fixture exhausted '+id);for(const [part,count]of Object.entries(r.cost))await ensure(part,count,depth+1);await craft(id,{repair:true});d=await current();qty=d.state.inventory[id]||0;}}
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:'+port+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await page.goto('http://127.0.0.1:'+port+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});
  for(const id of ['c0_7','c7_5','c7_5','c11_4','tea','c1_1','c1_2','c1_3','c1_4','c1_5'])await craft(id);
  for(const [id,n]of Object.entries(RECIPE_BY_ID.recipe_c1_10.cost))await ensure(id,n);
  await craft('c1_10',{resume:true});assert(row.resume?.passed);
  await page.screenshot({path:path.join(out,theme+'-six-tea-box.png')});
  await page.locator('#giftRecipient').selectOption('0');await page.locator('#itemUse:enabled').waitFor();
  const before=await current(),response=page.waitForResponse(r=>r.url().endsWith('/action')&&r.request().method()==='POST'&&r.request().postDataJSON().kind==='personal'&&r.request().postDataJSON().operation==='use');
  await page.locator('#itemUse').click();const used=await response;assert.equal(used.status(),200);const body=await used.json();assert(body.receipt.details.ok);await page.locator('#itemUse:disabled').waitFor();
  const gifted=await current(),gift=gifted.state.giftLog.at(-1);assert.equal(gift.item,'c1_10');assert.equal(gift.npcId,0);assert.equal(gift.affinity,4);assert.equal(gifted.state.inventory.c1_10,before.state.inventory.c1_10-1);
  row.gift={item:gift.item,npcId:gift.npcId,affinity:gift.affinity,stockBefore:before.state.inventory.c1_10,stockAfter:gifted.state.inventory.c1_10};
  await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:45000});const reloaded=await current();assert.deepEqual(reloaded.state.giftLog,gifted.state.giftLog);assert.equal(reloaded.state.inventory.c1_10,gifted.state.inventory.c1_10);
  for(const c of row.crafts)assert.equal(reloaded.actions.receipts.filter(r=>r.ticket?.requestId===c.requestId&&r.outcome==='finished').length,1);
  row.gift.reloaded=true;await page.screenshot({path:path.join(out,theme+'-after-gift-reload.png')});await Promise.all(pending);assert(row.actions.every(a=>a.status===200));assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;await progress();console.log(theme+' complete native production, resume and gift passed');
 }catch(e){row.failure=e.stack;row.last=await page.evaluate(()=>{const s=window.islandInspect?.();return s&&{scene:s.scene,sceneBuilding:s.sceneBuilding,actor:s.actor,roomClaims:s.roomClaims,roomGame:s.roomGame,serverCraft:s.serverCraft,now:s.now,serverResident:s.serverResident,save:s.save,toast:document.querySelector("#toast")?.textContent}}).catch(()=>null);await progress();await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});throw e;}
}
try{browser=await chromium.launch(browserLaunchOptions());const results=await Promise.allSettled(['pixel','origami'].map(run));for(const r of results)if(r.status==='rejected')throw r.reason;report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{for(const s of sessions){await s.context.close().catch(()=>{});if(s.server.exitCode===null){const ended=new Promise(r=>s.server.once('close',r));s.server.kill();await ended;}}await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,crafts:c.crafts.length,failure:c.failure}))}));}
