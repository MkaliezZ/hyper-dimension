import test from 'node:test';import assert from 'node:assert/strict';
import {createMapCharacterPicker} from '../src/mapCharacterPicker.js';
import {RESIDENTS} from '../src/world.js';
const body=(x,y)=>({x:x-8,y:y-25,w:16,h:28});
test('Li Yin nameplate never selects Xiao Mo feet nearby',()=>{
 const picker=createMapCharacterPicker();const xiao={npcId:1,x:100,y:95},li={npcId:12,x:100,y:140};
 const p={x:100,y:97};assert(Math.hypot(xiao.x-p.x,xiao.y-p.y)<25);assert(Math.hypot(li.x-p.x,li.y-p.y)>25);
 picker.add({kind:'resident',npcId:1,name:'小墨',body:body(xiao.x,xiao.y)});
 picker.add({kind:'resident',npcId:12,name:'黎音',body:body(li.x,li.y),label:{x:80,y:93,w:40,h:22}});
 assert.equal(picker.pick(p).npcId,12);assert.equal(picker.pick({x:100,y:125}).npcId,12);
});
test('all residents and steward retain stable ids when painter order differs from catalog order',()=>{
 const picker=createMapCharacterPicker();for(const r of [...RESIDENTS].reverse())picker.add({kind:'resident',npcId:r.id,name:r.name,body:body(100+r.id*50,100),label:{x:80+r.id*50,y:50,w:40,h:22}});
 for(const r of RESIDENTS)for(const y of [60,87]){const hit=picker.pick({x:100+r.id*50,y});assert.equal(hit.npcId,r.id);assert.equal(hit.name,r.name);}
});
test('overlapping actors use the visible painter order rather than the first array entry',()=>{
 const picker=createMapCharacterPicker();picker.add({kind:'resident',npcId:12,body:body(100,100)});picker.add({kind:'resident',npcId:1,body:body(100,110)});
 assert.equal(picker.pick({x:100,y:91}).npcId,1);assert.equal(picker.pick({x:100,y:76}).npcId,12);
});
test('visitor and resident sprite ids are separate identity domains',()=>{
 const picker=createMapCharacterPicker();const visitor={id:111,isVisitor:true};picker.add({kind:'resident',npcId:1,body:body(100,100)});picker.add({kind:'visitor',npcId:1,actor:visitor,body:body(100,110)});
 const hit=picker.pick({x:100,y:91});assert.equal(hit.kind,'visitor');assert.equal(hit.actor,visitor);
});
test('speech bubble belongs to its speaker; frame reset removes hidden, indoor and departed targets',()=>{
 const picker=createMapCharacterPicker();picker.add({kind:'resident',npcId:12,label:{x:60,y:40,w:138,h:65}});assert.equal(picker.pick({x:70,y:55}).npcId,12);
 picker.reset();assert.equal(picker.pick({x:70,y:55}),null);assert.deepEqual(picker.inspect(),[]);
});
test('empty ground outside displayed body is not a 25-unit foot-radius resident target',()=>{
 const picker=createMapCharacterPicker();picker.add({kind:'resident',npcId:12,body:body(100,100)});assert.equal(picker.pick({x:120,y:100}),null);
});
