import test from 'node:test';import assert from 'node:assert/strict';import{readFileSync}from'node:fs';import{createHash}from'node:crypto';
import {terrainOverviewURL,terrainTiles,maskTerrain} from '../src/mapTileLayout.js';
test('both previews are current tile compositions with verified dimensions and provenance',()=>{
 const book=JSON.parse(readFileSync('docs/terrain-previews-v125.json','utf8'));
 for(const theme of ['pixel','origami']){
  const name='public'+terrainOverviewURL(theme),row=book.files.find(f=>f.file===name),bytes=readFileSync(name);assert(row);
  assert.equal(bytes.readUInt32BE(16),1536);assert.equal(bytes.readUInt32BE(20),1024);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
  assert(!bytes.equals(readFileSync('public/assets/island-'+theme+'-v9.png')));
 }
 assert.throws(()=>terrainOverviewURL('unknown'));
});
test('pre-masked previews retain coastal transparency while tile overlap weights still apply',()=>{
 const tile=terrainTiles('pixel')[11],w=tile.bounds.w,h=tile.bounds.h;
 const create=()=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data.set([15,130,190,128],i);return data;};
 const raw=create(),preview=create();maskTerrain(raw,w,h,tile);maskTerrain(preview,w,h,tile,false);
 assert.equal(preview.at(-1),128);assert(raw.at(-1)<2);assert(preview[3]<128,'overlap feathering still applied');
});
test('runtime map entry points no longer depend on the legacy overview',()=>{
 for(const name of ['src/app.js','src/lanMap.js','src/mapTileLoader.js','src/mapTileWorker.js']){
  const source=readFileSync(name,'utf8');assert(source.includes('terrainOverviewURL'),name);assert(!/island-.*?-v9\.png/.test(source),name);
 }
});
