import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_CLOCK} from '../src/environmentClock.js';
import {createEnvironmentClient} from '../src/environmentClient.js';

function fixture(){
 let at=0;
 const clock={...DEFAULT_CLOCK,clockId:'season-boundary-fixture',epochMs:1000000,phaseAtEpoch:0};
 const client=createEnvironmentClient({now:()=>at,wallNow:()=>clock.epochMs,fetchClock:async()=>({clock,serverNowMs:clock.epochMs+at})});
 client.accept({clock,serverNowMs:clock.epochMs});at=4000;client.sample();
 return{client,clock,setTime:t=>{at=t;},getTime:()=>at};
}

test('a natural 30-day boundary begins a visual transition without a fetch or clock revision',()=>{
 const f=fixture(),boundary=30*f.clock.dayLengthMs;
 f.setTime(boundary-1);assert.equal(f.client.sample().season,'spring');
 f.setTime(boundary);const start=f.client.sample();
 assert.equal(start.season,'summer');assert.equal(start.previousSeason,'spring');assert.equal(start.transition,0);
 f.setTime(boundary+2000);assert.equal(f.client.sample().transition,.5);
 f.setTime(boundary+4000);assert.equal(f.client.sample().transition,1);
 assert.equal(f.client.descriptor().revision,1);
});

test('rendering repeated frames and refreshing an unchanged descriptor never restarts the transition',async()=>{
 const f=fixture(),boundary=30*f.clock.dayLengthMs;
 f.setTime(boundary);f.client.sample();
 f.setTime(boundary+1000);assert.equal(f.client.sample().transition,.25);
 for(let i=0;i<20;i++)assert.equal(f.client.sample().transition,.25);
 await f.client.refresh();assert.equal(f.client.sample().transition,.25);
 f.setTime(boundary+3000);assert.equal(f.client.sample().transition,.75);
});

test('returning after a long hidden-window gap selects the actual season and retains the last observed season',()=>{
 const f=fixture();assert.equal(f.client.sample().season,'spring');
 f.setTime(95*f.clock.dayLengthMs);const after=f.client.sample();
 assert.equal(after.season,'winter');assert.equal(after.previousSeason,'spring');assert.equal(after.transition,0);
 f.setTime(f.getTime()+4000);assert.equal(f.client.sample().transition,1);
});

test('a newer central clock revision transitions once, then natural boundaries continue normally',()=>{
 const f=fixture();
 f.client.accept({clock:{...f.clock,source:'central',revision:2,seasonOffset:60},serverNowMs:f.clock.epochMs+f.getTime()});
 const central=f.client.sample();assert.equal(central.season,'autumn');assert.equal(central.previousSeason,'spring');assert.equal(central.transition,0);
 f.setTime(f.getTime()+4000);assert.equal(f.client.sample().transition,1);
 f.setTime(30*f.clock.dayLengthMs);const next=f.client.sample();
 assert.equal(next.season,'winter');assert.equal(next.previousSeason,'autumn');assert.equal(next.transition,0);
});
