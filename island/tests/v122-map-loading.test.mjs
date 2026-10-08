import test from 'node:test';import assert from 'node:assert/strict';
import {terrainTiles,maskTerrain,maskTerrainRows} from '../src/mapTileLayout.js';
test('compatible strip masking is byte-identical to worker masking across terrain seams and coast',()=>{
 for(const tile of terrainTiles('pixel')){
  const width=137,height=129,full=new Uint8ClampedArray(width*height*4),striped=new Uint8ClampedArray(full.length);
  for(let i=0;i<full.length;i+=4)full.set(i%12===0?[15,130,190,255]:[175,142,95,210],i);
  striped.set(full);maskTerrain(full,width,height,tile);
  for(let y=0;y<height;y+=32){const count=Math.min(32,height-y),strip=striped.subarray(y*width*4,(y+count)*width*4);maskTerrainRows(strip,width,height,tile,y,count);}
  assert.deepEqual(striped,full,tile.id);
 }
});

import {seaTilePlacements,SEA_CELL} from '../src/seaTiles.js';import {readFileSync} from 'node:fs';
test('high-resolution ocean tiles cover the whole expanded world and cull offscreen cells',()=>{
 const extent={width:1856,height:1248},all=seaTilePlacements({x:0,y:0,w:1856,h:1248},extent);assert.equal(all.length,20);
 for(const theme of ['pixel','origami']){const b=readFileSync(`public/assets/map-tiles-v122/${theme}-sea.png`);assert(b.readUInt32BE(16)>=SEA_CELL*3);assert(b.readUInt32BE(20)>=SEA_CELL*3);}
 const view={x:1500,y:1000,w:300,h:200},visible=seaTilePlacements(view,extent);assert(visible.length<20);assert(visible.every(t=>t.x<view.x+view.w&&t.y<view.y+view.h&&t.x+t.size>view.x&&t.y+t.size>view.y));
});
test('reflected ocean cells share exactly the same source coordinates at every edge',()=>{
 const extent={width:1856,height:1248},tiles=seaTilePlacements({x:0,y:0,w:1856,h:1248},extent),sample=(t,x,y)=>({x:t.flipX?1-x:x,y:t.flipY?1-y:y});
 for(const t of tiles){const right=tiles.find(n=>n.col===t.col+1&&n.row===t.row),below=tiles.find(n=>n.col===t.col&&n.row===t.row+1);
  for(const v of [0,.25,.5,.75,1]){if(right)assert.deepEqual(sample(t,1,v),sample(right,0,v));if(below)assert.deepEqual(sample(t,v,1),sample(below,v,0));}
 }
});
