import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';

const root=resolve(fileURLToPath(new URL('../',import.meta.url))),out=resolve(process.env.HD_QA_OUT||'qa/v278/native-visitor-clock');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/')return res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'}).end('<!doctype html><html><body><main>Fictional visitor clock protocol probe</main></body></html>');
 const file=resolve(root,'.'+pathname);if(!pathname.startsWith('/src/')||!file.startsWith(join(root,'src')+sep))return res.writeHead(404).end();
 return res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'}).end(await readFile(file));
}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch(browserLaunchOptions());
const report={scope:'Real DOM and actual visitor UI adapter, with a controlled save-journal protocol spy. The spy observes dispatch after the action queue flush and invokes its preparation callback with acknowledged actions, matching SaveClient. A pending resident response must precede the visitor clock checkpoint and arrival dispatch; uncertain journals and early timing stay protected. The separate v351 native fixture uses actual SaveClient/Worker/IndexedDB/HTTP SaveStore. No game map, real authority, resources, provider calls, user browser or human acceptance.',cases:[],passed:false};
try{
 for(const [theme,mode]of [['pixel','pending'],['origami','pending'],['pixel','uncertain'],['pixel','early'],['pixel','ordinary'],['pixel','begin']]){
  const context=await browser.newContext(),page=await context.newPage();await page.goto(base+'/');
  const row=await page.evaluate(async({theme,mode})=>{
   document.body.dataset.theme=theme;const{createServerVisitor}=await import('/src/serverVisitorUI.js');
   const order=[],calls=[],pendingInitially=['pending','uncertain','begin'].includes(mode);let pending=pendingInitially?{body:{kind:'resident',operation:'finish',requestId:'fictional-resident-receipt'}}:null,active=mode==='ordinary'?10:0,persisted=0,accepted,prepareProvided=false,prepared=0;
   const gate=new Promise(resolve=>accepted=resolve),state={actions:{visitor:{activeSeconds:active,nextTripAt:10}},status:'saved'};
   const saves={pendingAction:()=>pending,status:()=>state,
    async checkpoint(){order.push('checkpoint');if(mode==='uncertain')throw Object.assign(Error('Original result remains uncertain'),{code:'action_pending'});if(mode==='pending'){await gate;pending=null;active=10;}state.actions.visitor.activeSeconds=active;order.push('checkpoint-done');},
    // SaveClient flushes the queued action before calling prepareInput. The old
    // two-argument spy ignored that callback and dispatched against stale time.
    async action(t,input,prepareInput){prepareProvided=typeof prepareInput==='function';if(prepareProvided){await this.checkpoint();prepared++;input=prepareInput(input,{state:{coins:0},actions:state.actions});}order.push('action-'+input.operation);calls.push(input.operation);if(input.operation==='arrive'&&active<10)throw Object.assign(Error('Canonical ferry clock is early'),{code:'visitor_early'});return{state:{coins:0}};}};
   const ui=createServerVisitor({saves,theme:()=>theme,persist:()=>persisted++,applyState(){},restore(){},toast(){}});
   let result;const operation=mode==='begin'?'begin':'arrive',promise=ui.command(operation,{guestId:1}).then(()=>result={status:'fulfilled'},e=>result={status:'rejected',code:e.code});
   await new Promise(r=>setTimeout(r,30));const before={calls:[...calls],order:[...order],pendingPreserved:!!pending};
   if(mode==='pending')accepted();await promise;
   return{theme,mode,before,order,calls,result,persisted,prepareProvided,prepared,pendingPreserved:!!pending,locked:ui.inspect().locked};
  },{theme,mode});report.cases.push(row);
  assert.equal(row.prepareProvided,mode!=='begin','Arrival timing is prepared inside the queued transaction');
  assert.equal(row.prepared,mode==='begin'||mode==='uncertain'?0:1,'An uncertain journal must block preparation and dispatch');
  if(mode==='pending'){
   assert.deepEqual(row.before.calls,[],'An in-flight resident receipt must not make arrival skip its clock checkpoint');assert.deepEqual(row.before.order,['checkpoint']);assert.equal(row.result.status,'fulfilled');assert.deepEqual(row.order,['checkpoint','checkpoint-done','action-arrive']);assert.equal(row.locked,false);assert.equal(row.persisted,0);
  }else if(mode==='uncertain'){
   assert.deepEqual(row.calls,[]);assert.equal(row.result.code,'action_pending');assert.equal(row.pendingPreserved,true);assert.equal(row.locked,true);
  }else if(mode==='early'){
   assert.deepEqual(row.calls,[]);assert.equal(row.result.code,'visitor_early');assert.equal(row.locked,false);
  }else if(mode==='ordinary'){
   assert.deepEqual(row.calls,['arrive']);assert.equal(row.result.status,'fulfilled');assert.equal(row.persisted,1);
  }else{
   assert.deepEqual(row.calls,['begin']);assert.equal(row.result.status,'fulfilled');assert.equal(row.order.includes('checkpoint'),false);
  }
  row.passed=true;await context.close();
 }
 report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
