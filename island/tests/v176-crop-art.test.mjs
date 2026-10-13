import test from 'node:test';
import assert from 'node:assert/strict';
import {CROP_ART_FRAMES} from '../src/cropArtFrames.js';
import {FARM_LAYOUTS,plotPoint,insidePlot} from '../src/farming.js';
globalThis.location={search:''};globalThis.document={body:{dataset:{theme:'pixel'}}};
const {growthFrameIndex,validCropArt,cropFrameGeometry,cropWindStrips,cropPlantingGrid}=await import('../src/cropArt.js');delete globalThis.location;delete globalThis.document;
// Geometry-only synthetic rectangles are not game artwork or asset metadata.
const frame={x:12,y:9,w:180,h:230,root:[.52,.97],renderHeight:29,windStart:.75};
test('growth phases preserve the planted seedling and expose mature art only when ripe',()=>{assert.equal(growthFrameIndex(0),-1);assert.equal(growthFrameIndex(1),-1);assert.equal(growthFrameIndex(2),0);assert.equal(growthFrameIndex(3,.2),0);assert.equal(growthFrameIndex(3,.4),1);assert.equal(growthFrameIndex(3,.8),2);assert.equal(growthFrameIndex(4,1),3);});
test('every frame anchor lands on the same ground coordinate without crop-width squashing',()=>{
 for(const factor of [.3,.55,.8,1]){const f={...frame,w:frame.w*factor,h:frame.h*factor,renderHeight:29*factor},g=cropFrameGeometry(f,238,351);assert(Math.abs(g.x+g.w*f.root[0]-238)<1e-9);assert(Math.abs(g.y+g.h*f.root[1]-351)<1e-9);assert.equal(g.w/g.h,f.w/f.h);}
});
for(const theme of ['pixel','origami'])test(theme+' breeze moves only canopy, never the stem base or root anchor',()=>{
 for(let t=0;t<20;t+=.13){const strips=cropWindStrips(frame,t,17,theme);assert.equal(strips.reduce((sum,s)=>sum+s.h,0),frame.h);let bottom=0;for(const s of strips){assert.equal(s.y,bottom);bottom+=s.h;assert(Math.abs(s.dx)<1);if(s.y+s.h>=frame.root[1]*frame.h*frame.windStart)assert.equal(s.dx,0);}assert.equal(strips.at(-1).dx,0);}
});
test('native metadata rejects malformed roots, out-of-sheet crops and missing growth frames',()=>{
 const spec={file:'test-only.png',width:1024,height:1024,frames:Array.from({length:4},()=>({...frame}))};assert(validCropArt(spec));for(const bad of [{...spec,frames:[]},{...spec,frames:[{...frame,root:{}},...spec.frames.slice(1)]},{...spec,frames:[{...frame,root:[.5,.2]},...spec.frames.slice(1)]},{...spec,width:10}])assert.equal(validCropArt(bad),false);
});
test('wide vegetables and tall vines have room inside all 16 calibrated farm beds',()=>{
 for(const plots of Object.values(FARM_LAYOUTS))for(const q of plots)for(const crop of ['wheat','cabbage','pea','blueberry']){const g=cropPlantingGrid(crop);if(crop!=='wheat')assert.equal(g.columns*g.rows,6);for(let row=0;row<g.rows;row++)for(let col=0;col<g.columns;col++){const p=plotPoint(q,.16+col*.68/Math.max(1,g.columns-1),.27+row*.53/Math.max(1,g.rows-1));assert(insidePlot(q,p));}}
});

test('original 16 V176 native sheets retain four valid disjoint frames with a stable root and bounded size',()=>{
 const expected=['cabbage','pea','cucumber','eggplant','blueberry','sweet_potato','daikon','kale'].sort();
 for(const theme of ['pixel','origami']){const specs=Object.fromEntries(expected.map(crop=>[crop,CROP_ART_FRAMES[theme][crop]]));assert.deepEqual(Object.keys(specs).sort(),expected);for(const [crop,s] of Object.entries(specs)){assert(validCropArt(s),theme+' '+crop);assert.equal(s.file,'crop-growth-'+theme+'-'+crop.replaceAll('_','-')+'-v176.png');for(const [i,f] of s.frames.entries()){const g=cropFrameGeometry(f,500,300);assert(g.w<=26.001,theme+' '+crop+' stage '+i+' too wide');assert(Math.abs(g.x+g.w*f.root[0]-500)<1e-8);assert(Math.abs(g.y+g.h*f.root[1]-300)<1e-8);for(const b of s.frames.slice(i+1)){const overlapW=Math.min(f.x+f.w,b.x+b.w)-Math.max(f.x,b.x),overlapH=Math.min(f.y+f.h,b.y+b.h)-Math.max(f.y,b.y);assert(overlapW<=0||overlapH<=0,theme+' '+crop+' frame '+i+' overlaps another growth phase');}}}}
});
