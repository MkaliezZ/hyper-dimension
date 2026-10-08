import{chromium}from'playwright-core';import{spawn}from'node:child_process';import{createServer}from'node:net';import{mkdir,mkdtemp,writeFile}from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';import{browserLaunchOptions}from'./browserRuntime.mjs';
const out=path.resolve(process.env.HD_QA_OUT||'qa/v122/map-loading');await mkdir(out,{recursive:true});const dir=await mkdtemp(path.join(out,'isolated-')),probe=createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs','--port='+port,'--theme=pixel'],{windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs')}});let browser;const report={scope:'Native Edge, isolated terrain canvas. Actual high-resolution assets with no Worker, no OffscreenCanvas, no createImageBitmap, a crashed worker, transient HTTP failure and a theme switch during loading. No real saves or model calls.',cases:[]};
const html=`<!doctype html><html><body style="margin:0;background:#1684ae;overflow:hidden"><canvas id="map"></canvas><script type="module">
import{drawTerrainTiles,terrainTileStatus}from'/src/mapTiles.js';import{drawIslandRaster}from'/src/rasterQuality.js';
const c=document.getElementById('map'),ctx=c.getContext('2d'),images={},sea={};
for(const t of ['pixel','origami']){images[t]=new Image();images[t].src='/assets/map-tiles-v134/'+t+'-overview.png';sea[t]=new Image();sea[t].src='/assets/sea-'+t+'-v5.png';}
await Promise.all([...Object.values(images),...Object.values(sea)].map(i=>i.decode()));
let cfg={theme:'pixel',scale:1,x:0,y:0},used=false,frames=0,peakPending=0,maxFrameMs=0,last=0;
c.width=1856;c.height=1024;window.configure=v=>{cfg={...cfg,...v};};
function frame(now){if(last)maxFrameMs=Math.max(maxFrameMs,now-last);last=now;frames++;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);ctx.setTransform(cfg.scale,0,0,cfg.scale,-cfg.x*cfg.scale,-cfg.y*cfg.scale);ctx.drawImage(sea[cfg.theme],0,0,1856,1248);used=drawTerrainTiles(ctx,cfg.theme);if(!used)ctx.drawImage(images[cfg.theme],0,0,1856,1024);peakPending=Math.max(peakPending,terrainTileStatus().pending);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.review=()=>({status:terrainTileStatus(),used,frames,peakPending,maxFrameMs});
</script></body></html>`;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch(browserLaunchOptions());
 for(const mode of ['no-worker','no-offscreen','no-bitmap','worker-crash','transient-failure','theme-during-load']){
  const context=await browser.newContext({viewport:{width:1856,height:1024}}),errors=[];
  await context.addInitScript(mode=>{
   if(mode==='no-worker'||mode==='no-bitmap'||mode==='theme-during-load')Object.defineProperty(window,'Worker',{value:undefined,configurable:true});
   if(mode==='no-offscreen')Object.defineProperty(window,'OffscreenCanvas',{value:undefined,configurable:true});
   if(mode==='no-bitmap')Object.defineProperty(window,'createImageBitmap',{value:undefined,configurable:true});
   if(mode==='worker-crash'){const NativeWorker=window.Worker;window.Worker=class extends NativeWorker{constructor(url,options){super(String(url).includes('mapTileWorker')?URL.createObjectURL(new Blob(['throw Error("isolated worker failure")'],{type:'text/javascript'})):url,options);}};}
  },mode);
  await context.route('**/__terrain_loading',r=>r.fulfill({contentType:'text/html',body:html}));
  let attempts=0;
  if(mode==='transient-failure')await context.route('**/map-tiles-v134/pixel-1-1.png',r=>{attempts++;return attempts===1?r.fulfill({status:503,body:'isolated transient failure'}):r.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/__terrain_loading');await page.waitForFunction(()=>window.review);
  if(mode==='theme-during-load'){await page.waitForFunction(()=>window.review().status.pending>0);await page.evaluate(()=>window.configure({theme:'origami'}));}
  const themes=mode==='theme-during-load'?['origami']:['pixel','origami'];
  for(const theme of themes){
   await page.evaluate(theme=>window.configure({theme,scale:1,x:0,y:0}),theme);
   await page.waitForFunction(theme=>{const s=window.review();return s.used&&s.status.theme===theme&&s.status.ready.length===16&&s.status.pending===0&&s.status.failed.length===0;},theme,{timeout:120000});
   const overview=await page.evaluate(()=>window.review());assert.equal(overview.status.ready.length,16);assert(overview.status.ready.every(id=>id.startsWith(theme)));assert(overview.status.bytes<=overview.status.limitBytes);assert(overview.frames>5);assert(overview.peakPending<=2);
   if(mode!=='transient-failure')assert.equal(overview.status.backend,'compatible tiles');
   if(mode==='no-worker')await page.screenshot({path:path.join(out,theme+'-compatible-overview.png')});
   await page.evaluate(()=>window.configure({scale:3,x:560,y:270}));await page.waitForTimeout(120);assert((await page.evaluate(()=>window.review())).used);
   if(mode==='no-worker')await page.screenshot({path:path.join(out,theme+'-compatible-zoom3.png')});
   const before=(await page.evaluate(()=>window.review())).status.redraws;await page.waitForTimeout(120);assert.equal((await page.evaluate(()=>window.review())).status.redraws,before);
   report.cases.push({mode,theme,ready:overview.status.ready.length,backend:overview.status.backend,bytes:overview.status.bytes,framesWhileLoading:overview.frames,peakPending:overview.peakPending,maxFrameMs:overview.maxFrameMs,passed:true});console.log(mode+' / '+theme+' passed');
  }
  if(mode==='transient-failure'){assert.equal(attempts,2);assert((await page.evaluate(()=>window.review())).status.retries>=1);}
  assert.deepEqual(errors,[]);await context.close();
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();if(server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill();await closed;}await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
