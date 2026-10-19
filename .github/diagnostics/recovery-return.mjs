// Candidate fixture repair: retry one reset while fetching read-only app source.
// The original native recovery tests, clocks, mutation routes and gates remain.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createServer} from 'node:http';
import {once} from 'node:events';
const root=resolve('island'),require=createRequire(join(root,'package.json'));
const {chromium,request}=require('playwright-core');

if(process.argv.includes('--check-transport')){
 const counts=new Map(),body='export const ownedSource=true;';
 const server=createServer((req,res)=>{
  const n=(counts.get(req.url)||0)+1;counts.set(req.url,n);
  if(req.url==='/reset'||req.url==='/once'&&n===1||req.url==='/baseline')return req.socket.destroy();
  res.writeHead(req.url==='/unavailable'?503:200,{'Content-Type':'text/javascript'});res.end(body);
 });
 server.listen(0,'127.0.0.1');await once(server,'listening');const base='http://127.0.0.1:'+server.address().port;
 const client=await request.newContext();
 try{
  await assert.rejects(client.get(base+'/baseline',{maxRetries:0}),/ECONNRESET|socket hang up/);assert.equal(counts.get('/baseline'),1);
  const source=await client.get(base+'/once',{maxRetries:1});assert.equal(source.status(),200);assert.equal(await source.text(),body);assert.equal(counts.get('/once'),2);
  await assert.rejects(client.get(base+'/reset',{maxRetries:1}),/ECONNRESET|socket hang up/);assert.equal(counts.get('/reset'),2);
  const unavailable=await client.get(base+'/unavailable',{maxRetries:1});assert.equal(unavailable.status(),503);assert.equal(counts.get('/unavailable'),1);
  console.log(JSON.stringify({actualResetBaselineRejected:true,singleResetReadRecovered:true,repeatedResetStillRejected:true,http503NotRetried:true,browserStarted:false}));
 }finally{await client.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 process.exit(0);
}
const launch=chromium.launch.bind(chromium);
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async(...contextArgs)=>{
  const context=await newContext(...contextArgs),route=context.route.bind(context);
  context.route=(pattern,handler,...options)=>pattern!=='**/src/app.js'?route(pattern,handler,...options):route(pattern,actual=>handler(new Proxy(actual,{get(target,key){
   if(key==='fetch')return async(fetchOptions={})=>{
    assert.equal(target.request().method(),'GET');assert.equal(new URL(target.request().url()).pathname,'/src/app.js');
    assert(!fetchOptions.method||fetchOptions.method==='GET');
    return target.fetch({...fetchOptions,maxRetries:1});
   };
   const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }})),...options);
  return context;
 };
 return browser;
};
process.chdir(root);
await import(pathToFileURL(join(root,'tests/v205-recovery-return-browser.mjs')).href);
assert(!process.exitCode,'Recovery return failed; do not continue to visiting party');
await import(pathToFileURL(join(root,'tests/v205-visiting-party-browser.mjs')).href);
