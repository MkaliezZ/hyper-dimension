import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {randomUUID,createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const root=path.resolve(import.meta.dirname,'..');
const load=name=>import(pathToFileURL(path.join(root,name)).href);
const {chromium}=await load('node_modules/playwright-core/index.mjs');
const {browserLaunchOptions}=await load('tests/browserRuntime.mjs');
const {createSaveStore}=await load('server/saveStore.mjs');
const {createZeroState}=await load('src/freshStart.js');
const {hydrateTown}=await load('src/townSimulation.js');
const out=path.resolve(process.env.HD_QA_OUT||'qa/v342/native-rejected-command');await mkdir(out,{recursive:true});
const digest=async()=>Object.fromEntries(await Promise.all(['src/saveClient.js','src/saveJournal.js','src/saveWorker.js','src/residentRuntime.js','src/app.js','tests/v342-rejected-action-browser.mjs'].map(async n=>[n,createHash('sha256').update(await readFile(path.join(root,n))).digest('hex')])));
const report={scope:'Owned blank native browser contexts load the real save client, IndexedDB worker, HTTP server and ordinary fictional protected save. An actual external NPC begin advances the version immediately before the original client begin reaches the server. No forged response, completed work, resource, clock or user browser injection. This narrow transport check is not full gameplay or human acceptance.',sourceBefore:await digest(),cases:[],passed:false};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme};report.cases.push(row);const dir=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(dir,'saves')}),seed=hydrateTown(createZeroState());seed.freshStartPending=false;
  await store.open(theme,{legacyState:seed,protect:true});
  const net=createServer();await new Promise(r=>net.listen(0,'127.0.0.1',r));const port=net.address().port;await new Promise(r=>net.close(r));const base='http://127.0.0.1:'+port;
  const server=spawn(process.execPath,[path.join(root,'server.mjs'),'--theme='+theme,'--port='+port],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(dir,'saves'),HD_RUN_LEDGER_DIR:path.join(dir,'runs'),HD_ENVIRONMENT_DIR:path.join(dir,'environment')}});
  const context=await browser.newContext(),page=await context.newPage();let injected=false,ticket;const calls=[];
  try{
   for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
   await context.route('**/qa-stale-check',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Fictional stale-command regression</title><body>Isolated transport check</body>'}));
   await context.route('**/api/saves/'+theme+'/action',async route=>{
    const input=route.request().postDataJSON();calls.push(input);
    if(input.requestId==='must-be-rejected'){
     assert(!injected);injected=true;const d=(await(await context.request.get(base+'/api/saves/'+theme)).json()).document;
     const r=await context.request.post(base+'/api/saves/'+theme+'/action',{data:{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',buildingId:null,action:'work',resource:'wood'},gameTime:0,requestId:randomUUID(),expectedVersion:d.version,expectedSequence:d.actions.sequence,epoch:d.actions.epoch}});assert.equal(r.status(),200);ticket=(await r.json()).ticket;assert.equal(ticket.duration,20);
     await page.evaluate(t=>{const s=window.qaClient.status(t).state;s.player.x=14;window.qaClient.enqueue(t,s);},theme);
    }
    await route.continue();
   });
   await page.goto(base+'/qa-stale-check');
   const result=await page.evaluate(async({theme,seed})=>{const{createSaveClient}=await import('/src/saveClient.js');window.qaClient=createSaveClient({loadLocal:()=>seed,storeLocal(){}});await window.qaClient.load(theme);let rejection;try{await window.qaClient.action(theme,{kind:'resident',operation:'begin',actorId:5,intent:{goal:'forest',buildingId:null,action:'work',resource:'wood'},gameTime:0,requestId:'must-be-rejected'});}catch(e){rejection={code:e.code,status:e.status,reconciled:e.independentProgressReconciled};}const before={blocked:window.qaClient.blocked(theme),pending:window.qaClient.pendingAction(theme),x:window.qaClient.status(theme).state.player.x,wood:window.qaClient.status(theme).state.inventory.wood};await window.qaClient.checkpointAndRefresh(theme);return{rejection,before,status:window.qaClient.status(theme).status,leases:Object.keys(window.qaClient.status(theme).actions.resident.leases)};},{theme,seed});
   assert.deepEqual(result.rejection,{code:'save_conflict',status:409,reconciled:true});assert.deepEqual(result.before,{blocked:false,pending:null,x:14,wood:0});assert.equal(calls.length,1);assert.deepEqual(result.leases,[ticket.requestId]);
   const disk=await store.current(theme);assert.equal(disk.state.player.x,14);assert.equal(disk.state.inventory.wood,0);assert.equal(disk.actions.receipts.length,0);assert.equal(Object.keys(disk.actions.resident.leases).length,1);
   const cancel=await context.request.post(base+'/api/saves/'+theme+'/action',{data:{kind:'resident',operation:'cancel',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence,expectedVersion:disk.version}});assert.equal(cancel.status(),200);
   row.passed=true;row.result=result;row.originalClientCommandSentOnce=true;row.actualExternalLeasePreservedUntilOfficialCancel=true;row.noWorkOrMaterialsAwarded=true;
  }catch(e){row.failure=e.stack;throw e;}finally{await context.close();server.kill();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.sourceAfter=await digest();assert.deepEqual(report.sourceAfter,report.sourceBefore);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
