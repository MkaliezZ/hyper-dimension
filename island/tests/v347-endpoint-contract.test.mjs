const snapshotStub='// Snapshot acquisition is stubbed here to isolate producer ordering; the real\n// pixel plane has its own contracts and native zero-difference comparisons.\nconst captureGpuFrame=(_gl,canvas)=>createImageBitmap(canvas);\n';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const folder=fileURLToPath(new URL('../src/',import.meta.url));
const {serveGpuWorkerEndpoint}=await import(new URL('../src/gpuWorkerEndpoint.js',import.meta.url));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
async function receiver(name,shared){
 const output=[],self={location:{href:'http://owned.invalid/src/'+name,origin:'http://owned.invalid'},closed:false,close(){this.closed=true;}};
 if(!shared)self.postMessage=(data,transfer=[])=>output.push({data,transfer});
 const context={self,performance,URL,Float32Array,Uint8Array,Uint8ClampedArray,
  serveGpuWorkerEndpoint:receive=>serveGpuWorkerEndpoint(receive,self),
  artworkURL:value=>value,shoreOptions:value=>value,seasonalTerrain:()=>[{id:'tile',patch:true,season:'spring'}],
  fetch:async()=>{throw Error('owned-terrain-fetch-failed');}
 };
 vm.runInNewContext(snapshotStub+(await readFile(folder+name,'utf8')).replace(/^import .*;\r?\n/gm,''),context,{filename:name});
 const port={closed:false,started:false,postMessage(data,transfer=[]){output.push({data,transfer});},close(){this.closed=true;},start(){this.started=true;}};
 if(shared){self.onconnect({ports:[port]});assert(port.started);const other={closed:false,close(){this.closed=true;}};self.onconnect({ports:[other]});assert(other.closed);}
 return{output,self,send:data=>shared?port.onmessage({data}):self.onmessage({data}),port};
}
for(const [name,input,message]of [
 ['rasterQualityWorker.js',{requestId:101,url:'/assets/owned.png',theme:'invalid'},'invalid_artwork_theme'],
 ['mapTileWorker.js',{requestId:102,id:'tile',theme:'pixel',season:'spring',density:1},'owned-terrain-fetch-failed'],
 ['spriteRasterWorker.js',{requestId:103,operation:'invalid'},'unknown_artwork_operation']
])for(const shared of [false,true])test(name+' retains '+(shared?'private SharedWorker':'original Dedicated Worker')+' request identity and failure semantics',async()=>{
 const f=await receiver(name,shared);await f.send(input);await flush();assert.equal(f.output.length,1);assert.equal(f.output[0].data.requestId,input.requestId);assert.equal(f.output[0].data.error,message);assert.equal(f.output[0].transfer.length,0);
 if(shared){f.send({kind:'__hd_graphics_close'});assert(f.self.closed);assert(f.port.closed);assert.equal(f.output.length,1);}
});
