import assert from 'node:assert/strict';import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';import{resolve,join}from'node:path';
import{chromium}from'playwright-core';import{browserLaunchOptions}from'./browserRuntime.mjs';import{createLanHttpServer}from'../server/lanServer.mjs';
const out=resolve(process.env.HD_QA_OUT||'qa/v125/native-preview');await mkdir(out,{recursive:true});process.env.DEEPSEEK_API_KEY='';const directory=await mkdtemp(join(out,'data-'));
const server=await createLanHttpServer({directory,port:0,enrollmentKey:'PREVIEW-QA'}),base='http://127.0.0.1:'+server.port,report={scope:'Native Edge, isolated play accounts; new tile preview during deferred loading, both appearances, zoom/pan, absent overview cannot block tiles. No real save or external model changes.',cases:[],errors:[]};let browser,page;
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const compatible of [false,true]){
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1.25}),requests=[];
  if(compatible)await context.addInitScript(()=>Object.defineProperty(window,'Worker',{value:undefined,configurable:true}));
  context.on('request',r=>requests.push(new URL(r.url()).pathname));
  await context.route('**/assets/island-*-v9.png',r=>r.fulfill({status:404,body:'legacy map removed'}));
  await context.route('**/api/npc/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated visual fixture"}'}));
  let releaseTiles;const gate=new Promise(r=>releaseTiles=r);
  await context.route('**/assets/map-tiles-v119/*.png',async r=>{await gate;await r.continue();});
  const response=await context.request.post(base+'/api/lan/register',{data:{enrollmentKey:'PREVIEW-QA',login:'preview_'+(compatible?'compatible':'worker'),password:'fixture-password',name:'底图验收',islandName:'底图验收岛',avatar:'female_0',theme:'pixel'}});assert.equal(response.status(),200);
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/play?qa=1');
  await page.waitForFunction(()=>window.islandInspect?.().serverCommerce?.ready,null,{timeout:60000});if(await page.locator('#startFirstDay').count())await page.locator('#startFirstDay').click();
  await page.waitForFunction(()=>{const s=window.islandInspect();return s.rendering.terrain.pending>0&&s.rendering.artwork.failed===0;});
  await page.evaluate(async()=>{const art=await import('/src/themeArtwork.js');await art.activateThemeArtwork('pixel');});
  assert(requests.includes('/assets/map-tiles-v125/pixel-overview.png'),'new preview decoded before high-resolution tiles');
  await page.waitForTimeout(60);
  await page.screenshot({path:join(out,(compatible?'compatible':'worker')+'-initial-preview.png')});releaseTiles();
  for(const theme of ['pixel','origami']){
   if(theme==='origami'){await page.locator('#themeOrigami').click();await page.waitForFunction(()=>window.islandInspect().theme==='origami');}
   await page.locator('#cameraHome').click();await page.waitForFunction(theme=>{const t=window.islandInspect().rendering.terrain;return t.theme===theme&&!t.pending&&t.ready.length===13&&!t.failed.length;},theme,{timeout:60000});
   const overview=await page.evaluate(()=>window.islandInspect());assert.equal(overview.slots.length,25);assert.equal(overview.npcs.length,16);
   await page.screenshot({path:join(out,theme+'-'+(compatible?'compatible':'worker')+'-overview.png')});
   for(let i=0;i<14;i++)await page.locator('#zoomIn').click();await page.waitForFunction(()=>window.islandInspect().zoom>=2.99);
   await page.screenshot({path:join(out,theme+'-'+(compatible?'compatible':'worker')+'-zoom3.png')});
   const camera=await page.evaluate(()=>window.islandInspect().camera);await page.mouse.move(760,540);await page.mouse.down();await page.mouse.move(410,730,{steps:16});await page.mouse.up();
   const panned=await page.evaluate(()=>window.islandInspect());assert(Math.hypot(camera.x-panned.camera.x,camera.y-panned.camera.y)>80);assert(panned.rendering.terrain.bytes<=panned.rendering.terrain.limitBytes);
   assert.equal(panned.rendering.terrain.backend,compatible?'compatible tiles':'worker tiles');report.cases.push({theme,compatible,tiles:panned.rendering.terrain.ready.length,legacyRequests:requests.filter(r=>/^\/assets\/island-.*-v9\.png$/.test(r)),passed:true});
  }
  assert.deepEqual(requests.filter(r=>/^\/assets\/island-.*-v9\.png$/.test(r)),[]);await context.close();
 }
 // The optional preview is unavailable, but all high-resolution tiles must still finish.
 for(const compatible of [false,true]){
  const context=await browser.newContext({viewport:{width:1536,height:1024}});
  if(compatible)await context.addInitScript(()=>Object.defineProperty(window,'Worker',{value:undefined,configurable:true}));
  await context.route('**/assets/map-tiles-v125/*-overview.png',r=>r.fulfill({status:404,body:'optional preview unavailable'}));
  await context.route('**/assets/island-*-v9.png',r=>r.fulfill({status:404,body:'legacy map removed'}));
  await context.route('**/__preview_missing',r=>r.fulfill({contentType:'text/html',body:`<canvas id="map" width="1536" height="1024"></canvas><script type="module">import{drawTerrainTiles,terrainTileStatus}from'/src/mapTiles.js';const ctx=document.getElementById('map').getContext('2d');let theme='pixel',used=false;window.selectTheme=t=>theme=t;window.review=()=>({used,...terrainTileStatus()});function frame(){ctx.clearRect(0,0,1536,1024);used=drawTerrainTiles(ctx,theme);requestAnimationFrame(frame);}frame();</script>`}));
  page=await context.newPage();await page.goto(base+'/__preview_missing');
  for(const theme of ['pixel','origami']){await page.waitForFunction(()=>window.review);await page.evaluate(t=>window.selectTheme(t),theme);await page.waitForFunction(t=>{const s=window.review();return s.used&&s.theme===t&&s.ready.length===13&&!s.pending&&!s.failed.length;},theme,{timeout:60000});report.cases.push({theme,compatible,missingPreview:true,passed:true});}
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.failure=e.stack;await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});process.exitCode=1;console.error(e);}finally{await browser?.close();await server.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
