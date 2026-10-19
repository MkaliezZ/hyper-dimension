// Run the original shelf/visitor assertions with one declared lost NPC mining
// completion response per owned island. No clock, stock, actor or result edits.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {FINISH_CLOCK_MARKER,finishClockPrelude,assertNativeFinishClock} from './native-finish-clock.mjs';
const root=resolve(process.env.HD_DIAGNOSTIC_APP_ROOT||process.cwd());
const {chromium}=createRequire(join(root,'package.json'))('playwright-core');
const out=resolve(process.env.HD_QA_OUT||'qa/v321/native-field-finish-market');await mkdir(out,{recursive:true});
process.env.HD_QA_OUT=out;process.env.HD_QA_WORK_JOURNAL='1';
const launch=chromium.launch.bind(chromium),observations=[],pendingReads=[];
chromium.launch=async(...args)=>{
 const browser=await launch(...args),newContext=browser.newContext.bind(browser);
 browser.newContext=async(...contextArgs)=>{
  const context=await newContext(...contextArgs),route=context.route.bind(context),row={index:observations.length,held:0,requests:[],replies:[],nativeClockEvents:[]};observations.push(row);
  context.on('console',message=>{const text=message.text();if(text.startsWith(FINISH_CLOCK_MARKER))row.nativeClockEvents.push(JSON.parse(text.slice(FINISH_CLOCK_MARKER.length)));});
  await route('**/src/saveWorker.js',async intercepted=>{const response=await intercepted.fetch();await intercepted.fulfill({response,body:finishClockPrelude+await response.text()});});
  context.route=async(pattern,handler,...options)=>route(pattern,async intercepted=>{
   const request=intercepted.request(),path=new URL(request.url()).pathname;
   if(request.method()==='POST'&&/^\/api\/saves\/(pixel|origami)\/action$/.test(path)){
    const body=request.postDataJSON();
    if(body.kind==='field'&&body.operation==='finish'){
     row.requests.push({requestId:body.requestId,body:request.postData(),at:Date.now()});
     if(!row.held){
      const response=await intercepted.fetch();assert(response.ok());const result=await response.json(),ticket=result.receipt?.ticket;
      assert(ticket?.kind==='field'&&ticket.field==='mine'&&ticket.actor==='npc');
      row.held++;row.requestId=body.requestId;row.theme=path.split('/')[3];row.actualCommittedGain=result.receipt.gain;row.authorityReplayed=!!result.replayed;
      await new Promise(resolve=>setTimeout(resolve,13000));
      try{await intercepted.fulfill({response});}catch(error){assert(/aborted|cancel|closed|Invalid InterceptionId|Invalid parameters/i.test(error.message));row.expiredOriginalReply=true;}
      return;
     }
    }
   }
   return handler(intercepted);
  },...options);
  context.on('response',response=>{
   const request=response.request();if(request.method()!=='POST'||!new URL(request.url()).pathname.endsWith('/action'))return;
   const body=request.postDataJSON();if(body.kind==='field'&&body.operation==='finish')pendingReads.push(response.json().then(data=>row.replies.push({requestId:body.requestId,replayed:!!data.replayed,status:response.status()})));
  });
  return context;
 };
 return browser;
};
try{
 await import(pathToFileURL(join(root,'tests/v228-custom-shops-browser.mjs')));await Promise.all(pendingReads);
 const report=JSON.parse(await readFile(join(out,'report.json'),'utf8'));assert(report.passed&&report.cases.length===2);
 assert.equal(observations.length,2);
 for(const row of observations){
  assert.equal(row.held,1,'The actual NPC completion fault must occur');
  const requests=row.requests.filter(request=>request.requestId===row.requestId);assert.equal(requests.length,2);assert.equal(new Set(requests.map(request=>request.body)).size,1);row.nodeObservedGapMs=requests[1].at-requests[0].at;row.nativeTiming=assertNativeFinishClock(row.nativeClockEvents,row.requestId);
  assert.equal(row.authorityReplayed,false);assert(row.replies.some(reply=>reply.requestId===row.requestId&&reply.replayed&&reply.status===200));
 }
 await writeFile(join(out,'fault-injection.json'),JSON.stringify({passed:true,scope:'Original finite tourist-rotation,150second road/service,price,cost,stock,escaping,artwork and reload assertions retained. Real NPC completion commits once; the first reply is withheld past the original12second fetch deadline.',observations,wholeGoalComplete:false},null,2));
}catch(error){await writeFile(join(out,'fault-injection.json'),JSON.stringify({passed:false,failure:error.stack,observations,wholeGoalComplete:false},null,2));throw error;}
