import test from 'node:test';import assert from 'node:assert/strict';
import {canvasResolution,rasterTransform} from '../src/rasterQuality.js';
test('canvas backing follows native and fractional display density instead of capping at two',()=>{
 for(const ratio of [1,1.25,1.5,2,3,4]){const r=canvasResolution(1440,950,ratio);assert.equal(r.width,Math.round(1440*ratio));assert.equal(r.height,Math.round(950*ratio));assert.ok(Math.abs(r.x-ratio)<1/1440);assert.ok(Math.abs(r.y-ratio)<1/950)}
});
test('extreme displays stay within texture dimension and bounded allocation',()=>{
 for(const [w,h,d] of [[8000,5000,4],[20000,900,3],[0,0,1]]){const r=canvasResolution(w,h,d);assert.ok(r.width<=16384&&r.height<=16384);assert.ok(r.width*r.height<48020000);assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.y))}
});
test('raster alignment never displaces world input by more than half a physical pixel',()=>{
 for(const ratio of [1,1.25,2,3])for(const zoom of [1,1.1,2.05,3]){
 const w=1440,h=950,camera={x:837.37,y:698.28},t=rasterTransform(w,h,1856,1248,zoom,camera,ratio,ratio);
 assert.ok(Math.abs(t.ox-(w/2-camera.x*t.scale))*ratio<=.500001);
 assert.ok(Math.abs(t.oy-(h/2-camera.y*t.scale))*ratio<=.500001);
 for(const p of [{x:500,y:500},{x:1417,y:909}]){const screen={x:p.x*t.scale+t.ox,y:p.y*t.scale+t.oy};assert.ok(Math.abs((screen.x-t.ox)/t.scale-p.x)<1e-9);assert.ok(Math.abs((screen.y-t.oy)/t.scale-p.y)<1e-9)}
 }
});

