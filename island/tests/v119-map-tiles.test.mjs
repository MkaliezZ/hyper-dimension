import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{terrainTiles,terrainLandmarks,tileWeight,tileIntersects,terrainViewport,maskTerrain}from'../src/mapTileLayout.js';
test('two themes each cover the expanded contiguous world exactly with 15 genuine high resolution assets',()=>{
 for(const theme of ['pixel','origami']){const tiles=terrainTiles(theme);assert.equal(tiles.length,15);assert.equal(tiles.reduce((sum,t)=>sum+t.core.w*t.core.h,0),1856*1024);
  for(const tile of [...tiles,...terrainLandmarks(theme)]){const bytes=readFileSync('public'+tile.url);assert(bytes.readUInt32BE(16)>=tile.bounds.w*2);assert(bytes.readUInt32BE(20)>=tile.bounds.h*2);assert(Math.abs(bytes.readUInt32BE(16)/bytes.readUInt32BE(20)-tile.bounds.w/tile.bounds.h)<.015,tile.id);}
 }
});
test('adjacent support weights sum to one along seams and four-way corners',()=>{
 const tiles=terrainTiles('pixel');
 for(let y=.5;y<1024;y+=5.75)for(let x=.5;x<1856;x+=5.25){const sum=tiles.filter(t=>tileIntersects(t,{x,y,w:.001,h:.001})).reduce((a,t)=>a+tileWeight(t,x,y),0);assert(Math.abs(sum-1)<1e-10,`${x},${y}: ${sum}`);}
});
test('viewport uses physical canvas transform, including fractional DPR and dragging',()=>{
 assert.deepEqual(terrainViewport({a:2,b:0,c:0,d:2,e:-600,f:-200},1200,800),{x:300,y:100,w:600,h:400});
 const view=terrainViewport({a:3.75,b:0,c:0,d:3.75,e:-2880,f:-1440},1440,960);assert.equal(view.x,768);assert.equal(view.y,384);assert.equal(view.w,384);assert.equal(terrainViewport({a:0,b:0,c:0,d:0,e:0,f:0},100,100),null);
 const visible=terrainTiles('pixel').filter(t=>tileIntersects(t,view));assert(visible.length<12);assert(visible.some(t=>t.col===2&&t.row===1));
});
test('worker mask preserves land at the outer rim, fades only sea, and applies shared corner weights',()=>{
 const tile=terrainTiles('pixel').at(-1),w=tile.bounds.w,h=tile.bounds.h,d=new Uint8ClampedArray(w*h*4);for(let i=0;i<d.length;i+=4)d.set([15,130,190,255],i);d.set([175,142,95,255],(w*h-1)*4);maskTerrain(d,w,h,tile);assert.equal(d.at(-1),255);assert(d[(w-1)*4+3]<1);assert(d[((h-1)*w)*4+3]<1);assert(d[(150*w+150)*4+3]>30);
});
