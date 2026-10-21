import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v356/native-worker-boot');await mkdir(out,{recursive:true});
const report={scope:'Actual shipped character PNG, production refinement and native connected WebGL surface. The declared cold-start fixture holds the first actual PNG for4seconds and the graphics module response for16seconds. Only when the module starts is changed; every actual image/raster request keeps its original15second deadline and all pixel/fence/memory budgets. Cold fast pixels are compared byte-for-byte with an early-started endpoint. No map,actor,clock,resources,provider,user browser or physical-device acceptance.',cases:[],passed:false,wholeGoalComplete:false},pending=new Map(),pngSeen=new Set(),planes=new Map();
async function delay(ms){await new Promise(done=>{const timer=setTimeout(()=>{pending.delete(timer);done();},ms);pending.set(timer,done);});}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://owned');if(url.pathname==='/favicon.ico'){res.writeHead(204);return res.end();}
 const match=url.pathname.startsWith('/assets/')?[null,url.searchParams.get('fixture'),url.searchParams.get('theme'),url.pathname]:url.pathname.match(/^\/(cold-fast|cold-delayed|warm-delayed)\/(pixel|origami)(\/.*)?$/);assert(match);const[,variant,theme,route='/']=match;assert(['cold-fast','cold-delayed','warm-delayed'].includes(variant)&&['pixel','origami'].includes(theme));
 if(route==='/'){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});return res.end('<!doctype html><canvas width="160" height="224"></canvas>');}
 assert(route.startsWith('/src/')||route.startsWith('/assets/'));
 if(variant!=='cold-fast'&&route==='/src/connectedSurfaceWorker.js')await delay(16000);
 if(route.endsWith('.png')&&!pngSeen.has(variant+theme)){pngSeen.add(variant+theme);await delay(4000);}
 if(res.destroyed)return;
 const file=resolve(root,'.'+(route.startsWith('/assets/')?'/public'+route:route));assert(file.startsWith(root+sep));
 res.writeHead(200,{'Content-Type':route.endsWith('.png')?'image/png':route.endsWith('.json')?'application/json':'application/javascript','Cache-Control':'no-store'});res.end(await readFile(file));
 }catch{if(!res.destroyed){res.writeHead(404);res.end();}}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const browser=await chromium.launch(browserLaunchOptions());
try{for(const theme of ['pixel','origami'])for(const variant of ['cold-fast','cold-delayed','warm-delayed']){
 const row={theme,variant,errors:[],passed:false};report.cases.push(row);const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',error=>row.errors.push(error.message));
 try{
  const prefix='/'+variant+'/'+theme;await page.goto('http://127.0.0.1:'+server.address().port+prefix+'/');
  Object.assign(row,await page.evaluate(async({theme,variant,prefix})=>{
   const {createConnectedSurfaceClient}=await import(prefix+'/src/connectedSurfaceClient.js'),{createSpriteRefiner}=await import(prefix+'/src/spriteRefiner.js'),{registerSpriteSource}=await import(prefix+'/src/spriteSource.js');
   let resets=0,painted=0;const client=createConnectedSurfaceClient({onReset:()=>resets++}),started=performance.now();if(variant==='warm-delayed')assertReady(client.prepare());
   function assertReady(value){if(!value)throw Error('Owned module preparation refused');}
   const image=new Image();image.src='/assets/characters-'+theme+'-8way-pack-0-v6.png?fixture='+variant+'&theme='+theme;await image.decode();
   const metadata=await fetch(prefix+'/assets/character-frames-v6.json').then(r=>r.json()),frame=metadata['characters-'+theme+'-8way-pack-0-v6.png'][0],options={resizeWidth:112,resizeHeight:160,resizeQuality:'high'};
   const refined=await createSpriteRefiner()(image,frame.x,frame.y,frame.w,frame.h,options);if(!(refined instanceof ImageBitmap))throw Error('Actual production refinement bitmap required');registerSpriteSource(refined,{kind:'refined',source:{kind:'original',url:image.src},frame,options});
   const a={x:-56,y:-160,u:0,v:0},b={x:56,y:-160,u:1,v:0},c={x:-51,y:0,u:0,v:1},d={x:61,y:0,u:1,v:1},raster={w:116,h:164,density:1,frame:{x:0,y:0,w:112,h:160},mesh:{vertices:[[a,b],[c,d]],triangles:[[a,b,c],[b,d,c]]},smoothing:theme==='origami'},canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d',{willReadFrequently:true}),requested=performance.now();
   try{
    if(!client.request('owned-real-artwork',refined,raster,(bitmap,draw)=>{ctx.setTransform(1,0,0,1,80,190);ctx.drawImage(bitmap,...draw);painted++;}))throw Error('Original request rejected');
    while(!painted&&!client.inspect().workerFailureCode){if(performance.now()-requested>18000)throw Error('Original unresponsive-request retirement did not occur');await new Promise(done=>setTimeout(done,20));}
    return {requestElapsedMs:performance.now()-requested,totalElapsedMs:performance.now()-started,graphics:client.inspect(),resets,painted,imageStillLive:refined.width===112&&refined.height===160,pixels:Array.from(ctx.getImageData(0,0,canvas.width,canvas.height).data)};
   }finally{client.dispose();if(refined.width!==112||refined.height!==160)throw Error('The live original was detached or closed');refined.close();}
  },{theme,variant,prefix}));
  if(variant==='cold-delayed'){assert.equal(row.graphics.workerFailureCode,'sprite_image_copy_timeout');assert.equal(row.resets,1);assert.equal(row.painted,0);row.expectedNegative=true;}
  else{
   assert.equal(row.graphics.backend,'WebGL2 connected surface');assert(row.graphics.ready&&row.graphics.draws>0);assert.equal(row.painted,1);assert.equal(row.resets,0);assert(row.imageStillLive);assert(row.requestElapsedMs<15000);assert(row.pixels.some((v,i)=>i%4===3&&v>0));
   row.pixelSHA256=createHash('sha256').update(new Uint8Array(row.pixels)).digest('hex');
   if(variant==='cold-fast')planes.set(theme,row.pixels);
   else{assert.deepEqual(row.pixels,planes.get(theme));row.exactNativePixelDifference=0;assert(row.graphics.workerBoot.ready);}
  }
  delete row.pixels;assert.deepEqual(row.errors,[]);row.passed=true;
 }catch(error){row.failure=error.stack;process.exitCode=1;}
 finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
}report.passed=report.cases.every(row=>row.passed);
}finally{for(const [timer,done] of pending){clearTimeout(timer);done();}pending.clear();await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(({theme,variant,passed,failure,requestElapsedMs,expectedNegative})=>({theme,variant,passed,failure,requestElapsedMs,expectedNegative}))}));}
