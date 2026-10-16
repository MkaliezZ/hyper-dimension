import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';
import {RECIPE_BY_ID} from '../src/contentCatalog.js';

const root=path.resolve(process.env.HD_QA_SOURCE_ROOT||path.join(import.meta.dirname,'..')),out=path.resolve(process.env.HD_QA_OUT||'qa/v204/browser-save-waiter');
await mkdir(out,{recursive:true});
const report={sourceRelease:JSON.parse(await readFile(path.join(root,'release-manifest.json'),'utf8')).release,scope:'Real browser save client, IndexedDB worker and isolated authoritative HTTP store. A deterministic second flush waits behind the first; then one compost craft begins and is cancelled. Fixtures provide raw inputs; no gameplay, clock, completed craft or user data is injected. This is a storage concurrency harness, not gameplay or human acceptance.',cases:[],passed:false};
const portFor=async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const port=s.address().port;await new Promise(r=>s.close(r));return port;};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,errors:[],traffic:[],workers:[]};report.cases.push(row);
  const directory=await mkdtemp(path.join(out,theme+'-')),store=createSaveStore({directory:path.join(directory,'saves')}),state=hydrateTown(createZeroState()),recipe=RECIPE_BY_ID.recipe_c14_8;
  state.freshStartPending=false;state.coins=100;for(const[id,n]of Object.entries(recipe.cost))state.inventory[id]=n;await store.open(theme,{legacyState:state,protect:true});
  const port=await portFor(),base='http://127.0.0.1:'+port,server=spawn(process.execPath,[path.join(root,'server.mjs'),'--theme='+theme,'--port='+port],{cwd:root,windowsHide:true,stdio:'ignore',env:{...process.env,DEEPSEEK_API_KEY:'',HD_SAVE_DIR:path.join(directory,'saves'),HD_ENVIRONMENT_DIR:path.join(directory,'environment'),HD_RUN_LEDGER_DIR:path.join(directory,'runs')}});
  const context=await browser.newContext(),page=await context.newPage(),responses=[],requests=new Map();
  await context.route('**/qa-save-order',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated save ordering</title><main>Storage concurrency fixture</main>'}));
  page.on('worker',w=>row.workers.push(new URL(w.url()).pathname));page.on('pageerror',e=>row.errors.push(e.message));page.on('request',r=>{if(r.url().includes('/api/saves/')){const i=r.postDataJSON?.(),entry={path:new URL(r.url()).pathname,kind:i?.kind,operation:i?.operation,expectedVersion:i?.expectedVersion};requests.set(r,entry);row.traffic.push(entry);}});
  page.on('response',r=>{const entry=requests.get(r.request());if(entry)responses.push(r.json().then(d=>Object.assign(entry,{status:r.status(),version:d.document?.version,parentVersion:d.document?.parentVersion,code:d.code})).catch(()=>{}));});
  try{
   for(let i=0;i<100;i++){try{if((await fetch(base+'/api/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
   await page.goto(base+'/qa-save-order');
   row.result=await page.evaluate(async({theme,recipeId})=>{
    const {createSaveClient}=await import('/src/saveClient.js'),seed=(await(await fetch('/api/saves/'+theme)).json()).document.state;
    let client,local,monitor=false,auto=null;
    client=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(t,s)=>{local=s;},onStatus:()=>{
     if(monitor&&client.status(theme).status==='saved'){
      monitor=false;local.player.x+=1;client.enqueue(theme,local);auto=client.flush(theme).then(()=>({saved:true}),e=>({code:e.code}));
     }
    }});
    try{
     local=await client.load(theme);local.player.y+=1;client.enqueue(theme,local);monitor=true;
     const started=await client.action(theme,{kind:'craft',operation:'begin',recipeId,mode:'auto',requestId:crypto.randomUUID()});
     const ticket=started.ticket;await auto;
     const cancelled=await client.action(theme,{kind:'craft',operation:'cancel',requestId:ticket.requestId,epoch:ticket.epoch,sequence:ticket.sequence});
     return {ok:true,auto:await auto,requestId:ticket.requestId,practice:ticket.practice,outcome:cancelled.receipt?.outcome,status:client.status(theme).status};
    }catch(e){return {ok:false,error:e.message,code:e.code,auto:await auto,status:client.status(theme).status};}
   },{theme,recipeId:recipe.id});
   await Promise.all(responses);assert(row.result.ok,JSON.stringify(row.result));assert.equal(row.result.practice,false);assert.equal(row.result.outcome,'cancelled');assert.deepEqual(row.result.auto,{saved:true});
   assert(row.workers.includes('/src/saveWorker.js'));const doc=await store.current(theme);assert.equal(doc.actions.active,null);assert.equal(doc.state.inventory.c14_8||0,0);assert.equal(doc.state.coins,100);
   for(const[id,n]of Object.entries(recipe.cost))assert.equal(doc.state.inventory[id],n);
   assert.equal(doc.actions.receipts.filter(r=>r.ticket.requestId===row.result.requestId).length,1);assert.deepEqual(row.errors,[]);assert(row.traffic.every(r=>r.status===200));row.passed=true;
  }catch(e){row.failure=e.stack;}
  finally{await context.close();if(server.exitCode===null){const closed=new Promise(r=>server.once('close',r));server.kill();await closed;}await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(r=>r.passed);if(!report.passed)process.exitCode=1;
}finally{await browser.close();await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,passed:r.passed,result:r.result,failure:r.failure}))}));}
