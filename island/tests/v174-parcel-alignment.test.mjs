import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SLOTS,worldWalkableForTheme,findWorldPathForTheme} from '../src/world.js';
import {PERMANENT_HOMES,ISLAND_GEOGRAPHY} from '../src/islandGeography.js';
import {productionGeometry,residenceGeometry,mapBuildingHit} from '../src/buildingGeometry.js';
import {WORLD_EDGES} from '../src/worldNavigationEdges.js';
for(const theme of ['pixel','origami']){
 test(theme+' all 41 visible buildings select the correct identity with proportional sprites',()=>{
  const rows=[...SLOTS.map(s=>({kind:'production',id:s.id,g:productionGeometry(s,theme)})),...PERMANENT_HOMES.map(s=>({kind:'home',id:s.ownerId,g:residenceGeometry(s,theme)}))];
  for(const {kind,id,g}of rows){
   const hit=mapBuildingHit({x:g.doorX,y:g.foot-g.h*.4},theme,SLOTS);
   assert.equal(hit?.kind,kind,kind+':'+id);assert.equal(hit.id,id);
   assert(Math.abs(g.w/g.h-g.crop.w/g.crop.h)<1e-8);
   assert(g.w<=g.groundRect.w+12);assert(g.foot>=g.groundRect.y&&g.foot<=g.groundRect.y+g.groundRect.h+3);
   assert.equal(worldWalkableForTheme(theme,g.doorX,g.foot-8),false,'ground footprint '+kind+':'+id);
  }
 });
 test(theme+' reported offsets match native terrace landmarks',()=>{
  const tide=residenceGeometry(PERMANENT_HOMES[5],theme),dock=productionGeometry(SLOTS[23],theme),post=productionGeometry(SLOTS[11],theme),camp=productionGeometry(SLOTS[22],theme);
  assert(Math.abs(tide.doorX-1388)<1);assert.equal(tide.foot,1381);
  assert.equal(dock.doorX,1637.5);assert(Math.abs(dock.foot-1180)<=1); // V176: entire coastal parcel exchanged with the firework workshop.
  assert.equal(post.doorX,1538.5);assert.equal(post.foot,599);
  assert(Math.abs(camp.doorX-1779)<1);assert.equal(camp.foot,544);
  for(const s of [...SLOTS,...PERMANENT_HOMES]){const route=findWorldPathForTheme(theme,ISLAND_GEOGRAPHY.spawn,s.entry);assert(route.length);assert(Math.hypot(route.at(-1).x-s.entry.x,route.at(-1).y-s.entry.y)<=18);}
 });
}
test('baked navigation includes the native parcel source and all source hashes are current',async()=>{
 assert(WORLD_EDGES.sourceHashes['src/terrainParcelAnchors.js']);
 for(const [file,sha]of Object.entries(WORLD_EDGES.sourceHashes))assert.equal(createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex'),sha,file);
});
