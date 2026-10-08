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
