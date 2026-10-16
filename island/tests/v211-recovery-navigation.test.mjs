import test from 'node:test';
import assert from 'node:assert/strict';
import {navigateAfterRecovery,recoveryReturnURL} from '../src/recoveryNavigation.js';

function fixture(){
 const events=new Map(),replaced=[],errors=[];let timer,delay,reloads=0,cancelled=0;
 const pageLocation={href:'http://localhost:4175/play?qa=1&rev=kept#island',reload(){reloads++;},replace(url){replaced.push(url);}},pageWindow={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:(name)=>events.delete(name)};
 const options={pageLocation,pageWindow,schedule(fn,ms){timer=fn;delay=ms;return 1;},cancel(){cancelled++;},onError:e=>errors.push(e)};
 return {options,pageLocation,events,replaced,errors,fire:()=>timer(),get reloads(){return reloads;},get cancelled(){return cancelled;},get delay(){return delay;}};
}
test('cancelled reload falls back to a fresh URL in the same island after confirmation',()=>{
 const f=fixture();navigateAfterRecovery(f.options);assert.equal(f.reloads,1);assert.equal(f.replaced.length,0);assert.equal(f.delay,1500);f.fire();assert.equal(f.replaced.length,1);
 const u=new URL(f.replaced[0]);assert.equal(u.origin,'http://localhost:4175');assert.equal(u.pathname,'/play');assert.equal(u.searchParams.get('qa'),'1');assert.equal(u.searchParams.get('rev'),'kept');assert.equal(u.hash,'#island');assert(u.searchParams.get('recoveryReturn'));assert.deepEqual(f.errors,[]);
});
test('normal pagehide cancels fallback and cannot navigate again from an obsolete document',()=>{const f=fixture();navigateAfterRecovery(f.options);f.events.get('pagehide')();f.fire();assert.equal(f.cancelled,1);assert.equal(f.replaced.length,0);assert.equal(f.events.size,0);});
test('a different navigation chosen by the player is never replaced with the old island',()=>{const f=fixture();navigateAfterRecovery(f.options);f.pageLocation.href='http://localhost:4175/';f.fire();assert.equal(f.replaced.length,0);});
test('reload exception uses the fresh return path immediately',()=>{const f=fixture();f.pageLocation.reload=()=>{throw Error('embedded reload refused');};navigateAfterRecovery(f.options);assert.equal(f.replaced.length,1);assert.equal(f.cancelled,1);});
test('a rejected fallback reports the navigation error without resuming the obsolete game',()=>{const f=fixture(),error=Error('navigation unavailable');f.pageLocation.replace=()=>{throw error;};navigateAfterRecovery(f.options);f.fire();assert.deepEqual(f.errors,[error]);});
test('explicit confirmed return uses a fresh URL in the same island with the original query and hash',()=>{const original='http://localhost:4175/play?rev=current&recoveryReturn=old#island',target=new URL(recoveryReturnURL(original));assert.equal(target.origin,'http://localhost:4175');assert.equal(target.pathname,'/play');assert.equal(target.searchParams.get('rev'),'current');assert.notEqual(target.searchParams.get('recoveryReturn'),'old');assert.equal(target.hash,'#island');});
