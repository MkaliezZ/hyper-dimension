import test from 'node:test';import assert from 'node:assert/strict';import {visibleFrameSeconds} from '../src/frameClock.js';import {followPath} from '../src/movement.js';import {sampleLanMotion} from '../src/lanMotion.js';
for(const fps of [8,10,15,30,60,165])test(`visible walking preserves distance at ${fps} FPS`,()=>{const a={x:0,y:0,path:[{x:1000,y:0}]};let previous=0;for(let i=1;i<=fps;i++){const at=i*1000/fps;followPath(a,visibleFrameSeconds(at,previous),142);previous=at;}assert(Math.abs(a.x-142)<1e-6);});
test('hidden and suspended frames cannot accrue a long catch-up interval',()=>{assert.equal(visibleFrameSeconds(2000,0,true),0);assert.equal(visibleFrameSeconds(2000,0),.15);assert.equal(visibleFrameSeconds(10,20),0);assert.equal(visibleFrameSeconds(NaN,0),0);});
for(const fps of [8,15,60])test(`delayed confirmed route catches up without teleport or excessive speed at ${fps} FPS`,()=>{const a={x:0,y:0},p={x:0,y:0,updatedAt:1000,online:true,walking:true,direction:0,speed:80,route:[{x:200,y:0}]};sampleLanMotion(a,p,1/fps,0,()=>true);p.x=120;p.updatedAt=2500;p.walking=false;let before=0;for(let i=0;i<=fps*3;i++){sampleLanMotion(a,p,1/fps,1500+i*1000/fps,()=>true);assert(a.x>=before);assert(a.x-before<=120/fps+.001);assert(a.x<=120);before=a.x;}assert.equal(a.x,120);assert.equal(a.walking,false);});

test('a process with two data leases cannot hide a missing lease behind its other valid lease',async()=>{
 const {mkdtemp,realpath,readFile,writeFile,unlink}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join,resolve}=await import('node:path');
 const {acquireDataLease,registeredRuntimePids}=await import('../server/dataLease.mjs');
 const root=await mkdtemp(join(await realpath(tmpdir()),'hd-multiple-leases-')),project=resolve(import.meta.dirname,'..');
 const first=await acquireDataLease({directory:join(root,'first')}),second=await acquireDataLease({directory:join(root,'second')});let file,bytes;
 try{assert((await registeredRuntimePids(project)).has(process.pid));const {readdir}=await import('node:fs/promises');file=join(root,(await readdir(root)).find(n=>n.startsWith('.first.hd-runtime-')));bytes=await readFile(file);await unlink(file);assert(!(await registeredRuntimePids(project)).has(process.pid));await writeFile(file,bytes);bytes=null;assert((await registeredRuntimePids(project)).has(process.pid));}finally{if(bytes)await writeFile(file,bytes);await first.release();await second.release();}
});

test('changed companion route reconciles a blocked corner without resync or future prediction',()=>{
 const a={x:0,y:0},p={x:0,y:0,updatedAt:1000,online:true,direction:0,speed:72,route:[{x:0,y:-100}]};
 const clear=(a,b)=>a.y===0&&b.y===0||a.x===100&&b.x===100;
 sampleLanMotion(a,p,.1,0,clear);p.x=100;p.y=100;p.updatedAt=2000;p.route=[{x:100,y:200}];let calls=0;
 const reconcile=()=>{calls++;return[{x:100,y:0},{x:100,y:100}];};
 for(let i=0;i<=40;i++){const before={x:a.x,y:a.y};sampleLanMotion(a,p,.1,1000+i*100,clear,reconcile);assert(!a.resynced);assert(a.y===0||a.x===100);assert(a.y<=100);assert(Math.hypot(a.x-before.x,a.y-before.y)<=10.80001);}
 assert.equal(calls,1);assert.equal(a.x,100);assert.equal(a.y,100);
});
