import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nightLightingState,buildNightFixtures,moonRibbon,PRODUCTION_LIGHT_ANCHORS,HOME_LIGHT_ANCHORS} from '../src/nightLighting.js';
import {DEFAULT_CLOCK,environmentAt} from '../src/environmentClock.js';
import {worldWalkableForTheme,SLOTS} from '../src/world.js';
import {alphaContours} from '../src/alphaSilhouette.js';
const at=hour=>environmentAt({...DEFAULT_CLOCK,epochMs:1000000,phaseAtEpoch:hour/24},1000000);
test('art alpha outlines retain enclosed transparent holes and disconnected rope pieces',()=>{const pixels=new Uint8Array(7*7*4);for(let y=1;y<6;y++)for(let x=1;x<6;x++)if(x===1||x===5||y===1||y===5)pixels[(y*7+x)*4+3]=255;pixels[3]=255;const loops=alphaContours(pixels,7,7);assert.equal(loops.length,3);assert(loops.some(points=>points.every(p=>p.x>=2&&p.x<=5&&p.y>=2&&p.y<=5)));assert.throws(()=>alphaContours(new Uint8Array(3),7,7));});
test('visible day/night light is continuous, bounded and independent of economic game days',()=>{
 for(let minute=0;minute<1440;minute++){const e=at(minute/60),l=nightLightingState(e);assert(l.night>=0&&l.night<=1);assert(l.ambient.every(n=>n>=.49&&n<=1));assert(l.moonVisibility>=0&&l.moonVisibility<=l.night);const next=nightLightingState(at(((minute+1)%1440)/60));assert(Math.abs(l.night-next.night)<.02);}
 assert.equal(nightLightingState(at(12)).night,0);assert.equal(nightLightingState(at(0)).night,1);assert.deepEqual(nightLightingState({hour:NaN,night:NaN}).ambient,[1,1,1]);
});
test('both styles use their own measured positions for all production and residence fixtures',()=>{
 for(const theme of ['pixel','origami']){assert.equal(PRODUCTION_LIGHT_ANCHORS[theme].length,25);assert.equal(HOME_LIGHT_ANCHORS[theme].length,16);for(const p of [...PRODUCTION_LIGHT_ANCHORS[theme],...HOME_LIGHT_ANCHORS[theme]].flat())assert(p.every(n=>n>0&&n<1));const plan=buildNightFixtures(theme,{...at(20),weather:{id:'clear'}});assert.equal(new Set(plan.lights.map(p=>p.id)).size,plan.lights.length);assert(plan.lights.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.radius>0));for(let id=0;id<16;id++)assert(plan.lights.some(p=>p.id==='home:'+id+':porch'));for(const p of plan.lights.filter(p=>p.kind==='post'))assert(worldWalkableForTheme(theme,p.x,p.footY));}
 assert.notDeepEqual(PRODUCTION_LIGHT_ANCHORS.pixel,PRODUCTION_LIGHT_ANCHORS.origami);assert.throws(()=>buildNightFixtures('invalid',at(22)));
});
test('sleep extinguishes room windows while leaving a low porch lamp; being awake for an event overrides sleep',()=>{
 const env={...at(0),weather:{id:'clear'}},a=buildNightFixtures('origami',env),b=buildNightFixtures('origami',env,{awakeResidents:[0]}),get=(p,id)=>p.lights.find(l=>l.id===id).gain;
 assert(get(a,'home:0:window:0')<.05);assert(get(a,'home:0:porch')>.1);assert(get(b,'home:0:window:0')>.5);assert.equal(get(a,'home:0:lamp:0'),get(b,'home:0:lamp:0'));assert(get(a,'home:1:window:0')===get(b,'home:1:window:0'));
});
test('unbuilt premises do not emit light, late venues keep opening hours and an actual occupant can keep a workshop lit',()=>{
 const env=at(23),a=buildNightFixtures('pixel',env,{buildings:{0:1}}),b=buildNightFixtures('pixel',env,{buildings:{0:1},occupiedBuildings:[0]});assert(a.lights.filter(l=>l.buildingId!=null).every(l=>l.buildingId===0));assert(b.lights.find(l=>l.id==='building:0:0').gain>a.lights.find(l=>l.id==='building:0:0').gain);assert(buildNightFixtures('pixel',at(20)).lights.find(l=>l.id==='building:1:0').gain>buildNightFixtures('pixel',at(23)).lights.find(l=>l.id==='building:1:0').gain);
});
test('rain and snowfall dim the moon without extinguishing local fixtures',()=>{
 const env=at(0),values={};for(const weather of ['clear','cloudy','rain','snow']){const p=buildNightFixtures('origami',{...env,weather:{id:weather}});values[weather]=p.moon.visibility;assert.equal(p.lights.find(l=>l.id==='harbor:0').gain,.95);}assert(values.clear>values.cloudy&&values.cloudy>values.snow&&values.snow>values.rain);
});
test('moon reflection remains world anchored, moves smoothly with waves and vanishes in daylight',()=>{
 const p=buildNightFixtures('pixel',{...at(0),weather:{id:'clear'}}),a=moonRibbon(p.moon,1),b=moonRibbon(p.moon,1.1);assert.equal(a.length,72);assert.equal(moonRibbon({...p.moon,visibility:0},1).length,0);assert(a.every((r,i)=>r.w>0&&r.h>0&&r.alpha>=0&&Math.abs(r.x-b[i].x)<1));assert(a[50].w>a[0].w);assert.equal(moonRibbon(buildNightFixtures('pixel',at(12)).moon,1).length,0);assert(a.every(r=>r.x>2304));
});
