import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.resolve(process.env.HD_QA_OUT||'qa/v176/checkpoint-controller');await mkdir(out,{recursive:true});
const service=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><body><main id="game"></main></body>');}const file=path.resolve(root,'.'+decodeURIComponent(pathname));if(!pathname.startsWith('/src/')||!file.startsWith(root+path.sep))return res.writeHead(404).end();res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>service.listen(0,'127.0.0.1',r));let browser;const report={scope:'Real browser serverCraftUI controller with a deterministic mock save adapter reproducing durable pending-envelope replay and a stub game view. Tests checkpoint ordering, recovery, buffered input and claim/exit sequencing; no game outcome, economic, human or native-art acceptance is claimed.',cases:[]};
try{
 browser=await chromium.launch(browserLaunchOptions());const page=await browser.newPage();
 for(const mode of ['normal-tail','lost-tail','claim-join','exit-after-loss','foreign-pending','pending-on-reload','exit-idle-race']){
  await page.goto('http://127.0.0.1:'+service.address().port);
  const row=await page.evaluate(async mode=>{
   const {createServerCraft}=await import('/src/serverCraftUI.js');let controls,ticket,pending=null,flight=null,checkpointCount=0,lose=['lost-tail','exit-after-loss'].includes(mode),transport=false,mounts=0,finishes=0,cancels=0,releaseFirst,idleRaceInjected=false;
   const accepted=[],requests=[],transportLog=[],seen=new Set(),wait=ms=>new Promise(r=>setTimeout(r,ms));
   const identity=()=>({kind:'craft',requestId:'controller-audit',epoch:'audit',sequence:1,nextBatch:1,recipeId:'recipe_outfit',game:{engine:'workshop',state:{kind:'couture'}}});
   const action=async(theme,input)=>{
    if(input.operation==='begin'){ticket=identity();ticket.requestId=input.requestId;return {ticket:structuredClone(ticket),state:{}};}
    const actual=structuredClone(pending?.body||input);requests.push({operation:input.operation,batch:actual.batch,proposed:input.events?.length,actual:actual.events?.length});pending??={body:actual};
    if(actual.operation==='checkpoint'){
     checkpointCount++;if(!seen.has(actual.batch)){seen.add(actual.batch);accepted.push(...actual.events);ticket.nextBatch=actual.batch+1;}
     if(checkpointCount===1&&mode!=='pending-on-reload')await new Promise(r=>releaseFirst=r);
     if(lose){lose=false;throw Error('Injected lost accepted checkpoint reply');}
     pending=null;return {ticket:structuredClone(ticket),state:{}};
    }
    pending=null;if(actual.operation==='finish')finishes++;if(actual.operation==='cancel')cancels++;
    return {ticket:structuredClone(ticket),state:{},receipt:{ticket:structuredClone(ticket),outcome:actual.operation==='finish'?'finished':'cancelled'}};
   };
   const saves={status:()=>({status:pending?'action_pending':'saved',actions:{active:ticket}}),pendingAction:()=>pending,action:(theme,input)=>{const run=action(theme,input);flight=run;run.then(()=>{if(flight===run)flight=null;},()=>{if(flight===run)flight=null;});return run;},idle:async()=>{if(flight)await flight;if(pending)throw Error('Unconfirmed response');if(mode==='exit-idle-race'&&!idleRaceInjected){idleRaceInjected=true;queueMicrotask(()=>pending={body:{kind:'resident',operation:'begin',requestId:'idle-race'}});}}};
   const controller=createServerCraft({saves,theme:()=> 'pixel',persist:()=>{},applyState:()=>{},toast:()=>{},closeGame:()=>{},animate:async()=>{},onComplete:()=>{},continuousCheckpoint:true,mount:(t,s)=>{controls=s;mounts++;return {destroy(){},setCheckpointPending(){},setTransportPaused(v){transport=v;transportLog.push(v)}};}});
   const append=label=>controls.trace({action:{type:'wear',item:label}}),labels=()=>accepted.map(e=>e.action?.item).filter(Boolean);
   let before,retryState;
   if(mode==='pending-on-reload'){
    ticket=identity();pending={body:{kind:'craft',operation:'checkpoint',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence,batch:1,events:[{neutral:true}]}};controller.recover();await document.getElementById('craftRetry').onclick();
   }else{
    await controller.begin('recipe_outfit');append('before-flight');
    if(mode==='foreign-pending'){
     pending={body:{kind:'resident',operation:'begin',requestId:'foreign'}};const blocked=await controls.saveOutcome();before={blocked,bufferedEvents:controller.inspect().bufferedEvents,requests:requests.length};pending=null;const task=controls.saveOutcome();releaseFirst();await task;
    }else{
     const first=controls.saveOutcome();await wait(20);append('during-flight');
     if(mode==='exit-idle-race'){
      const exit=controls.exit();releaseFirst();await first;await wait(30);before={cancels,...controller.inspect()};if(before.exitDrainInFlight)throw Error('Exit drain deadlocked on pending created at idle boundary');await exit;pending=null;await wait(5200);
     }else if(mode==='claim-join'){
      const claim=controls.claim();await wait(20);before={finishes,claimRequested:controller.inspect().claimRequested};releaseFirst();await first;await claim;
     }else if(mode==='exit-after-loss'){
      const exit=controls.exit();releaseFirst();await first;await exit;before={cancels,...controller.inspect()};await wait(5200);if(cancels)throw Error('Cancellation crossed unresolved pending checkpoint');await document.getElementById('craftRetry').onclick();await wait(30);
     }else{
      releaseFirst();await first;before=controller.inspect();
      if(mode==='lost-tail'){
       await wait(5200);if(requests.length!==1)throw Error('Timer retried an unresolved batch');if(await controls.claim())throw Error('Claim crossed unconfirmed response');await document.getElementById('craftRetry').onclick();retryState=controller.inspect();
      }
      await controls.saveOutcome();
     }
    }
   }
   const after=controller.inspect();controller.destroy();return {mode,before,retryState,after,labels:labels(),requests,mounts,finishes,cancels,transport,transportLog};
  },mode);
  if(mode==='normal-tail'){assert.equal(row.before.bufferedEvents,1);assert.deepEqual(row.labels,['before-flight','during-flight']);assert.equal(row.mounts,1);assert.equal(row.after.bufferedEvents,0);}
  if(mode==='lost-tail'){assert.equal(row.before.bufferedEvents,3);assert.equal(row.retryState.bufferedEvents,1);assert.equal(row.retryState.recoveryRequired,false);assert.deepEqual(row.labels,['before-flight','during-flight']);assert.deepEqual(row.requests.map(r=>[r.batch,r.actual]),[[1,2],[1,2],[2,1]]);assert.equal(row.mounts,1);}
  if(mode==='claim-join'){assert.equal(row.before.finishes,0);assert.equal(row.before.claimRequested,true);assert.equal(row.finishes,1);assert.equal(row.cancels,0);assert.deepEqual(row.labels,['before-flight','during-flight']);assert.equal(row.after.active,false);}
  if(mode==='exit-after-loss'){assert.equal(row.before.cancels,0);assert.equal(row.before.exitRequested,true);assert.equal(row.cancels,1);assert.equal(row.finishes,0);assert.equal(row.after.active,false);assert.deepEqual(row.labels,['before-flight']);assert.deepEqual(row.requests.map(r=>r.operation),['checkpoint','checkpoint','cancel']);}
  if(mode==='foreign-pending'){assert.equal(row.before.blocked,false);assert.equal(row.before.requests,0);assert.equal(row.before.bufferedEvents,2);assert.deepEqual(row.labels,['before-flight']);}
  if(mode==='exit-idle-race'){assert.equal(row.before.cancels,0);assert.equal(row.before.exitRequested,true);assert.equal(row.before.exitDrainInFlight,false);assert.equal(row.cancels,1);assert.equal(row.after.active,false);}
  if(mode==='pending-on-reload'){assert.equal(row.mounts,1);assert.equal(row.after.pendingCheckpointEvents,0);assert.equal(row.after.bufferedEvents,1);assert.equal(row.after.recoveryRequired,false);}
  row.passed=true;report.cases.push(row);console.log(mode+' passed');
 }
 report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{await browser?.close();await new Promise(r=>service.close(r));await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({mode:r.mode,passed:r.passed})),failure:report.failure}));}
