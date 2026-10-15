import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v187/native-loading');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 try{
  const pathname=new URL(req.url,'http://local').pathname;let file;
  if(pathname==='/review'){
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end(`<!doctype html><body style="margin:0"><canvas id="terrain" width="4608" height="3584"></canvas><script type="module">
    import {drawTerrainTiles,terrainTileStatus} from '/candidate/mapTiles.js';
    const c=document.querySelector('canvas'),g=c.getContext('2d');
    window.state={theme:'pixel',season:'summer',time:0,x:0,y:0,frames:0,peakCacheBytes:0,lastDraw:false};
    window.cacheStatus=()=>({status:terrainTileStatus(),...state});window.snapshot=()=>{const p=g.getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<p.length;i+=4){h=Math.imul(h^p[i],16777619);h=Math.imul(h^p[i+1],16777619);h=Math.imul(h^p[i+2],16777619);}return{hash:h>>>0,status:terrainTileStatus(),...state};};
    function tick(){g.setTransform(1,0,0,1,0,0);g.fillStyle='#137a9e';g.fillRect(0,0,c.width,c.height);g.setTransform(2,0,0,2,-state.x*2,-state.y*2);state.lastDraw=drawTerrainTiles(g,state.theme,{season:state.season,now:state.time});state.peakCacheBytes=Math.max(state.peakCacheBytes,terrainTileStatus().bytes);state.frames++;requestAnimationFrame(tick);}requestAnimationFrame(tick);
   </script>`);return;
  }
  if(pathname.startsWith('/candidate/')){file=resolve(root,'src',pathname.slice('/candidate/'.length));if(!file.startsWith(resolve(root,'src')+sep))throw Error('path_escape');}
  else if(pathname.startsWith('/assets/season-terrain-v187/')){
   const m=pathname.match(/^\/assets\/season-terrain-v187\/(pixel|origami)\/(spring|summer|autumn|winter)\/([a-z0-9-]+)\.png$/);if(!m)throw Error('invalid_native_path');file=resolve(root,'public/assets/season-terrain-v187',m[1],m[2],m[3]+'.png');
  }else if(pathname.startsWith('/assets/')){file=resolve(root,'public','.'+pathname);if(!file.startsWith(resolve(root,'public')+sep))throw Error('path_escape');}
  else throw Error('route_missing');
  const bytes=await readFile(file);res.writeHead(200,{'Content-Type':extname(file)==='.png'?'image/png':'text/javascript'}).end(bytes);
 }catch(e){res.writeHead(404).end(e.message);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
const report={scope:'Isolated native seasonal terrain loader; no gameplay, user save, whole-island seam or full season acceptance claimed',cases:[],passed:false};
try{
 browser=await chromium.launch(browserLaunchOptions());
 for(const backend of ['worker','compatible'])for(const theme of ['pixel','origami']){
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  if(backend==='compatible')await page.addInitScript(()=>{window.Worker=undefined;});
  let release,held=false;const wait=new Promise(r=>release=r);
  await page.route('**/assets/season-terrain-v187/'+theme+'/winter/plaza.png',async route=>{held=true;await wait;await route.continue();});
  await page.route('**/assets/season-terrain-v187/'+theme+'/autumn/plaza.png',route=>route.abort('failed'));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/review');
   await page.waitForFunction(()=>typeof snapshot==='function');
   await page.evaluate(t=>{state.theme=t;},theme);
   await page.waitForFunction(()=>cacheStatus().lastDraw&&cacheStatus().status.season==='summer'&&cacheStatus().status.pending===0&&cacheStatus().status.overview.ready.includes('summer'),{},{timeout:60000});
   const before=await page.evaluate(()=>snapshot());assert.equal(before.status.failed.length,0);
   await page.evaluate(()=>{state.season='winter';state.time=1000;});
   await page.waitForFunction(()=>cacheStatus().status.targetSeason==='winter');
   const deadline=Date.now()+60000;while(!held&&Date.now()<deadline)await page.waitForTimeout(100);assert(held,'plaza load reached');
   await page.waitForTimeout(400);
   const blocked=await page.evaluate(()=>snapshot());assert.equal(blocked.status.season,'summer');assert(blocked.lastDraw);assert.equal(blocked.hash,before.hash);assert(blocked.frames>before.frames);
   release();
   await page.waitForFunction(()=>cacheStatus().status.season==='winter'&&cacheStatus().status.pending===0,{},{timeout:60000});
   const start=await page.evaluate(()=>snapshot());assert.equal(start.status.fromSeason,'summer');assert.equal(start.hash,before.hash);
   await page.evaluate(()=>{state.time=3000;});await page.waitForTimeout(70);const half=await page.evaluate(()=>snapshot());assert.notEqual(half.hash,before.hash);
   await page.evaluate(()=>{state.time=5000;});
   await page.waitForFunction(()=>{const s=cacheStatus().status;return s.fromSeason===null&&s.pending===0&&s.visible.every(id=>{const d=s.densities.find(d=>d.id===id);return id.endsWith('--winter')&&d&&d.decoded+.02>=Math.min(s.requestedDensity,d.native);});},{},{timeout:60000});
   const settledFrame=await page.evaluate(()=>state.frames);await page.waitForFunction(n=>state.frames>=n+2,settledFrame);
   const final=await page.evaluate(()=>snapshot());assert.notEqual(final.hash,before.hash);assert.notEqual(final.hash,half.hash);assert.equal(final.status.fromSeason,null);assert.equal(final.status.failed.length,0);assert(final.peakCacheBytes<=final.status.limitBytes,'both seasons fit the decoded cache budget');
   await page.locator('#terrain').screenshot({path:resolve(out,theme+'-'+backend+'-winter.png')});
   await page.evaluate(()=>{state.season='autumn';state.time=6000;});await page.waitForFunction(()=>cacheStatus().status.failed.length>0);const missing=await page.evaluate(()=>snapshot());
   await writeFile(resolve(out,theme+'-'+backend+'-diagnostics.json'),JSON.stringify({before,start,half,final,missing},null,2));
   assert.equal(missing.status.season,'winter');assert.equal(missing.hash,final.hash);assert(missing.lastDraw);
   const row={theme,backend,previousSeasonPreservedDuringRealPendingLoad:true,framesDuringHold:blocked.frames-before.frames,repairPatchRequiredBeforeSwitch:true,fadeHashes:{before:before.hash,start:start.hash,half:half.hash,final:final.hash},missingAssetPreservesLastCompleteSeason:true,cacheBytes:final.status.bytes,peakCacheBytes:final.peakCacheBytes,cacheLimit:final.status.limitBytes,passed:true};
   report.cases.push(row);console.log(JSON.stringify(row));
  }finally{release();await page.close();}
 }
 report.passed=report.cases.length===4;
}catch(error){report.error=String(error);throw error;}
finally{await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}
