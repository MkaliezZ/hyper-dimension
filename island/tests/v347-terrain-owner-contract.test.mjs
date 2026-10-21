import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {deflateSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
const folder=fileURLToPath(new URL('../src',import.meta.url)),png=await import(pathToFileURL(folder+'/terrainPngPixels.js')),{terrainPixelSurface,prepareTerrainPixelSurface}=await import(pathToFileURL(folder+'/terrainPixelSurface.js'));
const worker=(await readFile(folder+'/mapTileWorker.js','utf8')).replace(/^import .*\r?\n/gm,'');assert(!worker.includes('import '));
function chunk(type,data=Buffer.alloc(0)){const name=Buffer.from(type),a=Buffer.alloc(4),b=Buffer.alloc(4);a.writeUInt32BE(data.length);let c=0xffffffff;for(const v of Buffer.concat([name,data])){c^=v;for(let n=0;n<8;n++)c=(c>>>1)^(c&1?0xedb88320:0);}b.writeUInt32BE((c^0xffffffff)>>>0);return Buffer.concat([a,name,data,b]);}
function image(mode){const h=Buffer.alloc(13);h.writeUInt32BE(mode==='budget'?4097:2);h.writeUInt32BE(2,4);h[8]=8;h[9]=2;const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),...(mode==='profile'?[chunk('gAMA',Buffer.from([0,0,177,143]))]:[]),chunk('IDAT',deflateSync(Buffer.from([0,1,2,3,4,5,6,0,7,8,9,10,11,12]))),chunk('IEND')]);if(mode==='corrupt')bytes[bytes.length-1]^=1;return bytes;}
class Pixels{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}}
for(const mode of ['rgb','profile','corrupt','budget'])test('actual worker preserves original identity and limits with CPU-only terrain transport: '+mode,async()=>{
 const sent=[],calls={bitmap:0,transferBitmap:0,maskRows:0,fetch:0,surfaces:[],put:0},tile={id:'owned-tile',theme:'pixel',patch:true,bounds:{x:0,y:0,w:1,h:1}};
 class Surface{constructor(width,height){this.width=width;this.height=height;calls.surfaces.push(this);}getContext(kind,options){assert.equal(kind,'2d');assert.equal(options.willReadFrequently,true);return{drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){calls.put++;}};}transferToImageBitmap(){calls.transferBitmap++;throw Error('Forbidden terrain bitmap transfer');}}
 const self={postMessage:(data,transfer)=>sent.push({data,transfer})};
 const scope=vm.createContext({self,...png,Uint8ClampedArray,ImageData:Pixels,Blob,OffscreenCanvas:Surface,setTimeout,fetch:async()=>{calls.fetch++;return new Response(image(mode));},createImageBitmap:async()=>{calls.bitmap++;throw Error('Forbidden terrain bitmap allocation');},terrainOverviewURL:()=>'/never-preview',seasonalTerrain:()=>[tile],terrainSurfaceSize:()=>({width:2,height:2}),maskTerrainRows:(data,w,h,tile,y,count)=>{calls.maskRows+=count;},serveGpuWorkerEndpoint:receive=>{self.onmessage=receive;}});
 new vm.Script(worker,{filename:'actual-mapTileWorker.js'}).runInContext(scope);await self.onmessage({data:{requestId:'original-request',theme:'pixel',season:'spring',id:tile.id,density:2}});
 assert.equal(sent.length,1);assert.equal(sent[0].data.requestId,'original-request');assert.equal(calls.fetch,1);assert.equal(calls.bitmap,0);assert.equal(calls.transferBitmap,0);assert(!Object.hasOwn(sent[0].data,'bitmap'));
 if(mode==='rgb'){
  const out=sent[0].data;assert.equal(out.phase,'source');assert.equal(out.nativeDensity,2);assert.equal(out.decodeBackend,'cpu-png');assert.equal(out.width,2);assert.equal(out.height,2);assert.equal(out.pixels.byteLength,16);assert.equal(sent[0].transfer[0],out.pixels.buffer);assert.equal(calls.maskRows,0);assert.equal(calls.put,0);assert.equal(calls.surfaces.length,0);assert.deepEqual([...out.pixels],[1,2,3,255,4,5,6,255,7,8,9,255,10,11,12,255]);
 }else if(mode==='profile'){
  assert.equal(sent[0].data.phase,'compatible');assert.equal(sent[0].data.error,'terrain_png_unsupported');assert.equal(calls.surfaces.length,0);assert.equal(calls.maskRows,0);
 }else{assert.equal(sent[0].data.phase,'error');assert.equal(sent[0].data.error,'terrain_png_'+(mode==='corrupt'?'crc':'budget'));assert.equal(calls.surfaces.length,0);assert.equal(calls.maskRows,0);}
});
test('Window surface uses the exact transferred pixel buffer and closes failed surfaces',()=>{
 const data=new Uint8ClampedArray(16),seen=[];const surface={getContext:(type,options)=>{seen.push({type,options});return{putImageData:(image,x,y)=>seen.push({image,x,y})};}};
 assert.equal(terrainPixelSurface({width:2,height:2,pixels:data},{canvas:()=>surface,Image:Pixels}),surface);assert.equal(surface.width,2);assert.equal(surface.height,2);assert.equal(seen[0].options.willReadFrequently,true);assert.equal(seen[1].image.data,data);assert.equal(seen[1].x,0);assert.equal(seen[1].y,0);
 const broken={getContext:()=>null};assert.throws(()=>terrainPixelSurface({width:2,height:2,pixels:data},{canvas:()=>broken,Image:Pixels}),/terrain_pixel_surface_unavailable/);assert.equal(broken.width,1);assert.equal(broken.height,1);
});
for(const [label,value]of [
 ['zero',{width:0,height:2,pixels:new Uint8ClampedArray(0)}],['fraction',{width:1.5,height:2,pixels:new Uint8ClampedArray(12)}],['oversize',{width:4097,height:1,pixels:new Uint8ClampedArray(0)}],['area',{width:4096,height:4096,pixels:new Uint8ClampedArray(0)}],['short',{width:2,height:2,pixels:new Uint8ClampedArray(12)}],['wrong-type',{width:2,height:2,pixels:new Uint8Array(16)}],['missing',null]
])test('invalid '+label+' output allocates no Window canvas',()=>{let allocated=0;assert.throws(()=>terrainPixelSurface(value,{canvas:()=>{allocated++;return{};},Image:Pixels}),/terrain_pixel_surface_invalid/);assert.equal(allocated,0);});

async function mainFixture(){
 const source=(await readFile(folder+'/mapTiles.js','utf8')).replace(/^import .*\r?\n/gm,'').replace(/export /g,'').replaceAll('import.meta.url',JSON.stringify(pathToFileURL(folder+'/mapTiles.js').href));const seen={allocations:0,closed:0,timers:[],compat:[],preparations:[]};let resolveLoad;
 const ctx=vm.createContext({URL,performance:{now:()=>1000},AbortController,Uint8ClampedArray,Worker:function(){},OffscreenCanvas:function(){},setTimeout:(fn,ms)=>{seen.timers.push({fn,ms});return seen.timers.length;},clearTimeout(){},OVERVIEW_BUDGET:1,createGpuWorkerEndpoint:()=>({}),closeTerrainSurface:image=>{if(image)seen.closed++;},terrainPixelSurface:value=>terrainPixelSurface(value,{Image:Pixels,canvas:()=>{seen.allocations++;return{getContext:()=>({putImageData(){}})};}}),prepareTerrainPixelSurface:(value,tile,options)=>new Promise((resolve,reject)=>seen.preparations.push({value,tile,options,resolve,reject})),loadTerrainTile:(tile,options)=>{seen.compat.push({tile,options});return new Promise(r=>resolveLoad=r);}});
 vm.runInContext(source+'\nglobalThis.contract={receive,jobs,entries,stats,workerFailure,select,inspect:terrainTileStatus};',ctx);return{ctx,seen,api:ctx.contract,resolveLoad:image=>resolveLoad(image)};
}
test('actual main receiver installs a CPU surface once and stale output allocates nothing',async()=>{
 const f=await mainFixture(),entry={tile:{id:'tile',bounds:{w:1,h:1}},attempts:1,pending:true},job={entry,generation:0,backend:'worker',deadline:2000,timer:1};f.api.jobs.set(10,job);f.api.entries.set('tile',entry);
 f.api.receive({requestId:999,phase:'ready',width:2,height:2,pixels:new Uint8ClampedArray(16)});assert.equal(f.seen.allocations,0);
 f.api.receive({requestId:10,phase:'ready',width:2,height:2,pixels:new Uint8ClampedArray(16),nativeDensity:2});assert.equal(f.seen.allocations,1);assert.equal(f.api.jobs.size,0);assert.equal(f.api.stats.loads,1);assert.equal(f.api.stats.bytes,16);assert.equal(entry.nativeDensity,2);assert.equal(entry.pending,false);assert.equal(entry.bitmap.width,2);
});
test('unsupported PNG uses the existing native decoder on the Window with the original remaining deadline',async()=>{
 const f=await mainFixture(),entry={tile:{id:'tile',density:2,bounds:{w:1,h:1}},attempts:1,pending:true},job={entry,generation:0,backend:'worker',deadline:1350,timer:1};f.api.jobs.set(10,job);f.api.entries.set('tile',entry);
 f.api.receive({requestId:10,phase:'compatible',error:'terrain_png_unsupported'});assert.equal(f.seen.allocations,0);assert.equal(f.seen.compat.length,1);assert.equal(f.seen.timers.at(-1).ms,350);assert.equal(job.backend,'main');assert.equal(entry.compatible,true);assert.equal(f.seen.compat[0].options.density,2);assert.equal(f.api.jobs.get(10),job);
 f.seen.compat[0].options.onMetadata({nativeDensity:2});const image={width:2,height:2};f.resolveLoad(image);await new Promise(r=>setImmediate(r));assert.equal(entry.bitmap,image);assert.equal(entry.nativeDensity,2);assert.equal(f.api.jobs.size,0);assert.equal(f.api.stats.loads,1);
});
test('malformed pixel reply remains an explicit failed tile without a cache surface',async()=>{
 const f=await mainFixture(),entry={tile:{id:'tile'},attempts:1,pending:true};f.api.jobs.set(10,{entry,generation:0,backend:'worker',deadline:2000,timer:1});f.api.entries.set('tile',entry);
 f.api.receive({requestId:10,phase:'ready',width:2,height:2,pixels:new Uint8ClampedArray(12)});assert.equal(f.seen.allocations,0);assert.equal(entry.bitmap,undefined);assert.equal(entry.failed,true);assert.equal(f.api.stats.failures,1);assert.equal(f.api.stats.loads,0);assert.equal(f.api.jobs.size,0);
});

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function queueSource(f){
 const entry={tile:{id:'source-tile',theme:'pixel',density:1,bounds:{x:0,y:0,w:1,h:1}},attempts:1,pending:true},job={entry,generation:0,backend:'worker',deadline:1350,timer:1};
 f.api.jobs.set(10,job);f.api.entries.set(entry.tile.id,entry);return{entry,job};
}
test('source materialization retains the original job and deadline, then installs one owner canvas',async()=>{
 const f=await mainFixture(),{entry,job}=queueSource(f),data={requestId:10,phase:'source',width:2,height:2,pixels:new Uint8ClampedArray(16),nativeDensity:2};
 const timers=f.seen.timers.length;f.api.receive(data);f.api.receive(data);assert.equal(f.seen.preparations.length,1);assert.equal(f.seen.timers.length,timers);assert.equal(f.api.jobs.get(10),job);assert.equal(entry.bitmap,undefined);assert.equal(entry.pending,true);assert.equal(f.api.stats.loads,0);
 const owner={width:1,height:1};f.seen.preparations[0].resolve(owner);await settle();assert.equal(entry.bitmap,owner);assert.equal(entry.nativeDensity,2);assert.equal(entry.pending,false);assert.equal(f.api.jobs.size,0);assert.equal(f.api.stats.loads,1);assert.equal(f.api.stats.bytes,4);
 f.api.receive(data);assert.equal(f.seen.preparations.length,1);assert.equal(f.api.stats.loads,1);
});
test('a late owner canvas cannot replace another job at the same identity or touch its pending state',async()=>{
 const f=await mainFixture(),{job}=queueSource(f);f.api.receive({requestId:10,phase:'source',width:2,height:2,pixels:new Uint8ClampedArray(16)});
 const replacement={...job,entry:{...job.entry,pending:true}};f.api.jobs.set(10,replacement);f.seen.preparations[0].resolve({width:2,height:2});await settle();assert.equal(f.seen.closed,1);assert.equal(f.api.jobs.get(10),replacement);assert.equal(replacement.entry.pending,true);assert.equal(replacement.entry.bitmap,undefined);assert.equal(f.api.stats.loads,0);assert.equal(f.api.stats.bytes,0);
});
test('worker expiry aborts owner preparation under its original timer and closes a late result',async()=>{
 const f=await mainFixture();queueSource(f);f.api.receive({requestId:10,phase:'source',width:2,height:2,pixels:new Uint8ClampedArray(16)});const preparation=f.seen.preparations[0];assert.equal(preparation.options.signal.aborted,false);
 f.api.workerFailure();assert.equal(preparation.options.signal.aborted,true);assert.equal(f.api.jobs.size,0);preparation.resolve({width:2,height:2});await settle();assert.equal(f.seen.closed,1);assert.equal(f.api.stats.loads,0);assert.equal(f.api.stats.bytes,0);
});
test('an asynchronous summer preview is installed before the original failed tile retires',async()=>{
 const f=await mainFixture(),{entry}=queueSource(f);f.api.receive({requestId:10,phase:'source',preview:true,width:2,height:2,pixels:new Uint8ClampedArray(16),error:'terrain_png_crc'});assert.equal(f.seen.preparations[0].options.preview,true);assert.equal(f.api.jobs.size,1);
 const preview={width:1,height:1};f.seen.preparations[0].resolve(preview);await settle();assert.equal(entry.preview,preview);assert.equal(entry.bitmap,undefined);assert.equal(entry.failed,true);assert.equal(entry.pending,false);assert.equal(f.api.jobs.size,0);assert.equal(f.api.stats.loads,0);assert.equal(f.api.stats.failures,1);assert.equal(f.api.stats.bytes,4);
});
test('owner preparation rejects a corrupt plane before allocating any drawing surface',async()=>{
 let count=0;await assert.rejects(prepareTerrainPixelSurface({width:2,height:2,pixels:new Uint8ClampedArray(12)},{theme:'pixel',bounds:{x:0,y:0,w:1,h:1}},{canvas:()=>{count++;return{};},Image:Pixels}),/terrain_pixel_surface_invalid/);assert.equal(count,0);
});
test('owner cancellation yields between bounded rows and releases both partial surfaces',async()=>{
 const controller=new AbortController(),surfaces=[],tile={theme:'pixel',patch:true,season:'summer',bounds:{x:0,y:0,w:2,h:40},core:{x:0,y:0,w:2,h:40}};
 const canvas=()=>{const surface={width:0,height:0,getContext(){return{putImageData(){},drawImage(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})};}};surfaces.push(surface);return surface;};
 await assert.rejects(prepareTerrainPixelSurface({width:4,height:80,pixels:new Uint8ClampedArray(4*80*4)},tile,{canvas,Image:Pixels,density:1,signal:controller.signal,yieldTask:async()=>controller.abort(Error('original-job-retired'))}),/original-job-retired/);
 assert.equal(surfaces.length,2);assert(surfaces.every(surface=>surface.width===1&&surface.height===1));
});
test('insufficient native source density is rejected before creating any owner surface',async()=>{
 let allocated=0;await assert.rejects(prepareTerrainPixelSurface({width:1,height:1,pixels:new Uint8ClampedArray(4)},{theme:'pixel',bounds:{x:0,y:0,w:1,h:1}},{canvas:()=>{allocated++;return{};},Image:Pixels}),/terrain_tile_resolution_too_low/);assert.equal(allocated,0);
});
test('failed summer tiles retain the cached CPU overview across real pixel-buffer transfers',async()=>{
 const tile={id:'bad-tile',theme:'pixel',season:'summer',patch:false,bounds:{x:0,y:0,w:1,h:1}},sent=[],fetched=[];
 const self={postMessage(data,transfer){sent.push(structuredClone(data,{transfer}));}};
 const scope=vm.createContext({self,...png,Uint8ClampedArray,fetch:async url=>{fetched.push(url);return new Response(image(url==='/overview'?'rgb':'corrupt'));},terrainOverviewURL:()=>'/overview',seasonalTerrain:()=>[tile],serveGpuWorkerEndpoint:receive=>{self.onmessage=receive;}});
 new vm.Script(worker).runInContext(scope);for(const requestId of [1,2])await self.onmessage({data:{requestId,theme:'pixel',season:'summer',id:tile.id,density:2}});
 assert.equal(sent.length,2);assert.deepEqual(sent.map(row=>row.requestId),[1,2]);assert(sent.every(row=>row.phase==='source'&&row.preview&&row.error==='terrain_png_crc'&&row.pixels.byteLength===16));assert.deepEqual([...sent[0].pixels],[...sent[1].pixels]);assert.equal(fetched.filter(url=>url==='/overview').length,1);
});
