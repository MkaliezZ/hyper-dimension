import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CROPS,FARM_LAYOUTS,plotPoint,insidePlot} from '../src/farming.js';
import {LEGACY_CROP_ART_FRAMES} from '../src/legacyCropArtFrames.js';
import {CROP_ART_FRAMES} from '../src/cropArtFrames.js';
globalThis.location={search:''};globalThis.document={body:{dataset:{theme:'pixel'}}};
const {validCropArt,cropFrameGeometry,cropPlantingGrid,cropWindStrips}=await import('../src/cropArt.js');delete globalThis.location;delete globalThis.document;
const legacy=['wheat','herb','tomato','pumpkin','carrot','corn','potato','rice','strawberry','cotton','flax'].sort();
const provenance=JSON.parse(await readFile(new URL('../docs/legacy-crop-art-provenance-v178.json',import.meta.url),'utf8'));

test('every plantable crop now has a dedicated four-stage source in both styles',()=>{
 assert.equal(Object.keys(CROPS).length,19);
 for(const theme of ['pixel','origami']){assert.deepEqual(Object.keys(LEGACY_CROP_ART_FRAMES[theme]).sort(),legacy);assert.deepEqual(Object.keys(CROP_ART_FRAMES[theme]).sort(),Object.keys(CROPS).sort());}
});
for(const theme of ['pixel','origami']){
 test(theme+' legacy growth frames fit complete disjoint PNG regions and preserve original native dimensions',async()=>{
  const rows=provenance.filter(r=>r.style===theme);assert.equal(rows.length,3);assert.equal(rows.reduce((n,r)=>n+r.growthSprites,0),44);
  const framesByFile=new Map();
  for(const [crop,spec]of Object.entries(LEGACY_CROP_ART_FRAMES[theme])){
   assert(validCropArt(spec),crop);const data=await readFile(new URL('../public/assets/'+spec.file,import.meta.url));assert.equal(data.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(data.readUInt32BE(16),spec.width);assert.equal(data.readUInt32BE(20),spec.height);assert.equal(data[25],6,'transparent native RGBA');const row=rows.find(r=>r.file===spec.file);assert(row);assert.equal(createHash('sha256').update(data).digest('hex'),row.sha256);
   const frames=framesByFile.get(spec.file)||[];framesByFile.set(spec.file,frames);
   for(const f of spec.frames){assert(f.x>0&&f.y>0&&f.x+f.w<spec.width&&f.y+f.h<spec.height,crop+' clipped silhouette');for(const b of frames)assert(f.x+f.w<=b.x||b.x+b.w<=f.x||f.y+f.h<=b.y||b.y+b.h<=f.y,crop+' neighboring sprite included');frames.push(f);}
  }
 });
 test(theme+' every crop fits calibrated farm beds at every stage and keeps its basal anchor fixed while swaying',()=>{
  for(const [crop,s]of Object.entries(CROP_ART_FRAMES[theme])){const grid=cropPlantingGrid(crop),maxWidth=grid.columns===3?26:18;
   for(const f of s.frames){const shape=cropFrameGeometry(f,500,300);assert(shape.w<=maxWidth+.01,crop+' overcrowds planting row');for(const t of [0,.4,1.2,2.5])for(const strip of cropWindStrips(f,t,3,theme))if(strip.y+strip.h>=f.root[1]*f.h*f.windStart)assert.equal(strip.dx,0,crop+' basal soil moves');
    for(const q of FARM_LAYOUTS[theme])for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.columns;col++){const root=plotPoint(q,.16+col*.68/(grid.columns-1),.27+row*.53/(grid.rows-1)),b=cropFrameGeometry(f,root.x,root.y);assert(insidePlot(q,root));assert(Math.abs(b.x+b.w*f.root[0]-root.x)<1e-8);assert(Math.abs(b.y+b.h*f.root[1]-root.y)<1e-8);}
   }
  }
 });
}
