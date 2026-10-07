import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const out='../../outputs/art/facilities-reviewed-v45';
await mkdir(out,{recursive:true});
const report={at:new Date().toISOString(),source:'Existing game Canvas renderer; no new generated objects.',themes:[],requests:[],errors:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try {
 for(const [theme,port] of [['pixel',4173],['origami',4174]]) {
  const base='http://127.0.0.1:'+port;
  const files=['src/facilityArtModel.js','src/facilityArtFrames.js','src/functionalArt.js','src/artStore.js','public/assets/facilities-'+theme+'-components-v45.png','public/assets/facility-cup-'+theme+'-v45.png','public/assets/facility-nursery-back-'+theme+'-v45.png'];
  for(const file of files) {
   const response=await fetch(base+'/'+file.replace(/^public\//,''));
   assert.equal(response.status,200);
   const remote=Buffer.from(await response.arrayBuffer()),local=await readFile(file);
   assert.equal(createHash('sha256').update(remote).digest('hex'),createHash('sha256').update(local).digest('hex'));
  }
  const page=await browser.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   report.requests.push({method:route.request().method(),path:url.pathname,theme});
   if(route.request().method()!=='GET'||url.origin!==base)throw Error('Unexpected request: '+url);
   if(url.pathname==='/__facility-export')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>设施素材导出</title>'});
   if(/^\/(?:src|assets)\//.test(url.pathname))return route.continue();
   return route.abort();
  });
  await page.goto(base+'/__facility-export');
  const result=await page.evaluate(async theme=>{
   const art=await import('/src/functionalArt.js'),store=await import('/src/artStore.js'),frames=await import('/src/facilityArtFrames.js'),model=await import('/src/facilityArtModel.js'),catalog=await import('/src/facilityCatalog.js');
   const start=performance.now();
   while(!art.functionalArtStatus()[theme]?.loaded||!store.teaCupArtStatus(theme).loaded) {
    if(performance.now()-start>15000)throw Error('Asset load timed out');
    await new Promise(r=>setTimeout(r,25));
   }
   const meta=frames.FACILITY_ART_FRAMES[theme],canvas=document.createElement('canvas');
   canvas.width=1536;canvas.height=1536;
   const ctx=canvas.getContext('2d'),original=ctx.drawImage.bind(ctx);
   let cups=0,sourceFiles=[];
   ctx.drawImage=(im,...args)=>{if(im.src.includes('facility-cup-'))cups++;sourceFiles.push(im.src.split('/').at(-1));original(im,...args)};
   const cells=[];
   for(const [row,item] of ['c14_6','c6_8','c1_9'].entries())for(let rotation=0;rotation<4;rotation++) {
    const f=meta.rows[row][rotation],d=catalog.functionalDefinition(item),scale=f.h/d.shape.h,previous=cups,sourceStart=sourceFiles.length;
    const destination={x:rotation*384+192-f.w/2,y:row*512+440-f.h,w:f.w,h:f.h};
    ctx.save();ctx.translate(destination.x+f.w/2,destination.y+f.h-3*scale);ctx.scale(scale,scale);
    const rendered=art.drawFunctionalFacility(ctx,{item,id:'export',rotation,x:0,y:0},theme);
    ctx.restore();
    const points=row===2?model.teaCupLayout(theme,rotation,0):[];
    const pixels=ctx.getImageData(Math.floor(destination.x),Math.floor(destination.y),f.w,f.h).data;
    let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)opaque++;
    const bounds=points.every(c=>c.x>=0&&c.y>=0&&c.x+c.w<=f.w&&c.y+c.h<=f.h);
    cells.push({row,item,rotation,frame:f,destination,rendered,cupDraws:cups-previous,cupsInFrame:bounds,opaquePixels:opaque,sourceFiles:sourceFiles.slice(sourceStart)});
   }
   return {png:canvas.toDataURL('image/png'),cells,width:canvas.width,height:canvas.height};
  },theme);
  for(const c of result.cells) {
   assert.equal(c.rendered,true);assert.ok(c.opaquePixels>1000);
   assert.equal(c.cupDraws,c.row===2?3:0);assert.equal(c.cupsInFrame,true);
   if(c.row===1&&c.rotation===2)assert.deepEqual(c.sourceFiles,['facility-nursery-back-'+theme+'-v45.png']);
  }
  const file='facilities-'+theme+'-reviewed-v45.png',bytes=Buffer.from(result.png.split(',')[1],'base64');
  await writeFile(out+'/'+file,bytes);
  report.themes.push({theme,port,file,width:result.width,height:result.height,sha256:createHash('sha256').update(bytes).digest('hex'),cells:result.cells,physicalCupsPerTeaView:3});
  await page.close();
 }
 assert.deepEqual(report.errors,[]);
 assert.ok(report.requests.every(r=>r.method==='GET'&&!r.path.startsWith('/api/')));
 report.passed=true;
} catch(e) {report.failure=e.stack;process.exitCode=1;}
finally {
 await browser.close();
 await writeFile(out+'/export-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,themes:report.themes.map(t=>({theme:t.theme,file:t.file,cells:t.cells.length,cups:t.physicalCupsPerTeaView})),failure:report.failure}));
}
