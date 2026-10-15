import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {SEASONS,seasonalTerrain} from '../src/seasonTerrain.js';
import {TILE_MAP,tileWeight,tileIntersects} from '../src/mapTileLayout.js';
import {seasonOverviewURL} from '../src/seasonOverview.js';

test('all eight seasonal worlds have complete native assets and unchanged ground coordinates',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../public/assets/season-terrain-v187/manifest.json',import.meta.url)));
 assert.equal(manifest.assets.length,280);const listed=new Map(manifest.assets.map(a=>[a.path,a]));
 for(const theme of ['pixel','origami']){
  const baseline=seasonalTerrain(theme,'summer');
  for(const season of SEASONS){const terrain=seasonalTerrain(theme,season);assert.equal(terrain.length,44);assert.equal(new Set(terrain.map(t=>t.id)).size,44);
   for(const [i,tile] of terrain.entries()){
    assert.deepEqual(tile.bounds,baseline[i].bounds,'changing season cannot move a building entrance or field');
    const bytes=readFileSync(new URL('../public'+tile.url,import.meta.url));assert(bytes.readUInt32BE(16)>=tile.bounds.w*2);assert(bytes.readUInt32BE(20)>=tile.bounds.h*2);
    if(tile.url.includes('/season-terrain-v187/')){const entry=listed.get(tile.url.split('/season-terrain-v187/')[1]);assert(entry);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);}
   }
   const preview=readFileSync(new URL('../public'+seasonOverviewURL(theme,season),import.meta.url));assert.equal(preview.readUInt32BE(16),TILE_MAP.width);assert.equal(preview.readUInt32BE(20),TILE_MAP.height);
  }
 }
});
test('seasonal seams have neither holes nor overlapping opacity; local patch masks retain opaque centers',()=>{
 for(const theme of ['pixel','origami'])for(const season of SEASONS){const all=seasonalTerrain(theme,season),base=all.filter(t=>!t.patch);
  for(let y=.5;y<TILE_MAP.height;y+=17.75)for(let x=.5;x<TILE_MAP.width;x+=19.25){const total=base.filter(t=>tileIntersects(t,{x,y,w:.001,h:.001})).reduce((sum,t)=>sum+tileWeight(t,x,y),0);assert(Math.abs(total-1)<1e-9,`${theme}/${season}/${x}/${y}: ${total}`);}
  for(const tile of all.filter(t=>t.patch)){const b=tile.bounds;assert.equal(tileWeight(tile,b.x+b.w/2,b.y+b.h/2),1);assert.equal(tileWeight(tile,b.x,b.y+b.h/2),0);}
 }
});
