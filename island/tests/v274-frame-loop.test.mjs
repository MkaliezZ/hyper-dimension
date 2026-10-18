import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisibleFrameLoop} from '../src/visibleFrameLoop.js';

function fixture(onFrame){
 let clock=0,hidden=false,next=0;const frames=new Map(),timers=new Map(),cancelled=[],seen=[];
 const loop=createVisibleFrameLoop(at=>{seen.push(at);onFrame?.(at);},{requestFrame:fn=>{const id=next++;frames.set(id,fn);return id;},cancelFrame:id=>{cancelled.push(id);frames.delete(id);},scheduleTimer:fn=>{const id=next++;timers.set(id,fn);return id;},cancelTimer:id=>timers.delete(id),now:()=>clock,visible:()=>!hidden,staleAfterMs:500,checkEveryMs:250});
 const fireFrame=at=>{clock=at;const [id,fn]=frames.entries().next().value;frames.delete(id);fn(at);};
 const checkAt=at=>{clock=at;const [id,fn]=timers.entries().next().value;timers.delete(id);fn();};
 return{loop,frames,timers,cancelled,seen,fireFrame,checkAt,setClock:at=>clock=at,setHidden:value=>hidden=value};
}
test('healthy RAF delivery keeps one chain and has no fallback work',()=>{
 const f=fixture();f.loop.start();f.loop.start();assert.equal(f.frames.size,1);assert.equal(f.timers.size,1);
 for(const at of [16,32,48,240])f.fireFrame(at);f.checkAt(250);
 assert.deepEqual(f.seen,[16,32,48,240]);assert.equal(f.loop.inspect().fallbackFrames,0);assert.equal(f.frames.size,1);assert.equal(f.timers.size,1);f.loop.stop();
});
test('stopped RAF delivery uses the actual elapsed timestamp only while visible',()=>{
 const f=fixture();f.loop.start();f.fireFrame(20);f.checkAt(250);f.checkAt(519);assert.deepEqual(f.seen,[20]);f.checkAt(520);
 assert.deepEqual(f.seen,[20,520]);assert.equal(f.loop.inspect().rafFrames,1);assert.equal(f.loop.inspect().fallbackFrames,1);assert.equal(f.frames.size,1);f.loop.stop();
});
test('a cancelled late RAF cannot deliver a duplicate frame after recovery',()=>{
 const f=fixture();f.loop.start();const old=f.frames.values().next().value;f.checkAt(500);old(501);
 assert.deepEqual(f.seen,[500]);f.fireFrame(516);assert.deepEqual(f.seen,[500,516]);assert.equal(f.loop.inspect().rafFrames,1);f.loop.stop();
});
test('hidden time does not produce fallback frames or catch-up timestamps',()=>{
 const f=fixture();f.loop.start();f.setHidden(true);f.checkAt(500);f.checkAt(3_600_000);assert.deepEqual(f.seen,[]);f.setHidden(false);f.checkAt(3_600_250);assert.deepEqual(f.seen,[]);f.fireFrame(3_600_260);assert.deepEqual(f.seen,[3_600_260]);assert.equal(f.loop.inspect().fallbackFrames,0);f.loop.stop();
});
test('slow real drawing is not mistaken for a missing RAF callback',()=>{
 let f;f=fixture(()=>f.setClock(2000));f.loop.start();f.fireFrame(16);f.checkAt(2100);assert.deepEqual(f.seen,[16]);assert.equal(f.loop.inspect().fallbackFrames,0);f.loop.stop();
});
test('application exceptions stay visible and stop the loop',()=>{
 const f=fixture(()=>{throw Error('real application error');});f.loop.start();assert.throws(()=>f.fireFrame(16),/real application error/);assert.equal(f.loop.inspect().errors,1);assert.equal(f.loop.inspect().running,false);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
});
test('stop cancels both pending callbacks, including frame ID zero',()=>{
 const f=fixture();f.loop.start();const old=f.frames.values().next().value;f.loop.stop();old(16);assert.deepEqual(f.seen,[]);assert.deepEqual(f.cancelled,[0]);assert.equal(f.timers.size,0);f.loop.start();f.fireFrame(32);assert.deepEqual(f.seen,[32]);f.loop.stop();
});
