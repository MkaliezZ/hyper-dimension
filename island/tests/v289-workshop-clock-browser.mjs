import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const root=resolve(process.env.HD_QA_ROOT||'.'),out=resolve(process.env.HD_QA_OUT||'qa/v289/workshop-clock');
await mkdir(out,{recursive:true});
const {chromium}=createRequire(join(root,'package.json'))('playwright-core');
const load=name=>import(pathToFileURL(join(root,name)));
const {browserLaunchOptions}=await load('tests/browserRuntime.mjs');
const {chooseAction}=await load('tests/v19-play-helpers.mjs');
const {createCraftGame,applyCraftTrace,craftResult}=await load('src/craftGameReplay.js');
const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><head><link rel="stylesheet" href="/src/games-v19.css"><link rel="stylesheet" href="/src/games-v20.css"></head><body data-theme="pixel"><main id="root"></main></body>');return;}
 if(!/^\/(src|assets)\//.test(url.pathname)){res.writeHead(404).end();return;}
 const file=resolve(root,(url.pathname.startsWith('/assets/')?'public/':'.')+decodeURIComponent(url.pathname));
 assert(file.startsWith(root+sep));res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const report={scope:'Native component regression at declared 1.5 delivered RAF callbacks/sec, real wall time and actual pointer inputs in both styles. No game state, clock, score, resource or outcome injection. Original 50ms server input limit and replay result must agree. Not full four-island, hardware Mac or human acceptance.',cases:[],errors:[],passed:false};
let browser;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const theme of ['pixel','origami']){
  const row={theme,deliveredRafPerSecond:1.5,passed:false};report.cases.push(row);
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(()=>{const native=requestAnimationFrame.bind(window),last=new WeakMap();window.requestAnimationFrame=callback=>{const deliver=at=>{if(at>=(window.clockHoldUntil||0)&&at-(last.get(callback)??-Infinity)>=1000/1.5){last.set(callback,at);callback(at);}else native(deliver);};return native(deliver);};});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/?theme='+theme);
   await page.evaluate(async theme=>{const {mountWorkshopGame}=await import('/src/workshopGames.js');document.body.dataset.theme=theme;window.clockTrace=[];window.clockClaims=0;window.clockGame=mountWorkshopGame(document.getElementById('root'),1,()=>{window.clockClaims++;return true;},{standalone:true,theme,level:{id:1,seed:2995467447,difficulty:1},onGameEvent:event=>clockTrace.push(structuredClone(event))});},theme);
   await page.waitForFunction(()=>clockGame.inspect().loaded,null,{polling:100,timeout:30000});
   await page.locator('[data-action="start"]').click();
   const started=Date.now();await page.waitForTimeout(7000);
   const state=await page.evaluate(()=>clockGame.inspect());
   row.visibleClock={wallSeconds:(Date.now()-started)/1000,gameSeconds:state.t,previewSeconds:state.level.preview,paused:state.paused};
   assert(state.t>=6,'Seven visible wall seconds must advance at least six game seconds under slow delivered frames');
   assert(state.t<=row.visibleClock.wallSeconds+.15,'No simulated time may be invented');
   assert(state.t>=state.level.preview,'The actual four-second tea preview must end');
   const pause=await page.evaluate(()=>{clockGame.setTransportPaused(true);return clockGame.inspect().t;});
   await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>clockGame.inspect().t),pause);
   await page.evaluate(()=>clockGame.setTransportPaused(false));await page.waitForTimeout(1300);
   const resumed=await page.evaluate(()=>clockGame.inspect().t);assert(resumed>pause+.5&&resumed<pause+1.5,'Transport pause must not accumulate hidden catch-up time');
   await page.locator('[data-action="pause"]').click();const userPause=await page.evaluate(()=>clockGame.inspect().t);await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>clockGame.inspect().t),userPause);await page.locator('[data-action="resume"]').click();
   const budget=Date.now()+50000;
   while(Date.now()<budget){const game=await page.evaluate(()=>clockGame.inspect());if(game.phase==='result')break;assert.equal(game.paused,false);const action=chooseAction(game);if(action?.type==='cell')await page.locator('[data-cell="'+action.index+'"]').click();await page.waitForTimeout(90);}
   const final=await page.evaluate(()=>({game:clockGame.inspect(),trace:clockTrace}));
   assert(final.game.result?.passed,'The actual pointer-input challenge must finish');
   assert(final.trace.every(e=>!Object.hasOwn(e,'dt')||e.dt>=0&&e.dt<=.050000001),'All server-authorized input steps retain the original 50ms ceiling');
   const replay=createCraftGame(1,2995467447,1);
   for(let i=0;i<final.trace.length;i+=2048)applyCraftTrace(replay,final.trace.slice(i,i+2048));
   assert.deepEqual(craftResult(replay),final.game.result,'Canonical replay must reproduce the exact native result');
   await page.screenshot({path:join(out,theme+'-result.png')});await page.locator('[data-action="claim"]').click();await page.waitForFunction(()=>clockClaims===1,null,{polling:100});
   row.result=final.game.result;row.replayExact=true;row.transportAndUserPauseFreeze=true;row.inputEvents=final.trace.length;
   // Deliberately withhold RAF delivery, without blocking JS, changing the
   // simulation clock or touching the live game state. Long interruptions
   // must pause rather than silently charging the player unseen game time.
   await page.evaluate(async theme=>{const {mountWorkshopGame}=await import('/src/workshopGames.js');window.clockGame=mountWorkshopGame(document.getElementById('root'),1,()=>{throw Error('Interrupted unfinished game cannot claim');},{standalone:true,theme,level:{id:1,seed:2995467447,difficulty:1}});},theme);
   await page.waitForFunction(()=>clockGame.inspect().loaded,null,{polling:100});
   await page.locator('[data-action="start"]').click();
   await page.evaluate(()=>{window.clockHoldUntil=performance.now()+2700;});
   await page.waitForFunction(()=>clockGame.inspect().paused,null,{polling:100,timeout:6000});
   const interrupted=await page.evaluate(()=>clockGame.inspect());assert(interrupted.t<1);assert.equal(interrupted.result,null);
   await page.waitForTimeout(1100);assert.equal(await page.evaluate(()=>clockGame.inspect().t),interrupted.t);
   await page.locator('[data-action="resume"]').click();await page.waitForTimeout(1400);
   const continued=await page.evaluate(()=>clockGame.inspect());assert.equal(continued.paused,false);assert(continued.t>interrupted.t+.5&&continued.t<interrupted.t+1.6);
   row.longInterruptionPausesWithoutCharge=true;row.passed=true;
  }catch(error){row.failure=error.stack;row.last=await page.evaluate(()=>clockGame?.inspect()).catch(()=>null);await page.screenshot({path:join(out,theme+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.length===2&&report.cases.every(c=>c.passed)&&report.errors.length===0;
 if(!report.passed)process.exitCode=1;
}finally{await browser?.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,passed,visibleClock,failure})=>({theme,passed,visibleClock,failure}))}));}
