import{chromium}from'playwright-core';import{spawn}from'node:child_process';import{createServer}from'node:net';import{mkdir,mkdtemp,writeFile}from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';import{browserLaunchOptions}from'./browserRuntime.mjs';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v119/map-browser');await mkdir(out,{recursive:true});const dir=await mkdtemp(path.join(out,'isolated-')),probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme=pixel'],{windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs')}});let browser;const report={scope:'Isolated native Edge terrain renderer at actual zoom and DPR. Both styles, all 26 assets, worker fallback, seam coverage, theme disposal, cached frame stability, and the same terrain in the overview. No user saves or model calls.',cases:[]};
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(browserLaunchOptions());const context=await browser.newContext({viewport:{width:1536,height:1024}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/__terrain_review',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><html><body style="margin:0;background:#1684ae;overflow:hidden"><canvas id="map"></canvas><script type="module">
 import{drawTerrainTiles,terrainTileStatus}from'/src/mapTiles.js';import{drawIslandRaster}from'/src/rasterQuality.js';import{terrainTiles}from'/src/mapTileLayout.js';
 const c=document.getElementById('map'),ctx=c.getContext('2d'),images={},sea={};
 for(const theme of ['pixel','origami']){images[theme]=new Image();images[theme].src='/assets/island-'+theme+'-v9.png';sea[theme]=new Image();sea[theme].src='/assets/sea-'+theme+'-v5.png';}
 await Promise.all(Object.values({...images,pixelSea:sea.pixel,origamiSea:sea.origami}).map(i=>i.decode()));
 let config={theme:'pixel',scale:1.5,x:0,y:0,w:2304,h:1536,tiles:true},lastUsed=false;
 window.configure=value=>{config={...config,...value};c.width=config.w;c.height=config.h;c.style.width=config.w+'px';c.style.height=config.h+'px';};window.configure({});
 function frame(){const {theme,scale,x,y,tiles}=config;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.setTransform(scale,0,0,scale,-x*scale,-y*scale);ctx.imageSmoothingEnabled=theme!=='pixel';ctx.drawImage(sea[theme],0,0,1856,1248);lastUsed=tiles&&drawTerrainTiles(ctx,theme);if(!lastUsed)drawIslandRaster(ctx,images[theme],theme,{width:1536,height:1024},0,0,1536,1024);requestAnimationFrame(frame);}frame();
 window.review=()=>({status:terrainTileStatus(),config,lastUsed});window.pixelAt=(x,y)=>[...ctx.getImageData(x,y,1,1).data];
 </script></body></html>`}));
 await page.goto(base+'/__terrain_review');await page.waitForFunction(()=>window.review);
 for(const theme of ['pixel','origami']){
  await page.setViewportSize({width:2304,height:1536});await page.evaluate(theme=>window.configure({theme,scale:1.5,x:0,y:0,w:2304,h:1536,tiles:true}),theme);
  await page.waitForFunction(theme=>{const s=window.review();return s.lastUsed&&s.status.theme===theme&&s.status.ready.length===13&&s.status.pending===0;},theme,{timeout:120000});
  const status=await page.evaluate(()=>window.review().status);assert.equal(status.theme,theme);assert.equal(status.ready.length,13);assert.equal(status.failed.length,0);assert(status.bytes<=status.limitBytes);assert(status.ready.every(id=>id.startsWith(theme)));await page.screenshot({path:path.join(out,theme+'-full-tiles.png')});
  const before=status.redraws;await page.waitForTimeout(300);assert.equal((await page.evaluate(()=>window.review().status)).redraws,before,'static frames reuse composed terrain');
  for(const [name,x,y] of [['forest',140,100],['plaza-seam',560,270],['mine',1070,0],['farm-seam',190,555],['south-east',1040,650]]){
   await page.setViewportSize({width:1440,height:960});await page.evaluate(({x,y})=>window.configure({scale:3,x,y,w:1440,h:960}),{x,y});await page.waitForTimeout(250);await page.screenshot({path:path.join(out,theme+'-zoom3-'+name+'.png')});const s=await page.evaluate(()=>window.review());assert(s.lastUsed);assert(s.status.visible.length<13);
  }
  await page.evaluate(()=>window.configure({scale:.75,x:0,y:0,w:1440,h:960}));await page.waitForTimeout(100);assert.equal((await page.evaluate(()=>window.review())).lastUsed,true,'overview uses the same painted tiles');await page.screenshot({path:path.join(out,theme+'-overview.png')});
  report.cases.push({theme,ready:status.ready.length,bytes:status.bytes,staticRedraws:0,panViews:5,passed:true});console.log(theme+' all tiles / zoom / pan passed');
 }
 // Deliberately reject one high resolution tile; the lower resolution tile remains complete and useful.
 await context.route('**/map-tiles-v119/pixel-1-1.png',r=>r.fulfill({status:503,body:'unavailable'}));await page.evaluate(()=>window.configure({theme:'pixel',scale:3,x:384,y:384,w:1440,h:960}));
 await page.waitForFunction(()=>{const s=window.review();return s.lastUsed&&s.status.pending===0&&s.status.failed.includes('pixel-1-1');},null,{timeout:120000});report.fallback=await page.evaluate(()=>window.review().status);assert(report.fallback.preview.includes('pixel-1-1'));await page.screenshot({path:path.join(out,'missing-tile-fallback.png')});assert.deepEqual(errors,[]);report.errors=errors;
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();if(server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill();await closed;}await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
