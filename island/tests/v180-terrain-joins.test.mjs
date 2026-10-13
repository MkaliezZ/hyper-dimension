import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {TERRAIN_JOIN_REPAIRS} from '../src/terrainJoinRepairs.js';import {terrainTiles,terrainLandmarks,tileWeight} from '../src/mapTileLayout.js';
test('both appearances use native continuous join corrections with preserved world coordinates',()=>{
 for(const theme of ['pixel','origami']){const repairs=terrainLandmarks(theme).filter(t=>t.url.includes('/map-joins-v180/'));assert.equal(repairs.length,3);for(const [i,t]of repairs.entries()){assert.deepEqual(t.bounds,TERRAIN_JOIN_REPAIRS[i].bounds);const png=readFileSync('public'+t.url);assert(png.readUInt32BE(16)/t.bounds.w>=2.79);assert(png.readUInt32BE(20)/t.bounds.h>=2.79);assert.equal(tileWeight(t,t.bounds.x,t.bounds.y+t.bounds.h/2),0);assert.equal(tileWeight(t,t.core.x+t.core.w/2,t.core.y+t.core.h/2),1);}}
});
test('every regional join and landmark perimeter is included in the review inventory',()=>{
 for(const theme of ['pixel','origami']){const tiles=terrainTiles(theme),pairs=tiles.flatMap(a=>tiles.filter(b=>b.col===a.col+1&&b.row===a.row||b.row===a.row+1&&b.col===a.col).map(b=>[a.id,b.id]));assert.equal(pairs.length,49);assert.equal(new Set(pairs.map(p=>p.join('__'))).size,49);assert.equal(terrainLandmarks(theme).length,10);}
});
