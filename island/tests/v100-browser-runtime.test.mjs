import test from 'node:test';import assert from 'node:assert/strict';import {browserLaunchOptions} from './browserRuntime.mjs';
test('release browser runner finds Windows Edge and preserves literal spaced argv paths',()=>{
 const p='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
 assert.deepEqual(browserLaunchOptions({platform:'win32',environment:{},exists:x=>x===p}),{executablePath:p,headless:true});
});
test('release browser runner finds native Apple Silicon/Intel Chrome and per-user Mac Edge',()=>{
 const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
 assert.equal(browserLaunchOptions({platform:'darwin',environment:{},home:'/Users/Island Owner',exists:x=>x===chrome}).executablePath,chrome);
 const edge='/Users/Island Owner/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge';
 assert.equal(browserLaunchOptions({platform:'darwin',environment:{},home:'/Users/Island Owner',exists:x=>x===edge}).executablePath,edge);
});
test('explicit browser path is checked exactly and never silently falls back',()=>{
 const p='/Applications/QA Browser.app/Contents/MacOS/Chromium';
 assert.equal(browserLaunchOptions({platform:'darwin',environment:{HD_QA_BROWSER:p},exists:x=>x===p}).executablePath,p);
 for(const explicit of ['relative/chrome','/missing/Chrome','$(echo secret)'])assert.throws(()=>browserLaunchOptions({platform:'darwin',environment:{HD_QA_BROWSER:explicit},exists:()=>false}),/existing absolute/);
});
test('release browser runner uses Linux Chromium without a Windows path',()=>{
 assert.equal(browserLaunchOptions({platform:'linux',environment:{},exists:x=>x==='/usr/bin/chromium'}).executablePath,'/usr/bin/chromium');
});
test('missing browser and unsupported platform fail with actionable errors',()=>{
 assert.throws(()=>browserLaunchOptions({platform:'darwin',environment:{},exists:()=>false}),/HD_QA_BROWSER/);
 assert.throws(()=>browserLaunchOptions({platform:'freebsd',environment:{},exists:()=>false}),/supports Windows/);
});
