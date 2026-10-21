import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v353/native-raster-liveness');await mkdir(out,{recursive:true});
const baseline=process.env.HD_QA_RASTER_BASELINE_CLIENT,baselineWorker=process.env.HD_QA_RASTER_BASELINE_WORKER;assert(!!baseline===!!baselineWorker);
const report={scope:'Owned native WebGL Worker, real snapshot/bitmap transfer and procedural32x64RGBA artwork. An explicit12second image-copy delay and4second observation delay for one completed raster cross the original15second whole-request deadline after16seconds idle. All actual request/worker health limits remain. Compare warm/fresh native pixels exactly and close the expired bitmap. No models, game actors, world clocks, user browser, four-map or human acceptance.',cases:[],passed:false};
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://owned').pathname;if(path==='/')return res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><canvas id="result" width="36" height="68"></canvas>');
 if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
 const match=path.match(/^\/(candidate|baseline)(\/src\/.+)$/);assert(match);let file=resolve(root,'.'+match[2]);assert(file.startsWith(join(root,'src')+sep));
 if(match[1]==='baseline'){assert(baseline);if(match[2]==='/src/connectedSurfaceClient.js')file=baseline;if(match[2]==='/src/connectedSurfaceWorker.js')file=baselineWorker;}
 res.writeHead(200,{'Content-Type':'text/javascript'}).end(await readFile(file));
 }catch(error){res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch(browserLaunchOptions());
try{
 await Promise.all((baseline?['baseline','candidate']:['candidate']).flatMap(variant=>['pixel','origami'].map(async theme=>{
  const row={variant,theme,errors:[],passed:false};report.cases.push(row);const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:'+server.address().port);
   Object.assign(row,await page.evaluate(async({variant,theme})=>{
    const{createConnectedSurfaceClient}=await import('/'+variant+'/src/connectedSurfaceClient.js'),{createGpuWorkerEndpoint}=await import('/'+variant+'/src/gpuWorkerEndpoint.js');
    const wait=ms=>new Promise(r=>setTimeout(r,ms)),held=[],painted=[],copies=[];let resets=0,closed=false;
    const source=()=>{const c=document.createElement('canvas');c.width=32;c.height=64;const g=c.getContext('2d');g.fillStyle='#c95157';g.fillRect(0,0,32,64);g.fillStyle='#457a8c';g.fillRect(3,4,9,49);g.fillStyle='#f6cb67';g.fillRect(19,11,10,40);return c;};
    const image=source(),late=source(),canvas=document.querySelector('#result'),g=canvas.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=theme==='origami';
    const a={x:-16,y:-64,u:0,v:0},b={x:16,y:-64,u:1,v:0},c={x:-16,y:0,u:0,v:1},d={x:16,y:0,u:1,v:1},raster={w:36,h:68,x:-18,y:-66,density:1,frame:{x:0,y:0,w:32,h:64},mesh:{vertices:[[a,b],[c,d]],triangles:[[a,b,c],[b,d,c]]},smoothing:theme==='origami'};
    let endpoint;const client=createConnectedSurfaceClient({
     bitmap:async image=>{if(image===late)await wait(12000);return createImageBitmap(image);},onReset:()=>resets++,
     worker:()=>{endpoint=createGpuWorkerEndpoint(new URL('/'+variant+'/src/connectedSurfaceWorker.js',location.href));const wrapper={onmessage:null,onerror:null,postMessage:(...args)=>endpoint.postMessage(...args),terminate(){closed=true;for(const h of held){clearTimeout(h.timer);if(h.data.bitmap.width)h.data.bitmap.close();}endpoint.terminate();}};
      endpoint.onerror=e=>wrapper.onerror?.(e);endpoint.onmessage=e=>{if(e.data.kind==='raster'&&e.data.key==='late'){const h={data:e.data,timer:null};held.push(h);h.timer=setTimeout(()=>{if(closed){if(h.data.bitmap.width)h.data.bitmap.close();return;}wrapper.onmessage?.(e);},4000);}else wrapper.onmessage?.(e);};return wrapper;}
    });
    const capture=key=>(bitmap,draw)=>{g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,36,68);g.setTransform(1,0,0,1,18,66);g.drawImage(bitmap,...draw);copies.push({key,pixels:Array.from(g.getImageData(0,0,36,68).data)});painted.push(key);};
    async function draw(key,image){assertClient(client.request(key,image,raster,capture(key)),'Native request admission');const start=performance.now();while(!painted.includes(key)&&!client.inspect().workerFailureCode){assertClient(performance.now()-start<15000,'Original native raster response deadline');await wait(20);}assertClient(painted.includes(key),'Actual GPU response required');}
    const assertClient=(condition,message)=>{if(!condition)throw Error(message);};
    try{
     await draw('warm',image);const warm=client.inspect();assertClient(warm.backend==='WebGL2 connected surface'&&warm.ready&&warm.draws>0,'Actual primary WebGL raster required');const warmPixelSHA256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(copies[0].pixels)))).map(v=>v.toString(16).padStart(2,'0')).join('');
     await wait(16000);assertClient(client.inspect().ready,'Idle alone does not retire a worker');const requestedAt=performance.now();assertClient(client.request('late',late,raster,capture('late')),'Delayed image admitted');
     await wait(17500);const delayed=client.inspect(),elapsedMs=performance.now()-requestedAt;
     if(variant==='baseline'){assertClient(delayed.workerFailureCode==='sprite_raster_timeout','Original idle/decode false retirement must reproduce');return{expectedNegative:true,elapsedMs,warm,warmPixelSHA256,delayed,resets,painted};}
     assertClient(!delayed.workerFailureCode&&delayed.ready,'A newly submitted healthy raster must survive the older whole-request expiry');assertClient(delayed.expiredRasters===1&&delayed.pendingRasters===0,'Original15second request expiry remains');
     assertClient(held.length===1&&held[0].data.bitmap.width===0,'Expired actual bitmap closes without painting');assertClient(painted.join(',')==='warm','Expired actual pixels never enter the cache');
     await draw('fresh',late);const first=copies.find(v=>v.key==='warm').pixels,last=copies.find(v=>v.key==='fresh').pixels;let different=0,opaque=0;for(let i=0;i<first.length;i++){if(first[i]!==last[i])different++;if(i%4===3&&first[i])opaque++;}
     assertClient(different===0&&opaque>1024,'Fresh actual GPU pixels match the native warm frame exactly');return{elapsedMs,warm,warmPixelSHA256,delayed,fresh:client.inspect(),resets,painted,exactNativePixelDifference:different,opaquePixels:opaque,expiredActualBitmapClosed:true};
    }finally{client.dispose();}
   },{variant,theme}));
   assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(error){row.failure=error.stack;process.exitCode=1;await page.screenshot({path:join(out,variant+'-'+theme+'-failure.png')}).catch(()=>{});}
  finally{await context.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 })));
 if(baseline)for(const theme of ['pixel','origami'])assert.equal(report.cases.find(r=>r.variant==='candidate'&&r.theme===theme).warmPixelSHA256,report.cases.find(r=>r.variant==='baseline'&&r.theme===theme).warmPixelSHA256,'Actual baseline/candidate GPU pixels remain identical');
 report.passed=report.cases.every(row=>row.passed);
}finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
