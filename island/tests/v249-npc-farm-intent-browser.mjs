import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {chromium} from 'playwright-core';
import {browserLaunchOptions} from './browserRuntime.mjs';
import {createSaveStore} from '../server/saveStore.mjs';
import {createZeroState} from '../src/freshStart.js';
import {hydrateTown} from '../src/townSimulation.js';

const root=resolve(import.meta.dirname,'..'),out=resolve(process.env.HD_QA_OUT||'qa/v249/npc-farm-intent');await mkdir(out,{recursive:true});
const report={scope:'Native SaveClient durable queue and farm controller with real HTTP SaveStore. Explicit fictional tool/plot fixtures. Hold a real completed player water or harvest receipt while an NPC intent queues against the old acknowledged stage. Require no stale API request, lock, extra material or work receipt; valid NPC work can then begin/cancel. Normal wall time, no providers, original browser, zero-start or human claim.',cases:[],passed:false};
const browser=await chromium.launch(browserLaunchOptions());
try{
 for(const theme of ['pixel','origami'])for(const step of ['water','harvest']){
  const row={theme,step,traffic:[],errors:[],passed:false};report.cases.push(row);
  const directory=await mkdtemp(join(out,theme+'-'+step+'-')),store=createSaveStore({directory}),state=hydrateTown(createZeroState());
  state.freshStartPending=false;Object.assign(state.inventory,{seed:5,hoe:1,watering_can:1,sickle:1});state.plots[0]={stage:step==='water'?2:4,growth:step==='water'?0:180,crop:'wheat'};state.plots[1].stage=2;
  let doc=(await store.open(theme,{legacyState:state,protect:true})).document;await store.action(theme,{kind:'farm',operation:'enable',expectedVersion:doc.version});
  const server=createServer(async(req,res)=>{
   try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><main>Fictional NPC farm queue</main>');return;}
    if(url.pathname.startsWith('/api/saves/')){
     const chunks=[];for await(const c of req)chunks.push(c);const input=chunks.length?JSON.parse(Buffer.concat(chunks)):null,operation=url.pathname.split('/')[4]||'',entry={operation,input:input?Object.fromEntries(['kind','operation','actor','actorId','index','step','crop','requestId'].filter(k=>input[k]!==undefined).map(k=>[k,input[k]])):null};row.traffic.push(entry);
     try{const result=operation==='open'?await store.open(theme,input):operation==='save'?await store.save(theme,input):operation==='action'?await store.action(theme,input):{document:await store.current(theme)};entry.status=200;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}
     catch(e){entry.status=e.status||409;entry.code=e.code;res.writeHead(entry.status,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message,code:e.code}));}return;
    }
    const file=resolve(root,'.'+url.pathname);if(!url.pathname.startsWith('/src/')||!file.startsWith(root+sep)||extname(file)!=='.js')throw Error('route');res.setHeader('Content-Type','text/javascript');res.end(await readFile(file));
   }catch(e){res.statusCode=500;res.end(e.message);}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>row.errors.push(e.message));
  let release,seen,hold=false;const held=new Promise(r=>release=r),observed=new Promise(r=>seen=r);
  await context.route('**/api/saves/*/action',async route=>{const i=route.request().postDataJSON();if(hold&&i.operation==='finish'){hold=false;const response=await route.fetch();assert.equal(response.status(),200);seen();await held;await route.fulfill({response});}else await route.continue();});
  try{
   await page.goto('http://127.0.0.1:'+server.address().port);
   row.first=await page.evaluate(async({theme,step})=>{
    const {createSaveClient}=await import('/src/saveClient.js'),{createServerFarm}=await import('/src/serverFarmUI.js'),seed=(await(await fetch('/api/saves/'+theme)).json()).document.state;
    const f=window.fixture={theme,local:structuredClone(seed),animations:0,toasts:[]};f.saves=createSaveClient({loadLocal:()=>structuredClone(seed),storeLocal(){},onRemoteState:(_,s)=>f.local=s});f.local=await f.saves.load(theme);
    f.farm=createServerFarm({saves:f.saves,theme:()=>theme,persist:()=>f.saves.enqueue(theme,f.local),applyState:s=>f.local=s,startAnimation:()=>f.animations++,stopAnimation(){},onReceipt(){},onRelease(){},toast:s=>f.toasts.push(s)});
    const r=await f.saves.action(theme,{kind:'farm',operation:'begin',actor:'player',index:0,step,crop:'wheat',requestId:crypto.randomUUID()});f.ticket=r.ticket;return{duration:r.ticket.duration};
   },{theme,step});
   await page.waitForTimeout(Math.ceil(row.first.duration*1000)+40);hold=true;
   await page.evaluate(()=>{const f=fixture,t=f.ticket;f.finish=f.saves.action(f.theme,{kind:'farm',operation:'finish',requestId:t.requestId,epoch:t.epoch,sequence:t.sequence});});
   let timer;try{await Promise.race([observed,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Expected actual completed reply not observed')),10000);})]);}finally{clearTimeout(timer);}
   await page.evaluate(step=>{const f=fixture;f.obsolete=f.farm.beginNpc({npcId:0},{farmIndex:0,resource:'wheat'},step).then(ticket=>({ticket:!!ticket}),e=>({code:e.code,error:e.message}));},step);release();
   row.queued=await page.evaluate(async()=>{const f=fixture;await f.finish;const result=await f.obsolete;return{result,animations:f.animations,locked:f.farm.busy(),pending:!!f.saves.pendingAction(f.theme),jobs:f.farm.inspect().jobs.length,stage:f.saves.status(f.theme).actions.farm.plots[0].stage};});
   row.valid=await page.evaluate(async()=>{const f=fixture,t=await f.farm.beginNpc({npcId:0},{farmIndex:1,resource:'wheat'},'water');const result={ticket:!!t,actor:t?.actor,step:t?.step,index:t?.index};if(t)await f.farm.cancelTicket(t);await f.saves.idle(f.theme);return{...result,locked:f.farm.busy(),pending:!!f.saves.pendingAction(f.theme),jobs:f.farm.inspect().jobs.length};});
   doc=await store.current(theme);row.receipts=doc.actions.receipts.map(r=>({actor:r.ticket.actor,step:r.ticket.step,index:r.ticket.index,outcome:r.outcome}));row.final={seeds:doc.state.inventory.seed,wheat:doc.state.inventory.wheat,stage:doc.state.plots[0].stage,leases:doc.state.farmControl.leases.length};
   assert.deepEqual(row.traffic.filter(t=>t.status>=400),[],'A stale queued NPC intent must never reach the authoritative API');
   assert.deepEqual(row.queued,{result:{ticket:false},animations:0,locked:false,pending:false,jobs:0,stage:step==='water'?3:0});
   assert.deepEqual(row.valid,{ticket:true,actor:'npc',step:'water',index:1,locked:false,pending:false,jobs:0});
   assert.equal(row.receipts.filter(r=>r.outcome==='finished').length,1);assert.equal(row.receipts.filter(r=>r.actor==='npc'&&r.outcome==='cancelled').length,1);assert.equal(row.final.seeds,step==='water'?5:6);assert.equal(row.final.wheat,step==='water'?0:2);assert.equal(row.final.leases,0);assert.deepEqual(row.errors,[]);row.passed=true;
  }catch(e){row.failure=e.stack;}
  finally{release();await context.close();await new Promise(r=>server.close(r));await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));}
 }
 report.passed=report.cases.every(r=>r.passed);if(!report.passed)process.exitCode=1;
}finally{await browser.close();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,cases:report.cases.map(r=>({theme:r.theme,step:r.step,passed:r.passed,queued:r.queued,failure:r.failure}))}));}
