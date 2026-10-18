import test from 'node:test';
import assert from 'node:assert/strict';
import {createPoseAtlas} from '../src/poseAtlas.js';

function fixture(options={}){
 const canvases=[],calls=[];
 const cache=createPoseAtlas({...options,canvas(){
  let image;const g=Object.fromEntries(['save','restore','setTransform','clearRect','beginPath','rect','clip','translate','drawImage'].map(name=>[name,(...args)=>calls.push({name,args,image})]));
  image={width:0,height:0,getContext(){return g;}};canvases.push(image);return image;
 }});
 return {cache,canvases,calls};
}
test('thousands of poses share a bounded number of backing pages',()=>{
 const {cache,canvases}=fixture();
 for(let n=0;n<5000;n++)assert(cache.put('pose-'+n,40,75,()=>{},{x:-20,y:-75,w:40,h:75}));
 const s=cache.inspect();assert(s.bytes<=s.limitBytes);assert(s.pages<=16);assert(s.entries>1000);assert(canvases.length<40);
 const p=cache.get('pose-4999');assert.equal(p.sw,40);assert.equal(p.sh,75);assert.equal(p.w,40);assert.equal(p.h,75);assert(p.sx>=1&&p.sy>=1);
});
test('a repeated pose is reused and painting is clipped to its own rectangle',()=>{
 const {cache,calls}=fixture();let paints=0;
 const first=cache.put('a',40,75,()=>paints++),second=cache.put('a',40,75,()=>paints++);
 assert.equal(first,second);assert.equal(paints,1);assert.deepEqual(calls.find(c=>c.name==='rect'&&c.image===first.image).args,[first.sx,first.sy,40,75]);
 assert.deepEqual(calls.find(c=>c.name==='clearRect'&&c.image===first.image).args,[first.sx-1,first.sy-1,42,77]);
 assert.deepEqual(calls.find(c=>c.name==='rect'&&c.image!==first.image).args,[0,0,40,75]);
 assert.equal(calls.filter(c=>c.name==='save').length,calls.filter(c=>c.name==='restore').length);
});
test('page eviction invalidates every old key and releases its backing',()=>{
 const {cache}=fixture({pageSize:8,maxBytes:256});
 const a=cache.put('a',6,6,()=>{});assert(a);const b=cache.put('b',6,6,()=>{});assert(b);
 assert.equal(a.image.width,0);assert.equal(a.image.height,0);assert.equal(cache.get('a'),undefined);assert.equal(cache.get('b'),b);assert.equal(cache.inspect().bytes,256);
});
test('the first interpolation pose stays pinned while its neighbour is requested',()=>{
 const {cache}=fixture({pageSize:8,maxBytes:256});
 const a=cache.put('a',6,6,()=>{});assert.equal(cache.put('b',6,6,()=>{},{},['a']),null);assert.equal(cache.get('a'),a);assert.equal(a.image.width,8);
});
test('oversized poses fall back without creating or evicting surfaces',()=>{
 const {cache,canvases}=fixture({pageSize:8,maxBytes:256});const a=cache.put('a',6,6,()=>{}),count=canvases.length;
 assert.equal(cache.put('too-large',20,20,()=>{}),null);assert.equal(cache.get('a'),a);assert.equal(canvases.length,count);
 cache.clear();assert.equal(cache.inspect().bytes,0);assert.equal(cache.inspect().entries,0);assert.equal(cache.inspect().pages,0);assert.equal(a.image.width,0);
});
