import test from 'node:test';import assert from 'node:assert/strict';
import {BUILDINGS,SLOTS,RESIDENTS,createState,unlockRequirement,findPath,worldWalkable} from '../src/world.js';
test('25 unique buildings fill 25 mapped sites and 15 AI residents plus Hermes',()=>{assert.equal(BUILDINGS.length,25);assert.equal(SLOTS.length,25);assert.equal(new Set(BUILDINGS.map(b=>b.name)).size,25);assert.equal(RESIDENTS.filter(r=>r.kind==='ai').length,15);assert.equal(RESIDENTS.filter(r=>r.kind==='hermes').length,1);assert.ok(RESIDENTS.every(r=>worldWalkable(...r.start)))});
test('all buildings open for current island simulation',()=>{const s=createState();assert.equal(Object.keys(s.buildings).length,25);for(const b of BUILDINGS)assert.equal(unlockRequirement(b.id,s).ready,true)});
test('navigation routes around occupied footprints',()=>{const p=findPath({x:781,y:518},{x:430,y:703});assert.ok(p.length>0);assert.ok(p.every(v=>worldWalkable(v.x,v.y)))});
