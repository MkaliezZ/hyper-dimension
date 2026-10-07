import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),report=[];
try{for(const theme of ['pixel','origami']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',r=>r.fulfill({status:503,body:'{"error":"isolated QA"}',contentType:'application/json'}));
 const info=()=>page.evaluate(()=>arcadeInspect());
 const open=async id=>{await page.goto('http://127.0.0.1:4174/src/arcade.html?qa=1&theme='+theme+'&game='+id+'&seed=731&difficulty=2');await page.locator('[data-action="start"]:enabled').click();};
 // Real mouse hold deforms the live clay; releasing stops deformation.
 await open(15);
 const box=await page.locator('.wk-canvas').boundingBox(),point=(x,y)=>({x:box.x+x/960*box.width,y:box.y+y/540*box.height});
 let before=await info(),p=point(480+before.level.target[5],125+5/11*270);
 await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(500);
 let after=await info();assert.ok(after.radii[5]<before.radii[5]-4);await page.mouse.up();
 assert.equal((await info()).holding,false);before=await info();await page.waitForTimeout(200);assert.equal((await info()).radii[5],before.radii[5]);
 await page.locator('[data-action="pause"]').click();before=await info();await page.waitForTimeout(250);assert.equal((await info()).t,before.t);
 await page.locator('[data-action="resume"]').click();await page.waitForTimeout(100);assert.ok((await info()).t>before.t);
 const muteBefore=await page.locator('[data-action="sound"]').getAttribute('aria-pressed');await page.locator('[data-action="sound"]').click();assert.notEqual(await page.locator('[data-action="sound"]').getAttribute('aria-pressed'),muteBefore);
 await page.screenshot({path:'qa/v19/native-pottery-'+theme+'.png'});
 // Native mouse capture releases even when the cursor leaves the stage.
 await open(20);const b=await page.locator('.wk-canvas').boundingBox();
 await page.mouse.move(b.x+b.width*.63,b.y+b.height*.28);await page.mouse.down();await page.waitForTimeout(600);assert.ok((await info()).charge>.2);
 await page.mouse.move(b.x+b.width+14,b.y+b.height*.6);await page.mouse.up();assert.ok((await info()).projectile);assert.equal((await info()).holding,false);
 await page.keyboard.press('Space');assert.equal((await info()).projectile,null);
 // Hidden tabs automatically pause time without a hidden-window penalty.
 await open(12);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));before=await info();assert.equal(before.paused,true);await page.waitForTimeout(200);assert.equal((await info()).t,before.t);await page.locator('[data-action="resume"]').click();
 // A native grid cell click must map to the same logical cell at phone width.
 await open(5);await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
 const target=await page.locator('[data-cell="0"]').boundingBox();assert.ok(target.width>=35,'phone grid touch target');await page.locator('[data-cell="0"]').click();assert.equal((await info()).cells[0],1);
 await page.locator('[data-action="mark"]').click();await page.locator('[data-cell="1"]').click();assert.equal((await info()).cells[1],-1);
 await page.screenshot({path:'qa/v19/native-mobile-'+theme+'.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 const oldSeed=(await info()).level.seed;await page.locator('[data-action="difficulty"][data-mode="3"]').click();after=await info();assert.equal(after.phase,'intro');assert.equal(after.level.d,3);assert.notEqual(after.level.seed,oldSeed);
 assert.deepEqual(errors,[]);report.push({theme,nativeClayDeformation:true,releaseOutsideStage:true,pauseFreezesTime:true,mutePersists:true,phoneCellTarget:Math.round(target.width),markEmpty:true,newSeedOnDifficulty:true,errors});await page.close();
}}finally{await browser.close()}
await writeFile('qa/v19/native-input.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
