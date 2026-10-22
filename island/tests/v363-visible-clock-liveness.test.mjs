import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisibleFrameLoop} from '../src/visibleFrameLoop.js';
import {visibleFrameSeconds,MAX_VISIBLE_FRAME_SECONDS} from '../src/frameClock.js';

test('default visible-page fallback preserves the bounded simulation clock when RAF stops',()=>{
 let clock=0,last=0,seconds=0,next=0,interval;const timers=new Map(),frames=new Map();
 const loop=createVisibleFrameLoop(at=>{seconds+=visibleFrameSeconds(at,last,false);last=at;},{
  requestFrame:fn=>{const id=++next;frames.set(id,fn);return id;},cancelFrame:id=>frames.delete(id),
  scheduleTimer:(fn,ms)=>{interval=ms;const id=++next;timers.set(id,fn);return id;},cancelTimer:id=>timers.delete(id),now:()=>clock,visible:()=>true,
 });
 loop.start();for(clock=interval;clock<=3000;clock+=interval){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}
 assert(seconds>=2.9&&seconds<=3+1e-9,'Three real visible seconds must not collapse to a subsecond simulation clock');
 assert.equal(MAX_VISIBLE_FRAME_SECONDS,.15,'Do not increase the protected economy/save time cap');
 assert.equal(loop.inspect().rafFrames,0);assert(loop.inspect().fallbackFrames>0);assert.equal(frames.size,1);loop.stop();
});
