import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {HOUSE_ATLAS_BOUNDS} from '../src/houseAtlasBounds.js';import {artworkURL,fadeIslandEdge,shoreOptions} from '../src/rasterProcessing.js';
test('both baked 25-house crops correspond to the actual immutable artwork',()=>{
 for(const theme of ['pixel','origami']){
  const v=HOUSE_ATLAS_BOUNDS[theme],b=readFileSync('public'+v.src);assert.equal(createHash('sha256').update(b).digest('hex'),v.sha256,'regenerate crops when artwork changes');assert.equal(b.readUInt32BE(16),v.width);assert.equal(b.readUInt32BE(20),v.height);assert.equal(v.bounds.length,25);
  for(let i=0;i<25;i++){const r=v.bounds[i],left=Math.round(i%5*v.width/5),top=Math.round(Math.floor(i/5)*v.height/5),right=Math.round((i%5+1)*v.width/5),bottom=Math.round((Math.floor(i/5)+1)*v.height/5);assert(r.w>100&&r.h>100);assert(r.x>=left&&r.y>=top&&r.x+r.w<=right&&r.y+r.h<=bottom);}
 }
});
test('only local artwork URLs enter the reconstruction worker',()=>{
 const base='http://127.0.0.1:4175/play';assert.equal(artworkURL('/assets/island-pixel-v9.png',base),'http://127.0.0.1:4175/assets/island-pixel-v9.png');
 for(const s of ['/api/saves/current','https://outside.invalid/assets/island.png','data:image/png;base64,abc','/assets/../data/save.json','http://guest:secret@127.0.0.1:4175/assets/map.png'])assert.throws(()=>artworkURL(s,base));
});
test('shoreline feathering preserves land and only fades ocean at the original right/bottom rim',()=>{
 const w=8,h=8,d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4)d.set([20,120,180,255],i);d.set([160,120,80,255],((h-1)*w+w-1)*4);
 fadeIslandEdge(d,w,h,{width:512,height:512,rim:128});assert.equal(d[3],255);assert.equal(d[(w-1)*4+3],0);assert.equal(d[((h-1)*w)*4+3],0);assert.equal(d[((h-1)*w+w-1)*4+3],255);assert.equal(d[(w-2)*4+3],128);
 const full=new Uint8ClampedArray(w*h*4),chunked=new Uint8ClampedArray(w*h*4);for(let i=0;i<full.length;i+=4)full.set([20,120,180,255],i);chunked.set(full);const extent=shoreOptions({width:512,height:512});fadeIslandEdge(full,w,h,extent);for(let y=0;y<h;y+=2)fadeIslandEdge(chunked,w,h,extent,y,y+2);assert.deepEqual(chunked,full);assert.throws(()=>shoreOptions({width:-1,height:20}));
});
