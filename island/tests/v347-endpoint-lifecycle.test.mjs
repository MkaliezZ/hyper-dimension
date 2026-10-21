import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const body=(await readFile(new URL('../src/gpuWorkerEndpoint.js',import.meta.url),'utf8')).replace(/export /g,'');
function fixture(){
 const listeners=new Map(),shared=[],dedicated=[];
 const makePort=()=>({sent:[],closed:0,started:0,postMessage(data,transfer){this.sent.push({data,transfer});},close(){this.closed++;},start(){this.started++;}});
 class Shared{constructor(url,options){this.url=String(url);this.options=options;this.port=makePort();shared.push(this);}}
 class Dedicated{constructor(url,options){this.url=String(url);this.options=options;this.closed=0;this.sent=[];dedicated.push(this);}postMessage(data,transfer){this.sent.push({data,transfer});}terminate(){this.closed++;}}
 const context={URL,SharedWorker:Shared,Worker:Dedicated,addEventListener:(name,fn)=>{const set=listeners.get(name)||new Set();set.add(fn);listeners.set(name,set);},removeEventListener:(name,fn)=>listeners.get(name)?.delete(fn)};
 vm.runInNewContext(body+'\nglobalThis.api={createGpuWorkerEndpoint,serveGpuWorkerEndpoint,gpuEndpointStatus};',context);
 return{context,shared,dedicated,listeners,makePort,api:context.api,hide:persisted=>{for(const fn of [...listeners.get('pagehide')||[]])fn({persisted});}};
}
test('each document caller gets an independently named Dedicated module and exact transfer ownership',()=>{
 const f=fixture(),a=f.api.createGpuWorkerEndpoint('https://owned/src/worker.js'),b=f.api.createGpuWorkerEndpoint('https://owned/src/worker.js');
 assert.equal(a.transport,'dedicated-worker');assert.equal(b.transport,'dedicated-worker');assert.notEqual(f.dedicated[0].options.name,f.dedicated[1].options.name);assert.notEqual(f.dedicated[0].url,f.dedicated[1].url);assert.equal(f.dedicated[0].options.type,'module');
 const data={kind:'raster',requestId:7},bitmap={};a.postMessage(data,[bitmap]);assert.equal(f.dedicated[0].sent[0].data,data);assert.equal(f.dedicated[0].sent[0].transfer[0],bitmap);assert.equal(f.dedicated[1].sent.length,0);assert.equal(f.shared.length,0);
});
test('actual navigation terminates the document worker once; bfcache and late bitmap ownership remain correct',()=>{
 const f=fixture(),endpoint=f.api.createGpuWorkerEndpoint('https://owned/src/worker.js');let delivered=0;endpoint.onmessage=()=>delivered++;
 f.hide(true);assert.equal(f.dedicated[0].closed,0);f.hide(false);endpoint.terminate();assert.equal(f.dedicated[0].closed,1);assert.equal(f.listeners.get('pagehide').size,0);
 let closed=0;f.dedicated[0].onmessage({data:{bitmap:{close(){closed++;}}}});assert.equal(closed,1);assert.equal(delivered,0);assert.throws(()=>endpoint.postMessage({}),/graphics_endpoint_closed/);
});
test('an unavailable Dedicated module preserves a separately named native Shared module fallback',()=>{
 const f=fixture();class Unavailable{constructor(){throw Error('unsupported dedicated module');}}
 const endpoint=f.api.createGpuWorkerEndpoint('https://owned/src/worker.js?revision=1',{Dedicated:Unavailable,Shared:f.context.SharedWorker});assert.equal(endpoint.transport,'shared-worker');assert.equal(f.shared.length,1);assert(f.shared[0].url.includes('gpuEndpoint='));assert(f.shared[0].url.includes('revision=1'));
 f.hide(false);endpoint.terminate();assert.equal(f.shared[0].port.closed,1);assert.equal(f.shared[0].port.sent[0].data.kind,'__hd_graphics_close');
});
test('a constructor failure in both native transports fails explicitly and records no live endpoint',()=>{
 const f=fixture();class Unavailable{constructor(){throw Error('unsupported');}}
 assert.throws(()=>f.api.createGpuWorkerEndpoint('https://owned/src/worker.js',{Dedicated:Unavailable,Shared:Unavailable}),/graphics_endpoint_unavailable/);assert.equal(f.api.gpuEndpointStatus().length,1);assert.equal(f.api.gpuEndpointStatus()[0].closed,true);assert.equal(f.listeners.size,0);
});
test('a shared fallback scope accepts only its owning port and closes stale outgoing bitmaps',()=>{
 const f=fixture(),received=[],scope={closed:0,close(){this.closed++;}};f.api.serveGpuWorkerEndpoint(event=>received.push(event.data),scope);
 const first=f.makePort(),other=f.makePort();scope.onconnect({ports:[first]});scope.onconnect({ports:[other]});assert.equal(other.closed,1);assert.equal(first.started,1);
 first.onmessage({data:{kind:'frame',requestId:3}});assert.equal(received.length,1);scope.postMessage({kind:'frame'},[]);assert.equal(first.sent.length,1);
 first.onmessage({data:{kind:'__hd_graphics_close'}});assert.equal(scope.closed,1);assert.equal(first.closed,1);let closed=0;scope.postMessage({bitmap:{close(){closed++;}}});assert.equal(closed,1);assert.equal(first.sent.length,1);
});
test('dedicated scopes retain the original receive function without shared handlers',()=>{
 const f=fixture(),scope={postMessage(){}},receive=()=>{};f.api.serveGpuWorkerEndpoint(receive,scope);assert.equal(scope.onmessage,receive);assert.equal(scope.onconnect,undefined);
});
