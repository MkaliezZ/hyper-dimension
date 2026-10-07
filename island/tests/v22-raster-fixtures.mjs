const outDir=process.argv[2]||'qa/v22';
import assert from 'node:assert/strict';import {chromium} from 'playwright-core';import {writeFile} from 'node:fs/promises';
const results=[];
for(const disabled of [false,true]){
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:disabled?['--disable-webgl']:[]});
 try{
  const p=await browser.newPage();await p.route('**/api/**',r=>r.fulfill({status:503,body:'{}'}));
  await p.goto('http://127.0.0.1:4174/?qa=1');await p.waitForTimeout(1000);
  const result=await p.evaluate(async()=>{
   const {drawRaster,rasterQualityStatus}=await import('/src/rasterQuality.js');
   const source=document.createElement('canvas');source.width=source.height=8;const g=source.getContext('2d');
   g.fillStyle='#f00';g.fillRect(0,0,4,4);g.fillStyle='#0f0';g.fillRect(4,0,4,4);g.fillStyle='#00f';g.fillRect(0,4,4,4);
   const c=document.createElement('canvas');c.width=c.height=32;const ctx=c.getContext('2d');
   drawRaster(ctx,source,'origami',0,0,32,32);
   for(let i=0;i<100&&rasterQualityStatus().pending;i++)await new Promise(r=>setTimeout(r,40));
   ctx.clearRect(0,0,32,32);drawRaster(ctx,source,'origami',0,0,32,32);
   const colors=[[4,4],[28,4],[4,28],[28,28]].map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]);
   return {colors,status:rasterQualityStatus()};
  });
  assert.deepEqual(result.colors,[[255,0,0,255],[0,255,0,255],[0,0,255,255],[0,0,0,0]]);
  assert.equal(result.status.backend,disabled?'native canvas':'GPU reconstruction');results.push({disabled,...result});
 }finally{await browser.close()}
}
await writeFile(outDir+'/raster-fixtures.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));

