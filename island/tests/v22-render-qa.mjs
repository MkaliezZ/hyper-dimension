const outDir=process.argv[2]||'qa/v22';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
const results=[];await mkdir(outDir+'',{recursive:true});
try{
 for(const [theme,dpr] of [['pixel',1],['origami',1],['pixel',3],['origami',3]]){
  const p=await browser.newPage({viewport:{width:1440,height:950},deviceScaleFactor:dpr}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('**/api/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"isolated render QA"}'}));
  await p.goto('http://127.0.0.1:'+(theme==='pixel'?4173:4174)+'/?qa=1');
  await p.waitForFunction(()=>window.islandInspect?.().rendering.raster.ready>=4&&window.islandInspect().rendering.raster.pending===0,null,{timeout:30000});
  await p.locator('#cameraHome').click();
  for(const [label,n] of [[100,0],[200,7],[300,7]]){
   for(let i=0;i<n;i++)await p.locator('#zoomIn').click();
   await p.waitForTimeout(160);
   const snapshot=await p.evaluate(()=>{const c=document.querySelector('#game'),ctx=c.getContext('2d'),s=window.islandInspect();return {theme:s.theme,zoom:s.zoom,rendering:s.rendering,camera:s.camera,smoothing:ctx.imageSmoothingEnabled,quality:ctx.imageSmoothingQuality}});
   assert.equal(snapshot.smoothing,theme!=='pixel');assert.equal(snapshot.quality,'high');
   assert.equal(snapshot.rendering.raster.failures,0);assert.deepEqual(snapshot.rendering.backing,[1440*dpr,950*dpr]);
   if(dpr===1)await p.screenshot({path:outDir+'/'+theme+'-after-'+label+'.png'});
   results.push(snapshot);
  }
  const ready=results.at(-1).rendering.raster.ready;
  await p.mouse.move(700,500);await p.mouse.down();await p.mouse.move(760,560,{steps:12});await p.mouse.up();
  assert.equal(await p.evaluate(()=>window.islandInspect().rendering.raster.ready),ready,'Panning reuses reconstructed rasters');
  assert.deepEqual(errors,[]);await p.close();
 }
 await writeFile(outDir+'/render-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({cases:results.length,results:results.map(r=>({theme:r.theme,zoom:r.zoom,dpr:r.rendering.nativeDpr,raster:r.rendering.raster}))}));
}finally{await browser.close()}

