import test from 'node:test';
import assert from 'node:assert/strict';
import {createOceanSurfaceClient} from '../src/oceanSurfaceClient.js';
const field=()=>({width:2,height:2,cell:4,water:new Uint8Array([0,1,1,1])});
const frame=(time=0,extra={})=>({width:16,height:12,worldWidth:8,worldHeight:8,inverse:[1,0,0,0,1,0,0,0,1],theme:'pixel',time,...extra});
const bitmap=()=>({closed:0,close(){this.closed++;}});
function fixture(options={}){
 const sent=[],timers=new Map();let serial=0;
 const worker={postMessage:data=>sent.push(data),terminate(){this.terminated=true;}};
 const client=createOceanSurfaceClient({worker:()=>worker,schedule:fn=>{const id=++serial;timers.set(id,fn);return id;},cancel:id=>timers.delete(id),...options});
 const receive=data=>worker.onmessage({data});
 const register=()=>receive({kind:'registered',fieldId:sent.find(x=>x.kind==='field').fieldId});
 const requests=()=>sent.filter(x=>x.kind==='frame');
 return {client,worker,sent,timers,receive,register,requests};
}
test('ocean keeps one producer frame and only the newest pending time',()=>{
 const f=fixture(),coast=field();assert.equal(f.client.frame(coast,frame()),null);f.register();
 for(let i=1;i<=200;i++)f.client.frame(coast,frame(i/1000));
 assert.equal(f.requests().length,1);assert.equal(f.client.inspect().pendingFrames,1);assert.equal(f.client.inspect().queuedFrames,1);
 const first=f.requests()[0].frame,image=bitmap();f.receive({kind:'frame',requestId:first.requestId,bitmap:image});
 assert.equal(f.requests().length,2);assert.equal(f.requests()[1].frame.time,.2);assert.equal(f.client.frame(coast,frame(.2)),image);f.client.dispose();assert.equal(image.closed,1);
});
test('a late frame from another camera is closed and cannot cover the island',()=>{
 const f=fixture(),coast=field();f.client.frame(coast,frame());f.register();const old=f.requests()[0].frame;
 const camera=frame(.1,{inverse:[1,0,0,0,1,0,300,0,1]});f.client.frame(coast,camera);const stale=bitmap();f.receive({kind:'frame',requestId:old.requestId,bitmap:stale});
 assert.equal(stale.closed,1);assert.equal(f.client.frame(coast,camera),null);const next=f.requests()[1].frame,correct=bitmap();f.receive({kind:'frame',requestId:next.requestId,bitmap:correct});assert.equal(f.client.frame(coast,camera),correct);f.client.dispose();assert.equal(correct.closed,1);
});
test('theme and backing size changes reject old water frames without rescaling',()=>{
 const f=fixture(),coast=field();f.client.frame(coast,frame());f.register();const old=f.requests()[0].frame,image=bitmap();f.receive({kind:'frame',requestId:old.requestId,bitmap:image});
 assert.equal(f.client.frame(coast,frame(.1,{theme:'origami',width:32,height:24})),null);const next=f.requests().at(-1).frame;assert.equal(next.width,32);assert.equal(next.height,24);assert.equal(next.theme,'origami');f.client.dispose();assert.equal(image.closed,1);
});
test('repeated paused time reuses the completed exact frame',()=>{
 const f=fixture(),coast=field();f.client.frame(coast,frame());f.register();const job=f.requests()[0].frame,image=bitmap();f.receive({kind:'frame',requestId:job.requestId,bitmap:image});
 for(let i=0;i<100;i++)assert.equal(f.client.frame(coast,frame()),image);assert.equal(f.requests().length,1);f.client.dispose();
});
test('real context loss clears bitmaps and waits for explicit restoration',()=>{
 const f=fixture(),coast=field();f.client.frame(coast,frame());f.register();const job=f.requests()[0].frame,image=bitmap();f.receive({kind:'frame',requestId:job.requestId,bitmap:image});f.receive({kind:'lost'});assert.equal(image.closed,1);assert.equal(f.client.frame(coast,frame(.2)),null);assert.equal(f.requests().length,1);
 f.receive({kind:'restored'});assert.equal(f.requests().length,2);assert.equal(f.requests()[1].frame.time,.2);f.client.dispose();
});
test('worker failure closes artwork and releases every pending timer',()=>{
 const f=fixture(),coast=field();f.client.frame(coast,frame());f.register();const job=f.requests()[0].frame,image=bitmap();f.receive({kind:'frame',requestId:job.requestId,bitmap:image});f.client.frame(coast,frame(.1));f.worker.onerror();assert.equal(image.closed,1);assert.equal(f.timers.size,0);assert.equal(f.worker.terminated,true);assert.equal(f.client.frame(coast,frame(.2)),null);assert.equal(f.client.inspect().backend,'canvas-compatible');
});
test('oversized frames are rejected before allocating a Worker',()=>{
 let workers=0;const f=fixture({worker:()=>{workers++;throw Error('Must not allocate');},maxFrameBytes:64});assert.equal(f.client.frame(field(),frame()),null);assert.equal(workers,0);assert.equal(f.sent.length,0);f.client.dispose();
});
