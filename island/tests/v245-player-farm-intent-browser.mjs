import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v245/player-farm-intent');await mkdir(out,{recursive:true});
const report={scope:'Native SaveClient worker/journal, farm controller and real HTTP authoritative store. Explicit fictional seeded/tool/plot fixtures. A real completed water receipt is held while an obsolete water intent queues behind it. Also checks premature predicted harvest, valid acknowledged watering, and crop selection. No provider, clock acceleration, user browser or human acceptance.',cases:[],passed:false};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami']){
  const row={theme,traffic:[],errors:[],passed:false};report.cases.push(row);
  const directory=await mkdtemp(join(out,theme+'-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());
  state.freshStartPending=false;Object.assign(state.inventory,{seed:5,hoe:1,watering_can:1,sickle:1});
  state.plots[0].stage=2;state.plots[1].stage=2;state.plots[2].stage=3;state.plots[3].stage=1;
  let doc=(await store.open(theme,{legacyState:state,protect:true})).document;
  await store.action(theme,{kind:'farm',operation:'enable',expectedVersion:doc.version});
  const server=createServer(async(req,res)=>{
   try{
    const url=new URL(req.url,'http://127.0.0.1'),parts=url.pathname.split('/');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><main>Fictional farm intent fixture</main>');return;}
    if(url.pathname.startsWith('/api/saves/')){
     const chunks=[];for await(const c of req)chunks.push(c);const input=chunks.length?JSON.parse(Buffer.concat(chunks)):null,operation=parts[4]||'',entry={operation,input:input?Object.fromEntries(['kind','operation','actor','index','step','crop','requestId'].filter(k=>input[k]!==undefined).map(k=>[k,input[k]])):null};row.traffic.push(entry);
     try{const result=operation==='open'?await store.open(theme,input):operation==='save'?await store.save(theme,input):operation==='action'?await store.action(theme,input):{document:await store.current(theme)};entry.status=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}
     catch(e){entry.status=e.status||409;entry.code=e.code;res.writeHead(entry.status,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message,code:e.code}));}return;
    }
    const file=resolve(root,'.'+url.pathname);if(!url.pathname.startsWith('/src/')||!file.startsWith(root+sep)||extname(file)!=='.js')throw Error('route');
    res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
   }catch(e){res.statusCode=500;res.end(e.message);}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  let release,seen;const held=new Promise(r=>release=r),observed=new Promise(r=>seen=r);let hold=false;
  await context.route('**/api/saves/*/action',async route=>{const i=route.request().postDataJSON();if(hold&&i.operation==='finish'){hold=false;const response=await route.fetch();seen();await held;await route.fulfill({response});}else await route.continue();});
  try{
   await page.goto('http://127.0.0.1:'+server.address().port);
   row.ticket=await page.evaluate(async theme=>{
    const {createSaveClient}=await import('/src/saveClient.js'),{createServerFarm}=await import('/src/serverFarmUI.js');
    const seed=(await(await fetch('/api/saves/'+theme)).json()).document.state;
    const fixture=window.fixture={theme,local:structuredClone(seed),animations:0,releases:0,toasts:[]};
    fixture.saves=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(_,s)=>fixture.local=s});fixture.local=await fixture.saves.load(theme);
    fixture.farm=createServerFarm({saves:fixture.saves,theme:()=>theme,persist:()=>fixture.saves.enqueue(theme,fixture.local),applyState:s=>fixture.local=s,startAnimation:()=>fixture.animations++,stopAnimation(){},onReceipt(){},onRelease:()=>fixture.releases++,toast:s=>fixture.toasts.push(s)});
    const r=await fixture.saves.action(theme,{kind:'farm',operation:'begin',actor:'player',index:0,step:'water',crop:'wheat',requestId:crypto.randomUUID()});fixture.ticket=r.ticket;return{duration:r.ticket.duration};
   },theme);
   await page.waitForTimeout(Math.ceil(row.ticket.duration*1000)+40);hold=true;
   await page.evaluate(()=>{const f=fixture,t=f.ticket;f.finish=f.saves.action(f.theme,{kind:'farm',operation:'finish',requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});});
   let deadline;try{await Promise.race([observed,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Expected completed water response was not observed within 10s')),10000);})]);}finally{clearTimeout(deadline);}
   await page.evaluate(()=>{fixture.obsolete=fixture.farm.begin(0,'water','wheat');});release();
   row.queued=await page.evaluate(async()=>{const f=fixture;await f.finish;await f.obsolete;return{animations:f.animations,locked:f.farm.busy(),pending:!!f.saves.pendingAction(f.theme),stage:f.saves.status(f.theme).actions.farm.plots[0].stage,toasts:f.toasts};});
   // A predicted harvest is represented by its intent, never by overwriting a
   // protected plot in the save itself. The acknowledged plot is still growing.
   row.predicted=await page.evaluate(async()=>{const f=fixture;await f.farm.begin(2,'harvest','wheat');return{animations:f.animations,locked:f.farm.busy(),pending:!!f.saves.pendingAction(f.theme)};});
   row.valid=await page.evaluate(async()=>{const f=fixture;await f.farm.begin(1,'water','wheat');const t=f.farm.inspect().current,result={animations:f.animations,ticket:!!t,step:t?.step,index:t?.index};if(t)await f.farm.cancelTicket(t);return{...result,locked:f.farm.busy(),pending:!!f.saves.pendingAction(f.theme)};});
   row.sow=await page.evaluate(async()=>{const f=fixture;await f.farm.begin(3,'sow','tomato');const t=f.farm.inspect().current,result={ticket:!!t,crop:t?.crop};if(t)await f.farm.cancelTicket(t);await f.saves.idle(f.theme);return{...result,locked:f.farm.busy()};});
   doc=await store.current(theme);row.receipts=doc.actions.receipts.map(r=>({step:r.ticket.step,index:r.ticket.index,outcome:r.outcome}));row.final={seeds:doc.state.inventory.seed,stage:doc.state.plots[0].stage,watered:doc.state.journey.stats.watered,leases:doc.state.farmControl.leases.length};
   assert.deepEqual(row.traffic.filter(t=>t.status>=400),[],'Obsolete local intents must not reach the authoritative API');
   assert.equal(row.queued.animations,0);assert.equal(row.queued.locked,false);assert.equal(row.queued.pending,false);assert.equal(row.queued.stage,3);assert(row.queued.toasts.some(s=>s.includes('浇水')||s.includes('生长')));
   assert.deepEqual(row.predicted,{animations:0,locked:false,pending:false});assert.deepEqual(row.valid,{animations:1,ticket:true,step:'water',index:1,locked:false,pending:false});assert.deepEqual(row.sow,{ticket:true,crop:'tomato',locked:false});
   assert.equal(row.receipts.filter(r=>r.outcome==='finished').length,1);assert.equal(row.final.seeds,5);assert.equal(row.final.stage,3);assert.equal(row.final.watered,1);assert.equal(row.final.leases,0);assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(e){row.failure=e.stack;}
  finally{release();await context.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(r=>r.passed);if(!report.passed)process.exitCode=1;
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,passed:r.passed,queued:r.queued,predicted:r.predicted,valid:r.valid,sow:r.sow,failure:r.failure}))}));}
