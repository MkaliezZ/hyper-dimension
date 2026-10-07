import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshotChanges,applySnapshotChanges,createSnapshotEncoder} from '../src/saveDelta.js';

const json = value => JSON.parse(JSON.stringify(value));
test('changes reproduce JSON for nested edits, deletions, array resizing and type changes',()=>{
 let source={coins:2,inventory:{wood:3,temporary:1},people:[{name:'阿然',mood:2},{name:'露露',mood:4}],empty:{},zero:0},mirror=json(source),worker=createSnapshotEncoder();
 worker.encode({channel:'pixel',reset:true,value:structuredClone(source)});
 const cases=[
  s=>{s.coins=3;s.inventory.wood=9;delete s.inventory.temporary;s.people[0].mood=5;},
  s=>{s.people.push({name:'小墨',mood:7});s.extra={list:[1,2,3]};},
  s=>{s.people.splice(0,1);s.extra.list.length=1;s.empty=[];},
  s=>{s.people=[];s.empty=[null,{ok:true}];delete s.extra;},
  s=>{s.zero=NaN;s.empty[0]=undefined;s.unused=undefined;},
  s=>{s.empty={text:'灯牌🌊\n"你好"'};s.inventory=null;},
  s=>{s.inventory={wood:0};s.empty=null;s.people=[,true];}
 ];
 for(const edit of cases){
  edit(source);const changes=snapshotChanges(mirror,source),reply=worker.encode({channel:'pixel',changes:structuredClone(changes)});
  mirror=applySnapshotChanges(mirror,reply.changes,true);
  assert.deepEqual(JSON.parse(reply.serialized),json(source));
  assert.deepEqual(json(mirror),json(source));
 }
});

test('120 successive saves transfer small changes while retaining the whole history',()=>{
 let source={coins:0,player:{x:0,y:0},history:Array.from({length:1000},(_,i)=>({id:i,text:'旧存档历史'.repeat(160),records:[{ok:true},{value:i}]}))};
 const worker=createSnapshotEncoder(),first=worker.encode({channel:'pixel',reset:true,value:structuredClone(source)});
 let mirror=JSON.parse(first.serialized),maxPatch=0;
 for(let i=0;i<120;i++){
  source.coins++;source.player.x+=2;
  if(i===50)source.history.push({id:1000,text:'新历史',records:[{ok:true}]});
  if(i===80)source.history[12].records[1].value=123;
  const changes=snapshotChanges(mirror,source),bytes=Buffer.byteLength(JSON.stringify(changes));maxPatch=Math.max(maxPatch,bytes);
  assert(bytes<800,'large history must not be retransferred');
  const reply=worker.encode({channel:'pixel',changes:structuredClone(changes)});
  mirror=applySnapshotChanges(mirror,reply.changes,true);
  assert.deepEqual(JSON.parse(reply.serialized),source);
 }
 assert(Buffer.byteLength(first.serialized)>1_000_000);
 assert(maxPatch<800);
 assert.equal(mirror.history.length,1001);
});

test('pixel and origami worker baselines stay isolated and reset accepts a replacement slot',()=>{
 const w=createSnapshotEncoder();w.encode({channel:'pixel:slot1',reset:true,value:{v:1}});w.encode({channel:'origami:slot1',reset:true,value:{v:8}});
 assert.equal(JSON.parse(w.encode({channel:'pixel:slot1',changes:[{operation:'set',path:['v'],value:2}]}).serialized).v,2);
 assert.equal(JSON.parse(w.encode({channel:'origami:slot1',changes:[]}).serialized).v,8);
 assert.equal(JSON.parse(w.encode({channel:'pixel:slot1',reset:true,value:{v:0}}).serialized).v,0);
 assert.throws(()=>w.encode({channel:'pixel:slot2',changes:[]}),/baseline/);
});

test('failed encodes discard the worker baseline and do not poison the durable snapshot',()=>{
 const w=createSnapshotEncoder();w.encode({channel:'pixel',reset:true,value:{v:1}});
 assert.throws(()=>w.encode({channel:'pixel',changes:[{operation:'set',path:['v'],value:1n}]}),/BigInt/);
 assert.throws(()=>w.encode({channel:'pixel',changes:[]}),/baseline/);
 assert.equal(JSON.parse(w.encode({channel:'pixel',reset:true,value:{v:2}}).serialized).v,2);
 const circle={};circle.a=circle;
 assert.throws(()=>snapshotChanges({a:{}},circle),/circular/);
 assert.throws(()=>applySnapshotChanges({},[{operation:'set',path:['__proto__','polluted'],value:true}]),/Invalid/);
 assert.equal({}.polluted,undefined);
});

test('changes and mirrors never retain mutable source object references',()=>{
 const w=createSnapshotEncoder();const source={inventory:{wood:1},history:[]};
 const initial=w.encode({channel:'pixel',reset:true,value:structuredClone(source)});let mirror=JSON.parse(initial.serialized);
 source.history.push({id:1,text:'one'});const changes=snapshotChanges(mirror,source),reply=w.encode({channel:'pixel',changes:structuredClone(changes)});
 mirror=applySnapshotChanges(mirror,reply.changes,true);source.history[0].text='two';
 assert.equal(mirror.history[0].text,'one');assert.equal(JSON.parse(reply.serialized).history[0].text,'one');
});

test('snapshot capture yields and retries when the live generation changes',async()=>{
 const {snapshotChangesAsync}=await import('../src/saveDelta.js');
 const previous={values:Array.from({length:50000},(_,i)=>({id:i,value:i}))},next=structuredClone(previous);
 next.values[49999].value=7;
 let current=true;setTimeout(()=>{current=false;},0);
 await assert.rejects(snapshotChangesAsync(previous,next,()=>current),e=>e.code==='snapshot_retry');
 const changes=await snapshotChangesAsync(previous,next);
 assert.deepEqual(applySnapshotChanges(structuredClone(previous),changes),next);
});

test('snapshot JSON preserves property order and ignores non-enumerable properties',()=>{
 const w=createSnapshotEncoder();let previous={a:1,b:{x:1,y:2},c:3};
 w.encode({channel:'pixel',reset:true,value:structuredClone(previous)});
 for(const next of [{c:3,a:1,b:{y:2,x:1}},{c:3,inserted:4,a:1,b:{y:2,x:1}},{'9':'nine',c:3,a:1,b:{y:2,x:1}},{a:1,b:{y:2,x:1}}]){
  const reply=w.encode({channel:'pixel',changes:structuredClone(snapshotChanges(previous,next))});assert.equal(reply.serialized,JSON.stringify(next));previous=JSON.parse(reply.serialized);
 }
 const next={a:1,b:{y:2,x:1}};Object.defineProperty(next,'a',{value:1,enumerable:false});
 const reply=w.encode({channel:'pixel',changes:structuredClone(snapshotChanges(previous,next))});
 assert.equal(reply.serialized,JSON.stringify(next));
});

test('receipt deltas preserve unchanged history and do not mutate the live source',async()=>{
 const {encodedSnapshotChanges,applyImmutableSnapshotChanges}=await import('../src/saveDelta.js');
 const source={coins:1,inventory:{wood:2,stone:3},history:Array.from({length:1000},(_,i)=>({i,text:'history'+i})),plots:[{growth:1},{growth:2}]};
 const expected=structuredClone(source);expected.coins=9;expected.inventory.wood=5;expected.plots[1].growth=4;
 const result=applyImmutableSnapshotChanges(source,encodedSnapshotChanges(json(source),expected),true);
 assert.deepEqual(result,expected);assert.equal(result.history,source.history);assert.equal(result.plots[0],source.plots[0]);
 assert.equal(source.coins,1);assert.equal(source.inventory.wood,2);assert.equal(source.plots[1].growth,2);
 assert.notEqual(result.inventory,source.inventory);assert.notEqual(result.plots,source.plots);
});
test('receipt copy treats aliased source paths as distinct JSON values',async()=>{
 const {encodedSnapshotChanges,applyImmutableSnapshotChanges}=await import('../src/saveDelta.js');
 const shared={v:1},source={a:shared,b:shared},expected={a:{v:2},b:{v:3}};
 const result=applyImmutableSnapshotChanges(source,encodedSnapshotChanges(json(source),expected),true);
 assert.deepEqual(result,expected);assert.equal(shared.v,1);assert.notEqual(result.a,result.b);
});
