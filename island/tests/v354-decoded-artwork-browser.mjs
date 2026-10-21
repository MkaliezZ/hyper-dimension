import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v354/native-decoded-artwork'),baseline=process.env.HD_QA_BASELINE_SURFACE_CLIENT;
await mkdir(out,{recursive:true});
const report={scope:'Actual shipped character artwork, production artwork-refinement worker, immutable bitmap clone and native WebGL raster. An owned HTTP fixture delays only the redundant third PNG fetch by16seconds. Original15second acquisition/raster deadlines and all image/pose budgets remain. Baseline normal pixels are compared byte-for-byte. No game state, model, user browser or user files.',cases:[],passed:false},requests=[],waiting=new Set(),pixelPlanes=new Map();
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://owned'),path=url.pathname;if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
 const match=path.startsWith('/assets/')?[null,url.searchParams.get('fixture'),path]:path.match(/^\/(baseline-normal|baseline-held|candidate-held)(\/.*)?$/);assert(match);const[,variant,route='/']=match;assert(['baseline-normal','baseline-held','candidate-held'].includes(variant));
 if(route==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<!doctype html><canvas width="160" height="224"></canvas>');}
 const rel=route.startsWith('/assets/')?'/public'+route:route;let file=resolve(root,'.'+rel);assert(file.startsWith(root+sep));assert(route.startsWith('/src/')||route.startsWith('/assets/'));
 if(variant.startsWith('baseline')&&route==='/src/connectedSurfaceClient.js'){assert(baseline);file=baseline;}
 if(route.startsWith('/assets/')){
  requests.push({variant,route,at:Date.now()});const count=requests.filter(r=>r.variant===variant&&r.route===route).length;
  if(variant.endsWith('held')&&route.endsWith('.png')&&count===3)await new Promise(done=>{const timer=setTimeout(()=>{waiting.delete(timer);done();},16000);waiting.add(timer);});
 }
 res.writeHead(200,{'Content-Type':route.endsWith('.png')?'image/png':route.endsWith('.json')?'application/json':'text/javascript'});res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami'])for(const variant of baseline?['baseline-normal','baseline-held','candidate-held']:['candidate-held']){
  const row={theme,variant,errors:[],passed:false};report.cases.push(row);const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));const start=requests.length;
  try{
   await page.goto('http://127.0.0.1:'+server.address().port+'/'+variant+'/');
   Object.assign(row,await page.evaluate(async({theme,variant})=>{
    const path='/'+variant,{createConnectedSurfaceClient}=await import(path+'/src/connectedSurfaceClient.js'),{createSpriteRefiner}=await import(path+'/src/spriteRefiner.js'),{registerSpriteSource}=await import(path+'/src/spriteSource.js');
    const image=new Image();image.src='/assets/characters-'+theme+'-8way-pack-0-v6.png?fixture='+variant;await image.decode();
    const metadata=await fetch(path+'/assets/character-frames-v6.json').then(r=>r.json()),frame=metadata['characters-'+theme+'-8way-pack-0-v6.png'][0],options={resizeWidth:112,resizeHeight:160,resizeQuality:'high'};
    const refined=await createSpriteRefiner()(image,frame.x,frame.y,frame.w,frame.h,options);if(!(refined instanceof ImageBitmap))throw Error('Actual production ImageBitmap required');registerSpriteSource(refined,{kind:'refined',source:{kind:'original',url:image.src},frame,options});
    const a={x:-56,y:-160,u:0,v:0},b={x:56,y:-160,u:1,v:0},c={x:-51,y:0,u:0,v:1},d={x:61,y:0,u:1,v:1},raster={w:116,h:164,density:1,frame:{x:0,y:0,w:112,h:160},mesh:{vertices:[[a,b],[c,d]],triangles:[[a,b,c],[b,d,c]]},smoothing:theme==='origami'},canvas=document.querySelector('canvas'),g=canvas.getContext('2d',{willReadFrequently:true});let resets=0,painted=0;
    const client=createConnectedSurfaceClient({onReset:()=>resets++}),at=performance.now();
    try{
     if(!client.request('actual-refined',refined,raster,(bitmap,draw)=>{g.setTransform(1,0,0,1,80,190);g.drawImage(bitmap,...draw);painted++;}))throw Error('Actual request refused');
     while(!painted&&!client.inspect().workerFailureCode){if(performance.now()-at>18000)throw Error('Original deadline failed to retire an unresponsive acquisition');await new Promise(r=>setTimeout(r,20));}
     const graphics=client.inspect(),pixels=Array.from(g.getImageData(0,0,canvas.width,canvas.height).data),imageStillLive=refined.width===112&&refined.height===160;
     return {elapsedMs:performance.now()-at,graphics,resets,painted,imageStillLive,pixels};
    }finally{client.dispose();if(refined.width!==112||refined.height!==160)throw Error('Cloning detached or closed the live original');refined.close();}
   },{theme,variant}));
   row.pngRequests=requests.slice(start).filter(r=>r.variant===variant&&r.route.endsWith('.png')).length;
   if(variant==='baseline-held'){assert.equal(row.graphics.workerFailureCode,'sprite_image_copy_timeout');assert.equal(row.resets,1);assert.equal(row.painted,0);assert.equal(row.pngRequests,3);row.expectedNegative=true;}
   else{
    assert.equal(row.graphics.backend,'WebGL2 connected surface');assert(row.graphics.ready&&row.graphics.draws>0);assert.equal(row.painted,1);assert.equal(row.resets,0);assert(row.imageStillLive);assert(row.elapsedMs<15000);
    assert.equal(row.pngRequests,variant==='candidate-held'?2:3);assert(row.pixels.some((v,i)=>i%4===3&&v>0),'Actual character pixels required');
    row.pixelSHA256=createHash('sha256').update(new Uint8Array(row.pixels)).digest('hex');
    if(variant==='baseline-normal')pixelPlanes.set(theme,row.pixels);
    if(variant==='candidate-held'&&baseline){assert.deepEqual(row.pixels,pixelPlanes.get(theme),'Actual artwork RGBA changed');row.exactNativePixelDifference=0;}
   }
   delete row.pixels;assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;}
  finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(c=>c.passed);
}finally{for(const timer of waiting)clearTimeout(timer);await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
