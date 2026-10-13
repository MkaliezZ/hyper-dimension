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
import {RAW_MATERIALS,RECIPE_BY_ID} from '../src/contentCatalog.js';
import {SLOTS} from '../src/world.js';
import {chooseAction} from './v19-play-helpers.mjs';
import {kitchenTarget,kitchenCutsRequired} from '../src/kitchenCutting.js';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v176/native-season-recipes');await mkdir(out,{recursive:true});
const availableItems=['season_pea_soup','season_cucumber_cooler','season_blueberry_tart'];
const items=process.env.HD_QA_ITEMS?process.env.HD_QA_ITEMS.split(',').filter(id=>availableItems.includes(id)):availableItems;assert(items.length,'at least one recognized seasonal recipe is required');
const report={scope:'Real protected-save crafts, two themes with pre-unlocked production and prepared raw-material fixtures. Native mouse/keyboard controls guided by legal puzzle solutions and current jobs, ordinary clock, authoritative server replay and exactly one claim after reload. No injected game outcomes or in-game inventory changes, no user data or paid models. Not a zero-start or human difficulty assessment.',cases:[]};let browser;
async function run(theme){
 const row={theme,errors:[],badAssets:[],crafts:[],actions:[]};report.cases.push(row);const dir=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(dir,'saves')}),state=hydrateTown(createZeroState());state.freshStartPending=false;state.player={...SLOTS[2].entry};state.research={};state.shopfronts={version:1,revision:0,venues:{}};
 for(const raw of RAW_MATERIALS)state.inventory[raw.id]=100;
 for(let id=0;id<25;id++){state.research[id]=10;state.facilities[id].quality=75;state.facilities[id].upgrades=2;state.shopfronts.venues[id]=[];}
 for(let id=0;id<16;id++)Object.assign(needs(id,state),{hunger:100,energy:100,social:100});for(const item of items)assert.equal(state.inventory[item]||0,0);await store.open(theme,{legacyState:state,protect:true});
 const probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme='+theme],{windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs')}}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),base='http://127.0.0.1:'+port,pending=[];
 page.on('pageerror',e=>row.errors.push(e.message));page.on('response',r=>{if(r.url().includes('/assets/')&&r.status()>=400)row.badAssets.push(r.url());if(r.url().endsWith('/action')&&r.request().method()==='POST'){const q=r.request().postDataJSON();if(q.kind==='craft')pending.push(r.json().then(v=>row.actions.push({operation:q.operation,status:r.status(),code:v.code||null,requestId:q.requestId})));}});
 await context.route('**/api/**',r=>/\/api\/(saves\/|status$|world\/)/.test(r.request().url())?r.continue():r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated season recipe QA: no model requests"}'}));
 const current=()=>store.current(theme),inspect=()=>page.evaluate(()=>window.islandInspect().roomGame),progress=()=>writeFile(path.join(out,theme+'-progress.json'),JSON.stringify(row,null,2));
 async function openItem(item){if(await page.locator('#closeModal').isVisible())await page.locator('#closeModal').click();await page.locator('#bagBtn').click();await page.locator('#bagFilter').selectOption('all');await page.locator('[data-item="'+item+'"]').click();}
 async function nativeAction(a,g,craft){
  if(a.type==='cut'){
   const target=kitchenTarget(g),j=target.job,id=g.level.ids[j.ingredients[target.index]];assert.notEqual(id,'seasalt');craft.cutIngredients.push(id);
   if(craft.mouseCuts<2){const box=await page.locator('.wk-canvas').boundingBox(),v=box.width<600?{x:337,y:200,w:290,h:245}:{x:0,y:0,w:960,h:540},pos=y=>({x:box.x+(target.x-v.x)/v.w*box.width,y:box.y+(y-v.y)/v.h*box.height}),start=pos(286),end=pos(356);await page.mouse.move(start.x,start.y);await page.mouse.down();await page.waitForTimeout(100);await page.mouse.move(end.x,end.y,{steps:4});await page.mouse.up();craft.mouseCuts++;}else{await page.keyboard.press('Space');craft.keyboardCuts++;}
   await page.waitForTimeout(65);const after=await inspect();assert.equal(after.jobs[j.id].cuts,j.cuts+1,'native cut was not accepted');return;
  }
  let selector='[data-action="'+a.type+'"]';if(a.type==='cell'||a.type==='place')selector='.wk-hit[data-cell="'+a.index+'"]';else if(a.value!==undefined)selector+='[data-value="'+a.value+'"]';else if(a.index!==undefined)selector+='[data-index="'+a.index+'"]';else if(a.station!==undefined)selector+='[data-station="'+a.station+'"]';await page.locator(selector+':visible').click();craft.nativeInputs++;
 }
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  await page.goto(base+'/?qa=1&theme='+theme);await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!window.islandInspect().startup.busy,null,{timeout:60000});
  for(const item of items){const recipe=RECIPE_BY_ID['recipe_'+item],craft={item,kind:null,mouseCuts:0,keyboardCuts:0,nativeInputs:0,cutIngredients:[]};row.crafts.push(craft);await openItem(item);await page.locator('#itemCraft:enabled').click();await page.waitForFunction(id=>window.islandInspect?.().roomGame?.id===id&&window.islandInspect().roomGame.loaded,recipe.building,{timeout:180000});
   const ticket=(await current()).actions.active;assert.equal(ticket.recipeId,recipe.id);assert.equal(ticket.practice,false);craft.requestId=ticket.requestId;craft.acceptedCost=ticket.recipeContract.cost;assert.deepEqual(craft.acceptedCost,recipe.cost);
   const initial=await inspect();craft.kind=initial.kind;if(craft.kind==='joinery'){const text=await page.locator('#roomGameRoot').innerText();assert(!text.includes('零件'),'season baking must not use woodwork part labels');assert(text.includes('摆放点心'));craft.bakeryLabels=true;}assert.equal(initial.level.production.item,item);assert.deepEqual(initial.level.production.ingredients.map(i=>i.id).sort(),Object.keys(recipe.cost).sort());if(item==='season_pea_soup')assert.equal(initial.level.production.cutCounts.seasalt,0);
   craft.embedded=await page.locator('#roomGameRoot .workshop-game.wk-embedded').count()===1;assert(craft.embedded);assert.equal(new URL(page.url()).pathname,'/');
   craft.nativeArtwork=await page.evaluate(async({theme,item,cost})=>{const {itemFrame}=await import('/src/artStore.js');const rows=[];for(const id of [item,...Object.keys(cost)]){const f=itemFrame(id,theme);await f.img.decode();rows.push({id,file:f.file,frame:f.frame,ready:f.img.complete&&f.img.naturalWidth>0});}return rows;},{theme,item,cost:recipe.cost});assert(craft.nativeArtwork.every(a=>a.ready));assert(craft.nativeArtwork.some(a=>a.id===item&&a.file==='items-season-'+theme+'-food-v176.png'),'season food must use newly generated artwork');
   await page.screenshot({path:path.join(out,theme+'-'+item+'-ready.png')});await page.locator('[data-action="start"]:enabled').click();let recordedPlaying=false;
   for(let tries=0;tries<1800;tries++){
    const g=await inspect();if(g.phase==='result'){assert(g.result.passed,'normal-clock game failed');craft.result=g.result;if(g.kind==='kitchen'){craft.completedCuts=g.jobs.filter(j=>j.state==='served').map(j=>({id:j.id,cuts:j.cuts,required:kitchenCutsRequired(g,j)}));assert(craft.completedCuts.length>=g.level.quota);assert(craft.completedCuts.every(j=>j.cuts===4&&j.required===4));}break;}
    if(g.paused){await page.locator('[data-action="resume"]:visible').click();continue;}
    if(g.phase==='playing'&&!g.busy){const a=chooseAction(g);if(a){if(a.type==='cut'&&g.t-g.lastCut<.41){await page.waitForTimeout(90);continue;}await nativeAction(a,g,craft);}}
    if(!recordedPlaying&&g.phase==='playing'&&(g.kind!=='kitchen'||g.jobs.some(j=>j.cuts>=1))){await page.screenshot({path:path.join(out,theme+'-'+item+'-playing.png')});recordedPlaying=true;}
    await page.waitForTimeout(g.kind==='kitchen'?70:100);
   }
   assert(craft.result?.passed,'native game did not finish');await page.locator('[data-action="claim"]:enabled').waitFor({timeout:30000});craft.rewardButton=await page.locator('[data-action="claim"]').evaluate(el=>{const r=el.getBoundingClientRect();return {text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height,visible:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};});assert(craft.rewardButton.visible);assert(craft.rewardButton.w>=90&&craft.rewardButton.h>=32);await page.waitForFunction(()=>{const el=document.querySelector('.wk-session-dialog .wk-result-card');return el&&Number(getComputedStyle(el).opacity)>=.99;});await page.screenshot({path:path.join(out,theme+'-'+item+'-result.png'),animations:'disabled'});await page.locator('[data-action="claim"]:enabled').click();await page.waitForFunction(()=>!window.islandInspect().serverCraft.active,null,{timeout:30000});
   let saved=await current(),receipts=saved.actions.receipts.filter(r=>r.ticket?.requestId===ticket.requestId&&r.outcome==='finished');assert.equal(receipts.length,1);assert.deepEqual(receipts[0].cost,recipe.cost);assert.deepEqual(receipts[0].gain,{[item]:1});assert.equal(saved.state.inventory[item],1);craft.receipt={cost:receipts[0].cost,gain:receipts[0].gain};
   await page.reload();await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready&&!window.islandInspect().startup.busy,null,{timeout:60000});saved=await current();assert.equal(saved.state.inventory[item],1);assert.equal(saved.actions.receipts.filter(r=>r.ticket?.requestId===ticket.requestId&&r.outcome==='finished').length,1);assert.equal(await page.locator('[data-action="claim"]:visible').count(),0);craft.refreshNoSecondClaim=true;await openItem(item);await page.screenshot({path:path.join(out,theme+'-'+item+'-inventory.png')});craft.passed=true;await progress();console.log(theme+' '+item+' passed native recipe + one receipt + reload');
  }
  await Promise.all(pending);assert(row.actions.every(a=>a.status===200),JSON.stringify(row.actions.filter(a=>a.status!==200)));assert.deepEqual(row.errors,[]);assert.deepEqual(row.badAssets,[]);row.passed=true;
 }catch(e){row.failure=e.stack;row.last=await page.evaluate(()=>({game:window.islandInspect?.().roomGame,craft:window.islandInspect?.().serverCraft,scene:window.islandInspect?.().scene})).catch(()=>null);await page.screenshot({path:path.join(out,theme+'-failure.png')}).catch(()=>{});await progress();throw e;}
 finally{await context.close();if(server.exitCode===null){const stopped=new Promise(r=>server.once('close',r));server.kill();await stopped;}}
}
try{browser=await chromium.launch(browserLaunchOptions());const results=await Promise.allSettled(['pixel','origami'].map(run));for(const r of results)if(r.status==='rejected')throw r.reason;report.passed=true;}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(c=>({theme:c.theme,passed:c.passed,completed:c.crafts.filter(r=>r.passed).map(r=>r.item),failure:c.failure}))}));}
