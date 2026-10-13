import test from 'node:test';
import assert from 'node:assert/strict';
import {findPath,SLOTS,HOTSPOTS,setWorldTheme,worldWalkable,WORLD_CELL} from '../src/world.js';
import {ISLAND_GEOGRAPHY,PERMANENT_HOMES,geographySites,homeForResident,homeDisplayName,homeEntrance} from '../src/islandGeography.js';

test('production identities and all permanent resident homes remain distinct',()=>{
 assert.deepEqual(ISLAND_GEOGRAPHY.production.map(p=>p.id).sort((a,b)=>a-b),Array.from({length:25},(_,i)=>i));
 assert.deepEqual(PERMANENT_HOMES.map(h=>h.ownerId).sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i));
 assert.equal(new Set(geographySites().map(s=>s.key)).size,41);
 assert.equal(homeForResident(16),null);
 assert.equal(ISLAND_GEOGRAPHY.temporaryResidence,'community-guest-room');
});
test('staggered sites preserve a buffer for buildings and their approach areas',()=>{
 const sites=geographySites(),extent=ISLAND_GEOGRAPHY.extent;
 for(const s of sites){assert.ok(s.x-s.w/2>0&&s.x+s.w/2<extent.width,s.key);assert.ok(s.y-s.h/2>0&&s.y+s.h/2<extent.height,s.key);}
 for(let i=0;i<sites.length;i++)for(const b of sites.slice(i+1)){const a=sites[i];assert.ok(Math.abs(a.x-b.x)>=(a.w+b.w)/2+12||Math.abs(a.y-b.y)>=(a.h+b.h)/2+12,a.key+' overlaps '+b.key);}
 assert.ok(new Set(ISLAND_GEOGRAPHY.production.map(p=>Math.round(p.y/6))).size>=20,'the production buildings must not return to a few uniform rows');
});
test('home identity follows its owner and a renamed butler',()=>{
 assert.equal(homeForResident(12).name,'弦风屋');assert.equal(homeForResident(1).name,'木榫居');
 assert.equal(homeDisplayName(15,{name:'星澜'}),'星澜 · 星邮管家馆');
 for(const h of PERMANENT_HOMES){const p=homeEntrance(h.ownerId);assert.ok(Math.abs(p.x-h.x)<=12);assert.ok(p.y>h.y+h.h/2);}
 assert.equal(new Set(PERMANENT_HOMES.map(h=>h.interiorTheme)).size,16);
});
test('large-world A* routes through the gate and never cuts blocked corners',()=>{
 const {width,height}=ISLAND_GEOGRAPHY.world;
 const free=(x,y)=>x>=24&&y>=24&&x<width-24&&y<height-24&&!(x>=960&&x<=1008&&(y<1248||y>1320));
 const start={x:72,y:72},end={x:2448,y:1920},path=findPath(start,end,free,24);assert.ok(path.length);assert.deepEqual(path.at(-1),end);
 let a=start;for(const b of path){assert.ok(free(b.x,b.y));const steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2);for(let i=0;i<=steps;i++)assert.ok(free(a.x+(b.x-a.x)*i/steps,a.y+(b.y-a.y)*i/steps));a=b;}
 assert.ok(path.some(p=>p.x===984&&p.y>=1248&&p.y<=1320));
});
test('closed terrain remains unreachable',()=>{
 const free=(x,y)=>x>=24&&y>=24&&x<=240&&y<=240&&x!==120;
 assert.deepEqual(findPath({x:48,y:48},{x:192,y:192},free,24),[]);
 const corner=(x,y)=>x>=0&&y>=0&&x<=24&&y<=24&&(x===y);
 assert.deepEqual(findPath({x:0,y:0},{x:24,y:24},corner,24),[]);
});


test('both styles reach every calibrated production, residence and landmark entrance without crossing water',()=>{
 for(const theme of ['pixel','origami']){setWorldTheme(theme);for(const target of [...SLOTS.map(s=>({id:'building:'+s.id,p:s.entry})),...PERMANENT_HOMES.map(s=>({id:s.id,p:s.entry})),...HOTSPOTS.map(s=>({id:s.type,p:s.entry})),{id:'gallery',p:ISLAND_GEOGRAPHY.landmarks.gallery.entry}]){
  const path=findPath(ISLAND_GEOGRAPHY.spawn,target.p),end=path.at(-1)||ISLAND_GEOGRAPHY.spawn;assert.ok(Math.hypot(end.x-target.p.x,end.y-target.p.y)<=18,theme+' '+target.id);let previous=ISLAND_GEOGRAPHY.spawn;for(const p of path){const n=Math.max(2,Math.ceil(Math.hypot(p.x-previous.x,p.y-previous.y)/2));for(let i=0;i<=n;i++)assert.ok(worldWalkable(previous.x+(p.x-previous.x)*i/n,previous.y+(p.y-previous.y)*i/n),theme+' '+target.id+' crosses blocked terrain');previous=p;}
 }
 for(const point of [{x:48,y:1716},{x:2304,y:1608},{x:2256,y:48}])assert.equal(worldWalkable(point.x,point.y),false,'open ocean stays blocked');}
 assert.equal(WORLD_CELL,12);
});

 test('All ten earned wonder displays preserve every public and residential entrance',async()=>{const {wonderPlacements}=await import('../src/fishingWonderArt.js'),{WONDER_DEFINITIONS}=await import('../src/eventWonders.js'),{setWorldDisplayColliders,worldSlots}=await import('../src/world.js');for(const theme of ['pixel','origami']){setWorldTheme(theme);const state={eventWonders:{owned:Object.fromEntries(Object.keys(WONDER_DEFINITIONS).map(id=>[id,{}])),displays:Object.fromEntries(Object.keys(WONDER_DEFINITIONS).map(id=>[id,true]))}},sites=wonderPlacements(state,worldSlots(theme));assert.equal(sites.length,10);setWorldDisplayColliders(sites);try{for(const p of [...worldSlots(theme),...PERMANENT_HOMES,...Object.values(ISLAND_GEOGRAPHY.landmarks).filter(p=>p.entry)])assert(findPath(ISLAND_GEOGRAPHY.spawn,p.entry).length,theme+' '+(p.id??p.name??JSON.stringify(p.entry)));}finally{setWorldDisplayColliders([]);}}});
