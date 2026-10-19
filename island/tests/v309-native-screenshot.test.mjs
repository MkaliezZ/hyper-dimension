import test from 'node:test';
import assert from 'node:assert/strict';
import {captureNativeScreenshot} from './nativeScreenshot.mjs';
const protocol=()=>Error('Protocol error (Page.captureScreenshot): Unable to capture screenshot');
function fixture(capture,closed=false,yieldError=null){
 const calls=[],waits=[],buffer=Buffer.from('declared-unit-png-bytes');
 return {calls,waits,buffer,page:{isClosed:()=>closed,async screenshot(options){calls.push(options);return capture(calls.length,buffer);},async waitForTimeout(ms){waits.push(ms);if(yieldError)throw yieldError;}}};
}
test('successful capture preserves PNG bytes, path and first-attempt budget',async()=>{
 const f=fixture((n,b)=>b),r=await captureNativeScreenshot(f.page,{path:'owned.png'});assert.equal(r.buffer,f.buffer);assert.equal(r.retried,false);assert.deepEqual(f.calls,[{path:'owned.png',timeout:30000}]);assert.deepEqual(f.waits,[]);
});
test('one transient protocol failure retries capture with the same path and remaining budget',async()=>{
 const f=fixture((n,b)=>{if(n===1)throw protocol();return b;}),r=await captureNativeScreenshot(f.page,{path:'owned.png',timeout:30000});assert.equal(r.buffer,f.buffer);assert.equal(r.retried,true);assert.equal(f.calls.length,2);assert.equal(f.calls[1].path,'owned.png');assert(f.calls[1].timeout>0&&f.calls[1].timeout<=f.calls[0].timeout);assert.deepEqual(f.waits,[0]);
});
test('persistent capture failure propagates after one retry',async()=>{
 const f=fixture(()=>{throw protocol();});await assert.rejects(captureNativeScreenshot(f.page,{path:'owned.png'}),/Unable to capture screenshot/);assert.equal(f.calls.length,2);assert.deepEqual(f.waits,[0]);
});
test('unrelated screenshot failures and closed pages are never retried',async()=>{
 for(const [error,closed]of [[Error('Screenshot timeout'),false],[protocol(),true]]){const f=fixture(()=>{throw error;},closed);await assert.rejects(captureNativeScreenshot(f.page,{path:'owned.png'}),e=>e===error);assert.equal(f.calls.length,1);assert.deepEqual(f.waits,[]);}
});
test('an exhausted original deadline cannot start another capture',async()=>{
 const error=protocol(),f=fixture(async()=>{await new Promise(r=>setTimeout(r,5));throw error;});await assert.rejects(captureNativeScreenshot(f.page,{path:'owned.png',timeout:1}),e=>e===error);assert.equal(f.calls.length,1);assert.deepEqual(f.waits,[]);
});
test('a destroyed page while yielding remains a failure and cannot produce a substitute image',async()=>{
 const error=Error('Target closed'),f=fixture(()=>{throw protocol();},false,error);await assert.rejects(captureNativeScreenshot(f.page,{path:'owned.png'}),e=>e===error);assert.equal(f.calls.length,1);
});
