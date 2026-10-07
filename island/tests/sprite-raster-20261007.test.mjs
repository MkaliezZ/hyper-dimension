import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpriteRasterCache} from '../src/spriteRaster.js';
const ctx=(a=1,b=0,c=0,d=a)=>({getTransform:()=>({a,b,c,d})});
function fixture(maxPixels){const draws=[];const cache=createSpriteRasterCache({maxPixels,canvas:()=>({getContext:()=>({drawImage:(...args)=>draws.push(args)})})});return{cache,draws};}
test('actual rig cropping preserves frame geometry, alpha and repeated draw reuse at current backing scale',()=>{
 const {cache,draws}=fixture(),image={},frame={x:400,y:600,w:350,h:560},a=cache.prepare(ctx(1),image,frame);
 assert(a);assert.equal(draws.length,1);assert.deepEqual(draws[0].slice(0,5),[image,400,600,350,560]);assert.equal(a.frame.aspectRatio,350/560);assert.equal(a.frame.w,a.image.width);assert.equal(a.frame.h,a.image.height);assert.equal(a.frame.h,128);assert.equal(cache.prepare(ctx(1),image,{...frame}),a);assert.equal(draws.length,1);assert.equal(cache.inspect().hits,1);
});
test('zoom/DPR and rotated transforms choose enough pixels; large views retain original art and image identities remain distinct',()=>{
 const {cache,draws}=fixture(),image={},frame={x:10,y:20,w:350,h:560};
 const small=cache.prepare(ctx(.65),image,frame),dense=cache.prepare(ctx(2),image,frame),turned=cache.prepare(ctx(0,2,-2,0),image,frame);
 assert.equal(dense,turned);assert(dense.frame.h>=96*2);assert(dense.frame.h>small.frame.h);assert.equal(cache.prepare(ctx(8),image,frame),null);assert.notEqual(cache.prepare(ctx(.65),{},frame),small);assert.equal(draws.length,3);
});
test('eviction bounds retained pixels and never changes the original frame or artwork',()=>{
 const {cache}=fixture(28000),image={},original={x:0,y:0,w:200,h:500},copy={...original};
 for(let i=0;i<30;i++)cache.prepare(ctx(1),image,{...original,x:i*200});assert(cache.inspect().pixels<=28000);assert(cache.inspect().entries<30);assert.deepEqual(original,copy);assert.equal(cache.prepare(ctx(1),image,{x:0,y:0,w:0,h:50}),null);assert.equal(cache.prepare(ctx(NaN),image,original),null);
});

test('asynchronous high-quality refinement has bounded concurrency and disposes late results after eviction',async()=>{
 const pending=[],closed=[],draws=[],cache=createSpriteRasterCache({maxPixels:10000,canvas:()=>({getContext:()=>({drawImage:(...args)=>draws.push(args)})}),bitmap:(...args)=>new Promise(resolve=>pending.push({args,resolve}))});
 const image={},frame={x:0,y:0,w:200,h:500};const first=cache.prepare(ctx(1),image,frame),second=cache.prepare(ctx(1),image,{...frame,x:200});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(pending.length,2);assert.equal(pending[0].args.at(-1).resizeQuality,'high');
 pending[0].resolve({id:'retired',close:()=>closed.push('retired')});pending[1].resolve({id:'current',close:()=>closed.push('current')});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(closed,['retired']);assert.equal(second.image.id,'current');assert.equal(cache.inspect().refined,1);assert.notEqual(first.image.id,'retired');
 cache.prepare(ctx(1),image,{...frame,x:400});assert.deepEqual(closed,['retired','current']);assert.equal(createSpriteRasterCache({maxPixels:1,canvas:()=>{throw Error('must not allocate')}}).prepare(ctx(1),image,frame),null);
});
