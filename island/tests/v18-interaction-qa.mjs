import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createState} from '../src/world.js';
import {hydrateTown} from '../src/townSimulation.js';
import {CATALOG_ITEMS} from '../src/contentCatalog.js';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),report=[];
try{
 for(const [port,theme] of [[4173,'pixel'],[4174,'origami']]){
  const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"QA offline"}'}));
  const fixture=hydrateTown(createState());for(const i of CATALOG_ITEMS)fixture.inventory[i.id]=99;
  await page.addInitScript(([theme,fixture])=>{const key='hyper-dimension-'+theme+'-v3';if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(fixture));},[theme,fixture]);
  await page.goto('http://127.0.0.1:'+port+'/?qa=1');
  await page.evaluate(async()=>{
   const {mountRoomGame}=await import('/src/roomGames.js'),{makeLevel}=await import('/src/gameLevels.js'),{artReady}=await import('/src/artStore.js');await artReady;
   window.qaRules=await import('/src/classicRules.js');
   const root=document.createElement('div');root.id='qaGame';root.style='position:fixed;inset:15px 310px;overflow:auto;padding:20px;background:var(--ui-paper);z-index:999';document.body.append(root);
   window.qaMount=(id,difficulty=1,shortTimer=false)=>{
    window.qaInstance?.destroy();window.qaReceiptCount=0;window.qaOutcomes=[];
    const level=makeLevel(id,{seed:4123,difficulty});if(shortTimer)level.link.seconds=.25;
    window.qaInstance=mountRoomGame(root,id,()=>window.qaReceiptCount++,{level,onOutcome:r=>qaOutcomes.push(r)});
   };
  });
  const info=()=>page.evaluate(()=>qaInstance.inspect()),cell=i=>page.locator('#qaGame [data-cell="'+i+'"]');
  // A real swipe starts one move; pause freezes the animation clock and queue.
  await page.evaluate(()=>qaMount(3));let before=await info(),move=await page.evaluate(()=>qaRules.suggestMatchMove(qaInstance.inspect()));
  const a=await cell(move[0]).boundingBox(),b=await cell(move[1]).boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:5});await page.mouse.up();
  assert.equal((await info()).moves,before.moves-1);await page.locator('#qaGame [data-session=pause]').click();
  before=await info();await page.waitForTimeout(350);assert.equal((await info()).t,before.t);
  await page.locator('#qaGame [data-session=pause]').click();await page.waitForFunction(()=>!qaInstance.inspect().busy);
  assert.ok((await info()).performance.events>0);assert.equal(await page.evaluate(()=>qaReceiptCount),0);
  // Destroy in the middle of an effect cancels all presentation callbacks/rewards.
  move=await page.evaluate(()=>qaRules.suggestMatchMove(qaInstance.inspect()));await cell(move[0]).click();await cell(move[1]).click();
  await page.evaluate(()=>qaInstance.destroy());await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>qaReceiptCount),0);
  // Failure -> fresh board, then an explicit difficulty choice -> a fresh larger board.
  await page.evaluate(()=>qaMount(7,1,true));await cell(0).click();await page.waitForFunction(()=>qaInstance.inspect().done);
  assert.equal(await page.evaluate(()=>qaOutcomes[0]?.passed),false);assert.equal(await page.evaluate(()=>qaReceiptCount),0);
  const seed=(await info()).level.seed;await page.locator('#qaGame').getByRole('button',{name:'再来一局',exact:true}).click();
  assert.notEqual((await info()).level.seed,seed);assert.equal((await info()).done,false);
  await page.locator('#qaGame [data-difficulty="3"]').click();assert.equal((await info()).level.difficulty,3);assert.equal((await info()).values.length,36);
  // Completing and clicking an old detached claim button cannot duplicate a reward.
  await page.evaluate(()=>qaMount(18));await page.locator('#qaGame [data-action="start"]:enabled').click();let s=await info();
  for(let i=0;i<s.order.length;i++){s=await info();if(s.order[i]!==i){await cell(i).click();await cell(s.order.indexOf(i)).click();}}
  assert.equal((await info()).phase,'celebrating');assert.equal(await page.locator('#qaGame [data-action="claim"]').count(),0);
  await page.locator('#qaGame [data-action="claim"]').waitFor();await page.evaluate(()=>window.oldClaim=document.querySelector('#qaGame [data-action="claim"]'));
  await page.locator('#qaGame [data-action="claim"]').click();await page.evaluate(()=>oldClaim.click());
  assert.equal(await page.evaluate(()=>qaReceiptCount),1);assert.equal(await page.evaluate(()=>qaOutcomes.length),1);
  await page.evaluate(()=>{qaInstance.destroy();document.querySelector('#qaGame').remove()});
  await page.evaluate(()=>localStorage.clear());await page.reload();
  // Open the actual building flow and inspect both desktop and phone popups.
  const building=theme==='pixel'?3:7,item=theme==='pixel'?'bouquet':'book';
  await page.locator('#recipesBtn').click();await page.locator('#recipeBuilding').selectOption(String(building));
  await page.locator('[data-recipe]').first().click();await page.locator('#itemCraft').click();try{await page.locator('.room-game').waitFor({timeout:20000})}catch(e){console.log('arrival diagnostic',theme,await page.evaluate(()=>{const s=islandInspect();return {scene:s.scene,building:s.sceneBuilding,actor:s.actor,claims:s.roomClaims,toast:document.querySelector('#toast').textContent,modal:document.querySelector('.modal')?.innerText}}));throw e;}
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===390?844:950});
   const header=await page.locator('#closeModal').boundingBox();
   await page.locator('.modal-body').evaluate(e=>e.scrollTop=e.scrollHeight);await page.waitForTimeout(80);
   const after=await page.locator('#closeModal').boundingBox();assert.equal(Math.round(after.y),Math.round(header.y));
   const overflow=await page.locator('.modal-body').evaluate(el=>el.scrollWidth>el.clientWidth+2);assert.equal(overflow,false,'no horizontal scrolling '+theme+' '+width);
   await page.locator('.classic-board').scrollIntoViewIfNeeded();
   await page.screenshot({path:'qa/v18-game-'+theme+'-'+width+'.png'});
  }
  await page.locator('#closeModal').click();assert.equal(await page.locator('.room-game').count(),0);assert.deepEqual(errors,[]);
  report.push({theme,swipe:true,pause:true,cancelDuringAnimation:true,retryNewSeed:true,difficultyChoice:true,singleReceipt:true,actualPopupWidths:[1440,390],errors});await page.close();
 }
 await writeFile('qa/v18-interaction-qa.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
